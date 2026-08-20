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
- **Use the `app-*` primitive layer — don't hand-roll classes.** `src/index.css`
  `@layer components` carries title/subtitle/label/surface/row, the button set
  (primary/secondary/danger/ghost/dark/icon), the form set
  (input/textarea/select/checkbox/field-label/field-hint/field-error), card/empty/divider and
  `app-tint-{blue,amber,green,purple,pink}`. Hand-rolling `border-slate-300 rounded-lg` is how
  ~1,500 pre-Cove utilities survived *inside* Cove pages until 2026-08-17. `src/**` is now at
  **zero** default-palette hits; `quality-guard.mjs` warns (advisory) on default-palette
  classes, `font-medium`, `vh` units and gradients.
- **Cove has no red and no gradients.** Destructive actions use `--cove-danger` /
  `--cove-danger-deep` / `--cove-tint-danger` — the deep end of the pink family, so a warning
  reads as "careful", never as an alarm. Typography is semibold/bold/extrabold/black only;
  `font-medium` and `font-normal` are pre-Cove tells.
- **Never use a viewport breakpoint (`sm:`/`md:`/`lg:`) for layout inside the app shell.**
  `MainLayout` caps content at `max-w-[520px]`, but Tailwind's breakpoints key off the
  *viewport*, so on a desktop browser (`innerWidth: 1920`) every `lg:` desktop layout activated
  inside a 520px column: Assistant chat pinned a 256px sidebar beside a ~180px chat, School's
  deadline list collapsed to ~100px, tile grids squeezed to 150px columns. No viewport
  breakpoint can describe a fixed-width shell — pick the one layout that fits 520px (two
  columns for small tiles, one for wide inputs). Breakpoints are still fine in surfaces that
  render *outside* the shell (Modal, Toast, LoginScreen, CheckInGate, CloseDayOverlay).
- **The document is the scroller, not `main`.** `MainLayout`'s `main` is `flex-1` inside a
  `min-h-dvh` column, so it grows to full content height and can never scroll itself — but
  declaring it `overflow-y-auto` still made Chrome swallow every wheel event over the app
  instead of chaining to the document, so nothing below the fold was reachable with a mouse.
  Don't re-add `overflow-*` there; the fixed nav is cleared by `main`'s bottom padding.
- **Check-in gate**: the whole app renders `CheckInGate` until today's check-in is done or skipped — persisted on `daily_plans.checked_in_at`/`checkin_skipped`/`intention` with localStorage mirror `cove_checkin_<date>`. Finishing also calls `markRoutineDone('morning')`.
- **Streak is derived, never stored**: `computeCloseStreak`/`getCloseStreak` in `closeDay.service.ts` over `daily_plans.closed_at`. Copy around it must celebrate only, never shame a miss.
- **Mood/energy**: UI taps (5 moods / 3 energies) must map through `src/features/cove/services/moodScale.ts` to the 1–10 CHECK on `daily_plans.mood_at_plan_time`/`energy_at_plan_time` — never write raw indices.
- **Safe areas**: `index.html` sets `viewport-fit=cover`, so the viewport spans the whole
  screen and every shell edge must add `env(safe-area-inset-*)` itself. `MainLayout` owns
  this for the app shell (top/left/right gutters + nav clearance); any full-screen surface
  outside it (`LoginScreen`, `CloseDayOverlay`, `CheckinModal`) adds its own. Use
  `min-h-dvh`, never `min-h-screen`/`100vh` — `vh` overflows past the visible area on iOS.
  The iOS status bar style is `default`, not `black-translucent`: the app background is
  light, and translucent draws unreadable white glyphs over it.
