# TaskPilot — AI-Assisted Project Management & Contribution Intelligence Platform

> **Status:** Phase 1 Complete (Foundation, Authentication & Core Project Management)  
> **Architecture:** Next.js App Router (TypeScript, Tailwind CSS v4, shadcn/ui) + Supabase (PostgreSQL, Row Level Security, Auth with GitHub OAuth)

---

## 1. Product Vision

**TaskPilot** coordinates work between administrators, team leads, members, and autonomous agents. Traditional project management software records tasks, but the actual coordination, updates, and blockers get lost in Slack channels.

TaskPilot bridges this gap through:
1. **Structured Project & Task Management** with dual Kanban board and tabular list views.
2. **Explicit Workspace Hierarchy** with enforced Administrator, Team Lead, and Member roles.
3. **Conversational Intake** (Phase 2 Roadmap) through Slack message-to-task correlation.
4. **Intelligent Routing Agent** (Phase 3 Roadmap) evaluating workload and project context.
5. **GitHub Evidence Retrieval** (Phase 3 Roadmap) linking commits, PRs, and review checks.
6. **Contribution Reliability Intelligence** (Phase 4 Roadmap) with human-reviewed audit trails.

---

## 2. Four-Phase Roadmap

| Phase | Title | Scope & Status |
| :--- | :--- | :--- |
| **Phase 1** | **Foundation, Auth & Project Management** | **LIVE / IMPLEMENTED**<br>&bull; GitHub OAuth & persistent session handling<br>&bull; Secure initial workspace onboarding & single-lead governance<br>&bull; Non-recursive PostgreSQL Row Level Security (RLS)<br>&bull; Complete Project & Task CRUD, unassigned triage inbox<br>&bull; Dual Kanban board & List table views<br>&bull; Manual repository linking & tamper-evident audit trail |
| **Phase 2** | **Slack Integration & Intake** | **PLANNED**<br>&bull; Slack app connection & workspace mapping<br>&bull; Webhook & Socket Mode event ingestion<br>&bull; Conversational task intake & Slack-to-task correlation |
| **Phase 3** | **Task-Routing Agent & GitHub Evidence** | **PLANNED**<br>&bull; Lead-vs-member task-routing heuristics & LLM triage<br>&bull; Real GitHub API integration for PRs, commits, and checks<br>&bull; Automated evidence summaries & human dispute queue |
| **Phase 4** | **Contribution Reliability & Hardening** | **PLANNED**<br>&bull; Contribution Reliability Score (CRS) based on verified evidence<br>&bull; Dispute, appeal, and correction workflows<br>&bull; Delivery analytics & audit retention |

*Note: In accordance with product honesty principles, Phases 2, 3, and 4 are not faked or simulated in Phase 1.*

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

The initial SQL migration is located at:
```text
supabase/migrations/20261016000000_taskpilot_initial_schema.sql
```

### Tables

1. **`profiles`**: Application profile synced with `auth.users` via trigger (`id`, `email`, `github_username`, `display_name`, `avatar_url`, `created_at`, `updated_at`).
2. **`workspaces`**: Organizational units (`id`, `name`, `slug`, `created_by`, `created_at`, `updated_at`).
3. **`workspace_members`**: Membership and roles (`id`, `workspace_id`, `user_id`, `role: 'admin' | 'lead' | 'member'`, `joined_at`).
4. **`workspace_invitations`**: Expiring, single/multi-use invitation codes (`id`, `workspace_id`, `invited_by`, `code`, `role`, `max_uses`, `uses_count`, `expires_at`, `created_at`).
5. **`projects`**: Workspace initiatives (`id`, `workspace_id`, `name`, `identifier`, `description`, `status`, `lead_id`, `start_date`, `target_date`, `created_by`, `created_at`, `updated_at`).
6. **`project_repositories`**: GitHub repository URLs associated with projects (`id`, `project_id`, `repository_url`, `created_by`, `created_at`).
7. **`tasks`**: Canonical task items (`id`, `workspace_id`, `project_id`, `task_number`, `title`, `description`, `status`, `priority`, `assignee_id`, `created_by`, `due_date`, `source`, `created_at`, `updated_at`).
8. **`task_comments`**: Task discussion & progress updates (`id`, `task_id`, `author_id`, `body`, `created_at`, `updated_at`).
9. **`activity_events`**: Tamper-evident audit trail (`id`, `workspace_id`, `actor_id`, `entity_type`, `entity_id`, `event_type`, `metadata`, `created_at`).

### Applying Migrations to Supabase

1. Open your Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** -> **New query**.
3. Paste the contents of `supabase/migrations/20261016000000_taskpilot_initial_schema.sql` and click **Run**.

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

---

## 6. Environment Setup & Local Development

### Prerequisites
- Node.js 20+ (Node 22 LTS recommended)
- pnpm 9+ or 10+ (`corepack enable pnpm` or `npm install -g pnpm`)

### 1. Environment Configuration

Copy the example environment file:
```bash
cp frontend/.env.example frontend/.env.local
```

Fill in your Supabase credentials in `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
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

### 3. Installation & Run

```bash
# Navigate to frontend
cd frontend

# Install dependencies
pnpm install

# Run type check
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

## 7. Verification & Acceptance Criteria Status

- [x] **Marketing Landing Page:** Polished, responsive, dark-first developer-tool aesthetic with live product preview, role breakdown, and honest roadmap.
- [x] **Authentication:** GitHub OAuth via Supabase Auth with callback handler, session persistence, and login guide accordion.
- [x] **Secure Onboarding:** Atomic `create_workspace_with_admin` transaction ensures workspace creator becomes Administrator without client-controlled role escalation.
- [x] **Single-Lead Invariant:** Database partial unique index guarantees $\le 1$ lead per workspace. Admin UI handles automatic lead demotion/reassignment safely.
- [x] **Invitation System:** Hashed/alphanumeric single/multi-use expiring invitation codes redeemed via `join_workspace_with_invite`.
- [x] **Role-Based Portals:** Meaningfully distinct views for Administrator, Team Lead, and Member.
- [x] **Core Task Management:** Dual Kanban board and List table, priority/status badges, assignee filters, search, task detail slide-over with inline edits and comments.
- [x] **Incoming Triage Inbox:** Unassigned task queue for team lead manual assignment and priority triage.
- [x] **Project Management:** Project creation, identifier generation, status tracking, manual GitHub repository URL association.
- [x] **Audit Trail:** Automatic recording of workspace events (task/project/member creation, assignment, status change) in `activity_events` with JSON payload inspection.
- [x] **Security:** Row Level Security (RLS) active on all 9 tables with non-recursive security-definer helper functions. Service-role keys never exposed to browser.
- [x] **Build & Quality:** `pnpm exec tsc --noEmit` passes with 0 errors; `pnpm run lint` passes with 0 errors; `pnpm run build` succeeds cleanly.
