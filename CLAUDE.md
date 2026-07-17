# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Student Buddy App — a PWA for executive function, self-regulation, and holistic life tracking. Built with React 19 + TypeScript + Vite, styled with Tailwind CSS, backed by Supabase (PostgreSQL), deployed on Netlify.

## Commands

- **Dev server**: `npm run dev`
- **Build**: `npm run build` (runs `tsc -b && vite build`). Note: the PWA precache limit is raised to 4 MiB in `vite.config.ts` (`maximumFileSizeToCacheInBytes`) because the vendor/AI-SDK chunk exceeds the 2 MiB Workbox default — don't lower it or the build fails at precache.
- **Lint**: `npm run lint`
- **Tests**: `npm test` (watch mode), `npm run test:run` (single run)
- **Single test**: `npx vitest run src/features/assistant/tests/rule-engine.test.ts`
- **Test coverage**: `npm run test:coverage`

## Architecture

### Routing & Layout

No router library — `App.tsx` uses a `useState<AppRoute>` (typed in `src/constants/routes.ts`) with a switch statement to render pages. Navigation is done via `onNavigate(tab, params?)` callbacks passed down as props. Deep-links from notifications are parsed from `?route=…&intent=…&taskId=…` on load.

### Buddy Cove UI (the current design system)

The app UI is the "Buddy Cove" redesign (spec: `design_handoff_buddy_cove/README.md` — high-fidelity, final tokens/copy; docs: `docs/cove.md`). Hard rules:

- **Tokens**: CSS vars (`--cove-*`) + retherned `.app-*` classes in `src/index.css`; Tailwind colors under `cove.*` in `tailwind.config.js`. Font is self-hosted Nunito (`@fontsource/nunito`, imported in `main.tsx`). New-surface components live in `src/features/cove/` (shared primitives: Whale, SpeechBubble, Fold, Confetti, PickCircle, MoodRow, EnergyRow, TagChip).
- **Motion**: use the `.cove-bob/.cove-spout/.cove-checkpop/.cove-fadeslide/.cove-overlayin` classes — they self-disable under `prefers-reduced-motion`; confetti must never render under reduced motion (gate it through `useCelebration`/`usePrefersReducedMotion`).
- **Check-in gate**: the whole app renders `CheckInGate` until today's check-in is done or skipped — persisted on `daily_plans.checked_in_at`/`checkin_skipped`/`intention` with localStorage mirror `cove_checkin_<date>`. Finishing also calls `markRoutineDone('morning')`.
- **Streak is derived, never stored**: `computeCloseStreak`/`getCloseStreak` in `closeDay.service.ts` over `daily_plans.closed_at`. Copy around it must celebrate only, never shame a miss.
- **Mood/energy**: UI taps (5 moods / 3 energies) must map through `src/features/cove/services/moodScale.ts` to the 1–10 CHECK on `daily_plans.mood_at_plan_time`/`energy_at_plan_time` — never write raw indices.
- **Nav**: 5 tabs (Now `home`, Tasks, Capture `capture`, Browse, Me) — **never any badge or count on nav**. Assistant chat stays routed at `assistant` (reachable via Me → Account & advanced only). `today` deep-links land on Now; DayPage/HomePage/CaptureFAB were deleted (voice capture currently has no home).

### Feature Modules (`src/features/`)

Each feature is a self-contained module with its own components, hooks, services, and types:

- **health-tracking** — custom metric tracking, correlation analysis, protocols (supplements/meds), experiments
- **planning** — time-blocking calendar and daily reflection (the older AI plan-generator pages have been removed; only `CalendarPage` and `ReflectionPage` remain)
- **tasks** — todo list with prioritization, task types/routines, smart notes with auto-categorization
- **day** — daily routine views (morning/midday light + full variants, today timeline, log-yesterday step)
- **growth** — Growth Hub: skills and skill logs
- **school** — classes, assignments, class sessions
- **assistant** — AI chat interface with slash commands, tool registry, rule engine, HR/trainer agents
- **checklists** — reusable checklists for recurring routines
- **toolbox** — personal strategy library
- **focus** — Pomodoro timer
- **notifications** — in-app notifications center and push subscription management
- **browse** — top-level browse/navigation page
- **me** — profile/me page
- **core** — home page, login, account, shared infrastructure

