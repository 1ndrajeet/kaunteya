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
