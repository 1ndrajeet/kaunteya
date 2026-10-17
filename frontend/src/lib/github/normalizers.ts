/**
 * TaskPilot — GitHub Data Normalizers
 * Parses and sanitizes raw GitHub API responses into bounded domain models.
 */

import type {
  RepositoryMetadata,
  ContributorRecord,
  CommitRecord,
  PullRequestRecord,
  IssueRecord,
  ReviewRecord,
  CheckRunRecord,
} from './types';

export function normalizeRepository(
  raw: any,
  readmeContent: string | null = null,
  packageManifests: Record<string, unknown> = {}
): RepositoryMetadata {
  return {
    githubRepoId: raw.id,
    owner: raw.owner?.login || '',
    name: raw.name,
    fullName: raw.full_name,
    repoUrl: raw.html_url,
    description: raw.description || null,
    isPrivate: Boolean(raw.private),
    defaultBranch: raw.default_branch || 'main',
    primaryLanguage: raw.language || null,
    languages: raw.languages || {},
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    starsCount: raw.stargazers_count ?? 0,
    forksCount: raw.forks_count ?? 0,
    openIssuesCount: raw.open_issues_count ?? 0,
    readmeContent: readmeContent ? readmeContent.slice(0, 15000) : null,
    packageManifests,
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
    pushedAt: raw.pushed_at || null,
  };
}

export function normalizeContributor(raw: any): ContributorRecord {
  return {
    githubUserId: raw.id,
    login: raw.login,
    avatarUrl: raw.avatar_url || null,
    htmlUrl: raw.html_url || null,
    contributionsCount: raw.contributions ?? 0,
  };
}

export function normalizeCommit(raw: any): CommitRecord {
  const commitData = raw.commit || {};
  const authorData = commitData.author || {};
  const committerData = commitData.committer || {};

  return {
    sha: raw.sha,
    message: (commitData.message || '').slice(0, 2000),
    htmlUrl: raw.html_url,
    authorLogin: raw.author?.login || null,
    authorId: raw.author?.id || null,
    authorName: authorData.name || committerData.name || null,
    authorEmail: authorData.email || committerData.email || null,
    date: authorData.date || committerData.date || new Date().toISOString(),
    verified: Boolean(commitData.verification?.verified),
  };
}

export function normalizePullRequest(
  raw: any,
  reviews: ReviewRecord[] = [],
  checks: CheckRunRecord[] = []
): PullRequestRecord {
  const isMerged = Boolean(raw.merged_at);
  const state: 'open' | 'closed' | 'merged' = isMerged
    ? 'merged'
    : raw.state === 'closed'
    ? 'closed'
    : 'open';

  return {
    id: raw.id,
    number: raw.number,
    title: raw.title || '',
    body: (raw.body || '').slice(0, 5000),
    state,
    isMerged,
    mergedAt: raw.merged_at || null,
    htmlUrl: raw.html_url,
    authorLogin: raw.user?.login || null,
    authorId: raw.user?.id || null,
    headBranch: raw.head?.ref || '',
    baseBranch: raw.base?.ref || '',
    headSha: raw.head?.sha || '',
    draft: Boolean(raw.draft),
    labels: Array.isArray(raw.labels) ? raw.labels.map((l: any) => l.name || String(l)) : [],
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
    closedAt: raw.closed_at || null,
    reviews,
    checks,
  };
}

export function normalizeIssue(raw: any): IssueRecord {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title || '',
    body: (raw.body || '').slice(0, 5000),
    state: raw.state === 'closed' ? 'closed' : 'open',
    stateReason: raw.state_reason || null,
    htmlUrl: raw.html_url,
    authorLogin: raw.user?.login || null,
    authorId: raw.user?.id || null,
    assignees: Array.isArray(raw.assignees) ? raw.assignees.map((a: any) => a.login) : [],
    labels: Array.isArray(raw.labels) ? raw.labels.map((l: any) => l.name || String(l)) : [],
    commentsCount: raw.comments ?? 0,
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
    closedAt: raw.closed_at || null,
  };
}

export function normalizeReview(raw: any): ReviewRecord {
  return {
    id: raw.id,
    reviewerLogin: raw.user?.login || null,
    reviewerId: raw.user?.id || null,
    state: (raw.state || 'COMMENTED').toUpperCase(),
    submittedAt: raw.submitted_at || null,
    htmlUrl: raw.html_url || '',
  };
}

export function normalizeCheckRun(raw: any, commitSha: string): CheckRunRecord {
  return {
    id: raw.id,
    name: raw.name || 'Check',
    status: raw.status || 'completed',
    conclusion: raw.conclusion || null,
    htmlUrl: raw.html_url || null,
    completedAt: raw.completed_at || null,
    commitSha,
  };
}
