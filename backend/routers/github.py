"""TaskPilot Phase 3 GitHub Commit & PR Verification Router.

Verifies completion claims against actual GitHub activity from the correct
contributor and the authorized repository. GitHub is queried on-demand when
a completion claim arrives, never continuously polled.
"""

import logging
from datetime import UTC, datetime
from typing import Any

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/github", tags=["GitHub Verification"])

# In-memory cache for GitHub App installation access tokens
_installation_token_cache: dict[str, Any] = {}


# ==============================================================================
# Pydantic Schemas
# ==============================================================================


class EvidenceItem(BaseModel):
    type: str  # commit | pull_request | review | check_run
    sha: str | None = None
    url: str
    author: str | None = None
    author_verified: bool = False
    task_association: str = "explicit"  # explicit | branch_name | url | metadata
    relevance: str = "supporting"  # strong | supporting | insufficient

    model_config = ConfigDict(extra="ignore")


class VerifyClaimRequest(BaseModel):
    workspace_id: str | None = None
    task_id: str
    claim_id: str | None = None
    claimant_id: str | None = None
    slack_user_id: str | None = None
    repository_id: str | None = None
    claim_text: str = ""
    commit_sha: str | None = None
    pr_number: int | None = None

    model_config = ConfigDict(extra="ignore")


class VerifyClaimResponse(BaseModel):
    claim_id: str | None = None
    task_id: str
    # verified | partial_evidence | no_evidence | identity_mismatch |
    # repository_mismatch | needs_review | unavailable
    verification_status: str
    completion_approved: bool = False
    evidence: list[EvidenceItem] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    next_action: str = "human_review"  # complete_task | human_review | clarify | retry_later

    model_config = ConfigDict(extra="ignore")


class GitHubHealthResponse(BaseModel):
    status: str
    app_configured: bool
    token_configured: bool
    installation_found: bool
    accessible_repositories: list[str] = Field(default_factory=list)
    timestamp: str

    model_config = ConfigDict(extra="ignore")


# ==============================================================================
# GitHub Authentication Helpers
# ==============================================================================


def _generate_github_app_jwt(app_id: str, private_key_pem: str) -> str:
    """Generate RS256 JWT for GitHub App authentication."""
    clean_key = private_key_pem.replace("\\n", "\n")
    now = int(datetime.now(UTC).timestamp())
    payload = {
        "iat": now - 60,
        "exp": now + (9 * 60),  # Max 10 minutes allowed by GitHub
        "iss": app_id,
    }
    return jwt.encode(payload, clean_key, algorithm="RS256")


async def get_github_access_token(
    client: httpx.AsyncClient, installation_id: int | str | None = None
) -> tuple[str | None, str | None]:
    """Retrieve an authenticated token for GitHub REST API calls.

    Returns (token, token_type). If personal access token is configured, uses it.
    Otherwise, generates an installation token using GitHub App credentials.
    """
    settings = get_settings()

    # 1. Prefer personal access token if configured
    if settings.github_token:
        return settings.github_token, "pat"

    # 2. Use GitHub App credentials
    if settings.github_app_id and settings.github_app_private_key:
        now_ts = datetime.now(UTC).timestamp()

        # Check in-memory cache
        cache_key = str(installation_id or "default")
        cached = _installation_token_cache.get(cache_key)
        if cached and cached["expires_at"] > now_ts + 120:
            return cached["token"], "app_installation"

        app_jwt = _generate_github_app_jwt(settings.github_app_id, settings.github_app_private_key)
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TaskPilot-Backend/3.0.0",
        }

        # Resolve installation ID if not explicitly provided
        target_inst_id = installation_id
        if not target_inst_id:
            inst_resp = await client.get(
                "https://api.github.com/app/installations", headers=headers, timeout=10.0
            )
            if inst_resp.status_code == 200:
                installations = inst_resp.json()
                if installations:
                    target_inst_id = installations[0]["id"]
            if not target_inst_id:
                logger.warning("No GitHub App installations found")
                return None, None

        # Request installation access token
        token_url = f"https://api.github.com/app/installations/{target_inst_id}/access_tokens"
        tok_resp = await client.post(token_url, headers=headers, timeout=10.0)
        if tok_resp.status_code == 201:
            token_data = tok_resp.json()
            tok = token_data["token"]
            # Expiration usually in 1 hour; default 3500 seconds
            _installation_token_cache[cache_key] = {
                "token": tok,
                "expires_at": now_ts + 3500,
            }
            return tok, "app_installation"
        else:
            logger.error("Failed to acquire GitHub installation token: %s", tok_resp.text)
            return None, None

    return None, None