- **Nav**: 5 tabs (Now `home`, Tasks, Capture `capture`, Browse, Me) — **never any badge or count on nav**. Assistant chat stays routed at `assistant` (reachable via Me → Account & advanced only). `today` deep-links land on Now; DayPage/HomePage/CaptureFAB were deleted (voice capture currently has no home). The `notes` route and NotesPage were deleted 2026-08-17 — **Capture is the only inbox**; don't add a second capture surface.

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
- `assistant` — main AI assistant (tool registry under `assistant/tools/`). Also the **only** quick-capture endpoint: the iPhone Shortcut POSTs `{input, api_key, source}` here (see `docs/help/iphone_shortcut_setup.md`).
- `calendar-proxy` — external calendar sync
- `google-calendar-auth`, `google-calendar-write` — Google OAuth exchange + event writes
- `hr-agent`, `trainer-agent` — assistant supervisors (learnings, findings, rules)
- `experiment-agent` — experiment analysis
- `off-track-scanner` — periodic scan for off-track tasks/goals (runs on a Postgres cron)
- `school-import` — bulk import of classes/assignments
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
| `todos` | Tasks | NOT called `tasks`. **`flag` is the classification** (`urgent`/`today`/`deadline`/`waiting`/`school`/`routine`/`someday`, NOT NULL). Has `recurrence` + `recurrence_config`, per-task reminder columns (`reminder_enabled`, `reminder_offset_minutes`, `reminder_at`, `reminder_cadence`, `last_reminded_at`), `task_type_id` FK, triage columns `triaged_at` (NULL = still in the capture inbox), `triage_source`/`triage_confidence`/`triage_reason`, `hardness` (`fixed`/`flexible`/NULL), `auto_triaged` (AI routed without confirmation), school linkage `assignment_id` FK (every assignment mirrors onto a todo; completion syncs both ways), and stuck signals `snooze_count` + `last_touched_at`. `kind`, `triage_destination`, `labels`, `project_id` and `historical_minutes` were dropped 2026-08-16. |
| `task_types` | User-defined task type taxonomy | Referenced by `todos.task_type_id`. |
| `task_routines` | Recurring task routine definitions | Owns `task_routine_items`. |
| `task_routine_items` | Items in a task routine | FK to `task_routines`. |
| `entries` | Health tracking check-ins | NOT `tracker_entries`. Stores numeric/text values per tracker. |
| `trackers` | Health tracker definitions | Name, type, unit, goal config, scale/cadence fields. |
| `smart_notes` | **Retired surface** — read by nothing | The Notes UI was removed 2026-08-17 (0 writes in 90 days); Capture is the single inbox. 20 categorised rows are kept as archive, the 3 inbox rows were migrated to `todos`. Converters and `Db*` types still exist, so reviving or migrating the rest is a data question, not a recovery job. |
| `note_categories` | Retired with `smart_notes` | 7 rows kept. Its `shop`/`boodschap` routing backed the assistant's `note.create.shopping`, which went when `notes.tool.ts` was deleted — if a shopping list matters again it wants a home in Capture, not a revived Notes page. |
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
| `settings` | Per-user key/value store | Preferences and `triage_learnings` (single growing text doc, capped ~40 lines, fed back into the triage AI prompt as worked examples). AI keys and the capture token used to live here — they were moved out by the 20260714 migrations, so `ai_aiApiKey`/`ai_aiProvider`/`ai_aiModel`/`quick_note_api_key` no longer exist. |
| `ai_credentials` | Server-side AI provider credentials | One row per user. **No client policies by design** — `REVOKE ALL FROM anon, authenticated`; only edge functions (service role) touch it. Frontend reads/writes it via the assistant actions `ai.config.status/save/test`. |
| `capture_tokens` | iPhone Shortcut capture tokens | One row per user, `token_hash` is SHA-256 of the plaintext — the server cannot recover the token, so rotation is the only recovery path. Same REVOKE pattern as `ai_credentials`. |
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

**Read `src/features/tasks/README.md` before changing anything in this feature** — it
documents the four stages (capture → triage → write → surface), the flag contract, and the
three features deliberately left undesigned. The invariants below are the short version.

- **`flag` is the single classification.** Seven values, `NOT NULL` with a CHECK. `kind` and
  `triage_destination` were dropped in `20260816000001_collapse_task_vocabulary` — the same
  seven concepts had been modelled three times with three meta tables and three inconsistent
  orderings. Presentation (label, plural, emoji, colour, description, required input) lives
  only in `TASK_FLAG_META`; display order and the sort tie-break only in `TASK_FLAG_ORDER`
  (`utils/taskFlags.ts`). Adding a second table of flag labels is that mistake repeating.
