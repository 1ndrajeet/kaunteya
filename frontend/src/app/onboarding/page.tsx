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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Verifying workspace permissions...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 sm:p-6">
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Compass className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight text-base text-zinc-100">TaskPilot</span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>{user?.email}</span>
          <Link href="/login" className="text-zinc-500 hover:text-zinc-300">
            Switch Account
          </Link>
        </div>
      </header>

      <main className="w-full max-w-xl mx-auto my-auto space-y-6">
        {/* Existing Workspaces List if user already belongs to any */}
        {workspaces.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Building className="h-4 w-4 text-indigo-400" /> Your Workspaces
              </h2>
              <span className="text-[11px] font-mono text-zinc-500">{workspaces.length} active</span>
            </div>

            <div className="space-y-2">
              {workspaces.map((item) => (
                <div
                  key={item.workspace_id}
                  className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm text-zinc-100 flex items-center gap-2">
                      {item.workspaces?.name || 'Unnamed Workspace'}
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-semibold ${
                          item.role === 'admin'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : item.role === 'lead'
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {item.role}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-500">slug: {item.workspaces?.slug}</p>
                  </div>

                  <Link
                    href={
                      item.role === 'admin'
                        ? `/workspace/${item.workspace_id}/admin`
                        : item.role === 'lead'
                        ? `/workspace/${item.workspace_id}/lead`
                        : `/workspace/${item.workspace_id}/member`
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workspace Action Box: Create or Join */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {workspaces.length > 0 ? 'Create or Join Another Workspace' : 'Set up your TaskPilot Workspace'}
            </h1>
            <p className="text-xs text-zinc-400">
              {workspaces.length > 0
                ? 'Provision a fresh workspace or redeem an invitation from your team lead.'
                : 'Every team starts with a workspace. You will be provisioned as the initial Administrator.'}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'create'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
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
              className={`py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'join'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" /> Join with Invite Code
            </button>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 rounded-lg border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tab 1: Create Workspace */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Workspace Name</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Engineering"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Workspace Slug</label>
                  <span className="text-[10px] text-zinc-500 font-mono">Unique URL identifier</span>
                </div>
                <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <span className="text-zinc-600 font-mono text-xs select-none">taskpilot.app/</span>
                  <input
                    type="text"
                    required
                    placeholder="acme-engineering"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="w-full bg-transparent text-indigo-400 font-mono text-xs pl-1 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> Initial Admin Provisioning
                </div>
                <p className="text-[11px] text-indigo-300/80 leading-relaxed">
                  As creator, you will automatically be granted the <strong>Administrator</strong> role with full
                  governance authority. You can designate your single Team Lead inside the portal.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-sm font-medium transition-colors shadow-md shadow-indigo-600/30 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Provisioning Workspace...
                  </>
                ) : (
                  <>
                    Create Workspace &rarr;
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Join with Invitation Code */}
          {activeTab === 'join' && (
            <form onSubmit={handleJoinWorkspace} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Invitation Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-A94E-8B12"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 uppercase tracking-wider"
                />
                <p className="text-[11px] text-zinc-500">
                  Ask your workspace Administrator for an active invitation code.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <Users className="h-3.5 w-3.5 text-violet-400" /> Single Lead Safety
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Invitations carrying the <strong>Team Lead</strong> role can only be redeemed if the workspace does
                  not already have an active designated Lead.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-950" /> Validating Code...
                  </>
                ) : (
                  <>
                    Redeem Code &amp; Join Workspace &rarr;
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-600 py-4">
        TaskPilot &bull; Workspace Access Control
      </footer>
    </div>
  );
}
