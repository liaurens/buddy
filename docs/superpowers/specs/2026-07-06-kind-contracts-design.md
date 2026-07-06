# Kind Contracts — behavior-driving task categories

**Date:** 2026-07-06
**Status:** Approved
**Motivation:** The urgent kind works because it isn't a label — it forces a scheduling decision (`UrgentScheduleModal`). The other kinds and the task-type categories (admin, house, …) are passive labels: they carry no implication for *when* a thing happens, so the list stays a wall of everything. This part gives every kind one decision moment and one resurface rule, constrained by `docs/reports/buddy-improvement-report.md` (three-touch day, PDA, no streaks, no new notifications, no new daily demands).

## Design constraints (from the improvement report)

- **No new notifications, pages, or daily demands.** Every behavior attaches to existing surfaces: kind pickers/triage (decision moments), the task list + morning pick (resurfacing), the triage-inbox slot, the task card.
- **No streaks or visible counters** (§7 PDA traps).
- **Nothing hard-hidden.** Parked tasks sink by score / collapse into shelves, but remain findable — one trusted surface.
- **Calendar auto-fill / schedule generation: explicitly out of scope** (PDA trap per report §4/§7).
- **Batch session mode ("20 min of admin") deferred to a follow-up part.**

## 1. Data model (one migration)

- `todos`: add `waiting_on text NULL`, `start_date date NULL`; extend the `kind` CHECK constraint to allow `'waiting'`.
- `task_types`: add `home_days smallint[] NULL` (0=Sun … 6=Sat).
- No new columns for someday review (derives from `last_touched_at ?? created_at`) or routine skips (derives from `due_date` lag vs recurrence pattern).
- Converters/types: `Task.waitingOn`, `Task.startDate`, `TaskType.homeDays`; `TaskKind` union gains `'waiting'`.

## 2. Waiting-on kind ⏳ (new)

- New pickable kind `waiting` (never derived — explicit only). `TASK_KIND_META`: ⏳ / slate-ish palette / "Parked until you chase it".
- Picking it opens **WaitingOnModal** (urgent-modal pattern): *who are you waiting on* (required) + *chase date* (required, default +3 days) + optional note. Chase date is stored in `dueDate` so every existing due-date surface (overdue truth, morning pick, reminders) just works.
- While `dueDate > today` the task is **parked**: `scoreTask` returns ~0, morning pick excludes it, and the main list shows it only inside a collapsed "⏳ Waiting (n)" shelf at the bottom.
- On/after the chase date it resurfaces as due today with reason "time to chase {waitingOn}".

## 3. Deadline start plan 🎯

- Choosing kind `deadline` (or triage routing there) with a due date asks one extra question via **StartPlanModal**: "When will you start?" — pre-filled `max(today, dueDate − 3 days)` (3 = `DEADLINE_HORIZON_DAYS`), one tap to accept.
- Before `startDate`: parked (score-suppressed, out of morning pick), still visible in its Deadline group with a "starts Mon" label.
- From `startDate`: competes normally.
- If `startDate` passes untouched: existing stale-chip machinery (`staleness.ts`) shows **"start slipped — replan"**, which reopens the start question.

## 4. Someday shelf life 🗂️

- A backlog/someday task with `lastTouchedAt ?? createdAt` ≥ **28 days** old is review-eligible.
- At most **one review card per day** (oldest eligible) renders in the triage-inbox slot on the tasks page: **keep** (touch → resets clock) / **schedule it** (date picker) / **let it go** (delete). Gentle copy, single card, never blocking.

## 5. Routine skip decision 🔁

- Derivation: occurrences missed = how far `dueDate` lags today in units of the recurrence pattern (daily → days, weekdays → weekdays, weekly → weeks, monthly → months).
- At ≥ **3 missed occurrences**, the task card shows a one-tap decision chip: **"This isn't landing"** → *ease cadence* (opens recurrence editor) / *pause* (recurrence → none; task becomes someday) / *delete*. No streaks, no counters displayed.

## 6. Category home slots 🏠

- Task-type manager gains a "home days" weekday picker per type (e.g. House → Sat+Sun, Admin → Mon–Fri).
- `scoreTask` adds **+12, reason "fits today"** when today ∈ the task's type `homeDays`. Boost only — no penalty, no hiding.

## 7. Scoring integration

All ranking flows through `scoreTask` (`utils/taskRecommender.ts`) and the canonical comparator — parked states (waiting pre-chase, deadline pre-start) and the home-day boost are implemented there, so every view (list groups, morning pick, next-up) stays consistent. Morning pick additionally filters parked tasks from its candidate pool.

## 8. Error handling

- Modals follow the `UrgentScheduleModal` pattern: inline error, disabled save, toast on success, console + toast on failure.
- Derivations are pure functions with injected clocks; malformed dates fall back to "not parked / not eligible" (fail open — never hide a task because of bad data).

## 9. Testing (Vitest, pure logic only per repo convention)

- Waiting: parked scoring pre-chase, resurfacing on chase date, shelf membership.
- Start plan: suggested-start computation, pre-start suppression, slip detection.
- Someday: eligibility at 28 days, oldest-first single pick per day, keep-resets-clock.
- Routine: missed-occurrence derivation per pattern (daily/weekdays/weekly/monthly), 3-miss threshold.
- Home slots: boost applied only on matching weekday; no effect without `homeDays`.
- Kind: `deriveTaskKind` never derives `waiting`; CHECK/converter round-trips.

## Out of scope

Batch session mode (follow-up part), calendar auto-fill (rejected), any notification changes, part-of-day slots (days suffice for the only daily surface, the morning pick).
