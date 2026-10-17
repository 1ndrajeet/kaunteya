-- ==============================================================================
-- TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform
-- Migration: 20261016000000_taskpilot_initial_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES TABLE (Mirrored from auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    github_username TEXT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'lead', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

-- Enforce strictly at most ONE designated team lead per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_lead_per_workspace
    ON public.workspace_members (workspace_id)
    WHERE role = 'lead';

-- 5. WORKSPACE INVITATIONS TABLE
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

-- 6. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
    lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE,
    target_date DATE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_project_identifier UNIQUE (workspace_id, identifier)
);

-- 7. PROJECT REPOSITORIES TABLE
CREATE TABLE IF NOT EXISTS public.project_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    repository_url TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_repository UNIQUE (project_id, repository_url)
);

-- 8. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Todo' CHECK (status IN ('Backlog', 'Todo', 'In Progress', 'In Review', 'Blocked', 'Done', 'Cancelled')),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    due_date DATE,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_task_number UNIQUE (project_id, task_number)
);

-- 9. TASK COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. ACTIVITY EVENTS TABLE (Audit Trail)
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
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks (priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_workspace ON public.activity_events (workspace_id, created_at DESC);

-- ==============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (Avoid RLS Recursion)
-- ==============================================================================

-- Helper: Check if user is a member of the workspace
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

-- Helper: Retrieve user's role in a workspace
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

-- Helper: Auto-increment task numbers per project
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

-- Secure Workspace Provisioning: Creates workspace and assigns creator as admin transactionally
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
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', split_part(auth.jwt() ->> 'email', '@', 1), 'User'),
        auth.jwt() -> 'user_metadata' ->> 'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        updated_at = timezone('utc'::text, now());

    -- Create workspace
    INSERT INTO public.workspaces (name, slug, created_by)
    VALUES (p_name, lower(trim(p_slug)), v_user_id)
    RETURNING id INTO v_workspace_id;

    -- Assign creator as Admin
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin');

    -- Record activity
    INSERT INTO public.activity_events (workspace_id, actor_id, entity_type, entity_id, event_type, metadata)
    VALUES (v_workspace_id, v_user_id, 'workspace', v_workspace_id, 'created', jsonb_build_object('name', p_name, 'slug', p_slug));

    SELECT jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'slug', w.slug,
        'role', 'admin'
    ) INTO v_result
    FROM public.workspaces w
    WHERE w.id = v_workspace_id;

    RETURN v_result;
END;
$$;

-- Secure Invitation Redemption: Allows joining a workspace with a valid invite code
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
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Retrieve and validate invite
    SELECT * INTO v_invite
    FROM public.workspace_invitations
    WHERE code = trim(p_code)
      AND expires_at > now()
      AND uses_count < max_uses;

    IF v_invite IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invitation code';
    END IF;

    -- Check if user is already a member
    SELECT * INTO v_existing_member
    FROM public.workspace_members
    WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id;

    IF v_existing_member IS NOT NULL THEN
        RAISE EXCEPTION 'User is already a member of this workspace';
    END IF;

    -- If invitation is for 'lead', verify no lead currently exists
    IF v_invite.role = 'lead' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = v_invite.workspace_id AND role = 'lead'
        ) INTO v_lead_exists;

        IF v_lead_exists THEN
            RAISE EXCEPTION 'This workspace already has a designated team lead. Contact your administrator.';
        END IF;
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', split_part(auth.jwt() ->> 'email', '@', 1), 'User'),
        auth.jwt() -> 'user_metadata' ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Add member
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role);

    -- Increment usage
    UPDATE public.workspace_invitations
    SET uses_count = uses_count + 1
    WHERE id = v_invite.id;

    -- Record activity
    INSERT INTO public.activity_events (workspace_id, actor_id, entity_type, entity_id, event_type, metadata)
    VALUES (v_invite.workspace_id, v_user_id, 'member', v_user_id, 'joined', jsonb_build_object('role', v_invite.role, 'code', p_code));

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

