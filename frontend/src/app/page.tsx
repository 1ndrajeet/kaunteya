"use client";

<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { LandingNavbar } from '@/components/landing/navbar';
import { HeroSection } from '@/components/landing/hero-section';
import { ProblemSection } from '@/components/landing/problem-section';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { DignityScoreSection } from '@/components/landing/dignity-score-section';
import { AgentDemoSection } from '@/components/landing/agent-demo-section';
import { SecuritySection } from '@/components/landing/security-section';
import { ProductPreviewSection } from '@/components/landing/product-preview-section';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

=======
/**
 * TaskPilot landing page: single file, replaces frontend/src/app/page.tsx
 *
 * - Theme: light / system / dark, persisted under "taskpilot-theme", synced across tabs,
 *   follows the OS while on "system". Also toggles the `dark` class on <html> so the rest
 *   of the app (shadcn / Tailwind `dark:`) stays in step.
 * - All demonstration content is fictional, deterministic and runs locally. Nothing on this
 *   page calls Slack, GitHub, Supabase or any AI provider.
 * - Metadata cannot be exported from a client component. Keep title / description / Open Graph
 *   in app/layout.tsx.
 */

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Inter, Instrument_Serif } from "next/font/google";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GitBranch,
  GitPullRequest,
  Info,
  LayoutList,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Scale,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sun,
  TriangleAlert,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Fonts                                                              */
/* ------------------------------------------------------------------ */

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

/* ------------------------------------------------------------------ */
/* Theme store (no setState-in-effect; works with SSR)                */
/* ------------------------------------------------------------------ */

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "taskpilot-theme";
const THEME_EVENT = "tp-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_EVENT, cb);
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_EVENT, cb);
    mq.removeEventListener("change", cb);
  };
}
const readSystemDark = () => window.matchMedia(DARK_QUERY).matches;
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const readReducedMotion = () => window.matchMedia(MOTION_QUERY).matches;

/* ------------------------------------------------------------------ */
/* Styles (scoped under .tp, theme driven by the `dark` class on <html>) */
/* ------------------------------------------------------------------ */

const CSS = `
.tp{
  --bg:#100f0d; --surface:#181612; --surface-2:#211e19; --border:#322e27;
  --fg:#f4efe6; --muted:#a9a193; --accent:#f2a93b; --accent-fg:#17110a;
  --ok:#7fd49a; --warn:#f2a93b; --bad:#f29484; --info:#8fbbf2;
  color-scheme:dark;
  background:var(--bg); color:var(--fg);
  font-family:var(--font-sans),system-ui,-apple-system,"Segoe UI",sans-serif;
  line-height:1.6; min-height:100vh; -webkit-font-smoothing:antialiased;
}
html:not(.dark) .tp{
  --bg:#f8f7f4; --surface:#ffffff; --surface-2:#f0eee9; --border:#ddd8ce;
  --fg:#1c1a16; --muted:#5f584b; --accent:#9a4a07; --accent-fg:#ffffff;
  --ok:#1d6b3a; --warn:#8a4206; --bad:#a3341f; --info:#1f4f8f;
  color-scheme:light;
}
@media (prefers-reduced-motion:no-preference){ html{scroll-behavior:smooth} }
html.tp-switching, html.tp-switching *{
  transition:background-color .2s ease,border-color .2s ease,color .2s ease !important;
}
@media (prefers-reduced-motion:reduce){ html.tp-switching, html.tp-switching *{transition:none !important} }

.tp :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
.tp a{color:inherit;text-decoration:none}
.tp ::selection{background:var(--accent);color:var(--accent-fg)}

.tp .display,.tp .h2,.tp .h3{font-family:var(--font-serif),Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:-.012em}
.tp .display{font-size:clamp(2.5rem,5.6vw,4.5rem);line-height:1.03}
.tp .h2{font-size:clamp(2rem,4vw,3.1rem);line-height:1.08}
.tp .h3{font-size:1.6rem;line-height:1.15}
.tp .lead{color:var(--muted);font-size:1.075rem;max-width:62ch}
.tp .muted{color:var(--muted)}
.tp .accent{color:var(--accent)}
.tp .small{font-size:.875rem}

.tp .nav{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.tp .sec{padding:5.5rem 0;border-top:1px solid var(--border);scroll-margin-top:4rem}
.tp .sec-hero{padding:4.5rem 0 5.5rem}
.tp .panel{background:var(--surface);border:1px solid var(--border);border-radius:14px}
.tp .panel-2{background:var(--surface-2);border:1px solid var(--border);border-radius:10px}
.tp .rule-t{border-top:1px solid var(--border)}

.tp .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border-radius:10px;padding:.7rem 1.15rem;font-weight:500;font-size:.95rem;line-height:1.2;cursor:pointer;border:1px solid transparent;transition:background-color .15s,filter .15s,border-color .15s}
.tp .btn-primary{background:var(--accent);color:var(--accent-fg)}
.tp .btn-primary:hover{filter:brightness(1.08)}
.tp .btn-ghost{border-color:var(--border);color:var(--fg);background:transparent}
.tp .btn-ghost:hover{background:var(--surface-2)}
.tp .btn-sm{padding:.45rem .8rem;font-size:.85rem}
.tp .btn[disabled]{opacity:.45;cursor:not-allowed}
.tp .navlink{color:var(--muted);font-size:.92rem;padding:.35rem .6rem;border-radius:8px;transition:color .15s}
.tp .navlink:hover{color:var(--fg)}

.tp .chip{display:inline-flex;align-items:center;gap:.3rem;border:1px solid currentColor;border-radius:999px;padding:.1rem .55rem;font-size:.76rem;font-weight:500;line-height:1.5;white-space:nowrap}
.tp .chip-ok{color:var(--ok)} .tp .chip-warn{color:var(--warn)} .tp .chip-bad{color:var(--bad)} .tp .chip-info{color:var(--info)}
.tp .chip-neutral{color:var(--muted)}

.tp .seg{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--border);border-radius:999px;background:var(--surface)}
.tp .seg button{display:grid;place-items:center;width:1.75rem;height:1.75rem;border-radius:999px;color:var(--muted);cursor:pointer;transition:color .15s,background-color .15s}
.tp .seg button:hover{color:var(--fg)}
.tp .seg button[aria-checked="true"]{background:var(--accent);color:var(--accent-fg)}

.tp .hr{display:grid;grid-template-columns:2rem 1fr;gap:.9rem;padding:1rem 0;border-top:1px solid var(--border);opacity:.35;transform:translateY(4px);transition:opacity .45s ease,transform .45s ease}
.tp .hr:first-child{border-top:0}
.tp .hr[data-on="true"]{opacity:1;transform:none}
.tp .node{display:grid;place-items:center;width:2rem;height:2rem;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--muted)}
.tp .hr[data-on="true"] .node{border-color:var(--accent);color:var(--accent)}
@media (prefers-reduced-motion:reduce){ .tp .hr{transition:none;transform:none} }

.tp .acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .25s ease}
.tp .acc[data-open="true"]{grid-template-rows:1fr}
.tp .acc>div{overflow:hidden;min-height:0}
@media (prefers-reduced-motion:reduce){ .tp .acc{transition:none} }

.tp .tab{display:grid;grid-template-columns:1.75rem 1fr auto;align-items:center;gap:.75rem;width:100%;text-align:left;padding:.8rem .9rem;border-radius:10px;border:1px solid transparent;cursor:pointer;color:var(--muted);transition:background-color .15s,color .15s,border-color .15s}
.tp .tab:hover{background:var(--surface-2);color:var(--fg)}
.tp .tab[aria-selected="true"]{background:var(--surface);border-color:var(--border);color:var(--fg)}
.tp .tab .idx{font-variant-numeric:tabular-nums;font-size:.85rem;color:var(--muted)}
.tp .tab[aria-selected="true"] .idx{color:var(--accent)}

.tp .band{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}
.tp .band>div{padding:.55rem .75rem;border:1px solid var(--border);border-radius:10px;font-size:.85rem;color:var(--muted)}
.tp .band>div[data-on="true"]{border-color:var(--accent);color:var(--fg);background:var(--surface-2)}

.tp .log{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8rem;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.tp .log li{padding:.1rem 0}

.tp .kv{display:grid;grid-template-columns:minmax(0,9rem) 1fr auto;gap:.5rem 1rem;padding:.7rem 0;border-top:1px solid var(--border);align-items:start}
.tp .kv:first-child{border-top:0}
@media (max-width:640px){ .tp .kv{grid-template-columns:1fr auto} .tp .kv>.k{grid-column:1/-1} }

.tp .layer{display:grid;grid-template-columns:9.5rem 1.5rem 1fr;gap:1rem;align-items:start}
.tp .layer .spine{position:relative;align-self:stretch;display:flex;justify-content:center}
.tp .layer .spine::before{content:"";position:absolute;top:0;bottom:-1.25rem;width:1px;background:var(--border)}
.tp .layer:last-child .spine::before{bottom:auto;height:.9rem}
.tp .layer .dot{position:relative;margin-top:.45rem;width:.7rem;height:.7rem;border-radius:999px;background:var(--surface-2);border:2px solid var(--muted)}
.tp .layer[data-key="ai"] .dot{border-color:var(--accent);background:var(--accent)}
.tp .layer[data-key="rules"] .dot{border-color:var(--ok);background:var(--ok)}
.tp .layer[data-key="human"] .dot{border-color:var(--info);background:var(--info)}
@media (max-width:640px){ .tp .layer{grid-template-columns:1.5rem 1fr} .tp .layer .zone{grid-column:2;order:3} }

.tp table{border-collapse:collapse;width:100%;min-width:640px}
.tp th,.tp td{padding:.95rem 1rem;text-align:left;vertical-align:top;border-top:1px solid var(--border);font-size:.95rem}
.tp thead th{border-top:0;color:var(--muted);font-weight:500;font-size:.85rem}
.tp tbody th{font-weight:500}
.tp td.col-tp{background:var(--surface-2)}

.tp .skip{position:absolute;left:-999px;top:0;background:var(--accent);color:var(--accent-fg);padding:.6rem 1rem;border-radius:0 0 10px 0;z-index:60}
.tp .skip:focus{left:0}
`;

