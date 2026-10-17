-- ==============================================================================
-- TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform
-- FINAL CONSOLIDATED SCHEMA (one-shot creation, no alterations)
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. PROFILES TABLE (Mirrored from auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    github_username TEXT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. WORKSPACES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. WORKSPACE MEMBERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'lead', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

-- ==============================================================================
-- 5. WORKSPACE INVITATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    max_uses INT NOT NULL DEFAULT 1,
    uses_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. PROJECTS TABLE (final form: includes lifecycle states + completed_at)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('planning', 'active', 'at_risk', 'completed', 'paused', 'archived')),
    lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE,
    target_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_project_identifier UNIQUE (workspace_id, identifier)
);

-- ==============================================================================
-- 7. PROJECT MEMBERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

-- ==============================================================================
-- 8. TEAMS TABLE (Project-Scoped Teams)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_team_slug UNIQUE (project_id, slug),
    CONSTRAINT uq_project_team_name UNIQUE (project_id, name)
);

-- ==============================================================================
-- 9. TEAM MEMBERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

-- ==============================================================================
-- 10. PROJECT REPOSITORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    repository_url TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_repository UNIQUE (project_id, repository_url)
);

-- ==============================================================================
-- 11. TASKS TABLE (final form: includes team assignment + status reason tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Todo'
        CHECK (status IN ('Backlog', 'Todo', 'In Progress', 'In Review', 'Blocked', 'Done', 'Cancelled')),
    priority TEXT NOT NULL DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assignment_type TEXT NOT NULL DEFAULT 'individual'
        CHECK (assignment_type IN ('individual', 'team')),
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    status_reason TEXT,
    status_changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status_changed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    due_date DATE,
    source TEXT NOT NULL DEFAULT 'manual',
    slack_channel_id TEXT,
    slack_message_ts TEXT,
    slack_thread_ts TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_task_number UNIQUE (project_id, task_number)
);

-- ==============================================================================
-- 12. TASK COMMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 13. ACTIVITY EVENTS TABLE (Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- PHASE 2: SLACK INTEGRATION TABLES
-- ==============================================================================

-- 14. SLACK INSTALLATIONS
CREATE TABLE IF NOT EXISTS public.slack_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slack_team_id TEXT NOT NULL,
    slack_team_name TEXT NOT NULL,
    bot_user_id TEXT NOT NULL,
    default_channel_id TEXT,
    notification_channel_id TEXT,
    installation_status TEXT NOT NULL DEFAULT 'active'
        CHECK (installation_status IN ('active', 'disconnected', 'error')),
    followup_frequency_hours INT NOT NULL DEFAULT 24,
    auto_followup_enabled BOOLEAN NOT NULL DEFAULT true,
    connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_slack_team UNIQUE (workspace_id, slack_team_id)
);

-- 15. SLACK INSTALLATION SECRETS (Locked to service-role / backend only)
CREATE TABLE IF NOT EXISTS public.slack_installation_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE UNIQUE,
    bot_token TEXT NOT NULL,
    signing_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 16. SLACK USER MAPPINGS
CREATE TABLE IF NOT EXISTS public.slack_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    slack_username TEXT,
    slack_real_name TEXT,
    slack_email TEXT,
    taskpilot_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    link_status TEXT NOT NULL DEFAULT 'linked'
        CHECK (link_status IN ('linked', 'pending', 'unlinked')),
    linked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_slack_user UNIQUE (workspace_id, slack_user_id)
);

-- 17. SLACK CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.slack_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slack_conversation_id TEXT NOT NULL,
    conversation_name TEXT,
    conversation_type TEXT NOT NULL DEFAULT 'public_channel'
        CHECK (conversation_type IN ('public_channel', 'private_channel', 'im', 'mpim')),
    purpose TEXT NOT NULL DEFAULT 'intake'
        CHECK (purpose IN ('intake', 'notifications', 'general')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_slack_conv UNIQUE (installation_id, slack_conversation_id)
);

-- 18. INTEGRATION EVENTS (Idempotency & external event ingestion audit)
CREATE TABLE IF NOT EXISTS public.integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'slack',
    installation_id UUID REFERENCES public.slack_installations(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    external_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'received'
        CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
    error_code TEXT,
    error_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_external_event UNIQUE (provider, external_event_id)
);

-- 19. TASK FOLLOW-UPS
CREATE TABLE IF NOT EXISTS public.task_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    channel_type TEXT NOT NULL DEFAULT 'im'
        CHECK (channel_type IN ('im', 'channel', 'thread')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'responded', 'cancelled', 'failed')),
    attempt_count INT NOT NULL DEFAULT 0,
    external_message_id TEXT,
    external_conversation_id TEXT,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 20. EXTERNAL MESSAGES (Thread & message context correlation)
CREATE TABLE IF NOT EXISTS public.external_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    external_conversation_id TEXT NOT NULL,
    external_message_id TEXT NOT NULL,
    external_thread_id TEXT,
    sender_mapping_id UUID REFERENCES public.slack_user_mappings(id) ON DELETE SET NULL,
    message_type TEXT NOT NULL DEFAULT 'task_intake'
        CHECK (message_type IN ('task_intake', 'followup_sent', 'followup_reply', 'notification', 'clarification')),
    body_snippet TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_ext_msg UNIQUE (installation_id, external_conversation_id, external_message_id)
);

-- ==============================================================================
-- PHASE 3: GITHUB INTEGRATION, EVIDENCE, CLAIMS, ROUTING TABLES
-- ==============================================================================

-- 21. GITHUB INSTALLATIONS
CREATE TABLE IF NOT EXISTS public.github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    github_installation_id BIGINT NOT NULL,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'User' CHECK (account_type IN ('User', 'Organization')),
    account_avatar_url TEXT,
    connection_status TEXT NOT NULL DEFAULT 'active'
        CHECK (connection_status IN ('active', 'suspended', 'disconnected', 'error')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    installed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 22. GITHUB INSTALLATION SECRETS (Locked to service-role / backend only)
CREATE TABLE IF NOT EXISTS public.github_installation_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.github_installations(id) ON DELETE CASCADE UNIQUE,
    app_id TEXT,
    private_key TEXT,
    webhook_secret TEXT,
    personal_access_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 23. GITHUB REPOSITORIES (final form: includes single-repo-per-project invariant via partial unique index below)
CREATE TABLE IF NOT EXISTS public.github_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    installation_id UUID REFERENCES public.github_installations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    github_repo_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT false,
    default_branch TEXT NOT NULL DEFAULT 'main',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'idle'
        CHECK (sync_status IN ('idle', 'syncing', 'synced', 'error')),
    sync_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_github_repo UNIQUE (workspace_id, github_repo_id)
);

