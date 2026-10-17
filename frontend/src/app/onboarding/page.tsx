'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Building,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Users,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface WorkspaceItem {
  workspace_id: string;
  role: 'admin' | 'lead' | 'member';
  joined_at: string;
  workspaces: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
  } | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Form states
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-generate slug when name changes
  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    );
  };

  const loadWorkspaces = async (currentUser: User) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          joined_at,
          workspaces:workspaces (
            id,
            name,
            slug,
            created_at
          )
        `)
        .eq('user_id', currentUser.id);

      if (!error && data) {
        setWorkspaces(data as unknown as WorkspaceItem[]);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      loadWorkspaces(session.user);
    });
  }, [router]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setErrorMsg('Workspace name and slug are required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = createClient();
    try {
      // Use the transactional security-definer function
      const { data, error } = await supabase.rpc('create_workspace_with_admin', {
        p_name: name.trim(),
        p_slug: slug.trim(),
      });

      if (error) {
        setErrorMsg(error.message);
        setSubmitting(false);
        return;
      }

      setSuccessMsg('Workspace successfully provisioned! Redirecting...');
      const createdWs = data as { id: string; name: string; slug: string; role: string };
      setTimeout(() => {
        router.push(`/workspace/${createdWs.id}/admin`);
      }, 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create workspace');
      setSubmitting(false);
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setErrorMsg('Please enter a valid invitation code.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc('join_workspace_with_invite', {
        p_code: inviteCode.trim(),
      });

      if (error) {
        setErrorMsg(error.message);
        setSubmitting(false);
        return;
      }

      setSuccessMsg('Invitation accepted! Launching workspace...');
      const joined = data as { workspace_id: string; role: string };
      setTimeout(() => {
        router.push(
          joined.role === 'admin'
            ? `/workspace/${joined.workspace_id}/admin`
            : joined.role === 'lead'
            ? `/workspace/${joined.workspace_id}/lead`
            : `/workspace/${joined.workspace_id}/member`
        );
      }, 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to join workspace');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center text-[#59493A] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[#DC6E26]" />
        <span className="text-xs font-mono">Verifying workspace permissions...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#854D27] p-0 sm:p-3 md:p-5 text-[#23170E] flex flex-col">
      <div className="flex-1 bg-[#FAF7F2] sm:rounded-[28px] border border-[#6E3D1B]/30 shadow-2xl flex flex-col justify-between p-4 sm:p-8">
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-[#EFECE4] border border-[#DFD7C8] flex items-center justify-center text-[#5E9E2E] group-hover:bg-[#5E9E2E] group-hover:text-white transition-colors">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-serif text-2xl tracking-tight text-[#23170E]">TaskPilot</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-[#6E5E4F]">
            <span className="font-mono">{user?.email}</span>
            <Link
              href="/login"
              className="px-3 py-1 rounded-full bg-[#EFECE6] border border-[#E2DDD2] text-[#23170E] hover:bg-[#E5DEC9] transition-colors font-medium"
            >
              Switch Account
            </Link>
          </div>
        </header>

        <main className="w-full max-w-xl mx-auto my-auto space-y-6 py-8">
          {/* Existing Workspaces List if user already belongs to any */}
          {workspaces.length > 0 && (
            <div className="rounded-3xl border border-[#E2DACB] bg-[#F2EFE9] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl text-[#23170E] flex items-center gap-2">
                  <Building className="h-4 w-4 text-[#DC6E26]" /> Your Workspaces
                </h2>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#ECF6E3] text-[#2B5910] font-semibold">
                  {workspaces.length} active
                </span>
              </div>

              <div className="space-y-2.5">
                {workspaces.map((item) => (
                  <div
                    key={item.workspace_id}
                    className="p-3.5 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] flex items-center justify-between hover:border-[#C8B8A2] transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-sm text-[#23170E] flex items-center gap-2">
                        {item.workspaces?.name || 'Unnamed Workspace'}
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-semibold ${
                            item.role === 'admin'
                              ? 'bg-[#FBECE1] text-[#9A410D] border border-[#F3D5BE]'
                              : item.role === 'lead'
                              ? 'bg-[#F5ECE4] text-[#592F11] border border-[#E6D3C3]'
                              : 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
                          }`}
                        >
                          {item.role}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[#7D6E5D]">slug: {item.workspaces?.slug}</p>
                    </div>

                    <Link
                      href={
                        item.role === 'admin'
                          ? `/workspace/${item.workspace_id}/admin`
                          : item.role === 'lead'
                          ? `/workspace/${item.workspace_id}/lead`
                          : `/workspace/${item.workspace_id}/member`
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#5E9E2E] hover:bg-[#4E8724] text-white text-xs font-semibold transition-colors shadow-2xs"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workspace Action Box: Create or Join */}
          <div className="rounded-3xl border border-[#E2DACB] bg-[#F2EFE9] p-6 sm:p-8 shadow-[0_16px_48px_rgba(35,23,14,0.08)] space-y-6">
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#C86420]">
                ✦ WORKSPACE PROVISIONING
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#23170E]">
                {workspaces.length > 0 ? 'Create or Join Another Workspace' : 'Set up your TaskPilot Workspace'}
              </h1>
              <p className="text-xs text-[#6E5E4F]">
                {workspaces.length > 0
                  ? 'Provision a fresh workspace or redeem an invitation from your team lead.'
                  : 'Every team starts with a workspace. You will be provisioned as the initial Administrator.'}
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-full bg-[#E5DEC9]/70 border border-[#DDD4C2] text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-full transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'create'
                    ? 'bg-[#FAF7F2] text-[#23170E] shadow-xs'
                    : 'text-[#6E5E4F] hover:text-[#23170E]'
                }`}
              >
                <Plus className="h-3.5 w-3.5" /> Create Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('join');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-full transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'join'
                    ? 'bg-[#FAF7F2] text-[#23170E] shadow-xs'
                    : 'text-[#6E5E4F] hover:text-[#23170E]'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" /> Join with Invite Code
              </button>
            </div>

            {/* Feedback messages */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#B33624] shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl border border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910] text-xs flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#4F8E27] shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Tab 1: Create Workspace */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#3F3124]">Workspace Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Acme Engineering"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C2] rounded-xl px-3.5 py-2.5 text-sm text-[#23170E] placeholder:text-[#93826F] focus:outline-none focus:border-[#DC6E26]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#3F3124]">Workspace Slug</label>
                    <span className="text-[10px] text-[#7D6E5D] font-mono">Unique URL identifier</span>
                  </div>
                  <div className="flex items-center rounded-xl border border-[#DDD4C2] bg-[#FAF7F2] px-3.5 py-2.5 text-sm">
                    <span className="text-[#93826F] font-mono text-xs select-none">taskpilot.app/</span>
                    <input
                      type="text"
                      required
                      placeholder="acme-engineering"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="w-full bg-transparent text-[#DC6E26] font-mono text-xs font-semibold pl-1 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs text-[#59493A] space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-[#23170E]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#DC6E26]" /> Initial Admin Provisioning
                  </div>
                  <p className="text-[11px] text-[#6E5E4F] leading-relaxed">
                    As creator, you will automatically be granted the <strong>Administrator</strong> role with full
                    governance authority. You can designate your single Team Lead inside the portal.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white px-5 py-3 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Provisioning Workspace...
                    </>
                  ) : (
                    <>Create Workspace &rarr;</>
                  )}
                </button>
              </form>
            )}

            {/* Tab 2: Join with Invitation Code */}
            {activeTab === 'join' && (
              <form onSubmit={handleJoinWorkspace} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#3F3124]">Invitation Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-A94E-8B12"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#FAF7F2] border border-[#DDD4C2] rounded-xl px-3.5 py-2.5 font-mono text-sm text-[#23170E] placeholder:text-[#93826F] focus:outline-none focus:border-[#DC6E26] uppercase tracking-wider"
                  />
                  <p className="text-[11px] text-[#7D6E5D]">
                    Ask your workspace Administrator for an active invitation code.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs text-[#59493A] space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-[#23170E]">
                    <Users className="h-3.5 w-3.5 text-[#5E9E2E]" /> Single Lead Safety
                  </div>
                  <p className="text-[11px] text-[#6E5E4F] leading-relaxed">
                    Invitations carrying the <strong>Team Lead</strong> role can only be redeemed if the workspace does
                    not already have an active designated Lead.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#5E9E2E] hover:bg-[#4E8724] text-white px-5 py-3 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" /> Validating Code...
                    </>
                  ) : (
                    <>Redeem Code &amp; Join Workspace &rarr;</>
                  )}
                </button>
              </form>
            )}
          </div>
        </main>

        <footer className="text-center text-xs text-[#7D6E5D] py-2 font-mono">
          TaskPilot &bull; Workspace Access Control
        </footer>
      </div>
    </div>
  );
}