/* ------------------------------------------------------------------ */
/* Small shared helpers                                               */
/* ------------------------------------------------------------------ */

type Tone = "ok" | "warn" | "bad" | "info";
const TONE_ICON: Record<Tone, LucideIcon> = {
  ok: Check,
  warn: TriangleAlert,
  bad: X,
  info: Info,
};

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className={`chip chip-${tone}`}>
      <Icon size={12} aria-hidden="true" />
      {children}
    </span>
  );
}

type KV = { k: string; v: string; tone?: Tone; label?: string };

/* ------------------------------------------------------------------ */
/* Content                                                            */
/* ------------------------------------------------------------------ */

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#dignity", label: "Dignity Score" },
  { href: "#security", label: "Security" },
  { href: "#integrations", label: "Integrations" },
];

const HERO_ROWS: {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: Tone;
  label: string;
}[] = [
  {
    icon: MessageSquare,
    title: "Claim received from Slack",
    detail: "“Finished the API validation task.” Maya R. in #backend.",
    tone: "info",
    label: "Received",
  },
  {
    icon: UserCheck,
    title: "Task and person matched",
    detail: "VAL-12, API request validation, is assigned to Maya R. Her Slack account is linked to her workspace profile.",
    tone: "ok",
    label: "Verified",
  },
  {
    icon: GitBranch,
    title: "Repository checked",
    detail: "acme/orders-api is authorized for this project.",
    tone: "ok",
    label: "Authorized",
  },
  {
    icon: GitPullRequest,
    title: "Evidence found",
    detail: "PR #48, “Add request schema validation”: merged, one approving review, checks passed, authored by the linked account.",
    tone: "ok",
    label: "Consistent",
  },
  {
    icon: Scale,
    title: "Policy evaluated",
    detail: "Completion needs linked evidence from the assignee and a reviewed merge. Both are present.",
    tone: "ok",
    label: "Rule met",
  },
  {
    icon: ClipboardList,
    title: "Outcome prepared",
    detail: "Completion proposed with the evidence attached. A lead can confirm it or reopen the task.",
    tone: "info",
    label: "Awaiting lead",
  },
];

