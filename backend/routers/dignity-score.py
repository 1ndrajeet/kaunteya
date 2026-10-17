"""TaskPilot Phase 3 Dignity Score Router.

Implements a deterministic, explainable contribution-reliability calculation API
evaluating recorded claims, verified evidence, milestones, and attribution shares.
Separates accepted contribution points from claim reliability.
"""

import logging
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dignity-score", tags=["Dignity Score"])

FORMULA_VERSION = "v1"


# ==============================================================================
# Pydantic Schemas
# ==============================================================================


class MilestoneInput(BaseModel):
    name: str
    weight: float = Field(gt=0.0, description="Normalized or relative milestone weight")
    accepted_fraction: float = Field(
        ge=0.0, le=1.0, default=0.0, description="Accepted completion fraction (0.0 to 1.0)"
    )
    attribution_share: float = Field(
        ge=0.0, le=1.0, default=1.0, description="Contributor attribution share (0.0 to 1.0)"
    )
    quality_multiplier: float = Field(
        ge=0.0, le=1.10, default=1.00, description="Quality adjustment multiplier"
    )

    model_config = ConfigDict(extra="ignore")


class TaskDimensions(BaseModel):
    impact: float = Field(ge=1.0, le=5.0, default=2.5)
    complexity: float = Field(ge=1.0, le=5.0, default=2.5)
    risk: float = Field(ge=1.0, le=5.0, default=2.0)
    uncertainty: float = Field(ge=1.0, le=5.0, default=2.0)

    model_config = ConfigDict(extra="ignore")


class CalculateScoreRequest(BaseModel):
    member_id: str | None = None
    workspace_id: str | None = None
    task_id: str | None = None

    # Optional manual/override simulation fields:
    task_value: float | None = Field(None, ge=10.0, le=50.0)
    dimensions: TaskDimensions | None = None
    milestones: list[MilestoneInput] = Field(default_factory=list)
    quality_multiplier: float = Field(ge=0.0, le=1.10, default=1.00)

    model_config = ConfigDict(extra="ignore")


class ClaimReliabilitySummary(BaseModel):
    status: str  # insufficient_data | evaluated
    score: float | None = None  # Percentage 0.0 to 100.0
    reviewed_claims: int = 0
    verified_count: int = 0
    partially_verified_count: int = 0
    disputed_count: int = 0
    pending_count: int = 0

    model_config = ConfigDict(extra="ignore")


class CalculateScoreResponse(BaseModel):
    member_id: str | None = None
    workspace_id: str | None = None
    task_id: str | None = None
    accepted_contribution_points: float
    eligible_task_value: float
    accepted_progress: float
    claim_reliability: ClaimReliabilitySummary
    blocked_tasks: int = 0
    pending_claims: int = 0
    disputed_claims: int = 0
    formula_version: str = FORMULA_VERSION
    explanation: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class DignityScoreHealthResponse(BaseModel):
    status: str
    formula_version: str
    scoring_dimensions: list[str]
    quality_multipliers: dict[str, str]
    timestamp: str

    model_config = ConfigDict(extra="ignore")


# ==============================================================================
# Supabase HTTP Helper
# ==============================================================================


def _supabase_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


# ==============================================================================
# Core Deterministic Scoring Functions
# ==============================================================================


def calculate_task_value(
    dimensions: TaskDimensions | None = None,
    priority: str = "Medium",
    explicit_value: float | None = None,
) -> tuple[float, str]:
    """Calculate task value V_t = 10 * (0.40*I + 0.30*C + 0.20*R + 0.10*U).

    Yields a value between 10.0 and 50.0.
    """
    if explicit_value is not None:
        clamped = max(10.0, min(50.0, float(explicit_value)))
        return round(clamped, 2), "explicit_override"

    if dimensions:
        val = 10.0 * (
            0.40 * dimensions.impact
            + 0.30 * dimensions.complexity
            + 0.20 * dimensions.risk
            + 0.10 * dimensions.uncertainty
        )
        return round(max(10.0, min(50.0, val)), 2), "explicit_dimensions"

    # Documented fallback mapping from priority
    priority_map = {
        "Urgent": 10.0 * (0.40 * 4.5 + 0.30 * 4.5 + 0.20 * 4.5 + 0.10 * 3.5),  # 44.0
        "High": 10.0 * (0.40 * 3.5 + 0.30 * 3.5 + 0.20 * 3.5 + 0.10 * 3.0),  # 34.5
        "Medium": 10.0 * (0.40 * 2.5 + 0.30 * 2.5 + 0.20 * 2.0 + 0.10 * 2.0),  # 23.5
        "Low": 10.0 * (0.40 * 1.5 + 0.30 * 1.5 + 0.20 * 1.0 + 0.10 * 1.0),  # 13.5
    }
    val = priority_map.get(priority, 23.5)
    return round(val, 2), f"priority_fallback_{priority.lower()}"


