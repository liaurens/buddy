# Five Pillars — Implementation Plan

The buddy app lives or dies on five daily surfaces. This plan targets concrete weaknesses in each, in execution order. Each pillar is independently shippable.

---

## Pillar 1 — Tasks overview that you can trust at a glance

**Goal:** open TodoPage → see what's overdue, what's today, what's this week, what's deferred — in that order — and fix three overdue items in one tap each.

### Current state
- `src/features/tasks/pages/TodoPage.tsx` (449 lines) — flat ranked list, no time buckets.
- `src/features/tasks/utils/taskRecommender.ts` — scoring logic is good (overdue +100, today +80, etc.).
- `src/features/core/components/TodayCard.tsx` — counts `due_date = today` only; misses overdue.
- No batch actions. No recurrence preview. `project_id` exists in schema, never rendered.

### Changes
- **`src/features/tasks/pages/TodoPage.tsx`** — replace the single ranked list with four collapsible sections:
  1. **Overdue** (red header, auto-expanded, pinned on top)
  2. **Today**
  3. **This week** (due ≤ 7 days)
  4. **Later / no due date** (collapsed by default)
  Completed list stays at the bottom as today. Existing `useTaskRecommendation` / `getRankedTasks` logic continues to score *within* each bucket.
- **New file `src/features/tasks/components/TaskBulkActionBar.tsx`** — floating action bar that appears when ≥1 task is checked. Actions: **Reschedule to…** (today / tomorrow / next week / pick date), **Snooze 1 week**, **Archive**, **Mark done**. Reuses the existing `useTasks` mutation hooks.
- **`src/features/tasks/components/TaskItem.tsx`** (or wherever the row lives) — add a leading checkbox that toggles selection state held in `TodoPage`. Show a `Next: Fri` chip next to the title when `recurrence !== 'none'`, computed via existing `getNextRecurrence` helper.
- **`src/features/core/components/TodayCard.tsx`** — fix the count: split into `overdue` + `today` counts; if `overdue > 0`, render it in amber as the primary line.
- **`src/features/tasks/components/TaskForm.tsx`** — add a Project selector (simple `<select>` backed by `useProjects`) and render the project name as a tiny pill on the task row when set. No new schema.

### Out of scope
- Drag-to-reorder, Kanban view, per-label filtering. Worth building *after* buckets feel right for a week.
- Someday/Maybe as a distinct state. Filling the "Later / no due date" bucket is enough for now.

### Verification
`npm run dev`, open TodoPage, check: overdue bucket appears with red dot when overdue items exist, checking 3 tasks surfaces the action bar, "Reschedule to tomorrow" updates all three due dates, recurring task shows a "Next: …" chip. Home TodayCard shows `N overdue · M due today` when both non-zero.

---

## Pillar 2 — Reflection that actually reflects

**Goal:** the evening flow turns from a stats dashboard into a 90-second reflection that captures wins, blockers, and mood — and feeds tomorrow's planner.

### Current state
- `src/features/planning/pages/ReflectionPage.tsx` (301 lines) — shows completion %, time variance buckets, 30-day task-type patterns. No prompts. No longitudinal mood. No wins capture.
- `daily_plans.user_context.mood_at_plan_time` is written but never read back.
- `assistant_learnings` exists and is already wired into `planner.tool.ts` — we can piggyback on it.

### Changes
- **`src/features/planning/pages/ReflectionPage.tsx`** — add, in this order, above the existing stats:
  1. **Mood & energy trend** — inline 14-day sparkline of mood from `daily_plans.user_context.mood_at_plan_time` and energy (added in Pillar 3). Two thin lines, one card. Shared utility in `src/features/planning/services/moodHistory.ts` (new).
  2. **Three wins** — three short `<textarea>` inputs. (Positive-psychology "Three Good Things" exercise — the only reflection ritual with solid RCT evidence behind it.) Saves to `assistant_learnings` with `type='reflection_win'`.
  3. **One blocker** — "What got in the way today?" single textarea. Saves as `type='reflection_blocker'`. If left blank, no row written (no empty rows).
  4. **Tomorrow's one thing** — "If you only do one thing tomorrow, what is it?" Saves as `type='reflection_priority'`. Planner reads this next morning as a hard-pin.
- **Stats collapse** — existing completion/variance stats become collapsible "Day metrics" section below the reflection, default collapsed. Never delete; they're useful after the reflection, not before.
- **`supabase/functions/assistant/tools/planner.tool.ts`** — when generating tomorrow's plan, load the latest `reflection_priority` learning from the last 24h and prepend it to the "user goals" block in the AI prompt. If a `reflection_blocker` exists, surface it in the prompt as "yesterday's blocker — design around this."
- **New hook `src/features/planning/hooks/useReflectionHistory.ts`** — loads recent mood/energy values for the sparkline. No new table.

