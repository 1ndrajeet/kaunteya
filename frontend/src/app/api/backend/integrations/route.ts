import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BACKEND_BASE = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (workspaceId) {
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
  }

  // Query Backend Python endpoints
  let slackHealth: any = { status: 'unavailable', bot_token_configured: false, signing_secret_configured: false };
  let slackStatus: any = { status: 'unavailable' };
  let githubHealth: any = { status: 'unavailable', app_configured: false, token_configured: false, installation_found: false };
  let dignityHealth: any = { status: 'unavailable' };
  let backendOnline = false;

  try {
    const [sHealthRes, sStatusRes, gHealthRes, dHealthRes] = await Promise.all([
      fetch(`${BACKEND_BASE}/api/slack/health`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND_BASE}/api/slack/status`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND_BASE}/api/github/health`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND_BASE}/api/dignity-score/health`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ]);

    if (sHealthRes) {
      slackHealth = sHealthRes;
      backendOnline = true;
    }
    if (sStatusRes) slackStatus = sStatusRes;
    if (gHealthRes) {
      githubHealth = gHealthRes;
      backendOnline = true;
    }
    if (dHealthRes) dignityHealth = dHealthRes;
  } catch (err) {
    console.warn('[Backend Proxy] Failed to reach Python backend service:', err);
  }

  return NextResponse.json({
    backend_online: backendOnline,
    slack: {
      health: slackHealth,
      status: slackStatus,
    },
    github: {
      health: githubHealth,
    },
    dignity_score: {
      health: dignityHealth,
    },
    timestamp: new Date().toISOString(),
  });
}
