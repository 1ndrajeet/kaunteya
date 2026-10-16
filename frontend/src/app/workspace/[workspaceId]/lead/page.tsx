'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Compass,
  Clock,
  CheckSquare,
  AlertCircle,
  Users,
  ArrowRight,
  Plus,
  Calendar,
  Layers,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { TaskDetailData } from '@/features/tasks/task-detail-drawer';

export default function TeamLeadPortalPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user, setIsCreateTaskOpen } = useWorkspace();

  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [assignedToMeCount, setAssignedToMeCount] = useState<number>(0);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) return;

    const loadLeadData = async () => {
      setLoading(true);
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch unassigned tasks
      const { data: unassigned, count: unCount } = await supabase
        .from('tasks')
        .select(`
          id,
          task_number,
          title,
          priority,
          status,
          due_date,
          project:projects ( identifier, name )
        `, { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .is('assignee_id', null)
        .limit(5);

      if (unassigned) setUnassignedTasks(unassigned);
      setUnassignedCount(unCount || 0);

      // 2. Fetch tasks assigned to the Lead
      const { data: mine, count: myCount } = await supabase
        .from('tasks')
        .select(`
          id,
          task_number,
          title,
          priority,
          status,
          due_date,
          project:projects ( identifier, name )
        `, { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('assignee_id', user.id)
        .neq('status', 'Done')
        .limit(5);

      if (mine) setMyTasks(mine);
      setAssignedToMeCount(myCount || 0);

      // 3. Blocked and Overdue queries
      const { count: bCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'Blocked');

      const { count: oCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('status', 'Done')
        .lt('due_date', today);

      setBlockedCount(bCount || 0);
      setOverdueCount(oCount || 0);
      setLoading(false);
    };

    loadLeadData();
  }, [workspaceId, user]);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Compass className="h-6 w-6 text-violet-400" /> Team Lead Execution Portal
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Operations
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Incoming work triage, task routing, blocker resolution, and team execution health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${workspaceId}/incoming`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
          >
            <Clock className="h-3.5 w-3.5" /> Incoming Triage ({unassignedCount})
          </Link>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm shadow-indigo-600/30"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* Execution Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href={`/workspace/${workspaceId}/incoming`}
          className="p-4 rounded-xl border border-amber-900/40 bg-zinc-900/60 hover:border-amber-700/60 transition-colors space-y-1 block"
        >
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Unassigned Awaiting Triage
          </span>
          <div className="text-2xl font-bold text-amber-400">{unassignedCount}</div>
          <span className="text-[10px] text-zinc-500">Requires human routing &rarr;</span>
        </Link>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" /> Assigned to Me
          </span>
          <div className="text-2xl font-bold text-zinc-100">{assignedToMeCount}</div>
          <span className="text-[10px] text-zinc-500 font-mono">Personal commitments</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" /> Blocked Tasks
          </span>
          <div className={`text-2xl font-bold ${blockedCount > 0 ? 'text-rose-400' : 'text-zinc-100'}`}>
            {blockedCount}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Requires unblocking</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1">
          <span className="text-xs text-amber-300 font-medium flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Overdue Tasks
          </span>
          <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-amber-300' : 'text-zinc-100'}`}>
            {overdueCount}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Past deadline</span>
        </div>
      </div>

      {/* Two Column Layout: Triage Focus & Lead Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unassigned Triage Preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" /> Incoming Unassigned Queue
            </h3>
            <Link
              href={`/workspace/${workspaceId}/incoming`}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              Open Triage Inbox &rarr;
            </Link>
          </div>

          <div className="space-y-2.5">
            {unassignedTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                No unassigned tasks awaiting triage.
              </div>
            ) : (
              unassignedTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-semibold">
                        {t.project?.identifier}-{t.task_number}
                      </span>
                      <span className="font-medium text-zinc-200 truncate max-w-[220px]">{t.title}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Project: {t.project?.name}</span>
                  </div>

                  <Link
                    href={`/workspace/${workspaceId}/incoming`}
                    className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] font-medium border border-amber-500/20"
                  >
                    Triage &rarr;
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lead Commitments Preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-indigo-400" /> Tasks Assigned to You
            </h3>
            <Link
              href={`/workspace/${workspaceId}/tasks`}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              View All Tasks &rarr;
            </Link>
          </div>

          <div className="space-y-2.5">
            {myTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                No open tasks currently assigned to you.
              </div>
            ) : (
              myTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-semibold">
                        {t.project?.identifier}-{t.task_number}
                      </span>
                      <span className="font-medium text-zinc-200 truncate max-w-[220px]">{t.title}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Status: {t.status}</span>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {t.priority}
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
