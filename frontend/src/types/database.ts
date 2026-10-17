export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = 'admin' | 'lead' | 'member';
export type ProjectStatus = 'planning' | 'active' | 'at_risk' | 'completed' | 'paused' | 'archived';
export type ProjectAssignmentType = 'individual' | 'team';
export type ProjectMemberRole = 'lead' | 'member';
export type TeamStatus = 'active' | 'archived';
export type PlanInterval = 'free' | 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export type ProjectDeadlineStatus =
  | 'deadline_approaching'
  | 'closing_soon'
  | 'overdue'
  | 'completed_on_time'
  | 'completed_late'
  | 'no_deadline'
  | 'on_track';

export function getProjectDeadlineStatus(project: {
  target_date?: string | null;
  completed_at?: string | null;
  status: ProjectStatus;
}): {
  status: ProjectDeadlineStatus;
  label: string;
  badgeClass: string;
} {
  // If project is completed
  if (project.status === 'completed') {
    if (!project.target_date) {
      return {
        status: 'on_track',
        label: 'Completed',
        badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      };
    }
    const target = new Date(project.target_date).getTime();
    const completed = project.completed_at ? new Date(project.completed_at).getTime() : Date.now();
    // Allow end of target date (86400000ms buffer)
    if (completed <= target + 86400000) {
      return {
        status: 'completed_on_time',
        label: 'Completed On Time',
        badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      };
    }
    return {
      status: 'completed_late',
      label: 'Completed Late',
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };
  }

  // If archived or paused
  if (project.status === 'archived' || project.status === 'paused') {
    return {
      status: 'no_deadline',
      label: project.status === 'archived' ? 'Archived' : 'Paused',
      badgeClass: 'text-zinc-400 bg-zinc-800/80 border-zinc-700/50',
    };
  }

  if (!project.target_date) {
    return {
      status: 'no_deadline',
      label: 'No Deadline',
      badgeClass: 'text-zinc-500 bg-zinc-900 border-zinc-800',
    };
  }

  const now = Date.now();
  const target = new Date(project.target_date).getTime();
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'overdue',
      label: `Overdue (${Math.abs(diffDays)}d)`,
      badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
  }
  if (diffDays <= 3) {
    return {
      status: 'closing_soon',
      label: `Closing Soon (${diffDays}d)`,
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };
  }
  if (diffDays <= 7) {
    return {
      status: 'deadline_approaching',
      label: `Due in ${diffDays}d`,
      badgeClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    };
  }
  return {
    status: 'on_track',
    label: `On Track (${diffDays}d left)`,
    badgeClass: 'text-zinc-300 bg-zinc-800/60 border-zinc-700/40',
  };
}

export type TaskStatus =
  | 'Backlog'
  | 'Todo'
  | 'In Progress'
  | 'In Review'
  | 'Blocked'
  | 'Done'
  | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type SlackInstallationStatus = 'active' | 'disconnected' | 'error';
export type SlackMappingStatus = 'linked' | 'pending' | 'unlinked';
export type SlackConversationType = 'public_channel' | 'private_channel' | 'im' | 'mpim';
export type SlackConversationPurpose = 'intake' | 'notifications' | 'general';
export type IntegrationProcessingStatus = 'received' | 'processed' | 'ignored' | 'failed';
export type FollowupStatus = 'pending' | 'sent' | 'responded' | 'cancelled' | 'failed';
export type ExternalMessageType = 'task_intake' | 'followup_sent' | 'followup_reply' | 'notification' | 'clarification';

// Phase 3 GitHub, Evidence & Routing Enums
export type GithubInstallationStatus = 'active' | 'suspended' | 'disconnected' | 'revoked' | 'error';
export type GithubSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
export type EvidenceArtifactType = 'pull_request' | 'commit' | 'review' | 'check_run' | 'issue';
export type ArtifactMatchMethod = 'explicit_task_id' | 'branch_name' | 'claim_url' | 'ai_match' | 'manual';
export type ClaimType =
  | 'implementation'
  | 'bug_fix'
  | 'code_review'
  | 'test_coverage'
  | 'documentation'
  | 'progress_update'
  | 'completion';
