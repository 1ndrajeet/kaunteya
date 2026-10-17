import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncRepositoryEvidence } from '@/lib/github/sync';
import { runProjectRepositoryContextAnalysis } from '@/lib/ai/runner';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // 1. Get project
  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // 2. Verify workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['admin', 'lead'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Forbidden: Only workspace administrators and team leads can trigger repository synchronization' },
      { status: 403 }
    );
  }

  // 3. Find linked GitHub repository
  const admin = createAdminClient();
  const { data: repo, error: repoErr } = await admin
    .from('github_repositories')
    .select('id, workspace_id, full_name')
    .eq('project_id', projectId)
    .maybeSingle();

  if (repoErr || !repo) {
    return NextResponse.json(
      { error: 'No GitHub repository linked to this project' },
      { status: 404 }
    );
  }

  // 4. Perform bounded sync
  const syncResult = await syncRepositoryEvidence({
    repositoryId: repo.id,
    workspaceId: repo.workspace_id,
    supabase: admin,
  });

  if (!syncResult.success) {
    return NextResponse.json(
      { error: syncResult.error || 'Failed to sync repository from GitHub' },
      { status: 502 }
    );
  }

  // 5. If sync provided evidence, attempt asynchronous or background Gemini refresh (fire-and-forget or non-blocking)
  if (syncResult.evidencePackage) {
    runProjectRepositoryContextAnalysis(
      projectId,
      repo.workspace_id,
      repo.id,
      syncResult.evidencePackage,
      { forceRefresh: false }
    ).catch((err) => {
      console.warn(`[Project Sync] Background Gemini analysis failed for ${projectId}:`, err?.message);
    });
  }

  return NextResponse.json({
    ok: true,
    artifactsSyncedCount: syncResult.artifactsSyncedCount,
    matchedClaimsCount: syncResult.matchedClaimsCount,
  });
}
