import { describe, it, expect } from 'vitest';
import { assessClaimEvidence } from '../matcher';
import type { EvidenceArtifact } from '@/types/database';

describe('Evidence Assessment Engine', () => {
  const baseArtifact: EvidenceArtifact = {
    id: 'art-1',
    workspace_id: 'ws-1',
    repository_id: 'repo-1',
    artifact_type: 'pull_request',
    external_id: '42',
    title: 'feat: add password reset support',
    source_url: 'https://github.com/acme/core/pull/42',
    author_login: 'bruce',
    author_github_id: 12345,
    commit_sha: '7a8b9c0',
    head_branch: 'feat/auth-reset',
    base_branch: 'main',
    artifact_state: 'merged',
    is_merged: true,
    merged_at: '2026-10-16T12:00:00Z',
    check_conclusion: null,
    task_id: 'task-1',
    matched_task_identifier: 'CORE-14',
    match_method: 'explicit_task_id',
    metadata: {},
    created_at_external: '2026-10-16T10:00:00Z',
    updated_at_external: '2026-10-16T12:00:00Z',
    last_sync_at: '2026-10-16T12:30:00Z',
  };

  it('evaluates insufficient evidence when no artifacts exist', () => {
    const assessment = assessClaimEvidence(
      { claim_text: 'Implemented password reset in PR #42', claim_type: 'implementation' },
      []
    );
    expect(assessment.triageCategory).toBe('insufficient');
    expect(assessment.artifactCounts.pullRequests).toBe(0);
    expect(assessment.unsupportedPoints).toContain('No pull request found');
  });

  it('evaluates supporting_found when PR is merged and CI passed', () => {
    const checkArtifact: EvidenceArtifact = {
      ...baseArtifact,
      id: 'art-2',
      artifact_type: 'check_run',
      external_id: 'chk-1',
      title: 'unit-tests',
      artifact_state: 'completed',
      check_conclusion: 'success',
    };

    const reviewArtifact: EvidenceArtifact = {
      ...baseArtifact,
      id: 'art-3',
      artifact_type: 'review',
      external_id: 'rev-1',
      title: 'Review on PR #42',
      artifact_state: 'APPROVED',
    };

    const assessment = assessClaimEvidence(
      { claim_text: 'Completed authentication reset. PR #42 merged.', claim_type: 'completion' },
      [baseArtifact, checkArtifact, reviewArtifact]
    );

    expect(assessment.triageCategory).toBe('supporting_found');
    expect(assessment.supportedPoints.length).toBeGreaterThanOrEqual(2);
    expect(assessment.conflicts.length).toBe(0);
  });

  it('evaluates conflicting_found when member claims done but PR is still open and checks fail', () => {
    const openPrArtifact: EvidenceArtifact = {
      ...baseArtifact,
      artifact_state: 'open',
      is_merged: false,
      merged_at: null,
    };

    const failedCheckArtifact: EvidenceArtifact = {
      ...baseArtifact,
      id: 'art-2',
      artifact_type: 'check_run',
      external_id: 'chk-1',
      title: 'token-expiry-tests',
      artifact_state: 'completed',
      check_conclusion: 'failure',
    };

    const assessment = assessClaimEvidence(
      { claim_text: 'Implementation is complete and merged.', claim_type: 'completion' },
      [openPrArtifact, failedCheckArtifact]
    );

    expect(assessment.triageCategory).toBe('conflicting_found');
    expect(assessment.conflicts.some((c) => c.includes('still open'))).toBe(true);
    expect(assessment.conflicts.some((c) => c.includes('failure'))).toBe(true);
  });

  it('evaluates partially_supported when work is open and in progress without conflicts', () => {
    const openPrArtifact: EvidenceArtifact = {
      ...baseArtifact,
      artifact_state: 'open',
      is_merged: false,
      merged_at: null,
    };

    const assessment = assessClaimEvidence(
      { claim_text: 'Still working on password reset email templates.', claim_type: 'progress_update' },
      [openPrArtifact]
    );

    expect(assessment.triageCategory).toBe('partially_supported');
    expect(assessment.conflicts.length).toBe(0);
  });
});
