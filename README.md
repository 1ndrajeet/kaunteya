# TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform

> **Status:** Handoff 1.5 Complete (Multi-User Hierarchy, Project-Scoped Teams, Context-Aware Navigation, Atomic Limits & Production Billing Foundation)  
> **Architecture:** Next.js App Router (TypeScript, Tailwind CSS v4, shadcn/ui) + Supabase (PostgreSQL, Row Level Security, Auth with GitHub OAuth) + Official Slack Web API (`@slack/web-api`) + GitHub App Integration (`@octokit/rest`, `@octokit/auth-app`)

---

## 1. Product Vision

**TaskPilot** coordinates work between administrators, team leads, members, and autonomous agents across multiple projects and teams. Traditional project management software records tasks, but the actual coordination, updates, and blockers get lost in Slack channels and GitHub repositories.

TaskPilot bridges this gap through:
1. **Multi-User & Project-Centric Architecture** with isolated project membership and project-scoped teams.
2. **Dual-Context Vercel-Inspired Navigation** seamlessly switching between workspace-level governance and project execution.
3. **Structured Project & Task Management** with dual Kanban board and tabular list views, plus mandatory status-transition reason audits.
4. **Project Lifecycle & Derived Deadline Intelligence** distinguishing planning, active, at-risk, completed, paused, and archived states.
5. **Configurable Server Limits & Anti-Bypass Protection** with atomic database-level enforcement and upgrade dialogs.
6. **Production-Minded Billing Foundation** supporting commercial plans, integer minor units, and auditable promotional codes.
7. **Conversational Intake** (Phase 2 Implemented) via verified Slack mentions, deterministic routing, and thread replies.
8. **Follow-up Automation** (Phase 2 Implemented) pro-actively chasing task progress without manual lead intervention.
9. **Intelligent Routing Agent** (Phase 3 Implemented) evaluating workspace context, candidate eligibility, and open workloads.
10. **GitHub Evidence Intelligence** (Phase 3 Implemented) correlating explicit work claims against real commits, PRs, reviews, and CI runs.
11. **Human Claim Review Workflow** (Phase 3 Implemented) with anti-self-approval enforcement and tamper-evident audit trails.
12. **Contribution Reliability Intelligence** (Phase 4 Roadmap) with human-reviewed audit trails.

---

## 2. Multi-Phase Roadmap & Architecture

| Phase / Milestone | Scope & Status |
| :--- | :--- |
| **Phase 1: Foundation & Auth** | **LIVE / IMPLEMENTED**<br>&bull; GitHub OAuth & persistent session handling<br>&bull; Non-recursive PostgreSQL Row Level Security (RLS)<br>&bull; Task CRUD, unassigned triage inbox, dual Kanban board & List views<br>&bull; Tamper-evident audit trail (`activity_events`) |
| **Phase 2: Slack Integration** | **LIVE / IMPLEMENTED**<br>&bull; Slack workspace connection & identity mapping<br>&bull; Secure Events API receiver (`/api/slack/events`) with URL verification & HMAC-SHA256 signature checks<br>&bull; Idempotent event ingestion preventing duplicate tasks on Slack retries<br>&bull; Deterministic Task Routing Engine (Rules A through G) & automated follow-ups (`/api/slack/followup`) |
| **Phase 3: Intelligent Routing & Evidence** | **LIVE / IMPLEMENTED**<br>&bull; Agent-assisted task routing evaluating Rules 1-7 with candidate validation & fallback<br>&bull; GitHub App integration via `@octokit/rest` with HMAC-SHA256 webhooks (`/api/github/webhooks`)<br>&bull; Delivery ID idempotency & bounded repository synchronization (`/api/github/sync`)<br>&bull; Explicit member work claims (`work_claims`) & GitHub artifact normalization (`evidence_artifacts`)<br>&bull; Deterministic evidence assessment engine & Admin Claim Review portal (`/admin/reviews`) |
| **Handoff 1.5: Multi-User, Project Teams & Billing** | **LIVE / IMPLEMENTED**<br>&bull; Multi-user hierarchy: User &rarr; Workspace &rarr; Projects &rarr; Teams &rarr; Team Members<br>&bull; Project-scoped team leadership eliminating the obsolete single-lead workspace constraint<br>&bull; Dual-context Vercel-inspired sidebar with dynamic project switching<br>&bull; Visual project cards with lifecycle states & date-derived deadline indicators<br>&bull; Mandatory status change reasons (&ge; 3 chars) recorded atomically in task history & audit events<br>&bull; Atomic workspace & project limits with anti-bypass PostgreSQL transactions (`create_workspace_with_admin`, `create_project_with_limits`)<br>&bull; Polished pricing & upgrade modal on limit triggers<br>&bull; Production billing schema (`plans`, `workspace_subscriptions`, `promo_codes`, `promo_redemptions`) with minor unit amounts |
| **Phase 4: Contribution Reliability** | **PLANNED / DEFERRED**<br>&bull; Contribution Reliability Score (CRS) based on verified evidence<br>&bull; Dispute, appeal, and correction workflows<br>&bull; Delivery analytics & audit retention |

