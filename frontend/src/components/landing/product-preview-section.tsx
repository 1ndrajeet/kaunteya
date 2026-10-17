'use client';

import React from 'react';
import Link from 'next/link';
import {
  Check,
  ArrowRight,
  Compass,
  ShieldCheck,
  Users,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface ProductPreviewSectionProps {
  user: User | null;
}

export function ProductPreviewSection({ user }: ProductPreviewSectionProps) {
  return (
    <>
      {/* WORKSPACE GOVERNANCE & MODULES (Heilth Membership Card Style) */}
      <section id="product" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto w-full space-y-16">
        {/* Centered Editorial Philosophy Quote */}
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="h-11 w-11 rounded-2xl bg-[#EFECE6] border border-[#DDD5C7] flex items-center justify-center mx-auto text-[#DC6E26] shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <blockquote className="font-serif text-2xl sm:text-3xl text-[#23170E] leading-[1.25]">
            &ldquo;Contribution should be evaluated using relevant evidence and context—not commit counts alone.
            Uncertainty leads to human review, never automatic punishment.&rdquo;
          </blockquote>
          <div className="text-[11px] font-mono text-[#7D6E5D]">
            TASKPILOT ARCHITECTURE &bull; DIGNITY SCORE PRINCIPLE
          </div>
        </div>

        {/* Governance & Modules Selector (Matching Heilth Membership Card + Checklist) */}
        <div className="space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#5E9E2E] flex items-center justify-center gap-1.5 font-semibold">
              <Check className="h-3.5 w-3.5" /> COMPLETE WORKSPACE PLATFORM
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#23170E]">
              Structured workspace governance
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Warm Terracotta Card */}
            <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-[#C85A17] via-[#9E420E] to-[#5E2406] text-white p-7 flex flex-col justify-between shadow-lg">
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/75">
                  ROLE HIERARCHY
                </span>
                <h3 className="font-serif text-3xl text-white leading-tight">
                  TaskPilot
                  <br />
                  Workspace
                </h3>
                <p className="text-xs text-white/80 pt-1 leading-relaxed">
                  Multi-role web portal for Administrators, the Designated Team Lead, and Members.
                </p>
              </div>

              <div className="pt-8 space-y-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-white/70">Database Enforced</div>
                  <div className="font-serif text-3xl text-white">
                    3 Roles <span className="text-xs font-sans font-normal text-white/75">/ 1 Lead max</span>
                  </div>
                </div>
                <Link
                  href={user ? '/onboarding' : '/login'}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#23170E] hover:bg-[#FAF7F2] px-4 py-2.5 text-xs font-semibold transition-colors shadow-sm"
                >
                  {user ? 'Open Workspace' : 'Provision Workspace'} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Modules & Role Capabilities Box */}
            <div className="lg:col-span-8 rounded-2xl bg-[#F2EFE9] border border-[#E5DEC9] p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-2xl text-[#23170E]">Included workspace routes &amp; modules:</h4>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-[#ECF6E3] text-[#2B5910] font-semibold">
                    Live in Repo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#3F3124]">
                  {[
                    'Kanban & List Task Board (/tasks)',
                    'Unassigned Slack Triage Inbox (/incoming)',
                    'Projects & Repo Linking (/projects)',
                    'Single-Lead & Admin Portals (/lead, /admin)',
                    '24h Automated Slack Follow-up Sweeps',
                    'Append-Only Activity Audit Ledger (/activity)',
                  ].map((mod, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE3D5]"
                    >
                      <span className="h-4 w-4 rounded bg-[#DC6E26] text-white flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{mod}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Role Pills Breakdown */}
              <div className="pt-4 border-t border-[#E2D9C8] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white border border-[#EAE3D5]">
                  <div className="font-semibold text-[#23170E] flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#DC6E26]" /> Administrator
                  </div>
                  <p className="text-[11px] text-[#6E5E4F] mt-1">
                    Manages invites, Slack/GitHub integrations &amp; designates the Lead.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#EAE3D5]">
                  <div className="font-semibold text-[#23170E] flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-[#824B23]" /> Team Lead (1 Max)
                  </div>
                  <p className="text-[11px] text-[#6E5E4F] mt-1">
                    Triages incoming tasks, resolves blockers &amp; reviews claims.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#EAE3D5]">
                  <div className="font-semibold text-[#23170E] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#5E9E2E]" /> Member
                  </div>
                  <p className="text-[11px] text-[#6E5E4F] mt-1">
                    Executes assigned tasks, updates Slack &amp; links commits.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PIXEL-DITHERED TRANSITION BAND */}
      <div className="heilth-dither-band mt-4" />

      {/* FINAL CTA & GIANT WATERMARK FOOTER */}
      <footer className="bg-[#EFECE6] pt-20 pb-8 px-4 sm:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          {/* Left Floating Lime Sticky Note */}
          <div className="hidden md:block absolute -left-6 top-2 w-44 p-3.5 bg-[#D9F99D] text-[#26380F] rounded-xs shadow-md -rotate-6 border border-[#BEF264] text-left">
            <p className="font-mono text-[10px] leading-snug font-medium">
              &ldquo;Missing evidence prompts human review—never automated penalty.&rdquo;
            </p>
            <span className="block mt-2 text-[9px] font-mono text-[#3F5A1A]">✓ DIGNITY FIRST</span>
          </div>

          {/* Right Floating Coral Sticky Note */}
          <div className="hidden md:block absolute -right-4 top-8 w-44 p-3.5 bg-[#F8A99F] text-[#3D1510] rounded-xs shadow-md rotate-6 border border-[#F39185] text-left">
            <p className="font-mono text-[10px] leading-snug font-medium">
              &ldquo;1-Lead governance enforced at the PostgreSQL index layer.&rdquo;
            </p>
            <span className="block mt-2 text-[9px] font-mono text-[#5C1D16]">★ AUDIT READY</span>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-widest text-[#C86420]">
            ✦ EVIDENCE-BACKED PROJECT COORDINATION
          </div>

          <h2 className="font-serif text-4xl sm:text-6xl text-[#23170E] leading-[1.04] max-w-2xl mx-auto">
            Make project progress visible. Make contribution understandable.
          </h2>

          <p className="text-xs sm:text-sm text-[#6E5E4F] max-w-md mx-auto leading-relaxed">
            Sign in with GitHub, provision your workspace as Administrator, and connect your Slack channel in minutes.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href={user ? '/onboarding' : '/login'}
              className="inline-flex items-center gap-2 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white px-6 py-2.5 text-xs font-semibold shadow-sm transition-all"
            >
              {user ? 'Open Workspace' : 'Get Started'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="#agent-demo"
              className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-[#FAF7F2] border border-[#DDD5C7] text-[#23170E] px-6 py-2.5 text-xs font-semibold transition-colors"
            >
              Explore the workflow
            </a>
          </div>

          {/* Footer Links Row */}
          <div className="pt-14 pb-6 border-t border-[#E2DACB] mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E5E4F]">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#5E9E2E]" />
              <span className="font-semibold text-[#23170E]">TaskPilot Platform</span>
              <span>&bull; Contribution Intelligence</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5">
              <a href="#workflow" className="hover:text-[#23170E] transition-colors">
                How It Works
              </a>
              <a href="#dignity-score" className="hover:text-[#23170E] transition-colors">
                Dignity Score
              </a>
              <a href="#agent-demo" className="hover:text-[#23170E] transition-colors">
                Agent Demo
              </a>
              <Link href="/login" className="hover:text-[#23170E] transition-colors">
                Sign In
              </Link>
              <Link
                href="/onboarding"
                className="hover:text-[#23170E] transition-colors inline-flex items-center gap-1"
              >
                Workspace <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Giant Subtle Editorial Serif Watermark at Very Bottom */}
        <div className="select-none pointer-events-none text-center overflow-hidden -mb-10 pt-2">
          <span className="font-serif text-[7rem] sm:text-[11rem] md:text-[14rem] leading-none text-[#E2DBD0] tracking-tight block">
            TaskPilot
          </span>
        </div>
      </footer>
    </>
  );
}
