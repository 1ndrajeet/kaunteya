'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Layers,
  GitBranch,
  Calendar,
  User,
  Users,
  Plus,
  ArrowLeft,
  ExternalLink,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Edit2,
  X,
  FileCode,
  Tag,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  Settings,
  FolderKanban,
  Activity,
  Check,
  Compass,
  RefreshCw,
  Lock,
  Globe,
  Bot,
  FileText,
  AlertTriangle,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { TaskDetailDrawer } from '@/features/tasks/task-detail-drawer';
import { CreateTaskModal } from '@/features/tasks/create-task-modal';
import { ProjectRepositoryContextOutput } from '@/lib/ai/schemas/repository-context';
import {
  getProjectDeadlineStatus,
  type Task,
  type ProjectStatus,
  type Priority,
  type TaskStatus,
} from '@/types/database';

export interface GithubRepositoryItem {
  id: string;
  name?: string;
  full_name: string;
  repo_url: string;
  is_private: boolean;
  default_branch: string;
  primary_language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  sync_status: string;
  last_sync_at: string | null;
  description: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  identifier: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  lead?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  project_repositories: {
    id: string;
    repository_url: string;
    created_at: string;
  }[];
  github_repositories?: GithubRepositoryItem[];
}

interface TeamMemberItem {
  id: string;
  user_id: string;
  added_by: string | null;
  joined_at: string;
  profiles?: {
    id: string;
    display_name: string;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface TeamItem {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  slug: string;
  description: string | null;
  lead_id: string | null;
  status: 'active' | 'archived';
  created_at: string;
  lead?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  team_members?: TeamMemberItem[];
}

interface ProjectMemberItem {
  id: string;
  project_id: string;
  user_id: string;
  role: 'lead' | 'member';
  joined_at: string;
  profiles?: {
    id: string;
    display_name: string;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface WorkspaceMemberOption {
  user_id: string;
  display_name: string;
  role: string;
}

interface ProjectTaskItem extends Task {
  assignee?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
    identifier: string;
  } | null;
}

interface ActivityEventItem {
  id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  metadata: any;
  created_at: string;
  profiles?: {
    display_name: string;
  } | null;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const unwrappedParams = use(params);
  const { workspaceId, projectId } = unwrappedParams;
  const { role, user } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active Tab: overview | tasks | teams | github | activity | settings
  const activeTab = searchParams.get('tab') || 'overview';

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<ProjectTaskItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberItem[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberOption[]>([]);
  const [projectActivities, setProjectActivities] = useState<ActivityEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected task for drawer
  const [selectedTask, setSelectedTask] = useState<ProjectTaskItem | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState<boolean>(false);

  // Add Repository Modal
  const [isAddRepoOpen, setIsAddRepoOpen] = useState<boolean>(false);
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [repoSubmitting, setRepoSubmitting] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Create Team Modal
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState<boolean>(false);
  const [teamName, setTeamName] = useState<string>('');
  const [teamSlug, setTeamSlug] = useState<string>('');
  const [teamDesc, setTeamDesc] = useState<string>('');
  const [teamLeadId, setTeamLeadId] = useState<string>('');
  const [teamSubmitting, setTeamSubmitting] = useState<boolean>(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Add Member to Team Modal
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>('');
  const [addMemberSubmitting, setAddMemberSubmitting] = useState<boolean>(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // Transfer Team Member Modal
  const [transferModalState, setTransferModalState] = useState<{
    isOpen: boolean;
    sourceTeamId: string;
    sourceTeamName: string;
    userId: string;
    userName: string;
    targetTeamId: string;
  } | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Enroll Project Member Modal
  const [isEnrollMemberOpen, setIsEnrollMemberOpen] = useState<boolean>(false);
  const [enrollUserId, setEnrollUserId] = useState<string>('');
  const [enrollRole, setEnrollRole] = useState<'lead' | 'member'>('member');
  const [enrollSubmitting, setEnrollSubmitting] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Edit Project State
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');
  const [editLeadId, setEditLeadId] = useState<string>('');
  const [editTargetDate, setEditTargetDate] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // GitHub & Gemini Intelligence States
  const [githubRepo, setGithubRepo] = useState<GithubRepositoryItem | null>(null);
  const [availableRepos, setAvailableRepos] = useState<GithubRepositoryItem[]>([]);
  const [selectedRepoToLink, setSelectedRepoToLink] = useState<string>('');
  const [linkingRepo, setLinkingRepo] = useState<boolean>(false);
  const [unlinkingRepo, setUnlinkingRepo] = useState<boolean>(false);
  const [contributors, setContributors] = useState<any[]>([]);
  const [evidenceArtifacts, setEvidenceArtifacts] = useState<any[]>([]);
  const [aiContext, setAiContext] = useState<ProjectRepositoryContextOutput | null>(null);
  const [aiContextStatus, setAiContextStatus] = useState<string>('none');
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [aiModelId, setAiModelId] = useState<string | null>(null);
  const [isSyncingGithub, setIsSyncingGithub] = useState<boolean>(false);
  const [isRegeneratingAI, setIsRegeneratingAI] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProjectData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Project + lead + BOTH repo tables
      const { data: rawProjData, error: projError } = await supabase
        .from('projects')
        .select(`
        id,
        name,
        identifier,
        description,
        status,
        start_date,
        target_date,
        completed_at,
        created_at,
        lead:profiles!projects_lead_id_fkey (
          id,
          display_name,
          avatar_url
        ),
        project_repositories (
          id,
          repository_url,
          created_at
        ),
        github_repositories (
          id,
          name,
          full_name,
          repo_url,
          is_private,
          default_branch,
          primary_language,
          stars_count,
          forks_count,
          open_issues_count,
          sync_status,
          last_sync_at,
          description
        )
      `)
        .eq('id', projectId)
        .eq('workspace_id', workspaceId)
        .single();

      const projData = rawProjData as unknown as ProjectDetail | null;

      if (projError || !projData) {
        console.error('[ProjectDetail] project fetch failed:', projError);
        setLoading(false);
        return;
      }

      setEditName(projData.name);
      setEditDescription(projData.description || '');
      setEditStatus(projData.status as ProjectStatus);
      setEditLeadId((projData as any).lead?.id || '');
      setEditTargetDate(projData.target_date || '');

      // 2. Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey (id, display_name, avatar_url),
        project:projects!tasks_project_id_fkey (id, name, identifier)
      `)
        .eq('project_id', projectId)
        .order('task_number', { ascending: false });
      if (taskData) setTasks(taskData as unknown as ProjectTaskItem[]);

      // 3. Teams + members
      const { data: teamData } = await supabase
        .from('teams')
        .select(`
        id, workspace_id, project_id, name, slug, description, lead_id, status, created_at,
        lead:profiles!teams_lead_id_fkey (id, display_name, avatar_url),
        team_members (
          id, user_id, added_by, joined_at,
          profiles:user_id (id, display_name, email, avatar_url)
        )
      `)
        .eq('project_id', projectId)
        .order('name', { ascending: true });
      if (teamData) setTeams(teamData as unknown as TeamItem[]);

      // 4. Project members
      const { data: pMemData } = await supabase
        .from('project_members')
        .select(`
        id, project_id, user_id, role, joined_at,
        profiles:user_id (id, display_name, email, avatar_url)
      `)
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true });
      if (pMemData) setProjectMembers(pMemData as unknown as ProjectMemberItem[]);

      // 5. Workspace members (lead selectors)
      const { data: wsMemData } = await supabase
        .from('workspace_members')
        .select(`user_id, role, profiles:user_id ( display_name )`)
        .eq('workspace_id', workspaceId);
      if (wsMemData) {
        setWorkspaceMembers(
          wsMemData.map((m: any) => ({
            user_id: m.user_id,
            role: m.role,
            display_name: m.profiles?.display_name || m.user_id.slice(0, 8),
          })),
        );
      }

      // 6. Activity (safe project and team scoped filter)
      const { data: actData } = await supabase
        .from('activity_events')
        .select(`
        id, actor_id, entity_type, entity_id, event_type, metadata, created_at,
        profiles:actor_id ( display_name )
      `)
        .eq('workspace_id', workspaceId)
        .or(`entity_id.eq.${projectId},metadata->>project_id.eq.${projectId}`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (actData) setProjectActivities(actData as unknown as ActivityEventItem[]);

      // 7. GitHub repo + contributors + artifacts + AI
      const { data: gRepo } = await supabase
        .from('github_repositories')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      const linkedRepo = (gRepo || (projData.github_repositories && projData.github_repositories[0]) || null) as GithubRepositoryItem | null;

      if (linkedRepo) {
        setGithubRepo(linkedRepo);

        const { data: contribs } = await supabase
          .from('github_repository_contributors')
          .select('*, profiles:taskpilot_user_id(display_name, email)')
          .eq('repository_id', linkedRepo.id)
          .order('contributions_count', { ascending: false });
        if (contribs) setContributors(contribs);

        const { data: artifacts } = await supabase
          .from('evidence_artifacts')
          .select('*')
          .eq('repository_id', linkedRepo.id)
          .order('last_sync_at', { ascending: false })
          .limit(50);
        if (artifacts) setEvidenceArtifacts(artifacts);

        const { data: aiCtx } = await supabase
          .from('project_ai_contexts')
          .select('*')
          .eq('project_id', projectId)
          .eq('task_name', 'project.repository_context')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (aiCtx) {
          setAiContext(aiCtx.structured_output as any);
          setAiContextStatus(aiCtx.status);
          setAiAnalyzedAt(aiCtx.analyzed_at || aiCtx.created_at);
          setAiModelId(aiCtx.model_id);
        }
      } else {
        setGithubRepo(null);
        setContributors([]);
        setEvidenceArtifacts([]);
        setAiContext(null);
        setAiContextStatus('none');
      }

      setProject({
        ...projData,
        github_repositories: linkedRepo ? [linkedRepo] : (projData.github_repositories || []),
      });

      // 8. Available workspace repositories for linking (project_id IS NULL)
      const { data: availRepos } = await supabase
        .from('github_repositories')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('project_id', null)
        .order('full_name', { ascending: true });

      if (availRepos) {
        setAvailableRepos(availRepos as unknown as GithubRepositoryItem[]);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchProjectData();
  }, [workspaceId, projectId]);

  // GitHub & Gemini Actions
  const handleSyncGithub = async () => {
    setIsSyncingGithub(true);
    setSyncFeedback(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncFeedback({ type: 'error', message: data.error || 'GitHub sync failed' });
      } else {
        setSyncFeedback({
          type: 'success',
          message: `Synced ${data.artifactsSyncedCount || 0} artifacts from GitHub`,
        });
        fetchProjectData();
      }
    } catch (err) {
      setSyncFeedback({ type: 'error', message: 'Network error triggering sync' });
    } finally {
      setIsSyncingGithub(false);
    }
  };

  const handleRegenerateAI = async () => {
    setIsRegeneratingAI(true);
    setSyncFeedback(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncFeedback({ type: 'error', message: data.error || 'Gemini analysis failed' });
      } else {
        setAiContext(data.analysis);
        setAiContextStatus('completed');
        setAiAnalyzedAt(data.analyzedAt);
        setAiModelId(data.modelId);
        setSyncFeedback({
          type: 'success',
          message: 'Gemini project context regenerated successfully',
        });
      }
    } catch (err) {
      setSyncFeedback({ type: 'error', message: 'Network error running analysis' });
    } finally {
      setIsRegeneratingAI(false);
    }
  };

  // Tab changer helper preserving query params
  const setTab = (tab: string) => {
    router.push(`/workspace/${workspaceId}/projects/${projectId}?tab=${tab}`);
  };

  /* ------------------- Link Existing GitHub Repository ------------------- */
  const handleLinkExistingRepo = async (repoId: string) => {
    if (!repoId || !user) return;
    setLinkingRepo(true);
    setSyncFeedback(null);
    const supabase = createClient();

    try {
      // Invariant per schema.sql: uq_github_repo_project_single (project_id) WHERE project_id IS NOT NULL;
      // If a repo is already linked to this project, unlink it first
      if (githubRepo && githubRepo.id !== repoId) {
        await supabase
          .from('github_repositories')
          .update({ project_id: null, updated_at: new Date().toISOString() })
          .eq('id', githubRepo.id);
      }

      const { data: updatedRepo, error } = await supabase
        .from('github_repositories')
        .update({
          project_id: projectId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', repoId)
        .select()
        .single();

      if (error) {
        setSyncFeedback({ type: 'error', message: error.message });
        return;
      }

      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        event_type: 'repository_linked',
        metadata: {
          repository_id: repoId,
          full_name: updatedRepo.full_name,
          project_name: project?.name,
        },
      });

      setSelectedRepoToLink('');
      setIsAddRepoOpen(false);
      setSyncFeedback({
        type: 'success',
        message: `Successfully linked ${updatedRepo.full_name} to this project.`,
      });
      fetchProjectData();
    } catch (err: any) {
      setSyncFeedback({ type: 'error', message: err.message || 'Failed to link repository' });
    } finally {
      setLinkingRepo(false);
    }
  };

  /* ------------------ Unlink Existing GitHub Repository ------------------ */
  const handleUnlinkGithubRepo = async (repoId: string, repoFullName: string) => {
    if (!confirm(`Are you sure you want to unlink ${repoFullName} from this project?`)) return;
    setUnlinkingRepo(true);
    setSyncFeedback(null);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('github_repositories')
        .update({
          project_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', repoId);

      if (error) {
        setSyncFeedback({ type: 'error', message: error.message });
        return;
      }

      if (user) {
        await supabase.from('activity_events').insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          entity_type: 'project',
          entity_id: projectId,
          event_type: 'repository_unlinked',
          metadata: {
            repository_id: repoId,
            full_name: repoFullName,
            project_name: project?.name,
          },
        });
      }

      setSyncFeedback({
        type: 'success',
        message: `Unlinked ${repoFullName} from this project.`,
      });
      fetchProjectData();
    } catch (err: any) {
      setSyncFeedback({ type: 'error', message: err.message || 'Failed to unlink repository' });
    } finally {
      setUnlinkingRepo(false);
    }
  };

  /* ------------------------------- Add Repo ------------------------------- */
  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || !user) return;

    if (!repoUrl.startsWith('https://github.com/')) {
      setRepoError('URL must be a valid GitHub repository (https://github.com/owner/repo)');
      return;
    }

    setRepoSubmitting(true);
    setRepoError(null);
    const supabase = createClient();

    try {
      const cleanPath = repoUrl.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '');

      // Check if this workspace has an authorized github_repositories row matching full_name
      const { data: matchingGhRepo } = await supabase
        .from('github_repositories')
        .select('id, full_name, project_id')
        .eq('workspace_id', workspaceId)
        .ilike('full_name', cleanPath)
        .maybeSingle();

      if (matchingGhRepo) {
        if (matchingGhRepo.project_id && matchingGhRepo.project_id !== projectId) {
          setRepoError('This GitHub repository is already connected to another project in this workspace.');
          setRepoSubmitting(false);
          return;
        }
        await supabase
          .from('github_repositories')
          .update({ project_id: projectId, updated_at: new Date().toISOString() })
          .eq('id', matchingGhRepo.id);
      }

      const { error } = await supabase.from('project_repositories').insert({
        project_id: projectId,
        repository_url: repoUrl.trim(),
        created_by: user.id,
      });

      if (error && error.code !== '23505') {
        setRepoError(error.message);
        setRepoSubmitting(false);
        return;
      }

      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        event_type: 'repository_linked',
        metadata: { repository_url: repoUrl.trim(), project_name: project?.name },
      });

      setRepoUrl('');
      setIsAddRepoOpen(false);
      fetchProjectData();
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to link repository');
    } finally {
      setRepoSubmitting(false);
    }
  };

  const handleRemoveRepo = async (repoId: string, url: string) => {
    if (!confirm(`Are you sure you want to unlink ${url}?`)) return;
    const supabase = createClient();

    const { error } = await supabase.from('project_repositories').delete().eq('id', repoId);

    if (!error && user) {
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        event_type: 'repository_unlinked',
        metadata: { repository_url: url, project_name: project?.name },
      });
      fetchProjectData();
    }
  };

  /* ------------------------------ Create Team ------------------------------ */
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !teamSlug.trim() || !user) return;

    setTeamSubmitting(true);
    setTeamError(null);
    const supabase = createClient();

    try {
      const { data: createdTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          name: teamName.trim(),
          slug: teamSlug.trim().toLowerCase(),
          description: teamDesc.trim() || null,
          lead_id: teamLeadId || null,
          status: 'active',
        })
        .select()
        .single();

      if (teamErr) {
        setTeamError(teamErr.message);
        setTeamSubmitting(false);
        return;
      }

      // If team lead was selected, auto-enroll them in team_members and project_members
      if (teamLeadId) {
        await supabase.from('team_members').insert({
          team_id: createdTeam.id,
          user_id: teamLeadId,
          added_by: user.id,
        });

        await supabase.from('project_members').insert({
          project_id: projectId,
          user_id: teamLeadId,
          role: 'lead',
        });
      }

      // Record activity
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'team',
        entity_id: createdTeam.id,
        event_type: 'created',
        metadata: { name: createdTeam.name, project_id: projectId, project_name: project?.name },
      });

      setTeamName('');
      setTeamSlug('');
      setTeamDesc('');
      setTeamLeadId('');
      setIsCreateTeamOpen(false);
      fetchProjectData();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setTeamSubmitting(false);
    }
  };

  /* ------------------------- Add Member to Team ---------------------------- */
  const handleAddMemberToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingToTeamId || !selectedMemberToAdd || !user) return;

    setAddMemberSubmitting(true);
    setAddMemberError(null);
    const supabase = createClient();

    try {
      // 1. Ensure user is in project_members first
      await supabase.from('project_members').upsert(
        { project_id: projectId, user_id: selectedMemberToAdd, role: 'member' },
        { onConflict: 'project_id,user_id' }
      );

      // 2. Insert into team_members
      const { error: tmErr } = await supabase.from('team_members').insert({
        team_id: addingToTeamId,
        user_id: selectedMemberToAdd,
        added_by: user.id,
      });

      if (tmErr) {
        if (tmErr.code === '23505') {
          setAddMemberError('This user is already a member of this team.');
        } else {
          setAddMemberError(tmErr.message);
        }
        setAddMemberSubmitting(false);
        return;
      }

      setAddingToTeamId(null);
      setSelectedMemberToAdd('');
      fetchProjectData();
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member to team');
    } finally {
      setAddMemberSubmitting(false);
    }
  };

  const handleRemoveTeamMember = async (teamId: string, memberUserId: string) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) return;
    const supabase = createClient();

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', memberUserId);

    if (!error) {
      fetchProjectData();
    }
  };

  /* ----------------------- Transfer Team Member ---------------------------- */
  const handleTransferMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalState || !transferModalState.targetTeamId || !user) return;

    setTransferSubmitting(true);
    setTransferError(null);
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc('move_team_member', {
        p_source_team_id: transferModalState.sourceTeamId,
        p_target_team_id: transferModalState.targetTeamId,
        p_user_id: transferModalState.userId,
      });

      if (error) {
        setTransferError(error.message);
        setTransferSubmitting(false);
        return;
      }

      setTransferModalState(null);
      fetchProjectData();
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  /* ----------------------- Enroll Project Member --------------------------- */
  const handleEnrollProjectMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollUserId || !user) return;

    setEnrollSubmitting(true);
    setEnrollError(null);
    const supabase = createClient();

    try {
      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: enrollUserId,
        role: enrollRole,
      });

      if (error) {
        if (error.code === '23505') {
          setEnrollError('User is already enrolled in this project.');
        } else {
          setEnrollError(error.message);
        }
        setEnrollSubmitting(false);
        return;
      }

      setEnrollUserId('');
      setIsEnrollMemberOpen(false);
      fetchProjectData();
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setEnrollSubmitting(false);
    }
  };

  /* ------------------------- Update Project Settings ----------------------- */
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !user) return;

    setEditSubmitting(true);
    setEditMessage(null);
    const supabase = createClient();

    try {
      const completedAtTimestamp =
        editStatus === 'completed'
          ? project?.completed_at || new Date().toISOString()
          : null;

      const { error } = await supabase
        .from('projects')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          status: editStatus,
          lead_id: editLeadId || null,
          target_date: editTargetDate || null,
          completed_at: completedAtTimestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('workspace_id', workspaceId);

      if (error) {
        setEditMessage(`Error: ${error.message}`);
        setEditSubmitting(false);
        return;
      }

      // If lead changed, ensure enrolled in project_members as lead
      if (editLeadId) {
        await supabase.from('project_members').upsert(
          { project_id: projectId, user_id: editLeadId, role: 'lead' },
          { onConflict: 'project_id,user_id' }
        );
      }

      setEditMessage('Project successfully updated.');
      setTimeout(() => setEditMessage(null), 3000);
      fetchProjectData();
    } catch (err) {
      setEditMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#6E5D4E] font-mono text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#DC6E26]" />
        <span>Loading project workspace &amp; teams...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-[#882315] mx-auto" />
        <h3 className="text-base font-serif font-bold text-[#23170E]">Project Not Found</h3>
        <p className="text-xs text-[#6E5D4E]">
          This project either does not exist or you lack permission to view it.
        </p>
        <Link
          href={`/workspace/${workspaceId}/projects`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#EAE2D4] border border-[#E3DAC8] text-[#23170E] text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>
      </div>
    );
  }

  const isAuthorizedToEdit = role === 'admin' || role === 'lead';
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Done').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const deadline = getProjectDeadlineStatus(project);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs text-[#6E5D4E]">
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${workspaceId}/projects`}
            className="hover:text-[#23170E] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Projects
          </Link>
          <span>/</span>
          <span className="font-mono text-[#23170E] font-bold">[{project.identifier}]</span>
          <span className="text-[#6E5D4E] truncate max-w-xs">{project.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {deadline.status !== 'no_deadline' && (
            <span className={`text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full border ${deadline.badgeClass}`}>
              {deadline.label}
            </span>
          )}
        </div>
      </div>

      {/* Project Header Banner */}
      <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]">
              {project.identifier}
            </span>
            <span
              className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full border ${project.status === 'active'
                ? 'bg-[#ECF6E3] text-[#2B5910] border-[#D4E9C1]'
                : project.status === 'planning'
                  ? 'bg-[#FCF3E3] text-[#824B04] border-[#F1DCBA]'
                  : project.status === 'at_risk'
                    ? 'bg-[#FCECE9] text-[#882315] border-[#F4CFC8]'
                    : project.status === 'completed'
                      ? 'bg-[#ECF6E3] text-[#2B5910] border-[#D4E9C1]'
                      : 'bg-[#F2ECE1] text-[#6E5D4E] border-[#E3DAC8]'
                }`}
            >
              {project.status}
            </span>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-[#23170E]">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-[#6E5D4E] mt-1.5 leading-relaxed max-w-2xl">{project.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#6E5D4E] pt-2">
            <span className="flex items-center gap-1.5 text-[#23170E]">
              <User className="h-3.5 w-3.5 text-[#DC6E26]" />
              Lead: {project.lead?.display_name || 'Unassigned'}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[#6E5D4E]">
              <Users className="h-3.5 w-3.5 text-[#DC6E26]" />
              {teams.length} Teams &bull; {projectMembers.length} Members
            </span>
            {project.target_date && (
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-[#DC6E26]" />
                Target: {new Date(project.target_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Completion Progress Widget */}
        <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0">
          <div className="w-48 space-y-1.5 bg-[#F2ECE1] p-3.5 rounded-2xl border border-[#E3DAC8]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6E5D4E] font-medium">Completion</span>
              <span className="font-mono text-[#23170E] font-bold">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-[#E3DAC8] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#DC6E26] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-[#6E5D4E] text-right">
              {completedTasks} of {totalTasks} tasks done
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-[#E3DAC8] overflow-x-auto text-xs font-medium pb-px">
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckCircle2 },
          { id: 'teams', label: `Teams & Members (${teams.length})`, icon: Users },
          {
            id: 'github',
            label: `GitHub Repositories (${(project.github_repositories?.length ?? 0) + (project.project_repositories?.length ?? 0)})`,
            icon: GitBranch,
          },
          { id: 'activity', label: 'Activity Trail', icon: Activity },
          { id: 'settings', label: 'Project Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium transition-colors whitespace-nowrap ${isActive
                ? 'border-[#DC6E26] text-[#DC6E26] font-semibold'
                : 'border-transparent text-[#6E5D4E] hover:text-[#23170E] hover:border-[#E3DAC8]'
                }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Sync / Regeneration Feedback Banner */}
          {syncFeedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border ${syncFeedback.type === 'success'
                ? 'bg-[#ECF6E3] border-[#D4E9C1] text-[#2B5910]'
                : 'bg-[#FCECE9] border-[#F4CFC8] text-[#882315]'
                }`}
            >
              <div className="flex items-center gap-2">
                {syncFeedback.type === 'success' ? (
                  <Check className="h-4 w-4 text-[#2B5910]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#882315]" />
                )}
                <span>{syncFeedback.message}</span>
              </div>
              <button
                onClick={() => setSyncFeedback(null)}
                className="text-[#6E5D4E] hover:text-[#23170E]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 1. Connected GitHub Repository Source Card */}
          <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] flex items-center justify-center shrink-0">
                  <GitBranch className="h-4 w-4 text-[#DC6E26]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#23170E] font-mono">
                      {githubRepo ? githubRepo.full_name : 'No GitHub Repository Linked'}
                    </h2>
                    {githubRepo && (
                      <a
                        href={githubRepo.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6E5D4E] hover:text-[#DC6E26]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6E5D4E] mt-0.5">
                    {githubRepo?.description || 'Connected repository providing authoritative source evidence.'}
                  </p>
                </div>
              </div>

              {githubRepo && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSyncGithub}
                    disabled={isSyncingGithub}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#EAE2D4] border border-[#E3DAC8] text-[#23170E] text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncingGithub ? 'animate-spin text-[#DC6E26]' : ''}`} />
                    {isSyncingGithub ? 'Syncing...' : 'Sync GitHub Data'}
                  </button>
                </div>
              )}
            </div>

            {githubRepo ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E3DAC8] text-xs">
                <div className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                  <span className="text-[10px] font-mono text-[#6E5D4E] uppercase">Visibility & Branch</span>
                  <div className="flex items-center gap-1.5 font-mono text-[#23170E]">
                    {githubRepo.is_private ? (
                      <span className="flex items-center gap-1 text-[#824B04] text-[11px] font-medium">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#2B5910] text-[11px] font-medium">
                        <Globe className="h-3 w-3" /> Public
                      </span>
                    )}
                    <span className="text-[#A89A8A]">&bull;</span>
                    <span className="text-[11px] truncate">{githubRepo.default_branch}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                  <span className="text-[10px] font-mono text-[#6E5D4E] uppercase">Primary Language</span>
                  <p className="font-mono text-[#23170E] text-[11px] truncate">
                    {githubRepo.primary_language || 'Not detected'}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                  <span className="text-[10px] font-mono text-[#6E5D4E] uppercase">Stats</span>
                  <p className="font-mono text-[#23170E] text-[11px]">
                    ⭐ {githubRepo.stars_count || 0} &bull; 🍴 {githubRepo.forks_count || 0} &bull; ⚠️ {githubRepo.open_issues_count || 0}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                  <span className="text-[10px] font-mono text-[#6E5D4E] uppercase">Data Freshness</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${githubRepo.sync_status === 'synced'
                        ? 'bg-[#2B5910]'
                        : githubRepo.sync_status === 'syncing'
                          ? 'bg-[#DC6E26] animate-pulse'
                          : 'bg-[#6E5D4E]'
                        }`}
                    />
                    <span className="font-mono text-[11px] text-[#23170E] capitalize">
                      {githubRepo.last_sync_at
                        ? new Date(githubRepo.last_sync_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : 'Never synced'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#FCF3E3] border border-[#F1DCBA] text-[#824B04] text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#824B04]" />
                <span>Legacy project created without a mandatory GitHub repository connection.</span>
              </div>
            )}
          </div>

          {/* 2. Universal Gemini Intelligence Card */}
          <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3DAC8]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#FCF3E3] border border-[#F1DCBA] flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-[#DC6E26]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold font-serif text-[#23170E] flex items-center gap-1.5">
                      Gemini Project Intelligence
                    </h2>
                    {aiModelId && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECE1] border border-[#E3DAC8] text-[#6E5D4E]">
                        {aiModelId}
                      </span>
                    )}
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${aiContextStatus === 'completed'
                        ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                        : aiContextStatus === 'pending'
                          ? 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA] animate-pulse'
                          : 'bg-[#F2ECE1] text-[#6E5D4E] border border-[#E3DAC8]'
                        }`}
                    >
                      {aiContextStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E5D4E] mt-0.5">
                    {aiAnalyzedAt
                      ? `Generated from repository evidence at ${new Date(aiAnalyzedAt).toLocaleString()}`
                      : 'AI-derived project interpretation grounded in GitHub source data.'}
                  </p>
                </div>
              </div>

              {githubRepo && (
                <button
                  onClick={handleRegenerateAI}
                  disabled={isRegeneratingAI}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`h-3 w-3 ${isRegeneratingAI ? 'animate-spin' : ''}`} />
                  {isRegeneratingAI ? 'Analyzing Evidence...' : 'Regenerate AI Context'}
                </button>
              )}
            </div>

            {aiContext ? (
              <div className="space-y-4 text-xs">
                {/* Suggested Description Box */}
                {aiContext.suggestedDescription && (
                  <div className="p-3.5 rounded-2xl bg-[#FCF3E3] border border-[#F1DCBA] space-y-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-[#824B04]">
                      Suggested Project Description
                    </span>
                    <p className="text-[#23170E] leading-relaxed text-xs">
                      {aiContext.suggestedDescription}
                    </p>
                  </div>
                )}

                {/* Purpose and Problem Domain */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                    <span className="font-mono text-[10px] uppercase text-[#6E5D4E] font-bold">Purpose</span>
                    <p className="text-[#23170E] text-xs leading-relaxed">{aiContext.purpose}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                    <span className="font-mono text-[10px] uppercase text-[#6E5D4E] font-bold">Problem Domain</span>
                    <p className="text-[#23170E] text-xs leading-relaxed">{aiContext.problemDomain}</p>
                  </div>
                </div>

                {/* Frameworks & Tools and Architecture Hints */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-2">
                    <span className="font-mono text-[10px] uppercase text-[#6E5D4E] font-bold">
                      Frameworks &amp; Major Tools
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiContext.frameworksAndTools?.length > 0 ? (
                        aiContext.frameworksAndTools?.map((tool, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#23170E] border border-[#E3DAC8]"
                          >
                            {tool}
                          </span>
                        ))
                      ) : (
                        <span className="text-[#6E5D4E] italic text-[11px]">None detected in manifests</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-2">
                    <span className="font-mono text-[10px] uppercase text-[#6E5D4E] font-bold">
                      Architecture Characteristics
                    </span>
                    <ul className="space-y-1">
                      {aiContext.architectureHints?.length > 0 ? (
                        aiContext.architectureHints?.map((hint, idx) => (
                          <li key={idx} className="text-[#23170E] text-[11px] flex items-start gap-1.5">
                            <span className="text-[#DC6E26] font-bold">&bull;</span> {hint}
                          </li>
                        ))
                      ) : (
                        <li className="text-[#6E5D4E] italic text-[11px]">Standard repository layout</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Recent Activity Summary */}
                {aiContext.recentActivitySummary && (
                  <div className="p-3.5 rounded-2xl bg-[#F2ECE1] border border-[#E3DAC8] space-y-1">
                    <span className="font-mono text-[10px] uppercase text-[#6E5D4E] font-bold">
                      Recent Activity Summary
                    </span>
                    <p className="text-[#23170E] text-xs leading-relaxed">
                      {aiContext.recentActivitySummary}
                    </p>
                  </div>
                )}

                {/* Blockers or Failed Checks Alert (if present) */}
                {aiContext.notableBlockersOrFailedChecks && aiContext.notableBlockersOrFailedChecks?.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-[#FCECE9] border border-[#F4CFC8] text-[#882315] space-y-1">
                    <span className="font-mono text-[10px] uppercase font-bold flex items-center gap-1.5 text-[#882315]">
                      <AlertTriangle className="h-3.5 w-3.5" /> Notable Blockers &amp; Failing Checks
                    </span>
                    <ul className="space-y-0.5 pl-4 list-disc text-[11px]">
                      {aiContext.notableBlockersOrFailedChecks?.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Confidence & Evidence References Footer */}
                {aiContext.confidenceNotes && aiContext.confidenceNotes?.length > 0 && (
                  <div className="pt-2 text-[10px] text-[#6E5D4E] font-mono space-y-1">
                    <span className="text-[#23170E] font-semibold">Confidence Notes:</span>
                    <p>{aiContext.confidenceNotes?.join(' • ')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <Bot className="h-6 w-6 text-[#DC6E26] mx-auto" />
                <p className="text-xs text-[#23170E] font-medium">No Gemini Analysis Generated Yet</p>
                <p className="text-[11px] text-[#6E5D4E] max-w-md mx-auto">
                  Run Gemini analysis on the connected GitHub repository evidence to extract architecture insights, frameworks, and activity summaries.
                </p>
                {githubRepo && (
                  <button
                    onClick={handleRegenerateAI}
                    disabled={isRegeneratingAI}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Bot className="h-3 w-3" /> Generate Context
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Authoritative GitHub Evidence Feeds */}
          {githubRepo && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent Commits */}
              <div className="p-5 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-serif text-[#23170E] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#DC6E26]" /> Recent Commits
                  </h3>
                  <span className="text-[10px] font-mono text-[#6E5D4E]">Authoritative Evidence</span>
                </div>
                <div className="space-y-1.5">
                  {evidenceArtifacts.filter((a) => a.artifact_type === 'commit').slice(0, 5).length === 0 ? (
                    <p className="text-[11px] text-[#6E5D4E] py-2">No commit artifacts synced yet.</p>
                  ) : (
                    evidenceArtifacts
                      .filter((a) => a.artifact_type === 'commit')
                      .slice(0, 5)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] flex items-start justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[#23170E] font-mono text-[11px] truncate">{c.title}</p>
                            <span className="text-[10px] text-[#6E5D4E] font-mono">
                              {c.created_at_external ? new Date(c.created_at_external).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <a
                            href={c.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAF7F2] text-[#DC6E26] border border-[#E3DAC8] hover:text-[#C05617] shrink-0 font-medium"
                          >
                            {c.external_id.slice(0, 7)}
                          </a>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Contributors with Identity Mapping */}
              <div className="p-5 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-serif text-[#23170E] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#DC6E26]" /> GitHub Contributors ({contributors.length})
                  </h3>
                  <span className="text-[10px] font-mono text-[#6E5D4E]">Identity Status</span>
                </div>
                <div className="space-y-1.5">
                  {contributors.slice(0, 5).length === 0 ? (
                    <p className="text-[11px] text-[#6E5D4E] py-2">No contributor records loaded yet.</p>
                  ) : (
                    contributors.slice(0, 5).map((ct) => (
                      <div
                        key={ct.id}
                        className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {ct.avatar_url ? (
                            <img src={ct.avatar_url} alt="" className="h-5 w-5 rounded-full shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-[#E3DAC8] shrink-0" />
                          )}
                          <span className="font-mono text-[11px] text-[#23170E] truncate font-medium">{ct.login}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[10px] text-[#6E5D4E]">
                            {ct.contributions_count} commits
                          </span>
                          {ct.profiles ? (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]">
                              {ct.profiles.display_name}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#6E5D4E] border border-[#E3DAC8]">
                              External User
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-xs">
              <span className="text-[11px] font-mono text-[#6E5D4E]">Total Tasks</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-bold text-[#23170E]">{totalTasks}</span>
                <span className="text-xs text-[#2B5910] font-medium">({completedTasks} done)</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-xs">
              <span className="text-[11px] font-mono text-[#6E5D4E]">Project Teams</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-bold text-[#23170E]">{teams.length}</span>
                <span className="text-xs text-[#6E5D4E]">across {projectMembers.length} members</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-1 shadow-xs">
              <span className="text-[11px] font-mono text-[#6E5D4E]">Connected Repositories</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-bold text-[#23170E]">
                  {githubRepo ? 1 : project.project_repositories?.length || 0}
                </span>
                <span className="text-xs text-[#DC6E26] font-medium">code graph linked</span>
              </div>
            </div>
          </div>

          {/* 5. Teams Summary in Overview */}
          <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#DC6E26]" />
                <h2 className="text-sm font-serif font-bold text-[#23170E]">Project Teams</h2>
              </div>
              <button
                onClick={() => setTab('teams')}
                className="text-xs text-[#DC6E26] hover:text-[#C05617] font-semibold"
              >
                Manage Teams &rarr;
              </button>
            </div>

            {teams.length === 0 ? (
              <p className="text-xs text-[#6E5D4E] py-3">No teams created under this project yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {teams.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#23170E]">{t.name}</h4>
                      <p className="text-[11px] text-[#6E5D4E]">Lead: {t.lead?.display_name || 'Unassigned'}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#23170E] border border-[#E3DAC8]">
                      {t.team_members?.length || 0} members
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: TASKS */}
      {/* ==================================================================== */}
      {activeTab === 'tasks' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#DC6E26]" />
              <h2 className="text-sm font-serif font-bold text-[#23170E]">Project Tasks ({tasks.length})</h2>
            </div>
            <button
              onClick={() => setIsNewTaskOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Task
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#E3DAC8] text-center space-y-2 bg-[#FAF7F2]">
              <p className="text-xs text-[#6E5D4E]">No tasks created under {project.name} yet.</p>
              <button
                onClick={() => setIsNewTaskOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Create First Task
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E3DAC8] border border-[#E3DAC8] rounded-2xl overflow-hidden bg-[#FAF7F2] shadow-xs">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="p-3.5 hover:bg-[#F2ECE1] cursor-pointer transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#6E5D4E]">
                      {project.identifier}-{task.task_number}
                    </span>
                    <p className="text-xs font-medium text-[#23170E] truncate">{task.title}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${task.priority === 'Urgent'
                        ? 'bg-[#FCECE9] text-[#882315] border-[#F4CFC8]'
                        : task.priority === 'High'
                          ? 'bg-[#FCF3E3] text-[#824B04] border-[#F1DCBA]'
                          : 'bg-[#F2ECE1] text-[#6E5D4E] border-[#E3DAC8]'
                        }`}
                    >
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#23170E] border border-[#E3DAC8]">
                      {task.status}
                    </span>
                    <span className="text-[11px] text-[#6E5D4E] min-w-[100px] text-right truncate">
                      {task.assignee?.display_name || <span className="text-[#824B04]">Unassigned</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: TEAMS & MEMBERS MANAGEMENT */}
      {/* ==================================================================== */}
      {activeTab === 'teams' && (
        <div className="space-y-8 animate-in fade-in">
          {/* Project Teams Section */}
          <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold font-serif text-[#23170E] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#DC6E26]" /> Project Teams ({teams.length})
                </h2>
                <p className="text-xs text-[#6E5D4E] mt-1">
                  Teams are scoped strictly to {project.name}. Team leaders manage their own squads, while Workspace Admins can transfer members.
                </p>
              </div>

              {isAuthorizedToEdit && (
                <button
                  onClick={() => setIsCreateTeamOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Project Team
                </button>
              )}
            </div>

            {teams.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-[#E3DAC8] text-center space-y-3 bg-[#FAF7F2]">
                <Users className="h-6 w-6 text-[#DC6E26] mx-auto" />
                <p className="text-xs text-[#6E5D4E]">No teams created for {project.name} yet.</p>
                {isAuthorizedToEdit && (
                  <button
                    onClick={() => setIsCreateTeamOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create First Team
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {teams.map((team) => {
                  const isTeamLead = team.lead_id === user?.id;
                  const canManageThisTeam = role === 'admin' || isTeamLead;

                  return (
                    <div
                      key={team.id}
                      className="p-5 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-[#23170E]">{team.name}</h3>
                            <span className="text-[10px] font-mono text-[#6E5D4E]">({team.slug})</span>
                          </div>
                          {team.description && (
                            <p className="text-xs text-[#6E5D4E] mt-1 leading-relaxed">
                              {team.description}
                            </p>
                          )}
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#23170E] border border-[#E3DAC8] shrink-0">
                          {team.team_members?.length || 0} members
                        </span>
                      </div>

                      {/* Team Lead Indicator */}
                      <div className="flex items-center gap-2 text-xs text-[#6E5D4E] pt-2 border-t border-[#E3DAC8]">
                        <Compass className="h-3.5 w-3.5 text-[#DC6E26] shrink-0" />
                        <span className="text-[#6E5D4E]">Team Leader:</span>
                        <span className="font-semibold text-[#23170E]">
                          {team.lead?.display_name || <span className="text-[#824B04] font-normal">Unassigned</span>}
                        </span>
                      </div>

                      {/* Members List in Team */}
                      <div className="space-y-2 pt-2 border-t border-[#E3DAC8]">
                        <span className="text-[11px] font-mono uppercase text-[#6E5D4E] font-semibold block">
                          Team Members
                        </span>

                        {!team.team_members || team.team_members.length === 0 ? (
                          <p className="text-xs text-[#6E5D4E]">No members assigned to this team yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {team.team_members.map((tm) => (
                              <div
                                key={tm.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-[#FAF7F2] border border-[#E3DAC8] text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-5 w-5 rounded-full bg-[#EAE2D4] flex items-center justify-center text-[10px] font-bold text-[#DC6E26] shrink-0">
                                    {tm.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                                  </div>
                                  <span className="truncate text-[#23170E] font-medium">
                                    {tm.profiles?.display_name || tm.user_id.slice(0, 8)}
                                  </span>
                                  {tm.user_id === team.lead_id && (
                                    <span className="text-[9px] font-mono px-1.5 rounded-full bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]">
                                      Leader
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Transfer button (Admin only) */}
                                  {role === 'admin' && teams.length > 1 && (
                                    <button
                                      onClick={() => {
                                        const otherTeam = teams.find((t) => t.id !== team.id);
                                        setTransferModalState({
                                          isOpen: true,
                                          sourceTeamId: team.id,
                                          sourceTeamName: team.name,
                                          userId: tm.user_id,
                                          userName: tm.profiles?.display_name || 'Member',
                                          targetTeamId: otherTeam ? otherTeam.id : '',
                                        });
                                      }}
                                      title="Transfer member to another team"
                                      className="p-1 rounded text-[#6E5D4E] hover:text-[#DC6E26] hover:bg-[#EAE2D4] transition-colors"
                                    >
                                      <ArrowRightLeft className="h-3 w-3" />
                                    </button>
                                  )}

                                  {/* Remove member button */}
                                  {canManageThisTeam && (
                                    <button
                                      onClick={() => handleRemoveTeamMember(team.id, tm.user_id)}
                                      title="Remove from team"
                                      className="p-1 rounded text-[#6E5D4E] hover:text-[#882315] hover:bg-[#EAE2D4] transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Member to this team action */}
                      {canManageThisTeam && (
                        <button
                          onClick={() => {
                            setAddingToTeamId(team.id);
                            setSelectedMemberToAdd(workspaceMembers[0]?.user_id || '');
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-[#E3DAC8] bg-[#FAF7F2] text-xs font-medium text-[#6E5D4E] hover:border-[#DC6E26] hover:text-[#DC6E26] transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Add Member to Team
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Project Membership Section */}
          <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold font-serif text-[#23170E] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#2B5910]" /> Authorized Project Members ({projectMembers.length})
                </h2>
                <p className="text-xs text-[#6E5D4E] mt-1">
                  Users with authorized access to {project.name}. Team membership is drawn from this authorized scope.
                </p>
              </div>

              {role === 'admin' && (
                <button
                  onClick={() => {
                    setIsEnrollMemberOpen(true);
                    setEnrollUserId(workspaceMembers[0]?.user_id || '');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#EAE2D4] border border-[#E3DAC8] text-[#23170E] text-xs font-semibold transition-colors shadow-xs"
                >
                  <Plus className="h-3 w-3" /> Enroll Workspace Member
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {projectMembers.map((pm) => (
                <div
                  key={pm.id}
                  className="p-3.5 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-[#EAE2D4] flex items-center justify-center text-xs font-bold text-[#DC6E26] shrink-0">
                      {pm.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#23170E] truncate">
                        {pm.profiles?.display_name || pm.user_id.slice(0, 8)}
                      </p>
                      <p className="text-[10px] text-[#6E5D4E] font-mono truncate">{pm.profiles?.email}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold border ${pm.role === 'lead'
                      ? 'bg-[#FCF3E3] text-[#824B04] border-[#F1DCBA]'
                      : 'bg-[#FAF7F2] text-[#6E5D4E] border-[#E3DAC8]'
                      }`}
                  >
                    {pm.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: GITHUB REPOSITORIES */}
      {/* ==================================================================== */}
      {activeTab === 'github' && (
        <div className="space-y-6 animate-in fade-in">

          {/* Authorized GitHub repositories (new flow) */}
          <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[#DC6E26]" />
                <h2 className="text-sm font-bold font-serif text-[#23170E]">Authorized GitHub Repositories</h2>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#23170E] border border-[#E3DAC8]">
                  {project.github_repositories?.length || 0}
                </span>
              </div>

              {isAuthorizedToEdit && (!project.github_repositories || project.github_repositories.length === 0) && (
                <button
                  onClick={() => setIsAddRepoOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Link Repository
                </button>
              )}
            </div>

            {!project.github_repositories || project.github_repositories.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-[#E3DAC8] text-center space-y-4 bg-[#FAF7F2]">
                <GitBranch className="h-6 w-6 text-[#DC6E26] mx-auto" />
                <div>
                  <p className="text-xs text-[#23170E] font-medium">
                    No GitHub repository linked to this project.
                  </p>
                  <p className="text-[11px] text-[#6E5D4E] mt-0.5">
                    Link an authorized repository installed in this workspace to enable evidence collection and Gemini analysis.
                  </p>
                </div>

                {availableRepos.length > 0 ? (
                  isAuthorizedToEdit && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto pt-2">
                      <select
                        value={selectedRepoToLink}
                        onChange={(e) => setSelectedRepoToLink(e.target.value)}
                        className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-[#23170E] text-xs focus:outline-none focus:border-[#DC6E26] font-mono"
                      >
                        <option value="">Select an authorized repository...</option>
                        {availableRepos.map((ar) => (
                          <option key={ar.id} value={ar.id}>
                            {ar.full_name} ({ar.is_private ? 'private' : 'public'})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleLinkExistingRepo(selectedRepoToLink)}
                        disabled={!selectedRepoToLink || linkingRepo}
                        className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shrink-0 disabled:opacity-50 transition-all shadow-xs"
                      >
                        {linkingRepo ? 'Linking...' : 'Connect'}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {isAuthorizedToEdit && (
                      <button
                        onClick={() => setIsAddRepoOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#EAE2D4] border border-[#E3DAC8] text-[#23170E] text-xs font-semibold transition-colors shadow-xs"
                      >
                        <Plus className="h-3 w-3" /> Connect via URL
                      </button>
                    )}
                    <Link
                      href={`/workspace/${workspaceId}/admin/integrations`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-all"
                    >
                      <Settings className="h-3 w-3" /> GitHub Integration Settings
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {project.github_repositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-5 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-[#FAF7F2] border border-[#E3DAC8] flex items-center justify-center shrink-0">
                          {repo.is_private ? (
                            <Lock className="h-3.5 w-3.5 text-[#824B04]" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 text-[#2B5910]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <a
                            href={repo.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs font-semibold text-[#23170E] hover:text-[#DC6E26] flex items-center gap-1 truncate"
                          >
                            {repo.full_name}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          <p className="text-[10px] text-[#6E5D4E] font-mono">
                            {repo.is_private ? 'Private' : 'Public'} · default: {repo.default_branch}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleSyncGithub}
                          disabled={isSyncingGithub}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F2] hover:bg-[#EAE2D4] border border-[#E3DAC8] text-[#23170E] text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
                        >
                          <RefreshCw className={`h-3 w-3 ${isSyncingGithub ? 'animate-spin text-[#DC6E26]' : ''}`} />
                          {isSyncingGithub ? 'Syncing...' : 'Sync'}
                        </button>
                        {isAuthorizedToEdit && (
                          <button
                            onClick={() => handleUnlinkGithubRepo(repo.id, repo.full_name)}
                            disabled={unlinkingRepo}
                            title="Unlink repository from this project"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#F4CFC8] text-[#6E5D4E] hover:text-[#882315] text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Unlink</span>
                          </button>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border shrink-0 ${repo.sync_status === 'synced'
                            ? 'bg-[#ECF6E3] text-[#2B5910] border-[#D4E9C1]'
                            : repo.sync_status === 'syncing'
                              ? 'bg-[#FCF3E3] text-[#824B04] border-[#F1DCBA] animate-pulse'
                              : repo.sync_status === 'error'
                                ? 'bg-[#FCECE9] text-[#882315] border-[#F4CFC8]'
                                : 'bg-[#FAF7F2] text-[#6E5D4E] border-[#E3DAC8]'
                            }`}
                        >
                          {repo.sync_status}
                        </span>
                      </div>
                    </div>

                    {repo.description && (
                      <p className="text-[11px] text-[#6E5D4E] leading-relaxed">{repo.description}</p>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E3DAC8] text-[11px]">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono uppercase text-[#6E5D4E]">Language</span>
                        <p className="font-mono text-[#23170E]">{repo.primary_language || 'N/A'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono uppercase text-[#6E5D4E]">Stars</span>
                        <p className="font-mono text-[#23170E]">⭐ {repo.stars_count}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono uppercase text-[#6E5D4E]">Forks</span>
                        <p className="font-mono text-[#23170E]">🍴 {repo.forks_count}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono uppercase text-[#6E5D4E]">Last Sync</span>
                        <p className="font-mono text-[#23170E]">
                          {repo.last_sync_at
                            ? new Date(repo.last_sync_at).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legacy URL-only repositories (if any exist) */}
          {project.project_repositories && project.project_repositories.length > 0 && (
            <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[#DC6E26]" />
                <h2 className="text-sm font-bold font-serif text-[#23170E]">Legacy Repository URLs</h2>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#23170E] border border-[#E3DAC8]">
                  {project.project_repositories.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {project.project_repositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] flex items-center justify-between"
                  >
                    <a
                      href={repo.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-[#23170E] hover:text-[#DC6E26] truncate flex items-center gap-1 font-medium"
                    >
                      {repo.repository_url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-mono text-[#6E5D4E]">
                        {new Date(repo.created_at).toLocaleDateString()}
                      </span>
                      {isAuthorizedToEdit && (
                        <button
                          onClick={() => handleRemoveRepo(repo.id, repo.repository_url)}
                          title="Unlink legacy repository"
                          className="p-1 text-[#6E5D4E] hover:text-[#882315] hover:bg-[#EAE2D4] rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ==================================================================== */}
      {/* TAB 5: ACTIVITY TRAIL */}
      {/* ==================================================================== */}
      {activeTab === 'activity' && (
        <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#DC6E26]" />
            <h2 className="text-sm font-bold font-serif text-[#23170E]">Project Audit Activity</h2>
          </div>

          {projectActivities.length === 0 ? (
            <p className="text-xs text-[#6E5D4E] py-4">No recent activity recorded for this project.</p>
          ) : (
            <div className="divide-y divide-[#E3DAC8] border border-[#E3DAC8] rounded-2xl overflow-hidden bg-[#F2ECE1] shadow-xs">
              {projectActivities.map((act) => (
                <div key={act.id} className="p-3 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#23170E] border border-[#E3DAC8] uppercase font-semibold">
                      {act.event_type}
                    </span>
                    <span className="text-[#23170E]">
                      {act.profiles?.display_name || 'System'} modified {act.entity_type}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#6E5D4E]">
                    {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: SETTINGS */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-6 max-w-2xl animate-in fade-in shadow-xs">
          <div>
            <h2 className="text-sm font-bold font-serif text-[#23170E] flex items-center gap-2">
              <Settings className="h-4 w-4 text-[#DC6E26]" /> Project Metadata &amp; Lifecycle
            </h2>
            <p className="text-xs text-[#6E5D4E] mt-1">
              Configure project naming, lifecycle condition, designated project lead, and target completion date.
            </p>
          </div>

          {editMessage && (
            <div className="p-3.5 rounded-2xl border border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910] text-xs font-mono">
              {editMessage}
            </div>
          )}

          <form onSubmit={handleUpdateProject} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-[#23170E]">Project Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] focus:outline-none focus:border-[#DC6E26] focus:ring-1 focus:ring-[#DC6E26]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-[#23170E]">Lifecycle Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-2.5 py-2 text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="at_risk">At Risk</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#23170E]">Project Lead</label>
                <select
                  value={editLeadId}
                  onChange={(e) => setEditLeadId(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-2.5 py-2 text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
                >
                  <option value="">(None - Unassigned)</option>
                  {projectMembers.map((pm) => (
                    <option key={pm.user_id} value={pm.user_id}>
                      {pm.profiles?.display_name || pm.user_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#23170E]">Target Completion Date</label>
              <input
                type="date"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
                className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-2.5 py-2 text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#23170E]">Description</label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] focus:outline-none focus:border-[#DC6E26] resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={editSubmitting || !isAuthorizedToEdit}
                className="px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white font-semibold shadow-xs disabled:opacity-50 transition-colors"
              >
                {editSubmitting ? 'Saving Changes...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODALS */}
      {/* ==================================================================== */}

      {/* Create Team Modal */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" /> Create Team in {project.name}
              </h3>
              <button onClick={() => setIsCreateTeamOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {teamError && (
              <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {teamError}
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frontend Squad"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    if (!teamSlug) setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Team Slug</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. frontend"
                  value={teamSlug}
                  onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Team Leader</label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(None - Assign Later)</option>
                  {projectMembers.map((pm) => (
                    <option key={pm.user_id} value={pm.user_id}>
                      {pm.profiles?.display_name || pm.user_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Core focus areas..."
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {teamSubmitting ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member to Team Modal */}
      {addingToTeamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Add Member to Team</h3>
              <button onClick={() => setAddingToTeamId(null)} className="p-1 text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {addMemberError && (
              <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {addMemberError}
              </div>
            )}

            <form onSubmit={handleAddMemberToTeam} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Select Project Member</label>
                <select
                  value={selectedMemberToAdd}
                  onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {workspaceMembers.map((wm) => (
                    <option key={wm.user_id} value={wm.user_id}>
                      {wm.display_name} ({wm.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddingToTeamId(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberSubmitting || !selectedMemberToAdd}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {addMemberSubmitting ? 'Adding...' : 'Add to Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Team Member Modal */}
      {transferModalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-indigo-400" /> Transfer Member Between Teams
              </h3>
              <button onClick={() => setTransferModalState(null)} className="p-1 text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {transferError && (
              <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferMember} className="space-y-3.5 text-xs">
              <p className="text-zinc-300">
                Transfer <strong>{transferModalState.userName}</strong> from{' '}
                <span className="font-mono text-zinc-400">{transferModalState.sourceTeamName}</span> to another team in this project:
              </p>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Destination Team</label>
                <select
                  value={transferModalState.targetTeamId}
                  onChange={(e) =>
                    setTransferModalState({ ...transferModalState, targetTeamId: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {teams
                    .filter((t) => t.id !== transferModalState.sourceTeamId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModalState(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting || !transferModalState.targetTeamId}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {transferSubmitting ? 'Transferring...' : 'Transfer Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Project Member Modal */}
      {isEnrollMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Enroll Member in Project</h3>

              {isAuthorizedToEdit && (
                <button onClick={() => setIsEnrollMemberOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-200">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {enrollError && (
              <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {enrollError}
              </div>
            )}

            <form onSubmit={handleEnrollProjectMember} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Workspace Member</label>
                <select
                  value={enrollUserId}
                  onChange={(e) => setEnrollUserId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {workspaceMembers.map((wm) => (
                    <option key={wm.user_id} value={wm.user_id}>
                      {wm.display_name} ({wm.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Project Role</label>
                <select
                  value={enrollRole}
                  onChange={(e) => setEnrollRole(e.target.value as 'lead' | 'member')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="member">Project Member</option>
                  <option value="lead">Project Lead</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollMemberOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSubmitting || !enrollUserId}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {enrollSubmitting ? 'Enrolling...' : 'Enroll Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Link Repository Modal */}
      {isAddRepoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-400" /> Link GitHub Repository
              </h3>
              <button onClick={() => setIsAddRepoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {repoError && (
              <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {repoError}
              </div>
            )}

            {availableRepos.length > 0 && (
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                <label className="font-medium text-zinc-200 text-xs block">
                  Select Authorized Workspace Repository
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedRepoToLink}
                    onChange={(e) => setSelectedRepoToLink(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="">Choose an available repository...</option>
                    {availableRepos.map((ar) => (
                      <option key={ar.id} value={ar.id}>
                        {ar.full_name} ({ar.is_private ? 'private' : 'public'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleLinkExistingRepo(selectedRepoToLink)}
                    disabled={!selectedRepoToLink || linkingRepo}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-all shrink-0"
                  >
                    {linkingRepo ? 'Linking...' : 'Connect'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddRepo} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">
                  {availableRepos.length > 0 ? 'Or Connect by GitHub Repository URL' : 'GitHub Repository URL'}
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/organization/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Each project maintains a unique GitHub repository mapping.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRepoOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repoSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {repoSubmitting ? 'Linking...' : 'Link Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Creation & Drawer */}
      <CreateTaskModal
        workspaceId={workspaceId}
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onTaskCreated={fetchProjectData}
        defaultProjectId={projectId}
      />

      <TaskDetailDrawer
        task={selectedTask}
        workspaceId={workspaceId}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={fetchProjectData}
        members={projectMembers.map((m) => ({
          user_id: m.user_id,
          role: m.role,
          display_name: m.profiles?.display_name || m.user_id.slice(0, 8),
        }))}
        currentUserId={user?.id || null}
        userRole={role}
      />
    </div>
  );
}