*Note: In accordance with product honesty principles, live payment transactions via Razorpay and Phase 4 contribution scoring remain strictly deferred to subsequent releases and are not simulated or faked.*

---

## 3. Hierarchy & Permission Matrix (Handoff 1.5)

TaskPilot enforces an explicit 4-level organizational hierarchy:
```
Workspace (Owner / Admin, Members)
  └── Projects (Project Members: Lead, Member, Viewer)
        └── Teams (Team Leader, Team Members)
              └── Tasks (Assigned to Individual or Project Team)
```

### Permission Matrix

| Capability | Workspace Admin | Project Lead | Team Leader | Member |
| :--- | :---: | :---: | :---: | :---: |
| Create & Archive Projects | Yes | No | No | No |
| Invite Users to Workspace | Yes | No | No | No |
| Create Project Teams | Yes | Yes | No | No |
| Assign / Transfer Team Members | Yes | Yes | Own Team Only | No |
| Create Tasks & Assign Scope | Yes | Yes | Yes | Yes |
| Transition Task Status | Yes (with reason) | Yes (with reason) | Yes (with reason) | Assigned (with reason) |
| Connect Integrations & Review Claims | Yes | No | No | No |
| View Billing & Enter Promo Codes | Yes | No | No | No |

---

## 4. Database Schema & Migrations

The database schema is managed via versioned PostgreSQL migrations:

1. **Phase 1 Initial Schema:**  
   `supabase/migrations/20261016000000_taskpilot_initial_schema.sql`
2. **Phase 2 Slack Integration & Follow-up Schema:**  
   `supabase/migrations/20261016000001_taskpilot_phase2_slack.sql`
3. **Phase 3 GitHub App, Evidence Intelligence & Routing Schema:**  
   `supabase/migrations/20261016000002_taskpilot_phase3_github_evidence.sql`
4. **RBAC & Grants Fixes:**  
   `supabase/migrations/20261016000003_fix_workspace_rbac_and_grants.sql`
5. **Handoff 1.5 Multi-User, Project Teams, Limits & Billing Schema:**  
   `supabase/migrations/20261017000000_handoff_1_5_multiuser_teams_billing_limits.sql`

### Core Tables

#### Application Foundation & Multi-User Governance
1. **`profiles`**: Application profile synced with `auth.users` via trigger (`id`, `email`, `github_username`, `display_name`, `avatar_url`, `created_at`, `updated_at`).
2. **`workspaces`**: Organizational units (`id`, `name`, `slug`, `created_by`, `created_at`, `updated_at`).
3. **`workspace_members`**: Membership and roles (`id`, `workspace_id`, `user_id`, `role: 'admin' | 'lead' | 'member'`, `joined_at`).
4. **`workspace_invitations`**: Expiring, single/multi-use invitation codes (`id`, `workspace_id`, `invited_by`, `code`, `role`, `max_uses`, `uses_count`, `expires_at`, `created_at`).
5. **`projects`**: Workspace initiatives with lifecycle states (`planning`, `active`, `at_risk`, `completed`, `paused`, `archived`) and `completed_at`.
6. **`project_members`**: Project-level member enrollment with role scopes (`id`, `workspace_id`, `project_id`, `user_id`, `role: 'lead' | 'member' | 'viewer'`).
7. **`teams`**: Project-scoped teams (`id`, `workspace_id`, `project_id`, `lead_id`, `name`, `description`, `status`).
8. **`team_members`**: Team membership linking members to a project team (`id`, `workspace_id`, `project_id`, `team_id`, `user_id`).
9. **`tasks`**: Canonical tasks with assignment type (`individual` | `team`), `team_id`, mandatory `status_reason`, `status_changed_by`, and `status_changed_at`.
10. **`task_comments`**: Task discussion & progress updates (`id`, `task_id`, `author_id`, `body`, `created_at`, `updated_at`).
11. **`activity_events`**: Tamper-evident audit trail (`id`, `workspace_id`, `actor_id`, `entity_type`, `entity_id`, `event_type`, `metadata`, `created_at`).

