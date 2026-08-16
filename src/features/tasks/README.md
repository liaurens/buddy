# Tasks

Everything about a task: how it gets in, how it gets classified, how it gets
written, and where it shows up.

If you only read one thing: **`flag` is the classification. There is one insert
path and one update path. Nothing hand-writes `todos` columns.**

---

## The four stages

Every task takes the same route.

### 1. Capture — text becomes a draft

`utils/quickCaptureParser.ts` pulls a title, task type, dates, priority, energy,
recurrence and an explicit `#flag` out of free text. Deterministic, no AI, EN + NL.

Three surfaces capture:

| Surface | Path |
| --- | --- |
| Capture tab | `features/cove/capture/CoveCapturePage` → `useTasks.addTaskFull` |
| Close-day follow-up | `CloseDayOverlay` → `useTasks.addTask` |
| iPhone Shortcut / assistant | `supabase/functions/assistant/tools/tasks.tool.ts::createTask` |

Two more create tasks without a person typing: the school mirror
(`features/school/utils/assignmentTodo.ts` — every assignment gets a linked
todo) and the recurrence spawn (completing a repeating task creates the next
occurrence).

**The edge function is a capture endpoint, not a classifier.** It records the
title, a date if the text obviously carries one, and an explicit `#flag` if you
typed one — then stops. Anything without an explicit flag lands in the inbox
untriaged so Buddy's AI sorts it, exactly like a task captured in the app. It
used to infer flags, recurrence, reminder cadence and priority with its own
rules *and* stamp `triaged_at`, which meant every Shortcut capture skipped
triage and never fed the learning loop.

### 2. Triage — Buddy sorts it

A task with no `triaged_at` is in the capture inbox.

- **On capture:** `services/eagerTriage.ts` fires fire-and-forget. If the AI is
  configured, online, and **confident (≥ 0.8)**, the task is sorted immediately
  and marked `auto_triaged`.
- **Otherwise:** it waits for `hooks/useTaskTriage.ts`, which batches the inbox,
  auto-applies the confident ones, and hands the rest to you one at a time.

Both paths build the final task with `services/applyTriage.ts::applyTriagePatch`,
so an AI-routed task and a hand-routed one come out byte-identical.

### 3. Write — the flag becomes fields

```
routeTaskPatch(destination, detail)   utils/triageRouting.ts   → which flag + its routing fields
        ↓
applyTaskFlag(task, flag)             utils/taskFlags.ts       → the full field contract for that flag
        ↓
insertTask / persistTaskUpdate        services/taskWrites.ts   → columns, reminders, Google mirror
```

`applyFlagContract` resolves the flag (explicit wins, otherwise
`deriveTaskFlag`) and applies its contract, so a task's stored fields can never
contradict its flag.

### 4. Surface — score, sort, show

- `utils/taskRecommender.ts` — `scoreTask` / `getRankedTasks` answer *"what
  should I do right now?"* (overdue, urgency, staleness, backlog age, energy and
  context fit).
- `utils/taskOrdering.ts` — `sortTasksCanonical` is the one display order:
  score → planned day → flag → due date → created → id.
- `utils/taskBoard.ts` — `buildTaskBoard` shapes the Tasks screen (below).
- `features/day/utils/morningPick.ts` — `rankMorningCandidates` answers *"which
  few things should today get?"*, used by the check-in gate.

---

## The seven flags

`flag` is the single classification. Every stored row has one — `todos.flag` is
`NOT NULL` with a CHECK.

| Flag | What it means | What `applyTaskFlag` writes |
| --- | --- | --- |
| `urgent` | Plan now, with smart reminders | `priority: urgent`, reminders on + smart cadence, a planned day chosen against today's capacity |
| `today` | On today's plan | `plannedFor` = today (or the day you picked) |
| `deadline` | A real due date to track | **requires `dueDate`**; suggests a workday to start, reminders on + smart |
| `waiting` | Parked until someone responds | **requires `waitingOn`**; chase date defaults to +3 days, one reminder |
| `school` | Linked to your classes | reminders on when it has a due date |
| `routine` | Repeats on a cadence | **requires `recurrence`** (defaults to daily on manual confirm), reminders on |
| `someday` | No scheduling pressure | clears the planned day and every reminder |

Presentation — label, plural, emoji, colour, description, and what input the
flag needs — lives in **one** place: `TASK_FLAG_META` in `utils/taskFlags.ts`.
Display order and the sort tie-break both come from `TASK_FLAG_ORDER`.

> Until August 2026 the same seven concepts were modelled three times (`flag`,
> `kind`, `triage_destination`) with three meta tables and three inconsistent
> orderings — `waiting` sat at position 2, 4 and 6 depending on which file you
> were in — and two derivation ladders that disagreed about whether a task due
> tomorrow was "Today" or "Deadline". If you find yourself adding a second table
> of flag labels, that is the mistake repeating.

### Flag vs priority

The **flag** decides urgency. `priority` only grades high/medium/low *within* a
flag. `scoreTask` reads the flag, so a stale `priority: 'urgent'` on a parked
task cannot jump the queue.

---

## The write paths

Two functions, both in `services/taskWrites.ts`:

- **`insertTask(userId, task)`** / `insertTasks` for batches — new rows.
- **`persistTaskUpdate(userId, task)`** — existing rows.

Both do the same three things: apply the flag contract, write columns through
the `todoToDb` converter, then sync reminders and mirror to Google Calendar.
Reminder and calendar failures are non-fatal; a DB error throws.

**Do not hand-write `todos` columns.** The only exceptions are narrow
single-column updates in `useTasks` (completion toggle, `started_at`), which
touch nothing the flag contract owns.