-- 24. GITHUB USER MAPPINGS
CREATE TABLE IF NOT EXISTS public.github_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    taskpilot_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    github_user_id BIGINT NOT NULL,
    github_login TEXT NOT NULL,
    link_status TEXT NOT NULL DEFAULT 'linked'
        CHECK (link_status IN ('linked', 'pending', 'unlinked')),
    linked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_gh_user UNIQUE (workspace_id, github_user_id),
    CONSTRAINT uq_workspace_tp_gh UNIQUE (workspace_id, taskpilot_user_id)
);

-- 25. GITHUB EVENTS JOURNAL
CREATE TABLE IF NOT EXISTS public.github_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    installation_id BIGINT,
    repository_id BIGINT,
    processing_status TEXT NOT NULL DEFAULT 'received'
        CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
    error_code TEXT,
    error_summary TEXT,
    payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ
);

-- 26. EVIDENCE ARTIFACTS
CREATE TABLE IF NOT EXISTS public.evidence_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES public.github_repositories(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL
        CHECK (artifact_type IN ('pull_request', 'commit', 'review', 'check_run')),
    external_id TEXT NOT NULL,
    title TEXT,
    source_url TEXT NOT NULL,
    author_login TEXT,
    author_github_id BIGINT,
    commit_sha TEXT,
    head_branch TEXT,
    base_branch TEXT,
    artifact_state TEXT NOT NULL DEFAULT 'open',
    is_merged BOOLEAN NOT NULL DEFAULT false,
    merged_at TIMESTAMPTZ,
    check_conclusion TEXT,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    matched_task_identifier TEXT,
    match_method TEXT NOT NULL DEFAULT 'explicit_task_id'
        CHECK (match_method IN ('explicit_task_id', 'branch_name', 'claim_url', 'ai_match', 'manual')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_external TIMESTAMPTZ,
    updated_at_external TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_repo_artifact UNIQUE (repository_id, artifact_type, external_id)
);

-- 27. WORK CLAIMS
CREATE TABLE IF NOT EXISTS public.work_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claim_source TEXT NOT NULL DEFAULT 'dashboard'
        CHECK (claim_source IN ('dashboard', 'slack_followup', 'slack_command')),
    claim_text TEXT NOT NULL,
    claim_type TEXT NOT NULL DEFAULT 'implementation'
        CHECK (claim_type IN ('implementation', 'bug_fix', 'code_review', 'test_coverage', 'documentation', 'progress_update', 'completion')),
    pr_url_hint TEXT,
    review_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_state IN ('pending', 'supported', 'partially_supported', 'unverified', 'needs_clarification', 'disputed')),
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_rationale TEXT,
    assessment_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_claim_no_self_approval CHECK (reviewer_id IS NULL OR reviewer_id != claimant_id)
);

-- 28. CLAIM EVIDENCE ASSOCIATIONS
CREATE TABLE IF NOT EXISTS public.claim_evidence_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.work_claims(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL REFERENCES public.evidence_artifacts(id) ON DELETE CASCADE,
    relevance_note TEXT,
    associated_by TEXT NOT NULL DEFAULT 'system'
        CHECK (associated_by IN ('system', 'ai_matcher', 'reviewer', 'claimant')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_claim_artifact UNIQUE (claim_id, artifact_id)
);

-- 29. ROUTING DECISIONS
CREATE TABLE IF NOT EXISTS public.routing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    request_source TEXT NOT NULL DEFAULT 'slack'
        CHECK (request_source IN ('slack', 'web_ui', 'api')),
    decision_version TEXT NOT NULL DEFAULT 'v3.0',
    proposed_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    proposed_assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    selected_outcome TEXT NOT NULL
        CHECK (selected_outcome IN ('assigned', 'lead_triage', 'clarification_requested', 'rejected', 'overridden')),
    decision_method TEXT NOT NULL DEFAULT 'deterministic'
        CHECK (decision_method IN ('deterministic', 'agent_proposal', 'human_override')),
    rule_code TEXT,
    rationale TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
    human_intervention_needed BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- BILLING & PLANS FOUNDATION TABLES
-- ==============================================================================

-- 30. PLANS
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_interval TEXT NOT NULL
        CHECK (billing_interval IN ('free', 'monthly', 'yearly', 'lifetime')),
    max_workspaces INT NOT NULL DEFAULT 1,
    max_projects_per_workspace INT NOT NULL DEFAULT 5,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 31. WORKSPACE SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    payment_provider TEXT DEFAULT 'manual',
    external_customer_id TEXT,
    external_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 32. PROMO CODES
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_percent INT CHECK (discount_percent BETWEEN 1 AND 100),
    discount_amount_cents INT CHECK (discount_amount_cents > 0),
    max_uses INT NOT NULL DEFAULT 100,
    uses_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 33. PROMO REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_promo UNIQUE (promo_code_id, user_id)
);

-- ==============================================================================
-- SEED DATA
-- ==============================================================================

