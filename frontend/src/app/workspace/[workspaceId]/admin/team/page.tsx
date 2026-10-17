'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  Compass,
  Plus,
  Copy,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Trash2,
  Calendar,
  Loader2,
  ChevronLeft,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { WorkspaceRole } from '@/types/database';

interface MemberItem {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  profiles?: {
    id: string;
    display_name: string;
    email: string | null;
    github_username: string | null;
    avatar_url: string | null;
  } | null;
}

interface InvitationItem {
  id: string;
  code: string;
  role: 'lead' | 'member';
  max_uses: number;
  uses_count: number;
  expires_at: string;
  created_at: string;
}

export default function AdminTeamGovernancePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user } = useWorkspace();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Invite form state
  const [inviteRole, setInviteRole] = useState<'lead' | 'member'>('member');
  const [maxUses, setMaxUses] = useState<number>(1);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [generatingInvite, setGeneratingInvite] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTeamData = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch workspace members
    const { data: memData } = await supabase
      .from('workspace_members')
      .select(`
        id,
        workspace_id,
        user_id,
        role,
        joined_at,
        profiles:user_id (
          id,
          display_name,
          email,
          github_username,
          avatar_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (memData) setMembers(memData as unknown as MemberItem[]);

    // 2. Fetch invitations
    const { data: invData } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (invData) setInvitations(invData as unknown as InvitationItem[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchTeamData();
  }, [workspaceId]);

  const handleRoleChange = async (memberUserId: string, newRole: WorkspaceRole) => {
    setErrorMessage(null);
    setActionMessage(null);
    const supabase = createClient();

    try {
      // If changing to 'lead', ensure existing lead is demoted to 'member' first
      if (newRole === 'lead') {
        const existingLead = members.find((m) => m.role === 'lead');
        if (existingLead && existingLead.user_id !== memberUserId) {
          // Demote existing lead
          await supabase
            .from('workspace_members')
            .update({ role: 'member' })
            .eq('workspace_id', workspaceId)
            .eq('user_id', existingLead.user_id);
        }
      }

      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('workspace_id', workspaceId)
        .eq('user_id', memberUserId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // Record activity
      if (user) {
        await supabase.from('activity_events').insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          entity_type: 'member',
          entity_id: memberUserId,
          event_type: 'role_changed',
          metadata: { new_role: newRole },
        });
      }

      setActionMessage('Role updated successfully.');
      setTimeout(() => setActionMessage(null), 3000);
      fetchTeamData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Role update failed');
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setGeneratingInvite(true);
    setErrorMessage(null);

    // If inviting as lead, verify if a lead already exists
    if (inviteRole === 'lead') {
      const hasLead = members.some((m) => m.role === 'lead');
      if (hasLead) {
        setErrorMessage('This workspace already has a designated team lead. Demote the current lead first.');
        setGeneratingInvite(false);
        return;
      }
    }

    const supabase = createClient();
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedCode = `INV-${randomSuffix}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    try {
      const { error } = await supabase.from('workspace_invitations').insert({
        workspace_id: workspaceId,
        invited_by: user.id,
        code: generatedCode,
        role: inviteRole,
        max_uses: maxUses,
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        setErrorMessage(error.message);
        setGeneratingInvite(false);
        return;
      }

      setActionMessage(`Invite code ${generatedCode} generated!`);
      setTimeout(() => setActionMessage(null), 3000);
      fetchTeamData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate invitation');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (role && role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-[#FCF3E3] text-[#824B04] flex items-center justify-center mx-auto border border-[#F1DCBA]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-serif font-bold text-[#23170E]">Administrator Access Required</h2>
          <p className="text-xs text-[#6E5D4E] max-w-md">
            You are signed in as a <span className="font-mono text-[#DC6E26] uppercase font-semibold">{role}</span>. Team governance and member invitations are restricted to workspace administrators.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {role === 'lead' && (
            <Link
              href={`/workspace/${workspaceId}/lead`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Compass className="h-4 w-4" /> Go to Team Lead Portal
            </Link>
          )}
          {role === 'member' && (
            <Link
              href={`/workspace/${workspaceId}/member`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Users className="h-4 w-4" /> Go to My Tasks
            </Link>
          )}
          <Link
            href={`/workspace/${workspaceId}/tasks`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] hover:bg-[#EFE9DF] text-[#23170E] text-xs font-medium transition-colors"
          >
            Workspace Tasks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Back and Title Header */}
      <div className="space-y-2">
        <Link
          href={`/workspace/${workspaceId}/admin`}
          className="text-xs text-[#736251] hover:text-[#23170E] inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Admin Overview
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-[#23170E] flex items-center gap-2.5">
              <Users className="h-6 w-6 text-[#DC6E26]" /> Team Governance &amp; Access
            </h1>
            <p className="text-xs text-[#6E5D4E] mt-1">
              Manage workspace member roles, designate the single team lead, and issue invitation codes.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="p-3 rounded-lg bg-[#ECF6E3] border border-[#D4E9C1] text-[#2B5910] text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2B5910]" /> {actionMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-[#FCECE9] border border-[#F4CFC8] text-[#882315] text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#882315]" /> {errorMessage}
        </div>
      )}

      {/* Members Table Card */}
      <div className="rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] overflow-hidden shadow-xs space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2B5910]" /> Workspace Members ({members.length})
          </h2>
          <span className="text-[11px] font-mono text-[#736251]">Strictly 1 Team Lead per Workspace</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-mono tracking-wider text-[#736251] bg-[#F2ECE1] border-b border-[#E3DAC8]">
              <tr>
                <th className="py-2.5 px-4">Member</th>
                <th className="py-2.5 px-4">GitHub Username</th>
                <th className="py-2.5 px-4">Current Role</th>
                <th className="py-2.5 px-4">Joined Date</th>
                <th className="py-2.5 px-4 text-right">Role Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DAC8] text-[#23170E]">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-[#F2ECE1] transition-colors">
                  <td className="py-3 px-4 font-medium text-[#23170E] flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-[#DC6E26] flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {m.profiles?.avatar_url ? (
                        <img
                          src={m.profiles.avatar_url}
                          alt="Avatar"
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        m.profiles?.display_name?.[0]?.toUpperCase() || 'M'
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-[#23170E]">{m.profiles?.display_name}</div>
                      <div className="text-[10px] text-[#736251] font-mono">{m.profiles?.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#736251] text-xs">
                    {m.profiles?.github_username ? `@${m.profiles.github_username}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${m.role === 'admin'
                        ? 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                        : m.role === 'lead'
                          ? 'bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]'
                          : 'bg-[#F2ECE1] text-[#736251] border border-[#E4DBC9]'
                        }`}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#736251] text-[11px]">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value as WorkspaceRole)}
                      className="bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg px-2.5 py-1 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26] font-medium"
                    >
                      <option value="member">Member</option>
                      <option value="lead">Designate Lead</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitations Management Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Invitation Form */}
        <div className="rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] p-5 space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-serif font-bold text-[#23170E] flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#DC6E26]" /> Issue Invitation Code
            </h3>
            <p className="text-[11px] text-[#6E5D4E]">
              Generate an expiring single-use or multi-use invitation code for new teammates.
            </p>
          </div>

          <form onSubmit={handleGenerateInvite} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#736251]">Grant Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'lead' | 'member')}
                className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26] font-medium"
              >
                <option value="member">Member (Regular)</option>
                <option value="lead">Team Lead (Enforces single lead)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#736251]">Maximum Redemptions</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#736251]">Expiry (Days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                className="w-full bg-[#FAF7F2] border border-[#E3DAC8] rounded-lg px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
              />
            </div>

            <button
              type="submit"
              disabled={generatingInvite}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white px-4 py-2 text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              {generatingInvite ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
                </>
              ) : (
                'Generate Code &rarr;'
              )}
            </button>
          </form>
        </div>

        {/* Active Invitations List */}
        <div className="lg:col-span-2 rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif font-bold text-[#23170E]">Active Invitation Codes ({invitations.length})</h3>
            <span className="text-[11px] font-mono text-[#736251]">Redeemable at /onboarding</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#736251] font-mono">
                No active invitation codes. Generate one to invite teammates.
              </div>
            ) : (
              invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 rounded-lg border border-[#E3DAC8] bg-[#F2ECE1] flex items-center justify-between text-xs shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#DC6E26] tracking-wider text-sm">
                        {inv.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[10px] font-mono uppercase text-[#736251] border border-[#E3DAC8] font-semibold">
                        {inv.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#736251] font-mono flex items-center gap-3">
                      <span>Uses: {inv.uses_count} / {inv.max_uses}</span>
                      <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(inv.code)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E3DAC8] hover:bg-[#FAF7F2] text-[#23170E] text-xs font-mono transition-colors"
                  >
                    {copiedCode === inv.code ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-[#2B5910]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
