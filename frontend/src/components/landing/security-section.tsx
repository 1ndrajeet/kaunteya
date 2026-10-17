'use client';

import React from 'react';
import {
  MessageSquare,
  GitBranch,
  ShieldCheck,
  KeyRound,
  Scale,
  Check,
  Lock,
} from 'lucide-react';

export function SecuritySection() {
  return (
    <section id="security" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto w-full space-y-16">
      <div id="integrations" className="space-y-10">
        {/* Clean Editorial Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#5E9E2E] font-semibold">
            <Lock className="h-3.5 w-3.5" /> SCOPED INTEGRATIONS &amp; TRUST BOUNDARIES
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#23170E] leading-[1.05]">
            An agent should be powerful. Its permissions should be precise.
          </h2>
          <p className="text-xs sm:text-sm text-[#5E4E3E] leading-relaxed max-w-xl mx-auto">
            Slack captures team coordination; GitHub provides repository evidence; PostgreSQL Row-Level Security and
            deterministic rules govern every state transition.
          </p>
        </div>

        {/* 2 Clean Side-by-Side Integration Cards (Slack & GitHub) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Slack Card */}
          <div className="rounded-2xl bg-[#F2EFE9] border border-[#E5DEC9] p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-[#DFD7C8] flex items-center justify-center text-[#DC6E26]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl text-[#23170E] leading-none">Slack Coordination</h3>
                  <span className="text-[11px] font-mono text-[#6E5E4F]">Authorized Channels Only</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#ECF6E3] text-[#2B5910] font-mono text-[10px] font-semibold">
                Phase 2 Live
              </span>
            </div>

            <ul className="space-y-2 text-xs text-[#3F3124]">
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                <span>HMAC-SHA256 webhook verification (<code className="font-mono">verify-signature.ts</code>) &amp; event deduplication.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                <span>Deterministic Routing Rules A–G route unassigned claims to the Designated Lead.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                <span>Automated 24h stale-task follow-up sweeps sync thread replies back to tasks.</span>
              </li>
            </ul>
          </div>

          {/* GitHub Card */}
          <div className="rounded-2xl bg-[#F2EFE9] border border-[#E5DEC9] p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-[#DFD7C8] flex items-center justify-center text-[#23170E]">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl text-[#23170E] leading-none">GitHub Evidence</h3>
                  <span className="text-[11px] font-mono text-[#6E5E4F]">Linked Project Repositories</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#FBECE1] text-[#9A410D] font-mono text-[10px] font-semibold">
                Repo Linking + Phase 3
              </span>
            </div>

            <ul className="space-y-2 text-xs text-[#3F3124]">
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                <span>GitHub OAuth login &amp; scoped repository linking (<code className="font-mono">project_repositories</code>).</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                <span>Cross-checks commit SHAs, PR diffs, and contributor identity mappings.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                <span>Treats commits as supporting evidence—never as a standalone measure of worth.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 3 Concise Security & Privacy Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] p-5 space-y-2">
            <div className="flex items-center justify-between">
              <ShieldCheck className="h-5 w-5 text-[#DC6E26]" />
              <span className="text-[10px] font-mono text-[#2B5910] font-semibold">POSTGRES RLS</span>
            </div>
            <h4 className="font-serif text-xl text-[#23170E]">Least-Privilege Isolation</h4>
            <p className="text-xs text-[#5E4E3E] leading-relaxed">
              Non-recursive RLS policies (<code className="font-mono">is_workspace_member</code>) and a partial unique
              index (<code className="font-mono">idx_one_lead_per_workspace</code>) enforce strict workspace hierarchy.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] p-5 space-y-2">
            <div className="flex items-center justify-between">
              <KeyRound className="h-5 w-5 text-[#5E9E2E]" />
              <span className="text-[10px] font-mono text-[#2B5910] font-semibold">SERVER-ONLY SECRETS</span>
            </div>
            <h4 className="font-serif text-xl text-[#23170E]">Protected Credentials</h4>
            <p className="text-xs text-[#5E4E3E] leading-relaxed">
              Integration tokens live in dedicated secret tables (<code className="font-mono">slack_installation_secrets</code>)
              with RLS blocking all browser reads.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] p-5 space-y-2">
            <div className="flex items-center justify-between">
              <Scale className="h-5 w-5 text-[#824B23]" />
              <span className="text-[10px] font-mono text-[#2B5910] font-semibold">HUMAN OVERSIGHT</span>
            </div>
            <h4 className="font-serif text-xl text-[#23170E]">No Self-Approval</h4>
            <p className="text-xs text-[#5E4E3E] leading-relaxed">
              Database constraint <code className="font-mono">chk_claim_no_self_approval</code> prevents self-approval
              and logs every review in append-only <code className="font-mono">activity_events</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
