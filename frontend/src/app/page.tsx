'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  Users,
  GitPullRequest,
  GitCommit,
  GitBranch,
  MessageSquare,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Terminal,
  Play,
  RefreshCw,
  Zap,
  Github,
  Slack,
  Check,
  X,
  Menu,
  Bot,
  Filter,
} from '@/components/ui/pica-icons';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Interactive Demo State
  const [demoStep, setDemoStep] = useState<'initial' | 'processing' | 'resolved'>('initial');
  const [activeTab, setActiveTab] = useState<'board' | 'incoming' | 'evidence'>('board');

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

  const handleSimulateAgent = () => {
    if (demoStep === 'processing') return;
    setDemoStep('processing');
    setTimeout(() => {
      setDemoStep('resolved');
    }, 700);
  };

  const handleResetDemo = () => {
    setDemoStep('initial');
  };

  const currentYear = 2026;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] selection:bg-amber-500/20 selection:text-amber-200 antialiased font-sans">
      {/* Background subtle texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      {/* Configuration Alert Banner if Supabase keys not set */}
      {!configured && (
        <div className="relative z-50 bg-amber-950/60 border-b border-amber-900/60 px-4 py-2.5 text-xs text-amber-200 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>Supabase credentials required:</strong> Configure{' '}
                <code className="bg-amber-900/50 px-1 py-0.5 rounded font-mono text-amber-300">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                and anon key in <code className="font-mono">.env.local</code> to activate live authentication.
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

      {/* ========================================================================= */}
      {/* SECTION A: NAVIGATION                                                     */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#09090b]/85 border-b border-zinc-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 flex items-center justify-center shadow-inner group-hover:border-amber-500/50 transition-colors">
              <Compass className="h-5 w-5 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold tracking-tight text-base text-zinc-100 flex items-center gap-1.5">
                TaskPilot
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 hidden sm:inline">
                Agentic Coordination
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-400">
            <a href="#how-it-works" className="hover:text-zinc-100 transition-colors">
              How it works
            </a>
            <a href="#demo" className="hover:text-zinc-100 transition-colors flex items-center gap-1">
              <span>Interactive Demo</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            </a>
            <a href="#features" className="hover:text-zinc-100 transition-colors">
              Modules
            </a>
            <a href="#integrations" className="hover:text-zinc-100 transition-colors">
              Integrations
            </a>
            <a href="#governance" className="hover:text-zinc-100 transition-colors">
              Governance
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2 text-xs font-semibold tracking-wide transition-all shadow-sm shadow-zinc-100/10 hover:shadow-zinc-100/20"
              >
                Go to Workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex text-xs font-medium text-zinc-400 hover:text-zinc-100 px-3 py-1.5 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 text-xs font-bold tracking-wide transition-all shadow-sm shadow-amber-500/20 hover:scale-[1.02]"
                >
                  Open TaskPilot <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur-xl px-4 py-4 space-y-3 text-xs">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              How it works
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Interactive Demo
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Product Modules
            </a>
            <a
              href="#integrations"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Integrations (Slack &amp; GitHub)
            </a>
            <a
              href="#governance"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-zinc-300 hover:text-white"
            >
              Governance &amp; Trust
            </a>
            <div className="pt-3 border-t border-zinc-800/80 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full text-center py-2 rounded-lg border border-zinc-800 text-zinc-300 font-medium hover:bg-zinc-900"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="w-full text-center py-2 rounded-lg bg-amber-500 font-bold text-zinc-950"
              >
                Open TaskPilot
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* SECTION B: HERO — IMMEDIATE VALUE & PRODUCT INTERFACE                     */}
      {/* ========================================================================= */}
      <section className="relative pt-16 sm:pt-24 pb-20 border-b border-zinc-800/70 overflow-hidden">
        {/* Subtle grid accent glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[340px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Editorial Value Proposition */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-[11px] font-mono text-amber-300 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>PROJECT COORDINATION, WITHOUT THE CHASING</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[46px] font-bold tracking-tight text-[#fafaf9] leading-[1.12]">
                Your projects don&apos;t need more updates.{' '}
                <span className="font-serif italic font-normal text-amber-300 underline decoration-amber-500/40 decoration-wavy decoration-1 underline-offset-4">
                  They need fewer blockers.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-normal max-w-xl">
                TaskPilot brings tasks, team communication, and development evidence into one coordinated
                workflow—so your team can see what&apos;s moving, what&apos;s stuck, and what needs attention.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-6 py-3 text-xs tracking-wider uppercase transition-all shadow-lg shadow-amber-500/15 hover:translate-y-[-1px]"
                >
                  <span>Explore TaskPilot</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 font-medium px-5 py-3 text-xs transition-colors"
                >
                  <span>See the workflow</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                </a>
              </div>

              <div className="pt-3 border-t border-zinc-800/60">
                <p className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Built for real projects, real teams, and work that actually needs to ship.</span>
                </p>
              </div>
            </div>

            {/* Right Column: Reconstructed Live Product UI */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-2.5 sm:p-3 shadow-2xl shadow-black/80">
                {/* Window Chrome */}
                <div className="rounded-xl border border-zinc-800/90 bg-[#121215] overflow-hidden">
                  <div className="h-10 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-950/70">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                      <span className="ml-3 font-mono text-[11px] text-zinc-400 truncate">
                        taskpilot.app/workspace/eng-core/tasks
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-400">
                        Project CORE
                      </span>
                    </div>
                  </div>

                  {/* Product Workspace Mockup Content */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Workspace Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono text-xs">
                          C
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xs font-bold text-zinc-200">Core Engine &amp; Platform</h2>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono">Lead: Alex Rivera</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          3 open tasks
                        </span>
                      </div>
                    </div>

                    {/* Task Cards with Surfaced Blocker */}
                    <div className="space-y-2.5">
                      {/* 1. Surfaced Blocked Task */}
                      <div className="p-3.5 rounded-xl border border-amber-600/40 bg-amber-950/20 relative group transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-amber-400 font-bold">CORE-14</span>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                Blocked
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">Priority: High</span>
                            </div>
                            <h3 className="text-xs font-semibold text-zinc-100">
                              Connect payment API &amp; webhook ingestion
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-mono text-zinc-400">Omkar K.</span>
                          </div>
                        </div>

                        {/* Agent Discovered Blocker Callout */}
                        <div className="mt-3 p-2.5 rounded-lg bg-black/50 border border-amber-500/30 text-[11px] space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-400 font-semibold font-mono text-[10px] uppercase">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Surfaced Blocker Dependency</span>
                          </div>
                          <p className="text-zinc-300 text-[11px] leading-relaxed">
                            Implementation code is written, but developer is blocked waiting on test sandbox
                            credentials.
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                            <span>Source: Slack DM reply</span>
                            <span className="text-amber-400 font-medium">Triage Inbox Alert &rarr;</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. In Progress Task with GitHub commit linked */}
                      <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-zinc-400 font-semibold">CORE-15</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              In Progress
                            </span>
                          </div>
                          <h3 className="text-xs font-medium text-zinc-200">
                            Fix OAuth callback error redirect loop
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                            <GitCommit className="h-3 w-3 text-purple-400" />
                            <span>commit 7a8f21e</span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">Sophia M.</span>
                        </div>
                      </div>

                      {/* 3. Verified Complete Task */}
                      <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 opacity-70 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-zinc-500 line-through">CORE-12</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Done
                            </span>
                          </div>
                          <h3 className="text-xs text-zinc-400 line-through">
                            PostgreSQL RLS 1-lead workspace governance constraint
                          </h3>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/60">
                      <span className="flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-amber-400" />
                        <span>TaskPilot Agent active &bull; Monitoring contributor threads</span>
                      </span>
                      <span>Synced 2m ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION C: PROBLEM — THE HIDDEN COORDINATION TAX                           */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 border-b border-zinc-800/70 bg-[#0b0b0e] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-3 mb-14 text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
              The Problem We Solve
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              The task board says green.{' '}
              <span className="font-serif italic font-normal text-zinc-400">The project says otherwise.</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Every software team has experienced this: work gets fragmented across Slack chats, GitHub PRs, and
              unmaintained boards. Real delivery status stays locked in people&apos;s heads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Failure Mode 1 */}
            <div className="p-5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 space-y-3 relative">
              <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-xs font-bold text-zinc-400">
                01
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">Scattered Status in DMs</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Updates happen in Slack direct messages, threads, and standup notes. The task board stays frozen and
                unreflective of real progress.
              </p>
              <div className="pt-2 font-mono text-[10px] text-rose-400/90 border-t border-zinc-900 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span>Result: Invisible context gaps</span>
              </div>
            </div>

            {/* Failure Mode 2 */}
            <div className="p-5 rounded-2xl border border-dashed border-amber-900/40 bg-amber-950/10 space-y-3 relative">
              <div className="h-8 w-8 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center font-mono text-xs font-bold text-amber-400">
                02
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">Blockers Discovered Too Late</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A developer stops because they are waiting on an API key or schema clarification. Nobody notices until
                the sprint deadline slips.
              </p>
              <div className="pt-2 font-mono text-[10px] text-amber-400 border-t border-zinc-900 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Result: Unnecessary delivery delays</span>
              </div>
            </div>

            {/* Failure Mode 3 */}
            <div className="p-5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 space-y-3 relative">
              <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-xs font-bold text-zinc-400">
                03
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">The Constant Chasing Tax</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Project leads spend hours manually pinging contributors: &ldquo;Are you done with this?&rdquo;
                &ldquo;Who owns the deployment bug?&rdquo;
              </p>
              <div className="pt-2 font-mono text-[10px] text-zinc-500 border-t border-zinc-900 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Result: High lead coordination fatigue</span>
              </div>
            </div>

            {/* Failure Mode 4 */}
            <div className="p-5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 space-y-3 relative">
              <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-xs font-bold text-zinc-400">
                04
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">Uncorroborated Completion</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tasks marked &ldquo;Done&rdquo; without any linked PR, commit, or artifact review. Unfinished edge
                cases surface during product integration.
              </p>
              <div className="pt-2 font-mono text-[10px] text-zinc-500 border-t border-zinc-900 flex items-center gap-1">
                <GitPullRequest className="h-3 w-3" />
                <span>Result: False sense of delivery</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION D: HOW IT WORKS — THE 4-STAGE COORDINATION LIFECYCLE              */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-20 sm:py-28 border-b border-zinc-800/70 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
              The Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              From scattered updates to coordinated execution.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              TaskPilot connects project context, contributor communication, and verifiable development evidence into
              one continuous loop.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-amber-400">01 / CONTEXT</div>
                <h3 className="text-base font-semibold text-zinc-100">Understand the Work</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  TaskPilot anchors on canonical project context, persistent task records, priorities, and deadlines
                  enforced in PostgreSQL.
                </p>
              </div>
              <div className="pt-4 border-t border-zinc-900 font-mono text-[10px] text-zinc-500">
                &bull; Scoped to project boundaries
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-amber-400">02 / COORDINATION</div>
                <h3 className="text-base font-semibold text-zinc-100">Prompt Contributors</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Intended agent workflows route incoming tasks to owners, conduct follow-up sweeps, and prompt
                  contributors where they already communicate.
                </p>
              </div>
              <div className="pt-4 border-t border-zinc-900 font-mono text-[10px] text-zinc-500">
                &bull; Slack thread intake &amp; reminders
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 space-y-3 flex flex-col justify-between shadow-lg shadow-amber-950/20">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-amber-400">03 / INTERPRETATION</div>
                <h3 className="text-base font-semibold text-zinc-100">Distinguish Blockers</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Interprets contributor messages: distinguishes partial progress from completion, extracts blocked
                  reasons, and flags dependencies.
                </p>
              </div>
              <div className="pt-4 border-t border-amber-900/40 font-mono text-[10px] text-amber-400 font-semibold">
                &bull; Catches invisible dependencies
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-emerald-400">04 / VERIFICATION</div>
                <h3 className="text-base font-semibold text-zinc-100">Update with Evidence</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Validated changes update the task board. Available GitHub PRs and commits are linked as supporting
                  evidence for human review.
                </p>
              </div>
              <div className="pt-4 border-t border-zinc-900 font-mono text-[10px] text-zinc-500">
                &bull; Traceable immutable audit trail
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION F: SIGNATURE INTERACTION — THE BLOCKED-TASK DEMONSTRATION         */}
      {/* ========================================================================= */}
      <section id="demo" className="py-20 sm:py-28 border-b border-zinc-800/70 bg-[#09090b] relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold flex items-center justify-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              <span>Interactive Demonstration</span>
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              A status update should reveal the blocker, not hide it.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Try this interactive simulation showing how TaskPilot interprets conversational ambiguity and turns it
              into actionable task state.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0f0f13] p-5 sm:p-8 space-y-6 shadow-2xl">
            {/* Interactive Simulation Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left Side: Incoming Message */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="flex items-center gap-1.5">
                    <Slack className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Contributor Response in Slack</span>
                  </span>
                  <span>10:42 AM</span>
                </div>

                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white font-mono">
                      O
                    </div>
                    <span className="text-xs font-semibold text-zinc-200">Omkar Kulkarni</span>
                    <span className="text-[10px] font-mono text-zinc-500">Developer</span>
                  </div>
                  <p className="text-xs text-zinc-200 pl-8 leading-relaxed font-mono">
                    &ldquo;The payment API is connected, but I&apos;m waiting for test credentials.&rdquo;
                  </p>
                </div>

                <div className="text-[11px] text-zinc-400 space-y-1 leading-relaxed">
                  <p className="font-semibold text-zinc-300">The Problem with Traditional Boards:</p>
                  <p className="text-zinc-500">
                    Traditional boards leave this task marked <span className="text-zinc-300">In Progress</span> or{' '}
                    <span className="text-zinc-300">Done</span>. Nobody realizes work is halted until days later.
                  </p>
                </div>

                <div className="pt-2">
                  {demoStep === 'initial' && (
                    <button
                      onClick={handleSimulateAgent}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Process Update with TaskPilot</span>
                    </button>
                  )}

                  {demoStep === 'processing' && (
                    <div className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 flex items-center justify-center gap-2 text-xs font-mono">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Parsing dependencies &amp; application rules...</span>
                    </div>
                  )}

                  {demoStep === 'resolved' && (
                    <button
                      onClick={handleResetDemo}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Reset Interactive Demo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Side: Interpreted Structured Task Record */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-amber-400" />
                    <span>Canonical Task Record (PostgreSQL)</span>
                  </span>
                  <span className="text-[10px] text-zinc-500">CORE-14</span>
                </div>

                {demoStep === 'initial' && (
                  <div className="space-y-3 opacity-90 transition-opacity">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Board Status:</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        In Progress
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Surfaced Blocker:</span>
                      <span className="text-[11px] font-mono text-zinc-500">None detected</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Lead Action:</span>
                      <span className="text-[11px] font-mono text-zinc-500">None required</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-[11px] text-zinc-500 font-mono text-center">
                      Click &ldquo;Process Update&rdquo; to simulate TaskPilot interpretation.
                    </div>
                  </div>
                )}

                {demoStep === 'processing' && (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
                    <RefreshCw className="h-6 w-6 text-amber-400 animate-spin" />
                    <p className="text-xs font-mono text-zinc-400">Correlating task ID with channel message...</p>
                  </div>
                )}

                {demoStep === 'resolved' && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Board Status:</span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Blocked
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/50">
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Extracted Blocker Reason:
                      </span>
                      <p className="text-xs text-zinc-200 font-medium">Test credentials required</p>
                    </div>

                    <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">
                        Next Action Generated:
                      </span>
                      <p className="text-xs text-zinc-300">
                        Request credentials from administrator &amp; resume sandbox testing
                      </p>
                    </div>

                    <div className="pt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      <span>Task state validated &bull; Logged in immutable activity audit trail</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-[10px] font-mono text-zinc-500">
              * Frontend demonstration modeled on TaskPilot&apos;s deterministic intent parser and workspace state
              machine.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION E: FEATURE SHOWCASE — REAL PRODUCT MODULES                        */}
      {/* ========================================================================= */}
      <section id="features" className="py-20 sm:py-28 border-b border-zinc-800/70 bg-[#0b0b0e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
              Comprehensive Platform
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Structured modules. One cohesive workspace.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              TaskPilot isn&apos;t a conceptual prototype. It contains actual, working application surfaces designed
              for software engineering delivery.
            </p>
          </div>

          {/* Asymmetrical Grid of Verified Application Modules */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Task Management (Large Card - Spans 2 cols) */}
            <div className="md:col-span-2 p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-4 hover:border-zinc-700/80 transition-colors">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Layers className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  Dual Kanban &amp; Table
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Persistent Task Management</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Full task records with numeric identifiers (e.g. CORE-14), priorities, assignees, deadlines, and
                  discussion notes. Switch seamlessly between Kanban columns and filterable tabular views without state
                  drift.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-900 text-center font-mono text-[11px]">
                <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/60">
                  <div className="text-zinc-500 text-[10px]">Backlog &rarr; Done</div>
                  <div className="font-bold text-zinc-200 mt-0.5">7 Task States</div>
                </div>
                <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/60">
                  <div className="text-zinc-500 text-[10px]">Urgent &rarr; Low</div>
                  <div className="font-bold text-zinc-200 mt-0.5">4 Priorities</div>
                </div>
                <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/60">
                  <div className="text-zinc-500 text-[10px]">Database Guard</div>
                  <div className="font-bold text-emerald-400 mt-0.5">PostgreSQL RLS</div>
                </div>
              </div>
            </div>

            {/* 2. Incoming Triage Inbox */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-4 hover:border-zinc-700/80 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Incoming Triage Inbox</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  A dedicated inbox for unassigned work arriving from team discussions or intake forms. The Team Lead
                  inspects priority and delegates with a single click.
                </p>
              </div>
              <ul className="text-[11px] text-zinc-400 space-y-1.5 pt-2 border-t border-zinc-900">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-indigo-400" />
                  <span>Prevents orphaned tasks</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-indigo-400" />
                  <span>Enforces lead triage queue</span>
                </li>
              </ul>
            </div>

            {/* 3. Project Workspaces & AI Repository Context */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-4 hover:border-zinc-700/80 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Project Workspaces</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Isolate projects with unique key prefixes (CORE, API, WEB). Connects repository architecture context
                  generated via Gemini Foundation models.
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-900 font-mono text-[10px] text-purple-400">
                &bull; Architecture characteristics &amp; tools
              </div>
            </div>

            {/* 4. GitHub Evidence & Corroboration */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-4 hover:border-zinc-700/80 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Development Evidence</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Tracks GitHub pull requests, commits, and contributor activity. Evidence is used as supporting proof
                  rather than unquestioned truth.
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-900 font-mono text-[10px] text-emerald-400">
                &bull; Pull request &amp; commit linkages
              </div>
            </div>

            {/* 5. Immutable Audit Trail & Billing */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-4 hover:border-zinc-700/80 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Immutable Audit Trail</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Every state transition, member assignment, and configuration modification is preserved in an
                  append-only activity log for complete accountability.
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-900 font-mono text-[10px] text-zinc-500">
                &bull; Traceable team compliance history
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION G: INTEGRATIONS — SLACK, GITHUB, AND TASKPILOT                     */}
      {/* ========================================================================= */}
      <section id="integrations" className="py-20 sm:py-28 border-b border-zinc-800/70 bg-[#09090b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
              Ecosystem
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Your tools stay yours. Your project gets the context.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              TaskPilot operates as a persistent coordination layer connecting conversation, execution, and code.
            </p>
          </div>

          {/* Triangular Integration Architecture Visual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Slack Box */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#4A154B]/20 border border-[#4A154B]/40 flex items-center justify-center text-pink-400">
                  <Slack className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-zinc-100">Slack</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The conversational surface where work is discussed. Handles conversational task intake, follow-up
                  prompts, and member progress replies directly in channel threads.
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-900 font-mono text-[11px] text-zinc-400">
                Role: Conversational Intake &amp; Updates
              </div>
            </div>

            {/* TaskPilot Core Box (Elevated) */}
            <div className="p-6 rounded-2xl border border-amber-500/40 bg-zinc-900/70 space-y-4 flex flex-col justify-between shadow-xl shadow-amber-500/5 relative">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Compass className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-100">TaskPilot Platform</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Core Layer
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  The canonical coordination engine. Resolves workspace identity, validates application permissions,
                  detects dependencies, and persists truth in PostgreSQL.
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-800 font-mono text-[11px] text-amber-400 font-semibold">
                Role: Persistent State &amp; Governance
              </div>
            </div>

            {/* GitHub Box */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Github className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-zinc-100">GitHub</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The development repository. Synchronizes commits, pull requests, and contributor activity to provide
                  verifiable supporting evidence for completed work.
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-900 font-mono text-[11px] text-zinc-400">
                Role: Verifiable Development Evidence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION H: GOVERNANCE & TRUST — USEFUL AUTONOMY, CLEAR CONTROL            */}
      {/* ========================================================================= */}
      <section id="governance" className="py-20 sm:py-28 border-b border-zinc-800/70 bg-[#0b0b0e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
              Integrity by Design
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Useful autonomy. Clear accountability.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              AI coordinates the work. Application rules control the actions. People stay in control of consequential
              decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-200">1-Lead Workspace Governance</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                TaskPilot rejects arbitrary role escalation. Every workspace has exactly one designated Team Lead
                responsible for unassigned triage and direction.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Strict PostgreSQL RLS</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Cross-workspace isolation is enforced at the database layer. Members cannot view or mutate tasks outside
                their authorized workspace.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Human Review for Uncertainty</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                When an update is ambiguous or lacks supporting evidence, TaskPilot routes the decision to the Team Lead
                rather than making unverified guesses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION I: FINAL CTA                                                      */}
      {/* ========================================================================= */}
      <section className="py-24 sm:py-32 relative overflow-hidden bg-[#09090b]">
        <div className="absolute inset-0 bg-radial-gradient from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-40" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-[11px] font-mono text-zinc-400">
            <span>START COORDINATING SMARTER</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#fafaf9] max-w-2xl mx-auto leading-tight">
            Spend less time chasing work.{' '}
            <span className="font-serif italic font-normal text-amber-300">More time moving it forward.</span>
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Bring your projects, tasks, and team coordination into one verified workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href={user ? '/onboarding' : '/login'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-7 py-3.5 text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02]"
            >
              <span>{user ? 'Open Workspace' : 'Open TaskPilot'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 font-medium px-6 py-3.5 text-xs transition-colors"
            >
              Explore how it works
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION J: FOOTER                                                         */}
      {/* ========================================================================= */}
      <footer className="border-t border-zinc-800/80 bg-[#070709] py-12 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <span className="text-zinc-200 font-bold tracking-tight">TaskPilot</span>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                The AI teammate that catches invisible blockers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-400 font-medium">
            <a href="#how-it-works" className="hover:text-zinc-200 transition-colors">
              How it works
            </a>
            <a href="#demo" className="hover:text-zinc-200 transition-colors">
              Interactive Demo
            </a>
            <a href="#features" className="hover:text-zinc-200 transition-colors">
              Modules
            </a>
            <a href="#governance" className="hover:text-zinc-200 transition-colors">
              Governance
            </a>
            <Link href="/login" className="hover:text-zinc-200 transition-colors">
              Sign In
            </Link>
            <Link href="/onboarding" className="hover:text-zinc-200 transition-colors">
              Workspace
            </Link>
          </div>

          <div className="font-mono text-[11px] text-zinc-600">
            &copy; {currentYear} TaskPilot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
