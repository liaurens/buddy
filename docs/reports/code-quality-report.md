# Buddy — Code & Project Quality Report

*Date: 2026-06-10. Scope: full repo (~51,500 lines of TS/TSX across `src/` and `supabase/functions/`), plus live-database usage data from project `kdwgznfszbrysepsltua`.*

---

## 1. Health snapshot

| Check | Result |
| --- | --- |
| TypeScript build (`tsc -b`) | ✅ passes clean |
| Unit tests (`vitest run`) | ✅ 288/288 pass (17 files) |
| ESLint | ❌ 193 errors, 20 warnings |
| Bundle | ⚠️ single 684 KB JS chunk, no code splitting |
| Hardcoded secrets scan | ✅ none found |

The fundamentals are solid: strict TS compiles, tests are green, no leaked keys. The debt is concentrated in lint hygiene, dead code, test design, and — at the product level — a large amount of built-but-never-used surface area.

---

## 2. Critical findings

### 2.1 The test suite tests copies of the code, not the code (HIGH)

Every assistant test file (`src/features/assistant/tests/*.test.ts` — agent-loop, rule-engine, general-manager, ai-classifier, date-parser, schema-validator, command-parser, tool-registry, rule-generator, hr-analyzer) **re-implements the edge-function logic inline** instead of importing it, e.g. `agent-loop.test.ts`:

> *"Re-implemented inline (matches the project pattern for testing edge code)."*

None of the assistant tests import a single line of production code (the real modules live in `supabase/functions/assistant/`, which is Deno). Consequence: the ~4,000 lines of edge assistant core are **effectively untested** — the suite stays green no matter what breaks in the real `rule-engine.ts` or `agent-loop.ts`, and the copies silently drift from the originals.

**Fix options (pick one):**
1. Extract the pure logic (date parsing, rule matching, schema stripping, response building) into a runtime-neutral `supabase/functions/_shared/` or `src/shared/` folder imported by both Deno and Vitest. Most of these functions have no Deno APIs in them — they are portable today.
2. Or run `deno test` against the functions directly in CI.

This is the single highest-leverage quality fix in the repo.

### 2.2 `app_events` instrumentation is silently broken in production (HIGH)

`src/services/app-events/index.ts` inserts into `app_events`, and `App.tsx` logs `app_open` / `route_visit` on every session — but the live database **does not have an `app_events` table** (migration `20260610000000_app_events.sql` is uncommitted and unapplied). Every insert fails and the `catch` swallows it. The whole point of this feature ("decide which modules to freeze later") is producing zero data right now. **Apply the migration (and `20260610000001_close_day.sql`) and commit the working tree.**

### 2.3 AI API keys live in the browser (MEDIUM-HIGH, security)

`src/features/planning/services/ai.service.ts` instantiates Anthropic/OpenAI SDKs with `dangerouslyAllowBrowser: true`, using keys stored **plaintext** in the `settings` table. Any XSS = key exfiltration. This entire client-side AI layer exists for exactly one consumer: `AITaskSplitter` (used in `TaskCard.tsx`).

Meanwhile the edge function already has a complete server-side provider wrapper (`ai-wrapper.ts`) for the same three providers. **Route task-splitting through the `assistant` edge function** and you get to:
- delete `ai.service.ts` (281 lines),
- drop `@anthropic-ai/sdk`, `openai`, and `@google/genai` from the client bundle entirely,
- stop shipping user API keys to the browser.

### 2.4 Shortcut `api_key` auth is weak (MEDIUM, security)

`supabase/functions/assistant/auth.ts` authenticates the iPhone Shortcut path by looking up a plaintext `quick_note_api_key` value in `settings` with a direct equality query. Issues: plaintext at rest, no constant-time comparison, no rate limiting / lockout on guesses, and the same pattern is presumably used by `quick-note`. Low practical risk for a single-user app, but cheap to harden: store a hash, add a minimal attempt counter, or switch the Shortcut to a long random bearer token checked against a dedicated column.

---

## 3. Project-level findings (the "is this actually used?" audit)

Live data, not speculation — pulled from the production DB.

### 3.1 Assistant tool sprawl: 22 tools registered, 6 ever used

`assistant_logs` (76 rows, full history):

| Tool | Uses | Last used |
| --- | --- | --- |
| system | 23 | 2026-05-13 |
| tasks | 17 | 2026-05-21 |
| calendar | 7 | 2026-05-18 |
| notes | 3 | 2026-05-19 |
| experiment-agent | 1 | 2026-05-18 |
| notifications | 1 | 2026-05-05 |
| *(no tool routed)* | 24 | 2026-06-09 |

**Never used, ever:** habits, mood, journal, tracker, goals, skills, strategies, study, projects, school, checklists, task-routines, task-types, context, learnings — roughly 16 tools and ~3,500+ lines of tool code. Several are among the worst lint offenders (projects.tool 10 errors, task-routines.tool 10, skills.tool 9, school.tool 8).

This isn't just dead weight on disk: every registered tool's schema is shipped to the model on every assistant request, which costs tokens/latency and measurably hurts routing accuracy (24 of 76 requests routed to no tool at all). **Recommendation: cut the registry down to the used set (+ tracker/school, which back features you actually use via UI), and re-add tools when a real need appears.**

