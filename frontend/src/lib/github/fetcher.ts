/**
 * TaskPilot — Universal GitHub Data Fetcher
 * Resilient, bounded data ingestion layer using authenticated Octokit instances.
 */

import { Octokit } from '@octokit/rest';
import type {
  RepositoryMetadata,
  ContributorRecord,
  CommitRecord,
  PullRequestRecord,
  IssueRecord,
  ReviewRecord,
  CheckRunRecord,
  RepositoryEvidencePackage,
} from './types';
import {
  normalizeRepository,
  normalizeContributor,
  normalizeCommit,
  normalizePullRequest,
  normalizeIssue,
  normalizeReview,
  normalizeCheckRun,
} from './normalizers';
import { categorizeGitHubError } from './errors';

/**
 * Fetches repository metadata, languages, README, and configuration manifests.
 */
export async function fetchRepositoryDetails(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<RepositoryMetadata> {
  try {
    const [repoRes, langRes] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listLanguages({ owner, repo }).catch(() => ({ data: {} })),
    ]);

    // Optional README fetch (safe 404 handling)
    let readmeText: string | null = null;
    try {
      const readmeRes = await octokit.rest.repos.getReadme({
        owner,
        repo,
        mediaType: { format: 'raw' },
      });
      if (typeof readmeRes.data === 'string') {
        readmeText = readmeRes.data;
      }
    } catch {
      // README may not exist, ignore gracefully
    }

    // Optional package.json manifest fetch
    let packageManifest: Record<string, unknown> = {};
    try {
      const pkgRes = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });
      if ('content' in pkgRes.data && pkgRes.data.content) {
        const decoded = Buffer.from(pkgRes.data.content, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        packageManifest = {
          name: parsed.name,
          dependencies: Object.keys(parsed.dependencies || {}).slice(0, 30),
          devDependencies: Object.keys(parsed.devDependencies || {}).slice(0, 30),
          scripts: Object.keys(parsed.scripts || {}),
        };
      }
    } catch {
      // package.json might not exist, ignore gracefully
    }

    const raw = {
      ...repoRes.data,
      languages: langRes.data || {},
    };

    return normalizeRepository(raw, readmeText, packageManifest);
  } catch (err) {
    throw categorizeGitHubError(err);
  }
}

/**
 * Fetches bounded contributors list.
 */
export async function fetchRepositoryContributors(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit = 30
): Promise<ContributorRecord[]> {
  try {
    const { data } = await octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: Math.min(limit, 50),
    });

    return (data || []).map(normalizeContributor);
  } catch (err) {
    // Some repos (or empty repos) can error on contributors
    console.warn(`[GitHub Fetcher] Could not list contributors for ${owner}/${repo}:`, (err as any)?.message);
    return [];
  }
}

/**
 * Fetches bounded commits list.
 */
export async function fetchRepositoryCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit = 25
): Promise<CommitRecord[]> {
  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: Math.min(limit, 50),
    });

    return (data || []).map(normalizeCommit);
  } catch (err) {
    console.warn(`[GitHub Fetcher] Could not list commits for ${owner}/${repo}:`, (err as any)?.message);
    return [];
  }
}

/**
 * Fetches reviews for a given PR.
 */
export async function fetchPullRequestReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<ReviewRecord[]> {
  try {
    const { data } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 20,
    });
    return (data || []).map(normalizeReview);
  } catch {
    return [];
  }
}

/**
 * Fetches checks for a given commit SHA.
 */
export async function fetchCommitCheckRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitSha: string
): Promise<CheckRunRecord[]> {
  try {
    const { data } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: commitSha,
      per_page: 20,
    });
    return (data.check_runs || []).map((cr) => normalizeCheckRun(cr, commitSha));
  } catch {
    return [];
  }
}

/**
 * Fetches pull requests with review and check summaries for active PRs.
 */
export async function fetchRepositoryPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit = 25
): Promise<PullRequestRecord[]> {
  try {
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: Math.min(limit, 50),
    });

    const results: PullRequestRecord[] = [];

    for (const pr of prs || []) {
      let reviews: ReviewRecord[] = [];
      let checks: CheckRunRecord[] = [];

      // Only fetch reviews and checks for open PRs or latest 5 merged PRs to preserve rate limits
      if (pr.state === 'open' && pr.head?.sha) {
        [reviews, checks] = await Promise.all([
          fetchPullRequestReviews(octokit, owner, repo, pr.number),
          fetchCommitCheckRuns(octokit, owner, repo, pr.head.sha),
        ]);
      }

      results.push(normalizePullRequest(pr, reviews, checks));
    }

    return results;
  } catch (err) {
    throw categorizeGitHubError(err);
  }
}

/**
 * Fetches bounded issues, strictly filtering out pull requests.
 */
export async function fetchRepositoryIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit = 25
): Promise<IssueRecord[]> {
  try {
    const { data: rawIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: Math.min(limit, 50),
    });

    // GitHub's issues endpoint returns both issues and PRs (PRs have pull_request key)
    const pureIssues = (rawIssues || []).filter((item: any) => !item.pull_request);

    return pureIssues.map(normalizeIssue);
  } catch (err) {
    throw categorizeGitHubError(err);
  }
}

/**
 * Assembles a complete, normalized repository evidence package.
 * Used for initial project creation, repository refresh, and Gemini context generation.
 */
export async function fetchFullEvidencePackage(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<RepositoryEvidencePackage> {
  const [repository, contributors, commits, pullRequests, issues] = await Promise.all([
    fetchRepositoryDetails(octokit, owner, repo),
    fetchRepositoryContributors(octokit, owner, repo, 25),
    fetchRepositoryCommits(octokit, owner, repo, 25),
    fetchRepositoryPullRequests(octokit, owner, repo, 25),
    fetchRepositoryIssues(octokit, owner, repo, 25),
  ]);

  const openPRs = pullRequests.filter((pr) => pr.state === 'open');
  const recentMergedPRs = pullRequests.filter((pr) => pr.isMerged).slice(0, 10);
  const openIssues = issues.filter((i) => i.state === 'open');
  const recentClosedIssues = issues.filter((i) => i.state === 'closed').slice(0, 10);

  const activeChecks = openPRs.flatMap((pr) => pr.checks);

  return {
    repository,
    contributors,
    recentCommits: commits,
    openPullRequests: openPRs,
    recentMergedPullRequests: recentMergedPRs,
    openIssues,
    recentClosedIssues,
    activeCheckSummaries: activeChecks,
    collectedAt: new Date().toISOString(),
  };
}
