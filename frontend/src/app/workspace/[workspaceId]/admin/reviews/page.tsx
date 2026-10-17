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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1] font-mono">
            <CheckCircle2 className="h-3 w-3 text-[#2B5910]" /> Supported
          </span>
        );
      case 'partially_supported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA] font-mono">
            <CheckCircle2 className="h-3 w-3 text-[#824B04]" /> Partially Supported
          </span>
        );
      case 'needs_clarification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA] font-mono">
            <HelpCircle className="h-3 w-3 text-[#DC6E26]" /> Needs Clarification
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F2ECE1] text-[#6E5D4E] border border-[#E3DAC8] font-mono">
            <AlertTriangle className="h-3 w-3 text-[#DC6E26]" /> Unverified
          </span>
        );
      case 'disputed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FCECE9] text-[#882315] border border-[#F4CFC8] font-mono">
            <XCircle className="h-3 w-3 text-[#882315]" /> Disputed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F2ECE1] text-[#DC6E26] border border-[#E3DAC8] font-mono">
            <Clock className="h-3 w-3 text-[#DC6E26]" /> Pending Review
          </span>
        );
    }
  };

  if (role && role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-[#FCF3E3] text-[#DC6E26] flex items-center justify-center mx-auto border border-[#F1DCBA]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-serif font-bold text-[#23170E]">Administrator Access Required</h2>
          <p className="text-xs text-[#6E5D4E] max-w-md">
            You are signed in as a <span className="font-mono text-[#DC6E26] uppercase font-semibold">{role}</span>. Reviewing and adjudicating member work claims is restricted to workspace administrators.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {role === 'lead' && (
            <Link
              href={`/workspace/${workspaceId}/lead`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Compass className="h-4 w-4" /> Go to Team Lead Portal
            </Link>
          )}
          {role === 'member' && (
            <Link
              href={`/workspace/${workspaceId}/member`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <User className="h-4 w-4" /> Go to My Tasks
            </Link>
          )}
          <Link
            href={`/workspace/${workspaceId}/tasks`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-medium transition-colors"
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
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#23170E] flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-[#DC6E26]" /> Work Claims &amp; Evidence Review
          </h1>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Review member work assertions against verifiable GitHub pull requests, commits, and CI checks. Humans resolve uncertainty.
          </p>
        </div>

        {/* Stats Counters */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] text-[#824B04] flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#DC6E26]" />
            <span>{pendingCount} Pending</span>
          </div>
          <div className="px-3 py-1.5 rounded-full border border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910] flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2B5910]" />
            <span>{supportedCount} Supported</span>
          </div>
          <div className="px-3 py-1.5 rounded-full border border-[#F1DCBA] bg-[#FCF3E3] text-[#824B04] flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-[#DC6E26]" />
            <span>{disputedCount} In Review</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2]">
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
              className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${filterState === tab.id
                ? 'bg-[#23170E] text-white shadow-xs font-semibold'
                : 'text-[#6E5D4E] hover:text-[#23170E] hover:bg-[#F2ECE1]'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#736251]" />
          <input
            type="text"
            placeholder="Search task, claimant, text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-full pl-8 pr-3 py-1.5 text-xs text-[#23170E] placeholder:text-[#6E5D4E] focus:outline-none focus:border-[#DC6E26]"
          />
        </div>
      </div>

      {/* Main Claims Grid / Table */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#6E5D4E] font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#DC6E26]" />
          <span>Loading work claims &amp; evidence records...</span>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-[#E3DAC8] bg-[#FAF7F2] text-center space-y-2">
          <FileCheck2 className="h-8 w-8 text-[#736251] mx-auto" />
          <h3 className="text-sm font-serif font-bold text-[#23170E]">No work claims found</h3>
          <p className="text-xs text-[#6E5D4E]">
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
                className="p-5 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/50 transition-all space-y-3 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2ECE1] text-[#DC6E26] border border-[#E3DAC8]">
                      {taskIdent}
                    </span>
                    <span className="text-xs font-semibold text-[#23170E]">{claim.task?.title || 'Untitled Task'}</span>
                    <span className="text-[#E3DAC8]">&bull;</span>
                    <span className="text-[11px] font-mono text-[#6E5D4E] capitalize px-2.5 py-0.5 rounded-full bg-[#F2ECE1] border border-[#E3DAC8]">
                      {claim.claim_type.replace('_', ' ')}
                    </span>
                    {claim.claim_source === 'slack_followup' && (
                      <span className="text-[10px] font-mono text-[#2B5910] bg-[#ECF6E3] border border-[#D4E9C1] px-2 py-0.5 rounded-full flex items-center gap-1">
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
                      className="px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <span>Inspect &amp; Review</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Claim Statement Quote */}
                <div className="p-3.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] text-xs text-[#23170E] font-sans italic">
                  &ldquo;{claim.claim_text}&rdquo;
                </div>

                {/* Footer metadata: Claimant & Evidence preview */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#6E5D4E] pt-2 border-t border-[#E3DAC8]">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-[#DC6E26] flex items-center justify-center text-white text-[10px] font-bold">
                      {claim.claimant?.display_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span>Submitted by <strong className="text-[#23170E]">{claim.claimant?.display_name || 'Member'}</strong></span>
                    <span className="text-[#E3DAC8]">&bull;</span>
                    <span className="font-mono text-[#6E5D4E]">{new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Evidence summary badge */}
                  <div className="flex items-center gap-2 font-mono">
                    {assessment.triageCategory === 'supporting_found' && (
                      <span className="text-[#2B5910] flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Grounded Evidence Verified
                      </span>
                    )}
                    {assessment.triageCategory === 'conflicting_found' && (
                      <span className="text-[#882315] flex items-center gap-1 font-medium">
                        <AlertTriangle className="h-3 w-3" /> Conflicts Detected
                      </span>
                    )}
                    {assessment.triageCategory === 'partially_supported' && (
                      <span className="text-[#824B04] flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" /> In Progress Artifacts
                      </span>
                    )}
                    {(!assessment.triageCategory || assessment.triageCategory === 'insufficient') && (
                      <span className="text-[#6E5D4E] flex items-center gap-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23170E]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E3DAC8] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#F2ECE1] text-[#DC6E26] border border-[#E3DAC8]">
                    {selectedClaim.task?.project?.identifier}-{selectedClaim.task?.task_number}
                  </span>
                  <h2 className="text-lg font-serif font-bold text-[#23170E]">{selectedClaim.task?.title}</h2>
                </div>
                <p className="text-xs text-[#6E5D4E] mt-1">
                  Work claim submitted by <strong className="text-[#23170E]">{selectedClaim.claimant?.display_name}</strong> on{' '}
                  {new Date(selectedClaim.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedClaim(null)}
                className="text-[#6E5D4E] hover:text-[#23170E] p-1.5 rounded-full hover:bg-[#F2ECE1] transition-colors"
              >
                &times;
              </button>
            </div>

            {actionMessage && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${actionMessage.type === 'success'
                  ? 'border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910]'
                  : 'border-[#F4CFC8] bg-[#FCECE9] text-[#882315]'
                  }`}
              >
                {actionMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-[#2B5910] shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-[#882315] shrink-0" />
                )}
                <span>{actionMessage.text}</span>
              </div>
            )}

            {/* Side-by-Side: Claim vs GitHub Reality */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: What Member Claimed */}
              <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-2">
                <div className="text-[11px] font-mono text-[#6E5D4E] uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                  <User className="h-3.5 w-3.5 text-[#DC6E26]" /> What Member Claimed
                </div>
                <p className="text-xs text-[#23170E] italic bg-[#FAF7F2] p-3 rounded-xl border border-[#E3DAC8]">
                  &ldquo;{selectedClaim.claim_text}&rdquo;
                </p>
                <div className="text-[11px] font-mono text-[#6E5D4E] space-y-1">
                  <div>Claim Type: <span className="text-[#23170E] font-semibold capitalize">{selectedClaim.claim_type.replace('_', ' ')}</span></div>
                  <div>Source: <span className="text-[#23170E] font-semibold">{selectedClaim.claim_source}</span></div>
                  {selectedClaim.pr_url_hint && (
                    <div className="truncate">
                      PR Reference:{' '}
                      <a
                        href={selectedClaim.pr_url_hint}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#DC6E26] hover:underline"
                      >
                        {selectedClaim.pr_url_hint}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: What GitHub Actually Reports */}
              <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-2">
                <div className="text-[11px] font-mono text-[#6E5D4E] uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                  <GitPullRequest className="h-3.5 w-3.5 text-[#2B5910]" /> What GitHub Actually Reports
                </div>

                {selectedClaim.associations && selectedClaim.associations.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedClaim.associations.map((assoc) => {
                      const art = assoc.artifact;
                      return (
                        <div
                          key={art.id}
                          className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E3DAC8] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] text-[#6E5D4E] uppercase">{art.artifact_type}</span>
                            <span
                              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${art.is_merged
                                ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                                : art.artifact_state === 'open'
                                  ? 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]'
                                  : 'bg-[#F2ECE1] text-[#6E5D4E] border border-[#E3DAC8]'
                                }`}
                            >
                              {art.is_merged ? 'MERGED' : art.artifact_state.toUpperCase()}
                            </span>
                          </div>
                          <a
                            href={art.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#23170E] hover:text-[#DC6E26] flex items-center gap-1 truncate block transition-colors"
                          >
                            <span>{art.title || art.external_id}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          {art.commit_sha && (
                            <div className="text-[10px] font-mono text-[#6E5D4E]">
                              Commit: <span className="text-[#23170E] font-semibold">{art.commit_sha.slice(0, 7)}</span>
                            </div>
                          )}
                          {art.check_conclusion && (
                            <div className="text-[10px] font-mono">
                              Checks: <span className={art.check_conclusion === 'success' ? 'text-[#2B5910] font-semibold' : 'text-[#882315] font-semibold'}>{art.check_conclusion}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#FAF7F2] border border-dashed border-[#E3DAC8] text-center text-xs text-[#6E5D4E] space-y-1">
                    <p>No verified GitHub artifacts linked to this claim yet.</p>
                    <p className="text-[10px]">Use Admin &gt; Integrations to trigger a manual repository synchronization.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: System Assessment Summary */}
            {selectedClaim.assessment_summary && Object.keys(selectedClaim.assessment_summary).length > 0 && (
              <div className="p-4 rounded-2xl border border-[#F1DCBA] bg-[#FCF3E3] space-y-2">
                <div className="text-[11px] font-mono text-[#824B04] uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#DC6E26]" /> Evidence Assessment Engine Summary
                </div>
                <p className="text-xs text-[#23170E]">
                  {(selectedClaim.assessment_summary as any).summaryText || 'Assessment computed from repository facts.'}
                </p>
                {(selectedClaim.assessment_summary as any).conflicts?.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-mono text-[#882315] uppercase font-bold">Unresolved Conflicts:</span>
                    <ul className="text-xs text-[#882315] list-disc list-inside space-y-0.5">
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
              <div className="p-3 rounded-2xl border border-[#F1DCBA] bg-[#FCF3E3] text-[#824B04] text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-[#DC6E26]" />
                <span>
                  <strong>Anti-Tampering Rule:</strong> You authored this work claim. Workspace governance strictly
                  prohibits claimants from approving their own claims. Another administrator or lead must adjudicate this claim.
                </span>
              </div>
            )}

            {/* Box 4: Human Reviewer Decision Panel */}
            <div className="space-y-3 pt-2 border-t border-[#E3DAC8]">
              <div className="text-[11px] font-mono text-[#6E5D4E] uppercase tracking-wider font-semibold">
                Adjudicate Claim &amp; Record Decision
              </div>

              <textarea
                placeholder="Record review rationale (e.g. 'PR #42 confirmed merged, token tests verified passing in CI')..."
                value={reviewRationale}
                onChange={(e) => setReviewRationale(e.target.value)}
                rows={3}
                className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-xl p-3 text-xs text-[#23170E] placeholder:text-[#6E5D4E] focus:outline-none focus:border-[#DC6E26] font-sans"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    disabled={reviewing || user?.id === selectedClaim.claimant_id}
                    onClick={() => handleRecordReview('supported')}
                    className="px-3.5 py-1.5 rounded-full bg-[#2B5910] hover:bg-[#20420C] text-white text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs"
                  >
                    Mark Supported
                  </button>
                  <button
                    disabled={reviewing || user?.id === selectedClaim.claimant_id}
                    onClick={() => handleRecordReview('partially_supported')}
                    className="px-3.5 py-1.5 rounded-full bg-[#824B04] hover:bg-[#683B03] text-white text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs"
                  >
                    Partially Supported
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleRecordReview('needs_clarification')}
                    className="px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs"
                  >
                    Request Clarification
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleRecordReview('unverified')}
                    className="px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] border border-[#E3DAC8] text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    Insufficient Evidence
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleRecordReview('disputed')}
                    className="px-3.5 py-1.5 rounded-full bg-[#882315] hover:bg-[#6B1C10] text-white text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs"
                  >
                    Escalate / Dispute
                  </button>
                </div>

                <button
                  onClick={() => setSelectedClaim(null)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-[#6E5D4E] hover:text-[#23170E] hover:bg-[#F2ECE1] transition-colors"
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
