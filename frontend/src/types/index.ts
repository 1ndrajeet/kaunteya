export interface HealthResponse {
  status: "ok" | "degraded" | "error" | string;
  app: string;
  environment: string;
  timestamp: string;
  version?: string;
}

export interface RootResponse {
  message: string;
  docs_url: string;
  health_url: string;
}

export interface ApiErrorPayload {
  message: string;
  status: number;
  details?: unknown;
}

// ==============================================================================
// Slack Integration Contracts (Module 1)
// ==============================================================================

export interface SlackBotIdentity {
  bot_id?: string;
  user?: string;
  team?: string;
  team_id?: string;
}

export interface SlackHealthResponse {
  status: "ok" | "misconfigured" | "error" | string;
  bot_token_configured: boolean;
  signing_secret_configured: boolean;
  app_token_configured: boolean;
  bot_identity?: SlackBotIdentity | null;
  timestamp: string;
}

export interface SlackStatusResponse {
  status: string;
  runtime: string;
  bot_identity?: SlackBotIdentity | null;
  features: {
    conversational_claim_detection: boolean;
    github_verification_loop: boolean;
    idempotent_event_deduplication: boolean;
    replay_attack_protection: boolean;
  };
}

export interface ProcessClaimResponse {
  ok: boolean;
  intent: string;
  task_identifier?: string | null;
  task_id?: string | null;
  claim_id?: string | null;
  verification_status?: string | null;
  new_task_status?: string | null;
  reply_message: string;
}

// ==============================================================================
// GitHub Verification Contracts (Module 2)
// ==============================================================================

export interface EvidenceItem {
  type: "commit" | "pull_request" | "check_run" | "review" | string;
  sha?: string | null;
  url: string;
  author?: string | null;
  author_verified: boolean;
  task_association: string;
  relevance: "strong" | "supporting" | "insufficient" | string;
}

export type VerificationStatusType =
  | "verified"
  | "partial_evidence"
  | "no_evidence"
  | "identity_mismatch"
  | "repository_mismatch"
  | "needs_review"
  | "unavailable";

export interface VerifyClaimResponse {
  claim_id?: string | null;
  task_id: string;
  verification_status: VerificationStatusType | string;
  completion_approved: boolean;
  evidence: EvidenceItem[];
  reasons: string[];
  next_action: "complete_task" | "human_review" | "clarify" | "retry_later" | string;
}

export interface GitHubHealthResponse {
  status: "ok" | "misconfigured" | string;
  app_configured: boolean;
  token_configured: boolean;
  installation_found: boolean;
  accessible_repositories: string[];
  timestamp: string;
}

// ==============================================================================
// Dignity Score Contracts (Module 3)
// ==============================================================================

export interface ClaimReliabilitySummary {
  status: "insufficient_data" | "evaluated" | string;
  score: number | null;
  reviewed_claims: number;
  verified_count: number;
  partially_verified_count: number;
  disputed_count: number;
  pending_count: number;
}

export interface CalculateScoreResponse {
  member_id?: string | null;
  workspace_id?: string | null;
  task_id?: string | null;
  accepted_contribution_points: number;
  eligible_task_value: number;
  accepted_progress: number;
  claim_reliability: ClaimReliabilitySummary;
  blocked_tasks: number;
  pending_claims: number;
  disputed_claims: number;
  formula_version: string;
  explanation: string[];
}

export interface DignityScoreHealthResponse {
  status: string;
  formula_version: string;
  scoring_dimensions: string[];
  quality_multipliers: Record<string, string>;
  timestamp: string;
}
