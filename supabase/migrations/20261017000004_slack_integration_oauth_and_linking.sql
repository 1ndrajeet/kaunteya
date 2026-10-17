-- ==============================================================================
-- Migration: 20261017000004_slack_integration_oauth_and_linking.sql
-- Description: Slack OAuth 2.0 State Tracking & Secure Member Linking Challenges
-- ==============================================================================

-- 1. SLACK OAUTH STATES
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

-- 2. SLACK LINK CHALLENGES (for linking Slack user ID to TaskPilot member via code)
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

-- 3. ROW LEVEL SECURITY
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

-- Grants
GRANT ALL ON TABLE public.slack_oauth_states TO service_role;
GRANT ALL ON TABLE public.slack_link_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.slack_oauth_states TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.slack_link_challenges TO authenticated;
