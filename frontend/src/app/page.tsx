'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  Users,
  GitPullRequest,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30">
      {/* Configuration Alert Banner if Supabase keys not set */}
      {!configured && (
        <div className="bg-amber-950/40 border-b border-amber-900/60 px-4 py-2.5 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>Supabase credentials required:</strong> Configure{' '}
                <code className="bg-amber-900/40 px-1 py-0.5 rounded font-mono text-amber-300">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                and key in <code className="font-mono">.env.local</code> to activate live authentication.
              </span>
            </div>
            <Link
              href="/login"
              className="underline hover:text-white font-medium shrink-0 flex items-center gap-1"
            >
              Setup Guide <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-base text-zinc-100 flex items-center gap-1.5">
                TaskPilot
                <span className="text-[10px] font-medium tracking-normal px-1.5 py-0.2 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                  v1.0
                </span>
              </span>
              <span className="text-[11px] text-zinc-500 font-mono -mt-0.5">Contribution Intelligence</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#features" className="hover:text-zinc-100 transition-colors">
              Features
            </a>
            <a href="#roles" className="hover:text-zinc-100 transition-colors">
              Role Hierarchy
            </a>
            <a href="#workflow" className="hover:text-zinc-100 transition-colors">
              Workflow
            </a>
            <a href="#roadmap" className="hover:text-zinc-100 transition-colors">
              Phase Roadmap
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm shadow-indigo-500/20"
              >
                Go to Workspace <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-zinc-300 hover:text-white px-3 py-1.5 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-medium text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Phase 1 Live: Workspace Governance & Core Project Management</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-100 leading-[1.1]">
              Work moves in conversations.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">
                TaskPilot turns it into verified execution.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              A high-precision coordination and contribution intelligence platform connecting administrators, team
              leads, members, and autonomous agents with clear ownership and auditable accountability.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 text-sm font-medium shadow-lg shadow-indigo-600/25 transition-all hover:translate-y-[-1px]"
              >
                <span>Get started with GitHub</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 px-6 py-3 text-sm font-medium transition-colors"
              >
                Explore how it works
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> PostgreSQL RLS Enforced
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 1-Lead Workspace Governance
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Audit Trail Persistence
              </span>
            </div>
          </div>

          {/* Interactive UI Mockup Preview */}
          <div className="mt-14 max-w-5xl mx-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-2 sm:p-3 shadow-2xl backdrop-blur-xl">
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-inner">
              {/* Window Header */}
              <div className="h-10 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-zinc-700/60" />
                  <div className="h-3 w-3 rounded-full bg-zinc-700/60" />
                  <div className="h-3 w-3 rounded-full bg-zinc-700/60" />
                  <span className="ml-3 text-xs font-mono text-zinc-400">taskpilot.app/workspace/eng-core/tasks</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px]">
                    Admin & Lead View
                  </span>
                </div>
              </div>

              {/* Mock Dashboard Body */}
              <div className="grid grid-cols-1 md:grid-cols-4 min-h-[380px] divide-y md:divide-y-0 md:divide-x divide-zinc-800/80">
                {/* Column 1: Incoming / Unassigned Triage */}
                <div className="p-4 space-y-3 bg-zinc-950/60">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Incoming Triage
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">2</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg border border-amber-900/40 bg-zinc-900/90 hover:border-amber-700/60 transition-colors shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span>WEB-108</span>
                        <span className="text-rose-400 font-medium">Urgent</span>
                      </div>
                      <p className="text-xs font-medium text-zinc-200 mt-1">Implement GitHub OAuth callback error redirect</p>
                      <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">Unassigned</span>
                        <span className="text-indigo-400 font-medium cursor-pointer hover:underline">Assign Lead &rarr;</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span>API-44</span>
                        <span className="text-amber-400">High</span>
                      </div>
                      <p className="text-xs font-medium text-zinc-300 mt-1">Audit RLS recursive query edge cases</p>
                      <div className="mt-2 text-[10px] text-zinc-500">Awaiting Lead Priority</div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Todo */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Todo</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">3</span>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>WEB-102</span>
                      <span className="text-zinc-400">Medium</span>
                    </div>
                    <p className="text-xs font-medium text-zinc-200">Design Linear-style Kanban board view</p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>Lead: Alex M.</span>
                      <span className="text-emerald-400">Oct 20</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: In Progress */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">In Progress</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">2</span>
                  </div>
                  <div className="p-3 rounded-lg border border-indigo-900/40 bg-zinc-900/90 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300">
                      <span>SEC-12</span>
                      <span className="text-rose-400">Urgent</span>
                    </div>
                    <p className="text-xs font-medium text-zinc-200">Enforce single-lead database constraint</p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1 text-zinc-300">Member: Sophia K.</span>
                      <span className="px-1.5 py-0.2 bg-zinc-800 rounded font-mono">SQL</span>
                    </div>
                  </div>
                </div>

                {/* Column 4: Done */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Done</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">4</span>
                  </div>
                  <div className="p-3 rounded-lg border border-emerald-950/60 bg-zinc-900/40 opacity-80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span className="line-through">CORE-01</span>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </div>
                    <p className="text-xs text-zinc-400 line-through">Establish Supabase Auth & Migrations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Hierarchy Section */}
      <section id="roles" className="py-20 border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Explicit Governance</h2>
            <p className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
              Three distinct roles. Zero permission confusion.
            </p>
            <p className="text-sm text-zinc-400">
              TaskPilot rejects arbitrary role escalation. Workspace authorization is enforced at both the PostgreSQL
              Row-Level Security layer and within the client interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Administrator</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Workspace owner responsible for team configuration, governance, and integrations.
                </p>
              </div>
              <ul className="text-xs text-zinc-300 space-y-2 pt-2 border-t border-zinc-800/80">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Designate exactly one Team Lead for the workspace</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Manage member invitations, roles, and project creations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Access immutable activity audit trail & workspace metrics</span>
                </li>
              </ul>
            </div>

            {/* Team Lead */}
            <div className="rounded-xl border border-indigo-900/40 bg-zinc-900/70 p-6 space-y-4 hover:border-indigo-700/60 transition-colors relative shadow-lg shadow-indigo-950/20">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-zinc-100">Team Lead</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    1 per Workspace
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Directs daily delivery, triages the unassigned incoming queue, and unblocks work.
                </p>
              </div>
              <ul className="text-xs text-zinc-300 space-y-2 pt-2 border-t border-zinc-800/80">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <span>Triage unassigned tasks arriving from Slack, UI, or agents</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <span>Assign work to eligible members or themselves</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <span>Monitor team workload, deadlines, and blocked tasks</span>
                </li>
              </ul>
            </div>

            {/* Member */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Member</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Focused on execution, updating assigned progress, and adding context.
                </p>
              </div>
              <ul className="text-xs text-zinc-300 space-y-2 pt-2 border-t border-zinc-800/80">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Focused &ldquo;My Tasks&rdquo; view filtered to active commitments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Update status, progress descriptions, and task comments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Link GitHub username and project repository URLs</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-20 border-t border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">The Core Lifecycle</h2>
            <p className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
              From conversational intake to verified execution
            </p>
            <p className="text-sm text-zinc-400">
              No tasks fall through the cracks between Slack channels, dashboard lists, and GitHub repositories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="text-xs font-mono text-indigo-400 font-semibold">01 / INTAKE</div>
              <h4 className="text-sm font-semibold text-zinc-200">Task Creation</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tasks arrive via the web dashboard, conversational Slack trigger, or an autonomous agent.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="text-xs font-mono text-amber-400 font-semibold">02 / ROUTE & TRIAGE</div>
              <h4 className="text-sm font-semibold text-zinc-200">Lead Assignment</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Unassigned or ambiguous tasks flow to the designated Team Lead for human inspection and explicit assignment.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="text-xs font-mono text-emerald-400 font-semibold">03 / EXECUTION</div>
              <h4 className="text-sm font-semibold text-zinc-200">Member Progress</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Assigned members update statuses, attach discussion notes, and link commits to their active task item.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="text-xs font-mono text-violet-400 font-semibold">04 / VERIFICATION</div>
              <h4 className="text-sm font-semibold text-zinc-200">Evidence Audit</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Planned Phase 3 &amp; 4 layers corroborate claims against real GitHub PRs and auditable review decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section id="features" className="py-20 border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Dual Kanban &amp; Table Views</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Switch seamlessly between an agile Kanban board and a compact, filterable task table. Both views reflect
                the exact same PostgreSQL state in real time.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Incoming Task Inbox</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A dedicated triage inbox for unassigned work. Team leads can evaluate priority, project alignment, and
                assign ownership in a single click.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Zero-Trust Row Level Security</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Permissions are secured at the database layer. Members cannot promote themselves, read other workspaces,
                or reassign tasks beyond their authority.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">GitHub Repository Linkage</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Attach repository URLs directly to projects and link member GitHub usernames, laying the foundation for
                Phase 3 automated PR and commit verification.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Slack Ready Architecture</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Data structures include dedicated external source fields, designed for seamless bidirectional messaging
                in Phase 2 without database restructuring.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <Terminal className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">Immutable Audit Trail</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Every task creation, status transition, assignment change, and member invitation is recorded in an
                append-only activity log for complete team transparency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Roadmap Section */}
      <section id="roadmap" className="py-20 border-t border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Honest Roadmap</h2>
            <p className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">Built in Four Structured Phases</p>
            <p className="text-sm text-zinc-400">
              We do not fabricate future capabilities. Here is the exact delivery plan:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-xl border border-emerald-500/40 bg-zinc-900/70 relative">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                PHASE 1 &bull; LIVE NOW
              </span>
              <h4 className="text-sm font-semibold text-zinc-100 mt-3">Foundation &amp; Core PM</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                GitHub OAuth, workspace onboarding, 1-lead governance, project and task CRUD, Kanban &amp; table views,
                and PostgreSQL RLS.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 opacity-70">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                PHASE 2 &bull; UPCOMING
              </span>
              <h4 className="text-sm font-semibold text-zinc-300 mt-3">Slack Coordination</h4>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Slack app connection, conversational task intake, status updates from threads, and assignment
                notifications.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 opacity-70">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                PHASE 3 &bull; PLANNED
              </span>
              <h4 className="text-sm font-semibold text-zinc-300 mt-3">Routing Agent &amp; Evidence</h4>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Automated intelligent task routing, GitHub PR/commit correlation, and human review queues for claims.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 opacity-70">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                PHASE 4 &bull; PLANNED
              </span>
              <h4 className="text-sm font-semibold text-zinc-300 mt-3">Contribution Intelligence</h4>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Contribution reliability scoring, dispute and clarification workflows, and team delivery analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-zinc-800/60 bg-gradient-to-b from-transparent to-indigo-950/20">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">
            Ready to experience structured, verifiable teamwork?
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            Create your workspace in seconds with your GitHub account, designate your team lead, and manage projects with
            complete confidence.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-7 py-3 text-sm font-medium shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              Get started with GitHub <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-10 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-indigo-400" />
            <span className="text-zinc-300 font-medium">TaskPilot Platform</span>
            <span>&bull; Phase 1 Implementation</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Sign In
            </Link>
            <Link href="/onboarding" className="hover:text-zinc-300 transition-colors">
              Workspace Onboarding
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
