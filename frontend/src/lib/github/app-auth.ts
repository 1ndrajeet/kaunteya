import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

/**
 * Creates an authenticated Octokit instance for a specific GitHub App installation.
 * Uses GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY from server environment.
 */
export async function getInstallationOctokit(installationId: number | string): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !rawKey) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY in server environment');
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId: Number(installationId),
    },
    userAgent: 'TaskPilot-SaaS/3.0.0',
  });
}
