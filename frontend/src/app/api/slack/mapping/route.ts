import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { WebClient } from '@slack/web-api';

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
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { workspaceId, userId, slackUserId, slackUsername, slackTeamId } = body;

  if (!workspaceId || !userId || !slackUserId) {
    return NextResponse.json(
      { error: 'workspaceId, userId, and slackUserId are required' },
      { status: 400 }
    );
  }

  // 1. Verify caller is workspace admin (or self-mapping)
  const { data: callerMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!callerMember || callerMember.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace admins can map member Slack identities' },
      { status: 403 }
    );
  }

  // 2. Verify target user is a member of this workspace (prevent cross-workspace contamination)
  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('user_id, role, profiles:user_id(id, display_name, email)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json(
      { error: 'Target user is not an active member of this workspace' },
      { status: 404 }
    );
  }

  const cleanSlackUserId = slackUserId.trim().toUpperCase();
  const cleanSlackUsername = (slackUsername || '').trim().replace(/^@/, '');
  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  // 3. Resolve or ensure an active Slack installation for this workspace
  let { data: installation } = await dbClient
    .from('slack_installations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('installation_status', 'active')
    .maybeSingle();

  // If no installation exists for this workspace, auto-detect/reconcile with verified bot token
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!installation && botToken) {
    try {
      const testClient = new WebClient(botToken);
      const authTest = await testClient.auth.test();

      if (authTest.ok && authTest.team_id) {
        const verifiedTeamId = (slackTeamId?.trim().toUpperCase()) || authTest.team_id;
        const verifiedTeamName = authTest.team || 'Slack Workspace';
        const verifiedBotUserId = authTest.user_id || 'U_BOT';

        const { data: autoInst, error: autoInstErr } = await dbClient
          .from('slack_installations')
          .upsert(
            {
              workspace_id: workspaceId,
              slack_team_id: verifiedTeamId,
              slack_team_name: verifiedTeamName,
              bot_user_id: verifiedBotUserId,
              installation_status: 'active',
              connected_by: user.id,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,slack_team_id' }
          )
          .select()
          .single();

        if (autoInst && !autoInstErr) {
          installation = autoInst;
          await dbClient
            .from('slack_installation_secrets')
            .upsert(
              {
                installation_id: autoInst.id,
                bot_token: botToken,
                signing_secret: process.env.SLACK_SIGNING_SECRET || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'installation_id' }
            );
        }
      }
    } catch (e) {
      console.warn('[Slack Mapping] Auto-provision check failed:', e);
    }
  }

  // If still no installation, check if caller provided team ID
  if (!installation && slackTeamId) {
    const cleanTeamId = slackTeamId.trim().toUpperCase();
    const { data: manualInst } = await dbClient
      .from('slack_installations')
      .upsert(
        {
          workspace_id: workspaceId,
          slack_team_id: cleanTeamId,
          slack_team_name: 'Slack Workspace',
          bot_user_id: 'U_BOT',
          installation_status: 'active',
          connected_by: user.id,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,slack_team_id' }
      )
      .select()
      .single();

    if (manualInst) {
      installation = manualInst;
    }
  }

  if (!installation) {
    return NextResponse.json(
      {
        error:
          'No active Slack installation found for this workspace. Please connect Slack first using "Add to Slack" or provide valid Slack bot credentials.',
      },
      { status: 400 }
    );
  }

  // 4. Retrieve Slack user info for verified details if possible
  let verifiedEmail: string | null = null;
  let verifiedUsername: string | null = cleanSlackUsername || null;
  let verifiedRealName: string | null = null;

  if (botToken) {
    try {
      const slackClient = new WebClient(botToken);
      const userInfo = await slackClient.users.info({ user: cleanSlackUserId });
      if (userInfo.ok && userInfo.user) {
        verifiedEmail = userInfo.user.profile?.email || null;
        verifiedUsername = userInfo.user.name || verifiedUsername;
        verifiedRealName = userInfo.user.real_name || userInfo.user.profile?.real_name || null;
      }
    } catch (e) {
      console.warn('[Slack Mapping] Could not query Slack users.info:', e);
    }
  }

  // 5. Upsert mapping record in slack_user_mappings
  const { data: mapping, error: mapErr } = await dbClient
    .from('slack_user_mappings')
    .upsert(
      {
        installation_id: installation.id,
        workspace_id: workspaceId,
        slack_user_id: cleanSlackUserId,
        slack_username: verifiedUsername,
        slack_real_name: verifiedRealName,
        slack_email: verifiedEmail,
        taskpilot_user_id: userId,
        link_status: 'linked',
        linked_by: user.id,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,slack_user_id' }
    )
    .select()
    .single();

  if (mapErr || !mapping) {
    console.error('[Slack Mapping] Database upsert failed:', mapErr);
    return NextResponse.json(
      { error: `Failed to persist mapping: ${mapErr?.message}` },
      { status: 500 }
    );
  }

  // 6. Record activity event
  const memberName = (targetMember.profiles as any)?.display_name || 'Member';
  await dbClient.from('activity_events').insert({
    workspace_id: workspaceId,
    actor_id: user.id,
    entity_type: 'workspace_member',
    entity_id: userId,
    event_type: 'slack_identity_linked',
    metadata: {
      member_name: memberName,
      slack_user_id: cleanSlackUserId,
      slack_username: verifiedUsername,
      slack_team_id: installation.slack_team_id,
    },
  });

  return NextResponse.json({
    ok: true,
    mapping,
    installation,
    message: `Successfully linked ${memberName} to Slack ID ${cleanSlackUserId}.`,
  });
}

export async function DELETE(req: NextRequest) {
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
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { workspaceId, mappingId } = body;

  if (!workspaceId || !mappingId) {
    return NextResponse.json(
      { error: 'workspaceId and mappingId are required' },
      { status: 400 }
    );
  }

  // Verify caller is admin
  const { data: callerMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!callerMember || callerMember.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace admins can unlink Slack identities' },
      { status: 403 }
    );
  }

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  // Retrieve mapping to log member name
  const { data: mapping } = await dbClient
    .from('slack_user_mappings')
    .select('*, profiles:taskpilot_user_id(display_name)')
    .eq('id', mappingId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!mapping) {
    return NextResponse.json({ error: 'Mapping not found in this workspace' }, { status: 404 });
  }

  await dbClient
    .from('slack_user_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('workspace_id', workspaceId);

  await dbClient.from('activity_events').insert({
    workspace_id: workspaceId,
    actor_id: user.id,
    entity_type: 'workspace_member',
    entity_id: mapping.taskpilot_user_id,
    event_type: 'slack_identity_unlinked',
    metadata: {
      member_name: (mapping.profiles as any)?.display_name || 'Member',
      slack_user_id: mapping.slack_user_id,
    },
  });

  return NextResponse.json({ ok: true, message: 'Identity unlinked successfully' });
}

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
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Verify membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
  }

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  const { data: installation } = await dbClient
    .from('slack_installations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('installation_status', 'active')
    .maybeSingle();

  const { data: mappings } = await dbClient
    .from('slack_user_mappings')
    .select('*')
    .eq('workspace_id', workspaceId);

  return NextResponse.json({
    installation: installation || null,
    mappings: mappings || [],
  });
}