type Group = "input" | "ai" | "rules" | "human";
const STAGES: {
  id: string;
  name: string;
  group: Group;
  who: string;
  body: string;
  does: string[];
  cannot: string[];
}[] = [
  {
    id: "capture",
    name: "Capture",
    group: "input",
    who: "Integration",
    body: "A progress report arrives from an authorized Slack channel or from inside the app.",
    does: ["Verify the request signature", "Drop duplicate events", "Keep only authorized channels and threads"],
    cannot: ["Treat a message as proof of completion", "Read channels the bot was not added to"],
  },
  {
    id: "understand",
    name: "Understand",
    group: "ai",
    who: "AI",
    body: "A model reads the text and proposes which task it refers to and what is being claimed.",
    does: ["Extract task, status, blocker and progress", "Say when a message is unclear or covers several tasks"],
    cannot: ["Write to the database", "Choose its own permissions", "Follow instructions hidden in the message it reads"],
  },
  {
    id: "validate",
    name: "Validate",
    group: "rules",
    who: "Rules",
    body: "Fixed checks decide whether the proposal may go any further.",
    does: [
      "Match the sender to a workspace member",
      "Confirm the task belongs to this workspace",
      "Check the status change is allowed",
      "Refuse changes that would overwrite newer state",
    ],
    cannot: ["Be overridden by model confidence"],
  },
  {
    id: "verify",
    name: "Verify",
    group: "rules",
    who: "Rules",
    body: "Where the project links a repository, available GitHub activity is retrieved and compared with the claim.",
    does: [
      "Read pull requests, commits, reviews and checks the app is authorized to see",
      "Compare the author with the linked account",
      "Keep a source reference for each item",
    ],
    cannot: ["Treat a commit as proof of delivery", "Treat missing activity as proof that nothing was done"],
  },
  {
    id: "evaluate",
    name: "Evaluate",
    group: "rules",
    who: "Rules",
    body: "The project’s policy is applied to the claim and the evidence it found.",
    does: ["Accept, hold for review or ask for clarification", "Say which rule led to the outcome", "Mark missing evidence as uncertainty"],
    cannot: ["Invent evidence", "Penalize anyone automatically", "Rank people"],
  },
  {
    id: "review",
    name: "Review",
    group: "human",
    who: "Human",
    body: "A lead or administrator looks at disputed, ambiguous or consequential cases.",
    does: ["Open the claim, evidence and reasoning together", "Accept, reject or ask for more", "Leave a reason that is recorded"],
    cannot: ["Approve their own disputed claim", "Edit audit history"],
  },
  {
    id: "record",
    name: "Record",
    group: "rules",
    who: "Rules",
    body: "Approved changes and the reasons behind them are saved.",
    does: ["Persist the task change", "Write an activity entry linking source, checks and rule", "Show the new state in the workspace"],
    cannot: ["Rewrite earlier entries"],
  },
];

const DIGNITY_PRINCIPLES = [
  "Evidence supports a claim. It does not replace context.",
  "Commit counts and message volume are not contribution.",
  "Missing evidence is uncertainty, not misconduct.",
  "Models read and summarize. Rules decide what can change.",
  "Every conclusion shows its sources and can be challenged.",
  "People review disputed outcomes, and their decisions are recorded.",
];

const DIGNITY_PANELS: { title: string; tone: Tone; label: string; body: string }[] = [
  {
    title: "Reported contribution",
    tone: "info",
    label: "Claimed",
    body: "Maya R. wrote in #backend: “Finished the report export.” The agent extracted task REP-7, status complete, and no blocker.",
  },
  {
    title: "Supporting evidence",
    tone: "ok",
    label: "Found",
    body: "PR #61, “Add CSV export for reports,” was merged two days before the claim with one approving review. A Slack thread shows the design discussion that shaped the work.",
  },
  {
    title: "Identity and repository",
    tone: "warn",
    label: "Needs confirmation",
    body: "acme/reports-api is authorized. The PR author’s GitHub account is not linked to Maya’s workspace profile, and the commit uses a personal email. That is common when people commit from a second account.",
  },
  {
    title: "Criteria applied",
    tone: "info",
    label: "Project rules",
    body: "The project’s completion policy asks for evidence from the linked repository, credited to the assignee, with a reviewed merge. Checks are reported when the repository has them. This page publishes no weights or formula.",
  },
  {
    title: "Missing or conflicting evidence",
    tone: "warn",
    label: "Unresolved",
    body: "No CI checks are configured for this repository, so none are reported. Missing checks are not counted against anyone. The author mismatch is unresolved.",
  },
  {
    title: "Outcome and explanation",
    tone: "warn",
    label: "Held for human review",
    body: "The evidence supports the claim, but authorship cannot be confirmed automatically. Nothing here suggests misconduct. A lead can confirm the account link, ask Maya, or reopen the task, and either decision is recorded with a reason.",
  },
];