-- User Profile Sync Trigger from auth.users
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
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), 'User'),
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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Profiles viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- WORKSPACES
CREATE POLICY "Workspaces viewable by workspace members"
    ON public.workspaces FOR SELECT
    TO authenticated
    USING (
        public.is_workspace_member(id, auth.uid()) OR created_by = auth.uid()
    );

CREATE POLICY "Workspaces updatable only by workspace admin"
    ON public.workspaces FOR UPDATE
    TO authenticated
    USING (public.get_workspace_role(id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(id, auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can create workspaces"
    ON public.workspaces FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- WORKSPACE MEMBERS
CREATE POLICY "Workspace members viewable by members of that workspace"
    ON public.workspace_members FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can manage member roles and memberships"
    ON public.workspace_members FOR ALL
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- WORKSPACE INVITATIONS
CREATE POLICY "Workspace invitations viewable by workspace admins and leads"
    ON public.workspace_invitations FOR SELECT
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Workspace invitations manageable only by workspace admin"
    ON public.workspace_invitations FOR ALL
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- PROJECTS
CREATE POLICY "Projects viewable by workspace members"
    ON public.projects FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Projects insertable and updatable by admin and lead"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead')
    );

CREATE POLICY "Projects updatable by admin and lead"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

CREATE POLICY "Projects deletable only by admin"
    ON public.projects FOR DELETE
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- PROJECT REPOSITORIES
CREATE POLICY "Project repositories viewable by workspace members"
    ON public.project_repositories FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_repositories.project_id
              AND public.is_workspace_member(p.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Project repositories manageable by admin and lead"
    ON public.project_repositories FOR ALL
    TO authenticated
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

-- TASKS
CREATE POLICY "Tasks viewable by workspace members"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Tasks insertable by workspace members"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid())
        AND auth.uid() = created_by
    );

CREATE POLICY "Tasks updatable by admins, leads, and assigned members"
    ON public.tasks FOR UPDATE
    TO authenticated
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
            OR (
                -- Ordinary members can update status and description of tasks assigned to them
                assignee_id = auth.uid()
                -- Cannot change workspace_id or project_id
            )
            OR created_by = auth.uid()
        )
    );

CREATE POLICY "Tasks deletable by admin and lead"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

-- TASK COMMENTS
CREATE POLICY "Task comments viewable by workspace members"
    ON public.task_comments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_comments.task_id
              AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Task comments insertable by workspace members"
    ON public.task_comments FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_comments.task_id
              AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
    );

CREATE POLICY "Task comments updatable and deletable by comment author"
    ON public.task_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Task comments deletable by author or workspace admin"
    ON public.task_comments FOR DELETE
    TO authenticated
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_comments.task_id
              AND public.get_workspace_role(t.workspace_id, auth.uid()) = 'admin'
        )
    );

-- ACTIVITY EVENTS (Audit Trail - Strictly Read-Only for Members, Append-Only for System/Members)
CREATE POLICY "Activity events viewable by workspace members"
    ON public.activity_events FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Activity events appendable by workspace members"
    ON public.activity_events FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid())
        AND (actor_id IS NULL OR actor_id = auth.uid())
    );

-- No UPDATE or DELETE policies on activity_events (Immutable audit history)


-- ==============================================================================
-- TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform
-- Migration: 20261016000001_taskpilot_phase2_slack.sql
-- Description: Phase 2 Slack Integration, Conversational Intake, Identity Mapping & Follow-up
-- ==============================================================================

-- 1. EXTEND TASKS TABLE WITH SLACK CONTEXT
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
    ADD COLUMN IF NOT EXISTS slack_message_ts TEXT,
    ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;

