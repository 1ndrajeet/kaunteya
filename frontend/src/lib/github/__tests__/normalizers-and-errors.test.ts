import { describe, it, expect } from 'vitest';
import {
  normalizeRepository,
  normalizeCommit,
  normalizePullRequest,
  normalizeIssue,
  normalizeContributor,
} from '../normalizers';
import { categorizeGitHubError, GitHubRateLimitError, GitHubAuthError, GitHubNotFoundError } from '../errors';

describe('GitHub Normalizers', () => {
  it('normalizes repository metadata accurately', () => {
    const rawRepo = {
      id: 123456,
      owner: { login: 'taskpilot-org' },
      name: 'core-engine',
      full_name: 'taskpilot-org/core-engine',
      html_url: 'https://github.com/taskpilot-org/core-engine',
      description: 'The core workflow engine',
      private: true,
      default_branch: 'main',
      language: 'TypeScript',
      topics: ['workflow', 'automation'],
      stargazers_count: 42,
      forks_count: 7,
      open_issues_count: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      pushed_at: '2026-03-01T00:00:00Z',
    };

    const normalized = normalizeRepository(rawRepo as any);
    expect(normalized.githubRepoId).toBe(123456);
    expect(normalized.owner).toBe('taskpilot-org');
    expect(normalized.name).toBe('core-engine');
    expect(normalized.fullName).toBe('taskpilot-org/core-engine');
    expect(normalized.isPrivate).toBe(true);
    expect(normalized.primaryLanguage).toBe('TypeScript');
    expect(normalized.topics).toEqual(['workflow', 'automation']);
    expect(normalized.starsCount).toBe(42);
    expect(normalized.forksCount).toBe(7);
  });

  it('normalizes commits with safe truncated messages and verified status', () => {
    const rawCommit = {
      sha: 'abc1234567890abcdef1234567890abcdef12345',
      commit: {
        message: 'feat: add task router\n\nLong body details',
        author: {
          name: 'Bruce Wayne',
          email: 'bruce@wayne.corp',
          date: '2026-03-01T12:00:00Z',
        },
        verification: { verified: true },
      },
      author: {
        id: 999,
        login: 'brucewayne',
      },
      html_url: 'https://github.com/org/repo/commit/abc1234',
    };

    const commit = normalizeCommit(rawCommit as any);
    expect(commit.sha).toBe('abc1234567890abcdef1234567890abcdef12345');
    expect(commit.authorLogin).toBe('brucewayne');
    expect(commit.authorId).toBe(999);
    expect(commit.verified).toBe(true);
    expect(commit.message).toContain('feat: add task router');
  });

  it('normalizes PRs preserving draft status, reviews, and checks', () => {
    const rawPR = {
      id: 555,
      number: 10,
      title: 'Fix issue with session refresh',
      body: 'Detailed fix description',
      state: 'open',
      draft: true,
      html_url: 'https://github.com/org/repo/pull/10',
      user: { id: 101, login: 'dev1' },
      head: { ref: 'fix/session', sha: 'head123' },
      base: { ref: 'main' },
      labels: [{ name: 'bug' }],
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T11:00:00Z',
      closed_at: null,
      merged_at: null,
    };

    const pr = normalizePullRequest(rawPR as any, [], []);
    expect(pr.number).toBe(10);
    expect(pr.state).toBe('open');
    expect(pr.draft).toBe(true);
    expect(pr.authorLogin).toBe('dev1');
    expect(pr.headBranch).toBe('fix/session');
    expect(pr.baseBranch).toBe('main');
    expect(pr.labels).toEqual(['bug']);
  });

  it('normalizes issues and ignores PR metadata', () => {
    const rawIssue = {
      id: 777,
      number: 12,
      title: 'Database connection pool exhausted',
      body: 'Occurs under high load',
      state: 'open',
      state_reason: null,
      html_url: 'https://github.com/org/repo/issues/12',
      user: { id: 202, login: 'reporter1' },
      assignees: [{ login: 'dev2' }],
      labels: [{ name: 'performance' }],
      comments: 3,
      created_at: '2026-03-01T09:00:00Z',
      updated_at: '2026-03-01T09:30:00Z',
      closed_at: null,
    };

    const issue = normalizeIssue(rawIssue as any);
    expect(issue.number).toBe(12);
    expect(issue.title).toBe('Database connection pool exhausted');
    expect(issue.authorLogin).toBe('reporter1');
    expect(issue.assignees).toEqual(['dev2']);
    expect(issue.commentsCount).toBe(3);
  });

  it('normalizes contributors with login and contribution count', () => {
    const rawContrib = {
      id: 888,
      login: 'contributor1',
      avatar_url: 'https://avatars.githubusercontent.com/u/888',
      html_url: 'https://github.com/contributor1',
      contributions: 42,
    };

    const contributor = normalizeContributor(rawContrib as any);
    expect(contributor.githubUserId).toBe(888);
    expect(contributor.login).toBe('contributor1');
    expect(contributor.contributionsCount).toBe(42);
  });
});

describe('GitHub Error Categorization', () => {
  it('correctly categorizes rate limit errors', () => {
    const err = {
      status: 403,
      message: 'API rate limit exceeded',
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1800000000',
        },
      },
    };

    const categorized = categorizeGitHubError(err);
    expect(categorized).toBeInstanceOf(GitHubRateLimitError);
    expect(categorized.statusCode).toBe(429);
  });

  it('correctly categorizes authentication errors', () => {
    const err = { status: 401, message: 'Bad credentials' };
    const categorized = categorizeGitHubError(err);
    expect(categorized).toBeInstanceOf(GitHubAuthError);
    expect(categorized.statusCode).toBe(401);
  });

  it('correctly categorizes not found errors', () => {
    const err = { status: 404, message: 'Not Found' };
    const categorized = categorizeGitHubError(err);
    expect(categorized).toBeInstanceOf(GitHubNotFoundError);
    expect(categorized.statusCode).toBe(404);
  });
});
