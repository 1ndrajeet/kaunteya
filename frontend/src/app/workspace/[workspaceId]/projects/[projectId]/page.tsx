'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Layers,
  GitBranch,
  Calendar,
  User,
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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { TaskDetailDrawer } from '@/features/tasks/task-detail-drawer';
import { CreateTaskModal } from '@/features/tasks/create-task-modal';
import type { Task, ProjectStatus, Priority, TaskStatus } from '@/types/database';

interface ProjectDetail {
  id: string;
  name: string;
  identifier: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
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
}

interface MemberOption {
  user_id: string;
  display_name: string;
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

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const unwrappedParams = use(params);
  const { workspaceId, projectId } = unwrappedParams;
  const { role, user } = useWorkspace();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<ProjectTaskItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected task for drawer
  const [selectedTask, setSelectedTask] = useState<ProjectTaskItem | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState<boolean>(false);

  // Add Repository Modal
  const [isAddRepoOpen, setIsAddRepoOpen] = useState<boolean>(false);
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [repoSubmitting, setRepoSubmitting] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Edit Project Modal
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');
  const [editLeadId, setEditLeadId] = useState<string>('');
  const [editTargetDate, setEditTargetDate] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  const fetchProjectData = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch Project details with lead & repositories
    const { data: projData, error: projError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        identifier,
        description,
        status,
        start_date,
        target_date,
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
        )
      `)
      .eq('id', projectId)
      .eq('workspace_id', workspaceId)
      .single();

    if (projError || !projData) {
      setLoading(false);
      return;
    }

    setProject(projData as unknown as ProjectDetail);
    setEditName(projData.name);
    setEditDescription(projData.description || '');
    setEditStatus(projData.status as ProjectStatus);
    setEditLeadId((projData as any).lead?.id || '');
    setEditTargetDate(projData.target_date || '');

    // 2. Fetch Tasks for this project
    const { data: taskData } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey (
          id,
          display_name,
          avatar_url
        ),
        project:projects!tasks_project_id_fkey (
          id,
          name,
          identifier
        )
      `)
      .eq('project_id', projectId)
      .order('task_number', { ascending: false });

    if (taskData) {
      setTasks(taskData as unknown as Task[]);
    }

    // 3. Fetch workspace members
    const { data: memData } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        profiles:user_id ( display_name )
      `)
      .eq('workspace_id', workspaceId);

    if (memData) {
      setMembers(
        memData.map((m: any) => ({
          user_id: m.user_id,
          display_name: m.profiles?.display_name || m.user_id.slice(0, 8),
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProjectData();
  }, [workspaceId, projectId]);

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

    const { error } = await supabase.from('project_repositories').insert({
      project_id: projectId,
      repository_url: repoUrl.trim(),
      created_by: user.id,
    });

    if (error) {
      setRepoError(error.message);
      setRepoSubmitting(false);
      return;
    }

    // Activity event
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
    setRepoSubmitting(false);
    fetchProjectData();
  };

  const handleRemoveRepo = async (repoId: string, url: string) => {
    if (!confirm(`Are you sure you want to unlink ${url}?`)) return;
    const supabase = createClient();

    const { error } = await supabase.from('project_repositories').delete().eq('id', repoId);

    if (!error) {
      if (user) {
        await supabase.from('activity_events').insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          entity_type: 'project',
          entity_id: projectId,
          event_type: 'repository_unlinked',
          metadata: { repository_url: url, project_name: project?.name },
        });
      }
      fetchProjectData();
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !user) return;

    setEditSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('projects')
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        lead_id: editLeadId || null,
        target_date: editTargetDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (!error) {
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        event_type: 'updated',
        metadata: { name: editName.trim(), status: editStatus },
      });
      setIsEditOpen(false);
      fetchProjectData();
    }
    setEditSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        <span>Loading project details...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
        <h3 className="text-base font-semibold text-zinc-100">Project Not Found</h3>
        <p className="text-xs text-zinc-400">This project either does not exist or you lack permission to view it.</p>
        <Link
          href={`/workspace/${workspaceId}/projects`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
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

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link
          href={`/workspace/${workspaceId}/projects`}
          className="hover:text-zinc-200 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </Link>
        <span>/</span>
        <span className="font-mono text-zinc-200">{project.identifier}</span>
      </div>

      {/* Project Header Banner */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm flex flex-col md:flex-row md:items-start justify-between gap-6 shadow-sm">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {project.identifier}
            </span>
            <span
              className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded ${
                project.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : project.status === 'completed'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {project.status}
            </span>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed max-w-2xl">{project.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-2">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <User className="h-3.5 w-3.5 text-violet-400" />
              Lead: {project.lead?.display_name || 'Unassigned'}
            </span>
            {project.target_date && (
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                Target: {new Date(project.target_date).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-mono">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Created: {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Progress & Actions */}
        <div className="flex flex-col sm:items-end justify-between gap-4 shrink-0">
          {isAuthorizedToEdit && (
            <button
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-xs font-medium hover:border-zinc-700 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5 text-indigo-400" /> Edit Project
            </button>
          )}

          <div className="w-48 space-y-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Completion</span>
              <span className="font-mono text-zinc-200 font-semibold">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-zinc-500 text-right">
              {completedTasks} of {totalTasks} tasks done
            </div>
          </div>
        </div>
      </div>

      {/* Linked GitHub Repositories Section */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">Linked GitHub Repositories</h2>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {project.project_repositories?.length || 0}
            </span>
          </div>

          {isAuthorizedToEdit && (
            <button
              onClick={() => setIsAddRepoOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Link Repository
            </button>
          )}
        </div>

        {/* Honest SaaS Disclosure Banner */}
        <div className="p-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 text-indigo-200 text-xs flex items-start gap-2.5">
          <FileCode className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium">Phase 1 Manual Repository Association</p>
            <p className="text-[11px] text-indigo-300/80 leading-relaxed">
              Repositories linked here establish the code graph for this initiative. In Phase 3, TaskPilot will securely
              correlate pull requests, commits, and review checks for task contribution verification. No GitHub API access
              tokens are stored or queried in Phase 1.
            </p>
          </div>
        </div>

        {/* Repositories List */}
        {project.project_repositories.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center space-y-2">
            <GitBranch className="h-5 w-5 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400">No repositories linked to this project yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {project.project_repositories.map((repo) => (
              <div
                key={repo.id}
                className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <GitBranch className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="overflow-hidden">
                    <a
                      href={repo.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-zinc-200 hover:text-indigo-300 flex items-center gap-1 truncate"
                    >
                      {repo.repository_url.replace('https://github.com/', '')}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      Linked: {new Date(repo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {isAuthorizedToEdit && (
                  <button
                    onClick={() => handleRemoveRepo(repo.id, repo.repository_url)}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                    title="Unlink repository"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Tasks Section */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">Project Tasks</h2>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {tasks.length}
            </span>
          </div>

          <button
            onClick={() => setIsNewTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-zinc-800 text-center space-y-2">
            <p className="text-xs text-zinc-400">No tasks created under {project.name} yet.</p>
            <button
              onClick={() => setIsNewTaskOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Create First Task
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/40">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="p-3.5 hover:bg-zinc-900/80 cursor-pointer transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-zinc-400">
                    {project.identifier}-{task.task_number}
                  </span>
                  <p className="text-xs font-medium text-zinc-200 truncate">{task.title}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      task.priority === 'Urgent'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : task.priority === 'High'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {task.priority}
                  </span>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {task.status}
                  </span>

                  <span className="text-[11px] text-zinc-400 min-w-[100px] text-right truncate">
                    {task.assignee?.display_name || <span className="text-amber-400">Unassigned</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          workspaceId={workspaceId}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={() => {
            fetchProjectData();
          }}
          members={members.map((m) => ({ user_id: m.user_id, role: 'member', display_name: m.display_name }))}
          currentUserId={user?.id || null}
          userRole={role}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        workspaceId={workspaceId}
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onTaskCreated={() => {
          fetchProjectData();
        }}
        defaultProjectId={projectId}
      />

      {/* Link Repository Modal */}
      {isAddRepoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-400" /> Link GitHub Repository
              </h3>
              <button onClick={() => setIsAddRepoOpen(false)} className="p-1 rounded-md text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {repoError && (
              <div className="p-3 rounded-lg border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" /> {repoError}
              </div>
            )}

            <form onSubmit={handleAddRepo} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Repository URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/organization/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-zinc-500">
                  Must be a valid GitHub HTTPS repository URL.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRepoOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
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

      {/* Edit Project Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-400" /> Edit Project Details
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="p-1 rounded-md text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Project Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Target Date</label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Project Lead</label>
                <select
                  value={editLeadId}
                  onChange={(e) => setEditLeadId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(None)</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
