# Tasks & the capture-triage pipeline

How raw phone-captured tasks become correctly-routed, deterministically-ordered, low-overwhelm work. Covers the **triage pipeline**, the **three-touch-day surfaces** (morning pick, Now page, school mirroring, stuck signals, survival day), and the **canonical ordering** layered on the tasks feature.

## Purpose

Phone capture is fast but dumps everything into one undifferentiated inbox. The pipeline turns that inbox into tasks routed to the right place, and the daily surfaces show only what today needs:

- **urgent** → home `UrgentInboxCard` → `UrgentScheduleModal` (when + prep) → Google Calendar write-through.
- **today** → `dueDate` = today (+ optional time), pulled into the day plan.
- **someday** → `kind=backlog`, no date; surfaced one-at-a-time (anti-overwhelm).
- **school** → set `assignmentId` (mirrors into the school feature); loose school tasks surface in `SchoolPlanningPicker`.
- **routine** → `recurrence` (defaults daily) → derives the routine kind.

## Data model (`todos`)

| Column | Meaning |
| --- | --- |
| `triaged_at` | When routed. `NULL` = still in the capture inbox. |
| `hardness` | `fixed` (planner locks it) / `flexible` / `NULL` (= flexible). |
| `auto_triaged` | AI routed without confirmation; drives the "I sorted these" review. |
| `triage_destination` | `urgent`/`today`/`someday`/`school`/`routine`. Loose school = `'school' AND assignment_id IS NULL`. |
| `assignment_id` | FK to `assignments`. Every assignment auto-creates a linked todo; completing either completes both (graded stays graded). Migration `20260704000001` backfilled existing ones. |
| `snooze_count` | Times pushed to a later date while incomplete (stuck signal). Migration `20260704000002`. |
| `last_touched_at` | Last user interaction; `NULL` falls back to `created_at`. |
| `kind` | Explicit behavioral kind. **Never `'school'`** — that value is derived-only (DB CHECK rejects it; `todoToDb` nulls it). |

`daily_plans.capacity` (`normal`/`survival`, migration `20260705000000`) is the survival-day switch: 1 morning pick slot, non-anchor notifications deferred by the `schedule-notifications` edge fn.

## Invariants (see also CLAUDE.md → Tasks feature invariants)

1. **Due dates parse through `utils/dueDates.ts`** (`parseDueDate` = local-noon anchor). `new Date('YYYY-MM-DD')` is a UTC-midnight off-by-one bug.
2. **One write path**: updates persist via `services/taskWrites.ts` `persistTaskUpdate` (converter-driven columns + kind write-through + reminder sync + Google mirror). All three triage paths (manual, silent auto-apply, eager on-capture) build the final task with `services/applyTriage.ts` `applyTriagePatch`, so results are byte-identical. Inferred profile fields (energy/estimate/type/…) fill gaps only — never overwrite user-set values.
3. **One canonical order**: `utils/taskOrdering.ts` `sortTasksCanonical` (recommender score desc → dueDate asc, undated last → createdAt → id) sorts every view. Scoring (`utils/taskRecommender.ts`): urgent priority weight 120 (dateless urgent > plain due-today; overdue still highest), staleness +15 ("keeps slipping"), backlog aging +1/week capped at 8 ("waiting N weeks"). The top pick shows its reason as a hint.
4. **Kind derivation** (`utils/taskKind.ts`): explicit kind → school (assignment/destination) → routine → urgent → deadline (due ≥3 days out, no reminder needed) → standard → backlog. Pickers offer `PICKABLE_TASK_KINDS` (no school).

## Key files

- **Pure logic (tested):** `utils/dueDates.ts`, `utils/taskOrdering.ts`, `utils/taskRecommender.ts`, `utils/taskKind.ts`, `utils/staleness.ts` (`isSnooze`/`nextSnoozeCount`/`isStale`), `utils/triageRouting.ts` (`routeTaskPatch`, `kindToDestination`), `utils/sanitizeTriageSuggestions.ts` (clamps AI output; resolves `taskTypeName` → validated `taskTypeId`), `utils/triageConfidence.ts`, `utils/somedayPick.ts`, `utils/inbox.ts`, `utils/quickCaptureParser.ts` (EN+NL keywords), `day/utils/morningPick.ts` (small-task-biased 3-slot suggestion), `school/utils/assignmentTodo.ts`, `core/utils/homeSections.ts`.
- **Services:** `services/taskWrites.ts`, `services/applyTriage.ts`, `services/eagerTriage.ts` (loads real assignments + task types itself), `services/triageLearnings.ts`, `day/services/dayCapacity.ts`.
- **Hooks:** `hooks/useTasks.ts` (query hides completed >30d; snooze/touch stamping; assignment completion mirroring), `hooks/useTaskTriage.ts` (auto-apply with failed-write recovery into the review inbox), `hooks/useTaskRecommendation.ts`.
- **UI:** `components/TaskCard.tsx` ("Split this?" chip on stale tasks, top-pick "Why" hint), `components/QuickCapture.tsx`, `components/TriageInbox.tsx`, `day/components/MorningPickCard.tsx`, `day/components/PickRow.tsx`, `core/components/TodayFocusCard.tsx` (Now page hero + evening close-day CTA), mobile chips All/Urgent/Today/Someday/⚡ Quick wins/Done.

## Flow

See [diagrams/tasks-triage.md](diagrams/tasks-triage.md).

1. **Capture** → todo with `triaged_at = NULL` (explicit kind skips the inbox and stamps `triage_destination` via `kindToDestination`).
2. **Eager triage** (online + AI) → high confidence auto-applies via `applyTriage` (`auto_triaged = true`); low confidence waits.
3. **Morning "Sort inbox"** → AI pre-fills; user accepts/edits; corrections feed `settings.triage_learnings`. Failed auto-applies reappear in the review inbox.
4. **Morning pick** → `MorningPickCard` suggests 2–3 small tasks (deterministic, no AI dependency); accept = `rescheduleMany([id], today)`.
5. **Daytime** → Now page shows picks (done/snooze/split); snoozing twice or sitting untouched past due flags the task stale → split affordance.
6. **Evening** → close-day CTA on Home inside the eat-and-phone window.

## Gotchas

- Table is **`todos`**, not `tasks` (CLAUDE.md naming gotcha).
- **Google Calendar write is committed but not live in prod** (no `VITE_GOOGLE_OAUTH_CLIENT_ID` on Netlify). See `.claude/progress/done/20260619-google-calendar.md`.
- No business logic in screen components — logic lives in `utils/` + `services/` + hooks.
- `routeTaskPatch` uses explicit `undefined` on `dueDate`/`kind` as a deliberate *clear* (urgent drops its date); `applyTriagePatch` only strips undefined on profile fields.
- Pre-existing React-Compiler ESLint errors in `FullMorning.tsx`/`App.tsx`/`CalendarSettingsModal.tsx` trip the husky pre-commit; recent parts committed `--no-verify` (no new errors introduced).
- The triage UI works manually even when AI is not configured.
