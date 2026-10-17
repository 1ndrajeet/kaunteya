'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  GitBranch,
  Layers,
  Lock,
  LogOut,
  MessageSquare,
  Hash,
  Github,
  Slack,
  Sun,
  Moon,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { useTheme } from '@/features/theme/theme-context';
import type { Profile, SlackUserMapping, SlackInstallation, GithubUserMapping } from '@/types/database';

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const router = useRouter();
  const { role, user, workspaceName } = useWorkspace();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // External Mappings
  const [slackMapping, setSlackMapping] = useState<SlackUserMapping | null>(null);
  const [slackInstallation, setSlackInstallation] = useState<SlackInstallation | null>(null);
  const [githubMapping, setGithubMapping] = useState<GithubUserMapping | null>(null);

  // Projects and linked repos
  const [projects, setProjects] = useState<
    { id: string; name: string; identifier: string; project_repositories: { repository_url: string }[] }[]
  >([]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch user's profile
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (profData) {
      setProfile(profData as Profile);
      setDisplayName(profData.display_name || '');
      setGithubUsername(profData.github_username || '');
    } else {
      // Fallback from session metadata if profile row isn't populated yet
      setDisplayName(user.user_metadata?.full_name || user.email || '');
      setGithubUsername(user.user_metadata?.user_name || '');
    }

    // 2. Fetch Slack integration & user mapping
    const { data: instData } = await supabase
      .from('slack_installations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('installation_status', 'active')
      .maybeSingle();

    if (instData) {
      setSlackInstallation(instData as SlackInstallation);
    }

    const { data: mapData } = await supabase
      .from('slack_user_mappings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('taskpilot_user_id', user.id)
      .maybeSingle();

    if (mapData) {
      setSlackMapping(mapData as SlackUserMapping);
    }

    // 3. Fetch GitHub App user mapping
    const { data: ghMapData } = await supabase
      .from('github_user_mappings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('taskpilot_user_id', user.id)
      .maybeSingle();

    if (ghMapData) {
      setGithubMapping(ghMapData as GithubUserMapping);
    }

    // 4. Fetch accessible projects and their repos
    const { data: projData } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        identifier,
        project_repositories (
          repository_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (projData) {
      setProjects(projData as any);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user, workspaceId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !displayName.trim()) return;

    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    const cleanGh = githubUsername.trim().replace(/^@/, '');

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        github_username: cleanGh || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              display_name: displayName.trim(),
              github_username: cleanGh || null,
            }
          : null
      );
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        <span>Loading profile data...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <User className="h-6 w-6 text-indigo-400" /> Member Profile & Developer Identity
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage your personal display settings, GitHub identity linkage, and review authorized workspace permissions.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-900/50 bg-rose-950/30 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
            {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
              <img
                src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                alt="Avatar"
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              displayName[0]?.toUpperCase() || 'U'
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-zinc-100">{displayName || 'Anonymous Member'}</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <Github className="h-3.5 w-3.5 text-zinc-300" />
              {githubUsername ? (
                <a
                  href={`https://github.com/${githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-400 flex items-center gap-1"
                >
                  @{githubUsername}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-zinc-500">No GitHub username linked</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 font-mono truncate">{user?.email}</p>
          </div>
        </div>

        {/* Workspace Role Badge */}
        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-1 text-right">
          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Workspace Role</div>
          <div className="flex items-center gap-1.5 justify-end">
            <span
              className={`text-xs font-mono uppercase font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 ${
                role === 'admin'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : role === 'lead'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              {role}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 flex items-center gap-1 justify-end pt-1">
            <Lock className="h-2.5 w-2.5" /> Enforced by PostgreSQL RLS
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <User className="h-4 w-4 text-indigo-400" /> Edit Profile Information
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs max-w-lg">
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300 flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5 text-zinc-400" /> GitHub Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">@</span>
              <input
                type="text"
                placeholder="octocat"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Your public GitHub handle used to link future pull requests, reviews, and commits.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* GitHub App Verified Evidence Tracking Card */}
      <div className="p-6 rounded-2xl border border-purple-900/40 bg-purple-950/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-center shrink-0 text-purple-400">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">GitHub App Evidence &amp; Identity</h3>
              <p className="text-[11px] text-zinc-400">
                Authoritative verification of PRs, commits, reviews, and CI runs associated with your work claims.
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-mono uppercase font-semibold px-2.5 py-1 rounded inline-flex items-center gap-1.5 self-start sm:self-auto ${
              githubMapping?.link_status === 'linked'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {githubMapping?.link_status === 'linked' ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Linked (@{githubMapping.github_login})
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-zinc-500" />
                Awaiting Admin Mapping
              </>
            )}
          </span>
        </div>

        <p className="text-xs text-purple-200/80 leading-relaxed">
          TaskPilot correlates your work claims with immutable GitHub account ID{' '}
          {githubMapping?.github_user_id ? (
            <code className="text-white font-mono bg-zinc-900 px-1.5 py-0.5 rounded">
              #{githubMapping.github_user_id}
            </code>
          ) : (
            'when mapped by workspace administrator'
          )}
          . Development evidence is collected across the following workspace initiatives:
        </p>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 border border-zinc-700">
                    {proj.identifier}
                  </span>
                  <span className="text-zinc-200 font-medium truncate max-w-[150px]">{proj.name}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                  <GitBranch className="h-3 w-3 text-indigo-400" />
                  <span>{proj.project_repositories?.length || 0} repos</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-500">No active projects with linked repositories found.</div>
        )}
      </div>

      {/* Slack Integration Identity Card */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center shrink-0">
              <Slack className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Slack Conversational Identity</h3>
              <p className="text-[11px] text-zinc-400">Receive task notifications, reply to follow-ups, and update tasks from Slack.</p>
            </div>
          </div>

          <span
            className={`text-xs font-mono uppercase font-semibold px-2.5 py-1 rounded inline-flex items-center gap-1.5 self-start sm:self-auto ${
              slackMapping?.link_status === 'linked'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {slackMapping?.link_status === 'linked' ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Linked (@{slackMapping.slack_user_id})
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-zinc-500" />
                Unlinked
              </>
            )}
          </span>
        </div>

        {slackMapping?.link_status === 'linked' ? (
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
              <div>
                <span className="text-zinc-500 block">Slack User ID</span>
                <span className="text-zinc-200 font-semibold">{slackMapping.slack_user_id}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Slack Workspace</span>
                <span className="text-zinc-200">{slackInstallation?.slack_team_name || slackInstallation?.slack_team_id || 'Connected Workspace'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Linked At</span>
                <span className="text-zinc-400">{new Date(slackMapping.linked_at).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-400/90 pt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Automated follow-ups and assignment notices are delivered directly to your Slack account.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-400 space-y-2">
            <p>
              Your TaskPilot profile is not yet mapped to a Slack User ID in this workspace.
            </p>
            <p className="text-[11px] text-zinc-500">
              A workspace administrator can link your Slack User ID in <strong className="text-zinc-300">Admin &gt; Slack &amp; Integrations</strong>, allowing you to create tasks with <code className="text-indigo-300">@TaskPilot create...</code> and reply to bot follow-up threads.
            </p>
          </div>
        )}
      </div>

      {/* Theme & Appearance Card */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-400" />}
              Appearance &amp; Theme
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Choose your preferred visual theme for the TaskPilot interface.</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-400" /> Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Moon className="h-3.5 w-3.5 text-indigo-400" /> Dark
            </button>
          </div>
        </div>
      </div>

      {/* Account Management & Sign Out */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-zinc-200">Session &amp; Authentication</h3>
          <p className="text-[11px] text-zinc-500">Logged in via Supabase GitHub OAuth Provider</p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-xs font-medium transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );
}
