'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckSquare,
  Layers,
  Users,
  Mail,
  ShieldCheck,
  GitBranch,
  Calendar,
  Filter,
  Search,
  Loader2,
  ChevronRight,
  User,
  Info,
  GitPullRequest,
  Bot,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { ActivityEvent } from '@/types/database';

interface ActivityItem extends ActivityEvent {
  actor?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export default function WorkspaceActivityPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role } = useWorkspace();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchActivities = async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('activity_events')
      .select(`
        id,
        workspace_id,
        actor_id,
        entity_type,
        entity_id,
        event_type,
        metadata,
        created_at,
        actor:profiles!activity_events_actor_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterType !== 'all') {
      query = query.eq('entity_type', filterType);
    }

    const { data, error } = await query;

    if (!error && data) {
      setActivities(data as unknown as ActivityItem[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
  }, [workspaceId, filterType]);

  const filteredActivities = activities.filter((act) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const actorName = act.actor?.display_name?.toLowerCase() || '';
    const eventType = act.event_type.toLowerCase();
    const metaStr = JSON.stringify(act.metadata).toLowerCase();
    return actorName.includes(q) || eventType.includes(q) || metaStr.includes(q);
  });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'task':
        return <CheckSquare className="h-4 w-4 text-indigo-400" />;
      case 'project':
        return <Layers className="h-4 w-4 text-violet-400" />;
      case 'workspace_member':
        return <Users className="h-4 w-4 text-emerald-400" />;
      case 'workspace_invitation':
        return <Mail className="h-4 w-4 text-amber-400" />;
      case 'workspace':
        return <ShieldCheck className="h-4 w-4 text-sky-400" />;
      case 'slack_installation':
      case 'slack_mapping':
      case 'slack':
        return (
          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
        );
      case 'github_installation':
      case 'github_repository':
      case 'github_mapping':
      case 'github':
        return <GitPullRequest className="h-4 w-4 text-purple-400" />;
      case 'work_claim':
        return <ShieldCheck className="h-4 w-4 text-purple-400" />;
      case 'routing_decision':
        return <Bot className="h-4 w-4 text-indigo-400" />;
      default:
        return <Activity className="h-4 w-4 text-zinc-400" />;
    }
  };

  const formatEventSummary = (act: ActivityItem) => {
    const meta = (act.metadata && typeof act.metadata === 'object' && !Array.isArray(act.metadata) ? act.metadata : {}) as Record<string, any>;
    const isSlack = meta.source === 'slack' || meta.origin === 'slack';

    switch (act.event_type) {
      case 'created':
        if (act.entity_type === 'task') {
          return isSlack
            ? `created task "${meta.title || 'Untitled'}" via Slack bot`
            : `created task "${meta.title || 'Untitled'}"`;
        }
        if (act.entity_type === 'project') return `created project "${meta.name || 'Untitled'}"`;
        if (act.entity_type === 'workspace') return `initialized workspace "${meta.name}"`;
        return `created ${act.entity_type}`;

      case 'status_changed':
        return isSlack
          ? `changed status from "${meta.old_status}" to "${meta.new_status}" via Slack`
          : `changed status from "${meta.old_status}" to "${meta.new_status}"`;

      case 'assigned':
        return meta.assignee_id ? `assigned task to member` : `unassigned task`;

      case 'reassigned':
        return `reassigned task`;

      case 'priority_changed':
        return `updated priority to "${meta.priority}"`;

      case 'comment_added':
        return isSlack ? `posted progress update from Slack` : `commented on task`;

      case 'role_updated':
        return `updated member role to "${meta.new_role}"`;

      case 'member_joined':
        return `joined the workspace as ${meta.role || 'member'}`;

      case 'invite_created':
        return `generated an invitation code for role "${meta.role}"`;

      case 'repository_linked':
        return `linked repository ${meta.repository_url || ''}`;

      case 'repository_unlinked':
        return `unlinked repository ${meta.repository_url || ''}`;

      case 'slack_connected':
        return `connected Slack workspace "${meta.team_name || meta.team_id || ''}"`;

      case 'slack_disconnected':
        return `disconnected Slack workspace integration`;

      case 'slack_identity_linked':
        return `linked Slack user @${meta.slack_user_id || ''} to TaskPilot member`;

      case 'slack_identity_unlinked':
        return `unlinked Slack identity`;

      case 'followup_sent':
        return `sent automated progress follow-up via Slack`;

      case 'followup_responded':
        return `received progress update via Slack`;

      case 'github_connected':
        return `connected GitHub App (account: ${meta.github_account_login || 'organization'})`;

      case 'github_disconnected':
        return `disconnected GitHub App integration`;

      case 'github_identity_linked':
        return `linked GitHub user @${meta.github_login || ''} to TaskPilot member`;

      case 'github_identity_unlinked':
        return `unlinked GitHub identity for ${meta.member_name || 'member'}`;

      case 'repository_associated':
        return `associated GitHub repository ${meta.repository_name || ''} with project`;

      case 'repository_unassociated':
        return `unassociated GitHub repository ${meta.repository_name || ''}`;

      case 'evidence_sync_completed':
        return `synchronized GitHub evidence: ${meta.prs_synced ?? 0} PRs, ${meta.commits_synced ?? 0} commits, ${meta.checks_synced ?? 0} checks`;

      case 'evidence_sync_failed':
        return `GitHub evidence sync encountered an error: ${meta.error || 'Check logs'}`;

      case 'work_claim_submitted':
        return `submitted work claim for ${meta.task_identifier || 'task'} (${meta.claim_type?.replace(/_/g, ' ') || 'work'})`;

      case 'claim_reviewed':
        return `reviewed work claim for ${meta.task_identifier || 'task'}: outcome "${meta.new_state || meta.review_state || 'completed'}"`;

      case 'routing_recommendation_generated':
        return `generated intelligent routing recommendation (${meta.method || 'agent'})`;

      case 'updated':
        return `updated ${act.entity_type} properties`;

      default:
        return `${act.event_type} on ${act.entity_type}`;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-[#23170E] flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#DC6E26]" /> Audit Trail &amp; Activity
          </h1>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Tamper-evident record of workspace operations, membership changes, task assignments, and project milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#F2ECE1] border border-[#E4DBC9] text-[#736251]">
            {activities.length} recorded events
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-xs">
        {/* Entity Type Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Activities' },
            { id: 'task', label: 'Tasks' },
            { id: 'project', label: 'Projects' },
            { id: 'workspace_member', label: 'Team & Roles' },
            { id: 'workspace_invitation', label: 'Invitations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${filterType === tab.id
                ? 'bg-[#DC6E26] text-white shadow-xs font-semibold'
                : 'text-[#736251] hover:text-[#23170E] hover:bg-[#F2ECE1]'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#736251]" />
          <input
            type="text"
            placeholder="Search events or actors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#23170E] placeholder:text-[#736251] focus:outline-none focus:border-[#DC6E26]"
          />
        </div>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#736251] font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#DC6E26]" />
          <span>Loading audit history...</span>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-[#E3DAC8] text-center space-y-2">
          <Activity className="h-8 w-8 text-[#736251] mx-auto" />
          <h3 className="text-sm font-serif font-semibold text-[#23170E]">No activity events found</h3>
          <p className="text-xs text-[#736251]">
            {searchQuery ? 'Try clearing your search query.' : 'Activity will be recorded here as work progresses.'}
          </p>
        </div>
      ) : (
        <div className="relative border-l border-[#E3DAC8] ml-4 sm:ml-6 pl-6 space-y-6">
          {filteredActivities.map((act) => {
            const isExpanded = expandedId === act.id;
            const actorName = act.actor?.display_name || 'System';
            const dateObj = new Date(act.created_at);

            return (
              <div key={act.id} className="relative group">
                {/* Timeline Dot with Entity Icon */}
                <div className="absolute -left-[35px] top-1 h-7 w-7 rounded-lg bg-[#FAF7F2] border border-[#E3DAC8] flex items-center justify-center shadow-xs">
                  {getEntityIcon(act.entity_type)}
                </div>

                <div className="p-4 rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/50 hover:bg-[#F2ECE1] transition-colors space-y-2 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#23170E] flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[#DC6E26]" />
                        {actorName}
                      </span>
                      <span className="text-[#6E5D4E]">{formatEventSummary(act)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#736251] font-mono">
                      <span>{dateObj.toLocaleDateString()}</span>
                      <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Metadata preview and toggle */}
                  {act.metadata && Object.keys(act.metadata).length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : act.id)}
                        className="text-[11px] font-mono text-[#736251] hover:text-[#DC6E26] flex items-center gap-1 transition-colors"
                      >
                        <Info className="h-3 w-3" />
                        <span>{isExpanded ? 'Hide Payload' : 'Inspect JSON Payload'}</span>
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-3 rounded-lg bg-[#F2ECE1] border border-[#E4DBC9] font-mono text-[11px] text-[#23170E] overflow-x-auto">
                          {JSON.stringify(act.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
