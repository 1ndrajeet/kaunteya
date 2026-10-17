import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { WebClient } from '@slack/web-api';
import { resolveSlackRedirectUri } from '@/lib/slack/client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const slackError = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  if (slackError) {
    console.warn(`[Slack Callback] OAuth error from Slack: ${slackError}`);
    return NextResponse.redirect(new URL(`/workspace?slack_error=${encodeURIComponent(slackError)}`, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/workspace?slack_error=missing_code_or_state', req.url));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(req.url)}`, req.url));
  }

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  // 1. Validate and consume OAuth state token atomically
  const { data: stateRow, error: stateFetchErr } = await dbClient
    .from('slack_oauth_states')
    .select('*')
    .eq('state_token', state)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (stateFetchErr || !stateRow || stateRow.initiated_by !== user.id) {
    console.error('[Slack Callback] Invalid or expired state token:', { stateFetchErr, stateRow, userId: user.id });
    return NextResponse.redirect(new URL('/workspace?slack_error=invalid_or_expired_state', req.url));
  }

  const workspaceId = stateRow.workspace_id;

  // Mark state token as consumed to prevent replay attacks
  await dbClient
    .from('slack_oauth_states')
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
      new URL(`/workspace/${workspaceId}/admin/integrations?slack_error=not_admin`, req.url)
    );
  }

  // 3. Exchange authorization code with Slack OAuth v2 endpoint
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = resolveSlackRedirectUri(req.url);

  if (!clientId || !clientSecret) {
    console.error('[Slack Callback] Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET');
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?slack_error=server_config_missing`, req.url)
    );
  }

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  let oauthResponse: any;
  try {
    const res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    oauthResponse = await res.json();
  } catch (err: any) {
    console.error('[Slack Callback] Network error exchanging code:', err);
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?slack_error=network_failure`, req.url)
    );
  }

  if (!oauthResponse.ok) {
    console.error('[Slack Callback] OAuth access rejected by Slack:', oauthResponse);
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?slack_error=${encodeURIComponent(oauthResponse.error || 'oauth_rejected')}`, req.url)
    );
  }

  const teamId = oauthResponse.team?.id;
  const teamName = oauthResponse.team?.name || 'Slack Workspace';
  const botUserId = oauthResponse.bot_user_id;
  const botToken = oauthResponse.access_token;
  const authedUserId = oauthResponse.authed_user?.id;
  const defaultChannelId = oauthResponse.incoming_webhook?.channel_id || null;

  if (!teamId || !botToken) {
    console.error('[Slack Callback] Missing team ID or bot token in response:', oauthResponse);
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?slack_error=invalid_oauth_payload`, req.url)
    );
  }

  // 4. Persist installation record into slack_installations (Idempotent upsert)
  const { data: inst, error: instErr } = await dbClient
    .from('slack_installations')
    .upsert(
      {
        workspace_id: workspaceId,
        slack_team_id: teamId,
        slack_team_name: teamName,
        bot_user_id: botUserId || 'U_BOT',
        default_channel_id: defaultChannelId,
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
    console.error('[Slack Callback] Failed to persist slack_installations:', instErr);
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/admin/integrations?slack_error=db_write_failed`, req.url)
    );
  }

  // 5. Store bot token securely in slack_installation_secrets using service role
  const { error: secErr } = await dbClient
    .from('slack_installation_secrets')
    .upsert(
      {
        installation_id: inst.id,
        bot_token: botToken,
        signing_secret: process.env.SLACK_SIGNING_SECRET || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'installation_id' }
    );

  if (secErr) {
    console.error('[Slack Callback] Failed to persist slack_installation_secrets:', secErr);
  }

  // 6. Automatically link the installer's Slack identity to the current TaskPilot user
  const slackWeb = new WebClient(botToken);
  let installerSlackEmail: string | null = null;
  let installerSlackName: string | null = null;
  let installerSlackRealName: string | null = null;

  if (authedUserId) {
    try {
      const userInfo = await slackWeb.users.info({ user: authedUserId });
      if (userInfo.ok && userInfo.user) {
        installerSlackEmail = userInfo.user.profile?.email || null;
        installerSlackName = userInfo.user.name || null;
        installerSlackRealName = userInfo.user.real_name || userInfo.user.profile?.real_name || null;
      }
    } catch (e) {
      console.warn('[Slack Callback] Could not fetch installer user info from Slack API:', e);
    }

    await dbClient
      .from('slack_user_mappings')
      .upsert(
        {
          installation_id: inst.id,
          workspace_id: workspaceId,
          slack_user_id: authedUserId,
          slack_username: installerSlackName,
          slack_real_name: installerSlackRealName,
          slack_email: installerSlackEmail,
          taskpilot_user_id: user.id,
          link_status: 'linked',
          linked_by: user.id,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,slack_user_id' }
      );
  }

  // 7. Auto-map other workspace members by email if available
  try {
    const { data: members } = await dbClient
      .from('workspace_members')
      .select('user_id, profiles:user_id(id, email, display_name)')
      .eq('workspace_id', workspaceId);

    const slackUsersRes = await slackWeb.users.list({ limit: 200 });
    if (slackUsersRes.ok && slackUsersRes.members && members) {
      for (const slackMember of slackUsersRes.members) {
        if (slackMember.deleted || slackMember.is_bot || !slackMember.profile?.email) continue;
        const sEmail = slackMember.profile.email.toLowerCase();

        const matchedMember = members.find((m: any) => m.profiles?.email?.toLowerCase() === sEmail);
        if (matchedMember && matchedMember.user_id !== user.id) {
          await dbClient
            .from('slack_user_mappings')
            .upsert(
              {
                installation_id: inst.id,
                workspace_id: workspaceId,
                slack_user_id: slackMember.id!,
                slack_username: slackMember.name || null,
                slack_real_name: slackMember.real_name || null,
                slack_email: sEmail,
                taskpilot_user_id: matchedMember.user_id,
                link_status: 'linked',
                linked_by: user.id,
                linked_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'workspace_id,slack_user_id' }
            );
        }
      }
    }
  } catch (autoMapErr) {
    console.warn('[Slack Callback] Auto-mapping members by email encountered non-fatal error:', autoMapErr);
  }

  // 8. Log activity event
  await dbClient.from('activity_events').insert({
    workspace_id: workspaceId,
    actor_id: user.id,
    entity_type: 'workspace',
    entity_id: workspaceId,
    event_type: 'slack_connected',
    metadata: {
      slack_team_id: teamId,
      slack_team_name: teamName,
      bot_user_id: botUserId,
      authed_user_id: authedUserId,
    },
  });

  return NextResponse.redirect(
    new URL(`/workspace/${workspaceId}/admin/integrations?slack_success=installed`, req.url)
  );
}
