'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface HeroSectionProps {
  user: User | null;
}

export function HeroSection({ user }: HeroSectionProps) {
  return (
    <section className="relative pt-14 pb-20 px-4 sm:px-8">
      {/* Clean Centered Editorial Header */}
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#C86420]">
          <span className="h-2 w-2 rounded-full bg-[#DC6E26]" />
          <span>SLACK &rarr; TASKPILOT AGENT &rarr; GITHUB EVIDENCE &rarr; DIGNITY SCORE</span>
        </div>

        <h1 className="font-serif text-5xl sm:text-7xl text-[#281A11] leading-[1.03] tracking-tight">
          Every contribution deserves evidence.
        </h1>

        <p className="text-sm sm:text-base text-[#5E4E3E] max-w-xl mx-auto leading-relaxed">
          TaskPilot connects Slack updates, project tasks, verifiable GitHub commits, and human oversight into one
          explainable workflow—powered by the{' '}
          <a
            href="#dignity-score"
            className="underline decoration-[#DC6E26] decoration-2 underline-offset-4 text-[#23170E] font-medium"
          >
            Dignity Score
          </a>
          .
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href={user ? '/onboarding' : '/login'}
            className="inline-flex items-center gap-2 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white px-6 py-2.5 text-xs sm:text-sm font-semibold shadow-sm transition-all"
          >
            <span>{user ? 'Open Workspace' : 'Get started'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <a
            href="#dignity-score"
            className="inline-flex items-center gap-2 rounded-full bg-[#EFECE6] hover:bg-[#E5E0D5] border border-[#DDD5C7] text-[#281A11] px-6 py-2.5 text-xs sm:text-sm font-semibold transition-colors"
          >
            Explore Dignity Score
          </a>
        </div>
      </div>

      {/* TACTILE TERRACOTTA DOSSIER FOLDER (Clean & Airy Heilth Hero Centerpiece) */}
      <div className="mt-14 max-w-3xl mx-auto relative">
        <div className="relative rounded-[22px] bg-[#629E2B] p-2 sm:p-3 shadow-[0_24px_60px_rgba(44,28,16,0.18)] border-2 border-[#538822]">
          {/* Protruding Right Folder Tab */}
          <div className="hidden sm:flex absolute -right-7 top-24 h-28 w-8 rounded-r-xl bg-[#629E2B] border-y-2 border-r-2 border-[#538822] items-center justify-center shadow-md">
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/95 [writing-mode:vertical-rl] rotate-180 font-semibold">
              LIVE RECORD
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 rounded-[16px] overflow-hidden bg-[#FCFBF9] min-h-[420px] relative">
            {/* Left Terracotta Folder Cover */}
            <div className="md:col-span-6 bg-gradient-to-br from-[#E68536] via-[#DF782B] to-[#CF661E] p-7 sm:p-9 flex flex-col justify-between text-[#28180D] relative shadow-[8px_0_24px_rgba(35,20,10,0.14)] z-10">
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FDF8F2]/85">
                  CONTRIBUTION DOSSIER
                </span>
                <div className="font-serif text-4xl sm:text-5xl text-[#FFFDF9] leading-[1.08] pt-2">
                  Execution
                  <br />
                  Record
                  <br />
                  <span className="text-[#28180D] font-sans font-bold text-3xl sm:text-4xl">
                    #{' '}
                    <span className="underline decoration-[#28180D] decoration-2 underline-offset-4">
                      2026
                    </span>
                  </span>
                </div>
              </div>

              {/* Clean 3-Line Folder Metadata */}
              <div className="my-8 space-y-2 border-t border-[#28180D]/15 pt-4 text-xs text-[#28180D]/85 font-mono">
                <div className="flex justify-between">
                  <span>EVALUATION:</span>
                  <span className="font-semibold">DIGNITY SCORE</span>
                </div>
                <div className="flex justify-between">
                  <span>EVIDENCE:</span>
                  <span className="font-semibold">SLACK + GITHUB</span>
                </div>
                <div className="flex justify-between">
                  <span>OVERSIGHT:</span>
                  <span className="font-semibold">1-LEAD HUMAN GATE</span>
                </div>
              </div>

              {/* Folder Footer Emblem & Brand */}
              <div className="flex items-end justify-between pt-2">
                <div className="h-11 w-11 rounded-xl border border-[#28180D]/30 flex items-center justify-center text-[#28180D]/80">
                  <Compass className="h-6 w-6" />
                </div>
                <span className="font-serif text-2xl text-[#28180D]/90">TaskPilot</span>
              </div>
            </div>

            {/* Right Clean Spec Sheet */}
            <div className="md:col-span-6 bg-[#FCFBF8] p-6 text-[#23170E] flex flex-col justify-between relative">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2 text-[10px] font-mono text-[#6E5E4F]">
                  <span>CLAIM TRACE &bull; CORE-14</span>
                  <span className="px-2 py-0.5 rounded bg-[#ECF6E3] text-[#2B5910] font-semibold">
                    VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-[#EAE3D5] pb-3">
                  <div className="p-2.5 rounded-lg bg-[#F5F1E9]">
                    <div className="text-[9px] font-mono uppercase text-[#7D6E5D]">GitHub Evidence</div>
                    <div className="font-semibold text-xs text-[#2B5910] mt-0.5">SHA 85c8893 ✓</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F5F1E9]">
                    <div className="text-[9px] font-mono uppercase text-[#7D6E5D]">Dignity Outcome</div>
                    <div className="font-semibold text-xs text-[#23170E] mt-0.5">Supported</div>
                  </div>
                </div>

                {/* Clean 3-Row Ledger */}
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#7D6E5D]">
                    Active Contribution Ledger
                  </div>
                  <div className="p-2.5 rounded-lg border border-[#E6DFD1] bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-[10px] text-[#C05617] font-semibold mr-2">CORE-14</span>
                      <span className="font-medium text-[#23170E]">OAuth state verification</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ECF6E3] text-[#2B5910]">
                      Supported
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[#F2C6BD] bg-[#FCECE9]/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-[10px] text-[#B33624] font-semibold mr-2">API-44</span>
                      <span className="font-medium text-[#23170E]">Payment webhook keys</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F4CFC8] text-[#882315]">
                      Blocked Context
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[#E6DFD1] bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-[10px] text-[#6E5E4F] font-semibold mr-2">DOC-09</span>
                      <span className="font-medium text-[#23170E]">Security runbook update</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FDF3E1] text-[#6E4409]">
                      Lead Review
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Schematic Wireframe Duo */}
              <div className="mt-4 pt-3 border-t border-[#EAE3D5] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#7D6E5D] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-[#5E9E2E]" /> Explainable Loop
                  </div>
                  <p className="text-[11px] text-[#59493A] max-w-[180px] leading-snug">
                    AI interprets context; deterministic rules &amp; humans govern outcomes.
                  </p>
                </div>
                <svg className="h-18 w-22 text-[#59493A]" viewBox="0 0 120 90" fill="none">
                  <circle cx="36" cy="20" r="9" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M20 78V45C20 38 26 33 36 33C46 33 52 38 52 45V78"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="84" cy="20" r="9" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M68 78V45C68 38 74 33 84 33C94 33 100 38 100 45V78"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="36" cy="48" r="3.5" fill="#DC6E26" />
                  <circle cx="84" cy="48" r="3.5" fill="#5E9E2E" />
                  <path d="M40 48H80" stroke="#DC6E26" strokeWidth="1.4" strokeDasharray="3 3" />
                </svg>
              </div>
            </div>

            {/* Tilted Lime Sticky Note Over Spine */}
            <div className="hidden md:block absolute left-[41%] top-10 z-20 w-48 p-3.5 bg-[#D9F99D] text-[#26380F] rounded-xs shadow-[0_10px_25px_rgba(0,0,0,0.15)] -rotate-6 border border-[#BEF264]">
              <p className="font-mono text-[10px] leading-relaxed font-medium">
                &ldquo;@TaskPilot: Finished CORE-14. Commit <u>85c8893</u> pushed to core-api.&rdquo;
              </p>
              <div className="mt-2 text-[9px] font-mono uppercase tracking-wider text-[#3F5A1A] flex justify-between">
                <span>SLACK #ENG-CORE</span>
                <span>✓ CORROBORATED</span>
              </div>
            </div>

            {/* Tilted Coral Sticky Note Near Bottom Spine */}
            <div className="hidden md:block absolute left-[43%] bottom-7 z-20 w-44 p-3 bg-[#F8A99F] text-[#3D1510] rounded-xs shadow-[0_10px_25px_rgba(0,0,0,0.14)] rotate-4 border border-[#F39185]">
              <p className="font-mono text-[10px] leading-snug font-medium">
                Missing evidence prompts Lead review—never automated penalty.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
