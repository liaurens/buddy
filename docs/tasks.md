# Tasks & the capture-triage pipeline

> **The canonical reference is [`src/features/tasks/README.md`](../src/features/tasks/README.md)** —
> it lives next to the code and is updated with it. This page is the map: what the
> feature is for, and where the pieces sit. Diagram: [diagrams/tasks-triage.md](diagrams/tasks-triage.md).

## Purpose

Phone capture is fast but dumps everything into one undifferentiated inbox. The
pipeline turns that inbox into tasks routed to the right place, and the daily
surfaces show only what today needs.

## The four stages

| Stage | What happens | Owner |
| --- | --- | --- |
| **Capture** | Free text → a draft (title, dates, type, energy, explicit `#flag`). Deterministic, no AI. | `utils/quickCaptureParser.ts` |
| **Triage** | Untriaged tasks get a flag. Confident (≥ 0.8) sorts apply silently; the rest ask you, one at a time. | `services/eagerTriage.ts`, `hooks/useTaskTriage.ts` |
| **Write** | The flag's field contract is applied, columns written, reminders scheduled, calendar mirrored. | `utils/taskFlags.ts`, `services/taskWrites.ts` |
| **Surface** | Score, sort, group. | `utils/taskRecommender.ts`, `utils/taskOrdering.ts`, `utils/taskBoard.ts` |

## The seven flags

`flag` is the single classification (`todos.flag`, NOT NULL):

`urgent` · `today` · `deadline` · `waiting` · `school` · `routine` · `someday`

Each one implies a complete field contract — what gets a planned day, what gets
reminders and at what cadence, what gets cleared. See `applyTaskFlag`.

> **August 2026 collapse.** The same seven concepts used to be modelled three
> times (`flag`, `kind`, `triage_destination`) with three metadata tables and
> three inconsistent display orders. `kind` and `triage_destination` were dropped
> in `20260816000001_collapse_task_vocabulary.sql`, along with `labels`,
> `project_id` and `historical_minutes` — columns that had never held a value.

## Surfaces

| Screen | Question it answers |
| --- | --- |
| **Now** | What am I doing right now? |
| **Tasks** | What needs me, and what else exists? (two tiers: a ranked "Needs you now", then a folded section per flag) |
| **Capture** | Get it out of my head |
| **Check-in gate** | What should today get? |
| **Close day** | What do I do with what is left? |
| **Me → Tasks** | Defaults, task types, routines |

## The learning loop

Auto-sorted tasks surface as "Buddy sorted N today — tap to fix" on both Tasks
and Capture. Correcting one asks *why*, via one-tap reason chips or a note, and
appends a line to the `triage_learnings` doc in `settings` — capped at 40 lines
and fed back into the next triage prompt as worked examples.

## Deferred by design

Subtasks, deadline start dates, and the Google Calendar write-through are wanted
but undesigned. Their columns are kept and two components
(`AITaskSplitter`, `UrgentScheduleModal`) are preserved unreachable and
allowlisted in `scripts/check-reachability.mjs`. See the README's
"Deferred by design" section for what each one still needs.
