'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  CheckSquare,
  Clock,
  Layers,
  ShieldCheck,
  Users,
  LogOut,
  Plus,
  Search,
  Activity,
  Menu,
  X,
  User as UserIcon,
  ChevronDown,
  Loader2,
  AlertCircle,
  MessageSquare,
  FileCheck2,
  KeyRound,
  Building,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  CreditCard,
  FolderKanban,
  Settings,
  Sun,
  Moon,
} from '@/components/ui/pica-icons';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { WorkspaceContext } from '@/features/workspace/workspace-context';
import { CreateTaskModal } from '@/features/tasks/create-task-modal';
import { PricingUpgradeDialog } from '@/features/billing/pricing-upgrade-dialog';
import { ThemeToggle } from '@/features/theme/theme-context';
import type { User } from '@supabase/supabase-js';
import type { WorkspaceRole } from '@/types/database';

/* ---------------------------------- types --------------------------------- */

interface WorkspaceItem {
  workspace_id: string;
  role: WorkspaceRole;
  name: string;
  slug: string;
}

/* --------------------------------- helpers -------------------------------- */

function workspaceHome(id: string, role: WorkspaceRole) {
  return `/workspace/${id}/${role}`;
}

/* -------------------------------- component ------------------------------- */

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('Loading...');
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('');
  const [workspaceProjects, setWorkspaceProjects] = useState<{ id: string; name: string; identifier: string; status: string }[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [redirecting, setRedirecting] = useState<boolean>(false);   // <-- NEW
  const [unauthorized, setUnauthorized] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState<boolean>(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);

  /* ---------- redirect helper: hard replace so back-button can't loop ---- */
  const redirectToLogin = useCallback(
    (reason: 'no-session' | 'expired' = 'no-session') => {
      setRedirecting(true);
      setLoading(false);
      // replace() removes the broken route from history
      router.replace(`/login?reason=${reason}`);
    },
    [router],
  );

  /* ---------------------------- workspace loader ------------------------- */
  const fetchWorkspaceData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // getUser() validates the JWT server-side and refreshes if expired.
    // NEVER rely on getSession() alone for auth gating.
    const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !authUser) {
      // Expired or revoked token — bounce immediately.
      redirectToLogin(userErr ? 'expired' : 'no-session');
      return;
    }

    setUser(authUser);

    // --- workspace metadata ------------------------------------------------
    const { data: wsData, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, name, slug, created_by')
      .eq('id', workspaceId)
      .maybeSingle();

    // A null row here almost always means RLS blocked the read because the
    // user isn't a member (or their session is stale). Distinguish the two:
    if (wsErr?.code === 'PGRST301' || wsErr?.message?.includes('JWT')) {
      redirectToLogin('expired');
      return;
    }

    if (!wsData) {
      // Not a member → show the "Access Denied" panel, don't redirect.
      setUnauthorized(true);
      setLoading(false);
      return;
    }

    setWorkspaceName(wsData.name);
    setWorkspaceSlug(wsData.slug);

    // --- projects for switcher --------------------------------------------
    const { data: pList } = await supabase
      .from('projects')
      .select('id, name, identifier, status')
      .eq('workspace_id', workspaceId)
      .neq('status', 'archived')
      .order('name');

    if (pList) setWorkspaceProjects(pList as any);

    // --- resolve role ------------------------------------------------------
    const { data: memberData } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authUser.id)
      .maybeSingle();

    let resolvedRole: WorkspaceRole | null = null;
    if (memberData?.role) {
      resolvedRole = memberData.role as WorkspaceRole;
    } else if (wsData.created_by === authUser.id) {
      resolvedRole = 'admin';
      supabase
        .from('workspace_members')
        .upsert(
          { workspace_id: workspaceId, user_id: authUser.id, role: 'admin' },
          { onConflict: 'workspace_id,user_id' },
        )
        .then(({ error }) => {
          if (error) console.warn('Membership self-heal warning:', error.message);
        });
    }

    if (!resolvedRole) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }

    setRole(resolvedRole);
    setUnauthorized(false);
    setLoading(false);
  }, [workspaceId, redirectToLogin]);

  /* ------------------------- run loader on mount / id change ------------- */
  useEffect(() => {
    setLoading(true);
    setUnauthorized(false);
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  /* ---------------------- live auth-state listener ----------------------- */
  // Catches: token expiry, sign-out in another tab, refresh failure.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        redirectToLogin('expired');
      }
      if (event === 'TOKEN_REFRESHED' && session?.user && !user) {
        setUser(session.user);
        fetchWorkspaceData();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [redirectToLogin, fetchWorkspaceData, user]);

  /* -------------------------- keyboard shortcut (C) ---------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsCreateTaskOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
  };

  /* --------------------------------- gates ------------------------------- */

  if (redirecting) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Session expired — redirecting to login…</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Loading workspace context...</span>
      </div>
    );
  }

  if (!user) {
    // Loader should have already redirected, but cover the edge case.
    redirectToLogin('no-session');
    return null;
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xl">
          <div className="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Access Denied</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You do not have membership in this workspace. Access is restricted by PostgreSQL Row Level Security.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => { setLoading(true); setUnauthorized(false); fetchWorkspaceData(); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-2 text-xs font-medium transition-colors"
            >
              Retry Verification
            </button>
            <button
              onClick={() => setIsSwitcherOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-xs font-medium transition-colors shadow-sm shadow-indigo-600/30"
            >
              Switch Workspace
            </button>
          </div>
        </div>
        <WorkspaceSwitcherModal
          isOpen={isSwitcherOpen}
          onClose={() => setIsSwitcherOpen(false)}
          currentWorkspaceId={workspaceId}
        />
      </div>
    );
  }

  /* ----------------------------------- nav --------------------------------- */

  const basePath = `/workspace/${workspaceId}`;
  const projectMatch = pathname?.match(new RegExp(`/workspace/${workspaceId}/projects/([^/?#]+)`));
  const currentProjectId = projectMatch ? projectMatch[1] : null;
  const currentProject = workspaceProjects.find((p) => p.id === currentProjectId) || null;
  const isProjectContext = Boolean(currentProjectId);

  const projectBasePath = `${basePath}/projects/${currentProjectId}`;

  const projectNavItems = isProjectContext
    ? [
      { label: 'Project Overview', href: projectBasePath, icon: Layers, exact: true },
      { label: 'Tasks & Board', href: `${projectBasePath}?tab=tasks`, icon: CheckSquare },
      { label: 'Teams & Members', href: `${projectBasePath}?tab=teams`, icon: Users },
      { label: 'GitHub Intelligence', href: `${projectBasePath}?tab=github`, icon: GitBranch },
      { label: 'Activity Trail', href: `${projectBasePath}?tab=activity`, icon: Activity },
      { label: 'Project Settings', href: `${projectBasePath}?tab=settings`, icon: Settings },
    ].map((item) => {
      let active = false;
      if (typeof window !== 'undefined') {
        if (item.exact) {
          active = pathname === projectBasePath && (!window.location.search || window.location.search === '');
        } else {
          const tabParam = item.href.split('tab=')[1];
          active = pathname === projectBasePath && window.location.search.includes(`tab=${tabParam}`);
        }
      } else {
        active = item.exact ? pathname === projectBasePath : false;
      }
      return { ...item, active };
    })
    : [];

  const workspaceNavItems = [
    ...(role === 'admin'
      ? [{ label: 'Admin Portal', href: `${basePath}/admin`, icon: ShieldCheck, exact: true }]
      : role === 'lead'
        ? [{ label: 'Team Lead Portal', href: `${basePath}/lead`, icon: Compass, exact: true }]
        : [{ label: 'My Tasks', href: `${basePath}/member`, icon: CheckSquare, exact: true }]),
    { label: 'Tasks (Board & List)', href: `${basePath}/tasks`, icon: CheckSquare },
    { label: 'Incoming Triage', href: `${basePath}/incoming`, icon: Clock },
    { label: 'Projects', href: `${basePath}/projects`, icon: Layers },
    ...(role === 'admin'
      ? [{ label: 'Workspace Members & Roles', href: `${basePath}/admin/team`, icon: Users }]
      : [{ label: 'Team Workload', href: `${basePath}/team`, icon: Users }]),
    ...(role === 'admin'
      ? [
        { label: 'Slack & Integrations', href: `${basePath}/admin/integrations`, icon: MessageSquare },
        { label: 'Claims & Evidence Review', href: `${basePath}/admin/reviews`, icon: FileCheck2 },
      ]
      : []),
    { label: 'Billing & Plans', href: `${basePath}/billing`, icon: CreditCard },
    { label: 'Audit Trail', href: `${basePath}/activity`, icon: Activity },
  ].map((item) => ({
    ...item,
    active: 'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href),
  }));

  const activeNavItems = isProjectContext ? projectNavItems : workspaceNavItems;

  /* ---------------------------------- render ------------------------------- */

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        workspaceName,
        workspaceSlug,
        role,
        user,
        isCreateTaskOpen,
        setIsCreateTaskOpen,
        refreshWorkspace: fetchWorkspaceData,
      }}
    >
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-2 min-w-0">
            {isProjectContext ? (
              <Link href={`${basePath}/projects`} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 truncate">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="font-mono text-indigo-400 font-bold shrink-0">[{currentProject?.identifier || 'PRJ'}]</span>
                <span className="truncate text-zinc-100">{currentProject?.name || 'Project'}</span>
              </Link>
            ) : (
              <Link href={basePath} className="flex items-center gap-2 truncate">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Compass className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-zinc-100 truncate max-w-[140px]">{workspaceName}</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateTaskOpen(true)}
              className="p-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800/80 bg-zinc-950 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          <div className="p-4 space-y-4">
            {isProjectContext ? (
              /* Project Context Sidebar Header */
              <div className="space-y-3">
                <Link
                  href={`${basePath}/projects`}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1 group"
                >
                  <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Workspace / Projects</span>
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 flex items-center justify-between text-left transition-colors group shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-mono text-xs font-bold text-indigo-400 shrink-0">
                        {currentProject?.identifier?.slice(0, 3) || 'PRJ'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-100 truncate">
                          {currentProject?.name || 'Current Project'}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500">
                          {currentProject?.identifier || 'PRJ'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                  </button>

                  {isProjectDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-50 space-y-1 max-h-60 overflow-y-auto">
                      <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-500 font-semibold">
                        Switch Project
                      </div>
                      {workspaceProjects.map((p) => (
                        <Link
                          key={p.id}
                          href={`${basePath}/projects/${p.id}`}
                          onClick={() => setIsProjectDropdownOpen(false)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${p.id === currentProjectId
                            ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                            : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-zinc-400">{p.identifier}</span>
                            <span className="truncate">{p.name}</span>
                          </div>
                          {p.id === currentProjectId && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          )}
                        </Link>
                      ))}
                      <div className="pt-1 border-t border-zinc-800">
                        <Link
                          href={`${basePath}/projects`}
                          onClick={() => setIsProjectDropdownOpen(false)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-950/30 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> All Projects / Create
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Workspace Context Sidebar Header */
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsSwitcherOpen(true)}
                  className="flex items-center gap-2.5 group flex-1 min-w-0"
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col overflow-hidden items-start">
                    <span className="font-bold text-sm text-zinc-100 truncate w-full text-left">{workspaceName}</span>
                    <span className="text-[10px] font-mono text-zinc-500 truncate w-full text-left">slug: {workspaceSlug}</span>
                  </div>
                </button>
                <button
                  onClick={() => setIsSwitcherOpen(true)}
                  title="Switch workspace"
                  className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-900 shrink-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs">
              <span className="text-[11px] text-zinc-400">Your Role</span>
              <span
                className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${role === 'admin'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : role === 'lead'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
              >
                {role === 'admin' && <ShieldCheck className="h-3 w-3" />}
                {role === 'lead' && <Compass className="h-3 w-3" />}
                {role === 'member' && <Users className="h-3 w-3" />}
                {role}
              </span>
            </div>

            <button
              onClick={() => { setIsCreateTaskOpen(true); setMobileMenuOpen(false); }}
              className="w-full inline-flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm shadow-indigo-600/30 group"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Task
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-indigo-700/60 text-[10px] font-mono text-indigo-200">
                C
              </kbd>
            </button>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            <div className="px-3 py-1 text-[10px] font-mono uppercase text-zinc-500 font-semibold">
              {isProjectContext ? 'Project Navigation' : 'Workspace Navigation'}
            </div>
            {activeNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${item.active
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${item.active ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80">
            <div className="p-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 flex items-center justify-between gap-2">
              <Link
                href={`${basePath}/profile`}
                className="flex items-center gap-2 overflow-hidden hover:opacity-80 transition-opacity min-w-0 flex-1"
                title="View your profile"
              >
                <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    user?.email?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {user?.user_metadata?.full_name || user?.email || 'Authenticated User'}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate font-mono">
                    {user?.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : 'GitHub Auth'}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <ThemeToggle />
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">{children}</div>

        <CreateTaskModal
          workspaceId={workspaceId}
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          onTaskCreated={fetchWorkspaceData}
        />

        <WorkspaceSwitcherModal
          isOpen={isSwitcherOpen}
          onClose={() => setIsSwitcherOpen(false)}
          currentWorkspaceId={workspaceId}
        />
      </div>
    </WorkspaceContext.Provider>
  );
}

/* ============================ Workspace Switcher =========================== */

function WorkspaceSwitcherModal({
  isOpen,
  onClose,
  currentWorkspaceId,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspaceId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'list' | 'create' | 'join'>('list');
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [code, setCode] = useState('');
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

  /* ------------------------- load user's workspaces ------------------------ */

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setLoading(false); setError('Not authenticated.'); }
        return;
      }

      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces:workspaces(id, name, slug)')
        .eq('user_id', user.id);

      const { data: createdRows } = await supabase
        .from('workspaces')
        .select('id, name, slug')
        .eq('created_by', user.id);

      const merged = new Map<string, WorkspaceItem>();

      for (const row of memberRows ?? []) {
        const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
        if (!ws) continue;
        merged.set(ws.id, {
          workspace_id: ws.id,
          role: row.role as WorkspaceRole,
          name: ws.name,
          slug: ws.slug,
        });
      }
      for (const ws of createdRows ?? []) {
        if (!merged.has(ws.id)) {
          merged.set(ws.id, { workspace_id: ws.id, role: 'admin', name: ws.name, slug: ws.slug });
        }
      }

      if (!cancelled) {
        setItems(Array.from(merged.values()));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen]);

  /* --------------------------- name → slug helper -------------------------- */

  const onNameChange = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
  };

  /* ------------------------------ create / join ---------------------------- */

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true); setError(null);
    const { data, error } = await createClient().rpc('create_workspace_with_admin', {
      p_name: name.trim(),
      p_slug: slug.trim(),
    });
    setSubmitting(false);
    if (error) {
      if (error.message.includes('WORKSPACE_LIMIT_EXCEEDED')) {
        setIsUpgradeOpen(true);
      }
      return setError(error.message);
    }
    const ws = data as { id: string; role: WorkspaceRole };
    onClose();
    router.push(workspaceHome(ws.id, ws.role));
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true); setError(null);
    const { data, error } = await createClient().rpc('join_workspace_with_invite', {
      p_code: code.trim(),
    });
    setSubmitting(false);
    if (error) return setError(error.message);
    const ws = data as { workspace_id: string; role: WorkspaceRole };
    onClose();
    router.push(workspaceHome(ws.workspace_id, ws.role));
  };

  /* --------------------------------- render -------------------------------- */

  if (!isOpen) return null;

  const roleBadge = (r: WorkspaceRole) =>
    r === 'admin'
      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
      : r === 'lead'
        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
        : 'bg-zinc-800 text-zinc-400';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Building className="h-4 w-4 text-indigo-400" /> Workspaces
          </h2>
          <button onClick={onClose} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 p-1 m-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium">
          {(['list', 'create', 'join'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 ${tab === t ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              {t === 'list' && <><Building className="h-3.5 w-3.5" /> Mine</>}
              {t === 'create' && <><Plus className="h-3.5 w-3.5" /> Create</>}
              {t === 'join' && <><KeyRound className="h-3.5 w-3.5" /> Join</>}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-3 mb-3 p-2.5 rounded-lg border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
          {tab === 'list' && (
            loading ? (
              <div className="py-8 flex items-center justify-center text-zinc-500 gap-2 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                You don&apos;t belong to any workspace yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => {
                  const isCurrent = item.workspace_id === currentWorkspaceId;
                  return (
                    <button
                      key={item.workspace_id}
                      disabled={isCurrent}
                      onClick={() => { onClose(); router.push(workspaceHome(item.workspace_id, item.role)); }}
                      className={`w-full p-3 rounded-lg border flex items-center justify-between text-left transition-colors ${isCurrent
                        ? 'border-indigo-500/40 bg-indigo-500/5 cursor-default'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100 truncate">{item.name}</span>
                          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold ${roleBadge(item.role)}`}>
                            {item.role}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-indigo-400 font-mono">current</span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">slug: {item.slug}</p>
                      </div>
                      {!isCurrent && <ArrowRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )
          )}

          {tab === 'create' && (
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Workspace Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Acme Engineering"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Slug</label>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="acme-engineering"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-indigo-400 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <>Create Workspace</>}
              </button>
            </form>
          )}

          {tab === 'join' && (
            <form onSubmit={join} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Invitation Code</label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="INV-A94E-8B12"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 tracking-wider"
                />
                <p className="text-[11px] text-zinc-500">Ask a workspace Administrator for a code.</p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Joining...</> : <>Join Workspace</>}
              </button>
            </form>
          )}
        </div>
      </div>

      <PricingUpgradeDialog
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        limitType="workspace"
      />
    </div>
  );
}