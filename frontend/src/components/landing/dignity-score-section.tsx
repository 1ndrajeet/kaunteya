'use client';

import React, { useState } from 'react';
import { Scale, Check } from 'lucide-react';

const DIGNITY_SCENARIOS = [
  {
    id: '01',
    title: 'Corroborated Feature Delivery',
    subtitle: 'Slack completion claim backed by verified commit SHA, PR diff, and author match.',
    badge: 'SCENARIO 01 • CORE-14',
    cardTitle: 'Supported by Engineering Evidence',
    cardCode: "work_claims.status = 'supported'",
    takeaway:
      'Claim, identity mapping, and repository diff align. Prepared for Designated Lead sign-off with zero self-approval.',
    rows: [
      {
        label: 'Reported Contribution (#eng-core)',
        value: '@kabir: "Finished CORE-14 OAuth state verification and pushed fix."',
        status: 'Captured',
      },
      {
        label: 'Supporting GitHub Evidence',
        value: 'Commit 85c8893 + PR #42 (+84/-19 lines in src/lib/auth/state.ts)',
        status: '2 Artifacts',
      },
      {
        label: 'Identity & Policy Verification',
        value: 'Slack U078K2M ↔ GitHub @kabir-dev in authorized repo kaunteya/core-api',
        status: 'Rule G Passed',
      },
      {
        label: 'Review & Contestability Gate',
        value: 'Routed to Designated Lead (self-approval blocked by chk_claim_no_self_approval)',
        status: 'Supported',
      },
    ],
  },
  {
    id: '02',
    title: 'Contextual Blocker (Zero Commits)',
    subtitle: 'Contributor debugged an upstream sandbox outage and escalated a blocker—zero commits pushed.',
    badge: 'SCENARIO 02 • API-44',
    cardTitle: 'Context Preserved • Blocker Escalated',
    cardCode: 'chk_tasks_blocked_reason_consistency',
    takeaway:
      'Commit-counting tools score this day as "zero output." TaskPilot preserves the debugging context and tags who must unblock it.',
    rows: [
      {
        label: 'Reported Contribution (#eng-payments)',
        value: '@ananya: "Webhook 401 traced to expired sandbox keys. Waiting on @TeamLead."',
        status: 'Blocker Thread',
      },
      {
        label: 'Supporting GitHub Evidence',
        value: '0 commits pushed (expected during upstream credential block)',
        status: 'Context Logged',
      },
      {
        label: 'Identity & Policy Verification',
        value: 'Mandatory blocked_reason validated; dependency assigned to @TeamLead',
        status: 'Blocker Rule',
      },
      {
        label: 'Review & Contestability Gate',
        value: 'Contributor protected from low-commit penalty; Lead action queued',
        status: 'Escalated',
      },
    ],
  },
  {
    id: '03',
    title: 'Missing Repo Evidence → Human Review',
    subtitle: 'Completion claimed in Slack, but no matching commit or PR was found in the linked repo.',
    badge: 'SCENARIO 03 • DOC-09',
    cardTitle: 'Needs Clarification • Human Review',
    cardCode: "work_claims.status = 'needs_clarification'",
    takeaway:
      'Missing evidence is never proof of misconduct. TaskPilot flags the gap transparently and asks a human to clarify.',
    rows: [
      {
        label: 'Reported Contribution (#eng-core)',
        value: '@rohan: "Wrapped up DOC-09 security architecture runbook update."',
        status: 'Claimed Done',
      },
      {
        label: 'Supporting GitHub Evidence',
        value: '0 matching commits or PRs found in linked repo kaunteya/docs-portal',
        status: 'Unverified',
      },
      {
        label: 'Identity & Policy Verification',
        value: 'Uncertainty policy triggered: cannot auto-close without corroborating artifact',
        status: 'Clarify',
      },
      {
        label: 'Review & Contestability Gate',
        value: 'Contributor can link external doc/branch or Lead can approve non-code work',
        status: 'Human Gate',
      },
    ],
  },
];

export function DignityScoreSection() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const active = DIGNITY_SCENARIOS[activeIdx];

  return (
    <section id="dignity-score" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Selector Column (Heilth Interactive List Style) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#5E9E2E] flex items-center gap-1.5 font-semibold">
              <Scale className="h-3.5 w-3.5" /> SIGNATURE USP &bull; THE DIGNITY SCORE
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#23170E] leading-[1.05]">
              Measure contributions without reducing people to numbers.
            </h2>
            <p className="text-xs sm:text-sm text-[#5E4E3E] leading-relaxed">
              The Dignity Score evaluates engineering contributions using verifiable evidence and Slack context—never
              arbitrary AI percentages or raw commit counts.
            </p>
          </div>

          {/* 3 Interactive Scenario Rows */}
          <div
            className="divide-y divide-[#E5DEC9] border-y border-[#E5DEC9]"
            role="tablist"
            aria-label="Dignity Score evaluation scenarios"
          >
            {DIGNITY_SCENARIOS.map((item, idx) => {
              const isSelected = idx === activeIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveIdx(idx)}
                  className="w-full text-left py-3.5 flex items-center justify-between group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full transition-colors ${
                        isSelected ? 'bg-[#DC6E26]' : 'bg-transparent group-hover:bg-[#D2C4B0]'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        isSelected
                          ? 'text-[#23170E] font-semibold'
                          : 'text-[#7D6E5D] group-hover:text-[#23170E]'
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#93826F]">{item.id}</span>
                </button>
              );
            })}
          </div>

          {/* 3 Concise Dignity Guarantees */}
          <div className="space-y-2 pt-1 text-xs text-[#5E4E3E]">
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0" />
              <span>Missing evidence triggers human clarification—never automated punishment.</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0" />
              <span>AI assists with interpretation; deterministic rules govern state changes.</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#5E9E2E] shrink-0" />
              <span>No invented numerical weights; grounded in Phase 3 work_claims schema.</span>
            </div>
          </div>
        </div>

        {/* Right Botanical Backdrop + Floating Frosted Evaluation Dossier Card */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-[#2B421C] via-[#3A5A25] to-[#1E3112] shadow-xl relative overflow-hidden min-h-[400px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(132,204,22,0.18),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(220,110,38,0.15),transparent_50%)] pointer-events-none" />

            {/* Floating Ivory Card */}
            <div className="relative z-10 w-full max-w-xl rounded-2xl bg-[#FAF7F2]/95 backdrop-blur-md border border-white/60 p-6 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DEC9] pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#DC6E26] font-semibold">
                    {active.badge} &bull; ILLUSTRATIVE EVALUATION VIEW
                  </span>
                  <h3 className="font-serif text-2xl text-[#23170E] mt-0.5">{active.cardTitle}</h3>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#EFECE6] text-[#59493A] border border-[#DFD7C8]">
                  {active.cardCode}
                </span>
              </div>

              <div className="space-y-2.5">
                {active.rows.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white border border-[#EAE3D5] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-[10px] font-mono text-[#7D6E5D] uppercase">{r.label}</div>
                      <div className="text-xs font-medium text-[#23170E] mt-0.5">{r.value}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#ECF6E3] text-[#2B5910] shrink-0 font-semibold">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-1">
            <p className="text-xs text-[#5E4E3E] leading-relaxed">
              <strong className="text-[#23170E]">{active.title}:</strong> {active.takeaway}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