INSERT INTO public.plans (id, name, description, price_cents, currency, billing_interval, max_workspaces, max_projects_per_workspace, features)
VALUES
    ('free', 'Starter Free', 'Essential tooling for individual builders and hackathon teams.',
     0, 'USD', 'free', 1, 5,
     '["1 Workspace", "Up to 5 Projects", "Project-Scoped Teams", "Slack & GitHub Integration", "Basic Evidence Intelligence"]'::jsonb),
    ('yearly', 'Pro Yearly', 'Comprehensive delivery coordination for scaling organizations.',
     19900, 'USD', 'yearly', 10, 50,
     '["Up to 10 Workspaces", "Up to 50 Projects per Workspace", "Priority GitHub Webhooks", "Advanced Gemini Insights", "Audit Log Retention", "Team Workload Analytics"]'::jsonb),
    ('onetime', 'Founder Lifetime', 'Single investment for permanent autonomous project coordination.',
     49900, 'USD', 'lifetime', 999, 999,
     '["Unlimited Workspaces", "Unlimited Projects", "Dedicated Support", "Full Gemini Intelligence Access", "All Future Pro Features"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.promo_codes (code, description, discount_percent, max_uses)
VALUES
    ('LAUNCH50', 'Early Adopter 50% discount on yearly plan', 50, 500),
    ('FOUNDER100', 'Special founder grant invitation code', 100, 50)
ON CONFLICT (code) DO NOTHING;

-- ==============================================================================
-- INDEXES
-- ==============================================================================

-- Workspace / Membership
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members (workspace_id);

-- Projects / Teams / Members
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_teams_project ON public.teams (project_id);
CREATE INDEX IF NOT EXISTS idx_teams_workspace ON public.teams (workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON public.teams (lead_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members (user_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks (priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON public.tasks (team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignment_type ON public.tasks (assignment_type);

-- Comments / Activity
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_workspace ON public.activity_events (workspace_id, created_at DESC);

-- Slack
CREATE INDEX IF NOT EXISTS idx_slack_inst_ws ON public.slack_installations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_inst_team ON public.slack_installations (slack_team_id);
CREATE INDEX IF NOT EXISTS idx_slack_map_ws ON public.slack_user_mappings (workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_map_user ON public.slack_user_mappings (taskpilot_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_map_slack_id ON public.slack_user_mappings (slack_user_id);
CREATE INDEX IF NOT EXISTS idx_int_events_ws ON public.integration_events (workspace_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_int_events_external ON public.integration_events (provider, external_event_id);
CREATE INDEX IF NOT EXISTS idx_followups_ws_status ON public.task_followups (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_followups_task ON public.task_followups (task_id);
CREATE INDEX IF NOT EXISTS idx_followups_sched ON public.task_followups (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ext_msg_task ON public.external_messages (task_id);
CREATE INDEX IF NOT EXISTS idx_ext_msg_thread ON public.external_messages (external_conversation_id, external_thread_id);

-- GitHub / Evidence / Claims
CREATE INDEX IF NOT EXISTS idx_gh_installations_workspace ON public.github_installations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gh_repositories_workspace ON public.github_repositories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gh_repositories_project ON public.github_repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_gh_user_mappings_workspace ON public.github_user_mappings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_workspace ON public.evidence_artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_task ON public.evidence_artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_commit ON public.evidence_artifacts(commit_sha);
CREATE INDEX IF NOT EXISTS idx_work_claims_workspace ON public.work_claims(workspace_id);
CREATE INDEX IF NOT EXISTS idx_work_claims_task ON public.work_claims(task_id);
CREATE INDEX IF NOT EXISTS idx_work_claims_claimant ON public.work_claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_work_claims_review_state ON public.work_claims(review_state);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim ON public.claim_evidence_associations(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_artifact ON public.claim_evidence_associations(artifact_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_task ON public.routing_decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_workspace ON public.routing_decisions(workspace_id);

-- Single-repo-per-project invariant (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_github_repo_project_single
    ON public.github_repositories (project_id)
    WHERE project_id IS NOT NULL;

-- ==============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ==============================================================================

-- Check workspace membership (explicit user)
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = p_user_id
    );
$$;

-- Overload: current authenticated user
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_workspace_member(p_workspace_id, auth.uid());
$$;

-- Get workspace role (explicit user)
CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
    LIMIT 1;
$$;

-- Overload: current authenticated user
CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.get_workspace_role(p_workspace_id, auth.uid());
$$;

-- Next task number helper
CREATE OR REPLACE FUNCTION public.get_next_task_number(p_project_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next INT;
BEGIN
    SELECT COALESCE(MAX(task_number), 0) + 1
    INTO v_next
    FROM public.tasks
    WHERE project_id = p_project_id;
    RETURN v_next;
END;
$$;

-- ==============================================================================
-- BUSINESS LOGIC FUNCTIONS
-- ==============================================================================

-- Atomic workspace creation with plan-limit enforcement
CREATE OR REPLACE FUNCTION public.create_workspace_with_admin(
    p_name TEXT,
    p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_workspace_id UUID;
    v_ws_count INT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT COUNT(*) INTO v_ws_count
    FROM public.workspaces
    WHERE created_by = v_user_id;

    IF v_ws_count >= 1 THEN
        RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: You have reached the maximum allowed workspaces (1) on the Free plan. Please upgrade your plan to provision additional workspaces.'
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        COALESCE(
            auth.jwt() -> 'user_metadata' ->> 'full_name',
            auth.jwt() -> 'user_metadata' ->> 'name',
            split_part(auth.jwt() ->> 'email', '@', 1),
            'User'
        ),
        auth.jwt() -> 'user_metadata' ->> 'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET updated_at = timezone('utc'::text, now());

    INSERT INTO public.workspaces (name, slug, created_by)
    VALUES (p_name, lower(trim(p_slug)), v_user_id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';

    INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status)
    VALUES (v_workspace_id, 'free', 'active')
    ON CONFLICT (workspace_id) DO NOTHING;

    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        v_workspace_id, v_user_id, 'workspace', v_workspace_id, 'created',
        jsonb_build_object('name', p_name, 'slug', p_slug)
    );

    SELECT jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'role', 'admin')
    INTO v_result FROM public.workspaces w WHERE w.id = v_workspace_id;

    RETURN v_result;
END;
$$;

-- Atomic project creation with plan limits + auto project-lead enrollment
CREATE OR REPLACE FUNCTION public.create_project_with_limits(
    p_workspace_id UUID,
    p_name TEXT,
    p_identifier TEXT,
    p_description TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'active',
    p_lead_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_target_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_proj_count INT;
    v_max_projects INT := 5;
    v_project_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF NOT public.is_workspace_member(p_workspace_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of this workspace';
    END IF;

    SELECT p.max_projects_per_workspace INTO v_max_projects
    FROM public.workspace_subscriptions ws
    JOIN public.plans p ON ws.plan_id = p.id
    WHERE ws.workspace_id = p_workspace_id AND ws.status = 'active';

    IF v_max_projects IS NULL THEN
        v_max_projects := 5;
    END IF;

    SELECT COUNT(*) INTO v_proj_count
    FROM public.projects
    WHERE workspace_id = p_workspace_id AND status != 'archived';

    IF v_proj_count >= v_max_projects THEN
        RAISE EXCEPTION 'PROJECT_LIMIT_EXCEEDED: This workspace has reached its limit of % projects on the current plan. Upgrade to create more projects.', v_max_projects
        USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.projects (
        workspace_id, name, identifier, description, status, lead_id, start_date, target_date, created_by
    )
    VALUES (
        p_workspace_id, p_name, upper(trim(p_identifier)), p_description, p_status, p_lead_id, p_start_date, p_target_date, v_user_id
    )
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_project_id, v_user_id, 'lead')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    IF p_lead_id IS NOT NULL AND p_lead_id != v_user_id THEN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_project_id, p_lead_id, 'lead')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
    END IF;

    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        p_workspace_id, v_user_id, 'project', v_project_id, 'created',
        jsonb_build_object('name', p_name, 'identifier', p_identifier)
    );

    SELECT jsonb_build_object(
        'id', p.id,
        'workspace_id', p.workspace_id,
        'name', p.name,
        'identifier', p.identifier,
        'status', p.status
    )
    INTO v_result
    FROM public.projects p WHERE p.id = v_project_id;

    RETURN v_result;
END;
$$;

-- Atomic task status transition with mandatory reason
CREATE OR REPLACE FUNCTION public.update_task_status_with_reason(
    p_task_id UUID,
    p_new_status TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_task RECORD;
    v_ws_role TEXT;
    v_is_team_lead BOOLEAN := false;
    v_clean_reason TEXT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    v_clean_reason := trim(p_reason);
    IF v_clean_reason IS NULL OR length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A meaningful reason (minimum 3 characters) is required for all status transitions.';
    END IF;

    SELECT t.*, p.identifier AS project_identifier
    INTO v_task
    FROM public.tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = p_task_id;

    IF v_task IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    v_ws_role := public.get_workspace_role(v_task.workspace_id, v_user_id);
    IF v_ws_role IS NULL THEN
        RAISE EXCEPTION 'Access denied: user is not a member of this workspace';
    END IF;

    IF v_task.team_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.teams
            WHERE id = v_task.team_id AND lead_id = v_user_id
        ) INTO v_is_team_lead;
    END IF;

    IF p_new_status IN ('Done', 'Cancelled') THEN
        IF v_ws_role != 'admin' AND NOT v_is_team_lead AND v_task.created_by != v_user_id THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_id = v_task.project_id AND user_id = v_user_id AND role = 'lead'
            ) THEN
                RAISE EXCEPTION 'Only the team leader, project lead, or workspace administrator can finalize tasks (Done/Cancelled).';
            END IF;
        END IF;
    ELSE
        IF v_ws_role != 'admin' AND NOT v_is_team_lead AND v_task.assignee_id != v_user_id AND v_task.created_by != v_user_id THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_id = v_task.project_id AND user_id = v_user_id AND role = 'lead'
            ) THEN
                RAISE EXCEPTION 'Unauthorized: only the assigned member, team leader, or administrator can update this task.';
            END IF;
        END IF;
    END IF;

    UPDATE public.tasks
    SET
        status = p_new_status,
        status_reason = v_clean_reason,
        status_changed_by = v_user_id,
        status_changed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_task_id;

    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        v_task.workspace_id,
        v_user_id,
        'task',
        p_task_id,
        'status_changed',
        jsonb_build_object(
            'previous_status', v_task.status,
            'new_status', p_new_status,
            'reason', v_clean_reason,
            'task_identifier', v_task.project_identifier || '-' || v_task.task_number,
            'assignment_type', v_task.assignment_type,
            'team_id', v_task.team_id,
            'assignee_id', v_task.assignee_id
        )
    );

    SELECT jsonb_build_object(
        'id', t.id,
        'status', t.status,
        'status_reason', t.status_reason,
        'status_changed_by', t.status_changed_by,
        'status_changed_at', t.status_changed_at
    )
    INTO v_result
    FROM public.tasks t WHERE t.id = p_task_id;

    RETURN v_result;
END;
$$;

-- Atomic team member transfer (admin-only)
CREATE OR REPLACE FUNCTION public.move_team_member(
    p_source_team_id UUID,
    p_target_team_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_src RECORD;
    v_tgt RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_src FROM public.teams WHERE id = p_source_team_id;
    SELECT * INTO v_tgt FROM public.teams WHERE id = p_target_team_id;

    IF v_src IS NULL OR v_tgt IS NULL THEN
        RAISE EXCEPTION 'Source or target team not found';
    END IF;

    IF public.get_workspace_role(v_src.workspace_id, v_admin_id) != 'admin' THEN
        RAISE EXCEPTION 'Only workspace administrators are authorized to transfer members across teams';
    END IF;

    DELETE FROM public.team_members
    WHERE team_id = p_source_team_id AND user_id = p_user_id;

    INSERT INTO public.team_members (team_id, user_id, added_by)
    VALUES (p_target_team_id, p_user_id, v_admin_id)
    ON CONFLICT (team_id, user_id) DO NOTHING;

    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_tgt.project_id, p_user_id, 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        v_src.workspace_id,
        v_admin_id,
        'team_member',
        p_user_id,
        'transferred',
        jsonb_build_object(
            'from_team_id', p_source_team_id,
            'from_team_name', v_src.name,
            'to_team_id', p_target_team_id,
            'to_team_name', v_tgt.name
        )
    );

    RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_team_id', p_target_team_id);
END;
$$;

-- Invitation redemption
CREATE OR REPLACE FUNCTION public.join_workspace_with_invite(
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_invite RECORD;
    v_existing_member RECORD;
    v_lead_exists BOOLEAN;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_invite
    FROM public.workspace_invitations
    WHERE code = trim(p_code)
      AND expires_at > now()
      AND uses_count < max_uses;

    IF v_invite IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invitation code';
    END IF;

    SELECT * INTO v_existing_member
    FROM public.workspace_members
    WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id;

    IF v_existing_member IS NOT NULL THEN
        RAISE EXCEPTION 'User is already a member of this workspace';
    END IF;

    IF v_invite.role = 'lead' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = v_invite.workspace_id AND role = 'lead'
        ) INTO v_lead_exists;

        IF v_lead_exists THEN
            RAISE EXCEPTION 'This workspace already has a designated team lead. Contact your administrator.';
        END IF;
    END IF;

    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        COALESCE(
            auth.jwt() -> 'user_metadata' ->> 'full_name',
            auth.jwt() -> 'user_metadata' ->> 'name',
            split_part(auth.jwt() ->> 'email', '@', 1),
            'User'
        ),
        auth.jwt() -> 'user_metadata' ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role);

    UPDATE public.workspace_invitations
    SET uses_count = uses_count + 1
    WHERE id = v_invite.id;

    INSERT INTO public.activity_events (workspace_id, actor_id, entity_type, entity_id, event_type, metadata)
    VALUES (v_invite.workspace_id, v_user_id, 'member', v_user_id, 'joined',
            jsonb_build_object('role', v_invite.role, 'code', p_code));

    SELECT jsonb_build_object(
        'workspace_id', w.id,
        'name', w.name,
        'slug', w.slug,
        'role', v_invite.role
    ) INTO v_result
    FROM public.workspaces w
    WHERE w.id = v_invite.workspace_id;

    RETURN v_result;
END;
$$;

-- ==============================================================================
-- TRIGGERS
-- ==============================================================================

-- Sync new auth users into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, github_username, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'user_name', NEW.raw_user_meta_data ->> 'preferred_username'),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name',
                 split_part(NEW.email, '@', 1), 'User'),
        NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        github_username = COALESCE(EXCLUDED.github_username, profiles.github_username),
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign workspace creator as admin
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (NEW.id, NEW.created_by, 'admin')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_installation_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installation_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_evidence_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- ---------- PROFILES ----------
CREATE POLICY "Profiles viewable by authenticated users"
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- WORKSPACES ----------
CREATE POLICY "Workspaces viewable by workspace members"
    ON public.workspaces FOR SELECT TO authenticated
    USING (public.is_workspace_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Workspaces updatable only by workspace admin"
    ON public.workspaces FOR UPDATE TO authenticated
    USING (public.get_workspace_role(id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(id, auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can create workspaces"
    ON public.workspaces FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- ---------- WORKSPACE MEMBERS ----------
CREATE POLICY "Workspace members viewable by members of that workspace"
    ON public.workspace_members FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_workspace_member(workspace_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id AND w.created_by = auth.uid()
        )
    );

CREATE POLICY "Workspace admins can manage member roles and memberships"
    ON public.workspace_members FOR ALL TO authenticated
    USING (
        public.get_workspace_role(workspace_id, auth.uid()) = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id AND w.created_by = auth.uid()
        )
    )
    WITH CHECK (
        public.get_workspace_role(workspace_id, auth.uid()) = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id AND w.created_by = auth.uid()
        )
    );

-- ---------- WORKSPACE INVITATIONS ----------
CREATE POLICY "Workspace invitations viewable by workspace admins and leads"
    ON public.workspace_invitations FOR SELECT TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Workspace invitations manageable only by workspace admin"
    ON public.workspace_invitations FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- ---------- PROJECTS ----------
CREATE POLICY "Projects viewable by workspace members"
    ON public.projects FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Projects insertable by admin and lead"
    ON public.projects FOR INSERT TO authenticated
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Projects updatable by admin and lead"
    ON public.projects FOR UPDATE TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Projects deletable only by admin"
    ON public.projects FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- ---------- PROJECT MEMBERS ----------
CREATE POLICY "Project members viewable by workspace members"
    ON public.project_members FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_members.project_id
              AND public.is_workspace_member(p.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Project members manageable by workspace admin and project lead"
    ON public.project_members FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_members.project_id
              AND (
                public.get_workspace_role(p.workspace_id, auth.uid()) = 'admin'
                OR p.lead_id = auth.uid()
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_members.project_id
              AND (
                public.get_workspace_role(p.workspace_id, auth.uid()) = 'admin'
                OR p.lead_id = auth.uid()
              )
        )
    );

-- ---------- TEAMS ----------
CREATE POLICY "Teams viewable by workspace members"
    ON public.teams FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Teams insertable by workspace admin and project lead"
    ON public.teams FOR INSERT TO authenticated
    WITH CHECK (
        public.get_workspace_role(workspace_id, auth.uid()) = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = teams.project_id AND p.lead_id = auth.uid()
        )
    );

CREATE POLICY "Teams updatable by workspace admin, project lead, or team lead"
    ON public.teams FOR UPDATE TO authenticated
    USING (
        public.get_workspace_role(workspace_id, auth.uid()) = 'admin'
        OR lead_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = teams.project_id AND p.lead_id = auth.uid()
        )
    )
    WITH CHECK (
        public.get_workspace_role(workspace_id, auth.uid()) = 'admin'
        OR lead_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = teams.project_id AND p.lead_id = auth.uid()
        )
    );

CREATE POLICY "Teams deletable only by workspace admin"
    ON public.teams FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- ---------- TEAM MEMBERS ----------
CREATE POLICY "Team members viewable by workspace members"
    ON public.team_members FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Team members manageable by admin, project lead, or team lead"
    ON public.team_members FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = team_members.team_id
              AND (
                public.get_workspace_role(t.workspace_id, auth.uid()) = 'admin'
                OR t.lead_id = auth.uid()
                OR p.lead_id = auth.uid()
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = team_members.team_id
              AND (
                public.get_workspace_role(t.workspace_id, auth.uid()) = 'admin'
                OR t.lead_id = auth.uid()
                OR p.lead_id = auth.uid()
              )
        )
    );

-- ---------- PROJECT REPOSITORIES ----------
CREATE POLICY "Project repositories viewable by workspace members"
    ON public.project_repositories FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_repositories.project_id
              AND public.is_workspace_member(p.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Project repositories manageable by admin and lead"
    ON public.project_repositories FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_repositories.project_id
              AND public.get_workspace_role(p.workspace_id, auth.uid()) IN ('admin', 'lead')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_repositories.project_id
              AND public.get_workspace_role(p.workspace_id, auth.uid()) IN ('admin', 'lead')
        )
    );

-- ---------- TASKS ----------
CREATE POLICY "Tasks viewable by workspace members"
    ON public.tasks FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Tasks insertable by workspace members"
    ON public.tasks FOR INSERT TO authenticated
    WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid())
        AND auth.uid() = created_by
    );

