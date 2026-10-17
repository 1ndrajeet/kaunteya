import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId } = body;
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  // Verify admin role server-side (never trust client)
  const { data: role } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (role?.role !== 'admin') {
    return NextResponse.json({ error: 'Only workspace admins can install GitHub App' }, { status: 403 });
  }

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json(
      { error: 'Server configuration error: GITHUB_APP_SLUG is not configured' },
      { status: 500 }
    );
  }

  // Generate single-use CSRF state token with 15-minute expiration
  const stateToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await supabase.from('github_oauth_states').insert({
    state_token: stateToken,
    workspace_id: workspaceId,
    initiated_by: user.id,
    expires_at: expiresAt,
  });

  if (stateErr) {
    console.error('[GitHub Install] Failed to persist OAuth state:', stateErr);
    return NextResponse.json({ error: 'Failed to create state token' }, { status: 500 });
  }

  const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${stateToken}`;

  return NextResponse.json({ installUrl });
}