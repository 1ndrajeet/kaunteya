import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { randomBytes } from 'crypto';
import { WebClient } from '@slack/web-api';
import { resolveSlackRedirectUri } from '@/lib/slack/client';

const DEFAULT_SLACK_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'chat:write',
  'chat:write.public',
  'groups:history',
  'im:history',
  'mpim:history',
  'users:read',
  'users:read.email',
  'team:read',
].join(',');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId query parameter is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(req.url)}`, req.url));
  }

  // Verify workspace admin permission
  const { data: role } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (role?.role !== 'admin') {
    return NextResponse.json({ error: 'Only workspace admins can install the Slack App' }, { status: 403 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Server configuration error: SLACK_CLIENT_ID is not configured' },
      { status: 500 }
    );
  }

  const redirectUri = resolveSlackRedirectUri(req.url);

  // Generate single-use CSRF state token
  const stateToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;
  const { error: stateErr } = await dbClient.from('slack_oauth_states').insert({
    state_token: stateToken,
    workspace_id: workspaceId,
    initiated_by: user.id,
    action: 'install',
    expires_at: expiresAt,
  });

  if (stateErr) {
    console.error('[Slack Install] Failed to persist OAuth state:', stateErr);
    return NextResponse.json({ error: 'Failed to create OAuth state token' }, { status: 500 });
  }

  const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('scope', DEFAULT_SLACK_SCOPES);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', stateToken);

  return NextResponse.redirect(authorizeUrl.toString());
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, teamId, teamName, botUserId, botToken, signingSecret, defaultChannelId } = body;

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  // Verify workspace admin permission
  const { data: role } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (role?.role !== 'admin') {
    return NextResponse.json({ error: 'Only workspace admins can manage Slack integration' }, { status: 403 });
  }

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  // Path A: Direct credential connection (server-side privileged insert avoiding RLS failure)
  if (teamId && botToken) {
    try {
      // 1. Verify token with Slack auth.test
      const testClient = new WebClient(botToken.trim());
      const authTest = await testClient.auth.test();

      if (!authTest.ok || !authTest.team_id) {
        return NextResponse.json({ error: `Slack auth verification failed: ${authTest.error || 'invalid_token'}` }, { status: 400 });
      }

      const verifiedTeamId = authTest.team_id;
      const verifiedTeamName = teamName?.trim() || authTest.team || 'Slack Workspace';
      const verifiedBotUserId = botUserId?.trim() || authTest.user_id || 'U_BOT';

      // 2. Upsert installation record
      const { data: inst, error: instErr } = await dbClient
        .from('slack_installations')
        .upsert(
          {
            workspace_id: workspaceId,
            slack_team_id: verifiedTeamId,
            slack_team_name: verifiedTeamName,
            bot_user_id: verifiedBotUserId,
            default_channel_id: defaultChannelId?.trim() || null,
            installation_status: 'active',
            connected_by: user.id,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,slack_team_id' }
        )
        .select()
        .single();

      if (instErr || !inst) {
        console.error('[Slack Install] Database upsert failed:', instErr);
        return NextResponse.json({ error: `Failed to persist installation: ${instErr?.message}` }, { status: 500 });
      }

      // 3. Upsert secrets using service client (bypasses RLS locked table)
      await dbClient
        .from('slack_installation_secrets')
        .upsert(
          {
            installation_id: inst.id,
            bot_token: botToken.trim(),
            signing_secret: signingSecret?.trim() || process.env.SLACK_SIGNING_SECRET || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'installation_id' }
        );

      // 4. Map the admin user if authTest gave their slack user id or email
      if (authTest.user_id && authTest.user_id !== verifiedBotUserId) {
        await dbClient
          .from('slack_user_mappings')
          .upsert(
            {
              installation_id: inst.id,
              workspace_id: workspaceId,
              slack_user_id: authTest.user_id,
              taskpilot_user_id: user.id,
              link_status: 'linked',
              linked_by: user.id,
              linked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,slack_user_id' }
          );
      }

      // 5. Activity event
      await dbClient.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'workspace',
        entity_id: workspaceId,
        event_type: 'slack_connected',
        metadata: {
          slack_team_id: verifiedTeamId,
          slack_team_name: verifiedTeamName,
          bot_user_id: verifiedBotUserId,
        },
      });

      return NextResponse.json({ ok: true, installation: inst });
    } catch (err: any) {
      console.error('[Slack Install] Direct connection error:', err);
      return NextResponse.json({ error: err.message || 'Direct connection failed' }, { status: 500 });
    }
  }

  // Path B: Generate OAuth install URL for client-side modal/button
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Server configuration error: SLACK_CLIENT_ID is not configured' },
      { status: 500 }
    );
  }

  const redirectUri = resolveSlackRedirectUri(req.url);

  const stateToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await dbClient.from('slack_oauth_states').insert({
    state_token: stateToken,
    workspace_id: workspaceId,
    initiated_by: user.id,
    action: 'install',
    expires_at: expiresAt,
  });

  if (stateErr) {
    console.error('[Slack Install] Failed to persist OAuth state:', stateErr);
    return NextResponse.json({ error: 'Failed to create state token' }, { status: 500 });
  }

  const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('scope', DEFAULT_SLACK_SCOPES);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', stateToken);

  return NextResponse.json({ installUrl: authorizeUrl.toString() });
}