- **The flag decides urgency, not `priority`.** `scoreTask` weights `deriveTaskFlag(task)`;
  `priority` only grades high/medium/low within a flag.
- **Two write paths and one delete path, no others**: `insertTask`/`insertTasks` for new
  rows, `persistTaskUpdate` for existing ones, and `deleteTaskFully`/`deleteTasksFully`
  (plus `deleteTasksForAssignments` for the school cascade) to remove them — all in
  `services/taskWrites.ts`. Each applies the flag contract, writes through `todoToDb`,
  schedules or cancels reminders and mirrors to Google. Triage (manual, auto-apply,
  eager) builds its task via `applyTriagePatch` (`services/applyTriage.ts`). Don't
  hand-write todo columns — a raw insert in the recurrence spawn is why every occurrence
  after the first used to have no reminder, and a raw `.delete()` is why deleting a
  school class left one orphaned `scheduled_notifications` row per assignment behind.
- **The assistant edge function captures, it does not classify.** `createTask` records
  title + an obvious date + an explicit `#flag`; anything else lands untriaged so the AI
  sorts it and the correction feeds `triage_learnings`. Don't reintroduce flag inference
  there — that was a fourth divergent copy of the contract.
- **Due-date parsing**: all due-date math goes through `src/features/tasks/utils/dueDates.ts` (`parseDueDate` anchors plain dates at local noon). `new Date('YYYY-MM-DD')` parses as UTC midnight and shifts the calendar day — never use it on a due date. **This covers recurrence too**: `utils/recurrence.ts` used to parse that way and format back with `.toISOString().split('T')[0]`, so every cadence crossing the spring DST change lost a day. Plain date in via `parseDueDate`, plain date out via `format(d, 'yyyy-MM-dd')`.
- **`TaskDetailSheet` is keyed, not synced.** Its draft seeds once from `task` via `useState`, so every call site must render it with `key={task.id}` — without the key the sheet shows a stale task when switching rows; with a draft-sync effect (removed) a background refetch wiped mid-edit changes. It is folded (What open; When / Steps / Details / Reminders behind `Fold`s) and takes an optional `focusSection`; `'steps'` also expands the AI splitter, which is how NextUpCard's "Feeling stuck? Split it" works.
- **One canonical order**: every task list sorts with `sortTasksCanonical` (`utils/taskOrdering.ts`) over `getRankedTasks` scores — score desc, plannedFor asc, flag rank, dueDate asc (undated last), createdAt, id.
- **The Tasks screen is built by `buildTaskBoard`** (`utils/taskBoard.ts`), not by the page.
  Every active task appears exactly once across now / overflow / sections.
- Completed tasks older than 30 days are filtered out of the `useTasks` query (rows stay in the DB).
- **Dead code check**: `npm run check:reach` walks imports from `src/main.tsx` and reports
  anything the bundle can't reach (also advisory in the Stop hook). The Cove redesign
  orphaned ~35 components for months because barrel files made them look imported.

### Edge function auth (`verify_jwt`)

`assistant`, `school-import`, `schedule-notifications`, `google-calendar-auth`, and
`google-calendar-write` are deployed with **`verify_jwt = true`**. Any non-browser caller
(iPhone Shortcut, curl, a cron job) must send `Authorization: Bearer <anon or publishable
key>` or the Supabase gateway returns `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}` **before**
the function's own `auth.ts` runs. Both the legacy `eyJ…` anon key and the modern
`sb_publishable_…` key satisfy the gateway. Don't confuse the two 401s: gateway rejection
returns `{"code":…}`, the function's own rejection returns `{"success":false,…}`.

**`supabase/config.toml` pins `verify_jwt` per function — keep it in sync when adding
one.** `supabase functions deploy` defaults to `verify_jwt = true` for any function not
declared there, and that default silently killed push notifications for six weeks: a
2026-07-04 redeploy flipped `schedule-notifications` to `true`, while the pg_cron job was
building its header from `current_setting('app.settings.service_role_key', true)` — a GUC
that was never set — so it sent a literal `Bearer ` and got
`401 UNAUTHORIZED_INVALID_JWT_FORMAT` every minute. Both cron jobs now send the **public
publishable key** (`sb_publishable_…`, safe to hardcode in a migration); never reach for
the service role key there. When a cron-invoked function seems dead, check
`net._http_response` first — it stores the gateway's reply, which pg_cron itself ignores
(`cron.job_run_details` says `succeeded` for a 401, because the POST was sent fine).

