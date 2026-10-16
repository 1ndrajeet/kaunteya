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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { Profile } from '@/types/database';

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const router = useRouter();
  const { role, user, workspaceName } = useWorkspace();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    // 2. Fetch accessible projects and their repos
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
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/20 shrink-0">
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
              <GithubIcon className="h-3.5 w-3.5 text-zinc-300" />
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
              <GithubIcon className="h-3.5 w-3.5 text-zinc-400" /> GitHub Username
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

      {/* Honest SaaS Notice: Future Phase 3 Evidence Engine */}
      <div className="p-6 rounded-2xl border border-indigo-900/40 bg-indigo-950/20 space-y-3">
        <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
          <GithubIcon className="h-4 w-4 text-indigo-400" />
          <span>GitHub Contribution Intelligence (Phase 3 Roadmap)</span>
        </div>
        <p className="text-xs text-indigo-200/80 leading-relaxed">
          In Phase 1, TaskPilot records your developer identity. When Phase 3 is activated, the Task-Routing and
          Evidence Engine will match your GitHub username to commits, pull requests, and code review checks across the
          following workspace initiatives:
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

      {/* Account Management & Sign Out */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-zinc-200">Session & Authentication</h3>
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