CREATE POLICY "Tasks updatable by admins, leads, and assigned members"
    ON public.tasks FOR UPDATE TO authenticated
    USING (
        public.is_workspace_member(workspace_id, auth.uid()) AND (
            public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead')
            OR assignee_id = auth.uid()
            OR created_by = auth.uid()
        )
    )
    WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid()) AND (
            public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead')
            OR assignee_id = auth.uid()
            OR created_by = auth.uid()
        )
    );

CREATE POLICY "Tasks deletable by admin and lead"
    ON public.tasks FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

-- ---------- TASK COMMENTS ----------
CREATE POLICY "Task comments viewable by workspace members"
    ON public.task_comments FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_comments.task_id
              AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Task comments insertable by workspace members"
    ON public.task_comments FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_comments.task_id
              AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Task comments updatable by comment author"
    ON public.task_comments FOR UPDATE TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Task comments deletable by author or workspace admin"
    ON public.task_comments FOR DELETE TO authenticated
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_comments.task_id
              AND public.get_workspace_role(t.workspace_id, auth.uid()) = 'admin'
        )
    );

-- ---------- ACTIVITY EVENTS (Immutable audit) ----------
CREATE POLICY "Activity events viewable by workspace members"
    ON public.activity_events FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Activity events appendable by workspace members"
    ON public.activity_events FOR INSERT TO authenticated
    WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid())
        AND (actor_id IS NULL OR actor_id = auth.uid())
    );

