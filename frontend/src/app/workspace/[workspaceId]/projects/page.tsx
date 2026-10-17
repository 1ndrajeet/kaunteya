'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  GitBranch,
  Calendar,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  X,
  ArrowRight,
  Clock,
  Bot,
  ShieldAlert,
  Search,
  Lock,
  Globe,
  RefreshCw,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { PricingUpgradeDialog } from '@/features/billing/pricing-upgrade-dialog';
import {
  getProjectDeadlineStatus,
  type ProjectStatus,
  type ProjectDeadlineStatus,
} from '@/types/database';

interface LinkedRepo {
  id: string;
  full_name: string;
  repo_url: string;
  is_private: boolean;
  primary_language: string | null;
  default_branch: string;
  sync_status: string;
  last_sync_at: string | null;
}

interface ProjectItem {
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
  } | null;
  tasks?: { id: string; status: string }[];
  teams?: { id: string; name: string }[];
  project_members?: { id: string; user_id: string; role: string }[];
  project_repositories?: { id: string; repository_url: string }[];
  github_repositories?: LinkedRepo[];
}

interface MemberOption {
  user_id: string;
  display_name: string;
}

interface AuthorizedRepoOption {
  github_repo_id: number;
  name: string;
  full_name: string;
  repo_url: string;
  is_private: boolean;
  default_branch: string;
  description: string | null;
  primary_language: string | null;
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
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);



  // Authorized GitHub Repos State
  const [authorizedRepos, setAuthorizedRepos] = useState<AuthorizedRepoOption[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [hasActiveInstallation, setHasActiveInstallation] = useState<boolean>(true);
  const [repoSearch, setRepoSearch] = useState<string>('');

  // New Project Form
  const [name, setName] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [leadId, setLeadId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startingInstall, setStartingInstall] = useState<boolean>(false);

  const handleStartInstall = async () => {
    setErrorMsg(null);
    setStartingInstall(true);
    try {
      const res = await fetch('/api/github/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start install');
      window.location.href = data.installUrl; // navigate to GitHub
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Install failed');
      setStartingInstall(false);
    }
  };
  const handleNameChange = (val: string) => {
    setName(val);
    if (!identifier) {
      const clean = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
      setIdentifier(clean.slice(0, 4) || 'PRJ');
    }
  };

  const fetchAuthorizedRepos = async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const res = await fetch(`/api/github/repositories?workspaceId=${workspaceId}`);
      if (res.status === 404) {
        setHasActiveInstallation(false);
        setAuthorizedRepos([]);
        return;
      }
      if (res.status === 403) {
        setHasActiveInstallation(false);
        const errData = await res.json().catch(() => ({}));
        setRepoError(errData.error || 'GitHub connection is inactive or revoked. Please reconnect.');
        setAuthorizedRepos([]);
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setRepoError(errData.error || 'Failed to fetch repositories');
        return;
      }
      const data = await res.json();
      setHasActiveInstallation(true);
      setAuthorizedRepos(data.repositories || []);
    } catch (err) {
      setRepoError('Network error while checking GitHub installation');
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch projects with lead, tasks, teams, project_members, and linked github repositories
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
        completed_at,
        created_at,
        lead:profiles!projects_lead_id_fkey (
          id,
          display_name
        ),
        tasks (
          id,
          status
        ),
        teams (
          id,
          name
        ),
        project_members (
          id,
          user_id,
          role
        ),
        project_repositories (
          id,
          repository_url
        ),
        github_repositories (
          id,
          full_name,
          repo_url,
          is_private,
          primary_language,
          default_branch,
          sync_status,
          last_sync_at
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error && projData) {
      setProjects(projData as unknown as ProjectItem[]);
    }

    // Fetch members for lead selector
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

  const openCreateModal = () => {
    setIsModalOpen(true);
    setSelectedRepoId(null);
    setRepoSearch('');
    fetchAuthorizedRepos();
  };

  const handleSelectRepo = (repo: AuthorizedRepoOption) => {
    setSelectedRepoId(repo.github_repo_id);
    if (!name.trim()) {
      setName(repo.name);
      if (!identifier.trim()) {
        const clean = repo.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setIdentifier(clean.slice(0, 4) || 'PRJ');
      }
    }
    if (!description.trim() && repo.description) {
      setDescription(repo.description);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identifier.trim() || !user) return;

    if (!selectedRepoId) {
      setErrorMsg('GitHub repository is mandatory. Please select an authorized repository.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      // 1. Create project via atomic database function enforcing mandatory GitHub repo & workspace plan limits
      const { data: createdProj, error: projError } = await supabase.rpc('create_project_with_limits', {
        p_workspace_id: workspaceId,
        p_name: name.trim(),
        p_identifier: identifier.trim().toUpperCase(),
        p_description: description.trim() || null,
        p_status: status,
        p_lead_id: leadId || null,
        p_target_date: targetDate || null,
        p_github_repo_id: selectedRepoId,
      });

      if (projError) {
        if (projError.message.includes('PROJECT_LIMIT_EXCEEDED')) {
          setIsUpgradeModalOpen(true);
        }
        setErrorMsg(projError.message);
        setSubmitting(false);
        return;
      }

      const created = createdProj as { id: string; name: string; identifier: string };

      // 2. Trigger asynchronous background sync & Gemini enrichment
      if (created?.id) {
        fetch(`/api/projects/${created.id}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRefresh: false }),
        }).catch((err) => {
          console.warn('[Project Creation] Background enrichment trigger failed:', err);
        });
      }

      // Reset and close
      setName('');
      setIdentifier('');
      setDescription('');
      setStatus('active');
      setLeadId('');
      setTargetDate('');
      setSelectedRepoId(null);
      setIsModalOpen(false);
      fetchProjects();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthorizedToCreate = role === 'admin' || role === 'lead';

  const getLifecycleBadge = (lifecycleStatus: ProjectStatus) => {
    switch (lifecycleStatus) {
      case 'planning':
        return {
          label: 'Planning',
          badgeClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
        };
      case 'active':
        return {
          label: 'Active',
          badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        };
      case 'at_risk':
        return {
          label: 'At Risk',
          badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        };
      case 'completed':
        return {
          label: 'Completed',
          badgeClass: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
        };
      case 'paused':
        return {
          label: 'Paused',
          badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        };
      case 'archived':
      default:
        return {
          label: 'Archived',
          badgeClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
        };
    }
  };

  const filteredRepos = authorizedRepos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(repoSearch.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-indigo-400" /> Projects
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Projects organized by scope, team assignments, deadlines, and connected GitHub repositories.
          </p>
        </div>

        {isAuthorizedToCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-500/10"
          >
            <Plus className="h-4 w-4" /> New Project
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 space-y-3">
          <Layers className="h-10 w-10 text-zinc-600" />
          <h3 className="text-base font-semibold text-zinc-200">No projects yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm">
            Create your first project to organize work, link GitHub repositories, and unlock Gemini intelligence.
          </p>
          {isAuthorizedToCreate && (
            <button
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
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
            const linkedRepo = project.github_repositories?.[0];
            const teamsCount = project.teams?.length || 0;
            const membersCount = project.project_members?.length || 0;

            const lifecycle = getLifecycleBadge(project.status);
            const deadline = getProjectDeadlineStatus(project);

            const cardBorderClass =
              project.status === 'at_risk' || deadline.status === 'overdue'
                ? 'border-rose-900/40 hover:border-rose-600/60 bg-zinc-900/40'
                : deadline.status === 'closing_soon'
                  ? 'border-amber-900/40 hover:border-amber-600/60 bg-zinc-900/40'
                  : project.status === 'completed'
                    ? 'border-indigo-900/40 hover:border-indigo-600/60 bg-zinc-900/30'
                    : 'border-zinc-800 hover:border-indigo-500/60 bg-zinc-900/50';

            return (
              <Link
                key={project.id}
                href={`/workspace/${workspaceId}/projects/${project.id}`}
                className={`group p-5 rounded-2xl border ${cardBorderClass} hover:bg-zinc-900/80 transition-all flex flex-col justify-between space-y-4 shadow-sm`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Identifier + Status Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-indigo-300 border border-zinc-700/80 shrink-0">
                      {project.identifier}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full ${lifecycle.badgeClass}`}>
                        {lifecycle.label}
                      </span>

                      {deadline.status !== 'no_deadline' && (
                        <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${deadline.badgeClass}`}>
                          {deadline.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project Name and Description */}
                  <div>
                    <h3 className="font-bold text-base text-zinc-100 group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                      <span className="truncate">{project.name}</span>
                      <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </h3>
                    {project.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Connected Repository Pill */}
                  {linkedRepo ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 font-mono">
                      <GitBranch className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{linkedRepo.full_name}</span>
                      {linkedRepo.primary_language && (
                        <span className="ml-auto text-[10px] text-zinc-500 bg-zinc-800/80 px-1.5 py-0.2 rounded shrink-0">
                          {linkedRepo.primary_language}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-400/90 font-mono">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>Legacy project (no repo linked)</span>
                    </div>
                  )}
                </div>

                {/* Scope & Team Metadata */}
                <div className="space-y-3 pt-3 border-t border-zinc-800/80 text-xs">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Tasks: {completedTasks}/{totalTasks} done</span>
                      <span className="font-mono text-zinc-200">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Teams, Members & Lead footer */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-zinc-300 font-mono">
                        <Users className="h-3.5 w-3.5 text-violet-400" />
                        {teamsCount} {teamsCount === 1 ? 'team' : 'teams'}
                      </span>
                      {membersCount > 0 && (
                        <span className="text-zinc-500 font-mono">
                          ({membersCount} {membersCount === 1 ? 'member' : 'members'})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {project.lead && (
                        <span className="flex items-center gap-1 text-zinc-300">
                          <User className="h-3.5 w-3.5 text-zinc-400" />
                          <span className="truncate max-w-[80px]">{project.lead.display_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Project Modal with Mandatory GitHub Repository Selection */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" /> Create New Project
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              {/* Mandatory GitHub Repository Selector */}
              <div className="space-y-2 p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/10">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <GitBranch className="h-4 w-4 text-indigo-400" /> Authorized GitHub Repository (Required)
                  </label>
                  <button
                    type="button"
                    onClick={fetchAuthorizedRepos}
                    disabled={loadingRepos}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingRepos ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>

                {!hasActiveInstallation ? (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="h-4 w-4 text-amber-400" /> GitHub App Installation Required
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      TaskPilot requires an authorized GitHub App installation to link repositories and fetch evidence for new projects.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartInstall}
                      disabled={startingInstall}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs mt-1 disabled:opacity-50"
                    >
                      {startingInstall ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      {startingInstall ? 'Redirecting to GitHub…' : 'Connect GitHub App'}
                    </button>
                  </div>
                ) : loadingRepos ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>Loading authorized repositories...</span>
                  </div>
                ) : authorizedRepos.length === 0 ? (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs space-y-2">
                    <p>No repositories currently accessible to this installation.</p>
                    <button
                      type="button"
                      onClick={handleStartInstall}
                      disabled={startingInstall}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs mt-1 disabled:opacity-50"
                    >
                      {startingInstall ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      {startingInstall ? 'Redirecting to GitHub…' : 'Connect GitHub App'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search authorized repositories..."
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 text-xs"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
                      {filteredRepos.map((repo) => {
                        const isSelected = selectedRepoId === repo.github_repo_id;
                        return (
                          <button
                            key={repo.github_repo_id}
                            type="button"
                            onClick={() => handleSelectRepo(repo)}
                            className={`w-full text-left p-2 rounded-md transition-colors flex items-start justify-between gap-2 ${isSelected
                              ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200'
                              : 'hover:bg-zinc-900 border border-transparent text-zinc-300'
                              }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold truncate">
                                {repo.is_private ? (
                                  <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                                ) : (
                                  <Globe className="h-3 w-3 text-emerald-400 shrink-0" />
                                )}
                                <span className="truncate">{repo.full_name}</span>
                              </div>
                              {repo.description && (
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                  {repo.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-zinc-400 font-mono">
                              {repo.primary_language && (
                                <span className="bg-zinc-800 px-1.5 py-0.5 rounded">
                                  {repo.primary_language}
                                </span>
                              )}
                              <span className="text-zinc-500">{repo.default_branch}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Project Name and Identifier */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="font-medium text-zinc-300">Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Core Platform Engine"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Identifier</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="CORE"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 tracking-wider"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Lifecycle Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="at_risk">At Risk</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Project Lead</label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(None - Unassigned)</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Bot className="h-3 w-3 text-indigo-400" />
                  Gemini enrichment runs automatically after creation
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedRepoId}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {submitting ? 'Creating Project...' : 'Create Project'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pricing and Upgrade Dialog when limit is reached */}
      <PricingUpgradeDialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        limitType="project"
        maxAllowed={5}
      />
    </div>
  );
}
