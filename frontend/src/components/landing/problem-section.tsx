'use client';

import React from 'react';
import { Check } from 'lucide-react';

export function ProblemSection() {
  return (
    <section className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full space-y-20">
      {/* Split Editorial Callout with Center Schematic Illustration */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6">
          <div className="md:col-span-5 text-left md:text-right self-start pt-4">
            <h2 className="font-serif text-4xl sm:text-5xl text-[#281A11] leading-[1.06]">
              Activity is visible.
              <br />
              Contribution is
            </h2>
          </div>

          {/* Center Schematic Diagram */}
          <div className="md:col-span-3 flex justify-center py-2">
            <div className="relative p-3">
              <svg
                className="h-44 w-36 text-[#3F3124]"
                viewBox="0 0 160 200"
                fill="none"
                role="img"
                aria-label="Schematic diagram connecting human contributor and verification agent"
              >
                <circle cx="50" cy="34" r="14" stroke="currentColor" strokeWidth="1.3" />
                <path
                  d="M26 115V70C26 58 36 52 50 52C64 52 74 58 74 70V115"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path d="M35 115V180M65 115V180" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="112" cy="34" r="14" stroke="currentColor" strokeWidth="1.3" />
                <path
                  d="M88 115V70C88 58 98 52 112 52C126 52 136 58 136 70V115"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path d="M97 115V180M127 115V180" stroke="currentColor" strokeWidth="1.3" />
                <rect
                  x="38"
                  y="64"
                  width="24"
                  height="20"
                  rx="3"
                  fill="#DC6E26"
                  fillOpacity="0.22"
                  stroke="#DC6E26"
                  strokeWidth="1.3"
                />
                <rect
                  x="100"
                  y="64"
                  width="24"
                  height="20"
                  rx="3"
                  fill="#5E9E2E"
                  fillOpacity="0.22"
                  stroke="#5E9E2E"
                  strokeWidth="1.3"
                />
                <path d="M62 74H100" stroke="#DC6E26" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            </div>
          </div>

          <div className="md:col-span-4 text-left self-end pb-4">
            <h2 className="font-serif text-4xl sm:text-5xl text-[#281A11] leading-[1.06]">
              harder to
              <br />
              understand.
            </h2>
          </div>
        </div>
      </div>

      {/* 4 Clean Warm Stone Visual Cards (Heilth Editorial Grid) */}
      <div>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#5E9E2E] flex items-center gap-1.5 font-semibold">
              <Check className="h-3.5 w-3.5" /> BEYOND RAW COMMIT COUNTS
            </div>
            <h3 className="font-serif text-4xl sm:text-5xl text-[#23170E] leading-[1.05]">
              Contextual contribution
              <br />
              intelligence
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#6E5E4F] max-w-xs leading-relaxed">
            Raw activity metrics punish debugging and coordination. TaskPilot connects claims to real engineering
            context.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Realtime Blocker Context */}
          <div className="rounded-2xl bg-[#F2EFE9] border border-[#E5DECFE6] p-5 flex flex-col justify-between min-h-[300px] hover:border-[#D2C4B0] transition-colors">
            <div className="font-serif text-xl text-[#23170E] leading-tight">
              Blocker Context
              <br />
              Preservation
            </div>

            <div className="my-5 flex items-center justify-center relative py-2">
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono px-2.5 py-1.5 rounded bg-white border border-[#E3DAC8]">
                  <span className="text-[#23170E] font-semibold">API-44 Webhook</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#FCECE9] text-[#B33624]">Blocked</span>
                </div>
                <div className="pl-3.5 border-l-2 border-dashed border-[#DC6E26] space-y-1.5">
                  <div className="text-[10px] font-mono px-2 py-1 rounded bg-[#FBECE1] text-[#9A410D]">
                    ↳ Waiting on sandbox keys
                  </div>
                  <div className="text-[10px] font-mono px-2 py-1 rounded bg-[#ECF6E3] text-[#2B5910]">
                    ↳ Action Owner: @TeamLead
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#6E5E4F] leading-relaxed">
              Protects contributors when upstream blockers stall commits, escalating the dependency to the Lead.
            </p>
          </div>

          {/* Card 2: Commit & PR Evidence */}
          <div className="rounded-2xl bg-[#F2EFE9] border border-[#E5DECFE6] p-5 flex flex-col justify-between min-h-[300px] hover:border-[#D2C4B0] transition-colors">
            <div className="font-serif text-xl text-[#23170E] leading-tight">
              Verifiable GitHub
              <br />
              Evidence
            </div>

            <div className="my-5 relative pt-6 pb-1">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-white border border-[#E3DAC8] shadow-xs text-[10px] font-mono text-[#23170E]">
                SHA <strong className="text-[#DC6E26]">85c8893</strong>
              </div>
              <div className="h-24 flex items-end justify-between gap-1.5 px-2">
                {[38, 52, 44, 65, 92, 85, 72, 96, 68, 55].map((h, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${h}%` }}
                    className={`flex-1 rounded-t-sm transition-all ${
                      idx >= 4 && idx <= 7
                        ? 'bg-gradient-to-t from-[#DC6E26] to-[#F09A59]'
                        : 'bg-[#DFD8CA]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="text-[11px] text-[#6E5E4F] leading-relaxed">
              Cross-checks Slack completion claims against linked repository commits, PR diffs, and author identity.
            </p>
          </div>

          {/* Card 3: 24h Follow-up Sweeps */}
          <div className="rounded-2xl bg-[#F2EFE9] border border-[#E5DECFE6] p-5 flex flex-col justify-between min-h-[300px] hover:border-[#D2C4B0] transition-colors">
            <div className="font-serif text-xl text-[#23170E] leading-tight">
              Automated 24h
              <br />
              Follow-ups
            </div>

            <div className="my-5 py-3 space-y-2">
              <div className="flex items-center gap-1 h-16">
                <div className="h-8 flex-1 bg-[#7A5234] rounded-xs" />
                <div className="h-12 flex-1 bg-[#DC6E26] rounded-xs" />
                <div className="h-6 flex-1 bg-[#D8CFC0] rounded-xs" />
                <div className="h-14 flex-1 bg-[#5E9E2E] rounded-xs" />
                <div className="h-10 flex-1 bg-[#7A5234] rounded-xs" />
                <div className="h-16 flex-1 bg-[#DC6E26] rounded-xs" />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-[#7D6E5D] pt-1 border-t border-[#E2D9C8]">
                <span>24H SWEEP</span>
                <span>THREAD REPLY</span>
                <span>SYNCED</span>
              </div>
            </div>

            <p className="text-[11px] text-[#6E5E4F] leading-relaxed">
              Replaces manual status chasing by prompting stale tasks in Slack and syncing replies to the board.
            </p>
          </div>

          {/* Card 4: Human Review & Contestability */}
          <div className="rounded-2xl bg-[#F2EFE9] border border-[#E5DECFE6] p-5 flex flex-col justify-between min-h-[300px] hover:border-[#D2C4B0] transition-colors">
            <div className="font-serif text-xl text-[#23170E] leading-tight">
              Human-Reviewed
              <br />
              Uncertainty
            </div>

            <div className="my-5 space-y-2">
              <div className="p-2.5 rounded-lg bg-white border border-[#E3DAC8] text-[11px] space-y-1">
                <div className="flex justify-between font-mono text-[9px] text-[#7D6E5D]">
                  <span>DOC-09 &bull; NO COMMIT</span>
                  <span className="text-[#C87D12] font-semibold">CLARIFY</span>
                </div>
                <div className="font-medium text-[#23170E] truncate">Routed to Designated Lead</div>
              </div>
              <div className="p-2 rounded-lg bg-white/70 border border-[#E3DAC8] text-[11px] flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#59493A]">Self-Approval</span>
                <span className="px-2 py-0.5 rounded bg-[#5E9E2E] text-white text-[9px] font-mono">
                  Blocked by DB
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#6E5E4F] leading-relaxed">
              Missing evidence is never treated as misconduct—it routes to the Lead for human clarification.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
