-- ==============================================================================
-- TaskPilot — GitHub Intelligence & Universal Gemini Foundation (Phase 1)
-- Migration: 20261017000001_github_intelligence_gemini_foundation.sql
-- ==============================================================================

-- 1. GITHUB OAUTH / APP CSRF STATES
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

-- 2. EXTEND GITHUB INSTALLATIONS
ALTER TABLE public.github_installations
    ADD COLUMN IF NOT EXISTS account_avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS rate_limit_remaining INT,
    ADD COLUMN IF NOT EXISTS rate_limit_reset_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error_code TEXT;

-- 3. EXTEND GITHUB REPOSITORIES
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

-- 4. GITHUB REPOSITORY CONTRIBUTORS TABLE
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
CREATE INDEX IF NOT EXISTS idx_gh_contributors_login ON public.github_repository_contributors (login);

-- 5. EXTEND EVIDENCE ARTIFACTS TO SUPPORT 'issue'
ALTER TABLE public.evidence_artifacts DROP CONSTRAINT IF EXISTS evidence_artifacts_artifact_type_check;
ALTER TABLE public.evidence_artifacts ADD CONSTRAINT evidence_artifacts_artifact_type_check
    CHECK (artifact_type IN ('pull_request', 'commit', 'review', 'check_run', 'issue'));

-- 6. PROJECT AI CONTEXTS TABLE (Gemini Structured Outputs & Versioned Analyses)
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

-- 7. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.github_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repository_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_ai_contexts ENABLE ROW LEVEL SECURITY;

-- github_oauth_states: Members can create and view their own state tokens
DROP POLICY IF EXISTS "Members can insert their own oauth states" ON public.github_oauth_states;
CREATE POLICY "Members can insert their own oauth states"
    ON public.github_oauth_states FOR INSERT
    WITH CHECK (auth.uid() = initiated_by AND public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their own oauth states" ON public.github_oauth_states;
CREATE POLICY "Members can view their own oauth states"
    ON public.github_oauth_states FOR SELECT
    USING (auth.uid() = initiated_by);

-- github_repository_contributors: Workspace members can view contributors
DROP POLICY IF EXISTS "Workspace members can view repo contributors" ON public.github_repository_contributors;
CREATE POLICY "Workspace members can view repo contributors"
    ON public.github_repository_contributors FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

-- project_ai_contexts: Workspace members can view project AI analyses
DROP POLICY IF EXISTS "Workspace members can view project AI contexts" ON public.project_ai_contexts;
CREATE POLICY "Workspace members can view project AI contexts"
    ON public.project_ai_contexts FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 8. ATOMIC PROJECT CREATION WITH MANDATORY GITHUB REPOSITORY & LIMITS
CREATE OR REPLACE FUNCTION public.create_project_with_limits(
    p_workspace_id UUID,
    p_name TEXT,
    p_identifier TEXT,
    p_description TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'active',
    p_lead_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_target_date DATE DEFAULT NULL,
    p_github_repo_id BIGINT DEFAULT NULL
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
    v_repo RECORD;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF NOT public.is_workspace_member(p_workspace_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of this workspace';
    END IF;

    -- Mandatory GitHub repository validation
    IF p_github_repo_id IS NULL THEN
        RAISE EXCEPTION 'GITHUB_REPO_REQUIRED: Every TaskPilot project must connect to an authorized GitHub repository.'
        USING ERRCODE = 'P0003';
    END IF;

    -- Verify repository exists and belongs to this workspace
    SELECT * INTO v_repo
    FROM public.github_repositories
    WHERE workspace_id = p_workspace_id AND github_repo_id = p_github_repo_id;

    IF v_repo IS NULL THEN
        RAISE EXCEPTION 'GITHUB_REPO_UNAUTHORIZED: The selected GitHub repository is not authorized for this workspace.'
        USING ERRCODE = 'P0004';
    END IF;

    -- Check if repository is already linked to another project
    IF v_repo.project_id IS NOT NULL THEN
        RAISE EXCEPTION 'GITHUB_REPO_ALREADY_LINKED: This GitHub repository is already connected to another project in this workspace.'
        USING ERRCODE = 'P0005';
    END IF;

    -- Check workspace project limits
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

    -- Create Project
    INSERT INTO public.projects (
        workspace_id, name, identifier, description, status, lead_id, start_date, target_date, created_by
    )
    VALUES (
        p_workspace_id, p_name, upper(trim(p_identifier)), p_description, p_status, p_lead_id, p_start_date, p_target_date, v_user_id
    )
    RETURNING id INTO v_project_id;

    -- Link repository to project
    UPDATE public.github_repositories
    SET project_id = v_project_id, updated_at = timezone('utc'::text, now())
    WHERE id = v_repo.id;

    -- Insert canonical project_repositories row
    INSERT INTO public.project_repositories (project_id, repository_url, created_by)
    VALUES (v_project_id, v_repo.repo_url, v_user_id)
    ON CONFLICT (project_id, repository_url) DO NOTHING;

    -- Assign creator as project lead
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_project_id, v_user_id, 'lead')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    IF p_lead_id IS NOT NULL AND p_lead_id != v_user_id THEN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_project_id, p_lead_id, 'lead')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
    END IF;

    -- Log activity event
    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        p_workspace_id, v_user_id, 'project', v_project_id, 'created',
        jsonb_build_object(
            'name', p_name,
            'identifier', p_identifier,
            'github_repo_id', p_github_repo_id,
            'repository_name', v_repo.full_name
        )
    );

    SELECT jsonb_build_object(
        'id', p.id,
        'workspace_id', p.workspace_id,
        'name', p.name,
        'identifier', p.identifier,
        'status', p.status,
        'repository_id', v_repo.id,
        'repository_full_name', v_repo.full_name
    )
    INTO v_result
    FROM public.projects p WHERE p.id = v_project_id;

    RETURN v_result;
END;
$$;