-- ---------- SLACK ----------
CREATE POLICY "Members can view workspace slack installations"
    ON public.slack_installations FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage workspace slack installations"
    ON public.slack_installations FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- slack_installation_secrets: no policies => locked from all authenticated/anon clients

CREATE POLICY "Members can view workspace slack user mappings"
    ON public.slack_user_mappings FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage workspace slack user mappings"
    ON public.slack_user_mappings FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

CREATE POLICY "Users can self-manage their own slack mapping"
    ON public.slack_user_mappings FOR UPDATE
    USING (taskpilot_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
    WITH CHECK (taskpilot_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can view slack conversations"
    ON public.slack_conversations FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage slack conversations"
    ON public.slack_conversations FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

CREATE POLICY "Members can view workspace integration events"
    ON public.integration_events FOR SELECT
    USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can delete integration events"
    ON public.integration_events FOR DELETE
    USING (workspace_id IS NOT NULL AND public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

CREATE POLICY "Admins and Leads can view all workspace followups"
    ON public.task_followups FOR SELECT
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Members can view their assigned followups"
    ON public.task_followups FOR SELECT
    USING (recipient_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins and Leads can manage followups"
    ON public.task_followups FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Members can view workspace external messages"
    ON public.external_messages FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

-- ---------- GITHUB ----------
CREATE POLICY "Workspace members can view github installations"
    ON public.github_installations FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can manage github installations"
    ON public.github_installations FOR ALL
    USING (public.get_workspace_role(workspace_id) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id) = 'admin');

-- github_installation_secrets: no policies => locked from all clients

CREATE POLICY "Workspace members can view github repositories"
    ON public.github_repositories FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins and leads can manage github repositories"
    ON public.github_repositories FOR ALL
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

CREATE POLICY "Workspace members can view github user mappings"
    ON public.github_user_mappings FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can manage all github user mappings"
    ON public.github_user_mappings FOR ALL
    USING (public.get_workspace_role(workspace_id) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id) = 'admin');

CREATE POLICY "Users can manage own github user mapping"
    ON public.github_user_mappings FOR ALL
    USING (taskpilot_user_id = auth.uid())
    WITH CHECK (taskpilot_user_id = auth.uid());

CREATE POLICY "Workspace members can view evidence artifacts"
    ON public.evidence_artifacts FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins and leads can manage evidence artifacts"
    ON public.evidence_artifacts FOR ALL
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

CREATE POLICY "Workspace members can view work claims"
    ON public.work_claims FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can submit own work claims"
    ON public.work_claims FOR INSERT
    WITH CHECK (
        public.is_workspace_member(workspace_id)
        AND claimant_id = auth.uid()
    );

CREATE POLICY "Admins and leads can review work claims"
    ON public.work_claims FOR UPDATE
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

CREATE POLICY "Workspace members can view claim evidence associations"
    ON public.claim_evidence_associations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.work_claims wc
            WHERE wc.id = claim_evidence_associations.claim_id
              AND public.is_workspace_member(wc.workspace_id)
        )
    );