### Notification delivery invariants

- `schedule-notifications` **expires** anything more than `MAX_STALENESS_MINUTES` (120)
  past its `scheduled_for` instead of delivering it. A late nudge is noise, and this
  keeps an outage from flooding the user on recovery. Deferred rows get a fresh
  `scheduled_for`, so quiet-hours/rate-limit holds are never counted stale.
- **Routine anchors (`notification_type = 'routine_reminder'`) ignore quiet hours** — the
  user picked those times deliberately. Without this, a night anchor at 22:00 against a
  quiet-hours start of 22:00 is suppressed every single night.
- Expired/undelivered anchors still call `rescheduleRoutineForTomorrow`, so the daily
  rhythm survives any single miss.
- `send-notification` deletes a subscription on 404, 410, **and** 400
  `VapidPkHashMismatch` (subscription created against a rotated VAPID key — it can never
  be delivered to; the device re-subscribes on next app open).
- **"The flag decides urgency" applies server-side too.** `off-track-scanner` filtered
  overdue tasks on `priority IN ('urgent','high')` — pre-collapse vocabulary that silently
  excluded overdue `deadline` and `school` tasks, the two kinds that reliably *have* a due
  date. When a vocabulary collapses, grep `supabase/functions/` as well as `src/`.
- **Deep links are parsed in exactly one place**: `src/utils/navIntent.ts`
  (`parseNavIntent`), executed by the headless
  `src/components/notifications/NotificationIntentHandler.tsx`, which mounts outside the
  routed content so a lock-screen "Mark done" still works while the check-in gate holds
  the app. `sw.js` only runs in production builds — test intents in dev by opening
  `/?route=tasks&intent=complete&taskId=<id>` directly. Full map: [docs/notifications.md](docs/notifications.md).
- **The Supabase CLI has no `functions logs` subcommand.** To confirm a redeployed
  function still boots without triggering its side effects, send it an `OPTIONS` request:
  module-level code runs on boot, so a boot crash 500s before the CORS branch replies.

### Edge functions cannot import `src/` — shared rules become copies

A rule that both the app and an edge function must apply gets hand-ported into
`supabase/functions/_shared/` **with a provenance comment naming its source**, because
Deno functions cannot reach `src/`. Current example:
`_shared/deadlineWorkday.ts` mirrors `suggestDeadlineWorkday` from
`src/features/tasks/utils/taskFlags.ts` — before it existed, `school-import` took a flat
three UTC days off the deadline, so an imported assignment landed on a different (and
possibly weekend) day than an identical one typed into the app. Ports do their day math
at **UTC noon**: UTC has no DST, so whole-day arithmetic can never shift the date. Keep
the pair in sync by hand.

### Edge function table access

Edge functions (`supabase/functions/`) use the **service role key** — they bypass RLS and can read/write any row. The `userId` from auth is passed explicitly to filter rows correctly.

### Migrations

Numbered migrations live in `supabase/migrations/`. Two unnumbered legacy files (`smart_notes_migration.sql`, `daily_planning_migration.sql`) were applied manually and are NOT tracked by the CLI. `20260716000001_checkin_gate.sql` was applied to the live DB via the Supabase MCP (remote history name `checkin_gate`) — reconcile with `supabase migration repair` if the CLI complains. `20260714000000_secure_ai_credentials` and `20260714000002_secure_capture_tokens` were likewise applied via the MCP on 2026-08-14, with their original version numbers inserted into `supabase_migrations.schema_migrations` by hand so the CLI history matches the filenames.

**A migration existing in `supabase/migrations/` does not mean it ran.** Those two sat unapplied for a month while the frontend and the deployed `assistant` function already depended on their tables — the visible symptom was a permanently-401ing iPhone Shortcut. Before debugging any "table/feature is broken", diff the local filenames against the remote history (`supabase migration list`, or the MCP `list_migrations`). Use `supabase migration repair` if the CLI history gets out of sync (see memory for the full repair pattern).

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