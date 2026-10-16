# TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform

> **Status:** Phase 2 Complete (Slack Integration, Conversational Task Intake & Follow-up Automation)  
> **Architecture:** Next.js App Router (TypeScript, Tailwind CSS v4, shadcn/ui) + Supabase (PostgreSQL, Row Level Security, Auth with GitHub OAuth) + Official Slack Web API (`@slack/web-api`)

---

## 1. Product Vision

**TaskPilot** coordinates work between administrators, team leads, members, and autonomous agents. Traditional project management software records tasks, but the actual coordination, updates, and blockers get lost in Slack channels.

TaskPilot bridges this gap through:
1. **Structured Project & Task Management** with dual Kanban board and tabular list views.
2. **Explicit Workspace Hierarchy** with enforced Administrator, Team Lead, and Member roles.
3. **Conversational Intake** (Phase 2 Implemented) via verified Slack mentions, deterministic routing, and thread replies.
4. **Follow-up Automation** (Phase 2 Implemented) pro-actively chasing task progress without manual lead intervention.
5. **Intelligent Routing Agent** (Phase 3 Roadmap) evaluating workload and project context.
6. **GitHub Evidence Retrieval** (Phase 3 Roadmap) linking commits, PRs, and review checks.
7. **Contribution Reliability Intelligence** (Phase 4 Roadmap) with human-reviewed audit trails.

---

## 2. Four-Phase Roadmap

| Phase | Title | Scope & Status |
| :--- | :--- | :--- |
| **Phase 1** | **Foundation, Auth & Project Management** | **LIVE / IMPLEMENTED**<br>&bull; GitHub OAuth & persistent session handling<br>&bull; Secure initial workspace onboarding & single-lead governance<br>&bull; Non-recursive PostgreSQL Row Level Security (RLS)<br>&bull; Complete Project & Task CRUD, unassigned triage inbox<br>&bull; Dual Kanban board & List table views<br>&bull; Manual repository linking & tamper-evident audit trail |
| **Phase 2** | **Slack Integration & Follow-up Automation** | **LIVE / IMPLEMENTED**<br>&bull; Slack workspace connection & identity mapping<br>&bull; Secure Events API receiver (`/api/slack/events`) with URL verification & HMAC-SHA256 signature checks<br>&bull; Idempotent event ingestion preventing duplicate tasks on Slack retries<br>&bull; Conversational task intake via explicit `@TaskPilot` mentions<br>&bull; Deterministic Task Routing Engine (Rules A through G)<br>&bull; Automated follow-up dispatch (`/api/slack/followup`) & thread reply parser<br>&bull; Admin Integration Portal with diagnostics, event logs, and connection lifecycle |
| **Phase 3** | **Task-Routing Agent & GitHub Evidence** | **PLANNED**<br>&bull; Lead-vs-member task-routing heuristics & LLM triage<br>&bull; Real GitHub API integration for PRs, commits, and checks<br>&bull; Automated evidence summaries & human dispute queue |
| **Phase 4** | **Contribution Reliability & Hardening** | **PLANNED**<br>&bull; Contribution Reliability Score (CRS) based on verified evidence<br>&bull; Dispute, appeal, and correction workflows<br>&bull; Delivery analytics & audit retention |

*Note: In accordance with product honesty principles, Phases 3 and 4 remain deferred and are not simulated or faked.*

---

## 3. Architecture & Strict Constraints

Phase 1 strictly complies with the following architecture:
- **No Custom REST API / No `/api/*` Routes:** Application CRUD operations are executed directly against Supabase PostgreSQL via `@supabase/supabase-js` and `@supabase/ssr`.
- **No Server Actions or `actions.ts`:** Data flow is client-to-database with strict PostgreSQL Row Level Security (RLS) enforcement.
- **No Query Abstraction Layers:** Direct, readable Supabase queries located within feature components and compact feature hooks.
- **Database-Level Role & Provisioning Guarantees:** 
  - Single designated lead per workspace enforced via a PostgreSQL partial unique index:  
    `CREATE UNIQUE INDEX idx_one_lead_per_workspace ON public.workspace_members (workspace_id) WHERE role = 'lead';`
  - Safe transactional provisioning via `SECURITY DEFINER` functions:  
    `create_workspace_with_admin()` and `join_workspace_with_invite()`.
  - Non-recursive RLS policy checks via `is_workspace_member()` and `get_workspace_role()`.
- **Legacy Backend Notice:** The existing FastAPI starter files in `backend/` are preserved as legacy reference artifacts. Supabase completely replaces any custom backend for TaskPilot.

---

## 4. Database Schema & Migrations

The database schema is managed via versioned PostgreSQL migrations:

1. **Phase 1 Initial Schema:**
   `supabase/migrations/20261016000000_taskpilot_initial_schema.sql`
2. **Phase 2 Slack Integration & Follow-up Schema:**
   `supabase/migrations/20261016000001_taskpilot_phase2_slack.sql`

### Core Tables

