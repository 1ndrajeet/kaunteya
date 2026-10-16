'use client';

import React, { useEffect, useState, use } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { WorkspaceContext } from '@/features/workspace/workspace-context';
import { CreateTaskModal } from '@/features/tasks/create-task-modal';
import type { User } from '@supabase/supabase-js';
import type { WorkspaceRole } from '@/types/database';

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('Loading...');
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState<boolean>(false);

  const fetchWorkspaceData = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    setUser(session.user);

    // Fetch user's role in this workspace
    const { data: memberData, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .single();

    if (memberError || !memberData) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }

    setRole(memberData.role as WorkspaceRole);

    // Fetch workspace details
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', workspaceId)
      .single();

    if (wsData) {
      setWorkspaceName(wsData.name);
      setWorkspaceSlug(wsData.slug);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [workspaceId]);

  // Keyboard shortcut: Press 'C' to open new task modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsCreateTaskOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Loading workspace context...</span>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
          <div className="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Access Denied</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You do not have membership in this workspace. Access is restricted by PostgreSQL Row Level Security.
          </p>
          <div className="pt-2">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-xs font-medium transition-colors"
            >
              Go to Your Workspaces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Base URL for current workspace
  const basePath = `/workspace/${workspaceId}`;

  // Role-specific nav links
  const navItems = [
    {
      label: 'Tasks (Board & List)',
      href: `${basePath}/tasks`,
      icon: CheckSquare,
      active: pathname.startsWith(`${basePath}/tasks`),
    },
    {
      label: 'Incoming Triage',
      href: `${basePath}/incoming`,
      icon: Clock,
      active: pathname.startsWith(`${basePath}/incoming`),
    },
    {
      label: 'Projects',
      href: `${basePath}/projects`,
      icon: Layers,
      active: pathname.startsWith(`${basePath}/projects`),
    },
    // Role-specific links
    ...(role === 'admin'
      ? [
          {
            label: 'Admin Portal',
            href: `${basePath}/admin`,
            icon: ShieldCheck,
            active: pathname === `${basePath}/admin`,
          },
          {
            label: 'Team Governance',
            href: `${basePath}/admin/team`,
            icon: Users,
            active: pathname.startsWith(`${basePath}/admin/team`),
          },
        ]
      : []),
    ...(role === 'lead'
      ? [
          {
            label: 'Team Lead Portal',
            href: `${basePath}/lead`,
            icon: Compass,
            active: pathname === `${basePath}/lead`,
          },
          {
            label: 'Team Workload',
            href: `${basePath}/team`,
            icon: Users,
            active: pathname.startsWith(`${basePath}/team`),
          },
        ]
      : []),
    ...(role === 'member'
      ? [
          {
            label: 'My Tasks',
            href: `${basePath}/member`,
            icon: CheckSquare,
            active: pathname === `${basePath}/member`,
          },
          {
            label: 'My Profile & GitHub',
            href: `${basePath}/profile`,
            icon: UserIcon,
            active: pathname.startsWith(`${basePath}/profile`),
          },
        ]
      : []),
    {
      label: 'Audit Trail',
      href: `${basePath}/activity`,
      icon: Activity,
      active: pathname.startsWith(`${basePath}/activity`),
    },
  ];

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
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
          <Link href={basePath} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm text-zinc-100 truncate max-w-[140px]">{workspaceName}</span>
          </Link>
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

        {/* Sidebar Container */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800/80 bg-zinc-950 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Top of Sidebar: Brand & Workspace Switcher */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Link href={basePath} className="flex items-center gap-2.5 group">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                  <Compass className="h-4 w-4" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-sm text-zinc-100 truncate">{workspaceName}</span>
                  <span className="text-[10px] font-mono text-zinc-500 truncate">slug: {workspaceSlug}</span>
                </div>
              </Link>
              <Link
                href="/onboarding"
                title="Switch or create workspace"
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-900"
              >
                <ChevronDown className="h-4 w-4" />
              </Link>
            </div>

            {/* Current Role Badge */}
            <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs">
              <span className="text-[11px] text-zinc-400">Your Role</span>
              <span
                className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                  role === 'admin'
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

            {/* Quick Action: New Task */}
            <button
              onClick={() => {
                setIsCreateTaskOpen(true);
                setMobileMenuOpen(false);
              }}
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

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    item.active
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

          {/* Sidebar Footer: User Profile & Logout */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80">
            <div className="p-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 flex items-center justify-between">
              <Link
                href={`${basePath}/profile`}
                className="flex items-center gap-2 overflow-hidden hover:opacity-80 transition-opacity"
                title="View your profile"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    user?.email?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {user?.user_metadata?.full_name || user?.email || 'Authenticated User'}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate font-mono">
                    {user?.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : 'GitHub Auth'}
                  </p>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </div>

        {/* Global Task Creation Modal */}
        <CreateTaskModal
          workspaceId={workspaceId}
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          onTaskCreated={() => {
            // Can trigger workspace refresh
            fetchWorkspaceData();
          }}
        />
      </div>
    </WorkspaceContext.Provider>
  );
}
