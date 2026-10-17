import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { verifyGithubSignature } from '@/lib/github/verify-signature';
import { matchArtifactsToWorkspaceClaims } from '@/lib/evidence/matcher';

export const runtime = 'nodejs';

/**
 * Official GitHub Webhooks receiver for TaskPilot.
 * Verifies HMAC-SHA256 signature, journals event delivery idempotently,
 * tracks installation lifecycle, and ingests development evidence into evidence_artifacts.
 *
 * Official Reference: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export async function POST(req: NextRequest) {
  const deliveryId = req.headers.get('x-github-delivery');
  const eventType = req.headers.get('x-github-event');
  const signatureHeader = req.headers.get('x-hub-signature-256');

  // 1. Mandatory Header Validation
  if (!deliveryId || !eventType) {
    return NextResponse.json(
      { error: 'Missing required GitHub webhook headers (x-github-delivery, x-github-event)' },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  // 2. Mandatory Signature Verification (Fail-closed)
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[GitHub Webhook] Server configuration error: GITHUB_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Server configuration error: webhook secret is missing', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }

  const verification = verifyGithubSignature({
    rawBody,
    signatureHeader,
    secret: webhookSecret,
  });

  if (!verification.isValid) {
    console.warn(`[GitHub Webhook] Signature verification failed: ${verification.reason}`);
    return NextResponse.json(
      { error: 'Invalid webhook signature', reason: verification.reason },
      { status: 401 }
    );
  }

  // 3. Payload Parsing
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 4. Verify Database Service Role Key
  if (!hasServiceRoleKey()) {
    console.error('[GitHub Webhook] Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing');
    return NextResponse.json(
      { error: 'Server configuration error: elevated database credentials missing', code: 'DB_CREDENTIALS_MISSING' },
      { status: 500 }
    );
  }

  const supabase = createServiceClient();
  const installationId = payload.installation?.id || null;
  const repositoryId = payload.repository?.id || null;

  // 5. Idempotent Journaling
  const { error: insertError } = await supabase.from('github_events').insert({
    delivery_id: deliveryId,
    event_type: eventType,
    installation_id: installationId,
    repository_id: repositoryId,
    processing_status: 'received',
    payload_summary: {
      action: payload.action,
      repository: payload.repository?.full_name,
      sender: payload.sender?.login,
    },
    received_at: new Date().toISOString(),
  });

  // Handle duplicate deliveries cleanly (Postgres unique constraint violation)
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existingEvent } = await supabase
        .from('github_events')
        .select('processing_status')
        .eq('delivery_id', deliveryId)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: 'Event delivery already recorded',
        status: existingEvent?.processing_status || 'received',
      });
    }

    // Fail closed with retryable 500 on any genuine journaling failure
    console.error('[GitHub Webhook] Failed to journal event delivery:', insertError);
    return NextResponse.json(
      { error: 'Failed to record event delivery in journal', code: 'JOURNAL_FAILED' },
      { status: 500 }
    );
  }

  // 6. Handle Ping Event
  if (eventType === 'ping') {
    await supabase
      .from('github_events')
      .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ ok: true, pong: true });
  }

  // 7. Handle Installation Lifecycle Events
  if (eventType === 'installation') {
    const action = payload.action;
    const ghInstId = payload.installation?.id;

    if (action === 'deleted' && ghInstId) {
      const { data: inst } = await supabase
        .from('github_installations')
        .update({ connection_status: 'revoked', updated_at: new Date().toISOString() })
        .eq('github_installation_id', ghInstId)
        .select('id')
        .maybeSingle();

      if (inst) {
        await supabase
          .from('github_repositories')
          .update({ is_enabled: false, updated_at: new Date().toISOString() })
          .eq('installation_id', inst.id);
      }
    } else if (action === 'suspend' && ghInstId) {
      await supabase
        .from('github_installations')
        .update({ connection_status: 'suspended', updated_at: new Date().toISOString() })
        .eq('github_installation_id', ghInstId);
    } else if (action === 'unsuspend' && ghInstId) {
      await supabase
        .from('github_installations')
        .update({ connection_status: 'active', updated_at: new Date().toISOString() })
        .eq('github_installation_id', ghInstId);
    }

    await supabase
      .from('github_events')
      .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ ok: true, processed: 'installation', action });
  }

  // 8. Handle Installation Repositories Changed Events
  if (eventType === 'installation_repositories') {
    const action = payload.action;
    const ghInstId = payload.installation?.id;

    const { data: inst } = await supabase
      .from('github_installations')
      .select('id, workspace_id')
      .eq('github_installation_id', ghInstId)
      .maybeSingle();

    if (inst) {
      if (action === 'added' && Array.isArray(payload.repositories_added)) {
        for (const r of payload.repositories_added) {
          await supabase.from('github_repositories').upsert(
            {
              workspace_id: inst.workspace_id,
              installation_id: inst.id,
              github_repo_id: r.id,
              name: r.name,
              full_name: r.full_name,
              repo_url: `https://github.com/${r.full_name}`,
              is_private: r.private || false,
              is_enabled: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,github_repo_id' }
          );
        }
      } else if (action === 'removed' && Array.isArray(payload.repositories_removed)) {
        for (const r of payload.repositories_removed) {
          await supabase
            .from('github_repositories')
            .update({ is_enabled: false, updated_at: new Date().toISOString() })
            .eq('workspace_id', inst.workspace_id)
            .eq('github_repo_id', r.id);
        }
      }
    }

    await supabase
      .from('github_events')
      .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ ok: true, processed: 'installation_repositories', action });
  }

  // 9. Resolve Connected Repository & Workspace via numeric github_repo_id first
  const repoNumericId = payload.repository?.id;
  const repoFullName = payload.repository?.full_name;

  if (!repoNumericId && !repoFullName) {
    await supabase
      .from('github_events')
      .update({
        processing_status: 'ignored',
        error_summary: 'No repository in payload',
        processed_at: new Date().toISOString(),
      })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ ok: true, ignored: 'no_repository' });
  }

  let repoRecord: any = null;
  if (repoNumericId) {
    const { data: byNum } = await supabase
      .from('github_repositories')
      .select(`
        id,
        workspace_id,
        is_enabled,
        installation_id,
        installation:github_installations (
          github_installation_id,
          connection_status
        )
      `)
      .eq('github_repo_id', repoNumericId)
      .maybeSingle();
    repoRecord = byNum;
  }

  if (!repoRecord && repoFullName) {
    const { data: byName } = await supabase
      .from('github_repositories')
      .select(`
        id,
        workspace_id,
        is_enabled,
        installation_id,
        installation:github_installations (
          github_installation_id,
          connection_status
        )
      `)
      .eq('full_name', repoFullName)
      .maybeSingle();
    repoRecord = byName;
  }

  if (!repoRecord || !repoRecord.is_enabled) {
    await supabase
      .from('github_events')
      .update({
        processing_status: 'ignored',
        error_summary: `Repository ${repoFullName || repoNumericId} not connected or disabled in TaskPilot`,
        processed_at: new Date().toISOString(),
      })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ ok: true, ignored: 'repository_not_connected' });
  }

  // Verify installation match if installation payload is present
  if (installationId && repoRecord.installation?.github_installation_id) {
    if (Number(repoRecord.installation.github_installation_id) !== Number(installationId)) {
      await supabase
        .from('github_events')
        .update({
          processing_status: 'ignored',
          error_summary: 'Installation ID mismatch between payload and repository record',
          processed_at: new Date().toISOString(),
        })
        .eq('delivery_id', deliveryId);

      return NextResponse.json({ ok: true, ignored: 'installation_mismatch' });
    }
  }

  const workspaceId = repoRecord.workspace_id;

  // 10. Filter unsupported actions explicitly
  const supportedPR = ['opened', 'edited', 'closed', 'reopened', 'synchronize'];
  const supportedReview = ['submitted', 'edited', 'dismissed'];
  const supportedCheck = ['created', 'completed', 'rerequested'];

  if (eventType === 'pull_request' && !supportedPR.includes(payload.action)) {
    await supabase
      .from('github_events')
      .update({ processing_status: 'ignored', error_summary: `Unsupported action: ${payload.action}`, processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);
    return NextResponse.json({ ok: true, ignored: 'unsupported_action' });
  }

  if (eventType === 'pull_request_review' && !supportedReview.includes(payload.action)) {
    await supabase
      .from('github_events')
      .update({ processing_status: 'ignored', error_summary: `Unsupported action: ${payload.action}`, processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);
    return NextResponse.json({ ok: true, ignored: 'unsupported_action' });
  }

  if (eventType === 'check_run' && !supportedCheck.includes(payload.action)) {
    await supabase
      .from('github_events')
      .update({ processing_status: 'ignored', error_summary: `Unsupported action: ${payload.action}`, processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);
    return NextResponse.json({ ok: true, ignored: 'unsupported_action' });
  }

  // 11. Fetch workspace tasks to resolve task identifiers (e.g. CORE-14)
  const { data: workspaceTasks } = await supabase
    .from('tasks')
    .select(`
      id,
      task_number,
      project:projects!inner ( identifier )
    `)
    .eq('workspace_id', workspaceId);

  const taskMap = new Map<string, string>();
  workspaceTasks?.forEach((t: any) => {
    taskMap.set(`${t.project.identifier}-${t.task_number}`.toUpperCase(), t.id);
  });

  function resolveTaskId(text: string): { taskId: string | null; identifier: string | null } {
    const upper = text.toUpperCase();
    for (const [ident, id] of taskMap.entries()) {
      if (upper.includes(ident)) {
        return { taskId: id, identifier: ident };
      }
    }
    return { taskId: null, identifier: null };
  }

  // 12. Ingest Specific Development Evidence Events
  try {
    if (eventType === 'pull_request') {
      const pr = payload.pull_request;
      const isMerged = !!pr.merged_at;
      const state = isMerged ? 'merged' : pr.state;
      const { taskId, identifier } = resolveTaskId(`${pr.title} ${pr.head?.ref || ''} ${pr.body || ''}`);

      await supabase.from('evidence_artifacts').upsert(
        {
          workspace_id: workspaceId,
          repository_id: repoRecord.id,
          artifact_type: 'pull_request',
          external_id: String(pr.number),
          title: pr.title,
          source_url: pr.html_url,
          author_login: pr.user?.login || null,
          author_github_id: pr.user?.id || null,
          commit_sha: pr.head?.sha || null,
          head_branch: pr.head?.ref || null,
          base_branch: pr.base?.ref || null,
          artifact_state: state,
          is_merged: isMerged,
          merged_at: pr.merged_at || null,
          task_id: taskId,
          matched_task_identifier: identifier,
          match_method: identifier ? 'explicit_task_id' : 'claim_url',
          metadata: {
            number: pr.number,
            bodySnippet: pr.body?.slice(0, 300) || '',
            updatedAt: pr.updated_at,
          },
          created_at_external: pr.created_at,
          updated_at_external: pr.updated_at,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: 'repository_id,artifact_type,external_id' }
      );
    } else if (eventType === 'pull_request_review') {
      const review = payload.review;
      const pr = payload.pull_request;
      const { taskId, identifier } = resolveTaskId(`${pr?.title || ''} ${pr?.head?.ref || ''}`);

      await supabase.from('evidence_artifacts').upsert(
        {
          workspace_id: workspaceId,
          repository_id: repoRecord.id,
          artifact_type: 'review',
          external_id: String(review.id),
          title: `Review on PR #${pr?.number || ''} (${review.state})`,
          source_url: review.html_url,
          author_login: review.user?.login || null,
          author_github_id: review.user?.id || null,
          artifact_state: review.state.toLowerCase(),
          task_id: taskId,
          matched_task_identifier: identifier,
          match_method: identifier ? 'explicit_task_id' : 'claim_url',
          metadata: {
            prNumber: pr?.number,
            reviewState: review.state,
          },
          created_at_external: review.submitted_at,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: 'repository_id,artifact_type,external_id' }
      );
    } else if (eventType === 'check_run') {
      const cr = payload.check_run;
      const headSha = cr.head_sha;
      const { taskId, identifier } = resolveTaskId(cr.name || '');

      await supabase.from('evidence_artifacts').upsert(
        {
          workspace_id: workspaceId,
          repository_id: repoRecord.id,
          artifact_type: 'check_run',
          external_id: String(cr.id),
          title: cr.name,
          source_url: cr.html_url,
          commit_sha: headSha,
          artifact_state: cr.status,
          check_conclusion: cr.conclusion,
          task_id: taskId,
          matched_task_identifier: identifier,
          match_method: identifier ? 'explicit_task_id' : 'claim_url',
          metadata: {
            checkName: cr.name,
            conclusion: cr.conclusion,
          },
          created_at_external: cr.completed_at || cr.started_at,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: 'repository_id,artifact_type,external_id' }
      );
    }

    // Match artifacts against pending claims
    await matchArtifactsToWorkspaceClaims(supabase, workspaceId);

    // Mark delivery processed
    await supabase
      .from('github_events')
      .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ ok: true, processed: eventType });
  } catch (err: any) {
    console.error(`[GitHub Webhook] Exception processing event ${eventType}:`, err);
    await supabase
      .from('github_events')
      .update({
        processing_status: 'failed',
        error_code: 'PROCESSING_ERROR',
        error_summary: err?.message || 'Unknown processing error',
        processed_at: new Date().toISOString(),
      })
      .eq('delivery_id', deliveryId);

    return NextResponse.json({ error: 'Processing error', code: 'PROCESSING_ERROR' }, { status: 500 });
  }
}