#### Phase 1: Application Foundation & Project Management
1. **`profiles`**: Application profile synced with `auth.users` via trigger (`id`, `email`, `github_username`, `display_name`, `avatar_url`, `created_at`, `updated_at`).
2. **`workspaces`**: Organizational units (`id`, `name`, `slug`, `created_by`, `created_at`, `updated_at`).
3. **`workspace_members`**: Membership and roles (`id`, `workspace_id`, `user_id`, `role: 'admin' | 'lead' | 'member'`, `joined_at`).
4. **`workspace_invitations`**: Expiring, single/multi-use invitation codes (`id`, `workspace_id`, `invited_by`, `code`, `role`, `max_uses`, `uses_count`, `expires_at`, `created_at`).
5. **`projects`**: Workspace initiatives (`id`, `workspace_id`, `name`, `identifier`, `description`, `status`, `lead_id`, `start_date`, `target_date`, `created_by`, `created_at`, `updated_at`).
6. **`project_repositories`**: GitHub repository URLs associated with projects (`id`, `project_id`, `repository_url`, `created_by`, `created_at`).
7. **`tasks`**: Canonical task items (`id`, `workspace_id`, `project_id`, `task_number`, `title`, `description`, `status`, `priority`, `assignee_id`, `created_by`, `due_date`, `source`, `slack_channel_id`, `slack_message_ts`, `slack_thread_ts`, `created_at`, `updated_at`).
8. **`task_comments`**: Task discussion & progress updates (`id`, `task_id`, `author_id`, `body`, `created_at`, `updated_at`).
9. **`activity_events`**: Tamper-evident audit trail (`id`, `workspace_id`, `actor_id`, `entity_type`, `entity_id`, `event_type`, `metadata`, `created_at`).

#### Phase 2: Slack Integration & Follow-up Automation
10. **`slack_installations`**: Authorized Slack workspace connections (`id`, `workspace_id`, `slack_team_id`, `slack_team_name`, `bot_user_id`, `installation_status`, `connected_by`, `connected_at`, `created_at`, `updated_at`).
11. **`slack_installation_secrets`**: Dedicated server-side secrets vault (`installation_id`, `encrypted_bot_token`, `encrypted_signing_secret`). Locked from browser access via zero client RLS policies.
12. **`slack_user_mappings`**: Explicit identity mapping between Slack User IDs and TaskPilot members (`id`, `installation_id`, `workspace_id`, `slack_user_id`, `taskpilot_user_id`, `link_status`, `linked_by`, `linked_at`, `created_at`). Enforces unique `(workspace_id, slack_user_id)`.
13. **`slack_conversations`**: Explicitly configured channels (`id`, `installation_id`, `slack_conversation_id`, `conversation_type`, `purpose`, `created_at`).
14. **`integration_events`**: External webhook delivery journal enforcing idempotency via unique `(provider, external_event_id)` index (`id`, `provider`, `installation_id`, `external_event_id`, `event_type`, `processing_status`, `error_code`, `error_summary`, `received_at`, `processed_at`).
15. **`task_followups`**: Scheduled and dispatched follow-up tracking (`id`, `workspace_id`, `task_id`, `recipient_user_id`, `channel_type`, `scheduled_at`, `sent_at`, `responded_at`, `status`, `attempt_count`, `external_message_id`, `created_at`, `updated_at`).
16. **`external_messages`**: Correlation index linking Slack threads to tasks (`id`, `workspace_id`, `installation_id`, `task_id`, `external_conversation_id`, `external_message_id`, `external_thread_id`, `sender_mapping_id`, `message_type`, `processed_at`, `created_at`).

### Applying Migrations to Supabase

1. Open your Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** -> **New query**.
3. Run `supabase/migrations/20261016000000_taskpilot_initial_schema.sql`.
4. Run `supabase/migrations/20261016000001_taskpilot_phase2_slack.sql`.

---

## 5. Application Routes

| Route | Purpose | Access Control |
| :--- | :--- | :--- |
| `/` | Marketing landing page | Public |
| `/login` | GitHub OAuth sign-in & configuration guide | Public |
| `/auth/callback` | OAuth session code exchange | Public |
| `/onboarding` | Workspace creation & invitation redemption | Authenticated |
| `/workspace/[workspaceId]` | Role-based dashboard redirector | Workspace Member |
| `/workspace/[workspaceId]/tasks` | Unified Task Center (Kanban & List views) | Workspace Member |
| `/workspace/[workspaceId]/incoming` | Unassigned task triage inbox | Workspace Member |
| `/workspace/[workspaceId]/admin` | Administrator governance dashboard | Admin only |
| `/workspace/[workspaceId]/admin/team` | Team management & invite code generator | Admin only |
| `/workspace/[workspaceId]/lead` | Team Lead execution portal | Lead & Admin |
| `/workspace/[workspaceId]/team` | Team workload & delivery distribution | Lead & Admin |
| `/workspace/[workspaceId]/member` | Member portal with "My Tasks" focus | Member & All |
| `/workspace/[workspaceId]/profile` | Developer identity & GitHub handle linkage | Workspace Member |
| `/workspace/[workspaceId]/projects` | Workspace projects & completion metrics | Workspace Member |
| `/workspace/[workspaceId]/projects/[projectId]` | Project detail, repo links & project tasks | Workspace Member |
| `/workspace/[workspaceId]/activity` | Tamper-evident audit trail & JSON inspector | Workspace Member |
| `/workspace/[workspaceId]/admin/integrations` | Slack workspace connection, member identity mapping & event diagnostics | Admin only |
| `/api/slack/events` | Official Slack Events API receiver (URL verification, bot mentions, thread updates) | Slack Webhook (HMAC signed) |
| `/api/slack/followup` | Automated follow-up dispatch sweep endpoint | Protected by `CRON_SECRET` |

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

## 7. Environment Setup & Local Development

### Prerequisites
- Node.js 20+ (Node 22 LTS recommended)
- pnpm 9+ or 10+ (`corepack enable pnpm` or `npm install -g pnpm`)

### 1. Environment Configuration

Copy the example environment file:
```bash
cp frontend/.env.example frontend/.env.local
```

Fill in your Supabase and Slack credentials in `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
CRON_SECRET=your-cron-secret
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

# Run unit tests (Parser, Signature Verification, Deterministic Routing)
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

## 8. Verification & Acceptance Criteria Status

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
- [x] **Automated Tests:** 22 unit tests passing across signature verification, message parsing, and deterministic routing engines.
