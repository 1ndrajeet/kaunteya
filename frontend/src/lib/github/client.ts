import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

export interface GithubClientOptions {
  installationId?: number;
  appId?: string;
  privateKey?: string;
  token?: string;
}

/**
 * Creates an authenticated Octokit instance.
 * Prioritizes GitHub App Installation authentication using installationId + appId + privateKey.
 * Falls back to Personal Access Token or environment variables if configured.
 */
export function getGithubClient(options: GithubClientOptions = {}): Octokit {
  const appId = options.appId || process.env.GITHUB_APP_ID;
  const privateKey = options.privateKey || process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = options.installationId || (process.env.GITHUB_INSTALLATION_ID ? parseInt(process.env.GITHUB_INSTALLATION_ID, 10) : undefined);
  const token = options.token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  // 1. GitHub App Installation Auth (Preferred production path)
  if (appId && privateKey && installationId) {
    // Normalize private key formatting (newlines if passed via env)
    const formattedKey = privateKey.replace(/\\n/g, '\n');
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey: formattedKey,
        installationId,
      },
      userAgent: 'TaskPilot-SaaS/3.0.0',
    });
  }

  // 2. Personal Access Token or Fallback Token
  if (token) {
    return new Octokit({
      auth: token,
      userAgent: 'TaskPilot-SaaS/3.0.0',
    });
  }

  // 3. Unauthenticated Octokit for public repository reads
  return new Octokit({
    userAgent: 'TaskPilot-SaaS/3.0.0',
  });
}

export interface FetchedPullRequest {
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
  createdAt: string;
  updatedAt: string;
}

export interface FetchedCommit {
  sha: string;
  message: string;
  htmlUrl: string;
  authorLogin: string | null;
  authorId: number | null;
  authorName: string | null;
  date: string;
}

export interface FetchedReview {
  id: number;
  reviewerLogin: string | null;
  reviewerId: number | null;
  state: string; // 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submittedAt: string | null;
  htmlUrl: string;
}

export interface FetchedCheckRun {
  id: number;
  name: string;
  status: string; // 'queued' | 'in_progress' | 'completed'
  conclusion: string | null; // 'success' | 'failure' | 'neutral' | 'timed_out' | etc.
  htmlUrl: string | null;
  completedAt: string | null;
  commitSha: string;
}

/**
 * Fetch pull requests with bounded limit.
 */
export async function fetchRepositoryPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit: number = 25
): Promise<FetchedPullRequest[]> {
  try {
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: Math.min(limit, 50),
      sort: 'updated',
      direction: 'desc',
    });

    return prs.map((pr) => {
      const isMerged = !!pr.merged_at;
      const state = isMerged ? 'merged' : (pr.state as 'open' | 'closed');

      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body || null,
        state,
        isMerged,
        mergedAt: pr.merged_at || null,
        htmlUrl: pr.html_url,
        authorLogin: pr.user?.login || null,
        authorId: pr.user?.id || null,
        headBranch: pr.head?.ref || '',
        baseBranch: pr.base?.ref || '',
        headSha: pr.head?.sha || '',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      };
    });
  } catch (err: any) {
    console.error(`[GitHub Client] Error fetching PRs for ${owner}/${repo}:`, err?.message);
    throw err;
  }
}

/**
 * Fetch reviews for a specific pull request.
 */
export async function fetchPullRequestReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<FetchedReview[]> {
  try {
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 30,
    });

    return reviews.map((r) => ({
      id: r.id,
      reviewerLogin: r.user?.login || null,
      reviewerId: r.user?.id || null,
      state: r.state,
      submittedAt: r.submitted_at || null,
      htmlUrl: r.html_url,
    }));
  } catch (err: any) {
    console.error(`[GitHub Client] Error fetching reviews for ${owner}/${repo}#${pullNumber}:`, err?.message);
    return [];
  }
}

/**
 * Fetch commits for a repository with bounded limit.
 */
export async function fetchRepositoryCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit: number = 25
): Promise<FetchedCommit[]> {
  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: Math.min(limit, 50),
    });

    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      htmlUrl: c.html_url,
      authorLogin: c.author?.login || null,
      authorId: c.author?.id || null,
      authorName: c.commit.author?.name || null,
      date: c.commit.author?.date || new Date().toISOString(),
    }));
  } catch (err: any) {
    console.error(`[GitHub Client] Error fetching commits for ${owner}/${repo}:`, err?.message);
    return [];
  }
}

/**
 * Fetch check runs for a specific commit SHA.
 */
export async function fetchCommitCheckRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitSha: string
): Promise<FetchedCheckRun[]> {
  try {
    const { data } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: commitSha,
      per_page: 30,
    });

    return data.check_runs.map((cr) => ({
      id: cr.id,
      name: cr.name,
      status: cr.status,
      conclusion: cr.conclusion,
      htmlUrl: cr.html_url,
      completedAt: cr.completed_at || null,
      commitSha,
    }));
  } catch (err: any) {
    // If Checks API is not available or not permitted, return empty list gracefully
    console.warn(`[GitHub Client] Could not fetch check runs for ${owner}/${repo}@${commitSha.slice(0, 7)}:`, err?.message);
    return [];
  }
}