CREATE POLICY "Admins and leads can manage claim evidence associations"
    ON public.claim_evidence_associations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.work_claims wc
            WHERE wc.id = claim_evidence_associations.claim_id
              AND public.get_workspace_role(wc.workspace_id) IN ('admin', 'lead')
        )
    );

CREATE POLICY "Workspace members can view routing decisions"
    ON public.routing_decisions FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins and leads can manage routing decisions"
    ON public.routing_decisions FOR ALL
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

-- ---------- BILLING ----------
CREATE POLICY "Plans viewable by authenticated users"
    ON public.plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Subscriptions viewable by workspace members"
    ON public.workspace_subscriptions FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Subscriptions manageable only by workspace admin"
    ON public.workspace_subscriptions FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

CREATE POLICY "Promo codes viewable by authenticated users"
    ON public.promo_codes FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "Promo redemptions viewable by workspace members"
    ON public.promo_redemptions FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can redeem promo codes"
    ON public.promo_redemptions FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND public.is_workspace_member(workspace_id, auth.uid())
    );

-- ==============================================================================
-- GRANTS (anon is locked down, authenticated is scoped by RLS)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- anon is explicitly denied all data access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ==============================================================================
-- GITHUB INTELLIGENCE & UNIVERSAL GEMINI FOUNDATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.github_oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_token TEXT NOT NULL UNIQUE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '15 minutes'),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_gh_oauth_states_token ON public.github_oauth_states (state_token);
CREATE INDEX IF NOT EXISTS idx_gh_oauth_states_ws ON public.github_oauth_states (workspace_id);

ALTER TABLE public.github_installations
    ADD COLUMN IF NOT EXISTS account_avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS rate_limit_remaining INT,
    ADD COLUMN IF NOT EXISTS rate_limit_reset_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error_code TEXT;