def calculate_milestone_progress_and_attribution(
    task_value: float,
    milestones: list[MilestoneInput],
    default_quality_multiplier: float = 1.00,
) -> tuple[float, float, list[str]]:
    """Compute normalized milestone progress P_t and accepted contribution E_{i,t}.

    P_t = sum(w_m * a_m) / sum(w_m)
    E_{i,t} = V_t * sum(w_m_norm * a_m * s_m * q_m)
    """
    if not milestones:
        return 0.0, 0.0, ["No milestones defined for this task."]

    total_weight = sum(m.weight for m in milestones)
    if total_weight <= 0.0:
        return 0.0, 0.0, ["Total milestone weight must be greater than zero."]

    progress_accum = 0.0
    attribution_accum = 0.0
    explanations: list[str] = []

    for m in milestones:
        norm_weight = m.weight / total_weight
        progress_accum += norm_weight * m.accepted_fraction
        # Individual attribution share and quality
        q = m.quality_multiplier if m.quality_multiplier != 1.0 else default_quality_multiplier
        contrib_part = norm_weight * m.accepted_fraction * m.attribution_share * q
        attribution_accum += contrib_part
        if m.accepted_fraction > 0.0:
            explanations.append(
                f"Milestone '{m.name}': weight={round(norm_weight * 100, 1)}%, "
                f"accepted={round(m.accepted_fraction * 100, 1)}%, "
                f"attribution_share={round(m.attribution_share * 100, 1)}%, quality={q}."
            )

    progress = round(progress_accum, 4)
    accepted_points = round(task_value * attribution_accum, 2)
    return progress, accepted_points, explanations


def evaluate_claim_reliability(
    claims: list[dict[str, Any]],
) -> ClaimReliabilitySummary:
    """Evaluate claim reliability distinctly from accepted contribution.

    Requires at least 3 reviewed claims to compute a numeric reliability percentage.
    """
    verified = 0
    partially_verified = 0
    disputed = 0
    pending = 0

    for c in claims:
        st = c.get("review_state", "pending")
        if st in ("supported", "verified"):
            verified += 1
        elif st in ("partially_supported", "partially_verified"):
            partially_verified += 1
        elif st in ("disputed", "human_confirmed_inaccurate"):
            disputed += 1
        elif st in ("pending", "unverified", "needs_clarification"):
            pending += 1

    reviewed_total = verified + partially_verified + disputed

    # If insufficient reviewed claims, return transparent insufficient_data
    if reviewed_total < 3:
        return ClaimReliabilitySummary(
            status="insufficient_data",
            score=None,
            reviewed_claims=reviewed_total,
            verified_count=verified,
            partially_verified_count=partially_verified,
            disputed_count=disputed,
            pending_count=pending,
        )

    # Numerator: verified + 0.5 * partially_verified; Denominator: reviewed_total
    num = float(verified) + (0.5 * float(partially_verified))
    reliability_pct = round((num / float(reviewed_total)) * 100.0, 1)

    return ClaimReliabilitySummary(
        status="evaluated",
        score=reliability_pct,
        reviewed_claims=reviewed_total,
        verified_count=verified,
        partially_verified_count=partially_verified,
        disputed_count=disputed,
        pending_count=pending,
    )


# ==============================================================================
# Router Endpoints
# ==============================================================================


