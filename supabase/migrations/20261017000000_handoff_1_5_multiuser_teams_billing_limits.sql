-- ==============================================================================
-- TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform
-- Migration: 20261017000000_handoff_1_5_multiuser_teams_billing_limits.sql
-- Description: Multi-User Project Architecture, Project-Scoped Teams, Atomic Limits & Billing Foundation
-- ==============================================================================

-- 1. DROP OBSOLETE WORKSPACE-WIDE SINGLE LEAD CONSTRAINT
DROP INDEX IF EXISTS public.idx_one_lead_per_workspace;

-- 2. PROJECT MEMBERS TABLE (Project-level user membership & access control)
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members (user_id);

-- 3. TEAMS TABLE (Project-Scoped Teams)
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

CREATE INDEX IF NOT EXISTS idx_teams_project ON public.teams (project_id);
CREATE INDEX IF NOT EXISTS idx_teams_workspace ON public.teams (workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON public.teams (lead_id);

-- 4. TEAM MEMBERS TABLE (Members within a project team)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members (user_id);

-- 5. EXTEND PROJECTS TABLE (Lifecycle States & Completion Tracking)
ALTER TABLE public.projects
    DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
    ADD CONSTRAINT projects_status_check
    CHECK (status IN ('planning', 'active', 'at_risk', 'completed', 'paused', 'archived'));

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 6. EXTEND TASKS TABLE (Individual vs Team Assignment & Reason Tracking)
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'individual' CHECK (assignment_type IN ('individual', 'team')),
    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status_reason TEXT,
    ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_team ON public.tasks (team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignment_type ON public.tasks (assignment_type);

-- 7. GITHUB SINGLE REPOSITORY PER PROJECT INVARIANT
CREATE UNIQUE INDEX IF NOT EXISTS uq_github_repo_project_single
    ON public.github_repositories (project_id)
    WHERE project_id IS NOT NULL;

-- 8. BILLING & PLANS FOUNDATION TABLES
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('free', 'monthly', 'yearly', 'lifetime')),
    max_workspaces INT NOT NULL DEFAULT 1,
    max_projects_per_workspace INT NOT NULL DEFAULT 5,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.plans (id, name, description, price_cents, currency, billing_interval, max_workspaces, max_projects_per_workspace, features)
VALUES
    ('free', 'Starter Free', 'Essential tooling for individual builders and hackathon teams.', 0, 'USD', 'free', 1, 5, '["1 Workspace", "Up to 5 Projects", "Project-Scoped Teams", "Slack & GitHub Integration", "Basic Evidence Intelligence"]'::jsonb),
    ('yearly', 'Pro Yearly', 'Comprehensive delivery coordination for scaling organizations.', 19900, 'USD', 'yearly', 10, 50, '["Up to 10 Workspaces", "Up to 50 Projects per Workspace", "Priority GitHub Webhooks", "Advanced Gemini Insights", "Audit Log Retention", "Team Workload Analytics"]'::jsonb),
    ('onetime', 'Founder Lifetime', 'Single investment for permanent autonomous project coordination.', 49900, 'USD', 'lifetime', 999, 999, '["Unlimited Workspaces", "Unlimited Projects", "Dedicated Support", "Full Gemini Intelligence Access", "All Future Pro Features"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    features = EXCLUDED.features;

CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    payment_provider TEXT DEFAULT 'manual',
    external_customer_id TEXT,
    external_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

INSERT INTO public.promo_codes (code, description, discount_percent, max_uses)
VALUES
    ('LAUNCH50', 'Early Adopter 50% discount on yearly plan', 50, 500),
    ('FOUNDER100', 'Special founder grant invitation code', 100, 50)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_promo UNIQUE (promo_code_id, user_id)
);

-- 9. ATOMIC WORKSPACE PROVISIONING WITH PLAN LIMITS
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

    -- Enforce workspace limit for user (default: 1 on free tier)
    SELECT COUNT(*) INTO v_ws_count
    FROM public.workspaces
    WHERE created_by = v_user_id;

    IF v_ws_count >= 1 THEN
        RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: You have reached the maximum allowed workspaces (1) on the Free plan. Please upgrade your plan to provision additional workspaces.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Ensure profile exists
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

    -- Create workspace
    INSERT INTO public.workspaces (name, slug, created_by)
    VALUES (p_name, lower(trim(p_slug)), v_user_id)
    RETURNING id INTO v_workspace_id;

    -- Assign creator as Admin
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';

    -- Assign initial free subscription
    INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status)
    VALUES (v_workspace_id, 'free', 'active')
    ON CONFLICT (workspace_id) DO NOTHING;

    -- Record activity
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

