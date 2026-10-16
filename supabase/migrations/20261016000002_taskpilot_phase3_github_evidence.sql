-- ==============================================================================
-- TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform
-- Migration: 20261016000002_taskpilot_phase3_github_evidence.sql
-- Description: Phase 3 GitHub App Integration, Evidence Intelligence, Work Claims & Routing Decisions
-- ==============================================================================

-- 1. GITHUB INSTALLATIONS TABLE
CREATE TABLE IF NOT EXISTS public.github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    github_installation_id BIGINT NOT NULL,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'User' CHECK (account_type IN ('User', 'Organization')),
    account_avatar_url TEXT,
    connection_status TEXT NOT NULL DEFAULT 'active' CHECK (connection_status IN ('active', 'suspended', 'disconnected', 'error')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    installed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. GITHUB INSTALLATION SECRETS TABLE (Locked to Service-Role / Backend only)
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

-- 3. GITHUB REPOSITORIES TABLE
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
    sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'synced', 'error')),
    sync_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_github_repo UNIQUE (workspace_id, github_repo_id)
);

-- 4. GITHUB USER MAPPINGS TABLE
CREATE TABLE IF NOT EXISTS public.github_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    taskpilot_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    github_user_id BIGINT NOT NULL,
    github_login TEXT NOT NULL,
    link_status TEXT NOT NULL DEFAULT 'linked' CHECK (link_status IN ('linked', 'pending', 'unlinked')),
    linked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_gh_user UNIQUE (workspace_id, github_user_id),
    CONSTRAINT uq_workspace_tp_gh UNIQUE (workspace_id, taskpilot_user_id)
);

-- 5. GITHUB WEBHOOK EVENTS JOURNAL
CREATE TABLE IF NOT EXISTS public.github_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    installation_id BIGINT,
    repository_id BIGINT,
    processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
    error_code TEXT,
    error_summary TEXT,
    payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ
);

-- 6. EVIDENCE ARTIFACTS TABLE
CREATE TABLE IF NOT EXISTS public.evidence_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES public.github_repositories(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL CHECK (artifact_type IN ('pull_request', 'commit', 'review', 'check_run')),
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
    match_method TEXT NOT NULL DEFAULT 'explicit_task_id' CHECK (match_method IN ('explicit_task_id', 'branch_name', 'claim_url', 'ai_match', 'manual')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_external TIMESTAMPTZ,
    updated_at_external TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_repo_artifact UNIQUE (repository_id, artifact_type, external_id)
);

-- 7. WORK CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.work_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claim_source TEXT NOT NULL DEFAULT 'dashboard' CHECK (claim_source IN ('dashboard', 'slack_followup', 'slack_command')),
    claim_text TEXT NOT NULL,
    claim_type TEXT NOT NULL DEFAULT 'implementation' CHECK (claim_type IN ('implementation', 'bug_fix', 'code_review', 'test_coverage', 'documentation', 'progress_update', 'completion')),
    pr_url_hint TEXT,
    review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'supported', 'partially_supported', 'unverified', 'needs_clarification', 'disputed')),
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_rationale TEXT,
    assessment_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Prohibit self-approval in database constraint
    CONSTRAINT chk_claim_no_self_approval CHECK (reviewer_id IS NULL OR reviewer_id != claimant_id)
);

-- 8. CLAIM EVIDENCE ASSOCIATIONS (Many-to-Many linking Claims to Artifacts)
CREATE TABLE IF NOT EXISTS public.claim_evidence_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.work_claims(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL REFERENCES public.evidence_artifacts(id) ON DELETE CASCADE,
    relevance_note TEXT,
    associated_by TEXT NOT NULL DEFAULT 'system' CHECK (associated_by IN ('system', 'ai_matcher', 'reviewer', 'claimant')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_claim_artifact UNIQUE (claim_id, artifact_id)
);

-- 9. ROUTING DECISIONS TABLE
CREATE TABLE IF NOT EXISTS public.routing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    request_source TEXT NOT NULL DEFAULT 'slack' CHECK (request_source IN ('slack', 'web_ui', 'api')),
    decision_version TEXT NOT NULL DEFAULT 'v3.0',
    proposed_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    proposed_assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    selected_outcome TEXT NOT NULL CHECK (selected_outcome IN ('assigned', 'lead_triage', 'clarification_requested', 'rejected', 'overridden')),
    decision_method TEXT NOT NULL DEFAULT 'deterministic' CHECK (decision_method IN ('deterministic', 'agent_proposal', 'human_override')),
    rule_code TEXT,
    rationale TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
    human_intervention_needed BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. INDEXES FOR PERFORMANCE
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

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installation_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_evidence_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_decisions ENABLE ROW LEVEL SECURITY;

-- github_installations: Members can view; Admins can manage
CREATE POLICY "Workspace members can view github installations"
    ON public.github_installations FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can manage github installations"
    ON public.github_installations FOR ALL
    USING (public.get_workspace_role(workspace_id) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id) = 'admin');

-- github_repositories: Members can view; Admins and Leads can manage
CREATE POLICY "Workspace members can view github repositories"
    ON public.github_repositories FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins and leads can manage github repositories"
    ON public.github_repositories FOR ALL
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

-- github_user_mappings: Members can view; Admins can manage; Members can manage their own mapping
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

-- evidence_artifacts: Members can view artifacts in their workspace
CREATE POLICY "Workspace members can view evidence artifacts"
    ON public.evidence_artifacts FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins and leads can manage evidence artifacts"
    ON public.evidence_artifacts FOR ALL
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));

-- work_claims: Members can view all claims in workspace; Members can create own claims; Admins & Leads can review
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

-- claim_evidence_associations: Members can view; Admins and Leads can associate
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

-- routing_decisions: Members can view routing decisions; Admins and leads can manage/override
CREATE POLICY "Workspace members can view routing decisions"
    ON public.routing_decisions FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins and leads can manage routing decisions"
    ON public.routing_decisions FOR ALL
    USING (public.get_workspace_role(workspace_id) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('admin', 'lead'));
