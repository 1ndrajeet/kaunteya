import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { getInstallationOctokit } from '@/lib/github/app-auth';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state');
  const setupAction = searchParams.get('setup_action');

  if (!installationId || !state) {
    return NextResponse.redirect(new URL('/workspace?github_error=missing_params', req.url));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(req.url)}`, req.url));
  }

  // 1. Consume state atomically with replay and expiry protection
  const { data: stateRow, error: stateFetchErr } = await supabase
    .from('github_oauth_states')
    .select('*')
    .eq('state_token', state)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (stateFetchErr || !stateRow || stateRow.initiated_by !== user.id) {
    console.error('[GitHub Callback] State validation failed:', { stateFetchErr, stateRow, userId: user.id });
    return NextResponse.redirect(new URL('/workspace?github_error=invalid_state', req.url));
  }

  const workspaceId = stateRow.workspace_id;

  // Mark state token as consumed to prevent replay attacks
  await supabase
    .from('github_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', stateRow.id);

  // 2. Verify workspace admin permission
  const { data: role } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (role?.role !== 'admin') {
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?github_error=not_admin`, req.url)
    );
  }

  // 3. Verify installation with GitHub App API
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !rawKey) {
    console.error('[GitHub Callback] Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY in environment');
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?github_error=server_config_error`, req.url)
    );
  }

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey: rawKey.replace(/\\n/g, '\n'),
    },
  });

  let installation;
  try {
    const { data } = await appOctokit.apps.getInstallation({
      installation_id: Number(installationId),
    });
    installation = data;
  } catch (err: any) {
    console.error(`[GitHub Callback] Failed to verify installation ${installationId}:`, err);
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?github_error=${encodeURIComponent(err.message)}`, req.url)
    );
  }

  // 4. Upsert installation into database
  // Prefer privileged service client if available; otherwise use verified admin client
  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;
  const account = installation.account as any;
  const accountLogin = account?.login || account?.name || `installation-${installation.id}`;
  const accountType: 'User' | 'Organization' = account?.type === 'Organization' ? 'Organization' : 'User';
  const accountAvatar = account?.avatar_url || null;

  const { data: inst, error: instErr } = await dbClient
    .from('github_installations')
    .upsert(
      {
        workspace_id: workspaceId,
        github_installation_id: installation.id,
        account_login: accountLogin,
        account_type: accountType,
        account_avatar_url: accountAvatar,
        connection_status: 'active',
        permissions: installation.permissions,
        installed_by: user.id,
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' }
    )
    .select()
    .single();

  if (instErr || !inst) {
    console.error('[GitHub Callback] Failed to persist installation record:', instErr);
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?github_error=db_write_failed`, req.url)
    );
  }

  // 5. Store secrets if service role is available (server-side only)
  if (hasServiceRoleKey()) {
    try {
      const serviceClient = createServiceClient();
      await serviceClient.from('github_installation_secrets').upsert(
        {
          installation_id: inst.id,
          app_id: appId,
          private_key: rawKey,
          webhook_secret: process.env.GITHUB_WEBHOOK_SECRET || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'installation_id' }
      );
    } catch (secErr) {
      console.warn('[GitHub Callback] Could not update installation secrets vault:', secErr);
    }
  }

  // 6. Pre-populate authorized repositories for immediate project selection
  try {
    const octokit = await getInstallationOctokit(installation.id);
    let page = 1;
    const allRepos: any[] = [];
    while (true) {
      const res = await octokit.apps.listReposAccessibleToInstallation({
        per_page: 100,
        page,
      });
      const pageRepos = res.data.repositories || [];
      allRepos.push(...pageRepos);
      if (pageRepos.length < 100 || allRepos.length >= (res.data.total_count || 0)) {
        break;
      }
      page++;
    }

    for (const r of allRepos) {
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
  } catch (repoSyncErr) {
    console.warn('[GitHub Callback] Non-fatal: could not pre-fetch authorized repositories:', repoSyncErr);
  }

  // 7. Audit log event
  await dbClient.from('activity_events').insert({
    workspace_id: workspaceId,
    actor_id: user.id,
    entity_type: 'workspace',
    entity_id: workspaceId,
    event_type: 'github_connected',
    metadata: {
      account_login: accountLogin,
      installation_id: installation.id,
      setup_action: setupAction,
    },
  });

  return NextResponse.redirect(
    new URL(`/workspace/${workspaceId}/admin/integrations?github_connected=1`, req.url)
  );
}