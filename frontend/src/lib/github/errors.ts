/**
 * TaskPilot — GitHub Integration Error Categories
 */

export type GitHubErrorCategory =
  | 'RATE_LIMITED'
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INSTALLATION_REVOKED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class GitHubAPIError extends Error {
  public readonly category: GitHubErrorCategory;
  public readonly statusCode?: number;
  public readonly rateLimitResetAt?: Date;

  constructor(
    message: string,
    category: GitHubErrorCategory,
    statusCode?: number,
    rateLimitResetAt?: Date
  ) {
    super(message);
    this.name = 'GitHubAPIError';
    this.category = category;
    this.statusCode = statusCode;
    this.rateLimitResetAt = rateLimitResetAt;
  }
}

export class GitHubRateLimitError extends GitHubAPIError {
  constructor(resetAt: Date, remaining = 0) {
    super(
      `GitHub API rate limit reached (${remaining} remaining). Resets at ${resetAt.toISOString()}`,
      'RATE_LIMITED',
      429,
      resetAt
    );
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubAuthError extends GitHubAPIError {
  constructor(message = 'GitHub authentication or authorization failed') {
    super(message, 'UNAUTHENTICATED', 401);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubNotFoundError extends GitHubAPIError {
  constructor(repoName: string) {
    super(`GitHub repository not found: ${repoName}`, 'NOT_FOUND', 404);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubInstallationRevokedError extends GitHubAPIError {
  constructor(installationId: number) {
    super(
      `GitHub App installation ${installationId} has been suspended or revoked.`,
      'INSTALLATION_REVOKED',
      403
    );
    this.name = 'GitHubInstallationRevokedError';
  }
}

/**
 * Normalizes any error from Octokit or network into a typed GitHubAPIError.
 */
export function categorizeGitHubError(err: any): GitHubAPIError {
  if (err instanceof GitHubAPIError) {
    return err;
  }

  const status = err?.status || err?.statusCode || 500;
  const headers = err?.response?.headers || {};

  // Check rate limit
  if (status === 403 && headers['x-ratelimit-remaining'] === '0') {
    const resetTime = headers['x-ratelimit-reset']
      ? new Date(Number(headers['x-ratelimit-reset']) * 1000)
      : new Date(Date.now() + 60000);
    return new GitHubRateLimitError(resetTime, 0);
  }

  if (status === 401) {
    return new GitHubAuthError(err?.message || 'Unauthorized GitHub request');
  }

  if (status === 404) {
    return new GitHubNotFoundError(err?.message || 'Resource not found');
  }

  if (status === 403 && err?.message?.toLowerCase().includes('suspended')) {
    return new GitHubInstallationRevokedError(0);
  }

  return new GitHubAPIError(
    err?.message || 'An unexpected GitHub error occurred',
    status >= 500 ? 'NETWORK_ERROR' : 'UNKNOWN',
    status
  );
}
