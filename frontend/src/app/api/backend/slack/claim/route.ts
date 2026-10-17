import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BACKEND_BASE = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { workspaceId, slackUserId, text, channelId, threadTs } = body;
  if (!workspaceId || !slackUserId || !text) {
    return NextResponse.json(
      { error: 'workspaceId, slackUserId, and text required', code: 'MISSING_PARAM' },
      { status: 400 }
    );
  }

  // Verify workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: 'Forbidden: Not a member of this workspace', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const backendRes = await fetch(`${BACKEND_BASE}/api/slack/process-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        slack_user_id: slackUserId,
        channel_id: channelId || 'C_DIAGNOSTIC',
        thread_ts: threadTs || undefined,
        text,
      }),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error('[Slack Claim Proxy] Error calling Python backend:', err);
    return NextResponse.json(
      {
        ok: false,
        intent: 'unknown',
        reply_message: 'Slack claim processing service is currently unreachable.',
      },
      { status: 503 }
    );
  }
}