const DEMO: { title: string; blurb: string; log: string[]; card: { title: string; rows: KV[] } }[] = [
  {
    title: "Claim arrives",
    blurb: "A message lands in an authorized channel and its signature is verified.",
    log: ["+0.0s  slack.event   message in #payments (signature verified)", "+0.0s  dedupe        event id not seen before"],
    card: {
      title: "Slack message",
      rows: [
        { k: "From", v: "Leo K." },
        { k: "Channel", v: "#payments" },
        { k: "Text", v: "“The API is connected, but I’m waiting for test credentials.”" },
      ],
    },
  },
  {
    title: "Agent reads the claim",
    blurb: "A model proposes structured fields. Nothing is applied yet.",
    log: [
      "+0.4s  ai.interpret  candidate tasks: 1",
      "+0.9s  proposal      status=blocked blocker=\"Waiting for test credentials\"",
      "+0.9s  schema        proposal is valid",
    ],
    card: {
      title: "Structured proposal (not yet applied)",
      rows: [
        { k: "status", v: "blocked", tone: "info", label: "Proposed" },
        { k: "blocker", v: "Waiting for test credentials" },
        { k: "progress", v: "Payment API connected; testing is pending" },
        { k: "needs_clarification", v: "false" },
      ],
    },
  },
  {
    title: "Task and permissions checked",
    blurb: "Fixed checks decide whether the proposal may proceed.",
    log: [
      "+1.0s  identity      Slack user maps to workspace member Leo K.",
      "+1.1s  task          PAY-4 belongs to this workspace",
      "+1.1s  transition    in_progress to blocked is allowed",
      "+1.1s  freshness     no newer change since the follow-up was sent",
    ],
    card: {
      title: "Validation",
      rows: [
        { k: "Identity", v: "Slack account is linked to Leo K.", tone: "ok", label: "Verified" },
        { k: "Workspace", v: "PAY-4 belongs to this workspace", tone: "ok", label: "Verified" },
        { k: "Transition", v: "In progress to Blocked", tone: "ok", label: "Allowed" },
        { k: "Freshness", v: "No newer change on the task", tone: "ok", label: "Current" },
      ],
    },
  },
  {
    title: "GitHub evidence retrieved",
    blurb: "Activity is read from the linked, authorized repository.",
    log: [
      "+1.6s  github        acme/checkout is authorized for this project",
      "+2.0s  github        PR #52 “Integrate payment API client” (open, 2 commits)",
      "+2.0s  github        checks: 1 pending",
    ],
    card: {
      title: "Evidence",
      rows: [
        { k: "Repository", v: "acme/checkout", tone: "ok", label: "Authorized" },
        { k: "PR #52", v: "“Integrate payment API client,” open, 2 commits", tone: "info", label: "Open" },
        { k: "Author", v: "Matches Leo K.’s linked account", tone: "ok", label: "Matches" },
        { k: "Checks", v: "1 pending", tone: "warn", label: "Pending" },
      ],
    },
  },
  {
    title: "Evidence compared with the claim",
    blurb: "Each part of the message is compared with what was found.",
    log: [
      "+2.1s  compare       “API is connected” and client code in PR #52: consistent",
      "+2.1s  compare       “cannot test yet” and no passing test run: consistent",
      "+2.1s  compare       completion was not claimed",
    ],
    card: {
      title: "Claim and evidence",
      rows: [
        { k: "“API is connected”", v: "Client code is present in PR #52", tone: "ok", label: "Consistent" },
        { k: "“Waiting for credentials”", v: "No passing test run exists yet", tone: "ok", label: "Consistent" },
        { k: "Completion", v: "Not claimed", tone: "info", label: "None proposed" },
      ],
    },
  },
  {
    title: "Outcome decided by rules",
    blurb: "Policy, not model confidence, accepts or refuses the proposal.",
    log: [
      "+2.2s  policy        blocker reported by assignee, consistent with evidence: apply",
      "+2.2s  policy        completion needs a merged PR and passing checks: not met",
      "+2.2s  outcome       apply status=blocked",
    ],
    card: {
      title: "Policy result",
      rows: [
        { k: "Blocker rule", v: "Reported by the assignee, consistent with evidence", tone: "ok", label: "Met" },
        { k: "Completion rule", v: "Needs a merged PR and passing checks", tone: "warn", label: "Not met" },
        { k: "Decision", v: "Set Blocked. Do not mark complete.", tone: "info", label: "By rules" },
      ],
    },
  },
  {
    title: "Result recorded",
    blurb: "The change is saved with its reasons and shown in the workspace.",
    log: [
      "+2.3s  db            PAY-4 status=blocked blocker=\"Waiting for test credentials\"",
      "+2.3s  activity      entry saved with source message, checks and rule",
      "+2.4s  slack.reply   “Thanks. I’ve marked this blocked on credentials. Tell me when they arrive.”",
    ],
    card: {
      title: "Task PAY-4, Connect payment API",
      rows: [
        { k: "Status", v: "Blocked", tone: "warn", label: "Updated" },
        { k: "Blocker", v: "Waiting for test credentials" },
        { k: "Audit", v: "Message, checks and rule saved with the change", tone: "ok", label: "Recorded" },
      ],
    },
  },
];

const LAYERS: { key: "src" | "srv" | "gate" | "ai" | "rules" | "human" | "rec"; name: string; zone: string; body: string }[] = [
  {
    key: "src",
    name: "Authorized Slack and GitHub",
    zone: "Untrusted content",
    body: "Messages, commit text and PR descriptions are data. They cannot grant permissions or change instructions.",
  },
  {
    key: "srv",
    name: "Server-side integration layer",
    zone: "Secrets stay here",
    body: "Signature checks, tokens and service keys belong on the server and never reach the browser.",
  },
  {
    key: "gate",
    name: "Task, identity and permission validation",
    zone: "Gate",
    body: "Workspace, member, role and allowed status change are checked before anything is read or written.",
  },
  {
    key: "ai",
    name: "AI interpretation",
    zone: "Proposes only",
    body: "Reads text and returns a structured proposal. It has no write access and no say over permissions.",
  },
  {
    key: "rules",
    name: "Deterministic verification",
    zone: "Decides",
    body: "Fixed rules accept, refuse or escalate the proposal. Model confidence alone never decides an outcome.",
  },
  {
    key: "human",
    name: "Human review",
    zone: "Accountable",
    body: "Uncertain or consequential cases go to a lead or administrator, who record a reason.",
  },
  {
    key: "rec",
    name: "Auditable outcome",
    zone: "Traceable",
    body: "The change is saved with its source, the checks that ran and the rule that applied.",
  },
];

const CONTROLS: { text: string; kind: "code" | "principle" }[] = [
  { text: "Signature verification for Slack and GitHub webhooks", kind: "code" },
  { text: "Row Level Security on workspace data in Supabase", kind: "code" },
  { text: "Bot tokens, signing secrets and service keys kept out of browser code", kind: "principle" },
  { text: "Idempotent webhook processing", kind: "principle" },
  { text: "Least-privilege access to Slack channels and GitHub repositories", kind: "principle" },
  { text: "Treating retrieved text as untrusted, including attempts at prompt injection", kind: "principle" },
  { text: "A human review path for uncertain or consequential decisions", kind: "principle" },
];

const PRODUCT_ROWS = [
  { name: "Projects and repositories", text: "Organize work by project and link the repositories that supply evidence." },
  { name: "Tasks and assignments", text: "Priorities, deadlines, comments and a detail drawer, in list or Kanban view." },
  { name: "Incoming triage", text: "Requests without a clear owner wait in a queue instead of being guessed at." },
  { name: "Claims and evidence review", text: "Disputed or incomplete claims reach a person with the evidence beside them." },
  { name: "Activity and audit history", text: "A workspace-wide record of changes, who or what made them, and why." },
  { name: "Roles and permissions", text: "Administrators govern the workspace, leads coordinate, members report progress." },
];

const BOARD = [
  { col: "To do", tone: "info" as Tone, task: "DOC-3", title: "Write onboarding notes", who: "Asha P." },
  { col: "In progress", tone: "info" as Tone, task: "VAL-12", title: "API request validation", who: "Maya R." },
  { col: "Blocked", tone: "warn" as Tone, task: "PAY-4", title: "Connect payment API", who: "Leo K." },
  { col: "Complete", tone: "ok" as Tone, task: "UI-9", title: "Settings page layout", who: "Dev S." },
];

