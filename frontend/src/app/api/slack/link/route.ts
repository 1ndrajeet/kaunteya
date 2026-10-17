import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { randomBytes } from 'crypto';

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

  const { workspaceId } = body;
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  // Verify membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'You are not a member of this workspace' }, { status: 403 });
  }

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  // Check if user already has an active link
  const { data: existingMapping } = await dbClient
    .from('slack_user_mappings')
    .select('id, slack_user_id, slack_username')
    .eq('workspace_id', workspaceId)
    .eq('taskpilot_user_id', user.id)
    .eq('link_status', 'linked')
    .maybeSingle();

  if (existingMapping) {
    return NextResponse.json({
      alreadyLinked: true,
      slackUserId: existingMapping.slack_user_id,
      slackUsername: existingMapping.slack_username,
      message: 'Your account is already linked to Slack in this workspace.',
    });
  }

  // Generate 6-digit challenge code: e.g. TP-4921
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const challengeCode = `TP-${randNum}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Invalidate any previous unconsumed challenges for this user
  await dbClient
    .from('slack_link_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .is('consumed_at', null);

  const { error: insertErr } = await dbClient.from('slack_link_challenges').insert({
    workspace_id: workspaceId,
    user_id: user.id,
    challenge_code: challengeCode,
    expires_at: expiresAt,
  });

  if (insertErr) {
    console.error('[Slack Link] Failed to insert link challenge:', insertErr);
    return NextResponse.json({ error: 'Failed to generate link challenge' }, { status: 500 });
  }

  return NextResponse.json({
    challengeCode,
    expiresAt,
    instruction: `In Slack, send "@TaskPilot link ${challengeCode}" (or DM: "link ${challengeCode}") to link your account.`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

  const { data: mapping } = await dbClient
    .from('slack_user_mappings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('taskpilot_user_id', user.id)
    .eq('link_status', 'linked')
    .maybeSingle();

  return NextResponse.json({
    isLinked: !!mapping,
    mapping: mapping || null,
  });
}