@router.get("/health", response_model=DignityScoreHealthResponse)
async def dignity_score_health() -> DignityScoreHealthResponse:
    """Health check describing the formula version and scoring parameters."""
    return DignityScoreHealthResponse(
        status="ok",
        formula_version=FORMULA_VERSION,
        scoring_dimensions=[
            "Impact (40% weight)",
            "Complexity (30% weight)",
            "Risk (20% weight)",
            "Uncertainty (10% weight)",
        ],
        quality_multipliers={
            "accepted": "1.00",
            "exceptional_quality": "1.05 - 1.10",
            "minor_rework": "0.90 - 0.99",
            "material_rework": "0.70 - 0.89",
            "rejected": "0.00",
        },
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.post("/calculate", response_model=CalculateScoreResponse)
async def calculate_score(req: CalculateScoreRequest) -> CalculateScoreResponse:
    """Calculate deterministic contribution score for a contributor, task, or simulation."""
    # 1. If explicit milestones or task_value provided in payload, compute directly
    if req.milestones or req.task_value is not None or req.dimensions is not None:
        task_val, source = calculate_task_value(
            dimensions=req.dimensions,
            explicit_value=req.task_value,
        )
        if req.milestones:
            prog, contrib_pts, milestone_expl = calculate_milestone_progress_and_attribution(
                task_value=task_val,
                milestones=req.milestones,
                default_quality_multiplier=req.quality_multiplier,
            )
        else:
            # Atomic deliverable with no milestones: progress=1.0 if accepted
            prog = 1.0
            contrib_pts = round(task_val * req.quality_multiplier, 2)
            milestone_expl = [
                "Single atomic deliverable accepted with quality multiplier "
                f"{req.quality_multiplier}."
            ]

        expl = [
            f"Calculated task value V_t = {task_val} (source: {source}).",
            *milestone_expl,
            f"Accepted contribution points: {contrib_pts} (progress: {round(prog * 100, 1)}%).",
            "Reliability score is not evaluated for single simulation payloads.",
        ]

        return CalculateScoreResponse(
            member_id=req.member_id,
            workspace_id=req.workspace_id,
            task_id=req.task_id,
            accepted_contribution_points=contrib_pts,
            eligible_task_value=task_val,
            accepted_progress=prog,
            claim_reliability=ClaimReliabilitySummary(
                status="insufficient_data",
                score=None,
                reviewed_claims=0,
            ),
            blocked_tasks=0,
            pending_claims=0,
            disputed_claims=0,
            formula_version=FORMULA_VERSION,
            explanation=expl,
        )

    # 2. Query Database for Task or Member Records
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not configured.",
        )

    async with httpx.AsyncClient() as client:
        # A. Task-scoped calculation
        if req.task_id:
            task_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/tasks?id=eq.{req.task_id}&select=*,projects(*)",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            if task_resp.status_code != 200 or not task_resp.json():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Task {req.task_id} not found.",
                )

            task = task_resp.json()[0]
            priority = task.get("priority", "Medium")
            task_val, source = calculate_task_value(priority=priority)

            # Query claims on this task
            claims_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/work_claims?task_id=eq.{req.task_id}&select=*",
                headers=_supabase_headers(),
                timeout=10.0,
            )
            claims = claims_resp.json() if claims_resp.status_code == 200 else []

            # Determine task completion fraction from verified state
            task_status = task.get("status", "Todo")
            if task_status == "Done":
                progress = 1.0
                accepted_pts = task_val
            elif task_status in ("In Review", "In Progress") and any(
                c.get("review_state") in ("supported", "partially_supported") for c in claims
            ):
                progress = 0.5
                accepted_pts = round(task_val * 0.5, 2)
            else:
                progress = 0.0
                accepted_pts = 0.0

            rel_summary = evaluate_claim_reliability(claims)
            is_blocked = 1 if task_status == "Blocked" else 0

            return CalculateScoreResponse(
                member_id=req.member_id or task.get("assignee_id"),
                workspace_id=req.workspace_id or task.get("workspace_id"),
                task_id=req.task_id,
                accepted_contribution_points=accepted_pts,
                eligible_task_value=task_val,
                accepted_progress=progress,
                claim_reliability=rel_summary,
                blocked_tasks=is_blocked,
                pending_claims=rel_summary.pending_count,
                disputed_claims=rel_summary.disputed_count,
                formula_version=FORMULA_VERSION,
                explanation=[
                    f"Task {task.get('title')} (status: {task_status}).",
                    f"Task value: {task_val} points (derived from priority {priority}).",
                    f"Progress: {round(progress * 100, 1)}%, "
                    f"Accepted contribution: {accepted_pts} points.",
                ],
            )

        # B. Member-scoped calculation across workspace
        if req.member_id:
            # Query tasks assigned to member
            t_query = (
                f"{settings.supabase_url}/rest/v1/tasks?"
                f"assignee_id=eq.{req.member_id}&select=*,projects(*)"
            )
            if req.workspace_id:
                t_query += f"&workspace_id=eq.{req.workspace_id}"

            tasks_resp = await client.get(t_query, headers=_supabase_headers(), timeout=10.0)
            tasks = tasks_resp.json() if tasks_resp.status_code == 200 else []

            # Query claims submitted by member
            c_query = (
                f"{settings.supabase_url}/rest/v1/work_claims?"
                f"claimant_id=eq.{req.member_id}&select=*"
            )
            if req.workspace_id:
                c_query += f"&workspace_id=eq.{req.workspace_id}"

            claims_resp = await client.get(c_query, headers=_supabase_headers(), timeout=10.0)
            claims = claims_resp.json() if claims_resp.status_code == 200 else []

            total_task_value = 0.0
            total_accepted_points = 0.0
            blocked_count = 0

            for t in tasks:
                t_val, _ = calculate_task_value(priority=t.get("priority", "Medium"))
                total_task_value += t_val
                st = t.get("status", "Todo")
                if st == "Blocked":
                    blocked_count += 1
                elif st == "Done":
                    total_accepted_points += t_val
                elif st in ("In Review", "In Progress"):
                    # Give partial credit if verified claims exist on this task
                    has_verified_claim = any(
                        c.get("task_id") == t.get("id")
                        and c.get("review_state") in ("supported", "partially_supported")
                        for c in claims
                    )
                    if has_verified_claim:
                        total_accepted_points += round(t_val * 0.4, 2)

            agg_progress = (
                round(total_accepted_points / total_task_value, 4)
                if total_task_value > 0.0
                else 0.0
            )
            rel_summary = evaluate_claim_reliability(claims)

            return CalculateScoreResponse(
                member_id=req.member_id,
                workspace_id=req.workspace_id,
                task_id=None,
                accepted_contribution_points=round(total_accepted_points, 2),
                eligible_task_value=round(total_task_value, 2),
                accepted_progress=agg_progress,
                claim_reliability=rel_summary,
                blocked_tasks=blocked_count,
                pending_claims=rel_summary.pending_count,
                disputed_claims=rel_summary.disputed_count,
                formula_version=FORMULA_VERSION,
                explanation=[
                    f"Evaluated {len(tasks)} assigned tasks and {len(claims)} submitted claims.",
                    f"Total eligible task scope: {round(total_task_value, 2)} points.",
                    f"Total accepted contribution: {round(total_accepted_points, 2)} points "
                    f"({round(agg_progress * 100, 1)}% aggregate progress).",
                ],
            )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Must provide task_id, member_id, or explicit milestone payload.",
    )


@router.get("/member/{member_id}", response_model=CalculateScoreResponse)
async def get_member_score(
    member_id: str,
    workspace_id: str | None = Query(None, description="Workspace ID for scoping"),
) -> CalculateScoreResponse:
    """Retrieve contribution & claim reliability score for a workspace member."""
    return await calculate_score(
        CalculateScoreRequest(member_id=member_id, workspace_id=workspace_id)
    )


@router.get("/task/{task_id}", response_model=CalculateScoreResponse)
async def get_task_score(
    task_id: str,
    workspace_id: str | None = Query(None, description="Workspace ID for scoping"),
) -> CalculateScoreResponse:
    """Retrieve accepted progress, task value, and score for a specific task."""
    return await calculate_score(CalculateScoreRequest(task_id=task_id, workspace_id=workspace_id))