Features export their public API through barrel `index.ts` files.

### Supabase Data Layer (`src/services/supabase/`)

Three-layer pattern:
1. **Types** (`types/`) — database row types prefixed with `Db` (e.g., `DbTracker`, `DbTodo`)
2. **Converters** (`converters/`) — bidirectional mapping between `Db*` types and domain types (e.g., `dbToTracker`/`trackerToDb`)
3. **Operations** (`operations/`) — higher-level database operations (settings, backup, seeding)

The `client.ts` exports the Supabase client and an `isSupabaseConfigured` flag.

### Supabase Edge Functions (`supabase/functions/`)

Serverless functions:
- `assistant` — main AI assistant (tool registry under `assistant/tools/`)
- `calendar-proxy` — external calendar sync
- `hr-agent`, `trainer-agent` — assistant supervisors (learnings, findings, rules)
- `correlations-agent` — computes tracker correlations
- `experiment-agent` — experiment analysis
- `off-track-scanner` — periodic scan for off-track tasks/goals (runs on a Postgres cron)
- `quick-note` — fast note ingestion
- `schedule-notifications`, `send-notification` — push notification delivery

### AI Integration

Multiple AI providers supported (Anthropic, OpenAI, Google GenAI). API keys are configured in-app via Settings, not in env vars. The `VITE_AI_DEFAULT_PROVIDER` env var sets the default provider.

### State Management

React Query (`@tanstack/react-query`) for server state. Custom hooks in each feature for domain logic. App-level auth via `useAuth` hook.

### Path Aliases

