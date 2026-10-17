"""TaskPilot Phase 3 Slack Router.

Receives Slack events, verifies signatures, maps Slack users to TaskPilot members,
parses completion claims vs blockers, and initiates real GitHub verification.
"""

import hashlib
import hmac
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict

from config import get_settings
from routers.github import verify_task_completion_claim

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/slack", tags=["Slack Integration"])


# ==============================================================================
# Pydantic Schemas
# ==============================================================================


class SlackHealthResponse(BaseModel):
    status: str
    bot_token_configured: bool
    signing_secret_configured: bool
    app_token_configured: bool
    bot_identity: dict[str, Any] | None = None
    timestamp: str

    model_config = ConfigDict(extra="ignore")


class ProcessClaimRequest(BaseModel):
    workspace_id: str
    slack_user_id: str
    channel_id: str = "C_DIAGNOSTIC"
    thread_ts: str | None = None
    text: str

    model_config = ConfigDict(extra="ignore")


class ProcessClaimResponse(BaseModel):
    ok: bool
    intent: str
    task_identifier: str | None = None
    task_id: str | None = None
    claim_id: str | None = None
    verification_status: str | None = None
    new_task_status: str | None = None
    reply_message: str

    model_config = ConfigDict(extra="ignore")


# ==============================================================================
# Supabase & Slack HTTP Helpers
# ==============================================================================


def _supabase_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def verify_slack_signature(
    signature: str | None, timestamp: str | None, raw_body: bytes, signing_secret: str
) -> tuple[bool, str]:
    """Verify HMAC SHA-256 Slack signature and freshness window (300s)."""
    if not signature:
        return False, "Missing x-slack-signature header"
    if not timestamp:
        return False, "Missing x-slack-request-timestamp header"
    if not signing_secret:
        return False, "Slack signing secret is not configured"

    try:
        req_time = int(timestamp)
    except ValueError:
        return False, "Invalid timestamp format"

    now = int(time.time())
    if abs(now - req_time) > 300:
        return False, f"Stale request: timestamp differs by {abs(now - req_time)}s (>300s limit)"

    sig_basestring = f"v0:{timestamp}:{raw_body.decode('utf-8', errors='replace')}".encode()
    expected_sig = (
        "v0=" + hmac.new(signing_secret.encode("utf-8"), sig_basestring, hashlib.sha256).hexdigest()
    )

    if not hmac.compare_digest(signature, expected_sig):
        return False, "HMAC signature verification failed"

    return True, "ok"


async def post_slack_message(
    channel: str, text: str, thread_ts: str | None = None
) -> dict[str, Any] | None:
    """Post message to Slack channel or thread using bot token."""
    settings = get_settings()
    if not settings.slack_bot_token:
        logger.warning("Cannot post Slack message: SLACK_BOT_TOKEN not configured")
        return None

    payload: dict[str, Any] = {
        "channel": channel,
        "text": text,
    }
    if thread_ts:
        payload["thread_ts"] = thread_ts

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={
                    "Authorization": f"Bearer {settings.slack_bot_token}",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json=payload,
                timeout=8.0,
            )
            data = resp.json()
            if not data.get("ok"):
                logger.warning("Slack chat.postMessage error: %s", data.get("error"))
            return data
    except Exception as err:
        logger.error("Failed to post message to Slack: %s", err)
        return None


# ==============================================================================
# Intent & Claim Parsing
# ==============================================================================


def clean_slack_text(text: str) -> str:
    """Strip user mention tags e.g. <@U01234567>."""
    return re.sub(r"<@[A-Z0-9]+>", "", text).strip()


def extract_task_identifier(text: str) -> str | None:
    """Extract standard task identifier like 'CORE-14' or 'VSTO-1'."""
    match = re.search(r"\b([A-Z]{2,6})-(\d+)\b", text, re.IGNORECASE)
    if match:
        return f"{match.group(1).upper()}-{match.group(2)}"
    return None


