'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  FolderGit2,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Check,
  Copy,
  Terminal,
  Info,
  Github,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type {
  GithubInstallation,
  GithubRepository,
  GithubUserMapping,
  GithubEvent,
} from '@/types/database';
import type { GitHubHealthResponse } from '@/types';

interface MemberWithGithub {
  userId: string;
  displayName: string;
  email: string | null;
  role: string;
  mapping?: GithubUserMapping | null;
}

export function GithubIntegrationTab({
  workspaceId,
  backendStatus,
}: {
  workspaceId: string;
  backendStatus?: GitHubHealthResponse | null;
}) {
  const { user } = useWorkspace();

  const [installation, setInstallation] = useState<GithubInstallation | null>(null);
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [members, setMembers] = useState<MemberWithGithub[]>([]);
  const [events, setEvents] = useState<GithubEvent[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; identifier: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & form state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [accountLogin, setAccountLogin] = useState<string>('');
  const [installationIdInput, setInstallationIdInput] = useState<string>('');
  const [accountType, setAccountType] = useState<'User' | 'Organization'>('User');
  const [webhookSecretInput, setWebhookSecretInput] = useState<string>('');
  const [personalTokenInput, setPersonalTokenInput] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);

  // Add Repository form state
  const [isAddRepoModalOpen, setIsAddRepoModalOpen] = useState<boolean>(false);
  const [repoFullName, setRepoFullName] = useState<string>('');
  const [repoProjectId, setRepoProjectId] = useState<string>('');
  const [addingRepo, setAddingRepo] = useState<boolean>(false);

  // Member Mapping Modal
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithGithub | null>(null);
  const [githubLoginInput, setGithubLoginInput] = useState<string>('');
  const [githubIdInput, setGithubIdInput] = useState<string>('');
  const [savingMapping, setSavingMapping] = useState<boolean>(false);

  // Sync state
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);
  const [startingInstall, setStartingInstall] = useState<boolean>(false);
  const [rateLimitReset, setRateLimitReset] = useState<string | null>(null);

  // Webhook URL
  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/github/webhooks`
      : 'https://your-domain.com/api/github/webhooks';
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const handleStartInstall = async () => {
    setStartingInstall(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/github/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start GitHub App installation');
      window.location.href = data.installUrl;
    } catch (err: any) {
      setErrorMsg(err.message || 'Installation initiation failed');
      setStartingInstall(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      // 1. Fetch GitHub Installation
      const { data: inst } = await supabase
        .from('github_installations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      setInstallation((inst as GithubInstallation) || null);

      if (inst?.connection_status === 'active') {
        try {
          const repoRes = await fetch(`/api/github/repositories?workspaceId=${workspaceId}`);
          if (repoRes.status === 429) {
            const rData = await repoRes.json().catch(() => ({}));
            setRateLimitReset(rData.reset_at || null);
          } else if (repoRes.ok) {
            const rData = await repoRes.json();
            if (rData.installation) {
              setInstallation(rData.installation);
            }
          }
        } catch {
          // ignore background sync error
        }
      }

      // 2. Fetch Repositories
      const { data: repos } = await supabase
        .from('github_repositories')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      setRepositories((repos as GithubRepository[]) || []);

      // 3. Fetch Workspace Projects
      const { data: projData } = await supabase
        .from('projects')
        .select('id, name, identifier')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      setProjects(projData || []);

      // 4. Fetch Members & User Mappings
      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            display_name,
            email
          )
        `)
        .eq('workspace_id', workspaceId);

      const { data: mappings } = await supabase
        .from('github_user_mappings')
        .select('*')
        .eq('workspace_id', workspaceId);

      const mappingMap = new Map<string, GithubUserMapping>();
      mappings?.forEach((m) => mappingMap.set(m.taskpilot_user_id, m as GithubUserMapping));

      const memberList: MemberWithGithub[] = (memberRows || []).map((m: any) => ({
        userId: m.user_id,
        displayName: m.profiles?.display_name || 'Member',
        email: m.profiles?.email || null,
        role: m.role,
        mapping: mappingMap.get(m.user_id) || null,
      }));

      setMembers(memberList);

      // 5. Fetch Recent GitHub Webhook Events
      const { data: evts } = await supabase
        .from('github_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(20);

      setEvents((evts as GithubEvent[]) || []);
    } catch (err: any) {
      console.error('[GitHub Tab] Error loading data:', err);
      setErrorMsg('Failed to load GitHub integration records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !accountLogin.trim() || !installationIdInput.trim()) return;

    setConnecting(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const installNum = parseInt(installationIdInput.trim(), 10);
      if (isNaN(installNum)) {
        throw new Error('Installation ID must be a numeric ID provided by GitHub.');
      }

      // Upsert Installation
      const { data: newInst, error: instError } = await supabase
        .from('github_installations')
        .upsert(
          {
            workspace_id: workspaceId,
            github_installation_id: installNum,
            account_login: accountLogin.trim(),
            account_type: accountType,
            connection_status: 'active',
            installed_by: user.id,
            installed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' }
        )
        .select()
        .single();

      if (instError || !newInst) throw instError || new Error('Failed to save GitHub installation');

      // Insert or update secrets if provided
      if (webhookSecretInput.trim() || personalTokenInput.trim()) {
        await supabase.from('github_installation_secrets').upsert(
          {
            installation_id: newInst.id,
            webhook_secret: webhookSecretInput.trim() || null,
            personal_access_token: personalTokenInput.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'installation_id' }
        );
      }

      // Audit Event
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'workspace',
        entity_id: workspaceId,
        event_type: 'github_connected',
        metadata: {
          account_login: accountLogin.trim(),
          installation_id: installNum,
        },
      });

      setSuccessMsg('GitHub App connected successfully.');
      setIsConnectModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!installation || !user) return;
    if (!confirm(`Are you sure you want to disconnect GitHub account "${installation.account_login}"? Artifact synchronization will be paused.`)) {
      return;
    }

    const supabase = createClient();
    await supabase
      .from('github_installations')
      .update({
        connection_status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', installation.id);

    await supabase.from('activity_events').insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      entity_type: 'workspace',
      entity_id: workspaceId,
      event_type: 'github_disconnected',
      metadata: { account_login: installation.account_login },
    });

    setSuccessMsg('GitHub App disconnected.');
    fetchData();
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoFullName.trim()) return;

    setAddingRepo(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const cleanName = repoFullName.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
      const parts = cleanName.split('/');
      if (parts.length !== 2) {
        throw new Error('Please enter repository in "owner/repo" format (e.g. acme/core).');
      }

      const repoShortName = parts[1];
      const repoUrl = `https://github.com/${cleanName}`;
      // Approximate numeric ID from hash or timestamp if manual
      const syntheticRepoId = Math.abs(cleanName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 100000));

      const { data: newRepo, error: repoErr } = await supabase
        .from('github_repositories')
        .insert({
          workspace_id: workspaceId,
          installation_id: installation?.id || null,
          project_id: repoProjectId || null,
          github_repo_id: syntheticRepoId,
          name: repoShortName,
          full_name: cleanName,
          repo_url: repoUrl,
          is_private: false,
          sync_status: 'idle',
        })
        .select()
        .single();

      if (repoErr) throw repoErr;

      setSuccessMsg(`Repository ${cleanName} connected.`);
      setIsAddRepoModalOpen(false);
      setRepoFullName('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add repository');
    } finally {
      setAddingRepo(false);
    }
  };

  const handleUpdateRepoProject = async (repoId: string, projectId: string) => {
    const supabase = createClient();
    await supabase
      .from('github_repositories')
      .update({
        project_id: projectId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', repoId);

    setRepositories((prev) =>
      prev.map((r) => (r.id === repoId ? { ...r, project_id: projectId || null } : r))
    );
  };

  const handleTriggerSync = async (repoId: string) => {
    setSyncingRepoId(repoId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId: repoId, workspaceId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sync request failed');
      }

      setSuccessMsg(`Evidence synchronization completed. Synced ${data.artifactsSyncedCount} artifacts, updated ${data.matchedClaimsCount} work claims.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Sync failed');
    } finally {
      setSyncingRepoId(null);
    }
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !githubLoginInput.trim()) return;

    setSavingMapping(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const cleanLogin = githubLoginInput.trim().replace(/^@/, '');
      const parsedId = githubIdInput.trim() ? parseInt(githubIdInput.trim(), 10) : 100000;

      await supabase.from('github_user_mappings').upsert(
        {
          workspace_id: workspaceId,
          taskpilot_user_id: selectedMember.userId,
          github_login: cleanLogin,
          github_user_id: isNaN(parsedId) ? 100000 : parsedId,
          link_status: 'linked',
          linked_by: user?.id || null,
          linked_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,taskpilot_user_id' }
      );

      // Also update profiles github_username for consistency
      await supabase
        .from('profiles')
        .update({ github_username: cleanLogin, updated_at: new Date().toISOString() })
        .eq('id', selectedMember.userId);

      setSuccessMsg(`Linked GitHub @${cleanLogin} to ${selectedMember.displayName}.`);
      setIsMappingModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save mapping');
    } finally {
      setSavingMapping(false);
    }
  };

  const isConnected = installation?.connection_status === 'active';

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-3 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* GitHub App Connection Overview Card */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] flex items-center justify-center text-[#23170E] shadow-xs">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-[#23170E]">GitHub App Integration</h3>
                <span
                  className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${isConnected || backendStatus?.status === 'ok'
                    ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                    : backendStatus?.status === 'degraded'
                      ? 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]'
                      : 'bg-[#F2ECE1] text-[#6E5D4E] border border-[#E3DAC8]'
                    }`}
                >
                  {isConnected || backendStatus?.status === 'ok' ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2B5910] animate-pulse" />
                      Active Connection
                    </>
                  ) : backendStatus?.status === 'degraded' ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#824B04]" />
                      Degraded
                    </>
                  ) : (
                    'Not Connected'
                  )}
                </span>
              </div>
              <p className="text-xs text-[#6E5D4E] mt-0.5">
                Collects verifiable PRs, commits, reviews, and CI checks to ground member work claims in reality.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-1.5 rounded-full border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] hover:bg-[#fbdcd6] text-xs font-semibold transition-colors"
              >
                Disconnect App
              </button>
            ) : installation && (installation.connection_status === 'suspended' || installation.connection_status === 'revoked') ? (
              <button
                onClick={handleStartInstall}
                disabled={startingInstall}
                className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
              >
                {startingInstall ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reconnecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" /> Reconnect GitHub App
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStartInstall}
                disabled={startingInstall}
                className="px-4 py-1.5 rounded-full bg-[#23170E] hover:bg-[#3d2a1b] text-white text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
              >
                {startingInstall ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting to GitHub...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Connect GitHub App
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Installation Inactive Banner */}
        {installation && (installation.connection_status === 'suspended' || installation.connection_status === 'revoked') && (
          <div className="p-3.5 rounded-2xl border border-[#F1DCBA] bg-[#FCF3E3] text-[#824B04] text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#DC6E26] shrink-0" />
              <span>
                GitHub connection status is <strong>{installation.connection_status}</strong>. Synchronization is paused. Please reconnect the application.
              </span>
            </div>
            <button
              onClick={handleStartInstall}
              disabled={startingInstall}
              className="px-3.5 py-1 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white font-semibold text-xs transition-colors shrink-0 shadow-xs"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Rate Limit Banner */}
        {rateLimitReset && (
          <div className="p-3.5 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] text-[#6E5D4E] text-xs flex items-center gap-2">
            <Info className="h-4 w-4 text-[#DC6E26] shrink-0" />
            <span>GitHub API rate limit reached. Access will automatically reset at {new Date(rateLimitReset).toLocaleTimeString()}.</span>
          </div>
        )}

        {isConnected && installation && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] font-mono text-xs">
            <div>
              <span className="text-[#6E5D4E] block text-[10px] uppercase font-semibold">Account / Org</span>
              <span className="text-[#23170E] font-semibold">{installation.account_login}</span>
            </div>
            <div>
              <span className="text-[#6E5D4E] block text-[10px] uppercase font-semibold">Installation ID</span>
              <span className="text-[#23170E] font-semibold">{installation.github_installation_id}</span>
            </div>
            <div>
              <span className="text-[#6E5D4E] block text-[10px] uppercase font-semibold">Account Type</span>
              <span className="text-[#23170E] font-semibold">{installation.account_type}</span>
            </div>
            <div>
              <span className="text-[#6E5D4E] block text-[10px] uppercase font-semibold">Last Synchronized</span>
              <span className="text-[#6E5D4E]">
                {installation.last_sync_at ? new Date(installation.last_sync_at).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        )}

        {backendStatus && (
          <div className="p-4 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] font-mono text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2B5910]" />
                <span className="text-[#23170E] font-semibold">Python Verification Engine (Phase 3 Backend)</span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${backendStatus.status === 'ok'
                ? 'bg-[#ECF6E3] text-[#2B5910] border-[#D4E9C1]'
                : 'bg-[#FCF3E3] text-[#824B04] border-[#F1DCBA]'
                }`}>
                {backendStatus.status === 'ok' ? 'Online • Authenticated' : backendStatus.status}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px] text-[#6E5D4E]">
              <div>
                <span className="text-[#6E5D4E] block text-[10px] uppercase font-sans font-semibold">GitHub App Auth</span>
                <span className="text-[#23170E] font-semibold">{backendStatus.app_configured ? 'Active (Private Key & App ID)' : 'Not Configured'}</span>
              </div>
              <div>
                <span className="text-[#6E5D4E] block text-[10px] uppercase font-sans font-semibold">Installation Status</span>
                <span className="text-[#23170E] font-semibold">{backendStatus.installation_found ? 'Verified Linked' : backendStatus.token_configured ? 'Personal Token' : 'Pending'}</span>
              </div>
              <div>
                <span className="text-[#6E5D4E] block text-[10px] uppercase font-sans font-semibold">Accessible Repositories</span>
                <span className="text-[#23170E] font-semibold truncate block">
                  {backendStatus.accessible_repositories && backendStatus.accessible_repositories.length > 0
                    ? backendStatus.accessible_repositories.join(', ')
                    : 'None detected'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Webhook Endpoint Info */}
        <div className="p-3.5 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-[#6E5D4E] flex items-center gap-1.5 font-semibold">
              <Terminal className="h-3 w-3 text-[#DC6E26]" /> GitHub Webhook Payload URL:
            </span>
            <code className="text-[11px] font-mono text-[#23170E] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E3DAC8] select-all">
              {webhookUrl}
            </code>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              setCopiedWebhook(true);
              setTimeout(() => setCopiedWebhook(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-mono font-medium border border-[#E3DAC8] transition-colors self-start sm:self-auto shrink-0"
          >
            {copiedWebhook ? <Check className="h-3 w-3 text-[#2B5910]" /> : <Copy className="h-3 w-3" />}
            <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>
      </div>

      {/* Repositories & Project Associations */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-[#DC6E26]" /> Authorized Repositories &amp; Project Linking
            </h3>
            <p className="text-xs text-[#6E5D4E] mt-0.5">
              Connect GitHub repositories to TaskPilot projects for automated evidence correlation and PR state tracking.
            </p>
          </div>

          <button
            onClick={() => setIsAddRepoModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Add Repository
          </button>
        </div>

        {repositories.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-[#E3DAC8] text-center space-y-2">
            <GitBranch className="h-6 w-6 text-[#736251] mx-auto" />
            <p className="text-xs text-[#6E5D4E]">No repositories associated with this workspace yet.</p>
            <p className="text-[11px] text-[#6E5D4E]">Add a repository above to start synchronizing commits, PRs, and CI check runs.</p>
          </div>
        ) : (
          <div className="border border-[#E3DAC8] rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2ECE1] border-b border-[#E3DAC8] text-[11px] font-mono text-[#6E5D4E] uppercase">
                <tr>
                  <th className="p-3">Repository</th>
                  <th className="p-3">Associated Project</th>
                  <th className="p-3">Sync Status</th>
                  <th className="p-3">Last Synced</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DAC8] font-sans">
                {repositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-[#F2ECE1]/50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4 text-[#23170E] shrink-0" />
                        <a
                          href={repo.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#23170E] hover:text-[#DC6E26] flex items-center gap-1 transition-colors"
                        >
                          {repo.full_name}
                          <ExternalLink className="h-3 w-3 text-[#6E5D4E]" />
                        </a>
                      </div>
                    </td>
                    <td className="p-3">
                      <select
                        value={repo.project_id || ''}
                        onChange={(e) => handleUpdateRepoProject(repo.id, e.target.value)}
                        className="bg-[#FAF7F2] border border-[#E3DAC8] rounded-xl px-2.5 py-1 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
                      >
                        <option value="">-- No Project Linked --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.identifier}] {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {repo.sync_status === 'synced' && (
                        <span className="text-[#2B5910] flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Synced
                        </span>
                      )}
                      {repo.sync_status === 'syncing' && (
                        <span className="text-[#DC6E26] flex items-center gap-1 font-semibold">
                          <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
                        </span>
                      )}
                      {repo.sync_status === 'error' && (
                        <span className="text-[#882315] flex items-center gap-1 font-semibold">
                          <AlertCircle className="h-3 w-3" /> Error
                        </span>
                      )}
                      {repo.sync_status === 'idle' && (
                        <span className="text-[#6E5D4E]">Idle</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-[#6E5D4E]">
                      {repo.last_sync_at ? new Date(repo.last_sync_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleTriggerSync(repo.id)}
                        disabled={syncingRepoId === repo.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold border border-[#E3DAC8] transition-colors disabled:opacity-50"
                      >
                        {syncingRepoId === repo.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-[#DC6E26]" />
                        ) : (
                          <RefreshCw className="h-3 w-3 text-[#DC6E26]" />
                        )}
                        <span>Sync Evidence</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GitHub Member Mapping Table */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div>
          <h3 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
            <Users className="h-4 w-4 text-[#DC6E26]" /> GitHub Member Identity Mapping
          </h3>
          <p className="text-xs text-[#6E5D4E] mt-0.5">
            Associate team members with their GitHub accounts to attribute commit SHAs, PR authorships, and code reviews accurately.
          </p>
        </div>

        <div className="border border-[#E3DAC8] rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2ECE1] border-b border-[#E3DAC8] text-[11px] font-mono text-[#6E5D4E] uppercase">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Role</th>
                <th className="p-3">Mapped GitHub Handle</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DAC8] font-sans">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-[#F2ECE1]/50 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-[#23170E]">{m.displayName}</div>
                    <div className="text-[11px] text-[#6E5D4E] font-mono">{m.email}</div>
                  </td>
                  <td className="p-3 font-mono text-[11px] uppercase text-[#6E5D4E] font-semibold">{m.role}</td>
                  <td className="p-3 font-mono text-xs">
                    {m.mapping?.github_login ? (
                      <a
                        href={`https://github.com/${m.mapping.github_login}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#DC6E26] hover:underline flex items-center gap-1 font-semibold"
                      >
                        @{m.mapping.github_login}
                        <ExternalLink className="h-3 w-3 text-[#6E5D4E]" />
                      </a>
                    ) : (
                      <span className="text-[#6E5D4E] italic">Unlinked</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-[11px]">
                    {m.mapping?.link_status === 'linked' ? (
                      <span className="text-[#2B5910] flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Linked
                      </span>
                    ) : (
                      <span className="text-[#6E5D4E]">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setGithubLoginInput(m.mapping?.github_login || '');
                        setGithubIdInput(String(m.mapping?.github_user_id || ''));
                        setIsMappingModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-full bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold border border-[#E3DAC8] transition-colors"
                    >
                      {m.mapping ? 'Edit Link' : 'Link GitHub'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GitHub Events Webhook Journal */}
      <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
        <div>
          <h3 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#DC6E26]" /> Ingestion &amp; Webhook Delivery Journal
          </h3>
          <p className="text-xs text-[#6E5D4E] mt-0.5">
            Idempotent log of external webhook deliveries received from GitHub.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-[#E3DAC8] text-center text-xs text-[#6E5D4E]">
            No webhook deliveries recorded yet. Deliveries will appear here as PRs and check runs occur.
          </div>
        ) : (
          <div className="border border-[#E3DAC8] rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F2ECE1] border-b border-[#E3DAC8] text-[11px] text-[#6E5D4E] uppercase">
                <tr>
                  <th className="p-3">Delivery ID</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Received</th>
                  <th className="p-3 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DAC8] text-xs">
                {events.map((ev) => {
                  const isExpanded = expandedEventId === ev.id;
                  return (
                    <React.Fragment key={ev.id}>
                      <tr className="hover:bg-[#F2ECE1]/50 transition-colors">
                        <td className="p-3 text-[#6E5D4E]">{ev.delivery_id.slice(0, 12)}...</td>
                        <td className="p-3 font-semibold text-[#23170E]">{ev.event_type}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${ev.processing_status === 'processed'
                              ? 'bg-[#ECF6E3] text-[#2B5910] border-[#D4E9C1]'
                              : ev.processing_status === 'ignored'
                                ? 'bg-[#F2ECE1] text-[#6E5D4E] border-[#E3DAC8]'
                                : 'bg-[#FCECE9] text-[#882315] border-[#F4CFC8]'
                              }`}
                          >
                            {ev.processing_status}
                          </span>
                        </td>
                        <td className="p-3 text-[#6E5D4E]">{new Date(ev.received_at).toLocaleTimeString()}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                            className="text-xs text-[#DC6E26] hover:underline font-semibold"
                          >
                            {isExpanded ? 'Hide' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="p-3 bg-[#F2ECE1] border-b border-[#E3DAC8] font-mono text-[11px] text-[#23170E]">
                            <pre className="overflow-x-auto">{JSON.stringify(ev.payload_summary, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connect GitHub App Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23170E]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3DAC8] pb-3">
              <h3 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                <Github className="h-4 w-4 text-[#DC6E26]" /> Connect GitHub App
              </h3>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-[#6E5D4E] hover:text-[#23170E] p-1.5 rounded-full hover:bg-[#F2ECE1] transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConnect} className="space-y-3 text-xs">
              <div>
                <label className="text-[#23170E] font-semibold block mb-1">Account or Organization Login</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acme-corp or octocat"
                  value={accountLogin}
                  onChange={(e) => setAccountLogin(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div>
                <label className="text-[#23170E] font-semibold block mb-1">GitHub Installation ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 58219482 (from GitHub App installation URL)"
                  value={installationIdInput}
                  onChange={(e) => setInstallationIdInput(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div>
                <label className="text-[#23170E] font-semibold block mb-1">Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as any)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2 text-[#23170E] text-xs focus:outline-none focus:border-[#DC6E26]"
                >
                  <option value="User">Personal User</option>
                  <option value="Organization">Organization</option>
                </select>
              </div>

              <div>
                <label className="text-[#23170E] font-semibold block mb-1">Webhook Secret (Optional)</label>
                <input
                  type="password"
                  placeholder="Secret configured in GitHub App settings"
                  value={webhookSecretInput}
                  onChange={(e) => setWebhookSecretInput(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div>
                <label className="text-[#23170E] font-semibold block mb-1">Personal Access Token (Development Fallback)</label>
                <input
                  type="password"
                  placeholder="ghp_... (optional fallback for development)"
                  value={personalTokenInput}
                  onChange={(e) => setPersonalTokenInput(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DAC8]">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {connecting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{connecting ? 'Connecting...' : 'Save & Connect'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Repository Modal */}
      {isAddRepoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23170E]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3DAC8] pb-3">
              <h3 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-[#DC6E26]" /> Add Authorized Repository
              </h3>
              <button
                onClick={() => setIsAddRepoModalOpen(false)}
                className="text-[#6E5D4E] hover:text-[#23170E] p-1.5 rounded-full hover:bg-[#F2ECE1] transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRepository} className="space-y-3 text-xs">
              <div>
                <label className="text-[#23170E] font-semibold block mb-1">Repository Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="owner/repo (e.g. acme/core)"
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div>
                <label className="text-[#23170E] font-semibold block mb-1">Associate with Project</label>
                <select
                  value={repoProjectId}
                  onChange={(e) => setRepoProjectId(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2 text-[#23170E] text-xs focus:outline-none focus:border-[#DC6E26]"
                >
                  <option value="">-- No Project (Workspace Wide) --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.identifier}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DAC8]">
                <button
                  type="button"
                  onClick={() => setIsAddRepoModalOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingRepo}
                  className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addingRepo && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{addingRepo ? 'Adding...' : 'Add Repository'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Mapping Modal */}
      {isMappingModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23170E]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3DAC8] pb-3">
              <h3 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                <Github className="h-4 w-4 text-[#DC6E26]" /> Link GitHub Account for {selectedMember.displayName}
              </h3>
              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="text-[#6E5D4E] hover:text-[#23170E] p-1.5 rounded-full hover:bg-[#F2ECE1] transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveMapping} className="space-y-3 text-xs">
              <div>
                <label className="text-[#23170E] font-semibold block mb-1">GitHub Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. octocat"
                  value={githubLoginInput}
                  onChange={(e) => setGithubLoginInput(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div>
                <label className="text-[#23170E] font-semibold block mb-1">GitHub Numeric User ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 583231"
                  value={githubIdInput}
                  onChange={(e) => setGithubIdInput(e.target.value)}
                  className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl p-2.5 text-[#23170E] font-mono text-xs focus:outline-none focus:border-[#DC6E26]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DAC8]">
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMapping}
                  className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingMapping && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{savingMapping ? 'Saving...' : 'Save Mapping'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