### Out of scope
- Guided CBT/RAIN walkthroughs. Too prescriptive; the Three Good Things + one blocker is enough structure to be useful without becoming a therapy app.
- Voice reflection. Re-use the existing CaptureFAB once it proves reliable.

### Verification
Open ReflectionPage in the evening, fill wins + blocker + tomorrow's-one-thing, confirm rows land in `assistant_learnings`. Next morning, generate a plan and check the AI prompt (via AssistantDevPanel logs) shows the priority + blocker. Sparkline renders with 14 days of mood/energy once that data exists.

---

## Pillar 3 — Planner that remembers yesterday

**Goal:** the morning plan reflects yesterday's energy, focus rating, blocker, and reflection priority. Recurring activities auto-select. Energy is captured separately from mood.

### Current state
- `src/features/planning/pages/PlannerPage.tsx` — 1394 lines, monolithic, four inline step views.
- `supabase/functions/assistant/tools/planner.tool.ts` — strong AI prompt with three modes, but only reads *today's* intake; never queries yesterday's `user_context` or `reflection_priority`.
- Activity templates have `frequency` + `preferred_time_slot` but aren't auto-selected.
- Todos have `priority` but the prompt doesn't mention how to weight it.

### Changes
- **`supabase/functions/assistant/tools/planner.tool.ts`** — before building the AI prompt, fetch:
  - yesterday's `daily_plans` row (mood, energy, focus_rating, medication_taken, plan_worked)
  - latest `reflection_priority` / `reflection_blocker` from `assistant_learnings` (last 24h)
  - activity templates where `frequency='daily'` OR (`frequency='weekly'` AND today's weekday matches the preferred slot)
  Inject these into the system/user prompt with clear sections: "Yesterday's context", "Recurring to include", "Priority to honor".
  Also add a one-line instruction: "Weight task priority: urgent/high tasks go in the first 2 focus blocks unless the user deselected them."
- **`src/features/planning/pages/PlannerPage.tsx` intake step** — add an **Energy** slider (1–10) alongside the existing Mood slider. Store in `daily_plans.user_context.energy` on plan.start.
- **Auto-select recurring activities** — when intake step loads, pre-check activity templates matching today's frequency/slot. User can still uncheck.
- **`src/features/planning/pages/PlannerPage.tsx` split** — extract four sub-components into `src/features/planning/components/planner/`:
  - `IntakeStep.tsx` (mood/energy/hours/meds/task-and-activity picks)
  - `GenerateStep.tsx` (loading + preview)
  - `ReviewStep.tsx` (block timer, per-block controls)
  - `CloseStep.tsx` (focus rating, learning capture)
  A new `usePlannerTimer` hook carries timer state. PlannerPage becomes a ~200-line coordinator. Do this refactor last, after the behavior changes land and work.

### Out of scope
- Conflict detection between calendar events and time blocks (worth doing but touches calendar sync — separate task).
- Rescheduling a block within the timeline via drag. The current inline controls already do reschedule-adjacent.

### Verification
Run plan.generate after a day with reflection captured; confirm the AI response references yesterday's blocker or priority. Check that a daily-frequency activity appears pre-checked without user action. PlannerPage still compiles and all four steps work after the split.

---

## Pillar 4 — Experiments with real statistical rigor

**Goal:** when you finish a 4-week N-of-1 experiment (e.g. "does 10mg methylphenidate raise focus?"), you get an effect size, a p-value, and a confidence interval — not just two bar heights.

### Current state
- `src/features/health-tracking/components/experiments/ExperimentAnalysisPanel.tsx` (170 lines) — phase-averaged sparklines, no tests.
- `src/features/health-tracking/components/tracker/Analysis.tsx` already has Pearson r, two-tailed p-value (t-distribution), 95% CI, time-lagged correlation. The stats are *already in the repo* — just not in experiments.

### Changes
- **New file `src/features/health-tracking/utils/stats.ts`** — extract the numerical functions currently inside `Analysis.tsx` (pearson, calculatePValue, calculateConfidenceInterval, tDistCDF, etc.) plus three new ones:
  - `welchTTest(a: number[], b: number[])` — Welch's t-test for unequal variances. Returns `{ t, df, pTwoSided }`.
  - `cohensD(a: number[], b: number[])` — effect size, pooled SD. Returns `{ d, interpretation }` (`'small' | 'medium' | 'large'`).
  - `meanDiffCI(a: number[], b: number[], confidence = 0.95)` — mean-difference 95% CI.
  Refactor `Analysis.tsx` to import from this utility so there's one source of truth.
- **`ExperimentAnalysisPanel.tsx`** — for each custom metric with a defined baseline phase and intervention phase:
  - Show `baseline mean ± SD (n)` and `intervention mean ± SD (n)` side by side.
  - Run `welchTTest` between the two phases, render `Δ = +1.2, 95% CI [0.3, 2.1], p = 0.008, Cohen's d = 0.52 (medium)`.
  - Warn inline when `n < 7` per phase: "Not enough data for a reliable comparison yet."
- **Phase config UX** — `ExperimentWizard.tsx` already supports arbitrary phases; add a "mark as baseline" checkbox on phase creation so the analysis knows which phase is the baseline. First phase defaults to baseline.

### Out of scope
- Bayesian N-of-1 modeling, Monte-Carlo permutation tests. Nice, but frequentist Welch's t + Cohen's d is already a 10x upgrade over "two bar heights" and is what most sports-science and self-experiment literature uses.
- Washout periods. Add once the baseline comparison is proven useful.

### Verification
Create a 14-day experiment with a baseline phase and an intervention phase, log 7+ days in each, open the Analysis tab: numerical comparison + p-value + Cohen's d must render. When n<7, the warning shows instead of the numbers.

---

## Pillar 5 — Tracker / parameters DB with retrospective power

**Goal:** beyond the 2-variable correlation explorer, you get (a) a pinned "top correlations" card that surfaces the strongest relationships without you having to hunt, and (b) a segmentation view that answers "how does X change when Y is true vs false".

### Current state
- `trackers` + `entries` schema is clean. `correlations` table exists but isn't populated from anywhere visible.
- Analysis is client-side and pair-wise; computing top-N requires N² pairs × per-pair fetch.
- No "filter by condition" UI.

### Changes
- **New edge function `supabase/functions/correlations-agent/`** — on demand (triggered from Dev Panel, same pattern as HR agent): for each user, iterate every pair of trackers with ≥10 overlapping days, compute Pearson r + p-value, write rows into the `correlations` table with `computed_at`, `n`, `r`, `p_value`. Delete older rows for the same pair. Cheap — runs in seconds.
- **New component `src/features/health-tracking/components/tracker/TopCorrelationsCard.tsx`** — pinned on TrackerPage below the dashboard. Reads the latest `correlations` rows, shows top 5 by `|r|` where `p < 0.05` and `n >= 10`. Each row links to the existing 2-variable Analysis view.
- **New component `src/features/health-tracking/components/tracker/SegmentComparePanel.tsx`** — under TrackerPage → Analysis, an alternative mode "Compare segments":
  - Pick outcome tracker (e.g. Focus)
  - Pick segment predicate: a boolean tracker or `protocol.linked_tracker` ("Ritalin taken = true")
  - Render: `days matching: n₁, mean=X ± SD`; `days not matching: n₂, mean=Y ± SD`; Welch's t, Δ with 95% CI, Cohen's d. (Reuses the `stats.ts` utility from Pillar 4.)
- **Dev Panel trigger** — add a "Recompute correlations" button that calls the new edge function, same style as HR/Trainer triggers. No pg_cron (per user preference).

### Out of scope
- Multi-variable regression, partial correlations controlling for confounders. Worth building *if* the 2-variable segmentation doesn't already answer most questions — revisit after a month of use.
- NL query ("how does caffeine affect focus?"). The assistant can already route `/analyze` with parameters once the components exist — add the routing later.

### Verification
Trigger correlations-agent, confirm ≥1 row appears in `correlations`. TopCorrelationsCard renders the strongest 5 with readable labels. Segment compare panel: pick Focus + "Ritalin=true", verify Δ, CI, p-value match hand-calc on a small dataset.

---

## Execution order and risk

| # | Pillar | Days | Risk | Unlock |
|---|--------|------|------|--------|
| 1 | Tasks overview — buckets + bulk | 1 | low | every app-open |
| 2 | Reflection — prompts + mood trend | 1 | low | evening ritual + tomorrow's plan quality |
| 3 | Planner — remember yesterday + energy | 1 | medium | morning plan feels coach-like |
| 4 | Experiments — rigor | 1.5 | low | N-of-1 becomes trustworthy |
| 5 | Tracker — top correlations + segmentation | 2 | medium | retrospective insight at a glance |

Total: **6.5 working days** for the behavior changes. The PlannerPage split (last half of Pillar 3) is refactor, not behavior — slot it whenever the four-step flow feels stable.

### Dependencies
- Pillar 2 writes `reflection_priority` / `reflection_blocker` → Pillar 3 reads them. Do 2 before 3.
- Pillar 4 extracts `stats.ts` → Pillar 5 uses it. Do 4 before 5.
- Pillars 1 and 2 are independent of everything else.

### Open questions
1. **`assistant_learnings.type`** — the table takes `type` as a free string; confirm `reflection_win` / `reflection_blocker` / `reflection_priority` don't collide with existing values before adding them.
2. **Energy alongside mood** — the check-in modal already tracks energy via a custom tracker for many users. Adding a second energy field in planner intake risks duplication. Consider: if an "Energy" tracker exists, read today's entry and skip the slider.
3. **Correlations edge function authorization** — should it run for the triggering user only, or loop all users like HR agent? Default: triggering user only (cheaper, safer).

Answer those three before Pillar 3 and 5 begin. They don't block Pillars 1, 2, or 4.