-- 2. SLACK INSTALLATIONS TABLE
CREATE TABLE IF NOT EXISTS public.slack_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slack_team_id TEXT NOT NULL,
    slack_team_name TEXT NOT NULL,
    bot_user_id TEXT NOT NULL,
    default_channel_id TEXT,
    notification_channel_id TEXT,
    installation_status TEXT NOT NULL DEFAULT 'active' CHECK (installation_status IN ('active', 'disconnected', 'error')),
    followup_frequency_hours INT NOT NULL DEFAULT 24,
    auto_followup_enabled BOOLEAN NOT NULL DEFAULT true,
    connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_slack_team UNIQUE (workspace_id, slack_team_id)
);

-- 3. SLACK INSTALLATION SECRETS TABLE (Locked to Service-Role / Backend only)
CREATE TABLE IF NOT EXISTS public.slack_installation_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE UNIQUE,
    bot_token TEXT NOT NULL,
    signing_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. SLACK USER MAPPINGS TABLE (Associates Slack identities with TaskPilot members)
CREATE TABLE IF NOT EXISTS public.slack_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    slack_username TEXT,
    slack_real_name TEXT,
    slack_email TEXT,
    taskpilot_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    link_status TEXT NOT NULL DEFAULT 'linked' CHECK (link_status IN ('linked', 'pending', 'unlinked')),
    linked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_slack_user UNIQUE (workspace_id, slack_user_id)
);

-- 5. SLACK CONVERSATIONS TABLE (Configured Channels)
CREATE TABLE IF NOT EXISTS public.slack_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slack_conversation_id TEXT NOT NULL,
    conversation_name TEXT,
    conversation_type TEXT NOT NULL DEFAULT 'public_channel' CHECK (conversation_type IN ('public_channel', 'private_channel', 'im', 'mpim')),
    purpose TEXT NOT NULL DEFAULT 'intake' CHECK (purpose IN ('intake', 'notifications', 'general')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_slack_conv UNIQUE (installation_id, slack_conversation_id)
);

-- 6. INTEGRATION EVENTS TABLE (Idempotency & External Event Ingestion Audit)
CREATE TABLE IF NOT EXISTS public.integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'slack',
    installation_id UUID REFERENCES public.slack_installations(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    external_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
    error_code TEXT,
    error_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_external_event UNIQUE (provider, external_event_id)
);

-- 7. TASK FOLLOW-UPS TABLE (Scheduled & Completed Progress Reminders)
CREATE TABLE IF NOT EXISTS public.task_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    channel_type TEXT NOT NULL DEFAULT 'im' CHECK (channel_type IN ('im', 'channel', 'thread')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'cancelled', 'failed')),
    attempt_count INT NOT NULL DEFAULT 0,
    external_message_id TEXT,
    external_conversation_id TEXT,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. EXTERNAL MESSAGES TABLE (Thread & Message Context Correlation)
CREATE TABLE IF NOT EXISTS public.external_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES public.slack_installations(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    external_conversation_id TEXT NOT NULL,
    external_message_id TEXT NOT NULL,
    external_thread_id TEXT,
    sender_mapping_id UUID REFERENCES public.slack_user_mappings(id) ON DELETE SET NULL,
    message_type TEXT NOT NULL DEFAULT 'task_intake' CHECK (message_type IN ('task_intake', 'followup_sent', 'followup_reply', 'notification', 'clarification')),
    body_snippet TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_ext_msg UNIQUE (installation_id, external_conversation_id, external_message_id)
);

-- ==============================================================================
-- INDEXES FOR PHASE 2 PERFORMANCE
-- ==============================================================================
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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.slack_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_installation_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_messages ENABLE ROW LEVEL SECURITY;

-- 1. slack_installations
-- Workspace members can view installation status (does not contain secrets)
CREATE POLICY "Members can view workspace slack installations"
    ON public.slack_installations FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Only Admins can manage slack installations
CREATE POLICY "Admins can manage workspace slack installations"
    ON public.slack_installations FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- 2. slack_installation_secrets
