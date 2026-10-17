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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#736251] font-mono text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#DC6E26]" />
        <span>Loading profile data...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-[#23170E] flex items-center gap-2">
          <User className="h-6 w-6 text-[#DC6E26]" /> Member Profile &amp; Developer Identity
        </h1>
        <p className="text-xs text-[#6E5D4E] mt-1">
          Manage your personal display settings, GitHub identity linkage, and review authorized workspace permissions.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${message.type === 'success'
            ? 'border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910]'
            : 'border-[#F4CFC8] bg-[#FCECE9] text-[#882315]'
            }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-[#2B5910] shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-[#882315] shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[#DC6E26] flex items-center justify-center text-white text-xl font-bold shadow-xs shrink-0">
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
            <h2 className="text-lg font-serif font-bold text-[#23170E]">{displayName || 'Anonymous Member'}</h2>
            <div className="flex items-center gap-2 text-xs text-[#736251] font-mono">
              <Github className="h-3.5 w-3.5 text-[#23170E]" />
              {githubUsername ? (
                <a
                  href={`https://github.com/${githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#DC6E26] flex items-center gap-1 transition-colors"
                >
                  @{githubUsername}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-[#736251]">No GitHub username linked</span>
              )}
            </div>
            <p className="text-[11px] text-[#736251] font-mono truncate">{user?.email}</p>
          </div>
        </div>

        {/* Workspace Role Badge */}
        <div className="p-3 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-1 text-right shadow-2xs">
          <div className="text-[10px] text-[#736251] font-mono uppercase tracking-wider">Workspace Role</div>
          <div className="flex items-center gap-1.5 justify-end">
            <span
              className={`text-xs font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${role === 'admin'
                ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                : role === 'lead'
                  ? 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]'
                  : 'bg-[#FAF7F2] text-[#736251] border border-[#E3DAC8]'
                }`}
            >
              <ShieldCheck className="h-3 w-3" />
              {role}
            </span>
          </div>
          <div className="text-[10px] text-[#736251] flex items-center gap-1 justify-end pt-1">
            <Lock className="h-2.5 w-2.5" /> Enforced by PostgreSQL RLS
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <h3 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
          <User className="h-4 w-4 text-[#DC6E26]" /> Edit Profile Information
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs max-w-lg">
          <div className="space-y-1.5">
            <label className="font-medium text-[#736251]">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg px-3.5 py-2 text-[#23170E] placeholder-[#736251] focus:outline-none focus:border-[#DC6E26] text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-[#736251] flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5 text-[#736251]" /> GitHub Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#736251] font-mono text-xs">@</span>
              <input
                type="text"
                placeholder="octocat"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg pl-8 pr-3 py-2 text-[#23170E] font-mono placeholder-[#736251] focus:outline-none focus:border-[#DC6E26] text-xs"
              />
            </div>
            <p className="text-[11px] text-[#736251]">
              Your public GitHub handle used to link future pull requests, reviews, and commits.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* GitHub App Verified Evidence Tracking Card */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#FCF3E3] border border-[#F1DCBA] flex items-center justify-center shrink-0 text-[#824B04]">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-[#23170E]">GitHub App Evidence &amp; Identity</h3>
              <p className="text-[11px] text-[#6E5D4E]">
                Authoritative verification of PRs, commits, reviews, and CI runs associated with your work claims.
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-mono uppercase font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 self-start sm:self-auto ${githubMapping?.link_status === 'linked'
              ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
              : 'bg-[#F2ECE1] text-[#736251] border border-[#E4DBC9]'
              }`}
          >
            {githubMapping?.link_status === 'linked' ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-[#2B5910]" />
                Linked (@{githubMapping.github_login})
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-[#736251]" />
                Awaiting Admin Mapping
              </>
            )}
          </span>
        </div>

        <p className="text-xs text-[#6E5D4E] leading-relaxed">
          TaskPilot correlates your work claims with immutable GitHub account ID{' '}
          {githubMapping?.github_user_id ? (
            <code className="text-[#23170E] font-mono bg-[#F2ECE1] border border-[#E4DBC9] px-1.5 py-0.5 rounded">
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
                className="p-3 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] flex items-center justify-between text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAF7F2] text-[#DC6E26] border border-[#E3DAC8]">
                    {proj.identifier}
                  </span>
                  <span className="text-[#23170E] font-medium truncate max-w-[150px]">{proj.name}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-[#736251]">
                  <GitBranch className="h-3 w-3 text-[#DC6E26]" />
                  <span>{proj.project_repositories?.length || 0} repos</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#736251]">No active projects with linked repositories found.</div>
        )}
      </div>

      {/* Slack Integration Identity Card */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#ECF6E3] border border-[#D4E9C1] flex items-center justify-center shrink-0">
              <Slack className="h-4 w-4 text-[#2B5910]" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-[#23170E]">Slack Conversational Identity</h3>
              <p className="text-[11px] text-[#6E5D4E]">Receive task notifications, reply to follow-ups, and update tasks from Slack.</p>
            </div>
          </div>

          <span
            className={`text-xs font-mono uppercase font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 self-start sm:self-auto ${slackMapping?.link_status === 'linked'
              ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
              : 'bg-[#F2ECE1] text-[#736251] border border-[#E4DBC9]'
              }`}
          >
            {slackMapping?.link_status === 'linked' ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-[#2B5910]" />
                Linked (@{slackMapping.slack_user_id})
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-[#736251]" />
                Unlinked
              </>
            )}
          </span>
        </div>

        {slackMapping?.link_status === 'linked' ? (
          <div className="p-4 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-2 text-xs shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
              <div>
                <span className="text-[#736251] block font-sans">Slack User ID</span>
                <span className="text-[#23170E] font-semibold">{slackMapping.slack_user_id}</span>
              </div>
              <div>
                <span className="text-[#736251] block font-sans">Slack Workspace</span>
                <span className="text-[#23170E]">{slackInstallation?.slack_team_name || slackInstallation?.slack_team_id || 'Connected Workspace'}</span>
              </div>
              <div>
                <span className="text-[#736251] block font-sans">Linked At</span>
                <span className="text-[#736251]">{new Date(slackMapping.linked_at).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-[#2B5910] pt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Automated follow-ups and assignment notices are delivered directly to your Slack account.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] text-xs text-[#6E5D4E] space-y-2">
            <p>
              Your TaskPilot profile is not yet mapped to a Slack User ID in this workspace.
            </p>
            <p className="text-[11px] text-[#736251]">
              A workspace administrator can link your Slack User ID in <strong className="text-[#23170E]">Admin &gt; Slack &amp; Integrations</strong>, allowing you to create tasks with <code className="text-[#DC6E26]">@TaskPilot create...</code> and reply to bot follow-up threads.
            </p>
          </div>
        )}
      </div>

      {/* Theme & Appearance Card */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-[#DC6E26]" /> : <Sun className="h-4 w-4 text-[#DC6E26]" />}
              Appearance &amp; Theme
            </h3>
            <p className="text-[11px] text-[#6E5D4E] mt-0.5">Choose your preferred visual theme for the TaskPilot interface.</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#F2ECE1] border border-[#E3DAC8]">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${theme === 'light'
                ? 'bg-[#FAF7F2] text-[#23170E] shadow-2xs border border-[#E3DAC8] font-semibold'
                : 'text-[#736251] hover:text-[#23170E]'
                }`}
            >
              <Sun className="h-3.5 w-3.5 text-[#DC6E26]" /> Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${theme === 'dark'
                ? 'bg-[#FAF7F2] text-[#23170E] shadow-2xs border border-[#E3DAC8] font-semibold'
                : 'text-[#736251] hover:text-[#23170E]'
                }`}
            >
              <Moon className="h-3.5 w-3.5 text-[#DC6E26]" /> Dark
            </button>
          </div>
        </div>
      </div>

      {/* Account Management & Sign Out */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] flex items-center justify-between shadow-xs">
        <div>
          <h3 className="text-xs font-serif font-bold text-[#23170E]">Session &amp; Authentication</h3>
          <p className="text-[11px] text-[#736251]">Logged in via Supabase GitHub OAuth Provider</p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] hover:bg-[#FAD9D3] text-xs font-semibold transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );
}