def parse_message_intent(text: str) -> dict[str, Any]:
    """Deterministically classify Slack message into intent, task ID, and blocker details."""
    clean = clean_slack_text(text)
    task_id = extract_task_identifier(clean)

    # 1. Check for blocker indicators
    blocker_patterns = [
        r"\b(waiting\s+(on|for))\b",
        r"\b(blocked(\s+by)?)\b",
        r"\b(dependency\s+on)\b",
        r"\b(stuck(\s+on)?)\b",
        r"\b(blocker)\b",
    ]
    is_blocker = any(re.search(pat, clean, re.IGNORECASE) for pat in blocker_patterns)

    # 2. Check for completion indicators
    completion_patterns = [
        r"\b(done|complete|completed|finished|resolved|merged|shipped)\b",
    ]
    has_completion_word = any(re.search(pat, clean, re.IGNORECASE) for pat in completion_patterns)

    # Special handling: "done, but waiting on test credentials" -> partial progress + blocker!
    if has_completion_word and is_blocker:
        return {
            "intent": "partial_with_blocker",
            "task_identifier": task_id,
            "is_completion_claim": False,
            "raw_text": text,
            "summary": clean,
        }

    if is_blocker:
        return {
            "intent": "report_blocker",
            "task_identifier": task_id,
            "is_completion_claim": False,
            "raw_text": text,
            "summary": clean,
        }

    if has_completion_word:
        return {
            "intent": "claim_completion",
            "task_identifier": task_id,
            "is_completion_claim": True,
            "raw_text": text,
            "summary": clean,
        }

    # Status updates (e.g. "in progress", "started", "wip")
    if re.search(r"\b(in\s*progress|started|working\s*on|wip)\b", clean, re.IGNORECASE):
        return {
            "intent": "update_progress",
            "task_identifier": task_id,
            "is_completion_claim": False,
            "raw_text": text,
            "summary": clean,
        }

    return {
        "intent": "general_update",
        "task_identifier": task_id,
        "is_completion_claim": False,
        "raw_text": text,
        "summary": clean,
    }


# ==============================================================================
# Core Slack Message & Claim Processing
# ==============================================================================


