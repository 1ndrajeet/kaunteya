import crypto from 'crypto';
import { createAdminClient } from '../supabase/admin';
import { RepositoryEvidencePackage } from '../github/types';
import { getAIProvider } from './provider';
import { projectRepositoryContextTask } from './tasks';
import { ProjectRepositoryContextOutput } from './schemas/repository-context';
import { AIError } from './errors';

export interface AnalysisRunnerOptions {
  forceRefresh?: boolean;
  timeoutMs?: number;
}

export interface AnalysisRunResult {
  output: ProjectRepositoryContextOutput;
  isCached: boolean;
  analyzedAt: string;
  modelId: string;
  fingerprint: string;
}

export function calculateEvidenceFingerprint(
  evidence: RepositoryEvidencePackage,
  promptVersion: string,
  schemaVersion: string
): string {
  const hash = crypto.createHash('sha256');

  const components = {
    promptVersion,
    schemaVersion,
    repoFullName: evidence.repository.fullName,
    pushedAt: evidence.repository.pushedAt,
    readmeSnippet: (evidence.repository.readmeContent || '').slice(0, 500),
    manifests: Object.keys(evidence.repository.packageManifests || {}),
    commitShas: evidence.recentCommits.slice(0, 15).map((c) => c.sha),
    prKeys: evidence.openPullRequests.slice(0, 15).map((pr) => `${pr.number}:${pr.updatedAt}`),
    issueKeys: evidence.openIssues.slice(0, 15).map((i) => `${i.number}:${i.updatedAt}`),
    contributorLogins: evidence.contributors.slice(0, 10).map((c) => c.login),
  };

  hash.update(JSON.stringify(components));
  return hash.digest('hex');
}

export async function runProjectRepositoryContextAnalysis(
  projectId: string,
  workspaceId: string,
  repositoryDbId: string | null,
  evidence: RepositoryEvidencePackage,
  options?: AnalysisRunnerOptions
): Promise<AnalysisRunResult> {
  const adminClient = createAdminClient();
  const provider = getAIProvider();
  const task = projectRepositoryContextTask;

  const fingerprint = calculateEvidenceFingerprint(
    evidence,
    task.promptVersion,
    task.schemaVersion
  );

  // 1. Check for valid cached analysis if not force refreshing
  if (!options?.forceRefresh) {
    const { data: cached } = await adminClient
      .from('project_ai_contexts')
      .select('*')
      .eq('project_id', projectId)
      .eq('task_name', task.name)
      .eq('evidence_fingerprint', fingerprint)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && cached.structured_output && typeof cached.structured_output === 'object') {
      try {
        const validatedOutput = task.validateOutput(cached.structured_output);
        return {
          output: validatedOutput,
          isCached: true,
          analyzedAt: cached.analyzed_at || cached.created_at,
          modelId: cached.model_id,
          fingerprint,
        };
      } catch {
        // Cached output failed validation; re-run below
      }
    }
  }

  // 2. Insert pending record
  const { data: record } = await adminClient
    .from('project_ai_contexts')
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      repository_id: repositoryDbId || undefined,
      task_name: task.name,
      provider: provider.name,
      model_id: provider.modelId,
      prompt_version: task.promptVersion,
      schema_version: task.schemaVersion,
      status: 'pending',
      evidence_fingerprint: fingerprint,
      referenced_artifact_ids: [],
    })
    .select('id')
    .single();

  const recordId = record?.id;

  try {
    // 3. Execute Gemini task
    const execution = await provider.executeTask(task, evidence, {
      timeoutMs: options?.timeoutMs || 45000,
    });

    const nowIso = new Date().toISOString();

    // 4. Update record with structured result
    if (recordId) {
      await adminClient
        .from('project_ai_contexts')
        .update({
          status: 'completed',
          structured_output: execution.output as any,
          usage_metadata: (execution.tokensUsed || {}) as any,
          analyzed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', recordId);
    }

    return {
      output: execution.output,
      isCached: false,
      analyzedAt: nowIso,
      modelId: execution.model,
      fingerprint,
    };
  } catch (err) {
    const aiError = err instanceof AIError ? err : new AIError('PROVIDER_ERROR', String(err));

    // Record failure in the pending record
    if (recordId) {
      await adminClient
        .from('project_ai_contexts')
        .update({
          status: 'failed',
          error_category: aiError.code,
          error_summary: aiError.message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);
    }

    throw aiError;
  }
}
