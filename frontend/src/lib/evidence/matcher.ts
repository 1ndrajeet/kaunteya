import { SupabaseClient } from '@supabase/supabase-js';
import type { EvidenceArtifact } from '@/types/database';

export type TriageCategory =
  | 'supporting_found'
  | 'partially_supported'
  | 'conflicting_found'
  | 'insufficient'
  | 'not_synced'
  | 'needs_clarification';

export interface AssessmentSummary {
  triageCategory: TriageCategory;
  summaryText: string;
  supportedPoints: string[];
  unsupportedPoints: string[];
  conflicts: string[];
  evidenceFreshness: string | null;
  artifactCounts: {
    pullRequests: number;
    reviews: number;
    checkRuns: number;
    commits: number;
  };
}

/**
 * Deterministically assesses evidence artifacts for a specific work claim.
 * Factual states (merged, checks conclusion, reviews) are obtained from GitHub,
 * not hallucinated by an AI model.
 */
export function assessClaimEvidence(
  claim: { claim_text: string; claim_type: string; review_state?: string },
  artifacts: EvidenceArtifact[]
): AssessmentSummary {
  const prArtifacts = artifacts.filter((a) => a.artifact_type === 'pull_request');
  const reviewArtifacts = artifacts.filter((a) => a.artifact_type === 'review');
  const checkArtifacts = artifacts.filter((a) => a.artifact_type === 'check_run');
  const commitArtifacts = artifacts.filter((a) => a.artifact_type === 'commit');

  const artifactCounts = {
    pullRequests: prArtifacts.length,
    reviews: reviewArtifacts.length,
    checkRuns: checkArtifacts.length,
    commits: commitArtifacts.length,
  };

  const supportedPoints: string[] = [];
  const unsupportedPoints: string[] = [];
  const conflicts: string[] = [];

  // Determine latest evidence freshness
  const allTimestamps = artifacts
    .map((a) => a.created_at_external || a.last_sync_at)
    .filter(Boolean)
    .sort()
    .reverse();
  const evidenceFreshness = allTimestamps[0] || null;

  // Case 1: No artifacts linked
  if (artifacts.length === 0) {
    return {
      triageCategory: 'insufficient',
      summaryText:
        'No matching GitHub artifacts found for this task. Verification requires repository synchronization or an explicit PR URL link.',
      supportedPoints: [],
      unsupportedPoints: ['No pull request found', 'No commits associated with task identifier'],
      conflicts: [],
      evidenceFreshness: null,
      artifactCounts,
    };
  }

  // Inspect Pull Requests
  const primaryPr = prArtifacts[0];
  const isPrMerged = prArtifacts.some((pr) => pr.is_merged);
  const isPrClosedUnmerged = prArtifacts.some((pr) => pr.artifact_state === 'closed' && !pr.is_merged);
  const isPrOpen = prArtifacts.some((pr) => pr.artifact_state === 'open');

  // Inspect Reviews
  const approvedReviews = reviewArtifacts.filter(
    (r) => r.artifact_state.toUpperCase() === 'APPROVED'
  );
  const changesRequested = reviewArtifacts.filter(
    (r) => r.artifact_state.toUpperCase() === 'CHANGES_REQUESTED'
  );

  // Inspect Check Runs
  const totalChecks = checkArtifacts.length;
  const passedChecks = checkArtifacts.filter((c) => c.check_conclusion === 'success').length;
  const failedChecks = checkArtifacts.filter(
    (c) => c.check_conclusion === 'failure' || c.check_conclusion === 'timed_out'
  );

  // Evaluate Points
  if (isPrMerged) {
    supportedPoints.push(`Pull Request #${primaryPr?.external_id || ''} is merged into base branch`);
  } else if (isPrOpen) {
    supportedPoints.push(`Pull Request #${primaryPr?.external_id || ''} is active and in progress`);
  }

  if (approvedReviews.length > 0) {
    supportedPoints.push(`${approvedReviews.length} code review approval(s) recorded`);
  }

  if (totalChecks > 0 && failedChecks.length === 0) {
    supportedPoints.push(`All CI checks passed (${passedChecks}/${totalChecks})`);
  }

  if (commitArtifacts.length > 0) {
    supportedPoints.push(`${commitArtifacts.length} commit(s) associated with task identifier`);
  }

  // Evaluate Conflicts
  const claimLower = claim.claim_text.toLowerCase();
  const claimsDone =
    claimLower.includes('merged') ||
    claimLower.includes('complete') ||
    claimLower.includes('finished') ||
    claim.claim_type === 'completion';

  if (claimsDone && isPrOpen) {
    conflicts.push(`Claim states work is completed/merged, but PR #${primaryPr?.external_id || ''} is still open.`);
  }

  if (claimsDone && isPrClosedUnmerged) {
    conflicts.push(`Claim asserts work is merged, but PR #${primaryPr?.external_id || ''} was closed without merging.`);
  }

  if (failedChecks.length > 0) {
    const failedNames = failedChecks.map((f) => f.title).join(', ');
    conflicts.push(`CI check failure detected: ${failedNames}`);
  }

  if (changesRequested.length > 0) {
    conflicts.push(`Reviewer requested changes on PR #${primaryPr?.external_id || ''}`);
  }

  // Triage Category Determination
  let triageCategory: TriageCategory = 'partially_supported';
  let summaryText = '';

  if (conflicts.length > 0) {
    triageCategory = 'conflicting_found';
    summaryText = `Conflicting evidence found: ${conflicts.join('; ')}`;
  } else if (isPrMerged && failedChecks.length === 0) {
    triageCategory = 'supporting_found';
    summaryText = `Verified evidence confirms PR #${primaryPr?.external_id || ''} is merged by @${primaryPr?.author_login || 'contributor'}. ${passedChecks}/${totalChecks || 1} CI checks passed.`;
  } else if (isPrOpen) {
    triageCategory = 'partially_supported';
    summaryText = `PR #${primaryPr?.external_id || ''} opened by @${primaryPr?.author_login || 'contributor'}. Work is active and pending merge/review completion.`;
  } else {
    triageCategory = 'partially_supported';
    summaryText = `Found ${commitArtifacts.length} related commit(s), but PR merge state is unconfirmed.`;
  }

  return {
    triageCategory,
    summaryText,
    supportedPoints,
    unsupportedPoints,
    conflicts,
    evidenceFreshness,
    artifactCounts,
  };
}