### 3.2 Built-but-abandoned features (table row counts)

| Feature | Evidence | Code carrying it |
| --- | --- | --- |
| Protocols (supplements/meds) | `protocols`, `cycles`, `doses` all 0 rows | ProtocolsPage + `useProtocols` (359 lines) + converters |
| Checklists | `checklists` 0 rows | entire `features/checklists` module |
| Toolbox / strategies | `strategies` 0 rows | ToolboxPage (380 lines) + strategies.tool |
| Task routines | `task_routines`/`items` 0 rows | TaskSettingsModal parts + task-routines.tool (362 lines) |
| Study sessions | `study_sessions` 0 rows | study.tool |
| Growth Hub | `skills` 3, `goals` 1, `skill_logs`/`goal_logs` 0 | **GrowthHubPage.tsx, 1,119 lines — the largest file in the repo** |
| Smart-note categories | `note_categories` 0 rows | category routing in notes + journal.tool depends on it |
| Daily journal | `daily_journal_entries` 1 row | DailyJournalForm / DailyWins / MoodEnergyCapture / `useDailyJournal` — **already unreferenced in code** (see §4) |
| Correlations | `correlations` 0 rows | `correlations-agent` edge function — only invokable from the dev panel; has never produced output |
| HR/trainer agents | 20 learnings, 6 findings, **1 rule generated** | hr-agent + trainer-agent + rule-generator (one of the lint-heaviest files) |

What's genuinely alive: tasks/todos, calendar sync, notifications (503 scheduled), health entries (75), school, time blocks, reflection, the capture flow.

**Recommendation:** this matches the intent of your own `buddy-daily-use-report.md` — freeze the abandoned modules. Concretely: remove their routes/tools, keep the migrations (data is cheap), and move the page components to an `archive/` folder or delete them (git history preserves them). That's roughly **5,000+ lines of maintenance surface** gone without losing anything you use.

### 3.3 Orphan database table

`planner_drift_events` exists in the live DB but has **no reader or writer anywhere in the repo**. Either it belongs to a removed feature (drop it) or a migration was applied for code that never landed.

---

## 4. Dead code inventory (client)

Confirmed by ts-prune + manual grep (no false-positive barrel noise):

**Whole units, safe to delete:**
- `src/features/health-tracking/components/journal/DailyJournalForm.tsx`, `DailyWins.tsx`, `MoodEnergyCapture.tsx` and `hooks/useDailyJournal.ts` — journal UI, never rendered anywhere
- `src/features/tasks/components/HabitDashboard.tsx` and `StreakCalendar.tsx` — exported from the barrel, never rendered
- `src/hooks/useTimer.ts` — unused (focus timer has its own logic)
- `src/components/notifications/NotificationPermissionPrompt` — never mounted
- `classDocumentToDb` in `src/services/supabase/converters/school.ts`

**Unused validation schemas** (`src/lib/validation/schemas.ts`): `calendarConfigSchema`, `trackerDefinitionSchema`, `aiConfigSchema`, `apiKeySchema`, `safeUrlSchema`. Notable because it means the *intent* to validate input at boundaries exists but was never wired up — either use them where settings/config are saved, or delete them. Zod is a dependency but is imported in only 2 files.

**Unused constants:** `PRIMARY_COMMANDS` (assistant), `HEALTH_HUB_ROUTES` / `CALENDAR_HUB_ROUTES` / `TASKS_HUB_ROUTES` / `TOP_LEVEL_TABS` (routes.ts), `DEFAULT_LUNCH_DURATION_MINUTES` / `DEFAULT_BREAK_INTERVAL_MINUTES` (config.ts).

**Legacy type duplication:** `src/types.ts` re-declares `TrackerType`, `TrackerState`, `Todo`, `Subtask`, `TaskEnergy`, `TaskContext`, etc., which now live in feature modules (`features/health-tracking`, `features/tasks`). Nine files still import from the legacy file. Consolidate on the feature-module types and delete `src/types.ts`.

---

## 5. Code quality findings

### 5.1 Lint debt is concentrated and mechanical

193 errors break down as:

| Rule | Count | Note |
| --- | --- | --- |
| `no-explicit-any` | 157 | ~80% in edge tool files + `trainer-agent/rule-generator.ts`, `settings.service.ts`, `AssistantDevPanel.tsx` |
| `react-hooks/exhaustive-deps` | 19 | real stale-closure risk, review individually |
| `no-unused-vars` | 16 | trivial deletes |
| `react-hooks/set-state-in-effect` | 7 | render-loop / extra-render risk |
| others | 14 | incl. 2 `react-hooks/purity`, 1 `immutability` |

The `any`s in the edge tools share one shape: Supabase query results handled untyped. Defining `Db*` row types for the edge side (or generating them with `supabase gen types`) would clear most of the 157 in one pattern-application. Note: if §3.1's tool pruning happens first, ~60 of these errors disappear with the deleted files — **prune before you fix lint**.