-- 10. ATOMIC PROJECT CREATION WITH LIMITS & AUTO-MEMBERSHIP
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
    v_max_projects INT := 5; -- default free tier limit
    v_project_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Verify caller is workspace admin or existing member
    IF NOT public.is_workspace_member(p_workspace_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of this workspace';
    END IF;

    -- Query subscription plan limits
    SELECT p.max_projects_per_workspace INTO v_max_projects
    FROM public.workspace_subscriptions ws
    JOIN public.plans p ON ws.plan_id = p.id
    WHERE ws.workspace_id = p_workspace_id AND ws.status = 'active';

    IF v_max_projects IS NULL THEN
        v_max_projects := 5;
    END IF;

    -- Count existing non-archived projects
    SELECT COUNT(*) INTO v_proj_count
    FROM public.projects
    WHERE workspace_id = p_workspace_id AND status != 'archived';

    IF v_proj_count >= v_max_projects THEN
        RAISE EXCEPTION 'PROJECT_LIMIT_EXCEEDED: This workspace has reached its limit of % projects on the current plan. Upgrade to create more projects.', v_max_projects
        USING ERRCODE = 'P0002';
    END IF;

    -- Insert project
    INSERT INTO public.projects (
        workspace_id, name, identifier, description, status, lead_id, start_date, target_date, created_by
    )
    VALUES (
        p_workspace_id, p_name, upper(trim(p_identifier)), p_description, p_status, p_lead_id, p_start_date, p_target_date, v_user_id
    )
    RETURNING id INTO v_project_id;

    -- Auto-enroll creator as project lead
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_project_id, v_user_id, 'lead')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    -- Auto-enroll designated lead if specified
    IF p_lead_id IS NOT NULL AND p_lead_id != v_user_id THEN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_project_id, p_lead_id, 'lead')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
    END IF;

    -- Record activity
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

-- 11. ATOMIC TASK STATUS TRANSITION WITH MANDATORY REASON
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

    -- 1. Validate reason is non-empty
    v_clean_reason := trim(p_reason);
    IF v_clean_reason IS NULL OR length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A meaningful reason (minimum 3 characters) is required for all status transitions.';
    END IF;

    -- 2. Fetch current task
    SELECT t.*, p.identifier as project_identifier
    INTO v_task
    FROM public.tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = p_task_id;

    IF v_task IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    -- 3. Check workspace role
    v_ws_role := public.get_workspace_role(v_task.workspace_id, v_user_id);
    IF v_ws_role IS NULL THEN
        RAISE EXCEPTION 'Access denied: user is not a member of this workspace';
    END IF;

    -- 4. Check if user is lead of the task's assigned team
    IF v_task.team_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.teams
            WHERE id = v_task.team_id AND lead_id = v_user_id
        ) INTO v_is_team_lead;
    END IF;

    -- 5. Permission Enforcement
    -- Finalizing statuses ('Done', 'Cancelled') require workspace admin, team lead (for team tasks), or project lead
    IF p_new_status IN ('Done', 'Cancelled') THEN
        IF v_ws_role != 'admin' AND NOT v_is_team_lead AND v_task.created_by != v_user_id THEN
            -- Check if user is project lead
            IF NOT EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_id = v_task.project_id AND user_id = v_user_id AND role = 'lead'
            ) THEN
                RAISE EXCEPTION 'Only the team leader, project lead, or workspace administrator can finalize tasks (Done/Cancelled).';
            END IF;
        END IF;
    ELSE
        -- Progress updates ('In Progress', 'In Review', 'Blocked', 'Todo') can be made by:
        -- Admin, Team Lead, Project Lead, Assignee, or Creator
        IF v_ws_role != 'admin' AND NOT v_is_team_lead AND v_task.assignee_id != v_user_id AND v_task.created_by != v_user_id THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_id = v_task.project_id AND user_id = v_user_id AND role = 'lead'
            ) THEN
                RAISE EXCEPTION 'Unauthorized: only the assigned member, team leader, or administrator can update this task.';
            END IF;
        END IF;
    END IF;

    -- 6. Atomically update task
    UPDATE public.tasks
    SET
        status = p_new_status,
        status_reason = v_clean_reason,
        status_changed_by = v_user_id,
        status_changed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_task_id;

    -- 7. Append immutable audit event
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

