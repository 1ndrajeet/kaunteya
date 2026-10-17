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
import { getIntegrationsStatus, processSlackClaim, type IntegrationBundle } from '@/lib/api';
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
  const [backendStatus, setBackendStatus] = useState<IntegrationBundle | null>(null);
  const [members, setMembers] = useState<MemberWithMapping[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Diagnostic Claim Simulator state
  const [diagnosticText, setDiagnosticText] = useState<string>('CORE-14 is complete');
  const [diagnosticSlackUser, setDiagnosticSlackUser] = useState<string>('U0C9NRMSXUM');
  const [diagnosticRunning, setDiagnosticRunning] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

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

      // 5. Fetch Live Backend Integration Health
      try {
        const bStatus = await getIntegrationsStatus(workspaceId);
        setBackendStatus(bStatus);
      } catch (backendErr) {
        console.warn('Backend integrations check returned:', backendErr);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load integration data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnostic = async () => {
    if (!diagnosticText.trim() || !diagnosticSlackUser.trim()) return;
    setDiagnosticRunning(true);
    setDiagnosticError(null);
    setDiagnosticResult(null);

    try {
      const res = await processSlackClaim({
        workspaceId,
        slackUserId: diagnosticSlackUser.trim(),
        text: diagnosticText.trim(),
      });
      setDiagnosticResult(res);
      fetchData();
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : 'Diagnostic execution failed');
    } finally {
      setDiagnosticRunning(false);
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
        <ShieldCheck className="h-8 w-8 text-[#DC6E26] mx-auto" />
        <h3 className="text-xl font-serif font-bold text-[#23170E]">Administrator Access Required</h3>
        <p className="text-xs text-[#6E5D4E] max-w-md">
          Only workspace administrators can manage external Slack installations and identity mappings.
        </p>
        <Link
          href={`/workspace/${workspaceId}/tasks`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors"
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
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#23170E] flex items-center gap-2">
            <Settings className="h-6 w-6 text-[#DC6E26]" /> Workspace Integrations &amp; Webhooks
          </h1>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Connect TaskPilot to Slack for conversational intake and GitHub App for verifiable development evidence.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-medium transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Integration Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF7F2] border border-[#E3DAC8] rounded-full w-fit">
        <button
          onClick={() => setActiveTab('slack')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'slack'
            ? 'bg-[#23170E] text-white shadow-xs'
            : 'text-[#6E5D4E] hover:text-[#23170E]'
            }`}
        >
          <MessageSquare className="h-4 w-4 text-[#DC6E26]" />
          Slack Workspace
          {installation?.installation_status === 'active' && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#2B5910]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'github'
            ? 'bg-[#23170E] text-white shadow-xs'
            : 'text-[#6E5D4E] hover:text-[#23170E]'
            }`}
        >
          <Github className="h-4 w-4 text-[#DC6E26]" />
          GitHub App &amp; Evidence
        </button>
      </div>

      {activeTab === 'github' ? (
        <GithubIntegrationTab workspaceId={workspaceId} backendStatus={backendStatus?.github?.health} />
      ) : (
        <>
          {errorMsg && (
            <div className="p-3.5 rounded-2xl border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#882315] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl border border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910] text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2B5910] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Connection Status Card */}
          <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FCF3E3] border border-[#F1DCBA] flex items-center justify-center text-[#DC6E26]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                    {installation?.slack_team_name ||
                      backendStatus?.slack?.health?.bot_identity?.team ||
                      'No Slack Workspace Connected'}
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${installation?.installation_status === 'active' ||
                        backendStatus?.slack?.health?.status === 'ok'
                        ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                        : 'bg-[#F2ECE1] text-[#6E5D4E] border border-[#E3DAC8]'
                        }`}
                    >
                      {(installation?.installation_status === 'active' ||
                        backendStatus?.slack?.health?.status === 'ok') && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2B5910] animate-pulse" />
                        )}
                      {installation?.installation_status === 'active' ||
                        backendStatus?.slack?.health?.status === 'ok'
                        ? 'Connected (Events API Active)'
                        : 'Disconnected'}
                    </span>
                  </h2>
                  <p className="text-xs text-[#6E5D4E]">
                    {installation || backendStatus?.slack?.health?.bot_identity
                      ? `Team: ${installation?.slack_team_id ||
                      backendStatus?.slack?.health?.bot_identity?.team_id
                      } • Bot: @${backendStatus?.slack?.health?.bot_identity?.user ||
                      installation?.bot_user_id
                      } (${backendStatus?.slack?.health?.bot_identity?.bot_id || 'Active'
                      })`
                      : 'Connect an authorized Slack app to enable conversational intake and GitHub verification.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {installation ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-3.5 py-1.5 rounded-full border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] hover:bg-[#fbdcd6] text-xs font-semibold transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        window.location.href = `/api/slack/install?workspaceId=${workspaceId}`;
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#4A154B] hover:bg-[#3b113b] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                      </svg>
                      Add to Slack
                    </button>
                    <button
                      onClick={() => setIsConnectModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Manual Connect
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E3DAC8] text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#6E5D4E] font-mono uppercase font-semibold">Runtime Engine</span>
                <p className="font-mono text-[#DC6E26] font-semibold">
                  {backendStatus?.slack?.status?.runtime || 'FastAPI Events API'}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#6E5D4E] font-mono uppercase font-semibold">HMAC Signing Secret</span>
                <p className="font-mono text-[#2B5910] font-semibold">
                  {backendStatus?.slack?.health?.signing_secret_configured ? 'Verified (SHA-256)' : 'Pending'}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#6E5D4E] font-mono uppercase font-semibold">Claim Detection</span>
                <p className="font-mono text-[#23170E]">
                  {backendStatus?.slack?.status?.features?.conversational_claim_detection ? 'Enabled (Deterministic)' : 'Active'}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#6E5D4E] font-mono uppercase font-semibold">GitHub Loop</span>
                <p className="font-mono text-[#6E5D4E]">
                  {backendStatus?.slack?.status?.features?.github_verification_loop ? 'Operational' : 'Ready'}
                </p>
              </div>
            </div>
          </div>

          {/* 1.5 Diagnostic Sandbox for Slack Claims */}
          <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="h-4 w-4 text-[#DC6E26]" />
                <h3 className="text-xs font-bold text-[#23170E] uppercase tracking-wider font-mono">
                  Live Slack Claim &amp; Verification Diagnostic Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#6E5D4E]">Internal Backend Tool</span>
            </div>
            <p className="text-xs text-[#6E5D4E]">
              Test conversational Slack completion claims directly against the Python backend to verify task resolution, blocker classification, and GitHub commit matching.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <label className="text-[11px] text-[#6E5D4E] font-mono font-medium">Slack User ID</label>
                <input
                  type="text"
                  value={diagnosticSlackUser}
                  onChange={(e) => setDiagnosticSlackUser(e.target.value)}
                  placeholder="e.g. U0C9NRMSXUM"
                  className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-xl px-3 py-1.5 text-xs text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] text-[#6E5D4E] font-mono font-medium">Simulated Slack Message</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={diagnosticText}
                    onChange={(e) => setDiagnosticText(e.target.value)}
                    placeholder="e.g. CORE-14 is complete"
                    className="flex-1 bg-[#FAF7F2] border border-[#E3DAC8] rounded-xl px-3 py-1.5 text-xs text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                  />
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={diagnosticRunning}
                    className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                  >
                    {diagnosticRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Test Intake
                  </button>
                </div>
              </div>
            </div>

            {diagnosticError && (
              <div className="p-3 rounded-xl border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] text-xs">
                {diagnosticError}
              </div>
            )}

            {diagnosticResult && (
              <div className="p-3.5 rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#6E5D4E] text-[11px]">
                    Intent: <span className="text-[#DC6E26] font-semibold">{diagnosticResult.intent}</span>
                    {diagnosticResult.task_identifier && ` • Task: ${diagnosticResult.task_identifier}`}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full ${diagnosticResult.ok
                      ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                      : 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]'
                      }`}
                  >
                    Status: {diagnosticResult.verification_status || diagnosticResult.new_task_status || 'Processed'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F2ECE1] border border-[#E3DAC8] text-[#23170E] font-mono text-[11px] leading-relaxed">
                  {diagnosticResult.reply_message}
                </div>
              </div>
            )}
          </div>

          {/* 2. Setup Guide Accordion */}
          <div className="rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] overflow-hidden">
            <button
              onClick={() => setGuideOpen(!guideOpen)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F2ECE1] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="h-4 w-4 text-[#DC6E26]" />
                <span className="text-xs font-bold text-[#23170E]">Slack App Configuration &amp; Webhook Setup Guide</span>
              </div>
              {guideOpen ? (
                <ChevronDown className="h-4 w-4 text-[#6E5D4E]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#6E5D4E]" />
              )}
            </button>

            {guideOpen && (
              <div className="p-5 border-t border-[#E3DAC8] space-y-4 text-xs text-[#6E5D4E] bg-[#FAF7F2] leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-[#23170E]">1. Event Subscription Request URL</p>
                  <p className="text-[#6E5D4E] text-[11px]">
                    In your Slack App Dashboard &rarr; <strong>Event Subscriptions</strong>, toggle On and set the Request URL:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <code className="p-2 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] text-[#DC6E26] font-mono text-[11px] flex-1 truncate">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={handleCopyWebhookUrl}
                      className="px-3.5 py-2 rounded-full border border-[#E3DAC8] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#23170E] flex items-center gap-1.5 text-xs font-mono font-medium transition-colors"
                    >
                      {copiedUrl ? <Check className="h-3.5 w-3.5 text-[#2B5910]" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-[#23170E]">2. Required Bot Scopes (OAuth &amp; Permissions)</p>
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
                        className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-[#F2ECE1] border border-[#E3DAC8] text-[#23170E]"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-[#23170E]">3. Subscribe to Bot Events</p>
                  <p className="text-[#6E5D4E] text-[11px]">
                    Under <strong>Subscribe to bot events</strong>, add: <code className="text-[#23170E] font-semibold">app_mention</code>,{' '}
                    <code className="text-[#23170E] font-semibold">message.im</code>, and{' '}
                    <code className="text-[#23170E] font-semibold">message.channels</code>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. Member Identity Mapping Table */}
          <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#DC6E26]" />
                <h2 className="text-base font-serif font-bold text-[#23170E]">Slack Identity Mapping</h2>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECE1] border border-[#E3DAC8] text-[#6E5D4E]">
                  {members.filter((m) => m.mapping?.link_status === 'linked').length}/{members.length} linked
                </span>
              </div>
            </div>

            <p className="text-xs text-[#6E5D4E]">
              Only mapped members can create tasks or report progress from Slack. Unmapped users are prompted to link their
              identity.
            </p>

            <div className="border border-[#E3DAC8] rounded-2xl overflow-hidden bg-[#FAF7F2] divide-y divide-[#E3DAC8]">
              {members.map((member) => {
                const isLinked = member.mapping?.link_status === 'linked';

                return (
                  <div
                    key={member.userId}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F2ECE1]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#DC6E26] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {member.displayName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#23170E]">{member.displayName}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F2ECE1] border border-[#E3DAC8] text-[#6E5D4E]">
                            {member.role}
                          </span>
                        </div>
                        {member.email && <span className="text-[11px] text-[#6E5D4E] font-mono">{member.email}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {isLinked ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="font-mono text-[11px] text-[#DC6E26] block font-semibold">
                              ID: {member.mapping?.slack_user_id}
                            </span>
                            {member.mapping?.slack_username && (
                              <span className="text-[10px] text-[#6E5D4E] font-mono">
                                @{member.mapping.slack_username}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]">
                            Linked
                          </span>
                          <button
                            onClick={() => openMappingModal(member)}
                            className="p-1.5 rounded-full text-[#6E5D4E] hover:text-[#23170E] hover:bg-[#F2ECE1] transition-colors"
                            title="Edit Slack ID"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleUnlink(member.mapping!.id, member.displayName)}
                            className="p-1.5 rounded-full text-[#6E5D4E] hover:text-[#882315] hover:bg-[#FCECE9] transition-colors"
                            title="Unlink Identity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#6E5D4E] italic">Not mapped</span>
                          <button
                            onClick={() => openMappingModal(member)}
                            className="px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#E3DAC8] text-[#23170E] text-xs font-semibold transition-colors cursor-pointer"
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
          <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#DC6E26]" /> Automated Follow-up Automation
                </h2>
                <p className="text-xs text-[#6E5D4E] mt-1">
                  Checks open assigned tasks and prompts members in Slack for progress updates, status changes, and blockers.
                </p>
              </div>

              <button
                onClick={handleTriggerFollowups}
                disabled={sweeping || !installation}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
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
              <div className="p-4 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] space-y-2 text-xs">
                <h4 className="font-semibold text-[#23170E]">Follow-up Evaluation Result:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  <div>Evaluated: {sweepResult.tasksEvaluated ?? 0}</div>
                  <div className="text-[#2B5910] font-semibold">Sent: {sweepResult.followupsSent ?? 0}</div>
                  <div className="text-[#6E5D4E]">Skipped (Recent): {sweepResult.skippedRecent ?? 0}</div>
                  <div className="text-[#824B04] font-semibold">Unmapped: {sweepResult.unmappedAssignees ?? 0}</div>
                </div>
                {sweepResult.errors && sweepResult.errors.length > 0 && (
                  <div className="pt-2 text-[#882315] text-[11px] space-y-1">
                    {sweepResult.errors.map((e: string, i: number) => (
                      <div key={i}>&bull; {e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Integration Event Logs & Diagnostics */}
          <div className="p-6 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#DC6E26]" />
                <h2 className="text-base font-serif font-bold text-[#23170E]">External Event Diagnostics</h2>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECE1] border border-[#E3DAC8] text-[#6E5D4E]">
                  {events.length} logged
                </span>
              </div>
            </div>

            {events.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-[#E3DAC8] text-center text-xs text-[#6E5D4E]">
                No external events logged yet. Events delivered to `/api/slack/events` will appear here.
              </div>
            ) : (
              <div className="border border-[#E3DAC8] rounded-2xl overflow-hidden bg-[#FAF7F2] divide-y divide-[#E3DAC8]">
                {events.map((evt) => {
                  const isExpanded = expandedEventId === evt.id;
                  const dateStr = new Date(evt.received_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <div key={evt.id} className="p-3.5 space-y-1.5 text-xs hover:bg-[#F2ECE1]/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#6E5D4E]">{dateStr}</span>
                          <span className="font-mono font-semibold text-[#23170E]">{evt.event_type}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${evt.processing_status === 'processed'
                              ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                              : evt.processing_status === 'failed'
                                ? 'bg-[#FCECE9] text-[#882315] border border-[#F4CFC8]'
                                : 'bg-[#F2ECE1] text-[#6E5D4E] border border-[#E3DAC8]'
                              }`}
                          >
                            {evt.processing_status}
                          </span>
                        </div>

                        <button
                          onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                          className="text-[11px] font-mono text-[#6E5D4E] hover:text-[#DC6E26] flex items-center gap-1 transition-colors"
                        >
                          <Info className="h-3 w-3" />
                          <span>{isExpanded ? 'Hide' : 'Payload'}</span>
                        </button>
                      </div>

                      {evt.error_summary && (
                        <p className="text-[11px] text-[#882315] font-mono">{evt.error_summary}</p>
                      )}

                      {isExpanded && (
                        <pre className="p-2.5 rounded-xl bg-[#F2ECE1] border border-[#E3DAC8] font-mono text-[10px] text-[#23170E] overflow-x-auto mt-1">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23170E]/50 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E3DAC8]">
                  <h3 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#DC6E26]" /> Connect Slack Workspace
                  </h3>
                  <button
                    onClick={() => setIsConnectModalOpen(false)}
                    className="p-1.5 rounded-full text-[#6E5D4E] hover:text-[#23170E] hover:bg-[#F2ECE1] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleConnectSlack} className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#23170E]">Slack Workspace / Team Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Acme Corp"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-[#23170E]">Slack Team ID</label>
                      <input
                        type="text"
                        required
                        placeholder="T01234567"
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                        className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-[#23170E]">Bot User ID</label>
                      <input
                        type="text"
                        required
                        placeholder="U09876543"
                        value={botUserId}
                        onChange={(e) => setBotUserId(e.target.value.toUpperCase())}
                        className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#23170E]">Bot User OAuth Token (xoxb-...)</label>
                    <input
                      type="password"
                      placeholder="xoxb-your-bot-token"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                    />
                    <p className="text-[10px] text-[#6E5D4E]">
                      Stored securely server-side; never exposed to browser.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#23170E]">Default Intake Channel ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="C01234567"
                      value={defaultChannelId}
                      onChange={(e) => setDefaultChannelId(e.target.value.toUpperCase())}
                      className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
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
                      className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23170E]/50 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E3DAC8]">
                  <h3 className="text-base font-serif font-bold text-[#23170E] flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#DC6E26]" /> Map Slack User ID
                  </h3>
                  <button
                    onClick={() => setIsMappingModalOpen(false)}
                    className="p-1.5 rounded-full text-[#6E5D4E] hover:text-[#23170E] hover:bg-[#F2ECE1] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveMapping} className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-[#6E5D4E]">Mapping member:</span>
                    <p className="font-bold text-[#23170E] text-sm mt-0.5">{selectedMember.displayName}</p>
                    {selectedMember.email && (
                      <p className="text-[#6E5D4E] text-[11px] font-mono">{selectedMember.email}</p>
                    )}
                  </div>

                  {!installation && (
                    <div className="p-2.5 rounded-xl border border-[#F1DCBA] bg-[#FCF3E3] text-[#824B04] text-[11px]">
                      No active Slack installation is registered for this workspace yet. Saving this mapping will automatically link this workspace to your verified Slack bot credentials.
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-semibold text-[#23170E]">Slack User ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. U0123456789"
                      value={slackUserIdInput}
                      onChange={(e) => setSlackUserIdInput(e.target.value.toUpperCase())}
                      className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                    />
                    <p className="text-[10px] text-[#6E5D4E]">
                      Find in Slack profile &rarr; More actions (...) &rarr; Copy member ID.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#23170E]">Slack Username (Optional)</label>
                    <input
                      type="text"
                      placeholder="alice"
                      value={slackUsernameInput}
                      onChange={(e) => setSlackUsernameInput(e.target.value)}
                      className="w-full bg-[#F2ECE1] border border-[#E3DAC8] rounded-xl px-3 py-2 text-[#23170E] font-mono focus:outline-none focus:border-[#DC6E26]"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
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
                      className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
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
