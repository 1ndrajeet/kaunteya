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

    // Validate authorization: Either CRON_SECRET or an authenticated admin session
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If no valid cron secret, check if caller provided an admin session token
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
          .single();

        if (member?.role !== 'admin' && member?.role !== 'lead') {
          return NextResponse.json(
            { error: 'Only Administrators and Team Leads can trigger follow-ups' },
            { status: 403 }
          );
        }
      }
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