This matters more than it looks. Before the paths were unified, completing a
recurring task inserted the next occurrence with a raw converter call that never
scheduled a reminder — so every occurrence after the first was silent, forever.

---

## The learning loop

1. The AI proposes a destination with a confidence and a one-line reason.
2. **≥ 0.8** applies silently and marks the task `auto_triaged`. Below that, you
   decide.
3. Auto-sorted tasks surface as *"Buddy sorted N today — tap to fix"* on both
   the Tasks and Capture screens (`useAutoSortReview`). Confidence is shown in
   plain language — "fairly sure", "pretty sure", "sure" — so a shaky call
   invites a correction instead of hiding.
4. Correcting one opens `CorrectionSheet`: pick the right flag, then optionally
   say **why** — seven one-tap reason chips plus a free-text note.
5. The correction appends a line to the `triage_learnings` doc in `settings`:

   ```
   - 2026-08-17: "Call the dentist" → deadline (you changed it from today;
     because: not urgent) [you had auto-applied this confidently — be more careful]
   ```

6. That doc (capped at the 40 most recent lines) is fed back into the next
   triage prompt as worked examples.

Reason chips rather than free text alone: they are one tap on a phone, and the
doc goes into the prompt verbatim — ten different phrasings of "not urgent"
teach less than one phrasing repeated ten times.

---

## The surfaces

| Screen | Question it answers | Key files |
| --- | --- | --- |
| **Now** | What am I doing right now? | `features/cove/now/NowPage` |
| **Tasks** | What needs me, and what else exists? | `features/cove/tasks/CoveTasksPage` |
| **Capture** | Get it out of my head | `features/cove/capture/CoveCapturePage` |
| **Check-in gate** | What should today get? | `features/cove/gate/` + `day/utils/morningPick` |
| **Close day** | What do I do with what is left? | `features/cove/closeday/CloseDayOverlay` |
| **Me → Tasks** | Defaults, task types, routines | `components/TaskSettingsModal` |

### The Tasks screen is two tiers

```
┌─────────────────────────────────┐
│ 2 to sort — one at a time    ▸  │  TriageCard: 3 quick taps, 4 more behind "More options"
│ ✨ Buddy sorted 3 today       ▸  │  tap any row to correct it
├─────────────────────────────────┤
│ NEEDS YOU NOW                   │  buildTaskBoard().now — capped at 5
│ ○ Hand in essay      🔥 overdue │
│ ○ Call dentist       📅 today   │
├─────────────────────────────────┤
│ ▸ Deadlines (4)                 │  buildTaskBoard().sections
│ ▸ School (5)                    │  counts always visible, contents folded
│ ▸ Someday (27)                  │
└─────────────────────────────────┘
```

`buildTaskBoard` guarantees:

- **Now** = urgent/today-flagged, plus anything overdue or due today whatever its
  flag — so a school deadline that slips surfaces instead of staying politely
  folded under School.
- **Parked** tasks (waiting before its chase date, deadline before its start)
  never enter Now, but still appear in their section. Nothing vanishes.
- Capped at 5; the rest go to `nowOverflow` behind "+N more" rather than being
  dropped.
- Every active task appears **exactly once** across now / overflow / sections.
- Empty sections keep their header — a count of `(0)` is information.

Tapping the circle completes a task; tapping the rest of the row opens
`TaskDetailSheet`, which edits every field a task has.

---

## Deferred by design

Three features are wanted but not designed yet. Their columns are kept, and two
components are deliberately preserved even though nothing renders them (they are
allowlisted in `scripts/check-reachability.mjs` — **if you remove this section,
remove those entries too**):

| Feature | Columns | Component held | What it needs |
| --- | --- | --- | --- |
| Subtasks | `subtasks` | `components/AITaskSplitter.tsx` | A place to show and tick subtasks — probably inside `TaskDetailSheet`. `staleness.ts` already reads subtask progress and the recommender surfaces "next subtask". |
| Deadline start dates | `start_date` | — | Nothing writes it. `isDeadlineParked` / `isDeadlineStartSlipped` already read it, so this is a UI gap, not a logic one. |
| Google Calendar | `google_event_id`, `google_calendar_id`, `google_synced_at`, plus `parent_todo_id` / `notes` | `components/UrgentScheduleModal.tsx` | The push currently fires only for `flag: urgent` + a planned day + a `dueTime` — narrow enough that it has never fired. Decide which tasks belong on the calendar, then rebuild the scheduling flow. |

---

## Gotchas

- **Due-date parsing** goes through `utils/dueDates.ts`. `parseDueDate` anchors
  plain dates at local noon; `new Date('YYYY-MM-DD')` parses as UTC midnight and
  shifts the calendar day. Never use it on a due date.
- **`plannedFor` vs `dueDate`** are different things. `plannedFor` is the day you
  intend to do it; `dueDate` is a real external deadline. Most surfaces sort on
  `plannedFor`.
- **Completed tasks older than 30 days** are filtered out of the `useTasks` query.
  The rows stay in the database — nothing is deleted.
- **`useTasks` is a hook, `taskWrites` is not.** Fire-and-forget services
  (eager triage) call `taskWrites` directly; React calls `useTasks`.
- **Adding a flag** means updating `TaskFlag`, `TASK_FLAG_META`,
  `TASK_FLAG_ORDER`, the `applyTaskFlag` switch, the `todos_flag_check`
  constraint, and the triage prompt in
  `supabase/functions/assistant/tools/task-ai.tool.ts::handleTriage`.

## Tests

`npx vitest run src/features/tasks` — the pure logic (flags, board, ordering,
recommender, parser, triage routing, staleness, contracts, learnings) is fully
covered. Start there when changing behaviour: every rule above has a test.