-- Completely locked from client SELECT (no policy allows authenticated user select)
-- Service role bypasses RLS to read bot tokens on the backend.

-- 3. slack_user_mappings
-- Workspace members can view identity mappings
CREATE POLICY "Members can view workspace slack user mappings"
    ON public.slack_user_mappings FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Admins can manage all identity mappings
CREATE POLICY "Admins can manage workspace slack user mappings"
    ON public.slack_user_mappings FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- Users can self-link or update their own mapping
CREATE POLICY "Users can self-manage their own slack mapping"
    ON public.slack_user_mappings FOR UPDATE
    USING (taskpilot_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
    WITH CHECK (taskpilot_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

-- 4. slack_conversations
CREATE POLICY "Members can view slack conversations"
    ON public.slack_conversations FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage slack conversations"
    ON public.slack_conversations FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) = 'admin')
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- 5. integration_events
-- Workspace members can view integration events for debugging / status monitoring
CREATE POLICY "Members can view workspace integration events"
    ON public.integration_events FOR SELECT
    USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

-- Admins can clear / delete logs if needed
CREATE POLICY "Admins can delete integration events"
    ON public.integration_events FOR DELETE
    USING (workspace_id IS NOT NULL AND public.get_workspace_role(workspace_id, auth.uid()) = 'admin');

-- 6. task_followups
-- Admins and Leads can view all follow-ups in the workspace
CREATE POLICY "Admins and Leads can view all workspace followups"
    ON public.task_followups FOR SELECT
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

-- Members can view their own follow-ups
CREATE POLICY "Members can view their assigned followups"
    ON public.task_followups FOR SELECT
    USING (recipient_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

-- Admins and Leads can manage follow-ups
CREATE POLICY "Admins and Leads can manage followups"
    ON public.task_followups FOR ALL
    USING (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'))
    WITH CHECK (public.get_workspace_role(workspace_id, auth.uid()) IN ('admin', 'lead'));

-- 7. external_messages
-- Members can view external messages in their workspace
CREATE POLICY "Members can view workspace external messages"
    ON public.external_messages FOR SELECT
    USING (public.is_workspace_member(workspace_id, auth.uid()));


-- ==============================================================================
-- TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform
-- Migration: 20261016000002_taskpilot_phase3_github_evidence.sql
-- Description: Phase 3 GitHub App Integration, Evidence Intelligence, Work Claims & Routing Decisions
-- ==============================================================================
-- supabase/migrations/20261016000004_add_rls_helper_overloads.sql
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_workspace_member(p_workspace_id, auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.get_workspace_role(p_workspace_id, auth.uid()); $$;
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
-- ==============================================================================
-- Migration: 20261016000003_fix_workspace_rbac_and_grants.sql
-- Description: Auto-assign workspace creator as admin, fix RLS circular dependencies, and ensure table grants.
-- ==============================================================================

-- 1. Ensure Table Privileges for PostgREST Roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- 2. Trigger: Ensure creator is immediately added as Admin on workspace creation
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

-- 3. Robust Workspace Members RLS
DROP POLICY IF EXISTS "Workspace members viewable by members of that workspace" ON public.workspace_members;
CREATE POLICY "Workspace members viewable by members of that workspace"
    ON public.workspace_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_workspace_member(workspace_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id AND w.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Workspace admins can manage member roles and memberships" ON public.workspace_members;
CREATE POLICY "Workspace admins can manage member roles and memberships"
    ON public.workspace_members FOR ALL
    TO authenticated
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

-- 4. Backfill any existing workspaces where the creator is not yet in workspace_members
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT id, created_by, 'admin'
FROM public.workspaces
WHERE created_by IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';





-- 1. Make the function's insert idempotent (fixes the uq_workspace_member collision)
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
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

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

-- 2. Lock anon out of everything (they currently have TRUNCATE)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

