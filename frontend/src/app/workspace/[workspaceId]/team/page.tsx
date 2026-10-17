'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Users, CheckSquare, Clock, CheckCircle2, AlertCircle, Loader2 } from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';

interface MemberWorkload {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  totalAssigned: number;
  inProgressCount: number;
  completedCount: number;
}

export default function TeamWorkloadPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role } = useWorkspace();

  const [workloads, setWorkloads] = useState<MemberWorkload[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadWorkload = async () => {
      setLoading(true);
      const supabase = createClient();

      // 1. Fetch workspace members
      const { data: memData } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          role,
          profiles:user_id (
            display_name,
            avatar_url,
            email
          )
        `)
        .eq('workspace_id', workspaceId);

      // 2. Fetch all tasks for workload calculation
      const { data: taskData } = await supabase
        .from('tasks')
        .select('assignee_id, status')
        .eq('workspace_id', workspaceId);

      if (memData) {
        const compiled: MemberWorkload[] = memData.map((m: any) => {
          const userTasks = (taskData || []).filter((t) => t.assignee_id === m.user_id);
          const inProgress = userTasks.filter((t) => t.status === 'In Progress' || t.status === 'Todo').length;
          const completed = userTasks.filter((t) => t.status === 'Done').length;

          return {
            user_id: m.user_id,
            role: m.role,
            display_name: m.profiles?.display_name || m.user_id.slice(0, 8),
            avatar_url: m.profiles?.avatar_url || null,
            email: m.profiles?.email || null,
            totalAssigned: userTasks.length,
            inProgressCount: inProgress,
            completedCount: completed,
          };
        });

        // Sort by active workload descending
        compiled.sort((a, b) => b.inProgressCount - a.inProgressCount);
        setWorkloads(compiled);
      }

      setLoading(false);
    };

    loadWorkload();
  }, [workspaceId]);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-400" /> Team Workload &amp; Delivery
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time assignment distribution to identify capacity, avoid bottlenecks, and balance commitments.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <span>Calculating team workload metrics...</span>
        </div>
      ) : workloads.length === 0 ? (
        <div className="text-center py-12 text-xs text-zinc-600 font-mono">
          No members found in this workspace.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workloads.map((member) => (
            <div
              key={member.user_id}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4 hover:border-zinc-700 transition-colors shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      member.display_name[0]?.toUpperCase() || 'M'
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-100">{member.display_name}</h3>
                    <span className="text-[10px] text-zinc-500 font-mono">{member.email}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded ${
                    member.role === 'lead'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : member.role === 'admin'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {member.role}
                </span>
              </div>

              {/* Workload Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-center">
                <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Active</span>
                  <div className="text-base font-bold text-indigo-400 mt-0.5">{member.inProgressCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Done</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">{member.completedCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Total</span>
                  <div className="text-base font-bold text-zinc-200 mt-0.5">{member.totalAssigned}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-zinc-400">
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3 text-indigo-400" /> Current Capacity:
                </span>
                <span
                  className={`font-mono font-semibold ${
                    member.inProgressCount >= 5
                      ? 'text-rose-400'
                      : member.inProgressCount >= 3
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {member.inProgressCount >= 5 ? 'High Load' : member.inProgressCount >= 3 ? 'Moderate' : 'Available'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