ALTER TABLE public.github_repositories
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS primary_language TEXT,
    ADD COLUMN IF NOT EXISTS languages JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS stars_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS forks_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS open_issues_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS readme_content TEXT,
    ADD COLUMN IF NOT EXISTS package_manifests JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.github_repository_contributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
    github_user_id BIGINT NOT NULL,
    login TEXT NOT NULL,
    avatar_url TEXT,
    html_url TEXT,
    contributions_count INT NOT NULL DEFAULT 0,
    taskpilot_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_repo_contributor UNIQUE (repository_id, github_user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_contributors_repo ON public.github_repository_contributors (repository_id);
CREATE INDEX IF NOT EXISTS idx_gh_contributors_ws ON public.github_repository_contributors (workspace_id);

ALTER TABLE public.evidence_artifacts DROP CONSTRAINT IF EXISTS evidence_artifacts_artifact_type_check;
ALTER TABLE public.evidence_artifacts ADD CONSTRAINT evidence_artifacts_artifact_type_check
    CHECK (artifact_type IN ('pull_request', 'commit', 'review', 'check_run', 'issue'));

CREATE TABLE IF NOT EXISTS public.project_ai_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES public.github_repositories(id) ON DELETE SET NULL,
    task_name TEXT NOT NULL DEFAULT 'project.repository_context',
    provider TEXT NOT NULL DEFAULT 'gemini',
    model_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    evidence_fingerprint TEXT NOT NULL,
    referenced_artifact_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    structured_output JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_category TEXT,
    error_summary TEXT,
    usage_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_proj_ai_ctx_project ON public.project_ai_contexts (project_id, task_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proj_ai_ctx_workspace ON public.project_ai_contexts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_proj_ai_ctx_fingerprint ON public.project_ai_contexts (project_id, evidence_fingerprint);

ALTER TABLE public.github_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repository_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_ai_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can insert their own oauth states"
    ON public.github_oauth_states FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = initiated_by AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can view their own oauth states"
    ON public.github_oauth_states FOR SELECT TO authenticated
    USING (auth.uid() = initiated_by);

CREATE POLICY "Workspace members can view repo contributors"
    ON public.github_repository_contributors FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view project AI contexts"
    ON public.project_ai_contexts FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

GRANT ALL ON public.github_oauth_states TO authenticated;
GRANT ALL ON public.github_repository_contributors TO authenticated;
GRANT ALL ON public.project_ai_contexts TO authenticated;


GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;



-- ==============================================================================
-- TaskPilot — GitHub Integration Recovery & Complete Grants
-- Migration: 20261017000002_github_integration_recovery.sql
-- ==============================================================================

-- 1. UNIQUE CONSTRAINT ON (workspace_id, github_repo_id) FOR STABLE IDENTITY
CREATE UNIQUE INDEX IF NOT EXISTS idx_gh_repos_workspace_github_id 
    ON public.github_repositories (workspace_id, github_repo_id);

-- 2. GITHUB EVENTS UNIQUE CONSTRAINT & INDEXES
CREATE INDEX IF NOT EXISTS idx_gh_events_delivery_id ON public.github_events (delivery_id);
CREATE INDEX IF NOT EXISTS idx_gh_events_status ON public.github_events (processing_status);
CREATE INDEX IF NOT EXISTS idx_gh_events_repo_id ON public.github_events (repository_id);
CREATE INDEX IF NOT EXISTS idx_gh_events_installation_id ON public.github_events (installation_id);

-- 3. ENSURE INSTALLATION CONNECTION STATUS VALIDITY
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_github_installations_connection_status'
    ) THEN
        ALTER TABLE public.github_installations
            ADD CONSTRAINT chk_github_installations_connection_status
            CHECK (connection_status IN ('active', 'suspended', 'revoked', 'disconnected'));
    END IF;
END $$;

-- 4. SERVICE ROLE PERMISSIONS ASSURANCE
-- Ensure service_role has unconditional privileges on internal GitHub tables
GRANT ALL ON TABLE public.github_events TO service_role;
GRANT ALL ON TABLE public.github_installations TO service_role;
GRANT ALL ON TABLE public.github_installation_secrets TO service_role;
GRANT ALL ON TABLE public.github_repositories TO service_role;
GRANT ALL ON TABLE public.evidence_artifacts TO service_role;
GRANT ALL ON TABLE public.github_repository_contributors TO service_role;
GRANT ALL ON TABLE public.github_oauth_states TO service_role;

-- 5. POLICIES FOR ADMINS TO MANAGE GITHUB REPOSITORIES DIRECTLY
DROP POLICY IF EXISTS "Admins and leads can insert github repositories" ON public.github_repositories;
CREATE POLICY "Admins and leads can insert github repositories"
    ON public.github_repositories FOR INSERT
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

DROP POLICY IF EXISTS "Admins and leads can update github repositories" ON public.github_repositories;
CREATE POLICY "Admins and leads can update github repositories"
    ON public.github_repositories FOR UPDATE
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));
CREATE OR REPLACE FUNCTION public.create_project_with_limits(
    p_workspace_id UUID, p_name TEXT, p_identifier TEXT,
    p_description TEXT DEFAULT NULL, p_status TEXT DEFAULT 'active',
    p_lead_id UUID DEFAULT NULL, p_start_date DATE DEFAULT NULL,
    p_target_date DATE DEFAULT NULL, p_github_repo_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_count INT; v_max INT := 5; v_pid UUID; v_repo RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_workspace_member(p_workspace_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    SELECT p.max_projects_per_workspace INTO v_max
    FROM public.workspace_subscriptions ws
    JOIN public.plans p ON ws.plan_id = p.id
    WHERE ws.workspace_id = p_workspace_id AND ws.status = 'active';
    IF v_max IS NULL THEN v_max := 5; END IF;
    SELECT COUNT(*) INTO v_count FROM public.projects
    WHERE workspace_id = p_workspace_id AND status != 'archived';
    IF v_count >= v_max THEN
        RAISE EXCEPTION 'PROJECT_LIMIT_EXCEEDED: limit is %', v_max USING ERRCODE='P0002';
    END IF;
    IF p_github_repo_id IS NOT NULL THEN
        SELECT id, project_id INTO v_repo FROM public.github_repositories
        WHERE github_repo_id = p_github_repo_id AND workspace_id = p_workspace_id;
        IF v_repo IS NULL THEN RAISE EXCEPTION 'Repo not authorized in this workspace'; END IF;
        IF v_repo.project_id IS NOT NULL THEN RAISE EXCEPTION 'Repo already linked to another project'; END IF;
    END IF;
    INSERT INTO public.projects (workspace_id, name, identifier, description, status, lead_id, start_date, target_date, created_by)
    VALUES (p_workspace_id, p_name, upper(trim(p_identifier)), p_description, p_status, p_lead_id, p_start_date, p_target_date, v_user_id)
    RETURNING id INTO v_pid;

    IF p_github_repo_id IS NOT NULL THEN
        UPDATE public.github_repositories
        SET project_id = v_pid, updated_at = now()
        WHERE github_repo_id = p_github_repo_id AND workspace_id = p_workspace_id;
    END IF;

    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_pid, v_user_id, 'lead') ON CONFLICT DO NOTHING;
    IF p_lead_id IS NOT NULL AND p_lead_id != v_user_id THEN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_pid, p_lead_id, 'lead')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role='lead';
    END IF;

    INSERT INTO public.activity_events (workspace_id, actor_id, entity_type, entity_id, event_type, metadata)
    VALUES (p_workspace_id, v_user_id, 'project', v_pid, 'created',
            jsonb_build_object('name', p_name, 'identifier', p_identifier));

    RETURN jsonb_build_object('id', v_pid, 'workspace_id', p_workspace_id,
                              'name', p_name, 'identifier', upper(trim(p_identifier)));
END; $$;

GRANT EXECUTE ON FUNCTION public.create_project_with_limits(UUID,TEXT,TEXT,TEXT,TEXT,UUID,DATE,DATE,BIGINT) TO authenticated;

-- ==============================================================================
-- WORKSPACE MONETIZATION & RAZORPAY INTEGRATION
-- ==============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS workspaces_created_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount_paise INT NOT NULL DEFAULT 300000,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    plan_id TEXT NOT NULL DEFAULT 'yearly',
    receipt TEXT,
    notes JSONB DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);