#### Billing Foundation & Commercial Plans
12. **`plans`**: Commercial catalog (`id: 'free' | 'yearly' | 'onetime'`, `price_cents`, `currency`, `billing_interval`, `max_workspaces`, `max_projects_per_workspace`, `features`, `is_active`).
13. **`workspace_subscriptions`**: Entitlement journal (`id`, `workspace_id`, `plan_id`, `status`, `current_period_start`, `current_period_end`, `payment_provider`).
14. **`promo_codes`**: Promotional discount and full-access vouchers (`code: 'LAUNCH50' | 'FOUNDER100'`, `discount_percent`, `max_redemptions`, `redemptions_count`, `is_active`, `expires_at`).
15. **`promo_redemptions`**: Auditable redemption log tracking user redemptions with unique `(promo_code_id, user_id)` constraint.

#### Integrations & Evidence Intelligence
16. **`slack_installations`**, **`slack_installation_secrets`**, **`slack_user_mappings`**, **`slack_conversations`**, **`integration_events`**, **`task_followups`**, **`external_messages`**.
17. **`github_installations`**, **`github_installation_secrets`**, **`github_repositories`**, **`github_user_mappings`**, **`github_events`**, **`evidence_artifacts`**, **`work_claims`**, **`claim_evidence_associations`**, **`routing_decisions`**.

---

## 5. Application Routes

| Route | Purpose | Access Control |
| :--- | :--- | :--- |
| `/` | Marketing landing page | Public |
| `/login` | GitHub OAuth sign-in & configuration guide | Public |
| `/auth/callback` | OAuth session code exchange | Public |
| `/onboarding` | Workspace creation & invitation redemption (Enforces limit) | Authenticated |
| `/workspace/[workspaceId]` | Role-based dashboard redirector | Workspace Member |
| `/workspace/[workspaceId]/tasks` | Unified Task Center (Kanban & List views, Evidence Drawer, Status Reason Modal) | Workspace Member |
| `/workspace/[workspaceId]/incoming` | Unassigned task triage inbox with Agent Recommendations | Workspace Member |
| `/workspace/[workspaceId]/billing` | Plan overview, resource usage gauges, promo code redemption & upgrade actions | Workspace Member |
| `/workspace/[workspaceId]/admin` | Administrator governance dashboard | Admin only |
| `/workspace/[workspaceId]/admin/team` | Team management & invite code generator | Admin only |
| `/workspace/[workspaceId]/admin/integrations` | Slack & GitHub App connection, member identity mapping & event diagnostics | Admin only |
| `/workspace/[workspaceId]/admin/reviews` | Claim & Evidence Review Queue (Anti-self-approval enforced) | Admin only |
| `/workspace/[workspaceId]/lead` | Team Lead execution portal | Lead & Admin |
| `/workspace/[workspaceId]/team` | Team workload & delivery distribution | Lead & Admin |
| `/workspace/[workspaceId]/member` | Member portal with "My Tasks" focus | Member & All |
| `/workspace/[workspaceId]/profile` | Developer identity & verified GitHub App linkage | Workspace Member |
| `/workspace/[workspaceId]/projects` | Workspace projects with lifecycle badges, deadline indicators & creation limits | Workspace Member |
| `/workspace/[workspaceId]/projects/[projectId]` | Project detail: Overview, Tasks, Project Teams & Members, GitHub, Activity, Settings | Workspace Member |
| `/workspace/[workspaceId]/activity` | Tamper-evident audit trail & JSON inspector | Workspace Member |
| `/api/slack/events` | Official Slack Events API receiver (URL verification, bot mentions, thread updates) | Slack Webhook (HMAC signed) |
| `/api/slack/followup` | Automated follow-up dispatch sweep endpoint | Protected by `CRON_SECRET` |
| `/api/github/webhooks` | Official GitHub App webhook receiver (timing-safe HMAC-SHA256, delivery idempotency) | GitHub Webhook (HMAC signed) |
| `/api/github/sync` | Bounded repository artifact backfill & synchronization endpoint | Admin or internal caller |

---

