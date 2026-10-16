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
} from 'lucide-react';
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
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
        );
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-400" /> Audit Trail & Activity
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Tamper-evident record of workspace operations, membership changes, task assignments, and project milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            {activities.length} recorded events
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
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
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search events or actors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span>Loading audit history...</span>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
          <Activity className="h-8 w-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">No activity events found</h3>
          <p className="text-xs text-zinc-500">
            {searchQuery ? 'Try clearing your search query.' : 'Activity will be recorded here as work progresses.'}
          </p>
        </div>
      ) : (
        <div className="relative border-l border-zinc-800/80 ml-4 sm:ml-6 pl-6 space-y-6">
          {filteredActivities.map((act) => {
            const isExpanded = expandedId === act.id;
            const actorName = act.actor?.display_name || 'System';
            const dateObj = new Date(act.created_at);

            return (
              <div key={act.id} className="relative group">
                {/* Timeline Dot with Entity Icon */}
                <div className="absolute -left-[35px] top-1 h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-md">
                  {getEntityIcon(act.entity_type)}
                </div>

                <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-indigo-400" />
                        {actorName}
                      </span>
                      <span className="text-zinc-400">{formatEventSummary(act)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                      <span>{dateObj.toLocaleDateString()}</span>
                      <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Metadata preview and toggle */}
                  {act.metadata && Object.keys(act.metadata).length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : act.id)}
                        className="text-[11px] font-mono text-zinc-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                      >
                        <Info className="h-3 w-3" />
                        <span>{isExpanded ? 'Hide Payload' : 'Inspect JSON Payload'}</span>
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto">
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