const COMPARE = [
  { q: "Who says the work is done?", a: "The status update, taken as given", b: "The update, then checked against linked evidence" },
  { q: "What does the model do?", a: "Decides and writes", b: "Proposes. Rules and people decide" },
  { q: "When evidence is missing", a: "Silence, or a penalty", b: "Marked uncertain and sent for review" },
  { q: "Can a conclusion be challenged?", a: "Rarely", b: "Every outcome shows its sources and can be reviewed" },
  { q: "What is recorded?", a: "The new status", b: "The status, the source message, the checks and the rule applied" },
];

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Page() {
  /* ---- theme ---- */
  const pref = useSyncExternalStore<ThemePref>(subscribeTheme, readPref, () => "system");
  const systemDark = useSyncExternalStore(subscribeTheme, readSystemDark, () => true);
  const resolved: "light" | "dark" = pref === "system" ? (systemDark ? "dark" : "light") : pref;
  const userChanged = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    let t: number | undefined;
    if (userChanged.current) {
      root.classList.add("tp-switching");
      t = window.setTimeout(() => root.classList.remove("tp-switching"), 260);
      userChanged.current = false;
    }
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
>>>>>>> 7e3ba8dce8d2eb49edf722158a9ae722e4007d9b
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [resolved]);

  function choose(next: ThemePref) {
    userChanged.current = true;
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: the choice still applies for this visit */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const THEME_OPTIONS: { value: ThemePref; label: string; Icon: LucideIcon }[] = [
    { value: "light", label: "Light theme", Icon: Sun },
    { value: "system", label: "Match system theme", Icon: Monitor },
    { value: "dark", label: "Dark theme", Icon: Moon },
  ];
  const themeToggle = (
    <div className="seg" role="radiogroup" aria-label="Colour theme">
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
        >
          <Icon size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );

  /* ---- mobile menu ---- */
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* ---- hero sequence ---- */
  const reduceMotion = useSyncExternalStore(subscribeMotion, readReducedMotion, () => false);
  const [heroTick, setHeroTick] = useState(0);
  const [heroRun, setHeroRun] = useState(0);
  const heroStep = reduceMotion ? HERO_ROWS.length - 1 : heroTick;
  useEffect(() => {
    if (reduceMotion) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setHeroTick(i);
      if (i >= HERO_ROWS.length - 1) window.clearInterval(id);
    }, 1300);
    return () => window.clearInterval(id);
  }, [reduceMotion, heroRun]);

  /* ---- how it works (tabs) ---- */
  const [stage, setStage] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = STAGES.length - 1;
    let n = i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = i === last ? 0 : i + 1;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = i === 0 ? last : i - 1;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = last;
    else return;
    e.preventDefault();
    setStage(n);
    tabRefs.current[n]?.focus();
  }
  const current = STAGES[stage];

  /* ---- Dignity Score accordion ---- */
  const [open, setOpen] = useState<boolean[]>([true, false, false, false, false, true]);
  const allOpen = open.every(Boolean);

  /* ---- agent demo ---- */
  const LAST = DEMO.length - 1;
  const [demoStep, setDemoStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      const n = demoStep + 1;
      setDemoStep(n);
      if (n >= LAST) setPlaying(false);
    }, 1700);
    return () => window.clearTimeout(t);
  }, [playing, demoStep, LAST]);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [demoStep]);
  function play() {
    if (demoStep >= LAST) setDemoStep(0);
    setPlaying(true);
  }
  const demo = DEMO[demoStep];

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#854D27] p-0 sm:p-3 md:p-5 text-[#23170E] selection:bg-[#DC6E26]/20">
      {/* Main Warm Parchment Sheet inside the Chestnut Frame */}
      <div className="min-h-screen bg-[#FAF7F2] sm:rounded-[28px] overflow-hidden shadow-[0_24px_80px_rgba(20,10,4,0.45)] border border-[#6E3D1B]/30 flex flex-col">
        {/* Sticky Pill Navigation */}
        <LandingNavbar user={user} configured={configured} />

        <main className="flex-1">
          {/* 1. Hero & Tactile Dossier Folder */}
          <HeroSection user={user} />

          {/* 2. Split Schematic & 4 Contextual Delivery Visuals */}
          <ProblemSection />

          {/* Pixel-Dithered Transition Band */}
          <div className="heilth-dither-band mt-6" />

          {/* 3. Human-to-Agent Bridge & 7-Stage Pipeline */}
          <WorkflowSection />

          {/* Pixel-Dithered Transition Band */}
          <div className="heilth-dither-band" />

          {/* 4. Signature USP: The Dignity Score Showcase */}
          <DignityScoreSection />

          {/* 5. Interactive 7-Step Agent Simulator */}
          <AgentDemoSection />

          {/* 6. Scoped Integrations & Security Boundaries */}
          <SecuritySection />

          {/* 7. Workspace Governance, Final CTA & Watermark Footer */}
          <ProductPreviewSection user={user} />
        </main>
      </div>