## 6. Slack Integration Setup & Operations Guide

TaskPilot connects to Slack via the official Slack Web API and Events API. It does not ingest unrelated conversations; it only processes explicit bot mentions (`@TaskPilot`) and thread replies to task follow-ups.

### 1. Create a Slack App

1. Visit [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** -> **From an app manifest**.
2. Select your development workspace.
3. Paste the following manifest (YAML):

```yaml
display_information:
  name: TaskPilot
  description: AI-assisted project management and contribution intelligence bot
  background_color: "#18181b"
features:
  bot_user:
    display_name: TaskPilot
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - channels:read
      - channels:history
      - groups:history
      - im:history
      - im:write
      - users:read
      - users:read.email
settings:
  event_subscriptions:
    request_url: https://<your-public-domain>/api/slack/events
    bot_events:
      - app_mention
      - message.im
      - message.channels
```

4. Install the App to your workspace.

### 2. Configure Environment Variables

Retrieve your **Bot User OAuth Token** (`xoxb-...`) from **OAuth & Permissions** and your **Signing Secret** from **Basic Information**.

In `frontend/.env.local`:
```env
# Server-side Slack credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Server-side Supabase Service Role Key (for webhooks & cron)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Follow-up Automation Secret
CRON_SECRET=your-custom-cron-secret
```

### 3. Connect Slack in TaskPilot Admin Portal

1. Log in to TaskPilot as an **Administrator**.
2. Navigate to **Admin -> Slack & Integrations** (`/workspace/[workspaceId]/admin/integrations`).
3. Enter your **Slack Team ID** (e.g. `T0123456789`) and **Bot User ID** (e.g. `U0987654321`), then click **Connect Slack Workspace**.
4. The system validates the credentials against the Slack API and transitions status to **Active Connection**.

### 4. Link Slack Identities to TaskPilot Members

TaskPilot requires explicit identity mapping:
1. In **Admin -> Slack & Integrations -> Slack Member Identity Mapping**, view the list of workspace members.
2. Enter each member's Slack User ID (e.g. `U01ABCDEF`) and click **Save Mapping**.
3. Members can also verify their link status on their personal **Developer Profile** page (`/workspace/[workspaceId]/profile`).
4. Unlinked Slack users cannot perform task mutations; the bot will explain that identity linkage is required.

### 5. Conversational Task Intake Patterns

Invite the bot to a channel: `/invite @TaskPilot`.

Create tasks naturally via explicit mentions:
- `@TaskPilot create a task to implement password reset in auth project, high priority, due Friday`
- `@TaskPilot create a task for @Alice: Add unit tests for payment webhook, priority urgent, due 2026-11-01`
- `@TaskPilot help`

**Supported Parameters Extracted:**
- **Title & Description:** Natural task summary following "create a task to..."
- **Project Context:** Matched against existing project names and identifiers (e.g. `auth` -> `AUTH-Project`).
- **Priority:** `low`, `medium`, `high`, `urgent` / `critical`.
- **Due Date:** Relative dates (`today`, `tomorrow`, `next Monday`, `due Friday`) or ISO dates (`2026-10-31`).
- **Assignee Routing:** Resolved via Deterministic Routing Rules A–G.

### 6. Deterministic Task Routing Rules (Phase 2)

No artificial intelligence is claimed or faked in Phase 2. Task routing operates strictly on deterministic rules:

- **Rule A (Explicit Valid Assignee):** If requester names a member who is linked to the workspace and the requester has assignment privileges, assign the task directly. If requester lacks privilege, task is created unassigned in the Lead's incoming queue.
- **Rule B (No Explicit Assignee):** Task is created unassigned and routed to the designated Team Lead's incoming triage queue.
- **Rule C (Ambiguous Ownership):** Task is left unassigned and routed to the Lead for triage.
- **Rule D (Explicit Lead Assignment):** If requester assigns to the designated Lead, assign to Lead.
- **Rule E (Ineligible Assignee):** If named assignee is not in the workspace, bot explains the issue and suggests valid members.
- **Rule F (No Designated Lead):** If workspace lacks a designated lead, task is created unassigned and administrators are notified to designate a lead.
- **Rule G (Existing Task Update):** If the message references an existing task identifier (e.g. `CORE-14`), the bot updates the task rather than creating a duplicate.

### 7. Automated Progress Follow-ups

TaskPilot automates chasing progress updates without lead intervention:

1. **Scheduled Sweep:** The endpoint `/api/slack/followup` evaluates active, in-progress tasks assigned to linked members that have not received an update within the configured policy window (e.g. 24 hours).
2. **Triggering the Sweep:**
   ```bash
   curl -X GET "http://localhost:3000/api/slack/followup" \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
   *(Can also be triggered manually via the Admin Integrations dashboard).*
3. **Follow-up Message:** The bot sends a direct Slack message or thread prompt:
   > *"Quick update on CORE-14: Add password reset support. Is it still in progress, completed, or blocked? Reply with your status and any blocker."*
4. **Member Reply:**
   - Member replies: *"Still in progress. Email delivery is working, now fixing token expiry tests."*
   - TaskPilot records the message as a real task comment, updates `task_followups` status to `responded`, and updates `tasks.updated_at`.
   - If the member replies *"Done"* or *"Completed"*, the status transitions to `completed`.
   - If ambiguous, the bot asks for clarification rather than guessing.

### 8. Security & Idempotency Guarantees

- **HMAC-SHA256 Verification:** Slack requests are verified against `x-slack-signature` using the raw request body and `x-slack-request-timestamp`. Stale requests (>300 seconds) are rejected.
- **Idempotency via `integration_events`:** Slack webhook retries are matched against the unique index on `(provider, external_event_id)`. If an event was already processed, HTTP 200 is returned immediately to prevent duplicate task creation.
- **Strict Role Separation:** ordinary workspace members cannot query `slack_installation_secrets` or perform administrative integration changes.

---

## 7. GitHub App Integration & Evidence Intelligence Guide

TaskPilot connects to GitHub using a GitHub App rather than personal account OAuth. This guarantees repository-scoped permissions, short-lived installation access tokens, and enterprise-grade security.

### 1. Register a GitHub App

1. In GitHub, go to **Settings -> Developer Settings -> GitHub Apps -> New GitHub App**.
2. **App Name:** `TaskPilot Evidence Intelligence`
3. **Homepage URL:** `http://localhost:3000` (or production domain)
4. **Webhook URL:** `http://localhost:3000/api/github/webhooks`
5. **Webhook Secret:** Generate a random secret (set in `GITHUB_WEBHOOK_SECRET`).

### 2. Required Permissions (Read-Only)

Request the minimal necessary permissions:
- **Repository metadata:** Read-only (repository identification)
- **Repository contents:** Read-only (commit SHAs, messages, and timestamps)
- **Pull requests:** Read-only (PR status, author, merge state, review summaries)
- **Commit statuses & Checks:** Read-only (check runs, test suite conclusions)

### 3. Subscribe to Webhook Events

- `pull_request` (opened, closed, reopened, edited, merged)
- `pull_request_review` (submitted, edited)
- `push` (commit additions, branch updates)
- `check_run` / `check_suite` (completed, rerequested)

### 4. Generate Private Key

Under **Private keys**, click **Generate a private key** and download the `.pem` file. Save its content into `GITHUB_APP_PRIVATE_KEY`.

### 5. Evidence Triage Categories

When a member submits a work claim, the Evidence Assessment Engine evaluates real GitHub artifacts against the claim text:
- **`supporting_found`**: Authorized PR is merged, checks passed, or matching commit SHA verified.
- **`partially_supported`**: PR is open or some tests have not yet finished.
- **`conflicting_found`**: Claim asserts completion, but PR is closed unmerged or CI checks failed.
- **`insufficient`**: No artifacts match the explicit task identifier or author mapping.

Human reviewers make the final decision in `/admin/reviews` with a recorded rationale. **Claimants cannot approve their own claims** (enforced by database constraint `chk_claim_no_self_approval`).

---

## 8. Environment Setup & Local Development

### Prerequisites
- Node.js 20+ (Node 22 LTS recommended)
- pnpm 9+ or 10+ (`corepack enable pnpm` or `npm install -g pnpm`)

### 1. Environment Configuration

Copy the example environment file:
```bash
cp frontend/.env.example frontend/.env.local
```

Fill in your Supabase, Slack, GitHub App, and Gemini credentials in `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Server-Side Privileged Key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Slack Integration Credentials
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
CRON_SECRET=your-cron-secret

# GitHub App Integration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_optional_fallback_token

# Intelligent Task Routing & Evidence Summarization
GEMINI_API_KEY=your-gemini-api-key

# Server-Side Plan & Resource Limits (Handoff 1.5)
TASKPILOT_MAX_WORKSPACES_PER_USER=1
TASKPILOT_MAX_PROJECTS_PER_WORKSPACE=5
```

### 2. GitHub OAuth Setup in Supabase
1. Create an OAuth App on GitHub: **Settings -> Developer settings -> OAuth Apps -> New OAuth App**.
   - **Application Name:** TaskPilot Local
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `https://<your-supabase-project>.supabase.co/auth/v1/callback`
2. In Supabase Dashboard: **Authentication -> Providers -> GitHub**.
   - Toggle **Enable GitHub**.
   - Paste the **Client ID** and **Client Secret**.
   - In **Authentication -> URL Configuration**, add `http://localhost:3000/**` to **Redirect URLs**.

### 3. Installation & Verification

```bash
# Navigate to frontend
cd frontend

# Install dependencies
pnpm install

# Run unit tests (verify-signature, parser, routing, matcher, agent-router)
pnpm exec vitest run

# Run TypeScript type check
pnpm exec tsc --noEmit

# Run linter
pnpm run lint

# Build for production
pnpm run build

# Start development server
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. Verification & Acceptance Criteria Status

### Phase 1: Core Foundation
- [x] **Marketing Landing Page:** Polished, responsive, dark-first developer-tool aesthetic with live product preview, role breakdown, and honest roadmap.
- [x] **Authentication:** GitHub OAuth via Supabase Auth with callback handler, session persistence, and login guide accordion.
- [x] **Secure Onboarding:** Atomic `create_workspace_with_admin` transaction ensures workspace creator becomes Administrator without client-controlled role escalation.
- [x] **Single-Lead Invariant:** Database partial unique index guarantees $\le 1$ lead per workspace. Admin UI handles automatic lead demotion/reassignment safely.
- [x] **Invitation System:** Hashed/alphanumeric single/multi-use expiring invitation codes redeemed via `join_workspace_with_invite`.
- [x] **Role-Based Portals:** Meaningfully distinct views for Administrator, Team Lead, and Member.
- [x] **Core Task Management:** Dual Kanban board and List table, priority/status badges, assignee filters, search, task detail slide-over with inline edits and comments.
- [x] **Incoming Triage Inbox:** Unassigned task queue for team lead manual assignment and priority triage.
- [x] **Project Management:** Project creation, identifier generation, status tracking, manual GitHub repository URL association.
- [x] **Audit Trail:** Automatic recording of workspace events in `activity_events` with JSON payload inspection.
- [x] **Security:** Row Level Security (RLS) active on all tables with non-recursive security-definer helper functions.

### Phase 2: Slack Integration & Follow-up Automation
- [x] **Slack App Connection:** Connected Slack workspace management in Admin portal (`/workspace/[workspaceId]/admin/integrations`), storing metadata in Supabase and secrets in protected vault.
- [x] **Secure Event Ingestion:** Dedicated Route Handler (`/api/slack/events`) handling Slack URL verification challenges, timing-safe HMAC signature verification, and timestamp staleness rejection.
- [x] **Idempotent Webhooks:** Deduplication journal in `integration_events` table indexed on `(provider, external_event_id)` preventing duplicate tasks or comments on Slack delivery retries.
- [x] **Member Identity Mapping:** Dedicated mapping between Slack User IDs and TaskPilot members with uniqueness constraints and profile status views.
- [x] **Conversational Task Intake:** Natural-language parsing for task title, project identifier, priority levels, and relative/ISO due dates.
- [x] **Deterministic Task Routing Engine:** Rules A through G cleanly implemented and covered by automated test suites.
- [x] **Follow-up Automation:** Background sweep via `/api/slack/followup` chasing active assigned tasks, tracking states in `task_followups`.
- [x] **Thread Reply Processor:** Extracts member progress updates and blockers into canonical task comments, or transitions status when clearly stated.
- [x] **Origin Awareness:** Incoming queue and Task Detail slide-over visually distinguish Slack-originated tasks with deep-link badges.

### Phase 3: Intelligent Routing, GitHub Evidence & Human Review
- [x] **GitHub App Integration:** Full Octokit and App auth lifecycle (`@octokit/rest`, `@octokit/auth-app`) supporting repository selection, connection health, and secure token refresh.
- [x] **Timing-Safe Webhook Security:** Timing-safe HMAC-SHA256 signature verifier (`verifyGithubSignature`) rejecting unsigned or tampered GitHub deliveries.
- [x] **Delivery Idempotency:** Webhook journal table `github_events` with unique constraint on `delivery_id` eliminating duplicate artifact ingestion on GitHub retries.
- [x] **Bounded Artifact Synchronization:** Rate-limit-safe synchronization engine (`syncRepositoryArtifacts`) fetching pull requests, commits, reviews, and check runs up to configured limits.
- [x] **Member Work Claims Workflow:** Dedicated canonical table `work_claims` capturing explicit member assertions from dashboard or Slack replies.
- [x] **Anti-Self-Approval Enforcement:** Database CHECK constraint `chk_claim_no_self_approval` and UI safeguards preventing claimants from approving their own claims.
- [x] **Evidence Assessment Engine:** Deterministic factual matcher (`assessClaimEvidence`) comparing claims against real PR merge states, commit authors, and CI check conclusions.
- [x] **Admin Claim Review Portal:** Full review interface (`/workspace/[workspaceId]/admin/reviews`) with filterable queues, side-by-side evidence inspection (Claim vs GitHub vs System Assessment vs Human Decision), and append-only audit trail.
- [x] **Agent-Assisted Task Routing:** Upgraded routing engine (`evaluateAgentAssistedRouting`) evaluating Rules 1-7, candidate ID validation, transparent workload balancing, and decision persistence in `routing_decisions`.
- [x] **Triage & Detail Transparency:** Lead Incoming Queue displays 1-click Agent Recommendations; Task Detail Drawer displays full Agent Routing Decision rationale and verifiable GitHub evidence cards.
- [x] **Zero Mock Data in Production UI:** All views read and write directly through Supabase with Row Level Security.
- [x] **Phase 4 Strictly Deferred:** No automated contribution reliability scoring, employee rankings, or productivity ratings.
- [x] **Test Suite Passing:** 36 automated unit tests covering signature verification, parsers, routing engines, evidence matchers, and agent triage.

### Handoff 1.5: Multi-User Architecture, Project Teams, Limits & Billing Foundation
- [x] **Multi-User & Project-Centric Hierarchy:** Workspaces contain projects; projects contain teams; team leaders are scoped to their team; workspace-wide single-lead constraint eliminated.
- [x] **Context-Aware Dual-Mode Navigation:** Vercel-inspired sidebar switching cleanly between Workspace context and Project context with active states, project switchers, and breadcrumbs.
- [x] **Project Teams Management:** Dedicated project-level teams interface (`/projects/[projectId]`) allowing project lead and admin to create teams, assign leads, enroll members, and transfer members across teams via atomic `move_team_member` RPC.
- [x] **Project Lifecycle & Derived Deadline Indicators:** Meaningful lifecycle states (`planning`, `active`, `at_risk`, `completed`, `paused`, `archived`) and date-derived indicators (`completed_on_time`, `completed_late`, `overdue`, `closing_soon`, `deadline_approaching`, `on_track`, `no_deadline`) with subtle visual cards.
- [x] **Mandatory Status Change Reasons:** Audited status transitions requiring a minimum 3-character reason, recorded in `tasks.status_reason` and `activity_events` via `update_task_status_with_reason` RPC.
- [x] **Server-Side Configurable Limits:** Validated environment variables (`TASKPILOT_MAX_WORKSPACES_PER_USER=1`, `TASKPILOT_MAX_PROJECTS_PER_WORKSPACE=5`) with safe fallbacks.
- [x] **Atomic Anti-Bypass Protection:** Database-level transactional locking inside `create_workspace_with_admin` and `create_project_with_limits` eliminating concurrent limit bypass exploits.
- [x] **Polished Pricing & Upgrade Modal:** Context-preserving upgrade dialog explaining hit limits, displaying commercial plans, validating promotional codes, and providing an honest notice regarding upcoming Razorpay integration.
- [x] **Production Billing Foundation:** Lean, auditable PostgreSQL schema for plans, workspace subscriptions, promotional codes (`LAUNCH50`, `FOUNDER100`), redemptions log, and minor unit amounts. Zero simulated or mock payments.
- [x] **Automated Test Suite Passing:** 52 automated unit tests passing across all suites (`deadline-status`, `limits`, `verify-signature`, `parser`, `routing`, `matcher`, `agent-router`).
- [x] **Clean Production Build:** Zero TypeScript errors (`tsc --noEmit`), zero ESLint errors (`eslint --quiet`), and successful production compilation (`next build`).

