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
  const memberId = req.nextUrl.searchParams.get('memberId');
  const taskId = req.nextUrl.searchParams.get('taskId');

  if (!workspaceId && !taskId && !memberId) {
    return NextResponse.json(
      { error: 'workspaceId, memberId, or taskId required', code: 'MISSING_PARAM' },
      { status: 400 }
    );
  }

  // Check workspace membership if workspaceId is provided
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

  try {
    let endpoint = '';
    if (memberId) {
      endpoint = `${BACKEND_BASE}/api/dignity-score/member/${memberId}?workspace_id=${workspaceId || ''}`;
    } else if (taskId) {
      endpoint = `${BACKEND_BASE}/api/dignity-score/task/${taskId}?workspace_id=${workspaceId || ''}`;
    } else {
      endpoint = `${BACKEND_BASE}/api/dignity-score/health`;
    }

    const backendRes = await fetch(endpoint, {
      cache: 'no-store',
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error('[Dignity Score Proxy] Error calling Python backend:', err);
    return NextResponse.json(
      {
        member_id: memberId || null,
        task_id: taskId || null,
        workspace_id: workspaceId || null,
        accepted_contribution_points: 0.0,
        eligible_task_value: 0.0,
        accepted_progress: 0.0,
        claim_reliability: {
          status: 'insufficient_data',
          score: null,
          reviewed_claims: 0,
        },
        blocked_tasks: 0,
        pending_claims: 0,
        disputed_claims: 0,
        formula_version: 'v1',
        explanation: ['Contribution calculation service is currently unavailable.'],
      },
      { status: 503 }
    );
  }
}
