# TASKPILOT — MASTER PROJECT HANDOFF
**Product Context, Architecture, Implementation Status & Immediate Execution Plan**

- **Project:** TaskPilot
- **Repository:** `~/Projects/kaunteya`
- **Frontend:** `~/Projects/kaunteya/frontend`
- **Backend:** `~/Projects/kaunteya/backend`
- **Live prototype:** [https://kaunteya.vercel.app/](https://kaunteya.vercel.app/)
- **Primary objective:** Build a working AI project-coordination agent that can communicate with real team members, interpret their responses, and reliably update real project tasks.

---

## 1. INSTRUCTIONS FOR THE NEXT CHAT / CODING AGENT

You are taking over an existing project, not starting a new one.

Your first responsibility is to understand the product, inspect the current repository, determine what genuinely works, and continue implementation without destroying existing functionality.

The immediate priority is a working end-to-end agent, not additional UI, integrations for their own sake, or another architecture document.

Follow these rules:
- Inspect the current repository and Git state before modifying anything.
- Read existing implementation files and database migrations before proposing replacements.
- Reuse existing components, schemas, routes, integrations, AI utilities, and tests wherever possible.
- Do not assume a feature works merely because its files exist or an earlier build passed.
- Do not recreate the project from scratch or introduce a second database.
- Do not spend time producing another lengthy implementation plan when the repository contains enough information to begin.
- Implement the smallest reliable end-to-end vertical slice first.
- Run relevant tests, type checks, linting, and production builds.
- Clearly distinguish verified functionality from assumptions and incomplete work.
- Finish with the exact next command or action required, if anything remains blocked.
- When repository access is unavailable, request the smallest set of terminal outputs necessary to proceed. Never pretend to have inspected local files you cannot access.

---

## 2. WHAT TASKPILOT IS

TaskPilot is an AI-assisted project-management and coordination platform.

Traditional project-management applications store tasks, deadlines, assignments, and statuses. However, important information often exists outside those systems: Slack conversations, informal commitments, dependencies, partial progress, pull requests, and unresolved blockers.

As a result, dashboards can look healthy even when the actual project is stuck.

TaskPilot is intended to close that gap by connecting:
- Structured project and task management.
- Workspace membership, roles, and ownership.
- Conversational communication with team members.
- An AI agent that interprets task-related requests and replies.
- GitHub activity as supporting development evidence.
- Human review for ambiguous or disputed claims.
- An auditable record of meaningful actions and decisions.

TaskPilot is not merely a dashboard. It is a coordination layer between people, project data, conversations, development evidence, and controlled AI actions.

The product should ultimately reduce manual follow-ups, surface blockers earlier, prevent ambiguous assignments from being silently misrouted, and keep the actual state of work aligned with the system of record.

### Core product principle
> **AI interprets information and proposes actions. Deterministic application logic enforces authorization, validates state changes, and persists approved changes. Humans resolve uncertainty.**

The system must never confuse an AI-generated answer with verified evidence.

---

## 3. THE PROBLEM AND DEMONSTRATION STORY

Use this scenario as the central product demonstration.

A student project team has five members and a Friday deadline. The dashboard suggests that the project is approximately 80% complete.

One important task is:
> **Connect payment API**

The contributor responds:
> *"The API is connected, but I'm waiting for test credentials."*

A basic task tracker might leave the task marked **In Progress** or incorrectly mark it **Complete** after hearing that the API is connected.

TaskPilot should understand that implementation has progressed but the task is not ready. It should record the actual dependency.

### Expected result:
- **Task status:** `Blocked`
- **Blocker:** `Waiting for test credentials`
- **Progress summary:** Payment API connected; testing cannot proceed until credentials are available.
- **Audit trail:** records the incoming response, interpretation, validated state change, and relevant evidence.
- **Dashboard:** displays the persisted task status and blocker.

If the contributor later confirms that the credentials have arrived and testing is complete, the agent can interpret that reply and propose completion according to the project's task-completion policy.

It must not mark a task Complete merely because the contributor says they intend to finish tomorrow, have started implementation, or have completed only part of the work.

The broader story is **The Work Nobody Sees**: project leads currently act as human synchronization engines, repeatedly chasing updates and manually reconciling fragmented information.

The product's intended outcome is fewer invisible blockers, less coordination overhead, and a more trustworthy project state.

---

## 4. CURRENT REPOSITORY STRUCTURE

The following is the actual frontend source tree reported on 17 October 2026. Treat the current checkout as authoritative if it differs.

**Repository root:** `~/Projects/kaunteya`

There are separate `frontend/` and `backend/` directories. The backend has previously been described as a FastAPI starter. Inspect both before deciding whether a particular operation belongs in the backend or can be implemented safely using the existing Next.js application.

### Frontend source tree

```text
frontend/src/
├── app/
│   ├── api/
│   │   ├── github/
│   │   │   ├── callback/route.ts
│   │   │   ├── install/route.ts
│   │   │   ├── repositories/route.ts
│   │   │   ├── sync/route.ts
│   │   │   └── webhooks/route.ts
│   │   ├── payments/
│   │   │   ├── checkout/route.ts
│   │   │   ├── history/route.ts
│   │   │   └── webhook/route.ts
│   │   ├── projects/[projectId]/
│   │   │   ├── analyze/route.ts
│   │   │   └── sync/route.ts
│   │   └── slack/
│   │       ├── callback/route.ts
│   │       ├── events/route.ts
│   │       ├── followup/route.ts
│   │       ├── install/route.ts
│   │       ├── link/route.ts
│   │       └── mapping/route.ts
│   ├── auth/callback/route.ts
│   ├── login/page.tsx
│   ├── onboarding/page.tsx
│   ├── workspace/[workspaceId]/
│   │   ├── activity/page.tsx
│   │   ├── admin/
│   │   │   ├── integrations/
│   │   │   │   ├── github-integration-tab.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── reviews/page.tsx
│   │   │   ├── team/page.tsx
│   │   │   └── page.tsx
│   │   ├── billing/page.tsx
│   │   ├── incoming/page.tsx
│   │   ├── layout.tsx
│   │   ├── lead/page.tsx
│   │   ├── member/page.tsx
│   │   ├── page.tsx
│   │   ├── profile/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [projectId]/page.tsx
│   │   ├── tasks/page.tsx
│   │   └── team/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx
├── components/
│   ├── health-indicator.tsx
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       └── pica-icons.tsx
├── features/
│   ├── billing/pricing-upgrade-dialog.tsx
│   ├── tasks/
│   │   ├── create-task-modal.tsx
│   │   └── task-detail-drawer.tsx
│   ├── theme/theme-context.tsx
│   └── workspace/workspace-context.tsx
├── hooks/use-health.ts
├── lib/
│   ├── ai/
│   │   ├── errors.ts
│   │   ├── gemini-provider.ts
│   │   ├── prompts/repository-context.ts
│   │   ├── provider.ts
│   │   ├── runner.ts
│   │   ├── schemas/repository-context.ts
│   │   ├── tasks.ts
│   │   ├── types.ts
│   │   └── __tests__/gemini-foundation.test.ts
│   ├── api.ts
│   ├── billing/plans.ts
│   ├── evidence/
│   │   ├── matcher.ts
│   │   └── __tests__/matcher.test.ts
│   ├── github/
│   │   ├── app-auth.ts
│   │   ├── client.ts
│   │   ├── errors.ts
│   │   ├── fetcher.ts
│   │   ├── normalizers.ts
│   │   ├── sync.ts
│   │   ├── types.ts
│   │   ├── verify-signature.ts
│   │   └── __tests__/
│   ├── routing/
│   │   ├── agent-router.ts
│   │   └── __tests__/agent-router.test.ts
│   ├── slack/
│   │   ├── client.ts
│   │   ├── followup.ts
│   │   ├── parser.ts
│   │   ├── routing.ts
│   │   ├── verify-signature.ts
│   │   └── __tests__/
│   ├── supabase/
│   │   ├── admin.ts
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── service.ts
│   ├── __tests__/
│   │   ├── deadline-status.test.ts
│   │   ├── limits.test.ts
│   │   ├── monetization.test.ts
│   │   └── project-creation-github.test.ts
│   ├── limits.ts
│   └── utils.ts
└── types/
    ├── database.ts
    └── index.ts
```

The supplied tree reports 69 directories and 105 files. It does not include the backend tree, database migration contents, package scripts, or environment-variable names. Retrieve those from the repository instead of inferring them.

### Important architectural landmarks

| Concern | Existing starting point |
|---|---|
| Application and dashboards | `frontend/src/app/workspace/[workspaceId]/` |
| Public landing page | `frontend/src/app/page.tsx` |
| Slack inbound events | `frontend/src/app/api/slack/events/route.ts` |
| Slack follow-up endpoint | `frontend/src/app/api/slack/followup/route.ts` |
| Slack identity mapping | `frontend/src/app/api/slack/mapping/route.ts` |
| Slack event validation | `frontend/src/lib/slack/verify-signature.ts` |
| Slack message parsing | `frontend/src/lib/slack/parser.ts` |
| Slack routing | `frontend/src/lib/slack/routing.ts` |
| Slack API client | `frontend/src/lib/slack/client.ts` |
| AI provider | `frontend/src/lib/ai/provider.ts` |
| Gemini integration | `frontend/src/lib/ai/gemini-provider.ts` |
| AI execution | `frontend/src/lib/ai/runner.ts` |
| AI task utilities | `frontend/src/lib/ai/tasks.ts` |
| Task-routing rules | `frontend/src/lib/routing/agent-router.ts` |
| GitHub synchronization | `frontend/src/lib/github/sync.ts` |
| GitHub data retrieval | `frontend/src/lib/github/fetcher.ts` |
| Evidence matching | `frontend/src/lib/evidence/matcher.ts` |
| Supabase access | `frontend/src/lib/supabase/` |
| Database TypeScript types | `frontend/src/types/database.ts` |

These are investigation entry points, not proof that each module implements the required production behavior.

---

## 5. TECHNOLOGY AND DATA ARCHITECTURE

### Known frontend stack
- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase Auth and PostgreSQL
- PostgreSQL Row Level Security (RLS)
- Gemini provider integration and shared AI abstractions
- Slack API integration code
- GitHub App integration code
- Vercel deployment

The project also has a separate FastAPI backend starter. Inspect its current purpose, dependencies, and deployed usage before introducing or extending backend endpoints.

Do not add a second task database, replace Supabase without a concrete reason, or create a general-purpose CRUD API when existing authenticated Supabase operations already solve the problem.

### Reported core database tables
The initial application schema has been described as containing:
- `profiles`
- `workspaces`
- `workspace_members`
- `workspace_invitations`
- `projects`
- `project_repositories`
- `tasks`
- `task_comments`
- `activity_events`

Previously reported migrations:
- `supabase/migrations/20261016000000_taskpilot_initial_schema.sql`
- `supabase/migrations/20261016000001_taskpilot_phase2_slack.sql`

Verify both filenames and actual migration contents. Preserve applied migrations and historical records. Introduce new migrations for necessary schema changes rather than rewriting historical migrations.

The existing schema may include additional fields, indexes, constraints, or functions.

Supabase is the canonical source of truth for application tasks and their persisted state. Slack messages and GitHub activity are external inputs, not separate sources of task truth.

Before designing the agent, inspect how the current database represents task status, assignment, ownership, workspace identity, blockers, comments, and activity. Add only what is missing.

---

## 6. USERS, ROLES, AND PERMISSIONS

TaskPilot's workspace model has three principal roles:

### Administrator
Responsible for workspace governance, team membership, configuration, integrations, and oversight.
Expected access includes workspace-wide projects and tasks, membership management, role management, activity history, and future review workflows.

### Team lead
Responsible for coordinating project execution, assigning work, resolving ambiguous routing, and handling tasks that require human prioritization.
The original product model describes one designated lead for the initial workspace configuration, with multiple members. Verify the actual schema and constraints before changing this rule.

### Member
Responsible for assigned work, reporting progress, communicating blockers, and supplying task-related updates.
Members must not be able to change workspace roles, rewrite audit history, approve their own disputed claims, or alter externally synchronized GitHub data.

### Security invariants
- Enforce workspace isolation.
- Respect Supabase RLS and existing authorization rules.
- Authenticate and authorize all state-changing operations.
- Never let an LLM choose its own permissions.
- Never expose service-role credentials, bot tokens, signing secrets, or model API keys to browser code.
- Validate external webhook signatures.
- Treat inbound external content as untrusted input.
- Make webhook processing idempotent.
- Record meaningful task changes and agent decisions in an auditable form.

---

## 7. EXISTING PRODUCT SURFACES

Phase 1 was previously reported as implemented, with type checking, linting, and production builds passing at that time. Those reports are historical context, not proof of the current checkout's health.

The existing application includes or is intended to include:
- GitHub OAuth authentication through Supabase.
- Onboarding and workspace provisioning.
- Administrator, lead, and member experiences.
- Team membership and invitations.
- Project creation and management.
- Project-to-repository association.
- Task creation, assignment, and reassignment.
- Task priorities, status, and deadlines.
- Task comments and a task detail drawer.
- Task search and filtering.
- List and Kanban task views.
- An incoming/unassigned task queue.
- Role-specific dashboards.
- Workspace activity history.
- Integration settings and administration.
- Billing and pricing surfaces.
- Review surfaces for claims and evidence.

Verify current implementations, particularly write operations, access control, and whether the UI reflects persisted data.

Do not spend the agent implementation window polishing already adequate screens.

---

## 8. SLACK INTEGRATION — CURRENTLY THE MOST IMPORTANT EXTERNAL PATH

Slack is the preferred initial messaging channel because the product is built around conversational coordination.

### Reported Slack implementation
The frontend contains:
- OAuth callback and installation routes.
- Slack event receiver.
- Event signature verification.
- Message parser.
- Deterministic routing logic.
- Identity-linking route.
- Follow-up endpoint.
- Slack API client.
- Tests for parsing, routing, identity linking, signature verification, installation lifecycle, mapping, and event handling.

The actual code in the current checkout is the authority. Do not assume the implementation includes a working general-purpose conversational agent.

### Latest reported real-world status
As of the most recent development context on 17 October 2026:
- The Slack bot was reported as `taskpilot`.
- Bot user ID: `U0C9TBD4T8T`.
- Demo user Omkar: `U0C9NRMSXUM`.
- A direct-message conversation was reported with ID `D0C9J72NZHD`.
- Slack authentication and outbound direct messages were reported as implemented and verified.
- Actual replies had been received in Slack.
- The deployed `/api/slack/events` route previously returned HTTP 500 because `SUPABASE_SERVICE_ROLE_KEY` was missing. Later requests reportedly returned HTTP 200.
- There is no confirmed evidence that a genuine incoming reply has completed the full interpretation → validated task update → visible dashboard workflow.

Treat the identifiers above as contextual references only. Verify the current app, workspace, identity mapping, environment configuration, and event delivery rather than hardcoding these values into application logic.

A webhook returning HTTP 200 is not proof that a message was interpreted or that a task changed.

### Slack implementation objective
The required flow is:
1. A real participant is identified through a verified Slack-to-TaskPilot identity mapping.
2. An agent run selects a genuine task needing follow-up.
3. The system identifies the task owner and relevant project context.
4. TaskPilot sends a real, contextual Slack message.
5. The participant sends a genuine reply.
6. Slack delivers the event to the deployed receiver.
7. The application verifies the signature and filters irrelevant or duplicate events.
8. The reply is associated with the correct user, workspace, conversation, and task.
9. The AI interprets the reply into structured task-state information.
10. Deterministic validation checks permissions, allowed transitions, and the interpretation.
11. The application persists the approved change to Supabase.
12. The activity record is saved and the existing dashboard reflects the new state.
13. The system can reply to the participant or ask for clarification when necessary.

Do not simulate the incoming message. Do not hardcode the expected response. Do not use a test string in place of actual AI interpretation.

If the current Slack path can be repaired quickly, continue with it. Do not switch messaging platforms merely to experiment. Consider another channel only if a concrete integration blocker makes the existing route impractical within the evaluation window.

---

## 9. THE MISSING PIECE: A REAL TASK COORDINATION AGENT

The project has AI provider utilities, Gemini integration, task utilities, repository-context schemas, routing logic, and Slack-related code.

That is a foundation, not proof of a working autonomous coordination loop.

The immediate goal is to connect these existing pieces into one reliable execution path.

### Required agent behavior

#### A. Select a real task
Use the existing Supabase schema and task-management utilities.
Identify tasks eligible for follow-up based on their status, assignment, context, and existing workflow rules.
Do not create a fake task in memory when the workflow is supposed to update a real database record.

#### B. Build task context
Retrieve only the context required for the current task:
- Workspace and project.
- Task title and description.
- Current status and assignee.
- Deadline, if available.
- Known blocker or dependency.
- Relevant comments and prior messages.
- Relevant recent activity.
- Repository evidence, when already available and relevant.

Keep context isolated by workspace and project. Never send unrelated users' or workspaces' private information to the model.

#### C. Send a contextual follow-up
Generate a concise question that reflects the actual task state.
*Example:*
> "Hey, what's the current status of the payment API integration? Have you completed testing, or is anything blocking you?"

Send it through the real messaging integration and preserve enough message/thread context to associate the reply correctly.

#### D. Interpret the genuine reply
Use the existing AI provider abstraction and Gemini integration if operational. Reuse the existing schema-validation approach.

Produce structured output similar to:
```json
{
  "status": "blocked",
  "blocker": "Waiting for test credentials",
  "progress_summary": "Payment API connected; testing is still pending.",
  "needs_clarification": false,
  "reason": "The contributor explicitly states that credentials are required before testing.",
  "evidence": [
    "The contributor's actual Slack reply"
  ]
}
```

This is an illustrative output contract, not a requirement to copy this exact JSON shape if the repository already defines an appropriate compatible schema.
Use a validated schema, such as the existing project conventions with Zod, if appropriate.

#### E. Enforce deterministic policy
The model must never directly mutate Supabase based solely on free-form generated text.

Application logic must validate:
- The task exists and belongs to the correct workspace.
- The responder is associated with the correct member identity.
- The agent has permission to propose or apply the requested change.
- The proposed status is an allowed value.
- The transition is allowed by existing task policy.
- The reply genuinely refers to the selected task.
- The proposed update does not overwrite newer state.
- Duplicate events do not repeat the same action.
- Ambiguous or contradictory information is routed for clarification or review.

Keep model interpretation separate from authorization and persistence.

#### F. Persist and display the result
Save the approved status and blocker to the real task record. Record the relevant activity and make the updated state visible through the existing TaskPilot interface.

The agent is not complete if it merely generates a good answer in the logs.

---

## 10. STATUS INTERPRETATION RULES

Use these examples to guide implementation and testing.

| Genuine participant response | Expected interpretation |
|---|---|
| "I've started implementing the endpoint." | `In Progress` |
| "The endpoint is implemented, but tests are failing." | `In Progress` or `Blocked`, according to the project's explicit status policy; preserve the test failure |
| "I'm waiting for test credentials." | `Blocked`; record the missing credentials |
| "The API is connected, but I haven't tested it yet." | Not Complete; record partial progress |
| "Finished and tested the endpoint." | Candidate for `Complete`, subject to the project's completion policy |
| "I'll finish it tomorrow." | Do not mark Complete |
| "It's almost done." | Preserve uncertainty; ask for clarification if a meaningful state decision cannot be made |
| Reply is unrelated or refers to multiple tasks | Do not guess which task should change |
| Reply conflicts with newer task data | Avoid a blind overwrite; reconcile or request review |

These are intended behavior rules. Confirm the repository's current status enum and transition policy before using any literal database values.

A lack of GitHub evidence is not proof that work was not performed. GitHub activity may corroborate a claim, but it cannot automatically establish completion or dishonesty.

---

## 11. GITHUB AND EVIDENCE ARCHITECTURE

GitHub integration code exists in the current frontend.

Relevant modules include:
- `frontend/src/app/api/github/`
- `frontend/src/app/api/projects/[projectId]/analyze/route.ts`
- `frontend/src/app/api/projects/[projectId]/sync/route.ts`
- `frontend/src/lib/github/app-auth.ts`
- `frontend/src/lib/github/client.ts`
- `frontend/src/lib/github/fetcher.ts`
- `frontend/src/lib/github/normalizers.ts`
- `frontend/src/lib/github/sync.ts`
- `frontend/src/lib/github/verify-signature.ts`
- `frontend/src/lib/evidence/matcher.ts`

The intended capabilities include authorized repository discovery, repository association, commits, pull requests, reviews, checks, task/evidence correlation, evidence summaries, and human review.

However, code presence does not prove that the GitHub App is installed for the demo workspace, webhook events are reaching production, synchronization is successful, or evidence is linked to the correct task.

Verify the actual installation, repository permissions, sync behavior, and persisted records before claiming those capabilities work.

Do not let GitHub evidence delay the core agent demonstration. If existing evidence can be retrieved cheaply, use it as additional context. Otherwise, prioritize the real messaging loop.

Do not build contribution scoring or a complex evidence analytics system during this immediate sprint.

---

## 12. ROUTING AND HUMAN OVERSIGHT

The longer-term product includes an intelligent task-routing layer.

The intended logic is:
1. Understand the incoming request.
2. Identify its project and workspace.
3. Retrieve relevant tasks and ownership context.
4. Check for an existing task to avoid duplicate work.
5. Determine whether a specific member is clearly responsible.
6. Route an unambiguous task according to configured policy.
7. Send ambiguous, unassigned, cross-functional, or high-impact decisions to the lead.
8. Record the routing rationale and outcome.

- **Existing entry point:** `frontend/src/lib/routing/agent-router.ts`
- **Tests:** `frontend/src/lib/routing/__tests__/agent-router.test.ts`

Reuse this code if it supports the intended workflow. Do not create a second competing router without a concrete need.

The agent should not silently assign work to an arbitrary person, bypass workspace permissions, or claim that an assignment was completed if it only proposed one.

---

## 13. PHASE HISTORY AND PRODUCT ROADMAP

The original project was planned as four phases. These remain useful for understanding intended scope, but historical phase completion reports must not override actual repository inspection.

### Phase 1 — Core project management
**Reported scope:** Authenticated workspace onboarding, workspace membership and roles, projects and repositories, task creation, assignments, status, priority, and deadlines, comments and activity history, role-specific dashboards, incoming/unassigned task queue, Supabase RLS and core data model, public landing page.

*Status:* The Phase 1 implementation was previously reported to pass type checks, linting, and a production build. Re-run current checks.

### Phase 2 — Slack integration
**Reported scope:** Slack installation and identity mapping, incoming events and signature verification, conversational task intake, follow-up messages, real participant replies, task updates from Slack, clarification handling, idempotent event processing and audit logging.

*Status:* The repository contains substantial integration code, and outbound Slack messages plus genuine replies were reported working. The complete incoming-reply-to-persisted-task-update loop remains unverified.

### Phase 3 — Agent and GitHub evidence
**Intended scope:** Task-intake classification, project context and ownership-aware routing, clarification for ambiguous requests, authorized GitHub repository integration, commits, PRs, reviews, and checks, evidence-to-task correlation, evidence summaries with source links, human review for disputed or incomplete claims, explainable audit records.

*Status:* This is the broad product phase that the current work is moving toward. The immediate deliverable is a narrow, working agent slice, not the entire phase.

### Phase 4 — Contribution reliability and hardening
**Future scope:** Explainable contribution reliability history, human-review outcomes, dispute and appeal workflows, project and team reporting, workload and delivery analytics, integration-health monitoring, audit retention and export, accessibility, security, and performance hardening.

*Status:* Contribution scoring is explicitly deferred until the core agent works. Any future score must be explainable, evidence-aware, and correctable. Raw commit counts, lines of code, or claimed hours must not be treated as standalone measures of productivity or honesty.

---

## 14. IMMEDIATE IMPLEMENTATION PRIORITIES

Work in this order:

### Priority 1 — Establish the actual current state
Inspect:
- `git status` and uncommitted changes.
- Root and frontend package scripts.
- Backend structure and whether it is currently used.
- Supabase migrations and task schema.
- Existing task mutation paths and authorization rules.
- Slack event, callback, mapping, and follow-up routes.
- Slack installation, event subscriptions, scopes, and deployment settings.
- Existing AI provider configuration and schema validation.
- Relevant tests and the latest build status.
- Environment-variable NAMES without displaying secret VALUES.

Do not stop at inspection if the available information is sufficient to make the first implementation.

### Priority 2 — Build the smallest real agent slice
Implement or repair only what is necessary for:
1. One existing Supabase task.
2. One real, authorized participant.
3. One real outbound follow-up.
4. One genuine incoming Slack reply.
5. One AI interpretation using a working model provider.
6. One validated task-state change.
7. One persisted activity record.
8. One visible dashboard update.

Use existing abstractions and database fields whenever possible.

### Priority 3 — Prove it live
Run the following demonstration:
1. Open TaskPilot and show a real pending task assigned to a demo participant.
2. Trigger the agent using an existing UI action or a simple secure manual trigger.
3. Show the real follow-up message arriving in Slack.
4. Reply from the participant's actual Slack account.
5. Show the event reaching the deployed application.
6. Show the AI interpreting the genuine reply.
7. Show the task become `Blocked` when the reply identifies an unresolved dependency.
8. Show the blocker persisted in Supabase and visible on the dashboard.
9. Send another genuine reply resolving the dependency and confirming completion.
10. Show the agent process that reply and update the task according to the completion policy.

If the last step cannot be completed, report exactly which step failed. Do not claim end-to-end completion based on a partial success.

A manual "Run agent" or "Send follow-up" button is acceptable for the initial demonstration. Reliable real messaging and reply processing are mandatory. Scheduled autonomous follow-ups can come later.

### Priority 4 — Add essential safeguards
At minimum, cover:
- Blocker detection.
- Partial progress versus completion.
- Ambiguous responses.
- Invalid status transitions.
- Unauthorized task changes.
- Duplicate webhook events.
- Incorrect member identity.
- Incorrect message-to-task association.
- Stale-state conflicts.
- Provider errors and failed persistence.

Test external integration behavior separately from mocked unit tests.

---

## 15. WHAT NOT TO BUILD YET

Until the end-to-end agent works, freeze unnecessary expansion.

Do not prioritize:
- Billing or subscription polish.
- Razorpay functionality.
- Workspace-creation redesign.
- Dashboard redesign.
- Contribution reliability scoring.
- Complex GitHub evidence analytics.
- Multi-agent orchestration.
- Additional integrations without a concrete need.
- Broad refactoring.
- Infrastructure that does not solve an observed blocker.
- Another landing-page redesign unless specifically requested after the agent work.

Do not replace working code simply to make the architecture look cleaner.
The UI can be simple. The actual behavior is the product.

---

## 16. LANDING PAGE AND PRODUCT PRESENTATION CONTEXT

- **Live prototype:** [https://kaunteya.vercel.app/](https://kaunteya.vercel.app/)
- The intended landing page is premium, dark-first, editorial, and credible. It should communicate the coordination problem and show the real product, not resemble a generic AI startup template.

### Messaging direction
- **Primary positioning:** The AI teammate that catches invisible blockers.
- **Supporting headline direction:** Your projects don't need more updates. They need fewer blockers.
- The story should explain how TaskPilot connects project tasks, team conversations, and supporting development evidence to surface the real state of work.

### Intended page sections
- Navigation with product links and sign-in CTA.
- Hero with a clear value proposition and strong product preview.
- The coordination problem.
- Admin → Lead → Member workflow.
- Product capabilities and task-management interface.
- Interactive blocked-task example.
- Slack and GitHub integration explanations.
- Trust, human oversight, and accountability.
- Final CTA and footer.

Use real screenshots or faithful representations of existing screens. Do not invent metrics, activity logs, working integrations, or nonexistent UI.
Use local interactive state only for an explicitly labeled demonstration. A demo interaction is not evidence that the production agent is operational.

### Visual preferences
- Dark, minimal, polished developer-tool aesthetic.
- Tailwind CSS and existing shadcn/ui components.
- Clear hierarchy, deliberate whitespace, restrained accent colors.
- Avoid generic AI gradients, excessive glassmorphism, decorative blobs, and cartoonish visuals.
- Preserve the existing product's visual identity and routing.
- Current page implementation is in `frontend/src/app/page.tsx`. Keep the landing page as a separate concern from the agent's core backend behavior.

---

## 17. TESTING, DEPLOYMENT, AND HONEST REPORTING

A successful TypeScript check, unit test run, or production build does not establish that the deployed integration works.

Verify each layer separately:

### Application correctness
- Types and lint.
- Unit and route tests.
- Production build.
- Authorization and RLS behavior.

### Integration correctness
- Slack installation and identity mapping.
- Real outbound message.
- Real incoming event.
- Valid webhook signature.
- Successful AI interpretation.
- Validated Supabase mutation.
- Persisted audit/activity record.

### Deployment correctness
- Current production deployment and endpoint behavior.
- Required environment-variable presence.
- Logs for actual request failures.
- Correct database and workspace configuration.

Never print secret values into logs or ask the user to paste them into chat. Ask only for safe diagnostics, redacted output, or boolean checks when credentials need verification.
Never claim a migration was applied, deployment succeeded, or production behavior was verified unless it actually happened.

---

## 18. FIRST TERMINAL COMMANDS

Start in the repository root:
```bash
cd ~/Projects/kaunteya
git status --short
git branch --show-current
find . -maxdepth 2 \
  \( -name package.json \
     -o -name pyproject.toml \
     -o -name requirements.txt \
     -o -name README.md \
     -o -name 'AGENTS.md' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/.venv/*' \
  -print
```

Then inspect the frontend scripts and the relevant implementation:
```bash
cd ~/Projects/kaunteya/frontend
cat package.json
sed -n '1,260p' src/app/api/slack/events/route.ts
sed -n '1,260p' src/app/api/slack/followup/route.ts
sed -n '1,260p' src/lib/slack/client.ts
sed -n '1,260p' src/lib/slack/parser.ts
sed -n '1,260p' src/lib/slack/routing.ts
sed -n '1,260p' src/lib/ai/provider.ts
sed -n '1,260p' src/lib/ai/gemini-provider.ts
sed -n '1,260p' src/lib/ai/runner.ts
sed -n '1,260p' src/lib/ai/tasks.ts
```

Inspect the migration directory and relevant task schema using the actual paths discovered in the repository. Do not assume the migration filenames above are present without checking.

Use targeted commands rather than dumping entire environment files or exposing secrets.
These commands are a starting point, not a reason to delay implementation if the current conversation already provides sufficient context.

---

## 19. DEFINITION OF DONE

The immediate milestone is complete only when:
1. A real task exists in Supabase.
2. The agent identifies the appropriate participant.
3. A real follow-up is sent.
4. The participant sends a genuine reply.
5. The application receives and correctly associates that reply.
6. An LLM interprets the reply into validated structured data.
7. Deterministic policy validates the proposed transition.
8. The approved task change is persisted.
9. The activity trail records the meaningful change.
10. The existing TaskPilot dashboard reflects the persisted state.
11. The blocked-task scenario can be demonstrated without hardcoded answers or simulated external messages.

If the live demo proves only outbound messaging, say so. If inbound delivery works but the model fails, say so. If interpretation works but the database update fails, say so.

The goal is not to claim that TaskPilot has AI features. The goal is to demonstrate that a real participant can communicate naturally with TaskPilot and the corresponding real task changes correctly, safely, and visibly.

---

## 20. FINAL EXECUTION DIRECTIVE

Act as the principal engineer continuing an existing codebase under a tight evaluation deadline.

Be fast, specific, and implementation-oriented.

First establish the actual current state. Then trace the existing Slack → task → AI → Supabase path and fix the smallest missing link. Preserve all working features. Reuse the existing Gemini provider and task utilities where appropriate. Keep authorization and state transitions deterministic.

Do not start by building a new agent framework, rewriting the database, or redesigning the application.
Do not end with another plan when you can implement and test the next step.

**The next concrete deliverable is a verified end-to-end TaskPilot agent that follows up with a real person, interprets their real reply, and updates a real task in Supabase.**
