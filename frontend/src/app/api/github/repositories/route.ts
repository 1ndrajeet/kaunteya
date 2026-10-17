import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { getInstallationOctokit } from '@/lib/github/app-auth';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required', code: 'MISSING_PARAM' }, { status: 400 });
  }

  // 1. Verify caller has membership in workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: 'Not a member of this workspace', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // 2. Fetch active installation row for this workspace
  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;
  const { data: inst, error: instError } = await dbClient
    .from('github_installations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (instError) {
    console.error('[GitHub Repositories] Error querying installation:', instError);
    return NextResponse.json({ error: 'Database query failed', code: 'DB_ERROR' }, { status: 500 });
  }

  if (!inst) {
    return NextResponse.json(
      {
        error: 'No GitHub installation found for this workspace',
        code: 'NO_INSTALLATION',
        connected: false,
        repositories: [],
      },
      { status: 404 }
    );
  }

  if (inst.connection_status !== 'active') {
    return NextResponse.json(
      {
        error: `GitHub installation is ${inst.connection_status}`,
        code: 'INSTALLATION_INACTIVE',
        status: inst.connection_status,
        connected: false,
        repositories: [],
      },
      { status: 403 }
    );
  }

  // 3. Authenticate with GitHub App installation and fetch ALL accessible repositories with pagination
  try {
    const octokit = await getInstallationOctokit(inst.github_installation_id);

    let page = 1;
    const allRepos: any[] = [];
    while (true) {
      const res = await octokit.apps.listReposAccessibleToInstallation({
        per_page: 100,
        page,
      });

      const pageRepos = res.data.repositories || [];
      allRepos.push(...pageRepos);

      const totalCount = res.data.total_count ?? allRepos.length;
      if (pageRepos.length < 100 || allRepos.length >= totalCount) {
        break;
      }
      page++;
    }

    // 4. Reconcile repositories in public.github_repositories
    const activeRepoIds = new Set<number>();
    for (const r of allRepos) {
      activeRepoIds.add(r.id);
      await dbClient.from('github_repositories').upsert(
        {
          workspace_id: workspaceId,
          installation_id: inst.id,
          github_repo_id: r.id,
          name: r.name,
          full_name: r.full_name,
          repo_url: r.html_url,
          is_private: r.private,
          default_branch: r.default_branch || 'main',
          description: r.description || null,
          primary_language: r.language || null,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,github_repo_id' }
      );
    }

    // 5. Mark removed repos as disabled (do not delete to preserve historical project links)
    const { data: existingRepos } = await dbClient
      .from('github_repositories')
      .select('id, github_repo_id, is_enabled')
      .eq('workspace_id', workspaceId);

    if (existingRepos) {
      for (const ex of existingRepos) {
        if (!activeRepoIds.has(Number(ex.github_repo_id)) && ex.is_enabled) {
          await dbClient
            .from('github_repositories')
            .update({ is_enabled: false, updated_at: new Date().toISOString() })
            .eq('id', ex.id);
        }
      }
    }

    return NextResponse.json({
      connected: true,
      installation: {
        id: inst.id,
        github_installation_id: inst.github_installation_id,
        account_login: inst.account_login,
        account_type: inst.account_type,
        account_avatar_url: inst.account_avatar_url,
        connection_status: inst.connection_status,
        last_sync_at: inst.last_sync_at,
        updated_at: inst.updated_at,
      },
      repositories: allRepos.map((r: any) => ({
        github_repo_id: r.id,
        name: r.name,
        full_name: r.full_name,
        repo_url: r.html_url,
        is_private: r.private,
        default_branch: r.default_branch || 'main',
        description: r.description || null,
        primary_language: r.language || null,
      })),
    });
  } catch (err: any) {
    // 6. Differentiate rate limits, revoked access, and upstream errors
    const status = err.status || err.response?.status;

    // Rate limit handling
    if (status === 429 || (status === 403 && err.response?.headers?.['x-ratelimit-remaining'] === '0')) {
      const resetHeader = err.response?.headers?.['x-ratelimit-reset'];
      const resetAt = resetHeader
        ? new Date(Number(resetHeader) * 1000).toISOString()
        : new Date(Date.now() + 60 * 1000).toISOString();

      await dbClient
        .from('github_installations')
        .update({
          rate_limit_remaining: 0,
          rate_limit_reset_at: resetAt,
          last_error_code: 'RATE_LIMITED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', inst.id);

      return NextResponse.json(
        {
          error: 'GitHub API rate limit exceeded',
          code: 'RATE_LIMITED',
          reset_at: resetAt,
          connected: true,
          repositories: [],
        },
        { status: 429 }
      );
    }

    // Upstream authorization revoked or installation deleted on GitHub
    if (status === 401 || status === 404) {
      await dbClient
        .from('github_installations')
        .update({
          connection_status: 'revoked',
          last_error_code: 'UPSTREAM_REVOKED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', inst.id);

      return NextResponse.json(
        {
          error: 'GitHub installation access revoked or not found upstream',
          code: 'INSTALLATION_REVOKED',
          connected: false,
          repositories: [],
        },
        { status: 403 }
      );
    }

    console.error(`[GitHub Repositories] Upstream error fetching repos for installation ${inst.github_installation_id}:`, err);
    return NextResponse.json(
      {
        error: err.message || 'Failed to list authorized repositories from GitHub',
        code: 'UPSTREAM_ERROR',
      },
      { status: 502 }
    );
  }
}