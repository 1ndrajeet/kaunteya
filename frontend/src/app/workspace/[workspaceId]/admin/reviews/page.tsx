'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  GitPullRequest,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
  Loader2,
  Search,
  Filter,
  User,
  ShieldAlert,
  ArrowRight,
  Clock,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
  Compass,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { WorkClaim, EvidenceArtifact, ClaimReviewState } from '@/types/database';

interface ClaimItem extends WorkClaim {
  task?: {
    id: string;
    title: string;
    task_number: number;
    project: {
      id: string;
      identifier: string;
      name: string;
    };
  } | null;
  claimant?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    github_username: string | null;
  } | null;
  reviewer?: {
    id: string;
    display_name: string;
  } | null;
  associations?: {
    artifact: EvidenceArtifact;
    relevance_note: string | null;
  }[];
}

export default function AdminClaimReviewsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user } = useWorkspace();

  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterState, setFilterState] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [reviewRationale, setReviewRationale] = useState<string>('');
  const [reviewing, setReviewing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchClaims = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: claimsData, error } = await supabase
      .from('work_claims')
      .select(`
        *,
        task:tasks (
          id,
          title,
          task_number,
          project:projects (
            id,
            identifier,
            name
          )
        ),
        claimant:profiles!work_claims_claimant_id_fkey (
          id,
          display_name,
          avatar_url,
          github_username
        ),
        reviewer:profiles!work_claims_reviewer_id_fkey (
          id,
          display_name
        ),
        associations:claim_evidence_associations (
          relevance_note,
          artifact:evidence_artifacts (
            id,
            artifact_type,
            external_id,
            title,
            source_url,
            author_login,
            commit_sha,
            head_branch,
            base_branch,
            artifact_state,
            is_merged,
            merged_at,
            check_conclusion,
            created_at_external,
            last_sync_at
          )
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error && claimsData) {
      setClaims(claimsData as unknown as ClaimItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClaims();
  }, [workspaceId]);

  const handleRecordReview = async (newState: ClaimReviewState) => {
    if (!selectedClaim || !user) return;

    // Self-approval prohibition
    if (selectedClaim.claimant_id === user.id && (newState === 'supported' || newState === 'partially_supported')) {
      setActionMessage({
        type: 'error',
        text: 'Governance Policy Violation: You cannot review or approve your own work claim.',
      });
      return;
    }

    if (!reviewRationale.trim() && (newState === 'unverified' || newState === 'disputed' || newState === 'needs_clarification')) {
      setActionMessage({
        type: 'error',
        text: 'A review rationale is required when challenging or requesting clarification on a claim.',
      });
      return;
    }

    setReviewing(true);
    setActionMessage(null);
    const supabase = createClient();

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('work_claims')
      .update({
        review_state: newState,
        reviewer_id: user.id,
        reviewed_at: nowIso,
        review_rationale: reviewRationale.trim() || null,
        updated_at: nowIso,
      })
      .eq('id', selectedClaim.id);

    if (error) {
      setActionMessage({ type: 'error', text: error.message });
      setReviewing(false);
      return;
    }

    // Record Activity Event
    await supabase.from('activity_events').insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      entity_type: 'task',
      entity_id: selectedClaim.task_id,
      event_type: 'claim_reviewed',
      metadata: {
        claim_id: selectedClaim.id,
        old_state: selectedClaim.review_state,
        new_state: newState,
        rationale: reviewRationale.trim(),
      },
    });

    setActionMessage({
      type: 'success',
      text: `Claim review recorded as "${newState}". Decision logged in audit trail.`,
    });

    // Update local state
    setClaims((prev) =>
      prev.map((c) =>
        c.id === selectedClaim.id
          ? {
              ...c,
              review_state: newState,
              reviewer_id: user.id,
              reviewed_at: nowIso,
              review_rationale: reviewRationale.trim() || null,
              reviewer: { id: user.id, display_name: user.user_metadata?.full_name || 'Reviewer' },
            }
          : c
      )
    );

    setSelectedClaim((prev) =>
      prev
        ? {
            ...prev,
            review_state: newState,
            reviewer_id: user.id,
            reviewed_at: nowIso,
            review_rationale: reviewRationale.trim() || null,
          }
        : null
    );

    setReviewing(false);
  };

  const filteredClaims = claims.filter((c) => {
    if (filterState !== 'all' && c.review_state !== filterState) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const taskIdent = `${c.task?.project?.identifier}-${c.task?.task_number}`.toLowerCase();
    const claimantName = c.claimant?.display_name?.toLowerCase() || '';
    const text = c.claim_text.toLowerCase();
    return taskIdent.includes(q) || claimantName.includes(q) || text.includes(q);
  });

  const pendingCount = claims.filter((c) => c.review_state === 'pending').length;
  const supportedCount = claims.filter((c) => c.review_state === 'supported').length;
  const disputedCount = claims.filter((c) => c.review_state === 'disputed' || c.review_state === 'needs_clarification').length;

  const getReviewBadge = (state: ClaimReviewState) => {
    switch (state) {
      case 'supported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-mono">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Supported
          </span>
        );
      case 'partially_supported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/60 text-sky-300 border border-sky-800/60 font-mono">
            <CheckCircle2 className="h-3 w-3 text-sky-400" /> Partially Supported
          </span>
        );
      case 'needs_clarification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 font-mono">
            <HelpCircle className="h-3 w-3 text-amber-400" /> Needs Clarification
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
            <AlertTriangle className="h-3 w-3 text-zinc-400" /> Unverified
          </span>
        );
      case 'disputed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800/60 font-mono">
            <XCircle className="h-3 w-3 text-rose-400" /> Disputed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-mono">
            <Clock className="h-3 w-3 text-indigo-400" /> Pending Review
          </span>
        );
    }
  };

  if (role && role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-100">Administrator Access Required</h2>
          <p className="text-xs text-zinc-400 max-w-md">
            You are signed in as a <span className="font-mono text-indigo-400 uppercase font-semibold">{role}</span>. Reviewing and adjudicating member work claims is restricted to workspace administrators.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {role === 'lead' && (
            <Link
              href={`/workspace/${workspaceId}/lead`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              <Compass className="h-4 w-4" /> Go to Team Lead Portal
            </Link>
          )}
          {role === 'member' && (
            <Link
              href={`/workspace/${workspaceId}/member`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              <User className="h-4 w-4" /> Go to My Tasks
            </Link>
          )}
          <Link
            href={`/workspace/${workspaceId}/tasks`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
          >
            Workspace Tasks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-indigo-400" /> Work Claims & Evidence Review
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Review member work assertions against verifiable GitHub pull requests, commits, and CI checks. Humans resolve uncertainty.
          </p>
        </div>

        {/* Stats Counters */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg border border-indigo-900/40 bg-indigo-950/30 text-indigo-300 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>{pendingCount} Pending</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>{supportedCount} Supported</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-amber-900/40 bg-amber-950/30 text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>{disputedCount} In Review</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Claims' },
            { id: 'pending', label: 'Pending Review' },
            { id: 'needs_clarification', label: 'Needs Clarification' },
            { id: 'supported', label: 'Supported' },
            { id: 'partially_supported', label: 'Partially Supported' },
            { id: 'disputed', label: 'Disputed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterState(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                filterState === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search task, claimant, text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Claims Grid / Table */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span>Loading work claims & evidence records...</span>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
          <FileCheck2 className="h-8 w-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">No work claims found</h3>
          <p className="text-xs text-zinc-500">
            {searchQuery
              ? 'Try adjusting your search or filter.'
              : 'Claims submitted via TaskPilot or Slack follow-ups will appear here for administrator review.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredClaims.map((claim) => {
            const taskIdent = `${claim.task?.project?.identifier || 'TASK'}-${claim.task?.task_number || 0}`;
            const assessment = (claim.assessment_summary && typeof claim.assessment_summary === 'object'
              ? claim.assessment_summary
              : {}) as any;

            return (
              <div
                key={claim.id}
                className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 border border-zinc-700">
                      {taskIdent}
                    </span>
                    <span className="text-xs font-medium text-zinc-200">{claim.task?.title || 'Untitled Task'}</span>
                    <span className="text-zinc-600">&bull;</span>
                    <span className="text-[11px] font-mono text-zinc-400 capitalize px-2 py-0.5 rounded bg-zinc-950/60 border border-zinc-800">
                      {claim.claim_type.replace('_', ' ')}
                    </span>
                    {claim.claim_source === 'slack_followup' && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" /> Slack Follow-up
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {getReviewBadge(claim.review_state)}
                    <button
                      onClick={() => {
                        setSelectedClaim(claim);
                        setReviewRationale(claim.review_rationale || '');
                        setActionMessage(null);
                      }}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <span>Inspect & Review</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Claim Statement Quote */}
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300 font-sans italic">
                  &ldquo;{claim.claim_text}&rdquo;
                </div>

                {/* Footer metadata: Claimant & Evidence preview */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                      {claim.claimant?.display_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span>Submitted by <strong className="text-zinc-200">{claim.claimant?.display_name || 'Member'}</strong></span>
                    <span className="text-zinc-600">&bull;</span>
                    <span className="font-mono text-zinc-500">{new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Evidence summary badge */}
                  <div className="flex items-center gap-2 font-mono">
                    {assessment.triageCategory === 'supporting_found' && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Grounded Evidence Verified
                      </span>
                    )}
                    {assessment.triageCategory === 'conflicting_found' && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Conflicts Detected
                      </span>
                    )}
                    {assessment.triageCategory === 'partially_supported' && (
                      <span className="text-sky-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> In Progress Artifacts
                      </span>
                    )}
                    {(!assessment.triageCategory || assessment.triageCategory === 'insufficient') && (
                      <span className="text-zinc-500 flex items-center gap-1">
                        <HelpCircle className="h-3 w-3" /> Awaiting Artifact Sync
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal / Drawer */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 border border-zinc-700">
                    {selectedClaim.task?.project?.identifier}-{selectedClaim.task?.task_number}
                  </span>
                  <h2 className="text-base font-bold text-zinc-100">{selectedClaim.task?.title}</h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Work claim submitted by <strong className="text-zinc-200">{selectedClaim.claimant?.display_name}</strong> on{' '}
                  {new Date(selectedClaim.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedClaim(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800"
              >
                &times;
              </button>
            </div>

            {actionMessage && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  actionMessage.type === 'success'
                    ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-300'
                    : 'border-rose-900/50 bg-rose-950/30 text-rose-300'
                }`}
              >
                {actionMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{actionMessage.text}</span>
              </div>
            )}

            {/* Side-by-Side: Claim vs GitHub Reality */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: What Member Claimed */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-400" /> What Member Claimed
                </div>
                <p className="text-xs text-zinc-200 italic bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                  &ldquo;{selectedClaim.claim_text}&rdquo;
                </p>
                <div className="text-[11px] font-mono text-zinc-500 space-y-1">
                  <div>Claim Type: <span className="text-zinc-300 capitalize">{selectedClaim.claim_type.replace('_', ' ')}</span></div>
                  <div>Source: <span className="text-zinc-300">{selectedClaim.claim_source}</span></div>
                  {selectedClaim.pr_url_hint && (
                    <div className="truncate">
                      PR Reference:{' '}
                      <a
                        href={selectedClaim.pr_url_hint}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline"
                      >
                        {selectedClaim.pr_url_hint}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: What GitHub Actually Reports */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GitPullRequest className="h-3.5 w-3.5 text-emerald-400" /> What GitHub Actually Reports
                </div>

                {selectedClaim.associations && selectedClaim.associations.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedClaim.associations.map((assoc) => {
                      const art = assoc.artifact;
                      return (
                        <div
                          key={art.id}
                          className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] text-zinc-400 uppercase">{art.artifact_type}</span>
                            <span
                              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                                art.is_merged
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : art.artifact_state === 'open'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {art.is_merged ? 'MERGED' : art.artifact_state.toUpperCase()}
                            </span>
                          </div>
                          <a
                            href={art.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-zinc-200 hover:text-indigo-400 flex items-center gap-1 truncate block"
                          >
                            <span>{art.title || art.external_id}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          {art.commit_sha && (
                            <div className="text-[10px] font-mono text-zinc-500">
                              Commit: <span className="text-zinc-400">{art.commit_sha.slice(0, 7)}</span>
                            </div>
                          )}
                          {art.check_conclusion && (
                            <div className="text-[10px] font-mono">
                              Checks: <span className={art.check_conclusion === 'success' ? 'text-emerald-400' : 'text-rose-400'}>{art.check_conclusion}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-zinc-950/80 border border-dashed border-zinc-800 text-center text-xs text-zinc-500 space-y-1">
                    <p>No verified GitHub artifacts linked to this claim yet.</p>
                    <p className="text-[10px]">Use Admin &gt; Integrations to trigger a manual repository synchronization.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: System Assessment Summary */}
            {selectedClaim.assessment_summary && Object.keys(selectedClaim.assessment_summary).length > 0 && (
              <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 space-y-2">
                <div className="text-[11px] font-mono text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Evidence Assessment Engine Summary
                </div>
                <p className="text-xs text-zinc-200">
                  {(selectedClaim.assessment_summary as any).summaryText || 'Assessment computed from repository facts.'}
                </p>
                {(selectedClaim.assessment_summary as any).conflicts?.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-mono text-rose-400 uppercase font-bold">Unresolved Conflicts:</span>
                    <ul className="text-xs text-rose-300 list-disc list-inside space-y-0.5">
                      {(selectedClaim.assessment_summary as any).conflicts.map((c: string, idx: number) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Self-Approval Prevention Warning */}
            {user?.id === selectedClaim.claimant_id && (
              <div className="p-3 rounded-xl border border-amber-900/60 bg-amber-950/30 text-amber-300 text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Anti-Tampering Rule:</strong> You authored this work claim. Workspace governance strictly
                  prohibits claimants from approving their own claims. Another administrator or lead must adjudicate this claim.
                </span>
              </div>
            )}

            {/* Box 4: Human Reviewer Decision Panel */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Adjudicate Claim &amp; Record Decision
              </div>

              <textarea
                placeholder="Record review rationale (e.g. 'PR #42 confirmed merged, token tests verified passing in CI')..."
                value={reviewRationale}
                onChange={(e) => setReviewRationale(e.target.value)}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-sans"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    disabled={reviewing || user?.id === selectedClaim.claimant_id}
                    onClick={() => handleRecordReview('supported')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-40 shadow-sm"
                  >
                    Mark Supported
                  </button>
                  <button
                    disabled={reviewing || user?.id === selectedClaim.claimant_id}
                    onClick={() => handleRecordReview('partially_supported')}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors disabled:opacity-40 shadow-sm"
                  >
                    Partially Supported
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleRecordReview('needs_clarification')}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors disabled:opacity-40 shadow-sm"
                  >
                    Request Clarification
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleRecordReview('unverified')}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    Insufficient Evidence
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleRecordReview('disputed')}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors disabled:opacity-40 shadow-sm"
                  >
                    Escalate / Dispute
                  </button>
                </div>

                <button
                  onClick={() => setSelectedClaim(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
