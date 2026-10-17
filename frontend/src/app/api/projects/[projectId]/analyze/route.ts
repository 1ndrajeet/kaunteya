import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncRepositoryEvidence } from '@/lib/github/sync';
import { runProjectRepositoryContextAnalysis } from '@/lib/ai/runner';
import { AIError } from '@/lib/ai/errors';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Get project and workspace
  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Verify workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden: not a workspace member' }, { status: 403 });
  }

  // Retrieve latest analysis
  const admin = createAdminClient();
  const { data: latestAnalysis } = await admin
    .from('project_ai_contexts')
    .select('*')
    .eq('project_id', projectId)
    .eq('task_name', 'project.repository_context')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    analysis: latestAnalysis?.structured_output || null,
    status: latestAnalysis?.status || 'none',
    modelId: latestAnalysis?.model_id || null,
    analyzedAt: latestAnalysis?.analyzed_at || latestAnalysis?.created_at || null,
    errorSummary: latestAnalysis?.error_summary || null,
  });
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
      { error: 'Forbidden: Only workspace administrators and team leads can trigger AI analysis' },
      { status: 403 }
    );
  }

  let body: { forceRefresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Body optional
  }

  // 3. Find linked GitHub repository
  const admin = createAdminClient();
  const { data: repo, error: repoErr } = await admin
    .from('github_repositories')
    .select('id, workspace_id, installation_id, full_name, last_sync_at')
    .eq('project_id', projectId)
    .maybeSingle();

  if (repoErr || !repo) {
    return NextResponse.json(
      { error: 'No GitHub repository linked to this project' },
      { status: 404 }
    );
  }

  // 4. Perform bounded sync to ensure fresh evidence
  const syncResult = await syncRepositoryEvidence({
    repositoryId: repo.id,
    workspaceId: repo.workspace_id,
    supabase: admin,
  });

  if (!syncResult.success || !syncResult.evidencePackage) {
    return NextResponse.json(
      { error: syncResult.error || 'Failed to sync repository evidence from GitHub' },
      { status: 502 }
    );
  }

  // 5. Run Gemini Project Context Analysis
  try {
    const analysisResult = await runProjectRepositoryContextAnalysis(
      projectId,
      repo.workspace_id,
      repo.id,
      syncResult.evidencePackage,
      { forceRefresh: body.forceRefresh ?? false }
    );

    return NextResponse.json({
      ok: true,
      analysis: analysisResult.output,
      isCached: analysisResult.isCached,
      analyzedAt: analysisResult.analyzedAt,
      modelId: analysisResult.modelId,
    });
  } catch (err: unknown) {
    if (err instanceof AIError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          isRetryable: err.isRetryable,
        },
        { status: err.status || 500 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI analysis failed' },
      { status: 500 }
    );
  }
}
