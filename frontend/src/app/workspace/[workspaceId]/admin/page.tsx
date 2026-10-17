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
} from '@/components/ui/pica-icons';
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
    // Only load admin dashboard metrics if the user has verified admin role
    if (!role) return;

    if (role !== 'admin') {
      setLoading(false);
      return;
    }

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
  }, [workspaceId, role]);

  // RBAC: If role is not admin, render proper authorization guard
  if (role && role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-[#FCF3E3] text-[#D68B1C] flex items-center justify-center mx-auto border border-[#F1DCBA]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-[#23170E]">Administrator Access Required</h2>
          <p className="text-xs text-[#6E5D4E] max-w-md">
            You are signed in as a <span className="font-mono text-[#DC6E26] uppercase font-semibold">{role}</span>. The administration portal is restricted to workspace administrators.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {role === 'lead' && (
            <Link
              href={`/workspace/${workspaceId}/lead`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Compass className="h-4 w-4" /> Go to Team Lead Portal
            </Link>
          )}
          {role === 'member' && (
            <Link
              href={`/workspace/${workspaceId}/member`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <CheckSquare className="h-4 w-4" /> Go to My Tasks
            </Link>
          )}
          <Link
            href={`/workspace/${workspaceId}/tasks`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] hover:bg-[#EFE9DF] text-[#23170E] text-xs font-semibold transition-colors"
          >
            Workspace Tasks
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !stats.totalMembers) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#736251] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[#DC6E26]" />
        <span className="text-xs font-mono">Loading administration metrics...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Admin Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#23170E] flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-[#DC6E26]" /> Administration Portal
            </h1>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#FBECE1] text-[#9A410D] border border-[#F3D5BE]">
              Governance
            </span>
          </div>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Top-level workspace management, team lead designations, member access, and system health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${workspaceId}/admin/team`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors shadow-2xs"
          >
            <Users className="h-3.5 w-3.5 text-[#DC6E26]" /> Manage Team
          </Link>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Projects */}
        <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-[#6E5D4E] flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-[#DC6E26]" /> Projects
          </span>
          <div className="text-2xl font-bold text-[#23170E]">{stats.totalProjects}</div>
          <span className="text-[10px] text-[#736251] font-mono">Active tracking</span>
        </div>

        {/* Open Tasks */}
        <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-[#6E5D4E] flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5 text-[#DC6E26]" /> Open Tasks
          </span>
          <div className="text-2xl font-bold text-[#23170E]">{stats.openTasks}</div>
          <span className="text-[10px] text-[#736251] font-mono">In pipeline</span>
        </div>

        {/* Unassigned Tasks */}
        <div className="p-4 rounded-2xl border border-[#F1DCBA] bg-[#FCF3E3]/60 space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-[#D68B1C] flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Unassigned
          </span>
          <div className="text-2xl font-bold text-[#D68B1C]">{stats.unassignedTasks}</div>
          <Link
            href={`/workspace/${workspaceId}/incoming`}
            className="text-[10px] text-[#A86407] hover:underline flex items-center gap-0.5 font-medium"
          >
            Triage queue &rarr;
          </Link>
        </div>

        {/* Overdue */}
        <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-[#6E5D4E] flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-[#B33624]" /> Overdue
          </span>
          <div className={`text-2xl font-bold ${stats.overdueTasks > 0 ? 'text-[#B33624]' : 'text-[#23170E]'}`}>
            {stats.overdueTasks}
          </div>
          <span className="text-[10px] text-[#736251] font-mono">Needs attention</span>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-[#6E5D4E] flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-[#5E9E2E]" /> Completed
          </span>
          <div className="text-2xl font-bold text-[#4F8E27]">{stats.completedTasks}</div>
          <span className="text-[10px] text-[#736251] font-mono">Verified work</span>
        </div>

        {/* Team Members */}
        <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-[#6E5D4E] flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#824B23]" /> Members
          </span>
          <div className="text-2xl font-bold text-[#23170E]">{stats.totalMembers}</div>
          <span className="text-[10px] text-[#736251] font-mono">1 designated lead</span>
        </div>
      </div>

      {/* Governance & Team Lead Box */}
      <div className="p-5 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#824B23]" />
            <h3 className="text-sm font-semibold text-[#23170E]">Designated Team Lead</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F5ECE4] text-[#592F11] border border-[#E6D3C3] font-semibold">
              Enforced by Database
            </span>
          </div>
          <p className="text-xs text-[#6E5D4E]">
            {leadMember ? (
              <>
                Current lead is <strong className="text-[#23170E]">{leadMember.display_name}</strong>. The lead is
                responsible for triaging incoming requests and directing daily delivery.
              </>
            ) : (
              <span className="text-[#D68B1C]">
                No designated team lead configured yet. Please assign a team lead to unblock routing.
              </span>
            )}
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/admin/team`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#824B23] hover:bg-[#6B3C1A] text-white text-xs font-semibold transition-colors shrink-0 shadow-xs"
        >
          {leadMember ? 'Reassign Lead' : 'Designate Lead'} &rarr;
        </Link>
      </div>

      {/* Two Column Layout: Quick Actions & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Management Links */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#6E5D4E] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#DC6E26]" /> Administrative Operations
          </h3>

          <div className="space-y-2.5">
            <Link
              href={`/workspace/${workspaceId}/projects`}
              className="group p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/60 hover:shadow-md transition-all flex items-center justify-between shadow-2xs"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-[#23170E] group-hover:text-[#DC6E26] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#DC6E26]" /> Project Management
                </span>
                <p className="text-[11px] text-[#6E5D4E]">
                  Create, edit, or archive workspace projects and associate GitHub repository links.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#736251] group-hover:text-[#DC6E26] transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href={`/workspace/${workspaceId}/admin/team`}
              className="group p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/60 hover:shadow-md transition-all flex items-center justify-between shadow-2xs"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-[#23170E] group-hover:text-[#DC6E26] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#824B23]" /> Member Invitations &amp; Roles
                </span>
                <p className="text-[11px] text-[#6E5D4E]">
                  Generate secure invite codes, inspect joined members, and adjust workspace roles.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#736251] group-hover:text-[#DC6E26] transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href={`/workspace/${workspaceId}/tasks`}
              className="group p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/60 hover:shadow-md transition-all flex items-center justify-between shadow-2xs"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-[#23170E] group-hover:text-[#DC6E26] flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[#5E9E2E]" /> Global Tasks Oversight
                </span>
                <p className="text-[11px] text-[#6E5D4E]">
                  Inspect the unified Kanban and list views across all projects with full administrative access.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#736251] group-hover:text-[#DC6E26] transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Recent Audit Trail Log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#6E5D4E] uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#DC6E26]" /> Recent Audit Trail
            </h3>
            <Link
              href={`/workspace/${workspaceId}/activity`}
              className="text-[11px] text-[#DC6E26] hover:underline font-medium"
            >
              View Full Log &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] p-3 space-y-2 max-h-[280px] overflow-y-auto shadow-2xs">
            {activities.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#736251] font-mono">No recent activity recorded.</div>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl border border-[#E4DBC9] bg-[#F2ECE1]/60 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[#23170E] font-medium">
                      <span className="text-[#6E5D4E] font-normal">
                        {act.actor?.display_name || 'System'}:
                      </span>
                      <span className="text-[#DC6E26] font-mono text-[11px]">
                        {act.entity_type} {act.event_type}
                      </span>
                    </div>
                    {act.metadata?.task_identifier && (
                      <span className="text-[10px] font-mono text-[#736251]">
                        Task: {act.metadata.task_identifier}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#736251] shrink-0">
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
