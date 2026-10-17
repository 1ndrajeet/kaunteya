'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Info,
  X,
  ExternalLink,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { getMemberDignityScore } from '@/lib/api';
import type { CalculateScoreResponse } from '@/types';

interface MemberWorkload {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  totalAssigned: number;
  inProgressCount: number;
  completedCount: number;
  dignityScore?: CalculateScoreResponse | null;
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
  const [auditMember, setAuditMember] = useState<MemberWorkload | null>(null);

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
        // Fetch real Dignity Scores concurrently from Phase 3 Backend
        const scorePromises = memData.map((m: any) =>
          getMemberDignityScore(m.user_id, workspaceId).catch(() => null)
        );
        const scores = await Promise.all(scorePromises);

        const compiled: MemberWorkload[] = memData.map((m: any, idx: number) => {
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
            dignityScore: scores[idx],
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
            <Users className="h-6 w-6 text-violet-400" /> Team Workload &amp; Contribution
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time delivery capacity correlated against verifiable evidence-backed contribution scores.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <span>Calculating team workload &amp; contribution metrics...</span>
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

              {/* Phase 4: Contribution & Dignity Score Intelligence */}
              <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Contribution Score
                  </span>
                  <button
                    onClick={() => setAuditMember(member)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
                  >
                    Explainable Audit &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-sans">Accepted Points</span>
                    <span className="text-zinc-100 font-bold text-sm">
                      {member.dignityScore
                        ? `${member.dignityScore.accepted_contribution_points.toFixed(1)} pts`
                        : '0.0 pts'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-sans">Claim Reliability</span>
                    <span className="text-zinc-300 text-[11px] block truncate">
                      {member.dignityScore?.claim_reliability.status === 'insufficient_data'
                        ? 'Insufficient data (<3)'
                        : member.dignityScore?.claim_reliability.score !== null &&
                          member.dignityScore?.claim_reliability.score !== undefined
                        ? `${(member.dignityScore.claim_reliability.score * 100).toFixed(0)}% (${member.dignityScore.claim_reliability.reviewed_claims} rev)`
                        : 'Insufficient data'}
                    </span>
                  </div>
                </div>

                {member.dignityScore && (
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50 text-[10px] text-zinc-500">
                    <span>Eligible Scope: {member.dignityScore.eligible_task_value.toFixed(1)}</span>
                    <span>Progress: {(member.dignityScore.accepted_progress * 100).toFixed(0)}%</span>
                  </div>
                )}
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

      {/* Explainable Audit Breakdown Modal */}
      {auditMember && auditMember.dignityScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative font-sans">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    Contribution Score Audit: {auditMember.display_name}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Formula Version: {auditMember.dignityScore.formula_version} &bull; Deterministic Evidence-Backed
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAuditMember(null)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Score Grid Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-sans block">Accepted Contribution Points</span>
                <span className="text-lg font-bold text-emerald-400">
                  {auditMember.dignityScore.accepted_contribution_points.toFixed(2)} pts
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-sans block">Eligible Task Scope (Vt)</span>
                <span className="text-lg font-bold text-zinc-200">
                  {auditMember.dignityScore.eligible_task_value.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-sans block">Accepted Progress</span>
                <span className="text-base font-bold text-indigo-400">
                  {(auditMember.dignityScore.accepted_progress * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-sans block">Claim Reliability</span>
                <span className="text-sm font-bold text-zinc-300">
                  {auditMember.dignityScore.claim_reliability.status === 'insufficient_data'
                    ? 'Insufficient data (<3)'
                    : `${(auditMember.dignityScore.claim_reliability.score! * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>

            {/* Quality Adjustments and Blockers */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-1.5 font-mono">
              <span className="text-zinc-400 font-semibold block text-[11px] font-sans">
                Review &amp; Adjustment Breakdown:
              </span>
              <div className="flex justify-between text-zinc-300">
                <span>Verified Claims:</span>
                <span className="text-emerald-400 font-semibold">
                  {auditMember.dignityScore.claim_reliability.verified_count}
                </span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Partially Verified Claims:</span>
                <span className="text-amber-400 font-semibold">
                  {auditMember.dignityScore.claim_reliability.partially_verified_count}
                </span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Disputed / Rejected Claims:</span>
                <span className="text-rose-400 font-semibold">
                  {auditMember.dignityScore.disputed_claims}
                </span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Pending / Unreviewed Claims:</span>
                <span className="text-zinc-400 font-semibold">
                  {auditMember.dignityScore.pending_claims} (Excluded from penalty)
                </span>
              </div>
              <div className="flex justify-between text-zinc-300 pt-1 border-t border-zinc-800/80">
                <span>Excluded Blockers &amp; Waiting Time:</span>
                <span className="text-zinc-300 font-semibold">
                  {auditMember.dignityScore.blocked_tasks} tasks blocked
                </span>
              </div>
            </div>

            {/* Backend Explanations */}
            {auditMember.dignityScore.explanation && auditMember.dignityScore.explanation.length > 0 && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold block">
                  Evaluation Notes:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-300 text-[11px] font-mono">
                  {auditMember.dignityScore.explanation.map((exp, i) => (
                    <li key={i}>{exp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mandatory Objective Worth Disclaimer */}
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2 leading-relaxed">
              <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
              <span>
                <strong>Audit Note:</strong> This score is an explainable, limited contribution estimate based on recorded evidence. It is not an objective measure of a person&apos;s worth or overall productivity.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAuditMember(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
