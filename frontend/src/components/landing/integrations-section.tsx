'use client';

import React from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  GitBranch,
  Check,
  GitCommit,
  GitPullRequest,
  ArrowRight,
} from 'lucide-react';

export function IntegrationsSection() {
  return (
    <section id="integrations" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto w-full space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#5E9E2E] flex items-center gap-1.5 font-semibold">
            <Check className="h-3.5 w-3.5" /> SCOPED COORDINATION &amp; EVIDENCE INTEGRATIONS
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#23170E] leading-[1.05]">
            Where conversation meets engineering evidence
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[#5E4E3E] max-w-sm leading-relaxed">
          Slack captures human coordination and blocker context; GitHub provides verifiable repository artifacts.
          Neither is treated as an unverified source of truth alone.
        </p>
      </div>

      {/* Side-by-Side Slack & GitHub Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* SLACK INTEGRATION PANEL */}
        <div className="rounded-3xl bg-[#F2EFE9] border border-[#E2DACB] p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs">
          <div className="space-y-5">
            {/* Top Badge & Title */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white border border-[#DFD7C8] flex items-center justify-center text-[#DC6E26] shadow-2xs">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-3xl text-[#23170E] leading-none">Slack Integration</h3>
                  <span className="text-[11px] font-mono text-[#6E5E4F]">Team Coordination &amp; Progress Claims</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#ECF6E3] border border-[#C5E3AC] text-[#2B5910] font-mono text-[10px] font-semibold">
                Phase 2 Live &bull; Available to Connect
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#5E4E3E] leading-relaxed">
              Slack serves as the team&apos;s conversational interface—capturing task intake, progress updates, and
              blocker escalations from authorized channels while enforcing workspace permissions and deterministic
              routing rules.
            </p>

            {/* Capability Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                'Authorized project channels only (slack_installations)',
                'HMAC-SHA256 request verification (verify-signature.ts)',
                'Natural-language task & claim parser (parser.ts)',
                'Deterministic Routing Rules A–G (routing.ts)',
                '24h stale-task follow-up sweeps (followup.ts)',
                'Idempotent event deduplication (integration_events)',
              ].map((item) => (
                <div
                  key={item}
                  className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E6DFD1] flex items-start gap-2 text-[#23170E]"
                >
                  <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-snug">{item}</span>
                </div>
              ))}
            </div>

            {/* Realistic Slack Conversation -> Resulting Task Update Preview */}
            <div className="rounded-2xl bg-white border border-[#E3DAC8] p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#7D6E5D] border-b border-[#F0EAE0] pb-2">
                <span className="font-semibold text-[#23170E]">SLACK THREAD PREVIEW &bull; #eng-core</span>
                <span className="text-[#3D751B]">HMAC Verified ✓</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE3D5]">
                  <div className="flex justify-between font-mono text-[10px] text-[#7D6E5D]">
                    <span className="font-semibold text-[#23170E]">@ananya (Member)</span>
                    <span>Reply to 24h Follow-up Sweep</span>
                  </div>
                  <p className="font-mono text-[11px] text-[#23170E] mt-1">
                    &ldquo;API-44 is blocked on sandbox webhook keys from @TeamLead. Reproduction steps logged.&rdquo;
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FBECE1]/70 border border-[#F3CEB3] flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] text-[#9A410D]">
                    <strong>Resulting State Update:</strong> <code className="font-bold">API-44</code> &rarr;{' '}
                    <span className="underline">status: blocked</span> (Reason persisted + Lead notified)
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white text-[#9A410D] shrink-0 font-semibold">
                    Rule G
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E2D9C8] flex items-center justify-between text-[11px] font-mono text-[#6E5E4F]">
            <span>Route: /workspace/[id]/admin/integrations</span>
            <Link
              href="/login"
              className="text-[#DC6E26] hover:text-[#23170E] font-semibold inline-flex items-center gap-1"
            >
              Configure Slack <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* GITHUB INTEGRATION PANEL */}
        <div className="rounded-3xl bg-[#F2EFE9] border border-[#E2DACB] p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs">
          <div className="space-y-5">
            {/* Top Badge & Title */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white border border-[#DFD7C8] flex items-center justify-center text-[#23170E] shadow-2xs">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-3xl text-[#23170E] leading-none">GitHub Integration</h3>
                  <span className="text-[11px] font-mono text-[#6E5E4F]">Verifiable Engineering Evidence</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#FBECE1] border border-[#F3CEB3] text-[#9A410D] font-mono text-[10px] font-semibold">
                Repo Linking Live &bull; Phase 3 Evidence Schema
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#5E4E3E] leading-relaxed">
              GitHub provides objective engineering artifacts—commits, pull requests, file diffs, and author
              associations—used to corroborate reported completion claims without equating commit volume to human worth.
            </p>

            {/* Capability Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                'GitHub OAuth workspace identity (/login)',
                'Project repository linking (project_repositories)',
                'Phase 3 installations & repo schema (github_repositories)',
                'Contributor identity mapping (github_user_mappings)',
                'Normalized commit & PR artifacts (evidence_artifacts)',
                'Claim-to-artifact associations & diff cross-check',
              ].map((item) => (
                <div
                  key={item}
                  className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E6DFD1] flex items-start gap-2 text-[#23170E]"
                >
                  <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-snug">{item}</span>
                </div>
              ))}
            </div>

            {/* Realistic Repository Metadata, Commits, PRs & Author Match Preview */}
            <div className="rounded-2xl bg-white border border-[#E3DAC8] p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#7D6E5D] border-b border-[#F0EAE0] pb-2">
                <span className="font-semibold text-[#23170E]">LINKED REPOSITORY &bull; kaunteya/core-api</span>
                <span className="text-[#2B5910]">Author Mapped ✓</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE3D5] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitCommit className="h-4 w-4 text-[#DC6E26] shrink-0" />
                    <div className="truncate">
                      <span className="text-[#C05617] font-semibold">85c8893</span>{' '}
                      <span className="text-[#23170E]">fix(auth): validate OAuth state token</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#ECF6E3] text-[#2B5910] shrink-0">
                    @kabir-dev
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EAE3D5] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitPullRequest className="h-4 w-4 text-[#5E9E2E] shrink-0" />
                    <div className="truncate">
                      <span className="text-[#2B5910] font-semibold">PR #42</span>{' '}
                      <span className="text-[#23170E]">CORE-14 OAuth callback hardening (+84/-19)</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#ECF6E3] text-[#2B5910] shrink-0">
                    Corroborated
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E2D9C8] flex items-center justify-between text-[11px] font-mono text-[#6E5E4F]">
            <span>Route: /workspace/[id]/projects</span>
            <Link
              href="/login"
              className="text-[#DC6E26] hover:text-[#23170E] font-semibold inline-flex items-center gap-1"
            >
              Link Repository <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
