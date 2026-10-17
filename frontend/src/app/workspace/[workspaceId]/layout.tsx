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
  Activity,
  Menu,
  X,
  User as UserIcon,
  ChevronDown,
  Loader2,
  AlertCircle,
  MessageSquare,
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
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center text-[#59493A] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[#DC6E26]" />
        <span className="text-xs font-mono">Loading workspace context...</span>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-3xl border border-[#E2DACB] bg-[#F2EFE9] space-y-4 shadow-lg">
          <div className="h-12 w-12 rounded-2xl bg-[#FCECE9] text-[#B33624] flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-2xl text-[#23170E]">Access Denied</h2>
          <p className="text-xs text-[#6E5E4F] leading-relaxed">
            You do not have membership in this workspace. Access is restricted by PostgreSQL Row Level Security.
          </p>
          <div className="pt-2">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white px-5 py-2 text-xs font-semibold transition-colors"
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
          {
            label: 'Slack & Integrations',
            href: `${basePath}/admin/integrations`,
            icon: MessageSquare,
            active: pathname.startsWith(`${basePath}/admin/integrations`),
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
      <div className="min-h-screen bg-[#FAF7F2] text-[#23170E] flex flex-col md:flex-row antialiased border-t-4 border-[#854D27]">
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-[#E3DAC8] bg-[#F2EFE8]/90 backdrop-blur-md sticky top-0 z-40">
          <Link href={basePath} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#5E9E2E] flex items-center justify-center text-white">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-serif text-lg text-[#23170E] truncate max-w-[140px]">{workspaceName}</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateTaskOpen(true)}
              className="p-1.5 rounded-full bg-[#DC6E26] text-white text-xs font-medium"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-[#59493A] hover:text-[#23170E] hover:bg-[#E4DBC9]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Sidebar Container */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#E3DAC8] bg-[#F2EFE8] flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Top of Sidebar: Brand & Workspace Switcher */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Link href={basePath} className="flex items-center gap-2.5 group overflow-hidden">
                <div className="h-8 w-8 rounded-lg bg-[#FAF7F2] border border-[#DDD4C2] flex items-center justify-center text-[#5E9E2E] shadow-2xs group-hover:bg-[#5E9E2E] group-hover:text-white transition-colors shrink-0">
                  <Compass className="h-4 w-4" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-serif text-lg leading-tight text-[#23170E] truncate">{workspaceName}</span>
                  <span className="text-[10px] font-mono text-[#7D6E5D] truncate">slug: {workspaceSlug}</span>
                </div>
              </Link>
              <Link
                href="/onboarding"
                title="Switch or create workspace"
                className="p-1.5 text-[#7D6E5D] hover:text-[#23170E] rounded-lg hover:bg-[#E6DECFE6]"
              >
                <ChevronDown className="h-4 w-4" />
              </Link>
            </div>

            {/* Current Role Badge */}
            <div className="p-2.5 rounded-xl border border-[#E2D9C6] bg-[#FAF7F2] flex items-center justify-between text-xs shadow-2xs">
              <span className="text-[11px] text-[#6E5E4F] font-medium">Your Role</span>
              <span
                className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  role === 'admin'
                    ? 'bg-[#FBECE1] text-[#9A410D] border border-[#F3D5BE]'
                    : role === 'lead'
                    ? 'bg-[#F5ECE4] text-[#592F11] border border-[#E6D3C3]'
                    : 'bg-[#ECF6E3] text-[#2B5910] border border-[#D4E9C1]'
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
              className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white text-xs font-semibold transition-colors shadow-xs group"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Task
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-[#B85418] text-[10px] font-mono text-white/90">
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
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    item.active
                      ? 'bg-[#FAF7F2] text-[#23170E] font-semibold border border-[#E2D9C6] shadow-2xs'
                      : 'text-[#59493A] hover:text-[#23170E] hover:bg-[#EAE3D5]/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${item.active ? 'text-[#DC6E26]' : 'text-[#7D6E5D]'}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer: User Profile & Logout */}
          <div className="p-3 border-t border-[#E3DAC8] bg-[#EFEBE2]">
            <div className="p-2 rounded-xl border border-[#E2D9C6] bg-[#FAF7F2] flex items-center justify-between">
              <Link
                href={`${basePath}/profile`}
                className="flex items-center gap-2 overflow-hidden hover:opacity-80 transition-opacity"
                title="View your profile"
              >
                <div className="h-7 w-7 rounded-full bg-[#5E9E2E] flex items-center justify-center text-xs font-bold text-white shrink-0">
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
                  <p className="text-xs font-semibold text-[#23170E] truncate">
                    {user?.user_metadata?.full_name || user?.email || 'Authenticated User'}
                  </p>
                  <p className="text-[10px] text-[#7D6E5D] truncate font-mono">
                    {user?.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : 'GitHub Auth'}
                  </p>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-lg text-[#7D6E5D] hover:text-[#B33624] hover:bg-[#FCECE9] transition-colors"
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
            className="fixed inset-0 z-40 bg-[#23170E]/40 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#FAF7F2]">
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
