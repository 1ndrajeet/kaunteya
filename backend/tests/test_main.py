import hashlib
import hmac
import time

from fastapi.testclient import TestClient

from main import app
from routers.slack import parse_message_intent, verify_slack_signature

client = TestClient(app)


# ==============================================================================
# Existing Base Endpoint Tests
# ==============================================================================


def test_read_root() -> None:
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["docs_url"] == "/docs"
    assert data["health_url"] == "/health"


def test_read_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app" in data
    assert "environment" in data
    assert "timestamp" in data


def test_cors_preflight() -> None:
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


# ==============================================================================
# Module 1: Slack Endpoint Tests & Intent Parsing
# ==============================================================================


def test_slack_health_and_status() -> None:
    health_resp = client.get("/api/slack/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert "status" in health_data
    assert "bot_token_configured" in health_data
    assert "signing_secret_configured" in health_data

    status_resp = client.get("/api/slack/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["runtime"] == "fastapi_events_api"
    assert status_data["features"]["conversational_claim_detection"] is True


def test_slack_url_verification_challenge() -> None:
    challenge_payload = {
        "type": "url_verification",
        "challenge": "test_challenge_token_12345",
    }
    response = client.post("/api/slack/events", json=challenge_payload)
    assert response.status_code == 200
    assert response.json() == {"challenge": "test_challenge_token_12345"}


def test_slack_signature_verification() -> None:
    secret = "test_signing_secret_taskpilot"
    timestamp = str(int(time.time()))
    body = b'{"type":"event_callback","event":{"type":"message","text":"hello"}}'

    # Valid signature
    sig_basestring = f"v0:{timestamp}:{body.decode()}".encode()
    valid_sig = "v0=" + hmac.new(secret.encode(), sig_basestring, hashlib.sha256).hexdigest()
    is_valid, msg = verify_slack_signature(valid_sig, timestamp, body, secret)
    assert is_valid is True
    assert msg == "ok"

    # Stale timestamp (> 300 seconds)
    stale_ts = str(int(time.time()) - 400)
    is_valid, msg = verify_slack_signature(valid_sig, stale_ts, body, secret)
    assert is_valid is False
    assert "Stale request" in msg

    # Invalid signature content
    is_valid, msg = verify_slack_signature("v0=invalid_sig", timestamp, body, secret)
    assert is_valid is False
    assert "HMAC signature verification failed" in msg


def test_slack_intent_classification() -> None:
    # 1. Pure completion claim
    c1 = parse_message_intent("CORE-14 is done.")
    assert c1["intent"] == "claim_completion"
    assert c1["is_completion_claim"] is True
    assert c1["task_identifier"] == "CORE-14"

    # 2. Spec example: partial progress with blocker (must NOT be treated as complete!)
    c2 = parse_message_intent("Payment API is done, but I'm still waiting on test credentials.")
    assert c2["intent"] == "partial_with_blocker"
    assert c2["is_completion_claim"] is False

    # 3. Blocker report
    c3 = parse_message_intent("CORE-14 is blocked by authentication gateway.")
    assert c3["intent"] == "report_blocker"
    assert c3["is_completion_claim"] is False

    # 4. Progress update
    c4 = parse_message_intent("CORE-14 is in progress.")
    assert c4["intent"] == "update_progress"
    assert c4["is_completion_claim"] is False


def test_slack_unmapped_user_rejection() -> None:
    # Request with unmapped random Slack user ID
    payload = {
        "workspace_id": "00000000-0000-0000-0000-000000000000",
        "slack_user_id": "U_NONEXISTENT_USER",
        "text": "CORE-14 is complete",
    }
    response = client.post("/api/slack/process-claim", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert "Identity Not Linked" in data["reply_message"]


# ==============================================================================
# Module 2: GitHub Endpoint Tests
# ==============================================================================


def test_github_health() -> None:
    response = client.get("/api/github/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "app_configured" in data
    assert "token_configured" in data
    assert "accessible_repositories" in data


def test_github_verify_nonexistent_task() -> None:
    payload = {
        "task_id": "00000000-0000-0000-0000-000000000000",
        "claim_text": "TASK-99 is done",
    }
    response = client.post("/api/github/verify-claim", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["verification_status"] == "no_evidence"
    assert data["completion_approved"] is False
    assert "not found in database" in data["reasons"][0]


# ==============================================================================
# Module 3: Dignity Score Tests & Benchmark Calculation
# ==============================================================================


def test_dignity_score_health() -> None:
    response = client.get("/api/dignity-score/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["formula_version"] == "v1"
    assert len(data["scoring_dimensions"]) == 4


def test_benchmark_contributor_a_button() -> None:
    """Benchmark test from specification:

    Contributor A:
    - Task: Add a simple button
    - Task value: 15.0 points
    - Entire deliverable accepted
    - Quality multiplier: 1.00
    - Result: Exactly 15.0 accepted contribution points, 100% progress.
    """
    payload = {
        "task_value": 15.0,
        "quality_multiplier": 1.00,
    }
    response = client.post("/api/dignity-score/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["accepted_contribution_points"] == 15.0
    assert data["eligible_task_value"] == 15.0
    assert data["accepted_progress"] == 1.0


def test_benchmark_contributor_b_payment_gateway() -> None:
    """Benchmark test from specification:

    Contributor B:
    - Task: Payment gateway integration
    - Task value: 40.0 points
    - Accepted milestone weights:
      - auth: 15% (100% accepted)
      - initiation flow: 20% (100% accepted)
      - server verification: 25% (20% accepted -> 0.05)
      - failure/retry handling: 15% (0% accepted)
      - end-to-end testing: 25% (0% accepted)
    - Quality multiplier: 1.00
    - Progress: 0.15 + 0.20 + (0.25 * 0.20) = 0.40
    - Accepted contribution: 40.0 * 0.40 = 16.0 points.
    """
    payload = {
        "task_value": 40.0,
        "quality_multiplier": 1.00,
        "milestones": [
            {"name": "authentication", "weight": 0.15, "accepted_fraction": 1.0},
            {"name": "initiation flow", "weight": 0.20, "accepted_fraction": 1.0},
            {"name": "server verification", "weight": 0.25, "accepted_fraction": 0.20},
            {"name": "failure/retry handling", "weight": 0.15, "accepted_fraction": 0.0},
            {"name": "end-to-end testing", "weight": 0.25, "accepted_fraction": 0.0},
        ],
    }
    response = client.post("/api/dignity-score/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["accepted_contribution_points"] == 16.0
    assert data["eligible_task_value"] == 40.0
    assert data["accepted_progress"] == 0.40


def test_dignity_score_dimensions_formula() -> None:
    """Validate task value formula: V_t = 10 * (0.40*I + 0.30*C + 0.20*R + 0.10*U)."""
    # Test values: I=4, C=3, R=2, U=1
    # V_t = 10 * (0.40*4 + 0.30*3 + 0.20*2 + 0.10*1) = 10 * (1.6 + 0.9 + 0.4 + 0.1) = 30.0
    payload = {
        "dimensions": {
            "impact": 4.0,
            "complexity": 3.0,
            "risk": 2.0,
            "uncertainty": 1.0,
        },
        "quality_multiplier": 1.00,
    }
    response = client.post("/api/dignity-score/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["eligible_task_value"] == 30.0
    assert data["accepted_contribution_points"] == 30.0


def test_dignity_score_determinism() -> None:
    """Repeated scoring requests produce deterministic results for unchanged inputs."""
    payload = {
        "task_value": 25.0,
        "milestones": [
            {"name": "m1", "weight": 0.5, "accepted_fraction": 0.8},
            {"name": "m2", "weight": 0.5, "accepted_fraction": 0.2},
        ],
    }
    r1 = client.post("/api/dignity-score/calculate", json=payload).json()
    r2 = client.post("/api/dignity-score/calculate", json=payload).json()
    assert r1["accepted_contribution_points"] == r2["accepted_contribution_points"]
    assert r1["accepted_progress"] == r2["accepted_progress"]
