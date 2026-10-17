/**
 * TaskPilot — Universal GitHub Data Types
 * Strongly typed representations of normalized GitHub source data.
 */

export interface RepositoryMetadata {
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  repoUrl: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  topics: string[];
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  readmeContent: string | null;
  packageManifests: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

export interface ContributorRecord {
  githubUserId: number;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  contributionsCount: number;
  taskpilotUserId?: string | null;
}

export interface CommitRecord {
  sha: string;
  message: string;
  htmlUrl: string;
  authorLogin: string | null;
  authorId: number | null;
  authorName: string | null;
  authorEmail: string | null;
  date: string;
  verified: boolean;
}

export interface PullRequestRecord {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  isMerged: boolean;
  mergedAt: string | null;
  htmlUrl: string;
  authorLogin: string | null;
  authorId: number | null;
  headBranch: string;
  baseBranch: string;
  headSha: string;
  draft: boolean;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  reviews: ReviewRecord[];
  checks: CheckRunRecord[];
}

export interface IssueRecord {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  stateReason: string | null;
  htmlUrl: string;
  authorLogin: string | null;
  authorId: number | null;
  assignees: string[];
  labels: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface ReviewRecord {
  id: number;
  reviewerLogin: string | null;
  reviewerId: number | null;
  state: string; // 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submittedAt: string | null;
  htmlUrl: string;
}

export interface CheckRunRecord {
  id: number;
  name: string;
  status: string; // 'queued' | 'in_progress' | 'completed'
  conclusion: string | null; // 'success' | 'failure' | 'neutral' | 'timed_out' | etc.
  htmlUrl: string | null;
  completedAt: string | null;
  commitSha: string;
}

/**
 * Normalized evidence package provided to the Gemini task runner.
 * Bounded and sanitized to exclude binary content or massive histories.
 */
export interface RepositoryEvidencePackage {
  repository: RepositoryMetadata;
  contributors: ContributorRecord[];
  recentCommits: CommitRecord[];
  openPullRequests: PullRequestRecord[];
  recentMergedPullRequests: PullRequestRecord[];
  openIssues: IssueRecord[];
  recentClosedIssues: IssueRecord[];
  activeCheckSummaries: CheckRunRecord[];
  collectedAt: string;
}
