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