/**
 * Scans active work claims in a workspace, associates matching evidence artifacts,
 * and updates their computed assessment summary.
 */
export async function matchArtifactsToWorkspaceClaims(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  // 1. Fetch pending/open claims
  const { data: claims } = await supabase
    .from('work_claims')
    .select(`
      id,
      task_id,
      claim_text,
      claim_type,
      pr_url_hint,
      review_state,
      task:tasks!inner (
        id,
        task_number,
        project:projects!inner (
          identifier
        )
      )
    `)
    .eq('workspace_id', workspaceId)
    .in('review_state', ['pending', 'needs_clarification']);

  if (!claims || claims.length === 0) {
    return 0;
  }

  // 2. Fetch all artifacts in workspace
  const { data: artifacts } = await supabase
    .from('evidence_artifacts')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (!artifacts || artifacts.length === 0) {
    return 0;
  }

  let matchedClaimsCount = 0;

  for (const claim of claims) {
    const taskIdentifier = `${(claim.task as any).project.identifier}-${(claim.task as any).task_number}`.toUpperCase();

    // Find candidate artifacts for this claim:
    // a. Artifacts directly tagged with this task_id or task identifier
    // b. PR URL match from pr_url_hint or claim_text
    // c. PR number match in claim_text (e.g. "PR #42")
    const matchedArtifacts = artifacts.filter((a) => {
      // Direct task match
      if (a.task_id === claim.task_id) return true;
      if (a.matched_task_identifier?.toUpperCase() === taskIdentifier) return true;

      // PR URL match
      if (claim.pr_url_hint && a.source_url.toLowerCase().includes(claim.pr_url_hint.toLowerCase())) {
        return true;
      }
      if (claim.claim_text.includes(a.source_url)) {
        return true;
      }

      // PR number reference in claim text (e.g. "#42" or "PR 42")
      if (a.artifact_type === 'pull_request') {
        const prNumberPattern = new RegExp(`(#|pr\\s*)${a.external_id}\\b`, 'i');
        if (prNumberPattern.test(claim.claim_text)) {
          return true;
        }
      }

      return false;
    });

    if (matchedArtifacts.length > 0) {
      // Insert associations
      for (const artifact of matchedArtifacts) {
        await supabase.from('claim_evidence_associations').upsert(
          {
            claim_id: claim.id,
            artifact_id: artifact.id,
            relevance_note: `Matched via task identifier ${taskIdentifier}`,
            associated_by: 'system',
          },
          { onConflict: 'claim_id,artifact_id' }
        );
      }

      // Compute assessment summary
      const assessment = assessClaimEvidence(
        { claim_text: claim.claim_text, claim_type: claim.claim_type, review_state: claim.review_state },
        matchedArtifacts
      );

      // Update claim with assessment summary
      await supabase
        .from('work_claims')
        .update({
          assessment_summary: assessment as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.id);

      matchedClaimsCount++;
    }
  }

  return matchedClaimsCount;
}