-- 12. ATOMIC TEAM MEMBER TRANSFER FUNCTION (Admin-Only, Safe Historical Preservation)
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

    -- Retrieve source and target teams
    SELECT * INTO v_src FROM public.teams WHERE id = p_source_team_id;
    SELECT * INTO v_tgt FROM public.teams WHERE id = p_target_team_id;

    IF v_src IS NULL OR v_tgt IS NULL THEN
        RAISE EXCEPTION 'Source or target team not found';
    END IF;

    -- Verify workspace administrator authority
    IF public.get_workspace_role(v_src.workspace_id, v_admin_id) != 'admin' THEN
        RAISE EXCEPTION 'Only workspace administrators are authorized to transfer members across teams';
    END IF;

    -- Remove from source team
    DELETE FROM public.team_members
    WHERE team_id = p_source_team_id AND user_id = p_user_id;

    -- Add to target team
    INSERT INTO public.team_members (team_id, user_id, added_by)
    VALUES (p_target_team_id, p_user_id, v_admin_id)
    ON CONFLICT (team_id, user_id) DO NOTHING;

    -- Ensure membership in target project_members
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_tgt.project_id, p_user_id, 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    -- Record audit event
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

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- project_members RLS
CREATE POLICY "Project members viewable by workspace members"
    ON public.project_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_members.project_id
            AND public.is_workspace_member(p.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Project members manageable by workspace admin and project lead"
    ON public.project_members FOR ALL
    TO authenticated
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

-- teams RLS
CREATE POLICY "Teams viewable by workspace members"
    ON public.teams FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Teams insertable by workspace admin and project lead"
    ON public.teams FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_workspace_role(workspace_id, auth.uid()) = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = teams.project_id AND p.lead_id = auth.uid()
        )
    );

CREATE POLICY "Teams updatable by workspace admin, project lead, or team lead"
    ON public.teams FOR UPDATE
    TO authenticated
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
    ON public.teams FOR DELETE
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- team_members RLS
CREATE POLICY "Team members viewable by workspace members"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Team members manageable by workspace admin, project lead, or team lead"
    ON public.team_members FOR ALL
    TO authenticated
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

-- plans RLS
CREATE POLICY "Plans viewable by authenticated users"
    ON public.plans FOR SELECT
    TO authenticated
    USING (true);

-- workspace_subscriptions RLS
CREATE POLICY "Subscriptions viewable by workspace members"
    ON public.workspace_subscriptions FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Subscriptions manageable only by workspace admin"
    ON public.workspace_subscriptions FOR ALL
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- promo_codes RLS
CREATE POLICY "Promo codes viewable by authenticated users"
    ON public.promo_codes FOR SELECT
    TO authenticated
    USING (is_active = true);

-- promo_redemptions RLS
CREATE POLICY "Promo redemptions viewable by workspace members"
    ON public.promo_redemptions FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can redeem promo codes"
    ON public.promo_redemptions FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND public.is_workspace_member(workspace_id, auth.uid())
    );

-- 14. TABLE GRANTS FOR AUTHENTICATED ROLE
GRANT ALL ON public.project_members TO authenticated;
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.team_members TO authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.workspace_subscriptions TO authenticated;
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_redemptions TO authenticated;

-- 15. BACKFILL EXISTING PROJECTS AND WORKSPACES SAFELY
-- Auto-enroll existing project leads & creators into project_members
INSERT INTO public.project_members (project_id, user_id, role)
SELECT id, created_by, 'lead'
FROM public.projects
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO public.project_members (project_id, user_id, role)
SELECT id, lead_id, 'lead'
FROM public.projects
WHERE lead_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Assign free subscription to any workspace lacking one
INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status)
SELECT id, 'free', 'active'
FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;
