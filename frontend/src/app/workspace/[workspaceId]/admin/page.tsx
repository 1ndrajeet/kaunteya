'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Layers,
  CheckSquare,
  Clock,
  AlertCircle,
  Users,
  Compass,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  GitBranch,
  Calendar,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';

interface AdminStats {
  totalProjects: number;
  openTasks: number;
  completedTasks: number;
  unassignedTasks: number;
  overdueTasks: number;
  totalMembers: number;
}

interface RecentActivity {
  id: string;
  actor_id: string | null;
  entity_type: string;
  event_type: string;
  metadata: any;
  created_at: string;
  actor?: {
    display_name: string;
  } | null;
}

export default function AdminPortalPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, workspaceName, workspaceSlug, setIsCreateTaskOpen } = useWorkspace();

  const [stats, setStats] = useState<AdminStats>({
    totalProjects: 0,
    openTasks: 0,
    completedTasks: 0,
    unassignedTasks: 0,
    overdueTasks: 0,
    totalMembers: 0,
  });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [leadMember, setLeadMember] = useState<{ id: string; display_name: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      const supabase = createClient();

      // 1. Projects count
      const { count: projCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      // 2. Tasks metrics
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('id, status, assignee_id, due_date')
        .eq('workspace_id', workspaceId);

      let openCount = 0;
      let completedCount = 0;
      let unassignedCount = 0;
      let overdueCount = 0;
      const today = new Date().toISOString().split('T')[0];

      if (allTasks) {
        allTasks.forEach((t) => {
          if (t.status === 'Done') {
            completedCount++;
          } else if (t.status !== 'Cancelled') {
            openCount++;
            if (!t.assignee_id) unassignedCount++;
            if (t.due_date && t.due_date < today) overdueCount++;
          }
        });
      }

      // 3. Members & designated lead
      const { data: memData } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            display_name
          )
        `)
        .eq('workspace_id', workspaceId);

      let designatedLead = null;
      if (memData) {
        const foundLead = memData.find((m: any) => m.role === 'lead');
        if (foundLead) {
          designatedLead = {
            id: foundLead.user_id,
            display_name: (foundLead as any).profiles?.display_name || 'Designated Lead',
          };
        }
      }

      // 4. Recent activity log
      const { data: actData } = await supabase
        .from('activity_events')
        .select(`
          id,
          actor_id,
          entity_type,
          event_type,
          metadata,
          created_at,
          actor:profiles!activity_events_actor_id_fkey (
            display_name
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(6);

      setStats({
        totalProjects: projCount || 0,
        openTasks: openCount,
        completedTasks: completedCount,
        unassignedTasks: unassignedCount,
        overdueTasks: overdueCount,
        totalMembers: memData?.length || 0,
      });

      setLeadMember(designatedLead);
      if (actData) setActivities(actData as unknown as RecentActivity[]);
      setLoading(false);
    };

    loadDashboardData();
  }, [workspaceId]);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Admin Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-indigo-400" /> Administration Portal
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Governance
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Top-level workspace management, team lead designations, member access, and system health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${workspaceId}/admin/team`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-indigo-400" /> Manage Team
          </Link>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm shadow-indigo-600/30"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Projects */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
            <Layers className="h-3 w-3 text-indigo-400" /> Projects
          </span>
          <div className="text-2xl font-bold text-zinc-100">{stats.totalProjects}</div>
          <span className="text-[10px] text-zinc-500 font-mono">Active tracking</span>
        </div>

        {/* Open Tasks */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
            <CheckSquare className="h-3 w-3 text-indigo-400" /> Open Tasks
          </span>
          <div className="text-2xl font-bold text-zinc-100">{stats.openTasks}</div>
          <span className="text-[10px] text-zinc-500 font-mono">In pipeline</span>
        </div>

        {/* Unassigned Tasks */}
        <div className="p-4 rounded-xl border border-amber-900/40 bg-zinc-900/60 space-y-1">
          <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Unassigned
          </span>
          <div className="text-2xl font-bold text-amber-400">{stats.unassignedTasks}</div>
          <Link
            href={`/workspace/${workspaceId}/incoming`}
            className="text-[10px] text-amber-300/80 hover:underline flex items-center gap-0.5"
          >
            Triage queue &rarr;
          </Link>
        </div>

        {/* Overdue */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-rose-400" /> Overdue
          </span>
          <div className={`text-2xl font-bold ${stats.overdueTasks > 0 ? 'text-rose-400' : 'text-zinc-100'}`}>
            {stats.overdueTasks}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Needs attention</span>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-400" /> Completed
          </span>
          <div className="text-2xl font-bold text-emerald-400">{stats.completedTasks}</div>
          <span className="text-[10px] text-zinc-500 font-mono">Verified work</span>
        </div>

        {/* Team Members */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
            <Users className="h-3 w-3 text-violet-400" /> Members
          </span>
          <div className="text-2xl font-bold text-zinc-100">{stats.totalMembers}</div>
          <span className="text-[10px] text-zinc-500 font-mono">1 designated lead</span>
        </div>
      </div>

      {/* Governance & Team Lead Box */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Designated Team Lead</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">
              Enforced by Database
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {leadMember ? (
              <>
                Current lead is <strong className="text-zinc-200">{leadMember.display_name}</strong>. The lead is
                responsible for triaging incoming requests and directing daily delivery.
              </>
            ) : (
              <span className="text-amber-400">
                No designated team lead configured yet. Please assign a team lead to unblock routing.
              </span>
            )}
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/admin/team`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors shrink-0"
        >
          {leadMember ? 'Reassign Lead' : 'Designate Lead'} &rarr;
        </Link>
      </div>

      {/* Two Column Layout: Quick Actions & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Management Links */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Administrative Operations
          </h3>

          <div className="space-y-2.5">
            <Link
              href={`/workspace/${workspaceId}/projects`}
              className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-zinc-200 group-hover:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-400" /> Project Management
                </span>
                <p className="text-[11px] text-zinc-400">
                  Create, edit, or archive workspace projects and associate GitHub repository links.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href={`/workspace/${workspaceId}/admin/team`}
              className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-zinc-200 group-hover:text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-400" /> Member Invitations &amp; Roles
                </span>
                <p className="text-[11px] text-zinc-400">
                  Generate secure invite codes, inspect joined members, and adjust workspace roles.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href={`/workspace/${workspaceId}/tasks`}
              className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-zinc-200 group-hover:text-white flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-400" /> Global Tasks Oversight
                </span>
                <p className="text-[11px] text-zinc-400">
                  Inspect the unified Kanban and list views across all projects with full administrative access.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Recent Audit Trail Log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-indigo-400" /> Recent Audit Trail
            </h3>
            <Link
              href={`/workspace/${workspaceId}/activity`}
              className="text-[11px] text-indigo-400 hover:underline"
            >
              View Full Log &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2 max-h-[280px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-600 font-mono">No recent activity recorded.</div>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/50 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                      <span className="text-zinc-400 font-normal">
                        {act.actor?.display_name || 'System'}:
                      </span>
                      <span className="text-indigo-300 font-mono text-[11px]">
                        {act.entity_type} {act.event_type}
                      </span>
                    </div>
                    {act.metadata?.task_identifier && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        Task: {act.metadata.task_identifier}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