=======
    <div className={`tp ${sans.variable} ${serif.variable}`}>
      <style>{CSS}</style>
      <a href="#main" className="skip">
        Skip to content
      </a>

      {/* ================= Navigation ================= */}
      <header className="nav">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="TaskPilot home">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="accent">
              <path d="M3.5 18.5 20.5 4.5l-4 15-4.3-5.2-8.7 4.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m12.2 14.3 8.3-9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="h3" style={{ fontSize: "1.45rem" }}>
              TaskPilot
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="navlink">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">{themeToggle}</div>
            <Link href="/login" className="btn btn-primary btn-sm hidden sm:inline-flex">
              Get started
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="rule-t md:hidden" style={{ background: "var(--bg)" }}>
            <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4 sm:px-8">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="navlink" style={{ padding: ".7rem .6rem" }} onClick={() => setMenuOpen(false)}>
                  {n.label}
                </a>
              ))}
              <div className="mt-3 flex items-center justify-between gap-4">
                {themeToggle}
                <Link href="/login" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>
                  Get started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main">
        {/* ================= Hero ================= */}
        <section className="sec-hero" aria-labelledby="hero-title">
          <div className="mx-auto grid w-full max-w-7xl items-start gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <h1 id="hero-title" className="display">
                Every contribution deserves evidence. Every evaluation deserves context.
              </h1>
              <p className="lead mt-6">
                TaskPilot connects team coordination, verified engineering activity and explainable contribution evaluation, the Dignity Score,
                so teams can understand the work behind the outcome.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn btn-primary">
                  Get started <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a href="#demo" className="btn btn-ghost">
                  See how it works
                </a>
              </div>
              <ol className="muted small mt-10 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Flow of a claim through TaskPilot">
                {["Slack", "TaskPilot agent", "GitHub", "Evidence", "Dignity Score"].map((s, i, arr) => (
                  <li key={s} className="flex items-center gap-2">
                    <span>{s}</span>
                    {i < arr.length - 1 && <ChevronRight size={14} aria-hidden="true" />}
                  </li>
                ))}
              </ol>
              <p className="muted small mt-4 max-w-md">
                The Dignity Score is an explanation you can inspect, not a verdict. It never reduces a person to a number.
              </p>
            </div>

            <figure className="panel" style={{ padding: "1.25rem 1.4rem" }} aria-label="Illustrative contribution record">
              <figcaption className="flex items-center justify-between gap-3 pb-3">
                <span className="small" style={{ fontWeight: 500 }}>
                  Contribution record
                </span>
                <span className="flex items-center gap-2">
                  <span className="chip chip-neutral">Demonstration data</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setHeroTick(0);
                      setHeroRun((r) => r + 1);
                    }}
                    aria-label="Replay the illustrative run"
                    title="Replay"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                </span>
              </figcaption>
              <ol>
                {HERO_ROWS.map((r, i) => {
                  const Icon = r.icon;
                  return (
                    <li key={r.title} className="hr" data-on={i <= heroStep}>
                      <span className="node">
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p style={{ fontWeight: 500 }}>{r.title}</p>
                          <Chip tone={r.tone}>{r.label}</Chip>
                        </div>
                        <p className="muted small mt-1">{r.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="muted small rule-t pt-3">
                An illustrative run with fictional people and repositories. It is not a live execution.
              </p>
            </figure>
          </div>
        </section>

        {/* ================= Problem ================= */}
        <section className="sec" aria-labelledby="problem-title">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="problem-title" className="h2 max-w-3xl">
              Activity is visible. Contribution is harder to understand.
            </h2>
            <p className="lead mt-5">
              Task boards record status, but not the evidence behind a claim. Commit counts miss most of what engineering is. Slack holds the
              context a status field loses. Automated productivity scores ignore permissions and uncertainty. Managers need explanations they can
              inspect, not another dashboard.
            </p>

            <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
              <div className="panel p-6">
                <p className="muted small">What a task board shows</p>
                <p className="h3 mt-2">Connect payment API</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip tone="info">In progress</Chip>
                  <span className="chip chip-neutral">Project 80% complete</span>
                </div>
                <p className="muted small mt-4">Looks healthy. Nothing says the task is stuck.</p>
              </div>
              <div className="muted hidden items-center lg:flex" aria-hidden="true">
                <ChevronRight size={28} />
              </div>
              <div className="panel p-6">
                <p className="muted small">What is actually happening</p>
                <ul className="mt-3 space-y-3">
                  <li className="flex gap-3">
                    <MessageSquare size={16} className="muted mt-1 shrink-0" aria-hidden="true" />
                    <span className="small">In Slack: “The API is connected, but I’m waiting for test credentials.”</span>
                  </li>
                  <li className="flex gap-3">
                    <GitPullRequest size={16} className="muted mt-1 shrink-0" aria-hidden="true" />
                    <span className="small">In GitHub: a pull request is open and one check is still pending.</span>
                  </li>
                  <li className="flex gap-3">
                    <TriangleAlert size={16} className="mt-1 shrink-0" style={{ color: "var(--warn)" }} aria-hidden="true" />
                    <span className="small">In the project: the task should read Blocked, and say why.</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className="muted mt-6 max-w-3xl">
              TaskPilot connects these pieces into one contribution record: the claim, the evidence, the rule that applied and the outcome.
            </p>
          </div>
        </section>

        {/* ================= How it works ================= */}
        <section id="how" className="sec" aria-labelledby="how-title">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="how-title" className="h2 max-w-3xl">
              A claim goes through seven stages. Only one of them is the model.
            </h2>
            <p className="lead mt-5">
              Select a stage to see who is responsible for it and what they are not allowed to do.
            </p>

            <div className="mt-10 grid gap-8 lg:grid-cols-[22rem_1fr]">
              <div role="tablist" aria-label="Stages" aria-orientation="vertical" className="flex flex-col gap-1">
                {STAGES.map((s, i) => (
                  <button
                    key={s.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    role="tab"
                    type="button"
                    id={`tab-${s.id}`}
                    aria-selected={stage === i}
                    aria-controls={`panel-${s.id}`}
                    tabIndex={stage === i ? 0 : -1}
                    className="tab"
                    onClick={() => setStage(i)}
                    onKeyDown={(e) => onTabKey(e, i)}
                  >
                    <span className="idx">{i + 1}</span>
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                    <span className="small">{s.who}</span>
                  </button>
                ))}
              </div>

              <div
                role="tabpanel"
                id={`panel-${current.id}`}
                aria-labelledby={`tab-${current.id}`}
                tabIndex={0}
                className="panel p-6 sm:p-8"
              >
                <div className="band" aria-label="Who is responsible">
                  <div data-on={current.group === "ai"}>AI interprets</div>
                  <div data-on={current.group === "rules"}>Rules verify</div>
                  <div data-on={current.group === "human"}>People decide</div>
                </div>
                {current.group === "input" && (
                  <p className="muted small mt-2">Inputs are untrusted until the stages after this one have checked them.</p>
                )}
                <h3 className="h3 mt-6">
                  {stage + 1}. {current.name}
                </h3>
                <p className="lead mt-2">{current.body}</p>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="small" style={{ fontWeight: 500 }}>
                      It does
                    </p>
                    <ul className="mt-2 space-y-2">
                      {current.does.map((d) => (
                        <li key={d} className="small flex gap-2">
                          <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--ok)" }} aria-hidden="true" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="small" style={{ fontWeight: 500 }}>
                      It cannot
                    </p>
                    <ul className="mt-2 space-y-2">
                      {current.cannot.map((d) => (
                        <li key={d} className="small flex gap-2">
                          <X size={15} className="mt-0.5 shrink-0" style={{ color: "var(--bad)" }} aria-hidden="true" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= Dignity Score ================= */}
        <section id="dignity" className="sec" aria-labelledby="dignity-title" style={{ background: "var(--surface)" }}>
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="dignity-title" className="display max-w-4xl" style={{ fontSize: "clamp(2.2rem,5vw,4rem)" }}>
              Measure contributions without reducing people to numbers.
            </h2>
            <p className="lead mt-5">
              The Dignity Score is TaskPilot’s approach to evidence-based contribution evaluation. It lays out what was claimed, what supports it,
              what is missing and what happens next, so a person can read the reasoning and disagree with it.
            </p>

            <div className="mt-12 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <ul className="space-y-4">
                  {DIGNITY_PRINCIPLES.map((p) => (
                    <li key={p} className="flex gap-3">
                      <ShieldCheck size={18} className="accent mt-1 shrink-0" aria-hidden="true" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="panel-2 mt-8 p-4">
                  <p className="small" style={{ fontWeight: 500 }}>
                    What it will not do
                  </p>
                  <p className="muted small mt-1">
                    Rank people, apply penalties automatically, or claim a scientific measure of worth. This page shows no numeric score and
                    publishes no formula or weights.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: 500 }}>Evaluation record</span>
                    <span className="chip chip-neutral">Fictional example</span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open.map(() => !allOpen))}>
                    {allOpen ? "Collapse all" : "Expand all"}
                  </button>
                </div>
                <div className="panel" style={{ padding: "0 1.25rem" }}>
                  {DIGNITY_PANELS.map((p, i) => (
                    <div key={p.title} className={i === 0 ? "" : "rule-t"}>
                      <h3>
                        <button
                          type="button"
                          id={`acc-btn-${i}`}
                          aria-expanded={open[i]}
                          aria-controls={`acc-${i}`}
                          onClick={() => setOpen(open.map((v, j) => (j === i ? !v : v)))}
                          className="flex w-full items-center justify-between gap-3 py-4 text-left"
                          style={{ cursor: "pointer" }}
                        >
                          <span style={{ fontWeight: 500 }}>{p.title}</span>
                          <span className="flex items-center gap-3">
                            <Chip tone={p.tone}>{p.label}</Chip>
                            <ChevronDown
                              size={16}
                              aria-hidden="true"
                              className="muted"
                              style={{ transform: open[i] ? "rotate(180deg)" : "none", transition: reduceMotion ? "none" : "transform .2s" }}
                            />
                          </span>
                        </button>
                      </h3>
                      <div id={`acc`.concat("-", String(i))} role="region" aria-labelledby={`acc-btn-${i}`} className="acc" data-open={open[i]} inert={!open[i]}>
                        <div>
                          <p className="muted pb-4">{p.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="muted small mt-3">
                  Evidence states always carry a word and an icon, never colour alone. Fictional people, repositories and results illustrate the
                  interface and describe no real evaluation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= Agent demo ================= */}
        <section id="demo" className="sec" aria-labelledby="demo-title">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="demo-title" className="h2 max-w-3xl">
              Step through a real kind of run.
            </h2>
            <p className="lead mt-5">
              A blocker report moves through the agent. This demonstration is deterministic and runs in your browser. It sends nothing to Slack or
              GitHub and changes no tasks.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Demonstration controls">
              {playing ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setPlaying(false)}>
                  <Pause size={14} aria-hidden="true" /> Pause
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={play}>
                  <Play size={14} aria-hidden="true" /> {demoStep >= LAST ? "Play again" : "Play"}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={demoStep === 0}
                onClick={() => {
                  setPlaying(false);
                  setDemoStep((s) => Math.max(0, s - 1));
                }}
              >
                <SkipBack size={14} aria-hidden="true" /> Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={demoStep >= LAST}
                onClick={() => {
                  setPlaying(false);
                  setDemoStep((s) => Math.min(LAST, s + 1));
                }}
              >
                Next <SkipForward size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setPlaying(false);
                  setDemoStep(0);
                }}
              >
                <RotateCcw size={14} aria-hidden="true" /> Reset
              </button>
              <span className="chip chip-neutral ml-auto">Demonstration</span>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
              <ol className="flex flex-col gap-1" aria-label="Steps">
                {DEMO.map((d, i) => (
                  <li key={d.title}>
                    <button
                      type="button"
                      className="tab"
                      aria-current={demoStep === i ? "step" : undefined}
                      aria-selected={demoStep === i}
                      onClick={() => {
                        setPlaying(false);
                        setDemoStep(i);
                      }}
                    >
                      <span className="idx">{i < demoStep ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
                      <span style={{ fontWeight: 500 }}>{d.title}</span>
                      <span />
                    </button>
                  </li>
                ))}
              </ol>

              <div className="grid gap-4">
                <div aria-live="polite" className="panel p-5">
                  <p className="h3">
                    {demoStep + 1}. {demo.title}
                  </p>
                  <p className="muted mt-1">{demo.blurb}</p>
                  <p className="small mt-5" style={{ fontWeight: 500 }}>
                    {demo.card.title}
                  </p>
                  <div className="mt-2">
                    {demo.card.rows.map((r) => (
                      <div key={r.k} className="kv">
                        <span className="k muted small">{r.k}</span>
                        <span className="small">{r.v}</span>
                        <span>{r.tone && r.label ? <Chip tone={r.tone}>{r.label}</Chip> : null}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel-2 p-4">
                  <p className="muted small mb-2">Execution log</p>
                  <div ref={logRef} className="log" style={{ maxHeight: "13rem", overflowY: "auto" }} tabIndex={0} role="log" aria-label="Execution log">
                    <ul>
                      {DEMO.slice(0, demoStep + 1).flatMap((d, i) =>
                        d.log.map((line, j) => (
                          <li key={`${i}-${j}`} className={i === demoStep ? "" : "muted"}>
                            {line}
                          </li>
                        )),
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= Integrations ================= */}
        <section id="integrations" className="sec" aria-labelledby="int-title">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="int-title" className="h2 max-w-3xl">
              Slack is where work is discussed. GitHub is where it leaves evidence.
            </h2>
            <p className="lead mt-5">
              Both panels below use fictional data. After you sign in, Admin, then Integrations, shows the real connection state for your workspace.
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="h3 flex items-center gap-2">
                    <MessageSquare size={20} className="accent" aria-hidden="true" /> Slack
                  </h3>
                  <span className="chip chip-neutral">Demonstration</span>
                </div>
                <ul className="muted small mt-4 space-y-1">
                  <li>Connect an authorized workspace and limit it to the channels you choose.</li>
                  <li>Link each Slack account to a workspace member.</li>
                  <li>Claims are extracted, validated, then applied to the task.</li>
                </ul>
                <div className="panel-2 mt-5 p-4">
                  <p className="small">
                    <span style={{ fontWeight: 500 }}>TaskPilot</span>{" "}
                    <span className="muted">to Leo K.</span>
                  </p>
                  <p className="small mt-1">What’s the status of the payment API integration? Anything blocking you?</p>
                  <p className="small mt-4">
                    <span style={{ fontWeight: 500 }}>Leo K.</span>
                  </p>
                  <p className="small mt-1">The API is connected, but I’m waiting for test credentials.</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="small">
                    PAY-4: <span style={{ fontWeight: 500 }}>In progress to Blocked</span>, “Waiting for test credentials”
                  </p>
                  <Chip tone="ok">Validated, then applied</Chip>
                </div>
              </div>

              <div className="panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="h3 flex items-center gap-2">
                    <GitPullRequest size={20} className="accent" aria-hidden="true" /> GitHub
                  </h3>
                  <span className="chip chip-neutral">Demonstration</span>
                </div>
                <ul className="muted small mt-4 space-y-1">
                  <li>Link repositories to projects through the GitHub App.</li>
                  <li>Read pull requests, commits, reviews and checks the app is permitted to see.</li>
                  <li>Compare the author with the linked account and keep a source for every item.</li>
                </ul>
                <div className="panel-2 mt-5 p-4">
                  <p className="small flex items-center gap-2" style={{ fontWeight: 500 }}>
                    <GitBranch size={14} aria-hidden="true" /> acme/checkout
                  </p>
                  <div className="mt-2">
                    {[
                      { k: "PR #52", v: "Integrate payment API client", tone: "info" as Tone, label: "Open" },
                      { k: "Commits", v: "2 by Leo K.", tone: "ok" as Tone, label: "Author matches" },
                      { k: "Review", v: "None yet", tone: "info" as Tone, label: "Not requested" },
                      { k: "Checks", v: "1 pending", tone: "warn" as Tone, label: "Pending" },
                    ].map((r) => (
                      <div key={r.k} className="kv">
                        <span className="k muted small">{r.k}</span>
                        <span className="small">{r.v}</span>
                        <Chip tone={r.tone}>{r.label}</Chip>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="muted small mt-3 px-1">
                  A commit does not prove delivery, and a missing commit does not prove nothing happened. Evidence informs the review. It does not
                  replace it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= Security ================= */}
        <section id="security" className="sec" aria-labelledby="sec-title" style={{ background: "var(--surface)" }}>
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="sec-title" className="h2 max-w-3xl">
              An agent should be powerful. Its permissions should be precise.
            </h2>
            <p className="lead mt-5">
              Content flows down this stack and only gets more trusted as it passes each layer. The model sits near the top, where it can propose
              and nothing else.
            </p>

            <div className="mt-12 grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
              <ol className="space-y-5" aria-label="Trust boundary, from external input to auditable outcome">
                {LAYERS.map((l) => {
                  const key = l.key === "ai" ? "ai" : l.key === "rules" ? "rules" : l.key === "human" ? "human" : "other";
                  return (
                    <li key={l.key} className="layer" data-key={key}>
                      <span className="zone small" style={{ fontWeight: 500, color: key === "ai" ? "var(--accent)" : undefined }}>
                        {l.zone}
                      </span>
                      <span className="spine" aria-hidden="true">
                        <span className="dot" />
                      </span>
                      <div>
                        <p style={{ fontWeight: 500 }}>{l.name}</p>
                        <p className="muted small mt-1">{l.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div>
                <p style={{ fontWeight: 500 }}>Controls and principles</p>
                <ul className="mt-4">
                  {CONTROLS.map((c, i) => (
                    <li key={c.text} className={`flex items-start justify-between gap-4 py-3 ${i === 0 ? "" : "rule-t"}`}>
                      <span className="small">{c.text}</span>
                      <span className={`chip ${c.kind === "code" ? "chip-ok" : "chip-neutral"}`}>
                        {c.kind === "code" ? "In the codebase" : "Design principle"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="muted small mt-4">
                  TaskPilot makes no compliance, certification or encryption claims on this page. Review the repository before relying on any
                  control with production data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= Product / project management ================= */}
        <section id="product" className="sec" aria-labelledby="product-title">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="product-title" className="h2 max-w-3xl">
              Still a project manager, from assignment to verified outcome.
            </h2>
            <p className="lead mt-5">
              The contribution record sits on top of ordinary project management, so the work and its evidence live in one workspace.
            </p>

            <div className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <dl>
                {PRODUCT_ROWS.map((r, i) => (
                  <div key={r.name} className={`py-4 ${i === 0 ? "" : "rule-t"}`}>
                    <dt className="flex items-center gap-2" style={{ fontWeight: 500 }}>
                      <LayoutList size={15} className="accent" aria-hidden="true" /> {r.name}
                    </dt>
                    <dd className="muted small mt-1">{r.text}</dd>
                  </div>
                ))}
              </dl>

              <div className="panel p-5" aria-label="Illustrative task board">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span style={{ fontWeight: 500 }}>Tasks</span>
                  <span className="chip chip-neutral">Demonstration data</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BOARD.map((b) => (
                    <div key={b.task} className="panel-2 p-4">
                      <Chip tone={b.tone}>{b.col}</Chip>
                      <p className="mt-3" style={{ fontWeight: 500 }}>
                        {b.title}
                      </p>
                      <p className="muted small mt-1">
                        {b.task}, {b.who}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="muted small mt-4">Feature availability depends on how your workspace is configured.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= Why it is different ================= */}
        <section id="impact" className="sec" aria-labelledby="impact-title" style={{ background: "var(--surface)" }}>
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="impact-title" className="h2 max-w-3xl">
              Not another AI task manager.
            </h2>
            <p className="lead mt-5">
              TaskPilot treats AI as a reader, rules as the decision-maker and people as the final word on anything uncertain. It makes no claims
              about users, time saved or accuracy.
            </p>
            <div className="panel mt-10 overflow-x-auto">
              <table>
                <caption className="sr-only">How TaskPilot differs from a typical AI task manager</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">A typical AI task manager</th>
                    <th scope="col" className="col-tp">
                      TaskPilot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.q}>
                      <th scope="row">{r.q}</th>
                      <td className="muted">{r.a}</td>
                      <td className="col-tp">{r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================= Final CTA ================= */}
        <section className="sec" aria-labelledby="cta-title">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 id="cta-title" className="display max-w-4xl" style={{ fontSize: "clamp(2.2rem,5vw,4rem)" }}>
              Make project progress visible. Make contribution understandable.
            </h2>
            <p className="lead mt-5">Evidence, context and a person in the loop, in one workspace.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-primary">
                Get started <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#demo" className="btn btn-ghost">
                See how the agent works
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ================= Footer ================= */}
      <footer className="rule-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:justify-between">
          <div>
            <p className="h3">TaskPilot</p>
            <p className="muted small mt-1 max-w-xs">An AI teammate that catches invisible blockers and keeps contribution explainable.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 small sm:grid-cols-3">
            <a href="#product" className="muted">Product</a>
            <a href="#how" className="muted">How it works</a>
            <a href="#dignity" className="muted">Dignity Score</a>
            <a href="#integrations" className="muted">Integrations</a>
            <a href="#security" className="muted">Security</a>
            <Link href="/login" className="muted">Sign in</Link>
            <Link href="/onboarding" className="muted">Onboarding</Link>
          </nav>
        </div>
      </footer>
>>>>>>> 7e3ba8dce8d2eb49edf722158a9ae722e4007d9b
    </div>
  );
}