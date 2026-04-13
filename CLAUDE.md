# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Student Buddy App — a PWA for executive function, self-regulation, and holistic life tracking. Built with React 19 + TypeScript + Vite, styled with Tailwind CSS, backed by Supabase (PostgreSQL), deployed on Netlify.

## Commands

- **Dev server**: `npm run dev`
- **Build**: `npm run build` (runs `tsc -b && vite build`)
- **Lint**: `npm run lint`
- **Tests**: `npm test` (watch mode), `npm run test:run` (single run)
- **Single test**: `npx vitest run src/features/assistant/tests/rule-engine.test.ts`
- **Test coverage**: `npm run test:coverage`

## Architecture

### Routing & Layout

No router library — `App.tsx` uses a `useState<AppRoute>` with a switch statement to render pages. Navigation is done via `onNavigate(tab, params?)` callbacks passed down as props. Each page can have a per-route settings modal registered in `SETTINGS_MODALS`.

### Feature Modules (`src/features/`)

Each feature is a self-contained module with its own components, hooks, services, and types:

- **health-tracking** — custom metric tracking, correlation analysis, protocols (supplements/meds), experiments
- **planning** — AI daily planning, time blocking calendar, daily reflection
- **tasks** — todo list with prioritization, smart notes with auto-categorization
- **assistant** — AI chat interface with slash commands, tool registry, rule engine, HR/trainer agents
- **checklists** — reusable checklists for recurring routines
- **toolbox** — personal strategy library
- **focus** — Pomodoro timer
- **core** — home page, login, account, shared infrastructure

Features export their public API through barrel `index.ts` files.

### Supabase Data Layer (`src/services/supabase/`)

Three-layer pattern:
1. **Types** (`types/`) — database row types prefixed with `Db` (e.g., `DbTracker`, `DbTodo`)
2. **Converters** (`converters/`) — bidirectional mapping between `Db*` types and domain types (e.g., `dbToTracker`/`trackerToDb`)
3. **Operations** (`operations/`) — higher-level database operations (settings, backup, seeding)

The `client.ts` exports the Supabase client and an `isSupabaseConfigured` flag.

### Supabase Edge Functions (`supabase/functions/`)

Serverless functions for: AI assistant, calendar proxy, HR agent, trainer agent, quick notes, push notifications.

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
| `todos` | Tasks | NOT called `tasks`. Has `recurrence` + `recurrence_config` columns. |
| `entries` | Health tracking check-ins | NOT `tracker_entries`. Stores numeric/text values per tracker. |
| `trackers` | Health tracker definitions | Name, type, unit, goal config. |
| `smart_notes` | Quick notes | Has `category_id` FK to `note_categories`. |
| `note_categories` | Note category definitions | Flag-based routing (e.g. `shop`, `boodschap`). |
| `daily_plans` | AI daily planning | One row per user per date. |
| `time_blocks` | Planning time blocks | FK to `daily_plans`. Status: `pending/active/completed/skipped`. |
| `activity_templates` | Recurring activity templates | Used by AI planner to schedule recurring activities. |
| `calendar_events` | Calendar entries | Synced from external calendars via proxy. |
| `correlations` | Computed tracker correlations | Calculated server-side. |
| `protocols` | Supplement/medication protocols | Links to `trackers` via `linked_tracker_id`. |
| `cycles` | Protocol cycles | Tracks on/off periods. |
| `doses` | Individual dose records | FK to `cycles`. |
| `experiments` | Hypothesis tracking | Links two trackers for comparison. |
| `experiment_logs` | Experiment daily journals | — |
| `checklists` | Reusable routine checklists | — |
| `strategies` | Personal strategy library | — |
| `settings` | Per-user key/value store | AI keys (`ai_aiProvider`, `ai_aiApiKey`, `ai_aiModel`), preferences. |
| `assistant_logs` | AI assistant interaction log | Columns: `detection_method` (`rule/ai/command/legacy`), `domain`, `tool_id`, `routing_method`, `ai_calls`, `processing_steps`. |
| `assistant_learnings` | Assistant learned patterns | Type: `new_rule/correction/behavior/note`. |
| `assistant_findings` | Assistant anomaly findings | Used by HR agent. |
| `assistant_rules` | Dynamic routing rules | Trainer-generated, loaded at runtime. |
| `assistant_error_logs` | Assistant error logging | Full context: step, domain, intent, stack trace. |
| `goals` | Personal goals | Status: `active/completed/paused/abandoned`. Progress 0-100%. |
| `projects` | Project management | Links to `todos` via `todos.project_id` FK. |
| `study_sessions` | Study session logs | Subject, duration_minutes, notes. |
| `notification_subscriptions` | Push notification endpoints | — |
| `scheduled_notifications` | Queued push notifications | — |
| `notification_logs` | Push delivery log | — |

### Critical naming gotchas

- Health tracker entries = **`entries`** (never `tracker_entries`)
- Tasks/todos = **`todos`** (never `tasks`)
- The edge function `supabase/functions/assistant/tools/tracker.tool.ts` must use `entries`, not `tracker_entries`

### Edge function table access

Edge functions (`supabase/functions/`) use the **service role key** — they bypass RLS and can read/write any row. The `userId` from auth is passed explicitly to filter rows correctly.

### Migrations

Numbered migrations live in `supabase/migrations/`. Two unnumbered legacy files (`smart_notes_migration.sql`, `daily_planning_migration.sql`) were applied manually and are NOT tracked by the CLI. Use `supabase migration repair` if the CLI history gets out of sync (see memory for the full repair pattern).