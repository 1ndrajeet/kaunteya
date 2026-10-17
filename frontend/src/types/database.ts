export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = 'admin' | 'lead' | 'member';
export type ProjectStatus = 'active' | 'completed' | 'paused' | 'archived';
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          github_username?: string | null;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          github_username?: string | null;
          display_name?: string;
          avatar_url?: string | null;
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
          created_by?: string;
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
export type ProjectRepository = Tables<'project_repositories'>;
export type Task = Tables<'tasks'>;
export type TaskComment = Tables<'task_comments'>;
export type ActivityEvent = Tables<'activity_events'>;
export type SlackInstallation = Tables<'slack_installations'>;
export type SlackInstallationSecret = Tables<'slack_installation_secrets'>;
export type SlackUserMapping = Tables<'slack_user_mappings'>;
export type SlackConversation = Tables<'slack_conversations'>;
export type IntegrationEvent = Tables<'integration_events'>;
export type TaskFollowup = Tables<'task_followups'>;
export type ExternalMessage = Tables<'external_messages'>;
export type Priority = TaskPriority;