# ==============================================================================
# Supabase REST Helpers
# ==============================================================================


def _supabase_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


# ==============================================================================
# Core Verification Logic
# ==============================================================================


async def verify_task_completion_claim(
    task_id: str,
    claim_id: str | None = None,
    claimant_id: str | None = None,
    slack_user_id: str | None = None,
    repository_id: str | None = None,
    workspace_id: str | None = None,
    claim_text: str = "",
    commit_sha: str | None = None,
    pr_number: int | None = None,
) -> VerifyClaimResponse:
    """Execute real GitHub commit & PR verification against authorized project repository.

    Shared by both the HTTP router endpoint and the persistent Slack bot.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return VerifyClaimResponse(
            claim_id=claim_id,
            task_id=task_id,
            verification_status="unavailable",
            completion_approved=False,
            reasons=["Backend database service is not configured."],
            next_action="retry_later",
        )

    async with httpx.AsyncClient() as client:
        # 1. Fetch Task, Project, and Workspace
        task_resp = await client.get(
            f"{settings.supabase_url}/rest/v1/tasks?id=eq.{task_id}&select=*,projects(*)",
            headers=_supabase_headers(),
            timeout=10.0,
        )
        if task_resp.status_code != 200 or not task_resp.json():
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="no_evidence",
                completion_approved=False,
                reasons=[f"Task {task_id} not found in database."],
                next_action="clarify",
            )

        task_data = task_resp.json()[0]
        project = task_data.get("projects") or {}
        ws_id = workspace_id or task_data.get("workspace_id")
        project_id = task_data.get("project_id")
        task_number = task_data.get("task_number")
        project_identifier = project.get("identifier", "TASK")
        task_identifier = f"{project_identifier}-{task_number}"

        # 2. Fetch Authorized Repository for this Project / Workspace
        repo_resp = await client.get(
            f"{settings.supabase_url}/rest/v1/github_repositories?project_id=eq.{project_id}&is_enabled=eq.true&select=*",
            headers=_supabase_headers(),
            timeout=10.0,
        )
        repos = repo_resp.json() if repo_resp.status_code == 200 else []
        if not repos:
            # Fallback to workspace-level repos
            ws_repo_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/github_repositories?workspace_id=eq.{ws_id}&is_enabled=eq.true&select=*&limit=1",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            repos = ws_repo_resp.json() if ws_repo_resp.status_code == 200 else []

        if not repos:
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="repository_mismatch",
                completion_approved=False,
                reasons=[
                    f"No authorized GitHub repository linked to project "
                    f"{project.get('name', project_id)}."
                ],
                next_action="human_review",
            )

        authorized_repo = repos[0]
        # Validate requested repository_id if specified
        if repository_id and str(authorized_repo.get("id")) != repository_id:
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="repository_mismatch",
                completion_approved=False,
                reasons=["Supplied repository does not match authorized project repository."],
                next_action="human_review",
            )

        repo_full_name = authorized_repo.get("full_name")  # e.g. "1ndrajeet/kaunteya"
        if not repo_full_name:
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="repository_mismatch",
                completion_approved=False,
                reasons=["Authorized repository missing GitHub full_name."],
                next_action="human_review",
            )

        # 3. Resolve Claimant Identity
        resolved_claimant_id = claimant_id or task_data.get("assignee_id")
        claimant_login: str | None = None
        claimant_email: str | None = None
        claimant_name: str | None = None

        if slack_user_id and not resolved_claimant_id:
            slack_map_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/slack_user_mappings?workspace_id=eq.{ws_id}&slack_user_id=eq.{slack_user_id}&link_status=eq.linked&select=*",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            if slack_map_resp.status_code == 200 and slack_map_resp.json():
                resolved_claimant_id = slack_map_resp.json()[0].get("taskpilot_user_id")

        if resolved_claimant_id:
            # Query github_user_mappings
            gh_map_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/github_user_mappings?workspace_id=eq.{ws_id}&taskpilot_user_id=eq.{resolved_claimant_id}&link_status=eq.linked&select=*",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            if gh_map_resp.status_code == 200 and gh_map_resp.json():
                claimant_login = gh_map_resp.json()[0].get("github_login")

            # Fallback to profiles table
            prof_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles?id=eq.{resolved_claimant_id}&select=*",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            if prof_resp.status_code == 200 and prof_resp.json():
                prof = prof_resp.json()[0]
                claimant_login = claimant_login or prof.get("github_username")
                claimant_email = prof.get("email")
                claimant_name = prof.get("display_name")

        # 4. Authenticate with GitHub API
        installation_id = authorized_repo.get("installation_id")
        gh_token, _ = await get_github_access_token(client, installation_id)

        if not gh_token:
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="unavailable",
                completion_approved=False,
                reasons=[
                    "GitHub credentials or installation token unavailable. Claim remains pending."
                ],
                next_action="retry_later",
            )

        gh_headers = {
            "Authorization": f"Bearer {gh_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TaskPilot-Backend/3.0.0",
        }

        evidence_list: list[EvidenceItem] = []
        matching_commits: list[dict[str, Any]] = []
        matching_prs: list[dict[str, Any]] = []

        try:
            # Query recent commits on authorized repository
            commits_url = f"https://api.github.com/repos/{repo_full_name}/commits?per_page=30"
            commits_resp = await client.get(commits_url, headers=gh_headers, timeout=12.0)

            if commits_resp.status_code == 404:
                return VerifyClaimResponse(
                    claim_id=claim_id,
                    task_id=task_id,
                    verification_status="repository_mismatch",
                    completion_approved=False,
                    reasons=[
                        f"Repository {repo_full_name} not found or inaccessible by GitHub App."
                    ],
                    next_action="human_review",
                )
            elif commits_resp.status_code in (401, 403, 429, 500, 502, 503):
                return VerifyClaimResponse(
                    claim_id=claim_id,
                    task_id=task_id,
                    verification_status="unavailable",
                    completion_approved=False,
                    reasons=[
                        f"GitHub API temporarily unavailable (HTTP {commits_resp.status_code}). "
                        "Claim retained safely."
                    ],
                    next_action="retry_later",
                )

            if commits_resp.status_code == 200:
                raw_commits = commits_resp.json()
                for c in raw_commits:
                    msg = c.get("commit", {}).get("message", "")
                    sha = c.get("sha", "")
                    # Check task identifier (e.g. CORE-14) or explicit commit_sha
                    if task_identifier.lower() in msg.lower() or (
                        commit_sha and sha.startswith(commit_sha)
                    ):
                        matching_commits.append(c)

            # Query pull requests
            pulls_url = f"https://api.github.com/repos/{repo_full_name}/pulls?state=all&per_page=20"
            pulls_resp = await client.get(pulls_url, headers=gh_headers, timeout=12.0)
            if pulls_resp.status_code == 200:
                raw_pulls = pulls_resp.json()
                for pr in raw_pulls:
                    pr_title = pr.get("title", "")
                    pr_body = pr.get("body", "") or ""
                    pr_head = pr.get("head", {}).get("ref", "")
                    if (
                        task_identifier.lower() in pr_title.lower()
                        or task_identifier.lower() in pr_body.lower()
                        or task_identifier.lower() in pr_head.lower()
                        or (pr_number and pr.get("number") == pr_number)
                    ):
                        matching_prs.append(pr)

        except (httpx.TimeoutException, httpx.NetworkError) as err:
            logger.error("GitHub connection error during verification: %s", err)
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="unavailable",
                completion_approved=False,
                reasons=["GitHub API request timed out. Claim retained without penalty."],
                next_action="retry_later",
            )

        # 5. Evaluate Evidence & Identity
        if not matching_commits and not matching_prs:
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="no_evidence",
                completion_approved=False,
                reasons=[
                    f"No commits or pull requests found referencing {task_identifier} "
                    f"in {repo_full_name}."
                ],
                next_action="clarify",
            )

        # Evaluate PR Evidence
        pr_merged = False
        author_mismatch = False

        for pr in matching_prs:
            pr_author = pr.get("user", {}).get("login")
            is_author_match = bool(
                claimant_login
                and (
                    pr_author.lower() == claimant_login.lower()
                    or (claimant_name and claimant_name.lower() in pr_author.lower())
                )
            )
            if not is_author_match and claimant_login:
                author_mismatch = True

            is_merged = bool(pr.get("merged_at"))
            if is_merged:
                pr_merged = True

            evidence_list.append(
                EvidenceItem(
                    type="pull_request",
                    url=pr.get("html_url", ""),
                    author=pr_author,
                    author_verified=is_author_match,
                    task_association="explicit",
                    relevance="strong" if is_merged else "supporting",
                )
            )

        # Evaluate Commit Evidence
        for c in matching_commits:
            author_data = c.get("author") or {}
            commit_author_login = author_data.get("login")
            commit_meta_author = c.get("commit", {}).get("author", {})
            commit_author_name = commit_meta_author.get("name")
            commit_author_email = commit_meta_author.get("email")

            # Check claimant identity against commit author
            is_author_match = False
            if claimant_login and commit_author_login:
                is_author_match = commit_author_login.lower() == claimant_login.lower()
            if not is_author_match and claimant_email and commit_author_email:
                is_author_match = claimant_email.lower() == commit_author_email.lower()
            if not is_author_match and claimant_name and commit_author_name:
                is_author_match = claimant_name.lower() in commit_author_name.lower()

            if not is_author_match and claimant_login:
                author_mismatch = True

            evidence_list.append(
                EvidenceItem(
                    type="commit",
                    sha=c.get("sha"),
                    url=c.get("html_url", ""),
                    author=commit_author_login or commit_author_name,
                    author_verified=is_author_match,
                    task_association="explicit",
                    relevance="strong" if is_author_match else "supporting",
                )
            )

        # 6. Determine Final Verification Decision
        has_verified_author = any(e.author_verified for e in evidence_list)

        if author_mismatch and not has_verified_author:
            return VerifyClaimResponse(
                claim_id=claim_id,
                task_id=task_id,
                verification_status="identity_mismatch",
                completion_approved=False,
                evidence=evidence_list,
                reasons=[
                    f"Activity found for {task_identifier}, but author does not match "
                    f"mapped claimant ({claimant_login or 'unknown'})."
                ],
                next_action="human_review",
            )

        # Merged PR authored by claimant or strong verified commit with explicit completion
        if pr_merged and has_verified_author:
            decision_status = "verified"
            approved = True
            reasons = [
                f"Verified merged pull request in {repo_full_name} authored by "
                f"{claimant_login} with explicit {task_identifier} association."
            ]
            next_action = "complete_task"
        elif has_verified_author:
            # Commit exists by author, but PR unmerged or acceptance criteria need confirmation
            decision_status = "partial_evidence"
            approved = False
            reasons = [
                f"Relevant commits found by {claimant_login} referencing {task_identifier}. "
                "PR merge or final acceptance criteria pending human review."
            ]
            next_action = "human_review"
        else:
            decision_status = "needs_review"
            approved = False
            reasons = [
                f"Activity detected for {task_identifier}, but claimant attribution "
                "requires manual review."
            ]
            next_action = "human_review"

        # 7. Persist Evidence Artifacts & Update Claim in Supabase
        try:
            for item in evidence_list:
                ext_id = item.sha or item.url
                artifact_payload = {
                    "workspace_id": ws_id,
                    "repository_id": authorized_repo.get("id"),
                    "artifact_type": item.type,
                    "external_id": ext_id,
                    "source_url": item.url,
                    "author_login": item.author,
                    "commit_sha": item.sha,
                    "artifact_state": "merged" if item.relevance == "strong" else "open",
                    "is_merged": pr_merged,
                    "task_id": task_id,
                    "matched_task_identifier": task_identifier,
                    "match_method": "explicit_task_id",
                }
                art_resp = await client.post(
                    f"{settings.supabase_url}/rest/v1/evidence_artifacts",
                    headers={**_supabase_headers(), "Prefer": "return=representation"},
                    json=artifact_payload,
                    timeout=8.0,
                )
                if art_resp.status_code in (200, 201) and claim_id:
                    created_art = art_resp.json()
                    if created_art:
                        art_id = created_art[0]["id"]
                        # Link claim to artifact
                        await client.post(
                            f"{settings.supabase_url}/rest/v1/claim_evidence_associations",
                            headers=_supabase_headers(),
                            json={
                                "claim_id": claim_id,
                                "artifact_id": art_id,
                                "relevance_note": (
                                    f"Associated via TaskPilot GitHub verifier ({decision_status})"
                                ),
                                "associated_by": "system",
                            },
                            timeout=8.0,
                        )

            # Update work_claims review_state if claim_id exists
            if claim_id:
                state_map = {
                    "verified": "supported",
                    "partial_evidence": "partially_supported",
                    "no_evidence": "unverified",
                    "identity_mismatch": "disputed",
                    "needs_review": "partially_supported",
                    "unavailable": "pending",
                }
                await client.patch(
                    f"{settings.supabase_url}/rest/v1/work_claims?id=eq.{claim_id}",
                    headers=_supabase_headers(),
                    json={
                        "review_state": state_map.get(decision_status, "pending"),
                        "assessment_summary": {
                            "decision_status": decision_status,
                            "approved": approved,
                            "reasons": reasons,
                            "verified_at": datetime.now(UTC).isoformat(),
                        },
                    },
                    timeout=8.0,
                )

            # Audit record in activity_events
            await client.post(
                f"{settings.supabase_url}/rest/v1/activity_events",
                headers=_supabase_headers(),
                json={
                    "workspace_id": ws_id,
                    "actor_id": resolved_claimant_id,
                    "entity_type": "task",
                    "entity_id": task_id,
                    "event_type": f"github_verification_{decision_status}",
                    "metadata": {
                        "task_identifier": task_identifier,
                        "repository": repo_full_name,
                        "decision_status": decision_status,
                        "approved": approved,
                    },
                },
                timeout=8.0,
            )

        except Exception as err:
            logger.warning("Error persisting evidence to Supabase: %s", err)

        return VerifyClaimResponse(
            claim_id=claim_id,
            task_id=task_id,
            verification_status=decision_status,
            completion_approved=approved,
            evidence=evidence_list,
            reasons=reasons,
            next_action=next_action,
        )


# ==============================================================================
# Router Endpoints
# ==============================================================================


@router.get("/health", response_model=GitHubHealthResponse)
async def github_health() -> GitHubHealthResponse:
    """Diagnostic health endpoint reporting GitHub App & token readiness."""
    settings = get_settings()
    app_configured = bool(settings.github_app_id and settings.github_app_private_key)
    token_configured = bool(settings.github_token)

    accessible_repos: list[str] = []
    installation_found = False

    async with httpx.AsyncClient() as client:
        token, _ = await get_github_access_token(client)
        if token:
            installation_found = True
            try:
                repo_resp = await client.get(
                    "https://api.github.com/installation/repositories",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "TaskPilot-Backend/3.0.0",
                    },
                    timeout=8.0,
                )
                if repo_resp.status_code == 200:
                    for r in repo_resp.json().get("repositories", []):
                        accessible_repos.append(r.get("full_name", ""))
            except Exception as e:
                logger.warning("Failed to query accessible repos: %s", e)

    return GitHubHealthResponse(
        status="ok" if (app_configured or token_configured) else "misconfigured",
        app_configured=app_configured,
        token_configured=token_configured,
        installation_found=installation_found,
        accessible_repositories=accessible_repos,
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.post("/verify-claim", response_model=VerifyClaimResponse)
async def verify_claim_endpoint(req: VerifyClaimRequest) -> VerifyClaimResponse:
    """Internal API endpoint to verify a recorded task completion claim against GitHub."""
    return await verify_task_completion_claim(
        task_id=req.task_id,
        claim_id=req.claim_id,
        claimant_id=req.claimant_id,
        slack_user_id=req.slack_user_id,
        repository_id=req.repository_id,
        workspace_id=req.workspace_id,
        claim_text=req.claim_text,
        commit_sha=req.commit_sha,
        pr_number=req.pr_number,
    )


@router.get("/repository-evidence/{task_id}")
async def get_repository_evidence(
    task_id: str,
    workspace_id: str | None = Query(None, description="Workspace ID for scoping"),
) -> dict[str, Any]:
    """Retrieve all evidence artifacts associated with a task."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        query = (
            f"{settings.supabase_url}/rest/v1/evidence_artifacts?"
            f"task_id=eq.{task_id}&select=*,github_repositories(name,full_name)"
        )
        if workspace_id:
            query += f"&workspace_id=eq.{workspace_id}"

        resp = await client.get(query, headers=_supabase_headers(), timeout=10.0)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve evidence artifacts",
            )
        return {"task_id": task_id, "evidence_artifacts": resp.json()}