export type ClaimReviewState =
  | 'pending'
  | 'supported'
  | 'partially_supported'
  | 'unverified'
  | 'needs_clarification'
  | 'disputed';
export type RoutingDecisionMethod = 'deterministic' | 'agent_proposal' | 'human_override';
export type RoutingDecisionOutcome =
  | 'assigned'
  | 'lead_triage'
  | 'clarification_requested'
  | 'rejected'
  | 'overridden';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          github_username: string | null;
          display_name: string;
          avatar_url: string | null;
          workspaces_created_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          github_username?: string | null;
          display_name: string;
          avatar_url?: string | null;
          workspaces_created_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          github_username?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          workspaces_created_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: WorkspaceRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      workspace_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          invited_by: string;
          code: string;
          role: 'lead' | 'member';
          max_uses: number;
          uses_count: number;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          invited_by: string;
          code: string;
          role?: 'lead' | 'member';
          max_uses?: number;
          uses_count?: number;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          invited_by?: string;
          code?: string;
          role?: 'lead' | 'member';
          max_uses?: number;
          uses_count?: number;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          identifier: string;
          description: string | null;
          status: ProjectStatus;
          lead_id: string | null;
          start_date: string | null;
          target_date: string | null;
          completed_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          identifier: string;
          description?: string | null;
          status?: ProjectStatus;
          lead_id?: string | null;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          identifier?: string;
          description?: string | null;
          status?: ProjectStatus;
          lead_id?: string | null;
          start_date?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: ProjectMemberRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: ProjectMemberRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: ProjectMemberRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          slug: string;
          description: string | null;
          lead_id: string | null;
          status: TeamStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          slug: string;
          description?: string | null;
          lead_id?: string | null;
          status?: TeamStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          lead_id?: string | null;
          status?: TeamStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          added_by: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          added_by?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          added_by?: string | null;
          joined_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_cents: number;
          currency: string;
          billing_interval: PlanInterval;
          max_workspaces: number;
          max_projects_per_workspace: number;
          features: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          billing_interval: PlanInterval;
          max_workspaces?: number;
          max_projects_per_workspace?: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          billing_interval?: PlanInterval;
          max_workspaces?: number;
          max_projects_per_workspace?: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          current_period_start: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          payment_provider: string | null;
          external_customer_id: string | null;
          external_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          current_period_start?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          payment_provider?: string | null;
          external_customer_id?: string | null;
          external_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          current_period_start?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          payment_provider?: string | null;
          external_customer_id?: string | null;
          external_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_percent: number | null;
          discount_amount_cents: number | null;
          max_uses: number;
          uses_count: number;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_percent?: number | null;
          discount_amount_cents?: number | null;
          max_uses?: number;
          uses_count?: number;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_percent?: number | null;
          discount_amount_cents?: number | null;
          max_uses?: number;
          uses_count?: number;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      promo_redemptions: {
        Row: {
          id: string;
          promo_code_id: string;
          workspace_id: string;
          user_id: string;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          promo_code_id: string;
          workspace_id: string;
          user_id: string;
          redeemed_at?: string;
        };
        Update: {
          id?: string;
          promo_code_id?: string;
          workspace_id?: string;
          user_id?: string;
          redeemed_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          razorpay_signature: string | null;
          amount_paise: number;
          currency: string;
          status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
          plan_id: string;
          receipt: string | null;
          notes: Json;
          error_code: string | null;
          error_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          razorpay_signature?: string | null;
          amount_paise?: number;
          currency?: string;
          status?: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
          plan_id?: string;
          receipt?: string | null;
          notes?: Json;
          error_code?: string | null;
          error_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workspace_id?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          razorpay_signature?: string | null;
          amount_paise?: number;
          currency?: string;
          status?: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
          plan_id?: string;
          receipt?: string | null;
          notes?: Json;
          error_code?: string | null;
          error_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_entitlements: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'expired' | 'cancelled';
          max_workspaces: number;
          valid_from: string;
          valid_until: string;
          payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id?: string;
          status?: 'active' | 'expired' | 'cancelled';
          max_workspaces?: number;
          valid_from?: string;
          valid_until: string;
          payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: 'active' | 'expired' | 'cancelled';
          max_workspaces?: number;
          valid_from?: string;
          valid_until?: string;
          payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_repositories: {
        Row: {
          id: string;
          project_id: string;
          repository_url: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          repository_url: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          repository_url?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          task_number: number;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          assignee_id: string | null;
          assignment_type: ProjectAssignmentType;
          team_id: string | null;
          status_reason: string | null;
          status_changed_by: string | null;
          status_changed_at: string | null;
          created_by: string;
          due_date: string | null;
          source: string;
          slack_channel_id: string | null;
          slack_message_ts: string | null;
          slack_thread_ts: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          task_number: number;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          assignee_id?: string | null;
          assignment_type?: ProjectAssignmentType;
          team_id?: string | null;
          status_reason?: string | null;
          status_changed_by?: string | null;
          status_changed_at?: string | null;
          created_by: string;
          due_date?: string | null;
          source?: string;
          slack_channel_id?: string | null;
          slack_message_ts?: string | null;
          slack_thread_ts?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          task_number?: number;
          title?: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          assignee_id?: string | null;
          assignment_type?: ProjectAssignmentType;
          team_id?: string | null;
          status_reason?: string | null;
          status_changed_by?: string | null;
          status_changed_at?: string | null;
          created_by?: string;
          due_date?: string | null;
          source?: string;
          slack_channel_id?: string | null;
          slack_message_ts?: string | null;
          slack_thread_ts?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          workspace_id: string;
          actor_id: string | null;
          entity_type: string;
          entity_id: string;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_id?: string | null;
          entity_type: string;
          entity_id: string;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          actor_id?: string | null;
          entity_type?: string;
          entity_id?: string;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      slack_installations: {
        Row: {
          id: string;
          workspace_id: string;
          slack_team_id: string;
          slack_team_name: string;
          bot_user_id: string;
          default_channel_id: string | null;
          notification_channel_id: string | null;
          installation_status: SlackInstallationStatus;
          followup_frequency_hours: number;
          auto_followup_enabled: boolean;
          connected_by: string | null;
          connected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          slack_team_id: string;
          slack_team_name: string;
          bot_user_id: string;
          default_channel_id?: string | null;
          notification_channel_id?: string | null;
          installation_status?: SlackInstallationStatus;
          followup_frequency_hours?: number;
          auto_followup_enabled?: boolean;
          connected_by?: string | null;
          connected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          slack_team_id?: string;
          slack_team_name?: string;
          bot_user_id?: string;
          default_channel_id?: string | null;
          notification_channel_id?: string | null;
          installation_status?: SlackInstallationStatus;
          followup_frequency_hours?: number;
          auto_followup_enabled?: boolean;
          connected_by?: string | null;
          connected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      slack_installation_secrets: {
        Row: {
          id: string;
          installation_id: string;
          bot_token: string;
          signing_secret: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          installation_id: string;
          bot_token: string;
          signing_secret?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          installation_id?: string;
          bot_token?: string;
          signing_secret?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      slack_user_mappings: {
        Row: {
          id: string;
          installation_id: string;
          workspace_id: string;
          slack_user_id: string;
          slack_username: string | null;
          slack_real_name: string | null;
          slack_email: string | null;
          taskpilot_user_id: string;
          link_status: SlackMappingStatus;
          linked_by: string | null;
          linked_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          installation_id: string;
          workspace_id: string;
          slack_user_id: string;
          slack_username?: string | null;
          slack_real_name?: string | null;
          slack_email?: string | null;
          taskpilot_user_id: string;
          link_status?: SlackMappingStatus;
          linked_by?: string | null;
          linked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          installation_id?: string;
          workspace_id?: string;
          slack_user_id?: string;
          slack_username?: string | null;
          slack_real_name?: string | null;
          slack_email?: string | null;
          taskpilot_user_id?: string;
          link_status?: SlackMappingStatus;
          linked_by?: string | null;
          linked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      slack_conversations: {
        Row: {
          id: string;
          installation_id: string;
          workspace_id: string;
          slack_conversation_id: string;
          conversation_name: string | null;
          conversation_type: SlackConversationType;
          purpose: SlackConversationPurpose;
          created_at: string;
        };
        Insert: {
          id?: string;
          installation_id: string;
          workspace_id: string;
          slack_conversation_id: string;
          conversation_name?: string | null;
          conversation_type?: SlackConversationType;
          purpose?: SlackConversationPurpose;
          created_at?: string;
        };
        Update: {
          id?: string;
          installation_id?: string;
          workspace_id?: string;
          slack_conversation_id?: string;
          conversation_name?: string | null;
          conversation_type?: SlackConversationType;
          purpose?: SlackConversationPurpose;
          created_at?: string;
        };
        Relationships: [];
      };
      slack_oauth_states: {
        Row: {
          id: string;
          state_token: string;
          workspace_id: string;
          initiated_by: string;
          action: 'install' | 'link';
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          state_token: string;
          workspace_id: string;
          initiated_by: string;
          action?: 'install' | 'link';
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          state_token?: string;
          workspace_id?: string;
          initiated_by?: string;
          action?: 'install' | 'link';
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      slack_link_challenges: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          challenge_code: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          challenge_code: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          challenge_code?: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      integration_events: {
        Row: {
          id: string;
          provider: string;
          installation_id: string | null;
          workspace_id: string | null;
          external_event_id: string;
          event_type: string;
          processing_status: IntegrationProcessingStatus;
          error_code: string | null;
          error_summary: string | null;
          metadata: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          provider?: string;
          installation_id?: string | null;
          workspace_id?: string | null;
          external_event_id: string;
          event_type: string;
          processing_status?: IntegrationProcessingStatus;
          error_code?: string | null;
          error_summary?: string | null;
          metadata?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          installation_id?: string | null;
          workspace_id?: string | null;
          external_event_id?: string;
          event_type?: string;
          processing_status?: IntegrationProcessingStatus;
          error_code?: string | null;
          error_summary?: string | null;
          metadata?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      task_followups: {
        Row: {
          id: string;
          workspace_id: string;
          task_id: string;
          recipient_user_id: string;
          slack_user_id: string;
          channel_type: 'im' | 'channel' | 'thread';
          scheduled_at: string;
          sent_at: string | null;
          responded_at: string | null;
          status: FollowupStatus;
          attempt_count: number;
          external_message_id: string | null;
          external_conversation_id: string | null;
          last_error_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          task_id: string;
          recipient_user_id: string;
          slack_user_id: string;
          channel_type?: 'im' | 'channel' | 'thread';
          scheduled_at: string;
          sent_at?: string | null;
          responded_at?: string | null;
          status?: FollowupStatus;
          attempt_count?: number;
          external_message_id?: string | null;
          external_conversation_id?: string | null;
          last_error_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          task_id?: string;
          recipient_user_id?: string;
          slack_user_id?: string;
          channel_type?: 'im' | 'channel' | 'thread';
          scheduled_at?: string;
          sent_at?: string | null;
          responded_at?: string | null;
          status?: FollowupStatus;
          attempt_count?: number;
          external_message_id?: string | null;
          external_conversation_id?: string | null;
          last_error_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      external_messages: {
        Row: {
          id: string;
          workspace_id: string;
          installation_id: string;
          task_id: string | null;
          external_conversation_id: string;
          external_message_id: string;
          external_thread_id: string | null;
          sender_mapping_id: string | null;
          message_type: ExternalMessageType;
          body_snippet: string | null;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          installation_id: string;
          task_id?: string | null;
          external_conversation_id: string;
          external_message_id: string;
          external_thread_id?: string | null;
          sender_mapping_id?: string | null;
          message_type?: ExternalMessageType;
          body_snippet?: string | null;
          processed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          installation_id?: string;
          task_id?: string | null;
          external_conversation_id?: string;
          external_message_id?: string;
          external_thread_id?: string | null;
          sender_mapping_id?: string | null;
          message_type?: ExternalMessageType;
          body_snippet?: string | null;
          processed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      github_oauth_states: {
        Row: {
          id: string;
          state_token: string;
          workspace_id: string;
          initiated_by: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          state_token: string;
          workspace_id: string;
          initiated_by: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          state_token?: string;
          workspace_id?: string;
          initiated_by?: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      github_installations: {
        Row: {
          id: string;
          workspace_id: string;
          github_installation_id: number;
          account_login: string;
          account_type: 'User' | 'Organization';
          account_avatar_url: string | null;
          connection_status: GithubInstallationStatus;
          rate_limit_remaining: number | null;
          rate_limit_reset_at: string | null;
          last_error_code: string | null;
          permissions: Json;
          installed_by: string | null;
          installed_at: string;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          github_installation_id: number;
          account_login: string;
          account_type?: 'User' | 'Organization';
          account_avatar_url?: string | null;
          connection_status?: GithubInstallationStatus;
          rate_limit_remaining?: number | null;
          rate_limit_reset_at?: string | null;
          last_error_code?: string | null;
          permissions?: Json;
          installed_by?: string | null;
          installed_at?: string;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          github_installation_id?: number;
          account_login?: string;
          account_type?: 'User' | 'Organization';
          account_avatar_url?: string | null;
          connection_status?: GithubInstallationStatus;
          rate_limit_remaining?: number | null;
          rate_limit_reset_at?: string | null;
          last_error_code?: string | null;
          permissions?: Json;
          installed_by?: string | null;
          installed_at?: string;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      github_installation_secrets: {
        Row: {
          id: string;
          installation_id: string;
          app_id: string | null;
          private_key: string | null;
          webhook_secret: string | null;
          personal_access_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          installation_id: string;
          app_id?: string | null;
          private_key?: string | null;
          webhook_secret?: string | null;
          personal_access_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          installation_id?: string;
          app_id?: string | null;
          private_key?: string | null;
          webhook_secret?: string | null;
          personal_access_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      github_repositories: {
        Row: {
          id: string;
          workspace_id: string;
          installation_id: string | null;
          project_id: string | null;
          github_repo_id: number;
          name: string;
          full_name: string;
          repo_url: string;
          description: string | null;
          primary_language: string | null;
          languages: Json;
          topics: string[];
          stars_count: number;
          forks_count: number;
          open_issues_count: number;
          readme_content: string | null;
          package_manifests: Json;
          is_private: boolean;
          default_branch: string;
          is_enabled: boolean;
          last_sync_at: string | null;
          sync_status: GithubSyncStatus;
          sync_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          installation_id?: string | null;
          project_id?: string | null;
          github_repo_id: number;
          name: string;
          full_name: string;
          repo_url: string;
          description?: string | null;
          primary_language?: string | null;
          languages?: Json;
          topics?: string[];
          stars_count?: number;
          forks_count?: number;
          open_issues_count?: number;
          readme_content?: string | null;
          package_manifests?: Json;
          is_private?: boolean;
          default_branch?: string;
          is_enabled?: boolean;
          last_sync_at?: string | null;
          sync_status?: GithubSyncStatus;
          sync_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          installation_id?: string | null;
          project_id?: string | null;
          github_repo_id?: number;
          name?: string;
          full_name?: string;
          repo_url?: string;
          description?: string | null;
          primary_language?: string | null;
          languages?: Json;
          topics?: string[];
          stars_count?: number;
          forks_count?: number;
          open_issues_count?: number;
          readme_content?: string | null;
          package_manifests?: Json;
          is_private?: boolean;
          default_branch?: string;
          is_enabled?: boolean;
          last_sync_at?: string | null;
          sync_status?: GithubSyncStatus;
          sync_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      github_repository_contributors: {
        Row: {
          id: string;
          workspace_id: string;
          repository_id: string;
          github_user_id: number;
          login: string;
          avatar_url: string | null;
          html_url: string | null;
          contributions_count: number;
          taskpilot_user_id: string | null;
          last_activity_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          repository_id: string;
          github_user_id: number;
          login: string;
          avatar_url?: string | null;
          html_url?: string | null;
          contributions_count?: number;
          taskpilot_user_id?: string | null;
          last_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          repository_id?: string;
          github_user_id?: number;
          login?: string;
          avatar_url?: string | null;
          html_url?: string | null;
          contributions_count?: number;
          taskpilot_user_id?: string | null;
          last_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_ai_contexts: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          repository_id: string | null;
          task_name: string;
          provider: string;
          model_id: string;
          prompt_version: string;
          schema_version: string;
          status: 'pending' | 'completed' | 'failed';
          evidence_fingerprint: string;
          referenced_artifact_ids: string[];
          structured_output: Json;
          error_category: string | null;
          error_summary: string | null;
          usage_metadata: Json;
          analyzed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          repository_id?: string | null;
          task_name?: string;
          provider?: string;
          model_id: string;
          prompt_version: string;
          schema_version: string;
          status?: 'pending' | 'completed' | 'failed';
          evidence_fingerprint: string;
          referenced_artifact_ids?: string[];
          structured_output?: Json;
          error_category?: string | null;
          error_summary?: string | null;
          usage_metadata?: Json;
          analyzed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          repository_id?: string | null;
          task_name?: string;
          provider?: string;
          model_id?: string;
          prompt_version?: string;
          schema_version?: string;
          status?: 'pending' | 'completed' | 'failed';
          evidence_fingerprint?: string;
          referenced_artifact_ids?: string[];
          structured_output?: Json;
          error_category?: string | null;
          error_summary?: string | null;
          usage_metadata?: Json;
          analyzed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      github_user_mappings: {
        Row: {
          id: string;
          workspace_id: string;
          taskpilot_user_id: string;
          github_user_id: number;
          github_login: string;
          link_status: 'linked' | 'pending' | 'unlinked';
          linked_by: string | null;
          linked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          taskpilot_user_id: string;
          github_user_id: number;
          github_login: string;
          link_status?: 'linked' | 'pending' | 'unlinked';
          linked_by?: string | null;
          linked_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          taskpilot_user_id?: string;
          github_user_id?: number;
          github_login?: string;
          link_status?: 'linked' | 'pending' | 'unlinked';
          linked_by?: string | null;
          linked_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      github_events: {
        Row: {
          id: string;
          delivery_id: string;
          event_type: string;
          installation_id: number | null;
          repository_id: number | null;
          processing_status: 'received' | 'processed' | 'ignored' | 'failed';
          error_code: string | null;
          error_summary: string | null;
          payload_summary: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          event_type: string;
          installation_id?: number | null;
          repository_id?: number | null;
          processing_status?: 'received' | 'processed' | 'ignored' | 'failed';
          error_code?: string | null;
          error_summary?: string | null;
          payload_summary?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          delivery_id?: string;
          event_type?: string;
          installation_id?: number | null;
          repository_id?: number | null;
          processing_status?: 'received' | 'processed' | 'ignored' | 'failed';
          error_code?: string | null;
          error_summary?: string | null;
          payload_summary?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      evidence_artifacts: {
        Row: {
          id: string;
          workspace_id: string;
          repository_id: string;
          artifact_type: EvidenceArtifactType;
          external_id: string;
          title: string | null;
          source_url: string;
          author_login: string | null;
          author_github_id: number | null;
          commit_sha: string | null;
          head_branch: string | null;
          base_branch: string | null;
          artifact_state: string;
          is_merged: boolean;
          merged_at: string | null;
          check_conclusion: string | null;
          task_id: string | null;
          matched_task_identifier: string | null;
          match_method: ArtifactMatchMethod;
          metadata: Json;
          created_at_external: string | null;
          updated_at_external: string | null;
          last_sync_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          repository_id: string;
          artifact_type: EvidenceArtifactType;
          external_id: string;
          title?: string | null;
          source_url: string;
          author_login?: string | null;
          author_github_id?: number | null;
          commit_sha?: string | null;
          head_branch?: string | null;
          base_branch?: string | null;
          artifact_state?: string;
          is_merged?: boolean;
          merged_at?: string | null;
          check_conclusion?: string | null;
          task_id?: string | null;
          matched_task_identifier?: string | null;
          match_method?: ArtifactMatchMethod;
          metadata?: Json;
          created_at_external?: string | null;
          updated_at_external?: string | null;
          last_sync_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          repository_id?: string;
          artifact_type?: EvidenceArtifactType;
          external_id?: string;
          title?: string | null;
          source_url?: string;
          author_login?: string | null;
          author_github_id?: number | null;
          commit_sha?: string | null;
          head_branch?: string | null;
          base_branch?: string | null;
          artifact_state?: string;
          is_merged?: boolean;
          merged_at?: string | null;
          check_conclusion?: string | null;
          task_id?: string | null;
          matched_task_identifier?: string | null;
          match_method?: ArtifactMatchMethod;
          metadata?: Json;
          created_at_external?: string | null;
          updated_at_external?: string | null;
          last_sync_at?: string;
        };
        Relationships: [];
      };
      work_claims: {
        Row: {
          id: string;
          workspace_id: string;
          task_id: string;
          claimant_id: string;
          claim_source: 'dashboard' | 'slack_followup' | 'slack_command';
          claim_text: string;
          claim_type: ClaimType;
          pr_url_hint: string | null;
          review_state: ClaimReviewState;
          reviewer_id: string | null;
          reviewed_at: string | null;
          review_rationale: string | null;
          assessment_summary: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          task_id: string;
          claimant_id: string;
          claim_source?: 'dashboard' | 'slack_followup' | 'slack_command';
          claim_text: string;
          claim_type?: ClaimType;
          pr_url_hint?: string | null;
          review_state?: ClaimReviewState;
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          review_rationale?: string | null;
          assessment_summary?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          task_id?: string;
          claimant_id?: string;
          claim_source?: 'dashboard' | 'slack_followup' | 'slack_command';
          claim_text?: string;
          claim_type?: ClaimType;
          pr_url_hint?: string | null;
          review_state?: ClaimReviewState;
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          review_rationale?: string | null;
          assessment_summary?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      claim_evidence_associations: {
        Row: {
          id: string;
          claim_id: string;
          artifact_id: string;
          relevance_note: string | null;
          associated_by: 'system' | 'ai_matcher' | 'reviewer' | 'claimant';
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          artifact_id: string;
          relevance_note?: string | null;
          associated_by?: 'system' | 'ai_matcher' | 'reviewer' | 'claimant';
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          artifact_id?: string;
          relevance_note?: string | null;
          associated_by?: 'system' | 'ai_matcher' | 'reviewer' | 'claimant';
          created_at?: string;
        };
        Relationships: [];
      };
      routing_decisions: {
        Row: {
          id: string;
          workspace_id: string;
          task_id: string;
          request_source: 'slack' | 'web_ui' | 'api';
          decision_version: string;
          proposed_project_id: string | null;
          proposed_assignee_id: string | null;
          selected_outcome: RoutingDecisionOutcome;
          decision_method: RoutingDecisionMethod;
          rule_code: string | null;
          rationale: string;
          confidence: 'high' | 'medium' | 'low';
          human_intervention_needed: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          task_id: string;
          request_source?: 'slack' | 'web_ui' | 'api';
          decision_version?: string;
          proposed_project_id?: string | null;
          proposed_assignee_id?: string | null;
          selected_outcome: RoutingDecisionOutcome;
          decision_method?: RoutingDecisionMethod;
          rule_code?: string | null;
          rationale: string;
          confidence?: 'high' | 'medium' | 'low';
          human_intervention_needed?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          task_id?: string;
          request_source?: 'slack' | 'web_ui' | 'api';
          decision_version?: string;
          proposed_project_id?: string | null;
          proposed_assignee_id?: string | null;
          selected_outcome?: RoutingDecisionOutcome;
          decision_method?: RoutingDecisionMethod;
          rule_code?: string | null;
          rationale?: string;
          confidence?: 'high' | 'medium' | 'low';
          human_intervention_needed?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_workspace_with_admin: {
        Args: {
          p_name: string;
          p_slug: string;
        };
        Returns: {
          id: string;
          name: string;
          slug: string;
          role: string;
        };
      };
      join_workspace_with_invite: {
        Args: {
          p_code: string;
        };
        Returns: {
          workspace_id: string;
          name: string;
          slug: string;
          role: string;
        };
      };
      create_project_with_limits: {
        Args: {
          p_workspace_id: string;
          p_name: string;
          p_identifier: string;
          p_description?: string | null;
          p_status?: string;
          p_lead_id?: string | null;
          p_start_date?: string | null;
          p_target_date?: string | null;
          p_github_repo_id?: number | null;
        };
        Returns: {
          id: string;
          workspace_id: string;
          name: string;
          identifier: string;
          status: string;
          repository_id?: string;
          repository_full_name?: string;
        };
      };
      update_task_status_with_reason: {
        Args: {
          p_task_id: string;
          p_new_status: string;
          p_reason: string;
        };
        Returns: {
          id: string;
          status: string;
          status_reason: string;
          status_changed_by: string;
          status_changed_at: string;
        };
      };
      move_team_member: {
        Args: {
          p_source_team_id: string;
          p_target_team_id: string;
          p_user_id: string;
        };
        Returns: {
          success: boolean;
          user_id: string;
          new_team_id: string;
        };
      };
      get_next_task_number: {
        Args: {
          p_project_id: string;
        };
        Returns: number;
      };
      is_workspace_member: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      get_workspace_role: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
        };
        Returns: string | null;
      };
    };
    Enums: {
      workspace_role: WorkspaceRole;
      project_status: ProjectStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      slack_installation_status: SlackInstallationStatus;
      slack_mapping_status: SlackMappingStatus;
      slack_conversation_type: SlackConversationType;
      slack_conversation_purpose: SlackConversationPurpose;
      integration_processing_status: IntegrationProcessingStatus;
      followup_status: FollowupStatus;
      external_message_type: ExternalMessageType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience export types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Profile = Tables<'profiles'>;
export type Workspace = Tables<'workspaces'>;
export type WorkspaceMember = Tables<'workspace_members'>;
export type WorkspaceInvitation = Tables<'workspace_invitations'>;
export type Project = Tables<'projects'>;
export type ProjectMember = Tables<'project_members'>;
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;
export type Plan = Tables<'plans'>;
export type WorkspaceSubscription = Tables<'workspace_subscriptions'>;
export type PromoCode = Tables<'promo_codes'>;
export type PromoRedemption = Tables<'promo_redemptions'>;
export type Payment = Tables<'payments'>;
export type UserEntitlement = Tables<'user_entitlements'>;
export type ProjectRepository = Tables<'project_repositories'>;
export type Task = Tables<'tasks'>;
export type TaskComment = Tables<'task_comments'>;
export type ActivityEvent = Tables<'activity_events'>;
export type SlackInstallation = Tables<'slack_installations'>;
export type SlackInstallationSecret = Tables<'slack_installation_secrets'>;
export type SlackUserMapping = Tables<'slack_user_mappings'>;
export type SlackConversation = Tables<'slack_conversations'>;
export type SlackOAuthState = Tables<'slack_oauth_states'>;
export type SlackLinkChallenge = Tables<'slack_link_challenges'>;
export type IntegrationEvent = Tables<'integration_events'>;
export type TaskFollowup = Tables<'task_followups'>;
export type ExternalMessage = Tables<'external_messages'>;
export type Priority = TaskPriority;

// Phase 3 & Stage 1 GitHub Intelligence & Gemini Convenience Types
export type GithubInstallation = Tables<'github_installations'>;
export type GithubInstallationSecret = Tables<'github_installation_secrets'>;
export type GithubRepository = Tables<'github_repositories'>;
export type GithubUserMapping = Tables<'github_user_mappings'>;
export type GithubEvent = Tables<'github_events'>;
export type EvidenceArtifact = Tables<'evidence_artifacts'>;
export type WorkClaim = Tables<'work_claims'>;
export type ClaimEvidenceAssociation = Tables<'claim_evidence_associations'>;
export type RoutingDecisionRecord = Tables<'routing_decisions'>;
export type GithubOAuthState = Tables<'github_oauth_states'>;
export type GithubRepositoryContributor = Tables<'github_repository_contributors'>;
export type ProjectAiContext = Tables<'project_ai_contexts'>;

