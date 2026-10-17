import { SupabaseClient } from '@supabase/supabase-js';
import { getGithubClient } from './client';
import { fetchFullEvidencePackage } from './fetcher';
import type { RepositoryEvidencePackage } from './types';
import { matchArtifactsToWorkspaceClaims } from '../evidence/matcher';

export interface SyncRepositoryOptions {
  repositoryId: string;
  workspaceId: string;
  installationId?: string;
  supabase: SupabaseClient;
}

export interface SyncRepositoryResult {
  success: boolean;
  artifactsSyncedCount: number;
  matchedClaimsCount: number;
  evidencePackage?: RepositoryEvidencePackage;
  error?: string;
}

/**
 * Synchronizes bounded GitHub artifacts (metadata, README, contributors, PRs,
 * reviews, checks, commits, issues) for a connected repository and updates evidence records.
 */
export async function syncRepositoryEvidence({
  repositoryId,
  workspaceId,
  supabase,
}: SyncRepositoryOptions): Promise<SyncRepositoryResult> {
  // 1. Fetch repository record
  const { data: repo, error: repoError } = await supabase
    .from('github_repositories')
    .select(`
      id,
      workspace_id,
      installation_id,
      project_id,
      github_repo_id,
      name,
      full_name,
      repo_url,
      installation:github_installations!github_repositories_installation_id_fkey (
        id,
        github_installation_id
      )
    `)
    .eq('id', repositoryId)
    .single();

  if (repoError || !repo) {
    return { success: false, artifactsSyncedCount: 0, matchedClaimsCount: 0, error: 'Repository not found' };
  }

  // Mark repository sync in progress
  await supabase
    .from('github_repositories')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('id', repo.id);

  try {
    const [owner, repoName] = repo.full_name.split('/');
    if (!owner || !repoName) {
      throw new Error(`Invalid repository full_name format: "${repo.full_name}"`);
    }

    // 2. Fetch installation secrets if available
    let installationSecrets: any = null;
    if (repo.installation_id) {
      const { data: sec } = await supabase
        .from('github_installation_secrets')
        .select('*')
        .eq('installation_id', repo.installation_id)
        .maybeSingle();
      installationSecrets = sec;
    }

    const githubInstallationId = (repo.installation as any)?.github_installation_id;

    const octokit = getGithubClient({
      installationId: githubInstallationId,
      appId: installationSecrets?.app_id,
      privateKey: installationSecrets?.private_key,
      token: installationSecrets?.personal_access_token,
    });

    // 3. Fetch full evidence package from GitHub
    const evidencePackage = await fetchFullEvidencePackage(octokit, owner, repoName);

    // 4. Update github_repositories with normalized metadata, README, and manifests
    const nowIso = new Date().toISOString();
    await supabase
      .from('github_repositories')
      .update({
        description: evidencePackage.repository.description,
        primary_language: evidencePackage.repository.primaryLanguage,
        languages: evidencePackage.repository.languages as any,
        topics: evidencePackage.repository.topics,
        stars_count: evidencePackage.repository.starsCount,
        forks_count: evidencePackage.repository.forksCount,
        open_issues_count: evidencePackage.repository.openIssuesCount,
        readme_content: evidencePackage.repository.readmeContent,
        package_manifests: evidencePackage.repository.packageManifests as any,
        sync_status: 'synced',
        sync_error: null,
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', repo.id);

    // 5. Persist Contributors
    for (const contrib of evidencePackage.contributors) {
      await supabase
        .from('github_repository_contributors')
        .upsert(
          {
            workspace_id: workspaceId,
            repository_id: repo.id,
            github_user_id: contrib.githubUserId,
            login: contrib.login,
            avatar_url: contrib.avatarUrl,
            html_url: contrib.htmlUrl,
            contributions_count: contrib.contributionsCount,
            last_activity_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'repository_id,github_user_id' }
        );
    }

    // 6. Fetch existing tasks in workspace to match task identifiers (e.g. CORE-14)
    const { data: workspaceTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        task_number,
        project:projects!inner (
          id,
          identifier
        )
      `)
      .eq('workspace_id', workspaceId);

    const taskIdentifierMap = new Map<string, string>();
    workspaceTasks?.forEach((t: any) => {
      const identifier = `${t.project.identifier}-${t.task_number}`.toUpperCase();
      taskIdentifierMap.set(identifier, t.id);
    });

    let artifactsCount = 0;

    // 7. Persist Pull Requests & Reviews & Checks into evidence_artifacts
    const allPRs = [...evidencePackage.openPullRequests, ...evidencePackage.recentMergedPullRequests];
    for (const pr of allPRs) {
      const searchTarget = `${pr.title} ${pr.headBranch} ${pr.body || ''}`.toUpperCase();
      let matchedTaskId: string | null = null;
      let matchedIdentifier: string | null = null;
      let matchMethod: 'explicit_task_id' | 'branch_name' | 'claim_url' | 'manual' = 'explicit_task_id';

      for (const [ident, tId] of taskIdentifierMap.entries()) {
        if (searchTarget.includes(ident)) {
          matchedTaskId = tId;
          matchedIdentifier = ident;
          if (pr.headBranch.toUpperCase().includes(ident)) {
            matchMethod = 'branch_name';
          }
          break;
        }
      }

      await supabase.from('evidence_artifacts').upsert(
        {
          workspace_id: workspaceId,
          repository_id: repo.id,
          artifact_type: 'pull_request',
          external_id: String(pr.number),
          title: pr.title,
          source_url: pr.htmlUrl,
          author_login: pr.authorLogin,
          author_github_id: pr.authorId,
          commit_sha: pr.headSha,
          head_branch: pr.headBranch,
          base_branch: pr.baseBranch,
          artifact_state: pr.state,
          is_merged: pr.isMerged,
          merged_at: pr.mergedAt,
          task_id: matchedTaskId,
          matched_task_identifier: matchedIdentifier,
          match_method: matchMethod,
          metadata: {
            number: pr.number,
            bodySnippet: pr.body?.slice(0, 300) || '',
            labels: pr.labels,
            updatedAt: pr.updatedAt,
          },
          created_at_external: pr.createdAt,
          updated_at_external: pr.updatedAt,
          last_sync_at: nowIso,
        },
        { onConflict: 'repository_id,artifact_type,external_id' }
      );
      artifactsCount++;

      // Reviews
      for (const rev of pr.reviews) {
        await supabase.from('evidence_artifacts').upsert(
          {
            workspace_id: workspaceId,
            repository_id: repo.id,
            artifact_type: 'review',
            external_id: String(rev.id),
            title: `Review on PR #${pr.number} (${rev.state})`,
            source_url: rev.htmlUrl,
            author_login: rev.reviewerLogin,
            author_github_id: rev.reviewerId,
            artifact_state: rev.state.toLowerCase(),
            task_id: matchedTaskId,
            matched_task_identifier: matchedIdentifier,
            match_method: matchMethod,
            metadata: {
              prNumber: pr.number,
              prTitle: pr.title,
              reviewState: rev.state,
            },
            created_at_external: rev.submittedAt,
            last_sync_at: nowIso,
          },
          { onConflict: 'repository_id,artifact_type,external_id' }
        );
        artifactsCount++;
      }

      // Checks
      for (const cr of pr.checks) {
        await supabase.from('evidence_artifacts').upsert(
          {
            workspace_id: workspaceId,
            repository_id: repo.id,
            artifact_type: 'check_run',
            external_id: String(cr.id),
            title: cr.name,
            source_url: cr.htmlUrl || pr.htmlUrl,
            commit_sha: cr.commitSha,
            artifact_state: cr.status,
            check_conclusion: cr.conclusion,
            task_id: matchedTaskId,
            matched_task_identifier: matchedIdentifier,
            match_method: matchMethod,
            metadata: {
              prNumber: pr.number,
              checkName: cr.name,
              conclusion: cr.conclusion,
            },
            created_at_external: cr.completedAt,
            last_sync_at: nowIso,
          },
          { onConflict: 'repository_id,artifact_type,external_id' }
        );
        artifactsCount++;
      }
    }

    // 8. Persist Commits
    for (const c of evidencePackage.recentCommits) {
      let matchedTaskId: string | null = null;
      let matchedIdentifier: string | null = null;
      const searchTarget = c.message.toUpperCase();

      for (const [ident, tId] of taskIdentifierMap.entries()) {
        if (searchTarget.includes(ident)) {
          matchedTaskId = tId;
          matchedIdentifier = ident;
          break;
        }
      }

      await supabase.from('evidence_artifacts').upsert(
        {
          workspace_id: workspaceId,
          repository_id: repo.id,
          artifact_type: 'commit',
          external_id: c.sha,
          title: c.message.split('\n')[0].slice(0, 150),
          source_url: c.htmlUrl,
          author_login: c.authorLogin,
          author_github_id: c.authorId,
          commit_sha: c.sha,
          artifact_state: 'committed',
          task_id: matchedTaskId,
          matched_task_identifier: matchedIdentifier,
          match_method: 'explicit_task_id',
          metadata: {
            authorName: c.authorName,
            fullMessage: c.message.slice(0, 500),
          },
          created_at_external: c.date,
          last_sync_at: nowIso,
        },
        { onConflict: 'repository_id,artifact_type,external_id' }
      );
      artifactsCount++;
    }

    // 9. Persist Issues (excluding PRs)
    const allIssues = [...evidencePackage.openIssues, ...evidencePackage.recentClosedIssues];
    for (const iss of allIssues) {
      let matchedTaskId: string | null = null;
      let matchedIdentifier: string | null = null;
      const searchTarget = `${iss.title} ${iss.body || ''}`.toUpperCase();

      for (const [ident, tId] of taskIdentifierMap.entries()) {
        if (searchTarget.includes(ident)) {
          matchedTaskId = tId;
          matchedIdentifier = ident;
          break;
        }
      }

      await supabase.from('evidence_artifacts').upsert(
        {
          workspace_id: workspaceId,
          repository_id: repo.id,
          artifact_type: 'issue',
          external_id: String(iss.number),
          title: iss.title,
          source_url: iss.htmlUrl,
          author_login: iss.authorLogin,
          author_github_id: iss.authorId,
          artifact_state: iss.state,
          task_id: matchedTaskId,
          matched_task_identifier: matchedIdentifier,
          match_method: 'explicit_task_id',
          metadata: {
            number: iss.number,
            commentsCount: iss.commentsCount,
            labels: iss.labels,
            assignees: iss.assignees,
          },
          created_at_external: iss.createdAt,
          updated_at_external: iss.updatedAt,
          last_sync_at: nowIso,
        },
        { onConflict: 'repository_id,artifact_type,external_id' }
      );
      artifactsCount++;
    }

    // 10. Also update installation last_sync_at
    if (repo.installation_id) {
      await supabase
        .from('github_installations')
        .update({
          last_sync_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', repo.installation_id);
    }

    // 11. Match new artifacts against pending work claims
    const matchedClaims = await matchArtifactsToWorkspaceClaims(supabase, workspaceId);

    // 12. Audit Event
    await supabase.from('activity_events').insert({
      workspace_id: workspaceId,
      actor_id: null,
      entity_type: 'repository',
      entity_id: repo.id,
      event_type: 'evidence_sync_completed',
      metadata: {
        repository: repo.full_name,
        artifacts_synced: artifactsCount,
        contributors_count: evidencePackage.contributors.length,
        matched_claims: matchedClaims,
      },
    });

    return {
      success: true,
      artifactsSyncedCount: artifactsCount,
      matchedClaimsCount: matchedClaims,
      evidencePackage,
    };
  } catch (err: any) {
    console.error(`[GitHub Sync] Error syncing repo ${repo.full_name}:`, err);
    await supabase
      .from('github_repositories')
      .update({
        sync_status: 'error',
        sync_error: err?.message || 'Sync failed',
      })
      .eq('id', repo.id);

    return {
      success: false,
      artifactsSyncedCount: 0,
      matchedClaimsCount: 0,
      error: err?.message || 'Synchronization failed',
    };
  }
}
