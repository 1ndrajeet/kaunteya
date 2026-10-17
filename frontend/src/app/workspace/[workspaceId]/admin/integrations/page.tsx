'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  X,
  Play,
  Copy,
  Check,
  Clock,
  Terminal,
  RefreshCw,
  Hash,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Info,
  Github,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { GithubIntegrationTab } from './github-integration-tab';
import type {
  SlackInstallation,
  SlackUserMapping,
  IntegrationEvent,
} from '@/types/database';



interface MemberWithMapping {
  userId: string;
  displayName: string;
  email: string | null;
  role: string;
  mapping?: SlackUserMapping | null;
}

export default function AdminIntegrationsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'slack' | 'github'>('slack');
  const [installation, setInstallation] = useState<SlackInstallation | null>(null);
  const [members, setMembers] = useState<MemberWithMapping[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & form state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithMapping | null>(null);
  const [slackUserIdInput, setSlackUserIdInput] = useState<string>('');
  const [slackUsernameInput, setSlackUsernameInput] = useState<string>('');
  const [savingMapping, setSavingMapping] = useState<boolean>(false);

  // Connection form state
  const [teamName, setTeamName] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [botUserId, setBotUserId] = useState<string>('');
  const [botToken, setBotToken] = useState<string>('');
  const [signingSecret, setSigningSecret] = useState<string>('');
  const [defaultChannelId, setDefaultChannelId] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);

  // Follow-up sweep state
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [sweepResult, setSweepResult] = useState<any | null>(null);

  // Setup guide accordion
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Expanded event payload
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/slack/events`
      : 'https://your-domain.com/api/slack/events';

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      // 1. Fetch Slack Installation
      const { data: instData } = await supabase
        .from('slack_installations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('installation_status', 'active')
        .maybeSingle();

      let activeInst = instData as SlackInstallation | null;
      if (!activeInst) {
        // Fallback to server route to check if server-side installation exists
        try {
          const srvRes = await fetch(`/api/slack/mapping?workspaceId=${workspaceId}`);
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            if (srvData.installation) {
              activeInst = srvData.installation;
            }
          }
        } catch {
          // non-fatal
        }
      }
      setInstallation(activeInst);

      // 2. Fetch Workspace Members & Profiles
      const { data: memData } = await supabase
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

      // 3. Fetch Mappings
      const { data: mapData } = await supabase
        .from('slack_user_mappings')
        .select('*')
        .eq('workspace_id', workspaceId);

      const mappingMap = new Map<string, SlackUserMapping>();
      mapData?.forEach((m) => mappingMap.set(m.taskpilot_user_id, m as SlackUserMapping));

      if (memData) {
        const formatted: MemberWithMapping[] = memData.map((m: any) => ({
          userId: m.user_id,
          role: m.role,
          displayName: m.profiles?.display_name || 'Member',
          email: m.profiles?.email || null,
          mapping: mappingMap.get(m.user_id) || null,
        }));
        setMembers(formatted);
      }

      // 4. Fetch Recent Integration Events
      const { data: evtData } = await supabase
        .from('integration_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('received_at', { ascending: false })
        .limit(20);

      if (evtData) {
        setEvents(evtData as IntegrationEvent[]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load integration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('slack_success')) {
        setSuccessMsg('Slack App installed and authorized successfully! Bot permissions are active.');
      }
      if (urlParams.get('slack_error')) {
        setErrorMsg(`Slack authorization failed: ${urlParams.get('slack_error')}`);
      }
    }
  }, [workspaceId]);

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleConnectSlack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !teamId.trim() || !botUserId.trim() || !user) return;

    setConnecting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/slack/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          teamId: teamId.trim(),
          teamName: teamName.trim(),
          botUserId: botUserId.trim(),
          botToken: botToken.trim(),
          signingSecret: signingSecret.trim() || undefined,
          defaultChannelId: defaultChannelId.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Connection failed');
      }

      setSuccessMsg('Slack workspace connected successfully.');
      setIsConnectModalOpen(false);
      fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!installation || !user) return;
    if (
      !confirm(
        `Are you sure you want to disconnect Slack workspace "${installation.slack_team_name}"? Active conversational task intake will be paused.`
      )
    ) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('slack_installations')
      .update({
        installation_status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', installation.id);

    if (!error) {
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'workspace',
        entity_id: workspaceId,
        event_type: 'slack_disconnected',
        metadata: {
          slack_team_name: installation.slack_team_name,
        },
      });
      setSuccessMsg('Slack integration disconnected.');
      fetchData();
    }
  };

  const openMappingModal = (member: MemberWithMapping) => {
    setSelectedMember(member);
    setSlackUserIdInput(member.mapping?.slack_user_id || '');
    setSlackUsernameInput(member.mapping?.slack_username || '');
    setIsMappingModalOpen(true);
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !user || !slackUserIdInput.trim()) return;

    setSavingMapping(true);
    setErrorMsg(null);

    try {
      const cleanSlackId = slackUserIdInput.trim().toUpperCase();
      const cleanUsername = slackUsernameInput.trim().replace(/^@/, '');

      const res = await fetch('/api/slack/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId: selectedMember.userId,
          slackUserId: cleanSlackId,
          slackUsername: cleanUsername || undefined,
          slackTeamId: installation?.slack_team_id || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save identity mapping');
      }

      setSuccessMsg(data.message || `Mapped ${selectedMember.displayName} to Slack ID ${cleanSlackId}.`);
      if (data.installation) {
        setInstallation(data.installation);
      }
      setIsMappingModalOpen(false);
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save identity mapping');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleUnlink = async (mappingId: string, memberName: string) => {
    if (!user || !confirm(`Unlink Slack identity for ${memberName}?`)) return;

    try {
      const res = await fetch('/api/slack/mapping', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          mappingId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to unlink identity');
      }

      setSuccessMsg(`Unlinked Slack identity for ${memberName}.`);
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to unlink identity');
    }
  };

  const handleTriggerFollowups = async () => {
    setSweeping(true);
    setSweepResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/slack/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute follow-up sweep');
      }

      setSweepResult(data.summaries?.[0] || data);
      setSuccessMsg('Follow-up evaluation completed.');
      fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Follow-up sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
        <ShieldCheck className="h-8 w-8 text-rose-400 mx-auto" />
        <h3 className="text-base font-semibold text-zinc-100">Administrator Access Required</h3>
        <p className="text-xs text-zinc-400 max-w-md">
          Only workspace administrators can manage external Slack installations and identity mappings.
        </p>
        <Link
          href={`/workspace/${workspaceId}/tasks`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
        >
          Back to Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-400" /> Workspace Integrations & Webhooks
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Connect TaskPilot to Slack for conversational intake and GitHub App for verifiable development evidence.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-300 text-xs hover:border-zinc-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Integration Tabs */}
      <div className="flex items-center gap-2 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('slack')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'slack'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-indigo-400" />
          Slack Workspace
          {installation?.installation_status === 'active' && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'github'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Github className="h-4 w-4 text-purple-400" />
          GitHub App &amp; Evidence
        </button>
      </div>

      {activeTab === 'github' ? (
        <GithubIntegrationTab workspaceId={workspaceId} />
      ) : (
        <>
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl border border-emerald-900/50 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Connection Status Card */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                {installation ? installation.slack_team_name : 'No Slack Workspace Connected'}
                <span
                  className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded ${
                    installation?.installation_status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {installation?.installation_status || 'Disconnected'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {installation
                  ? `Team ID: ${installation.slack_team_id} &bull; Bot User: ${installation.bot_user_id}`
                  : 'Connect an authorized Slack app to enable conversational intake and follow-up notifications.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {installation ? (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-lg border border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-xs font-medium transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.location.href = `/api/slack/install?workspaceId=${workspaceId}`;
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#4A154B] hover:bg-[#3b113b] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Add to Slack
                </button>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Manual Connect
                </button>
              </div>
            )}
          </div>
        </div>

        {installation && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Connected Date</span>
              <p className="font-mono text-zinc-200">
                {new Date(installation.connected_at).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Default Channel</span>
              <p className="font-mono text-zinc-200">{installation.default_channel_id || '(All Channels)'}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Follow-up Frequency</span>
              <p className="font-mono text-zinc-200">{installation.followup_frequency_hours} hours</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Automated Reminders</span>
              <p className="font-mono text-emerald-400">
                {installation.auto_followup_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Setup Guide Accordion */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold text-zinc-200">Slack App Configuration & Webhook Setup Guide</span>
          </div>
          {guideOpen ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          )}
        </button>

        {guideOpen && (
          <div className="p-5 border-t border-zinc-800 space-y-4 text-xs text-zinc-300 bg-zinc-950/40 leading-relaxed">
            <div className="space-y-1">
              <p className="font-semibold text-zinc-100">1. Event Subscription Request URL</p>
              <p className="text-zinc-400 text-[11px]">
                In your Slack App Dashboard &rarr; <strong>Event Subscriptions</strong>, toggle On and set the Request URL:
              </p>
              <div className="flex items-center gap-2 pt-1">
                <code className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-300 font-mono text-[11px] flex-1 truncate">
                  {webhookUrl}
                </code>
                <button
                  onClick={handleCopyWebhookUrl}
                  className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-mono"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUrl ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-zinc-100">2. Required Bot Scopes (OAuth & Permissions)</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'app_mentions:read',
                  'chat:write',
                  'channels:history',
                  'im:history',
                  'im:write',
                  'users:read',
                  'users:read.email',
                ].map((scope) => (
                  <span
                    key={scope}
                    className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-300"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-zinc-100">3. Subscribe to Bot Events</p>
              <p className="text-zinc-400 text-[11px]">
                Under <strong>Subscribe to bot events</strong>, add: <code className="text-zinc-200">app_mention</code>,{' '}
                <code className="text-zinc-200">message.im</code>, and{' '}
                <code className="text-zinc-200">message.channels</code>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Member Identity Mapping Table */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">Slack Identity Mapping</h2>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {members.filter((m) => m.mapping?.link_status === 'linked').length}/{members.length} linked
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-400">
          Only mapped members can create tasks or report progress from Slack. Unmapped users are prompted to link their
          identity.
        </p>

        <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/40 divide-y divide-zinc-800/60">
          {members.map((member) => {
            const isLinked = member.mapping?.link_status === 'linked';

            return (
              <div
                key={member.userId}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {member.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-200">{member.displayName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                        {member.role}
                      </span>
                    </div>
                    {member.email && <span className="text-[11px] text-zinc-500 font-mono">{member.email}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {isLinked ? (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-mono text-[11px] text-indigo-300 block">
                          ID: {member.mapping?.slack_user_id}
                        </span>
                        {member.mapping?.slack_username && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            @{member.mapping.slack_username}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Linked
                      </span>
                      <button
                        onClick={() => openMappingModal(member)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        title="Edit Slack ID"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleUnlink(member.mapping!.id, member.displayName)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"
                        title="Unlink Identity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500 italic">Not mapped</span>
                      <button
                        onClick={() => openMappingModal(member)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Map Slack ID
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Follow-up Automation Controls */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" /> Automated Follow-up Automation
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Checks open assigned tasks and prompts members in Slack for progress updates, status changes, and blockers.
            </p>
          </div>

          <button
            onClick={handleTriggerFollowups}
            disabled={sweeping || !installation}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {sweeping ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sweeping Tasks...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Trigger Follow-up Sweep Now
              </>
            )}
          </button>
        </div>

        {sweepResult && (
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2 text-xs">
            <h4 className="font-semibold text-zinc-200">Follow-up Evaluation Result:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div>Evaluated: {sweepResult.tasksEvaluated ?? 0}</div>
              <div className="text-emerald-400">Sent: {sweepResult.followupsSent ?? 0}</div>
              <div className="text-zinc-400">Skipped (Recent): {sweepResult.skippedRecent ?? 0}</div>
              <div className="text-amber-400">Unmapped: {sweepResult.unmappedAssignees ?? 0}</div>
            </div>
            {sweepResult.errors && sweepResult.errors.length > 0 && (
              <div className="pt-2 text-rose-400 text-[11px] space-y-1">
                {sweepResult.errors.map((e: string, i: number) => (
                  <div key={i}>&bull; {e}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Integration Event Logs & Diagnostics */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">External Event Diagnostics</h2>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {events.length} logged
            </span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
            No external events logged yet. Events delivered to `/api/slack/events` will appear here.
          </div>
        ) : (
          <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/40 divide-y divide-zinc-800/60">
            {events.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              const dateStr = new Date(evt.received_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div key={evt.id} className="p-3 space-y-1.5 text-xs hover:bg-zinc-900/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-500">{dateStr}</span>
                      <span className="font-mono font-semibold text-zinc-200">{evt.event_type}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          evt.processing_status === 'processed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : evt.processing_status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {evt.processing_status}
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                      className="text-[11px] font-mono text-zinc-500 hover:text-indigo-400 flex items-center gap-1"
                    >
                      <Info className="h-3 w-3" />
                      <span>{isExpanded ? 'Hide' : 'Payload'}</span>
                    </button>
                  </div>

                  {evt.error_summary && (
                    <p className="text-[11px] text-rose-400 font-mono">{evt.error_summary}</p>
                  )}

                  {isExpanded && (
                    <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-300 overflow-x-auto mt-1">
                      {JSON.stringify(evt.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-400" /> Connect Slack Workspace
              </h3>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConnectSlack} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Slack Workspace / Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Slack Team ID</label>
                  <input
                    type="text"
                    required
                    placeholder="T01234567"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Bot User ID</label>
                  <input
                    type="text"
                    required
                    placeholder="U09876543"
                    value={botUserId}
                    onChange={(e) => setBotUserId(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Bot User OAuth Token (xoxb-...)</label>
                <input
                  type="password"
                  placeholder="xoxb-your-bot-token"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-zinc-500">
                  Stored securely server-side; never exposed to browser.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Default Intake Channel ID (Optional)</label>
                <input
                  type="text"
                  placeholder="C01234567"
                  value={defaultChannelId}
                  onChange={(e) => setDefaultChannelId(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Save Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Identity Modal */}
      {isMappingModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" /> Map Slack User ID
              </h3>
              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMapping} className="space-y-3.5 text-xs">
              <div>
                <span className="text-zinc-400">Mapping member:</span>
                <p className="font-bold text-zinc-100 text-sm mt-0.5">{selectedMember.displayName}</p>
                {selectedMember.email && (
                  <p className="text-zinc-500 text-[11px] font-mono">{selectedMember.email}</p>
                )}
              </div>

              {!installation && (
                <div className="p-2.5 rounded-lg border border-amber-900/50 bg-amber-950/20 text-amber-300 text-[11px]">
                  No active Slack installation is registered for this workspace yet. Saving this mapping will automatically link this workspace to your verified Slack bot credentials.
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Slack User ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. U0123456789"
                  value={slackUserIdInput}
                  onChange={(e) => setSlackUserIdInput(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-zinc-500">
                  Find in Slack profile &rarr; More actions (...) &rarr; Copy member ID.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Slack Username (Optional)</label>
                <input
                  type="text"
                  placeholder="alice"
                  value={slackUsernameInput}
                  onChange={(e) => setSlackUsernameInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMapping}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {savingMapping ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
