import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { syncRepositoryEvidence } from '@/lib/github/sync';
import crypto from 'crypto';

export const runtime = 'nodejs';

function timingSafeMatch(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Protected GitHub Repository Synchronization Endpoint.
 * Supports two explicit authorization paths:
 * 1. User-triggered: Verified session + workspace membership + active installation check.
 * 2. Scheduled/cron: Verified Bearer token matching CRON_SECRET using timing-safe comparison.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body', code: 'INVALID_JSON' }, { status: 400 });
  }

  const { repositoryId, workspaceId } = body;
  if (!repositoryId || !workspaceId) {
    return NextResponse.json(
      { error: 'Missing required parameters: repositoryId and workspaceId', code: 'MISSING_PARAMS' },
      { status: 400 }
    );
  }

  if (!UUID_REGEX.test(repositoryId) || !UUID_REGEX.test(workspaceId)) {
    return NextResponse.json(
      { error: 'Malformed identifier: repositoryId and workspaceId must be valid UUIDs', code: 'MALFORMED_ID' },
      { status: 400 }
    );
  }

  let authContext: 'cron' | 'user' = 'user';
  let dbClient: any;

  // 1. Cron Auth Path
  if (authHeader?.startsWith('Bearer ')) {
    authContext = 'cron';
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.warn('[GitHub Sync] Cron authorization attempted but CRON_SECRET is not configured on server');
      return NextResponse.json(
        { error: 'Cron synchronization is not configured on this server', code: 'CRON_NOT_CONFIGURED' },
        { status: 401 }
      );
    }

    const providedToken = authHeader.slice('Bearer '.length).trim();
    if (!timingSafeMatch(cronSecret, providedToken)) {
      return NextResponse.json({ error: 'Invalid cron credentials', code: 'INVALID_CRON_CREDENTIALS' }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY missing for cron sync', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    dbClient = createServiceClient();
  } else {
    // 2. User-triggered Auth Path
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated session', code: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // Verify workspace membership and role (admin, lead, member can trigger sync)
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['admin', 'lead', 'member'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Access denied: caller is not an authorized workspace member', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;
  }

  // 3. Validate repository and active installation
  const { data: repo, error: repoFetchErr } = await dbClient
    .from('github_repositories')
    .select(`
      id,
      workspace_id,
      installation_id,
      is_enabled,
      sync_status,
      last_sync_at,
      updated_at,
      installation:github_installations (
        id,
        connection_status
      )
    `)
    .eq('id', repositoryId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (repoFetchErr || !repo || !repo.is_enabled) {
    return NextResponse.json(
      { error: 'Repository not found or not enabled in this workspace', code: 'REPO_NOT_FOUND' },
      { status: 404 }
    );
  }

  if (repo.installation && repo.installation.connection_status !== 'active') {
    return NextResponse.json(
      {
        error: `GitHub installation is ${repo.installation.connection_status}. Reconnect GitHub before syncing.`,
        code: 'INSTALLATION_INACTIVE',
      },
      { status: 400 }
    );
  }

  // 4. Job Deduplication & Rate Limiting (Prevent concurrent repeated syncs)
  if (repo.sync_status === 'syncing') {
    const lastUpdate = repo.updated_at ? new Date(repo.updated_at).getTime() : 0;
    const elapsedMinutes = (Date.now() - lastUpdate) / (1000 * 60);

    // If syncing and last update was less than 2 minutes ago, reject concurrent job
    if (elapsedMinutes < 2) {
      return NextResponse.json(
        {
          error: 'A synchronization job is already in progress for this repository.',
          code: 'SYNC_IN_PROGRESS',
          inProgress: true,
        },
        { status: 409 }
      );
    }
    // If older than 2 minutes, treat as stale job and allow recovery
    console.warn(`[GitHub Sync] Recovering stale sync job for repository ${repositoryId} (elapsed: ${elapsedMinutes.toFixed(1)}m)`);
  }

  // 5. Run Evidence Synchronization
  const result = await syncRepositoryEvidence({
    repositoryId,
    workspaceId,
    supabase: dbClient,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Sync failed', code: 'SYNC_FAILED' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    authContext,
    artifactsSyncedCount: result.artifactsSyncedCount,
    matchedClaimsCount: result.matchedClaimsCount,
  });
}