async def process_slack_message(
    workspace_id: str | None,
    slack_user_id: str,
    channel_id: str,
    message_ts: str,
    thread_ts: str | None,
    text: str,
) -> ProcessClaimResponse:
    """Process message from Slack contributor and execute verification loop."""
    settings = get_settings()
    effective_thread = thread_ts or message_ts
    parsed = parse_message_intent(text)
    task_ident = parsed.get("task_identifier")

    async with httpx.AsyncClient() as client:
        # 1. Resolve Slack User to TaskPilot Profile
        user_map_resp = await client.get(
            f"{settings.supabase_url}/rest/v1/slack_user_mappings?"
            f"slack_user_id=eq.{slack_user_id}&link_status=eq.linked&select=*",
            headers=_supabase_headers(),
            timeout=10.0,
        )
        taskpilot_user_id: str | None = None
        user_ws_id: str | None = workspace_id

        if user_map_resp.status_code == 200 and user_map_resp.json():
            mapping = user_map_resp.json()[0]
            taskpilot_user_id = mapping.get("taskpilot_user_id")
            user_ws_id = user_ws_id or mapping.get("workspace_id")

        if not taskpilot_user_id and settings.slack_bot_token:
            # Attempt auto-linking via Slack users.info email match
            slack_info_resp = await client.get(
                f"https://slack.com/api/users.info?user={slack_user_id}",
                headers={"Authorization": f"Bearer {settings.slack_bot_token}"},
                timeout=8.0,
            )
            if slack_info_resp.status_code == 200 and slack_info_resp.json().get("ok"):
                u_profile = slack_info_resp.json().get("user", {}).get("profile", {})
                email = u_profile.get("email")
                if email:
                    prof_resp = await client.get(
                        f"{settings.supabase_url}/rest/v1/profiles?email=eq.{email}&select=*",
                        headers=_supabase_headers(),
                        timeout=8.0,
                    )
                    if prof_resp.status_code == 200 and prof_resp.json():
                        matched_prof = prof_resp.json()[0]
                        taskpilot_user_id = matched_prof.get("id")

        if not taskpilot_user_id:
            msg = (
                f"Identity Not Linked: Your Slack account (<@{slack_user_id}>) is not yet "
                "linked to TaskPilot. Please link your account in TaskPilot Settings."
            )
            await post_slack_message(channel_id, msg, effective_thread)
            return ProcessClaimResponse(
                ok=False,
                intent=parsed["intent"],
                task_identifier=task_ident,
                reply_message=msg,
            )

        # 2. Resolve Task
        task_data: dict[str, Any] | None = None
        if task_ident:
            # Parse identifier into project identifier and task_number
            parts = task_ident.split("-")
            proj_ident = parts[0]
            t_num = int(parts[1])
            task_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/tasks?"
                f"task_number=eq.{t_num}&select=*,projects!inner(*)",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            if task_resp.status_code == 200:
                for row in task_resp.json():
                    if row.get("projects", {}).get("identifier", "").upper() == proj_ident.upper():
                        task_data = row
                        break
        elif effective_thread:
            # Check thread association
            thread_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/tasks?"
                f"slack_thread_ts=eq.{effective_thread}&select=*,projects(*)",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            if thread_resp.status_code == 200 and thread_resp.json():
                task_data = thread_resp.json()[0]
                task_ident = (
                    f"{task_data.get('projects', {}).get('identifier', 'TASK')}-"
                    f"{task_data.get('task_number')}"
                )

        if not task_data:
            msg = (
                "Could not resolve this message to an existing TaskPilot task. "
                "Please specify the task identifier (e.g. `CORE-14 is complete`)."
            )
            await post_slack_message(channel_id, msg, effective_thread)
            return ProcessClaimResponse(
                ok=False,
                intent=parsed["intent"],
                task_identifier=task_ident,
                reply_message=msg,
            )

        task_id = task_data["id"]
        final_ws_id = user_ws_id or task_data["workspace_id"]

        # 3. Verify Contributor Membership in Workspace
        mem_resp = await client.get(
            f"{settings.supabase_url}/rest/v1/workspace_members?"
            f"workspace_id=eq.{final_ws_id}&user_id=eq.{taskpilot_user_id}&select=*",
            headers=_supabase_headers(),
            timeout=8.0,
        )
        if mem_resp.status_code != 200 or not mem_resp.json():
            msg = f"Unauthorized: You are not an active member of workspace {final_ws_id}."
            await post_slack_message(channel_id, msg, effective_thread)
            return ProcessClaimResponse(
                ok=False,
                intent=parsed["intent"],
                task_identifier=task_ident,
                task_id=task_id,
                reply_message=msg,
            )

        # 4. Handle Non-Completion Intents (Blocker, Progress Update, Partial)
        if parsed["intent"] == "report_blocker" or parsed["intent"] == "partial_with_blocker":
            # Update task status to Blocked
            await client.patch(
                f"{settings.supabase_url}/rest/v1/tasks?id=eq.{task_id}",
                headers=_supabase_headers(),
                json={
                    "status": "Blocked",
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                timeout=8.0,
            )
            # Record audit event
            await client.post(
                f"{settings.supabase_url}/rest/v1/activity_events",
                headers=_supabase_headers(),
                json={
                    "workspace_id": final_ws_id,
                    "actor_id": taskpilot_user_id,
                    "entity_type": "task",
                    "entity_id": task_id,
                    "event_type": "task_blocked_via_slack",
                    "metadata": {"text": text, "task_identifier": task_ident},
                },
                timeout=8.0,
            )
            msg = (
                f"Acknowledged blocker for *{task_ident}*. "
                f"Task status marked as `Blocked`. Reason: _{parsed['summary']}_"
            )
            await post_slack_message(channel_id, msg, effective_thread)
            return ProcessClaimResponse(
                ok=True,
                intent=parsed["intent"],
                task_identifier=task_ident,
                task_id=task_id,
                new_task_status="Blocked",
                reply_message=msg,
            )

        if parsed["intent"] == "update_progress":
            await client.patch(
                f"{settings.supabase_url}/rest/v1/tasks?id=eq.{task_id}",
                headers=_supabase_headers(),
                json={
                    "status": "In Progress",
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                timeout=8.0,
            )
            msg = f"Updated *{task_ident}* status to `In Progress`."
            await post_slack_message(channel_id, msg, effective_thread)
            return ProcessClaimResponse(
                ok=True,
                intent=parsed["intent"],
                task_identifier=task_ident,
                task_id=task_id,
                new_task_status="In Progress",
                reply_message=msg,
            )

        # 5. Handle Completion Claim -> Execute GitHub Verification Loop
        # Persist claim in work_claims
        claim_resp = await client.post(
            f"{settings.supabase_url}/rest/v1/work_claims",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            json={
                "workspace_id": final_ws_id,
                "task_id": task_id,
                "claimant_id": taskpilot_user_id,
                "claim_source": "slack_followup",
                "claim_text": text,
                "claim_type": "completion",
                "review_state": "pending",
            },
            timeout=8.0,
        )
        claim_id = claim_resp.json()[0]["id"] if claim_resp.status_code in (200, 201) else None

        # Execute GitHub Verification
        v_result = await verify_task_completion_claim(
            task_id=task_id,
            claim_id=claim_id,
            claimant_id=taskpilot_user_id,
            slack_user_id=slack_user_id,
            workspace_id=final_ws_id,
            claim_text=text,
        )

        new_status = task_data.get("status")

        if v_result.verification_status == "verified" and v_result.completion_approved:
            new_status = "Done"
            await client.patch(
                f"{settings.supabase_url}/rest/v1/tasks?id=eq.{task_id}",
                headers=_supabase_headers(),
                json={
                    "status": "Done",
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                timeout=8.0,
            )
            evidence_summary = (
                f"Commit `{v_result.evidence[0].sha[:7]}`"
                if v_result.evidence and v_result.evidence[0].sha
                else "Pull Request"
            )
            reply = (
                f"Task *{task_ident}* verified and marked as *Done*!\n"
                f"Evidence: {evidence_summary} by mapped contributor. "
                "Contribution points have been credited."
            )
        elif v_result.verification_status in ("partial_evidence", "needs_review"):
            new_status = "In Review"
            await client.patch(
                f"{settings.supabase_url}/rest/v1/tasks?id=eq.{task_id}",
                headers=_supabase_headers(),
                json={
                    "status": "In Review",
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                timeout=8.0,
            )
            reason_text = v_result.reasons[0] if v_result.reasons else "Checks or PR merge pending."
            reply = (
                f"Task *{task_ident}* claim received, but requires human review.\n"
                f"Reason: {reason_text}\n"
                "Task marked as *In Review*."
            )
        elif v_result.verification_status == "identity_mismatch":
            reply = (
                f"Identity Mismatch for *{task_ident}*: The code activity detected "
                "in the authorized repository was authored by another account, "
                "not your linked GitHub identity. Claim flagged for team lead review."
            )
        elif v_result.verification_status == "repository_mismatch":
            reply = (
                f"Repository Mismatch: No authorized GitHub repository is configured "
                f"for *{task_ident}*. Please associate a repository in TaskPilot."
            )
        elif v_result.verification_status == "unavailable":
            reply = (
                f"GitHub verification is temporarily unavailable for *{task_ident}*. "
                "Your completion claim has been saved as `pending` without penalty and "
                "will be re-checked."
            )
        else:  # no_evidence
            reply = (
                f"No evidence found on GitHub for *{task_ident}*. "
                f"Please ensure your commit message or PR title includes `{task_ident}` "
                "and is pushed to the project's authorized repository."
            )

        await post_slack_message(channel_id, reply, effective_thread)

        return ProcessClaimResponse(
            ok=True,
            intent=parsed["intent"],
            task_identifier=task_ident,
            task_id=task_id,
            claim_id=claim_id,
            verification_status=v_result.verification_status,
            new_task_status=new_status,
            reply_message=reply,
        )


# ==============================================================================
# Router Endpoints
# ==============================================================================


@router.get("/health", response_model=SlackHealthResponse)
async def slack_health() -> SlackHealthResponse:
    """Diagnostic health endpoint reporting Slack configuration and bot status."""
    settings = get_settings()
    token_ok = bool(settings.slack_bot_token)
    secret_ok = bool(settings.slack_signing_secret)
    app_token_ok = bool(settings.slack_app_token)

    bot_identity: dict[str, Any] | None = None
    if token_ok:
        try:
            async with httpx.AsyncClient() as client:
                auth_resp = await client.get(
                    "https://slack.com/api/auth.test",
                    headers={"Authorization": f"Bearer {settings.slack_bot_token}"},
                    timeout=6.0,
                )
                if auth_resp.status_code == 200 and auth_resp.json().get("ok"):
                    data = auth_resp.json()
                    bot_identity = {
                        "bot_id": data.get("bot_id"),
                        "user": data.get("user"),
                        "team": data.get("team"),
                        "team_id": data.get("team_id"),
                    }
        except Exception as err:
            logger.warning("Error fetching Slack bot identity: %s", err)

    status_str = "ok" if (token_ok and secret_ok) else "misconfigured"

    return SlackHealthResponse(
        status=status_str,
        bot_token_configured=token_ok,
        signing_secret_configured=secret_ok,
        app_token_configured=app_token_ok,
        bot_identity=bot_identity,
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.get("/status")
async def slack_status() -> dict[str, Any]:
    """Integration diagnostics status endpoint."""
    health_data = await slack_health()
    return {
        "status": health_data.status,
        "runtime": "fastapi_events_api",
        "bot_identity": health_data.bot_identity,
        "features": {
            "conversational_claim_detection": True,
            "github_verification_loop": True,
            "idempotent_event_deduplication": True,
            "replay_attack_protection": True,
        },
    }


@router.post("/events")
async def slack_events(
    request: Request,
    x_slack_signature: str | None = Header(None),
    x_slack_request_timestamp: str | None = Header(None),
) -> Response:
    """Slack Events API webhook endpoint.

    Verifies HMAC SHA-256 signature, deduplicates events, and triggers verification loop.
    """
    settings = get_settings()
    raw_body = await request.body()

    # 1. Parse JSON payload
    try:
        body = await request.json()
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload"
        ) from err

    # 2. Handle Slack URL Verification Challenge
    if body.get("type") == "url_verification":
        # Verify signature if secret configured and signature headers provided
        if settings.slack_signing_secret and x_slack_signature and x_slack_request_timestamp:
            is_valid, reason = verify_slack_signature(
                x_slack_signature,
                x_slack_request_timestamp,
                raw_body,
                settings.slack_signing_secret,
            )
            if not is_valid:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=reason)
        return Response(
            content=f'{{"challenge":"{body.get("challenge")}"}}',
            media_type="application/json",
        )

    # 3. Verify Signature
    if not settings.slack_signing_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SLACK_SIGNING_SECRET is not configured on the server",
        )

    is_valid, reason = verify_slack_signature(
        x_slack_signature,
        x_slack_request_timestamp,
        raw_body,
        settings.slack_signing_secret,
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=reason)

    # 4. Filter Bot Messages & Irrelevant Events
    event = body.get("event") or {}
    if not event or event.get("bot_id") or event.get("subtype") == "bot_message":
        return Response(
            content='{"ok":true,"ignored":"bot_message"}',
            media_type="application/json",
        )

    # 5. Idempotency Check in Supabase integration_events
    event_id = body.get("event_id") or event.get("event_ts") or f"evt_{int(time.time() * 1000)}"

    async with httpx.AsyncClient() as client:
        existing_resp = await client.get(
            f"{settings.supabase_url}/rest/v1/integration_events?"
            f"provider=eq.slack&external_event_id=eq.{event_id}&select=*",
            headers=_supabase_headers(),
            timeout=8.0,
        )
        if existing_resp.status_code == 200 and existing_resp.json():
            return Response(
                content='{"ok":true,"duplicate":true}',
                media_type="application/json",
            )

        # Record event intake
        await client.post(
            f"{settings.supabase_url}/rest/v1/integration_events",
            headers=_supabase_headers(),
            json={
                "provider": "slack",
                "external_event_id": event_id,
                "event_type": event.get("type", "message"),
                "processing_status": "received",
            },
            timeout=8.0,
        )

    # 6. Process message and completion claim
    user_id = event.get("user")
    channel_id = event.get("channel")
    text = event.get("text", "")
    message_ts = event.get("ts", "")
    thread_ts = event.get("thread_ts")

    if user_id and channel_id and text:
        await process_slack_message(
            workspace_id=None,
            slack_user_id=user_id,
            channel_id=channel_id,
            message_ts=message_ts,
            thread_ts=thread_ts,
            text=text,
        )

    return Response(content='{"ok":true}', media_type="application/json")


@router.post("/process-claim", response_model=ProcessClaimResponse)
async def process_claim_endpoint(req: ProcessClaimRequest) -> ProcessClaimResponse:
    """Diagnostic endpoint to process a completion claim or message directly."""
    ts = req.thread_ts or str(time.time())
    return await process_slack_message(
        workspace_id=req.workspace_id,
        slack_user_id=req.slack_user_id,
        channel_id=req.channel_id,
        message_ts=ts,
        thread_ts=req.thread_ts,
        text=req.text,
    )
