import { NextRequest, NextResponse } from 'next/server';
import { evaluateAndDispatchFollowups } from '@/lib/slack/followup';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty on cron requests
    }

    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const workspaceId = body?.workspaceId;

    let isAuthorized = false;

    // 1. Check if cron authorized
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      // 2. Fall back to user session token
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized: Missing credentials' }, { status: 401 });
      }

      const supabase = createServiceClient();
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);

      if (authErr || !user) {
        return NextResponse.json({ error: 'Invalid authentication session' }, { status: 401 });
      }

      if (workspaceId) {
        const { data: member } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (member?.role !== 'admin' && member?.role !== 'lead') {
          return NextResponse.json(
            { error: 'Forbidden: Only Administrators and Team Leads can trigger follow-ups' },
            { status: 403 }
          );
        }
      } else {
        const { data: adminMemberships } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'lead'])
          .limit(1);

        if (!adminMemberships || adminMemberships.length === 0) {
          return NextResponse.json(
            { error: 'Forbidden: Administrator or Lead access required' },
            { status: 403 }
          );
        }
      }
      isAuthorized = true;
    }

    const summaries = await evaluateAndDispatchFollowups(workspaceId);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      summaries,
    });
  } catch (err) {
    console.error('[Follow-up API] Execution error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Follow-up execution failed' },
      { status: 500 }
    );
  }
}
