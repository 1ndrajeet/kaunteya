'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  GitBranch,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  X,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { ProjectStatus } from '@/types/database';

interface ProjectItem {
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
  } | null;
  tasks?: { id: string; status: string }[];
  project_repositories?: { id: string; repository_url: string }[];
}

interface MemberOption {
  user_id: string;
  display_name: string;
}

export default function WorkspaceProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user } = useWorkspace();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // New Project Form
  const [name, setName] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [leadId, setLeadId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!identifier) {
      // Suggest 3 letter uppercase identifier
      const clean = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
      setIdentifier(clean.slice(0, 4) || 'PRJ');
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch projects with lead, tasks, and repo counts
    const { data: projData, error } = await supabase
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
          display_name
        ),
        tasks (
          id,
          status
        ),
        project_repositories (
          id,
          repository_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error && projData) {
      setProjects(projData as unknown as ProjectItem[]);
    }

    // 2. Fetch members for lead selector
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
    fetchProjects();
  }, [workspaceId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identifier.trim() || !user) return;

    setSubmitting(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      // 1. Create project
      const { data: createdProj, error: projError } = await supabase
        .from('projects')
        .insert({
          workspace_id: workspaceId,
          name: name.trim(),
          identifier: identifier.trim().toUpperCase(),
          description: description.trim() || null,
          lead_id: leadId || null,
          target_date: targetDate || null,
          created_by: user.id,
          status: 'active',
        })
        .select()
        .single();

      if (projError) {
        setErrorMsg(projError.message);
        setSubmitting(false);
        return;
      }

      // 2. Optional initial repository URL
      if (repoUrl.trim()) {
        await supabase.from('project_repositories').insert({
          project_id: createdProj.id,
          repository_url: repoUrl.trim(),
          created_by: user.id,
        });
      }

      // 3. Log activity
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'project',
        entity_id: createdProj.id,
        event_type: 'created',
        metadata: {
          name: createdProj.name,
          identifier: createdProj.identifier,
        },
      });

      // Reset and close
      setName('');
      setIdentifier('');
      setDescription('');
      setLeadId('');
      setTargetDate('');
      setRepoUrl('');
      setIsModalOpen(false);
      fetchProjects();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthorizedToCreate = role === 'admin' || role === 'lead';

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" /> Projects
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Organize workspaces into initiatives, associate GitHub repositories, and assign project leads.
          </p>
        </div>

        {isAuthorizedToCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Project
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span>Loading workspace projects...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 text-center space-y-3">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
            <Layers className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-100">No projects yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Create your first project to start organizing tasks, milestones, and repositories.
            </p>
          </div>
          {isAuthorizedToCreate && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const totalTasks = project.tasks?.length || 0;
            const completedTasks = project.tasks?.filter((t) => t.status === 'Done').length || 0;
            const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const reposCount = project.project_repositories?.length || 0;

            return (
              <Link
                key={project.id}
                href={`/workspace/${workspaceId}/projects/${project.id}`}
                className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-indigo-500/60 hover:bg-zinc-900/80 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 border border-zinc-700">
                      {project.identifier}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded ${
                        project.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-zinc-100 group-hover:text-indigo-300 transition-colors">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-zinc-800/80 text-xs">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Tasks: {completedTasks}/{totalTasks} done</span>
                      <span className="font-mono">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                    <span className="flex items-center gap-1 text-zinc-300">
                      <User className="h-3 w-3 text-violet-400" />
                      {project.lead?.display_name || 'No Lead'}
                    </span>
                    {reposCount > 0 && (
                      <span className="flex items-center gap-1 text-zinc-400 font-mono">
                        <GitBranch className="h-3 w-3 text-indigo-400" /> {reposCount} {reposCount === 1 ? 'repo' : 'repos'}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" /> Create New Project
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Engine"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Identifier (2-5 letters uppercase)</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. CORE"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 tracking-wider"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of project goals and scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Project Lead</label>
                  <select
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
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

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">GitHub Repository URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://github.com/org/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
