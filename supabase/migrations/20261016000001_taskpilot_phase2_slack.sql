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