`@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

### Testing

Vitest with jsdom environment and `@testing-library/jest-dom` matchers. Tests live alongside their feature code (e.g., `src/features/assistant/tests/`). Globals are enabled — no need to import `describe`, `it`, `expect`.

### Environment

Copy `.env.example` to `.env` and fill in Supabase URL/anon key. VAPID key needed for push notifications.

## Database Schema (Supabase — project `kdwgznfszbrysepsltua`)

All tables live in the `public` schema with RLS enabled. Edge functions use the service role key (bypasses RLS). Frontend uses the anon key (RLS applies).

### Table → Purpose mapping

| Table | Feature | Notes |
| --- | --- | --- |
| `todos` | Tasks | NOT called `tasks`. Has `recurrence` + `recurrence_config`, per-task reminder columns (`reminder_enabled`, `reminder_offset_minutes`, `reminder_at`, `reminder_cadence`, `last_reminded_at`), `task_type_id` FK, triage columns `triaged_at` (NULL = still in the capture inbox), `hardness` (`fixed`/`flexible`/NULL), `auto_triaged` (AI routed without confirmation), `triage_destination` (`urgent`/`today`/`someday`/`school`/`routine`), school linkage `assignment_id` FK (every assignment mirrors onto a todo; completion syncs both ways), and stuck signals `snooze_count` + `last_touched_at`. |
| `task_types` | User-defined task type taxonomy | Referenced by `todos.task_type_id`. |
| `task_routines` | Recurring task routine definitions | Owns `task_routine_items`. |
| `task_routine_items` | Items in a task routine | FK to `task_routines`. |
| `entries` | Health tracking check-ins | NOT `tracker_entries`. Stores numeric/text values per tracker. |
| `trackers` | Health tracker definitions | Name, type, unit, goal config, scale/cadence fields. |
| `smart_notes` | Quick notes | Has `category_id` FK to `note_categories`. |
| `note_categories` | Note category definitions | Flag-based routing (e.g. `shop`, `boodschap`). |
| `daily_plans` | Daily plan rows | One row per user per date. `user_context` JSONB holds context inputs (hours, feel, meds, focus_rating, mode). |
| `time_blocks` | Planning time blocks | FK to `daily_plans`. Status: `pending/active/completed/skipped`. |
| `activity_templates` | Recurring activity templates | Used to schedule recurring activities. |
| `calendar_events` | Calendar entries | Synced from external calendars via proxy. |
| `correlations` | Computed tracker correlations | Calculated server-side. |
| `protocols` | Supplement/medication protocols | Links to `trackers` via `linked_tracker_id`. |
| `cycles` | Protocol cycles | Tracks on/off periods. |
| `doses` | Individual dose records | FK to `cycles`. |
| `experiments` | Hypothesis tracking | Links two trackers for comparison. |
| `experiment_logs` | Experiment daily journals | — |
| `checklists` | Reusable routine checklists | — |
| `strategies` | Personal strategy library | — |
| `settings` | Per-user key/value store | AI keys (`ai_aiProvider`, `ai_aiApiKey`, `ai_aiModel`), preferences, and `triage_learnings` (single growing text doc, capped ~40 lines, fed back into the triage AI prompt as worked examples). |
| `assistant_logs` | AI assistant interaction log | Columns: `detection_method` (`rule/ai/command/legacy`), `domain`, `tool_id`, `routing_method`, `ai_calls`, `processing_steps`. |
| `assistant_learnings` | Assistant learned patterns | Type: `new_rule/correction/behavior/note`. |
| `assistant_findings` | Assistant anomaly findings | Used by HR agent. |
| `assistant_rules` | Dynamic routing rules | Trainer-generated, loaded at runtime. |
| `assistant_error_logs` | Assistant error logging | Full context: step, domain, intent, stack trace. |
| `goals` | Personal goals | Status: `active/completed/paused/abandoned`. Progress 0-100%. |
| `goal_logs` | Goal progress log entries | FK to `goals`. |
| `projects` | Project management | Links to `todos` via `todos.project_id` FK. |
| `study_sessions` | Study session logs | Subject, duration_minutes, notes. |
| `skills` | Growth Hub skills | Per-user skill definitions. |
| `skill_logs` | Skill practice logs | FK to `skills`. |
| `classes` | School classes | — |
| `assignments` | School assignments | FK to `classes`. |
| `class_sessions` | School class sessions | FK to `classes`. |
| `site_feedback` | In-app feedback submissions | — |
| `notification_subscriptions` | Push notification endpoints | — |
| `scheduled_notifications` | Queued push notifications | Has `source_type` + `source_id` to link back to the originating record (e.g. a todo). |
| `notification_logs` | Push delivery log | — |

### Critical naming gotchas

- Health tracker entries = **`entries`** (never `tracker_entries`)
- Tasks/todos = **`todos`** (never `tasks`)
- The edge function `supabase/functions/assistant/tools/tracker.tool.ts` must use `entries`, not `tracker_entries`

### Tasks feature invariants

- **Due-date parsing**: all due-date math goes through `src/features/tasks/utils/dueDates.ts` (`parseDueDate` anchors plain dates at local noon). `new Date('YYYY-MM-DD')` parses as UTC midnight and shifts the calendar day — never use it on a due date.
- **One write path**: full task updates persist via `persistTaskUpdate` (`src/features/tasks/services/taskWrites.ts`); triage routing (manual, auto-apply, eager) builds the final task via `applyTriagePatch` (`services/applyTriage.ts`). Don't hand-write todo columns.
- **`school` TaskKind is derived-only** (from `assignment_id` / `triage_destination='school'`): never written to `todos.kind` — the DB CHECK rejects it and `todoToDb` nulls it. Kind pickers use `PICKABLE_TASK_KINDS`.
- **One canonical order**: every task list sorts with `sortTasksCanonical` (`utils/taskOrdering.ts`) over `getRankedTasks` scores — score desc, dueDate asc (undated last), createdAt, id.
- Completed tasks older than 30 days are filtered out of the `useTasks` query (rows stay in the DB).

### Edge function table access

Edge functions (`supabase/functions/`) use the **service role key** — they bypass RLS and can read/write any row. The `userId` from auth is passed explicitly to filter rows correctly.

### Migrations

Numbered migrations live in `supabase/migrations/`. Two unnumbered legacy files (`smart_notes_migration.sql`, `daily_planning_migration.sql`) were applied manually and are NOT tracked by the CLI. `20260716000001_checkin_gate.sql` was applied to the live DB via the Supabase MCP (remote history name `checkin_gate`) — reconcile with `supabase migration repair` if the CLI complains. Use `supabase migration repair` if the CLI history gets out of sync (see memory for the full repair pattern).

Some migrations also schedule Postgres cron jobs (e.g. `20260130000000_setup_notification_cron.sql`, `20260501000001_off_track_scanner_cron.sql`) that invoke edge functions over HTTP — keep these in mind when renaming or removing functions.

## Working on a part (progress journal workflow)

Any multi-step task ("part" — a feature, refactor, or investigation) uses a tracked, resumable journal so work survives across sessions and durable knowledge reaches this file and the docs.

1. **Start:** run `/start-part <name>` — or don't: the `journal-autostart` hook fires on the first code edit with no active journal and Claude creates it automatically. Either way, `.claude/progress/<date>-<slug>.md` is created from `.claude/templates/progress.md` (Goal, Status checklist, Key context, Errors & gotchas, Next steps, Candidate learnings). These journals are **gitignored** local scratch. A SessionStart hook surfaces any unfinished journal so you can resume immediately.
2. **During:** keep the journal updated as you go — especially **Errors & gotchas** and **Next steps** — so a cold session can continue with no other context. Park anything project-wide under **Candidate learnings for CLAUDE.md**.
3. **Finish:** automatic — when the journal's Status checklist is fully checked, the Stop hook holds the session open once and Claude performs the `/finish-part` folding itself. Running `/finish-part` manually still works (e.g. to close a part early). It folds durable learnings into this CLAUDE.md, updates `docs/DESIGN.md` (Status buckets + dated Changelog), and — only if the part is significant (new feature module, new Supabase domain/table/migration, new edge function, or ~8+ files) — generates a Mermaid diagram under `docs/diagrams/` plus a `docs/<feature>.md` page. Then it archives the journal to `.claude/progress/done/`.

`docs/DESIGN.md` is the living status/architecture overview — check it for what's Done vs Planned.

## Claude Code helpers in this repo

- **Hooks** (`.claude/settings.json`, scripts in `.claude/hooks/`): a **commit gate** (PreToolUse on `git commit`: runs `tsc -b`, blocks the commit on type errors, `--no-verify` bypasses), advisory quality guard (rule violations + tasks invariants + migration RLS/timestamp checks), **journal autostart** (first code edit with no active journal → Claude creates one itself) + Prettier format-on-edit (PostToolUse), a Stop audit (leftover violations, undeployed edge fns, stale-journal nudge, and **auto-finish**: fully-checked journal → Claude runs the /finish-part folding before stopping), and the SessionStart resume hook. All silent when clean; only the commit gate and auto-finish can block.
- **Agents** (`.claude/agents/`): `supabase-domain` (scaffold a data domain), `edge-fn` (edge functions + migrations), `pwa-reviewer` (review against these hard rules), `vitest-author` (tests).
- **Commands** (`.claude/commands/`): `/check`, `/new-domain`, `/new-migration`, `/deploy-fn`, `/db`, `/start-part`, `/finish-part`.
- **Formatting:** Prettier (`npm run format` / `format:check`) + a husky pre-commit running `lint-staged` on staged files only.