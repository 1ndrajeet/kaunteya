'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';

const WORKFLOW_STAGES = [
  {
    code: '01 CAPTURE',
    layer: 'Slack Webhook',
    summary: 'Receives HMAC-verified mentions & thread replies from authorized project channels (/api/slack/events).',
  },
  {
    code: '02 UNDERSTAND',
    layer: 'AI + Parser',
    summary: 'Extracts task references (e.g. CORE-14), completion claims, and blocker signals from natural language.',
  },
  {
    code: '03 VALIDATE',
    layer: 'Deterministic Rules',
    summary: 'Enforces Routing Rules A–G, workspace role permissions, and mandatory blocker reasons before state updates.',
  },
  {
    code: '04 VERIFY',
    layer: 'GitHub Lookup',
    summary: 'Checks linked project repositories for corroborating commits, pull requests, diffs, and author mappings.',
  },
  {
    code: '05 EVALUATE',
    layer: 'Dignity Score View',
    summary: 'Organizes claims and evidence into transparent states (supported, partially_supported, needs_clarification).',
  },
  {
    code: '06 REVIEW',
    layer: 'Human Oversight',
    summary: 'Escalates ambiguity to the Designated Lead and blocks self-approval via chk_claim_no_self_approval.',
  },
  {
    code: '07 RECORD',
    layer: 'Audit Ledger',
    summary: 'Persists an append-only JSONB record in activity_events traceable to the source evidence and reviewer.',
  },
];

export function WorkflowSection() {
  const [activeIdx, setActiveIdx] = useState<number>(3);
  const active = WORKFLOW_STAGES[activeIdx];

  return (
    <section id="workflow" className="bg-[#EFECE6] py-20 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto text-center space-y-4">
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#5E9E2E] flex items-center justify-center gap-1.5 font-semibold">
          <Check className="h-3.5 w-3.5" /> END-TO-END WORKFLOW
        </div>
        <h2 className="font-serif text-4xl sm:text-6xl text-[#23170E] leading-[1.05]">
          Human-to-agent bridge
        </h2>
        <p className="text-xs sm:text-sm text-[#5E4E3E] max-w-lg mx-auto leading-relaxed">
          AI assists with language interpretation; deterministic rules and human review govern every consequential
          project outcome.
        </p>

        {/* 3-Column Bridge Architecture (Heilth Signature Layout) */}
        <div className="pt-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-6">
          {/* Left Node: Slack */}
          <div className="lg:col-span-3 relative flex justify-center">
            <div className="w-48 h-36 rounded-2xl bg-[#E4DDD1] border border-[#D5CBB9] flex flex-col items-center justify-center p-4 relative shadow-xs">
              <span className="font-serif text-lg text-[#23170E]">Slack &amp; Team</span>
              <span className="text-[11px] text-[#6E5E4F] mt-0.5">Authorized Channels</span>
              <span className="absolute -top-3 -left-3 px-2.5 py-1 rounded-md bg-[#3D2516] text-white text-[10px] font-mono shadow-xs">
                @TaskPilot
              </span>
              <span className="absolute top-6 -right-4 px-2 py-0.5 rounded-md bg-[#5E9E2E] text-white text-[10px] font-mono shadow-xs">
                Threads
              </span>
              <span className="absolute -bottom-3 left-3 px-2.5 py-1 rounded-md bg-[#DC6E26] text-white text-[10px] font-mono shadow-xs">
                HMAC Verified
              </span>
            </div>
          </div>

          {/* Center Triad Container */}
          <div className="lg:col-span-6">
            <div className="p-3 rounded-3xl bg-[#F7F4EE] border border-[#E2DACB] shadow-sm grid grid-cols-3 gap-2.5">
              <div className="bg-white rounded-2xl p-5 border border-[#EAE3D5] text-center space-y-1.5 shadow-2xs">
                <div className="text-[10px] font-mono text-[#DC6E26] font-semibold">AI LAYER</div>
                <div className="font-serif text-xl text-[#23170E]">Interpret</div>
                <p className="text-[10px] text-[#6E5E4F] leading-snug">
                  Extracts task claims, context &amp; blockers
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-[#EAE3D5] text-center space-y-1.5 shadow-2xs">
                <div className="text-[10px] font-mono text-[#5E9E2E] font-semibold">DETERMINISTIC</div>
                <div className="font-serif text-xl text-[#23170E]">Verify</div>
                <p className="text-[10px] text-[#6E5E4F] leading-snug">
                  Rules A–G, permissions &amp; GitHub commits
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-[#EAE3D5] text-center space-y-1.5 shadow-2xs">
                <div className="text-[10px] font-mono text-[#824B23] font-semibold">HUMAN GATE</div>
                <div className="font-serif text-xl text-[#23170E]">Review</div>
                <p className="text-[10px] text-[#6E5E4F] leading-snug">
                  Dignity Score &amp; Lead sign-off
                </p>
              </div>
            </div>
          </div>

          {/* Right Node: Verified State */}
          <div className="lg:col-span-3 relative flex justify-center">
            <div className="w-48 h-36 rounded-2xl bg-[#E4DDD1] border border-[#D5CBB9] flex flex-col items-center justify-center p-4 relative shadow-xs">
              <span className="font-serif text-lg text-[#23170E]">Auditable State</span>
              <span className="text-[11px] text-[#6E5E4F] mt-0.5">Supabase + GitHub</span>
              <span className="absolute -top-3 right-2 px-2.5 py-1 rounded-md bg-[#DC6E26] text-white text-[10px] font-mono shadow-xs">
                Commit SHA
              </span>
              <span className="absolute top-8 -left-4 px-2.5 py-0.5 rounded-md bg-[#3D2516] text-white text-[10px] font-mono shadow-xs">
                RLS Active
              </span>
              <span className="absolute -bottom-3 right-3 px-2.5 py-1 rounded-md bg-[#5E9E2E] text-white text-[10px] font-mono shadow-xs">
                Audit Logged
              </span>
            </div>
          </div>
        </div>

        {/* Sleek 7-Stage Interactive Pill Bar */}
        <div className="pt-8 max-w-4xl mx-auto space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {WORKFLOW_STAGES.map((stage, idx) => {
              const isSelected = idx === activeIdx;
              return (
                <button
                  key={stage.code}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#23170E] text-white shadow-xs'
                      : 'bg-[#FAF7F2] text-[#59493A] border border-[#DDD5C7] hover:border-[#23170E]'
                  }`}
                >
                  {stage.code}
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#DFD6C5] flex flex-col sm:flex-row items-center justify-between gap-3 text-left max-w-2xl mx-auto">
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-[#C05617] font-semibold">
                {active.code} &bull; {active.layer}
              </div>
              <p className="text-xs text-[#23170E]">{active.summary}</p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#ECF6E3] text-[#2B5910] shrink-0 font-semibold">
              Traceable
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
