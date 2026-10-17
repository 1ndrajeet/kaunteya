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

  const { taskId, workspaceId, claimText, claimId } = body;
  if (!taskId) {
    return NextResponse.json({ error: 'taskId required', code: 'MISSING_PARAM' }, { status: 400 });
  }

  // Verify task and workspace membership
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select('id, workspace_id, assignee_id, status')
    .eq('id', taskId)
    .maybeSingle();

  if (taskErr || !task) {
    return NextResponse.json({ error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const targetWsId = workspaceId || task.workspace_id;
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', targetWsId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: 'Forbidden: You are not a member of this workspace', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // Forward to Python backend
  try {
    const backendRes = await fetch(`${BACKEND_BASE}/api/github/verify-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId,
        claim_id: claimId || undefined,
        claimant_id: user.id,
        workspace_id: targetWsId,
        claim_text: claimText || `Verification requested by user for task ${taskId}`,
      }),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error('[Verify Proxy] Error calling Python backend:', err);
    return NextResponse.json(
      {
        claim_id: claimId || null,
        task_id: taskId,
        verification_status: 'unavailable',
        completion_approved: false,
        evidence: [],
        reasons: ['Backend verification service is currently unreachable.'],
        next_action: 'retry_later',
      },
      { status: 503 }
    );
  }
}
