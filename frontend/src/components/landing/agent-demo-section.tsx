'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Terminal,
  CheckCircle2,
} from 'lucide-react';

const AGENT_DEMO_STEPS = [
  {
    step: 1,
    title: 'Slack Progress Claim',
    layer: 'Inbound Webhook (/api/slack/events)',
    input: '@kabir in #eng-core: "Finished CORE-14 OAuth state verification. Pushed commit 85c8893 and PR #42."',
    rule: 'Verifies HMAC-SHA256 signature (verify-signature.ts) and deduplicates event in integration_events.',
    outcome: 'Verified claim queued for interpretation.',
  },
  {
    step: 2,
    title: 'AI Intent Interpretation',
    layer: 'Advisory Language Parser (parser.ts)',
    input: 'Natural-language message analyzed for task key, completion claim, cited SHA, and blocker flags.',
    rule: 'AI extracts structured intent { task: "CORE-14", claim: "completion", sha: "85c8893" } without mutating DB permissions.',
    outcome: 'Structured claim passed to deterministic validator.',
  },
  {
    step: 3,
    title: 'Permission & Rule Check',
    layer: 'Deterministic Routing (Rules A–G)',
    input: 'Checks slack_user_mappings for @kabir and verifies task assignment in workspace.',
    rule: 'Rule G (Existing Task Update) confirms claimant is an authorized workspace member assigned to CORE-14.',
    outcome: 'Permission validated; triggering GitHub lookup.',
  },
  {
    step: 4,
    title: 'GitHub Repository Lookup',
    layer: 'Scoped Evidence Service',
    input: 'Queries linked project repository kaunteya/core-api for commit 85c8893 and PR #42.',
    rule: 'Retrieves commit diff (+84/-19 in src/lib/auth/state.ts) and stores record in evidence_artifacts.',
    outcome: '2 engineering artifacts linked to claim.',
  },
  {
    step: 5,
    title: 'Identity & Scope Cross-Check',
    layer: 'Cross-Check Validator',
    input: 'Compares Slack claimant U078K2M against GitHub commit author @kabir-dev and task window.',
    rule: 'Confirms slack_user_mappings === github_user_mappings and commit timestamp falls within active sprint.',
    outcome: 'Author identity & code scope corroborated.',
  },
  {
    step: 6,
    title: 'Dignity Score Evaluation',
    layer: 'Explainable Evaluation View',
    input: 'Synthesizes claim + 2 GitHub artifacts + rule checks into an inspectable evaluation card.',
    rule: 'Marks work_claims.status = "supported" and enforces chk_claim_no_self_approval (Lead must review).',
    outcome: 'Explainable Dignity Score summary ready.',
  },
  {
    step: 7,
    title: 'Auditable State & Lead Review',
    layer: 'Append-Only Audit Trail',
    input: 'Persists outcome in activity_events and replies in the #eng-core Slack thread.',
    rule: 'Writes immutable JSONB event record; queues final task closure for Designated Lead.',
    outcome: 'Recorded in activity_events with 100% traceability.',
  },
];

export function AgentDemoSection() {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev >= AGENT_DEMO_STEPS.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2600);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const currentStep = AGENT_DEMO_STEPS[currentStepIdx];

  const handlePlayToggle = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion && !isPlaying) {
      setCurrentStepIdx((prev) => (prev + 1) % AGENT_DEMO_STEPS.length);
      return;
    }

    if (currentStepIdx >= AGENT_DEMO_STEPS.length - 1 && !isPlaying) {
      setCurrentStepIdx(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  return (
    <section id="agent-demo" className="bg-[#EFECE6] py-18 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header & Playback Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#C86420] font-semibold">
              <Terminal className="h-3.5 w-3.5" /> INTERACTIVE WALKTHROUGH
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#23170E] leading-[1.05]">
              See the agent in action
            </h2>
          </div>

          <div
            className="flex items-center gap-2 p-1.5 rounded-full bg-[#FAF7F2] border border-[#DDD5C7] shadow-2xs self-start md:self-auto"
            role="group"
            aria-label="Agent walkthrough controls"
          >
            <button
              type="button"
              onClick={handlePlayToggle}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> {currentStepIdx === AGENT_DEMO_STEPS.length - 1 ? 'Replay' : 'Play'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIdx((prev) => Math.max(0, prev - 1));
              }}
              disabled={currentStepIdx === 0}
              aria-label="Previous step"
              className="p-1.5 rounded-full hover:bg-[#EFECE6] disabled:opacity-40 text-[#23170E] cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIdx((prev) => Math.min(AGENT_DEMO_STEPS.length - 1, prev + 1));
              }}
              disabled={currentStepIdx === AGENT_DEMO_STEPS.length - 1}
              aria-label="Next step"
              className="p-1.5 rounded-full hover:bg-[#EFECE6] disabled:opacity-40 text-[#23170E] cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIdx(0);
              }}
              aria-label="Reset walkthrough"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-[#EFECE6] text-xs font-mono text-[#59493A] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
        </div>

        {/* Clean 7-Step Pill Rail */}
        <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Agent demo steps">
          {AGENT_DEMO_STEPS.map((item, idx) => {
            const isCurrent = idx === currentStepIdx;
            const isDone = idx < currentStepIdx;
            return (
              <button
                key={item.step}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIdx(idx);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#FAF7F2] border-[#DC6E26] shadow-xs ring-1 ring-[#DC6E26]/30'
                    : isDone
                    ? 'bg-[#ECF6E3]/80 border-[#C5E3AC] text-[#2B5910]'
                    : 'bg-[#F7F4EE]/70 border-[#DFD7C8] text-[#7D6E5D] hover:bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="font-bold">0{item.step}</span>
                  {isDone && <CheckCircle2 className="h-3 w-3 text-[#2B5910]" />}
                </div>
                <div className="hidden sm:block text-[11px] font-medium text-[#23170E] mt-1 truncate">
                  {item.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Single Clean Step Inspector Card */}
        <div className="rounded-3xl bg-[#FAF7F2] border border-[#DFD6C5] p-6 sm:p-8 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#DC6E26] text-white font-mono text-[10px] font-semibold">
              STEP 0{currentStep.step} &bull; {currentStep.layer}
            </span>
            <h3 className="font-serif text-3xl text-[#23170E]">{currentStep.title}</h3>
            <p className="text-xs font-mono text-[#2B5910] bg-[#ECF6E3] border border-[#C5E3AC] px-3 py-1.5 rounded-lg inline-block">
              ✓ {currentStep.outcome}
            </p>
          </div>

          <div className="md:col-span-7 space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-[#EAE3D5] space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#7D6E5D]">Signal / Input</div>
              <p className="font-mono text-[#23170E]">{currentStep.input}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F2EFE9] border border-[#E3DAC8] space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#C05617] font-semibold">
                Verification Rule Applied
              </div>
              <p className="text-[#3F3124] leading-relaxed">{currentStep.rule}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
