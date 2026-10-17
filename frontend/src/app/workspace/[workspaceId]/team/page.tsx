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
          <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-[#23170E] flex items-center gap-2">
            <Users className="h-6 w-6 text-[#DC6E26]" /> Team Workload &amp; Contribution
          </h1>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Real-time delivery capacity correlated against verifiable evidence-backed contribution scores.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#736251] font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#DC6E26]" />
          <span>Calculating team workload &amp; contribution metrics...</span>
        </div>
      ) : workloads.length === 0 ? (
        <div className="text-center py-12 text-xs text-[#736251] font-mono">
          No members found in this workspace.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workloads.map((member) => (
            <div
              key={member.user_id}
              className="p-5 rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 hover:border-[#DC6E26]/50 transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#DC6E26] flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      member.display_name[0]?.toUpperCase() || 'M'
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#23170E]">{member.display_name}</h3>
                    <span className="text-[10px] text-[#736251] font-mono">{member.email}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded ${member.role === 'lead'
                    ? 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]'
                    : member.role === 'admin'
                      ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                      : 'bg-[#F2ECE1] text-[#736251] border border-[#E4DBC9]'
                    }`}
                >
                  {member.role}
                </span>
              </div>

              {/* Workload Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E3DAC8] text-center">
                <div className="p-2 rounded-lg bg-[#F2ECE1] border border-[#E4DBC9]">
                  <span className="text-[10px] text-[#736251] uppercase font-mono font-medium">Active</span>
                  <div className="text-base font-bold text-[#DC6E26] mt-0.5">{member.inProgressCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#F2ECE1] border border-[#E4DBC9]">
                  <span className="text-[10px] text-[#736251] uppercase font-mono font-medium">Done</span>
                  <div className="text-base font-bold text-[#2B5910] mt-0.5">{member.completedCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#F2ECE1] border border-[#E4DBC9]">
                  <span className="text-[10px] text-[#736251] uppercase font-mono font-medium">Total</span>
                  <div className="text-base font-bold text-[#23170E] mt-0.5">{member.totalAssigned}</div>
                </div>
              </div>

              {/* Phase 4: Contribution & Dignity Score Intelligence */}
              <div className="p-3 rounded-lg border border-[#E3DAC8] bg-[#FAF7F2] space-y-2 text-xs font-mono shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-[#736251] flex items-center gap-1 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#2B5910]" /> Contribution Score
                  </span>
                  <button
                    onClick={() => setAuditMember(member)}
                    className="text-[10px] text-[#DC6E26] hover:text-[#C05617] font-sans font-semibold transition-colors underline underline-offset-2"
                  >
                    Explainable Audit &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[#736251] block text-[10px] uppercase font-sans font-medium">Accepted Points</span>
                    <span className="text-[#2B5910] font-bold text-sm">
                      {member.dignityScore
                        ? `${member.dignityScore.accepted_contribution_points.toFixed(1)} pts`
                        : '0.0 pts'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#736251] block text-[10px] uppercase font-sans font-medium">Claim Reliability</span>
                    <span className="text-[#23170E] text-[11px] block truncate font-medium">
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
                  <div className="flex items-center justify-between pt-1 border-t border-[#E3DAC8] text-[10px] text-[#736251]">
                    <span>Eligible Scope: {member.dignityScore.eligible_task_value.toFixed(1)}</span>
                    <span>Progress: {(member.dignityScore.accepted_progress * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-[#736251]">
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3 text-[#DC6E26]" /> Current Capacity:
                </span>
                <span
                  className={`font-mono font-semibold ${member.inProgressCount >= 5
                    ? 'text-[#882315]'
                    : member.inProgressCount >= 3
                      ? 'text-[#824B04]'
                      : 'text-[#2B5910]'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23170E]/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#FAF7F2] border border-[#E3DAC8] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl relative font-sans text-[#23170E]">
            <div className="flex items-center justify-between border-b border-[#E3DAC8] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#2B5910]" />
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#23170E]">
                    Contribution Score Audit: {auditMember.display_name}
                  </h3>
                  <span className="text-[10px] font-mono text-[#736251]">
                    Formula Version: {auditMember.dignityScore.formula_version} &bull; Deterministic Evidence-Backed
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAuditMember(null)}
                className="text-[#736251] hover:text-[#23170E] p-1 rounded-lg hover:bg-[#F2ECE1] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Score Grid Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[#F2ECE1] border border-[#E4DBC9]">
                <span className="text-[#736251] text-[10px] uppercase font-sans block font-medium">Accepted Contribution Points</span>
                <span className="text-lg font-bold text-[#2B5910]">
                  {auditMember.dignityScore.accepted_contribution_points.toFixed(2)} pts
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F2ECE1] border border-[#E4DBC9]">
                <span className="text-[#736251] text-[10px] uppercase font-sans block font-medium">Eligible Task Scope (Vt)</span>
                <span className="text-lg font-bold text-[#23170E]">
                  {auditMember.dignityScore.eligible_task_value.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F2ECE1] border border-[#E4DBC9]">
                <span className="text-[#736251] text-[10px] uppercase font-sans block font-medium">Accepted Progress</span>
                <span className="text-base font-bold text-[#DC6E26]">
                  {(auditMember.dignityScore.accepted_progress * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F2ECE1] border border-[#E4DBC9]">
                <span className="text-[#736251] text-[10px] uppercase font-sans block font-medium">Claim Reliability</span>
                <span className="text-sm font-bold text-[#23170E]">
                  {auditMember.dignityScore.claim_reliability.status === 'insufficient_data'
                    ? 'Insufficient data (<3)'
                    : `${(auditMember.dignityScore.claim_reliability.score! * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>

            {/* Quality Adjustments and Blockers */}
            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E3DAC8] text-xs space-y-1.5 font-mono">
              <span className="text-[#736251] font-semibold block text-[11px] font-sans">
                Review &amp; Adjustment Breakdown:
              </span>
              <div className="flex justify-between text-[#23170E]">
                <span>Verified Claims:</span>
                <span className="text-[#2B5910] font-semibold">
                  {auditMember.dignityScore.claim_reliability.verified_count}
                </span>
              </div>
              <div className="flex justify-between text-[#23170E]">
                <span>Partially Verified Claims:</span>
                <span className="text-[#824B04] font-semibold">
                  {auditMember.dignityScore.claim_reliability.partially_verified_count}
                </span>
              </div>
              <div className="flex justify-between text-[#23170E]">
                <span>Disputed / Rejected Claims:</span>
                <span className="text-[#882315] font-semibold">
                  {auditMember.dignityScore.disputed_claims}
                </span>
              </div>
              <div className="flex justify-between text-[#23170E]">
                <span>Pending / Unreviewed Claims:</span>
                <span className="text-[#736251] font-semibold">
                  {auditMember.dignityScore.pending_claims} (Excluded from penalty)
                </span>
              </div>
              <div className="flex justify-between text-[#23170E] pt-1 border-t border-[#E3DAC8]">
                <span>Excluded Blockers &amp; Waiting Time:</span>
                <span className="text-[#736251] font-semibold">
                  {auditMember.dignityScore.blocked_tasks} tasks blocked
                </span>
              </div>
            </div>

            {/* Backend Explanations */}
            {auditMember.dignityScore.explanation && auditMember.dignityScore.explanation.length > 0 && (
              <div className="p-3 rounded-xl bg-[#F2ECE1] border border-[#E4DBC9] text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#736251] font-semibold block">
                  Evaluation Notes:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[#23170E] text-[11px] font-mono">
                  {auditMember.dignityScore.explanation.map((exp, i) => (
                    <li key={i}>{exp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mandatory Objective Worth Disclaimer */}
            <div className="p-3 rounded-xl bg-[#FCF3E3] border border-[#F1DCBA] text-[11px] text-[#824B04] flex items-start gap-2 leading-relaxed">
              <Info className="h-4 w-4 text-[#824B04] shrink-0 mt-0.5" />
              <span>
                <strong>Audit Note:</strong> This score is an explainable, limited contribution estimate based on recorded evidence. It is not an objective measure of a person&apos;s worth or overall productivity.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAuditMember(null)}
                className="px-4 py-2 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] hover:bg-[#EFE9DF] text-[#23170E] text-xs font-semibold transition-colors"
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