CREATE TABLE IF NOT EXISTS public.user_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'yearly',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    max_workspaces INT NOT NULL DEFAULT 10,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    valid_until TIMESTAMPTZ NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_lookup 
ON public.user_entitlements (user_id, status, valid_until);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_user_view ON public.payments;
CREATE POLICY payments_user_view ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_user_view ON public.user_entitlements;
CREATE POLICY user_entitlements_user_view ON public.user_entitlements
    FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

GRANT SELECT ON public.user_entitlements TO authenticated;
GRANT ALL ON public.user_entitlements TO service_role;

INSERT INTO public.plans (id, name, description, price_cents, currency, billing_interval, max_workspaces, max_projects_per_workspace, features)
VALUES
    ('free', 'Starter Free', 'Essential tooling for individual builders and hackathon teams.', 0, 'INR', 'free', 1, 5, '["1 Free Workspace", "Up to 5 Projects per Workspace", "Project-Scoped Teams", "Slack & GitHub Integration", "Standard Activity Audit Trail"]'::jsonb),
    ('yearly', 'Pro Yearly', 'Comprehensive delivery coordination for scaling organizations.', 300000, 'INR', 'yearly', 10, 50, '["Up to 10 Workspaces", "Up to 50 Projects per Workspace", "Priority GitHub Webhooks", "Advanced Gemini Insights", "Audit Log Retention", "Team Workload Analytics"]'::jsonb),
    ('onetime', 'Founder Lifetime', 'Single investment for permanent autonomous project coordination.', 999900, 'INR', 'lifetime', 999, 999, '["Unlimited Workspaces", "Unlimited Projects", "Dedicated Support", "Full Gemini Intelligence Access", "All Future Pro Features"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency,
    billing_interval = EXCLUDED.billing_interval,
    max_workspaces = EXCLUDED.max_workspaces,
    max_projects_per_workspace = EXCLUDED.max_projects_per_workspace,
    features = EXCLUDED.features;

CREATE OR REPLACE FUNCTION public.create_workspace_with_admin(
    p_name TEXT,
    p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_workspace_id UUID;
    v_lifetime_created INT;
    v_active_workspaces INT;
    v_max_allowed INT := 1;
    v_has_active_entitlement BOOLEAN := false;
    v_entitlement_max INT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN 
        RAISE EXCEPTION 'Not authenticated'; 
    END IF;

    INSERT INTO public.profiles (id, email, display_name, avatar_url, workspaces_created_count)
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        COALESCE(
            auth.jwt() -> 'user_metadata' ->> 'full_name',
            auth.jwt() -> 'user_metadata' ->> 'name',
            split_part(auth.jwt() ->> 'email', '@', 1),
            'User'
        ),
        auth.jwt() -> 'user_metadata' ->> 'avatar_url',
        0
    )
    ON CONFLICT (id) DO UPDATE SET updated_at = timezone('utc'::text, now());

    SELECT COALESCE(workspaces_created_count, 0)
    INTO v_lifetime_created
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_active_workspaces
    FROM public.workspaces
    WHERE created_by = v_user_id;

    IF v_active_workspaces > v_lifetime_created THEN
        v_lifetime_created := v_active_workspaces;
    END IF;

    SELECT max_workspaces INTO v_entitlement_max
    FROM public.user_entitlements
    WHERE user_id = v_user_id
      AND status = 'active'
      AND valid_until > timezone('utc'::text, now())
    ORDER BY valid_until DESC
    LIMIT 1;

    IF v_entitlement_max IS NOT NULL THEN
        v_has_active_entitlement := true;
        v_max_allowed := v_entitlement_max;
    END IF;

    IF v_lifetime_created >= v_max_allowed THEN
        IF NOT v_has_active_entitlement THEN
            RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: You have reached the maximum allowed workspaces (1) on the Free plan. Please upgrade to Pro Yearly (₹3,000/year) to provision additional workspaces.'
            USING ERRCODE = 'P0001';
        ELSE
            RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: You have reached your commercial plan limit of % workspaces. Please contact support or upgrade for higher capacity.', v_max_allowed
            USING ERRCODE = 'P0001';
        END IF;
    END IF;

    INSERT INTO public.workspaces (name, slug, created_by)
    VALUES (p_name, lower(trim(p_slug)), v_user_id)
    RETURNING id INTO v_workspace_id;

    UPDATE public.profiles
    SET workspaces_created_count = v_lifetime_created + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';

    INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status)
    VALUES (v_workspace_id, CASE WHEN v_has_active_entitlement THEN 'yearly' ELSE 'free' END, 'active')
    ON CONFLICT (workspace_id) DO NOTHING;

    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        v_workspace_id, v_user_id, 'workspace', v_workspace_id, 'created',
        jsonb_build_object('name', p_name, 'slug', p_slug, 'plan', CASE WHEN v_has_active_entitlement THEN 'yearly' ELSE 'free' END)
    );

    SELECT jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'role', 'admin')
    INTO v_result FROM public.workspaces w WHERE w.id = v_workspace_id;

    RETURN v_result;
END;
$$;

-- ==============================================================================
-- SLACK OAUTH STATES & LINK CHALLENGES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.slack_oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_token TEXT NOT NULL UNIQUE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL DEFAULT 'install' CHECK (action IN ('install', 'link')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '15 minutes'),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_slack_oauth_states_token ON public.slack_oauth_states (state_token);
CREATE INDEX IF NOT EXISTS idx_slack_oauth_states_ws ON public.slack_oauth_states (workspace_id);

CREATE TABLE IF NOT EXISTS public.slack_link_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '15 minutes'),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_slack_link_challenges_code ON public.slack_link_challenges (challenge_code);

ALTER TABLE public.slack_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_link_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own slack oauth states" ON public.slack_oauth_states;
CREATE POLICY "Users can create their own slack oauth states"
    ON public.slack_oauth_states FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = initiated_by AND public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own slack oauth states" ON public.slack_oauth_states;
CREATE POLICY "Users can view their own slack oauth states"
    ON public.slack_oauth_states FOR SELECT TO authenticated
    USING (auth.uid() = initiated_by);

DROP POLICY IF EXISTS "Users can create their own slack link challenges" ON public.slack_link_challenges;
CREATE POLICY "Users can create their own slack link challenges"
    ON public.slack_link_challenges FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view their own slack link challenges" ON public.slack_link_challenges;
CREATE POLICY "Users can view their own slack link challenges"
    ON public.slack_link_challenges FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.slack_oauth_states TO service_role;
GRANT ALL ON TABLE public.slack_link_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.slack_oauth_states TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.slack_link_challenges TO authenticated;

NOTIFY pgrst, 'reload schema';