### 5.2 Oversized files (project rule: 800 max, 200–400 typical)

| File | Lines | Suggested split |
| --- | --- | --- |
| `src/features/growth/pages/GrowthHubPage.tsx` | 1,119 | (or archive it — see §3.2) |
| `supabase/functions/assistant/core/ai-wrapper.ts` | 1,008 | one file per provider (`anthropic.ts`, `openai.ts`, `gemini.ts`) + shared types; it's a 3-provider × 3-mode matrix and every new capability grows it ×3 |
| `src/features/day/components/FullMorning.tsx` | 723 | extract step components |
| `src/features/planning/pages/ReflectionPage.tsx` | 645 | extract sections (CloseDayCard already started this) |
| `supabase/functions/school-import/index.ts` | 591 | parsing vs persistence |

### 5.3 Edge functions: no shared module

There is no `supabase/functions/_shared/`. `corsHeaders` is copy-pasted into 11 functions; auth and error-response shaping are similarly repeated. One `_shared/cors.ts` + `_shared/auth.ts` removes ~10 copies and gives §2.1 a natural home for the portable assistant logic.

### 5.4 Error handling = `console.error`

109 `console.error` / 5 `console.warn` in `src/`. There *is* a global ErrorBoundary (good), but the dominant service pattern is catch → log to console → sometimes swallow. For a PWA you use on your phone, the console is invisible — errors effectively vanish. Suggestion: tiny `reportError(context, err)` helper that (a) console-logs in dev, (b) writes to `assistant_error_logs`-style table or at least a toast in prod. You already built this exact machinery for the assistant (`error-logger.ts`); generalize it.

### 5.5 Bundle / performance

- One eager 684 KB chunk; `App.tsx` imports all 18 pages statically. `React.lazy` on the heavy, rarely-visited routes (GrowthHub, Experiments, School, Account, recharts-bearing Analysis) would cut initial load substantially.
- `recharts` (~100 KB+) loads for everyone for one Analysis view.
- The three AI SDKs disappear from the bundle entirely if §2.3 is done.
- `vite-plugin-pwa` is in `dependencies`; it's a build tool — move to `devDependencies`.

### 5.6 Misc

- `DevPortal` (inspector + feedback overlay) is mounted for every production user with no `import.meta.env.DEV` guard. If the feedback tool is intentional, rename it; if not, guard it.
- `package.json` `"name": "tracker"` — stale, the app is "buddy".
- Working tree has ~30 modified/new uncommitted files spanning at least 4 distinct features (offline outbox, close-day, app-events, notifications). Commit in feature-sized slices before it grows further.
- Tooling note: `knip` won't run on this machine (needs Node ≥ 20.12, you have 20.11.1); `ts-prune` works.

---

## 6. What's genuinely good

Worth saying explicitly:

- **Strict TypeScript passes with zero errors** across 51k lines — rare for a solo project.
- The **three-layer Supabase pattern** (Db types → converters → operations) is consistently applied and makes the naming gotchas (`entries`, `todos`) survivable.
- The **new code is the best code**: `captureOutbox.ts` (durable IndexedDB FIFO with honest delivered/retry semantics), `app-events`, and `closeDay.service.ts` are small, documented, tested, and have clear "why" comments.
- Feature-module organization with barrel exports is clean; `App.tsx` at 225 lines for an 18-route app is disciplined.
- The edge assistant's registry/manager/tool architecture is genuinely extensible — the problem is over-population (§3.1), not the design.
- Auth on the edge functions correctly validates JWTs against Supabase rather than trusting headers.

---

## 7. Prioritized action plan

| # | Action | Effort | Impact |
| --- | --- | --- | --- |
| 1 | Apply `app_events` + `close_day` migrations; commit working tree in slices | S | Unbreaks instrumentation you're already emitting |
| 2 | Prune assistant tool registry to the ~8 used/UI-backed tools | S | Tokens, latency, routing accuracy, −60 lint errors |
| 3 | Archive/delete abandoned features (protocols, checklists, toolbox, routines, study, journal UI, growth hub or slim it) | M | −5,000+ lines of maintenance surface |
| 4 | Make assistant tests import real code (extract portable logic to `_shared/`) | M | Test suite actually protects the assistant core |
| 5 | Move AITaskSplitter AI call to the edge; delete client `ai.service.ts` + 3 SDK deps | M | Security (keys out of browser) + bundle size |
| 6 | Delete dead client code from §4; consolidate `src/types.ts` | S | Hygiene |
| 7 | Type the edge tool Supabase rows; fix remaining `any`s and the 19 `exhaustive-deps` | M | Clears lint to ~0; removes stale-closure bugs |
| 8 | `React.lazy` heavy routes; move `vite-plugin-pwa` to devDeps | S | First-load performance |
| 9 | Add `supabase/functions/_shared/` (cors, auth, error responses) | S | DRY across 11 functions |
| 10 | Harden shortcut api_key auth; drop orphan `planner_drift_events` or wire it up | S | Security/schema hygiene |

Items 1–3 are the highest value-per-hour: two of them are mostly *deleting* things, and the data shows exactly what's safe to delete.
