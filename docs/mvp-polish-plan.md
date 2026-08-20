# MVP Final Polish — working plan & handoff

> **CLOSED 2026-08-20 — all eight phases shipped.** Kept as the record of what this
> pass set out to do and why. The durable outcomes live in
> [DESIGN.md](DESIGN.md) (Changelog + Planned), [notifications.md](notifications.md),
> [../src/features/tasks/README.md](../src/features/tasks/README.md) and `CLAUDE.md`;
> read those, not this, for current behaviour.
>
> The tasks-first polish pass: an incredibly low floor (2 minutes of use is helpful)
> plus depth for people who want more, and the silent trust-breaking bugs fixed.
> Original approved plan: `~/.claude/plans/the-project-is-nearing-async-chipmunk.md`.

**Scope decisions (user-set, binding):**
- IN: subtasks / AITaskSplitter revival, deadline start dates, UX polish + integrity fixes.
- OUT for now: **Google Calendar scheduling** — must still be *recorded* in `docs/DESIGN.md`
  as unfinished must-finish work (see Phase 8), with the OAuth-secret-rotation warning.
- OUT: focus-timer↔task linking (delete its dead code, record as deferred).
- OUT: the full lint-debt / E2E gate push (lint baseline ~134 errors stays).

**No DB migrations anywhere** — `todos.subtasks`, `todos.start_date`, `todos.notes` all exist.
**Exactly two edge-function redeploys**, both in Phase 7: `school-import`, `off-track-scanner`.

---

## Status

| Phase | State | Commit |
|---|---|---|
| 1 — Tasks-page picking floor | ✅ done | `51c8aba` |
| 2 — Now-page picking floor | ✅ done | `d504a2a` |
| 3 — Morning gate swap + flash + prefill | ✅ done | `729f9e1` |
| 4 — Notification intents, anchors, share | ✅ done | `c496127` |
| 5 — Capture & triage trust | ✅ done | `8965e7c` + `c9a0d29` |
| 6 — Subtasks + start dates | ✅ done | `59adcf5` |
| 7 — Integrity (school mirror, recurrence, scanner) | ✅ done | `2a03815` |
| 8 — Cleanup, docs, Google-Calendar record | ✅ done | `6a30f9b` |

Final state: **602 tests green**, `tsc -b` clean, `check:reach` clean at 254/254 with the
shorter allowlist, and both `school-import` and `off-track-scanner` redeployed and
boot-checked.

**Deviations worth knowing** (the plan below is the intent, not the record):
- Phase 4's gate `initialStep` wiring was skipped — the gate persists its own step, so
  `step=morning|midday` adds nothing beyond routing.
- Phase 8's plan claimed deleting `AssistantPromptBar` takes the last `consumeVoiceDraft`
  call site with it. It does not — `AssistantChat` still passes that prop, so
  `CaptureInput` keeps it.
- Phase 8 removed the whole Tasks "Default Sort Order" setting, not just its `label`
  option: nothing read any of it, so the control silently did nothing.

---

## What already landed (so you don't redo or undo it)

**Phase 1 (`51c8aba`)** — `useScheduleContext` extracted from `useTaskTriage` (queryKey
`['urgent-schedule-context', userId, today]` — keep identical, React Query dedupes across
consumers). `useTaskRecommendation` revived: home-days + free-block bonuses now actually
score; returns `byId`/`scoreById`. `NextUpCard` (hero of `board.now[0]` with the
recommender's reason line + next subtask). `rowMeta.ts` (`formatRowMeta`, tested): rows show
"overdue 3d" (amber `#a87a2e`) / "due Fri" / estimate. TaskDetailSheet: Today / Tomorrow /
Next week / Clear quick chips for `plannedFor`; **the draft-sync `useEffect` was removed —
the sheet is now keyed `key={editing.id}` by its caller** (that's the mid-edit-wipe fix; any
new call site MUST pass `key={task.id}` or drafts reset on every open of a different task…
and without the key the sheet won't reseed at all). Empty flag sections collapse to one line
when all are empty.

**Phase 2 (`d504a2a`)** — `PickSheet` on Now ("Pick something small", top-6 from
`rankMorningCandidates` + `suggestMorningPicks`, reasons shown; tap → `rescheduleMany([id],
today)`; picked rows self-remove because candidates exclude `plannedFor === today`). Empty
state and a "+ add a pick" row (shown when <3 picks, not survival) open it. "Today's three"
→ "Today's picks" when list exceeds 3. Whale greets by a safe email-derived first name
(`displayNameFromEmail` in `whaleCopy.ts`, tested — falls back to nameless for long/odd
handles). PickCard shows "next: {subtask}". `useTodayItems(dateKey, { events: false })` —
Now and the gate opt out of the calendar query they never used. Midday card engagement now
calls `markRoutineDone('midday')`. MoreFold shows "skipped today" for a skipped check-in
(read from `useCheckinStatus`; routine-progress has NO skipped state — don't fake one).

**Phase 3 (`729f9e1`)** — Gate picks are editable: suggested picks get "swap" (id →
`rejectedIds` set, session-state only, ranking backfills), planned picks get "not today"
(clears `plannedFor` AND rejects the id so it isn't instantly re-suggested). Suggestion
reasons shown as subtitles. Gate flash on fresh devices fixed in `App.tsx`: `checkinUnknown`
(no localStorage mirror + query loading) renders `PageFallback`, never the gate.
Mood/energy prefill from yesterday via new `fetchMoodEnergy` (moodEnergy.service) +
previously-dead `scaleToMood`/`scaleToEnergy`; local tap overrides, no silent writes.
`types.ts`: `updateTask` is now declared `Promise<void>`.

**Phase 4 (`c496127`)** — `parseNavIntent` (`src/utils/navIntent.ts`, tested) is the one
reader of `?intent/taskId/step`. `NotificationIntentHandler` (headless, mounted next to
`InAppReminderBanner`, i.e. works even while the gate holds the app): `complete` →
`toggleTask` full pipeline + toast; `snooze` → new `snoozeTaskReminder` in
`scheduler.service.ts` (cancels pending escalations, schedules ONE nudge, keeps
`sourceType: 'task'` so sw.js re-attaches the buttons). Night anchor payload is now
`{ route:'home', step:'night', intent:'closeday' }` → NowPage (new `initialParams` prop)
opens `CloseDayOverlay` on mount. sw.js forwards `data.intent`. `initialNavigation` keeps
intent-without-taskId (closeday was being dropped) and handles Web Share Target itself —
shared text seeds the draft AND lands on Capture. Browse tile copy: "Pomodoro focus timer".
`toggleTask` declared `Promise<void>`. **Deviation from plan:** gate `initialStep` was NOT
wired — the gate persists its own step and all three chips are always tappable, so
`step=morning|midday` adds nothing beyond routing (documented no-op).

**Phase 5, part 1 (`8965e7c`)** — TriageCard: "Not now →" skip (only when ≥2 items;
`rotateQueue` in `utils/inbox.ts`, pure + tested, client-side only — skipping writes
nothing). `mergeProfileDetail` (`triageConfidence.ts`, tested): a tap that disagrees with
the AI keeps its destination-independent profile (estimate/energy/type/context/location/
hardness) and drops only destination-specific fields. Undo finally reachable:
`toast.success(msg, duration?, { label, onClick })` (Toast now supports one action button;
keep `ToastAction` **un-exported** — exporting it trips `react-refresh/only-export-components`),
sort toasts carry Undo, and the "✨ Buddy sorted N" fold has "↩ Undo the last sort" while
`canUndo`. `ready === false` → "Buddy's AI is off — sort by hand" line on the card.
`someday`'s "Later" label moved to `TASK_FLAG_META.shortLabel`.

---

## Remaining work

### Phase 5, part 2 — Capture page (small, ~30 min)

All in `src/features/cove/capture/CoveCapturePage.tsx` (currently back at its committed
state — a partial edit was reverted when this handoff was written):

1. **Success toast.** `const toast = useToast()` (`components/ui/Toast`); after the
   `addTaskFull` in `submit()` succeeds: `toast.success('Got it — Buddy will sort it.')`.
2. **"Capture anyway".** Parser errors currently hard-block the save (`#deadline` with no
   date is a dead end; only `errors[0]` shows). Keep the inline error, add a secondary
   button next to it that saves the raw text untriaged:
   `await addTaskFull({ title: text.trim(), priority: 'medium' })` — no flag, no
   `triagedAt`, so the AI sorts it. Then clear text/error + same toast. No parser changes.
3. **Tappable "Captured today" rows.** The rows are inert `<div>`s; make each open
   `TaskDetailSheet`: `editingId` state, derive `editing` from the live `tasks` array
   (same pattern as CoveTasksPage), render
   `<TaskDetailSheet key={editing.id} task={editing} onSave={updateTask + toast}
   onDelete={deleteTask + close + toast} onClose={…} />`. **The `key={editing.id}` is
   mandatory** (see Phase 1 note). Destructure `updateTask, deleteTask` from `useTasks`.

Verify: capture plain text → toast; capture `#deadline` bare → error + "Capture anyway"
works; tap a captured row → sheet opens, edit survives a background refetch, save toasts.
Commit as `feat(capture): never block, always confirm, tappable captures (phase 5, part 2)`.

### Phase 6 — Depth: subtasks (AITaskSplitter revival) + start dates

- `TaskDetailSheet.tsx` — the one full pass (this is its planned second-and-final touch):
  group the flat ~9-field form into `Fold` sections — **What** (title, flag) always open;
  **When** (do-on + chips, due, start-by); **Details** (type, estimate, energy, **notes
  textarea** — `Task.notes` is currently invisible data); **Reminders**; **Steps**
  (subtasks). Extract `SheetWhenSection.tsx` / `SheetStepsSection.tsx` if it overflows
  ~400 lines.
- **Steps section:** tickable subtask list writing through `draft.subtasks` immutably +
  inline "add a step" input. Pure helpers `toggleSubtask`/`addSubtask` in **new**
  `src/features/tasks/utils/subtasks.ts` + tests. Persistence rides Save →
  `persistTaskUpdate` (column + converter already round-trip `subtasks`).
- **"Split with Buddy ✨"** button renders `AITaskSplitter` inline; `onSplit` merges
  returned subtasks into the draft. **The AI path is verified working** —
  `AITaskSplitter.tsx:119` → `splitTask` (`ai-actions.service.ts`) →
  `invokeAssistantAction('planning', 'task.ai.split')` → assistant edge fn `handleSplit`.
  No edge deploy needed. BUT the component still violates Cove despite the 2026-08-17
  restyle: `font-medium` (banned), raw hex `hover:bg-[#3a8dc7]`, lucide icons — restyle to
  the sheet's `chipClass`/emoji conventions.
- **Reachability:** remove the `AITaskSplitter` allowlist entry in
  `scripts/check-reachability.mjs` (~line 48) once it's rendered — the script comment says
  these entries must go when the README's Deferred section changes. Update
  `src/features/tasks/README.md`'s "Deferred by design" table (splitter revived;
  `UrgentScheduleModal` stays deferred).
- **Split at the point of avoidance:** in `NextUpCard`, when `isStale(task, new Date())`
  (`utils/staleness.ts` — `snoozeCount`/`lastTouchedAt` are already stamped on every write,
  currently write-only data), render a "Feeling stuck? Split it →" chip that opens the sheet
  with the Steps fold open + splitter expanded (add a `focusSection` prop to the sheet).
  This is exactly the UX `staleness.ts:1-9` documents.
- **Start dates:** when flag is `deadline`, a "Start by" date input + one-tap suggested chip
  from `suggestedDeadlineStart` (`utils/taskContracts.ts:40-44` — implemented + tested,
  zero consumers). Writes `startDate`, the column nothing writes today.
- **Slipped-start signal:** extend `formatRowMeta` (`cove/tasks/rowMeta.ts`) with an
  `isDeadlineStartSlipped` case → text "start slipped", tone `'alert'` (amber — **Cove has
  no red**). Extend `rowMeta.test.ts`.

Verify: `check:reach` must pass with the allowlist entry REMOVED; snooze a task twice →
stuck chip appears → split → tick a subtask → NextUpCard's "next:" line advances.

### Phase 7 — Integrity: school mirror, recurrence, dead paths, off-track scanner

- `src/features/school/hooks/useAssignments.ts`:
  - `addAssignment` (~line 90): replace the raw `supabase.from('todos').insert(todoToDb(…))`
    with `insertTask(userId, buildAssignmentTodo(…))` from `services/taskWrites.ts` —
    mirrored school todos currently NEVER get reminder rows (school is the one category
    that reliably has a due date).
  - `updateAssignment`: raw todo updates → fetch-then-`persistTaskUpdate` (re-schedules
    reminders on un-complete). Also fixes the **banned** `new Date(patch.deadline)` UTC
    parse at ~line 135 (`format(new Date(...), 'yyyy-MM-dd')` shifts the calendar day —
    use `parseDueDate`).
  - `deleteAssignment` + the `deleteClass` cascade (`useClasses.ts:80-100`): new
    `deleteTaskFully(userId, taskId)` helper **in `taskWrites.ts`** (cancelTaskReminders +
    Google unsync + delete), reused by `useTasks.deleteTask` — deletes get one canonical
    path like writes. Today, deleting a class leaks orphaned `scheduled_notifications`.
- `supabase/functions/school-import/index.ts:404-427`: align the insert shape with the
  client converter's columns and port `suggestDeadlineWorkday`'s local-date `planned_for`
  (the function computes it in UTC → an imported assignment gets a *different* planned day
  than a typed-in one). Edge fns can't import `src/` — copy the ~15-line pure helper into
  `supabase/functions/_shared/` with a provenance comment. **Redeploy `school-import`**
  (`/deploy-fn`).
- `src/features/tasks/hooks/useTasks.ts`: **delete** `startTask` (~:238) and
  `completeTaskWithDuration` (~:257) — zero callers, and the latter skips every completion
  side-effect (assignment mirror, recurrence spawn, reminder cancel). Removing a dead broken
  path beats fixing it; the focus-link is recorded as Planned in Phase 8. Delete `deleteMany`
  (~:382) after a confirming grep. Also remove their entries from `TaskState` in `types.ts`.
- `src/features/tasks/utils/recurrence.ts` — **TDD: write `recurrence.test.ts` FIRST**
  (daily / weekdays / weekly-with-`recurrenceConfig.daysOfWeek` / monthly, month-end,
  DST-transition dates around late March + late October, undefined base). Then rewrite:
  `parseDueDate` in, `format(d, 'yyyy-MM-dd')` out — the current code does
  `new Date('YYYY-MM-DD')` + `.toISOString().split('T')[0]` round-trips, which violates the
  repo's headline date rule and is DST-fragile. It's the only untested util in the feature.
  Note the param is *named* `currentDueDate` but callers pass `plannedFor`.
- `supabase/functions/off-track-scanner/index.ts`: the overdue rule filters
  `priority IN ('urgent','high')` — pre-collapse vocabulary; **the invariant is "the flag
  decides urgency"**, so overdue `deadline`/`school` tasks are never scanned. Switch to
  flag-based rules. Drop the retired-`smart_notes` term from the idle heartbeat (that table
  gets 0 writes; it only inflates idle nudges). Change `route:'checkin'` (not a valid
  `AppRoute` — falls through to Now anyway) to `'home'`. **Redeploy `off-track-scanner`.**

Verify: `/db` spot-check — create an assignment → a `scheduled_notifications` row exists for
the mirrored todo; delete it → row gone. Check scanner logs after redeploy
(`verify_jwt = false` for it in `config.toml`; cron hits it every 15 min).

### Phase 8 — Cleanup, docs, and the Google Calendar deferral record

- Delete orphans (re-run `npm run check:reach` first — these 4 are the known set):
  `src/features/assistant/components/AssistantPromptBar.tsx` (+ its re-export in
  `assistant/index.ts`; takes `PendingSyncBadge.tsx` and the last `consumeVoiceDraft` call
  site with it), `health-tracking/components/tracker/CheckinModal.tsx` (**verified safe** —
  tree was clean, its last change landed in the Cove style pass), and
  `health-tracking/hooks/useDailyJournal.ts`.
- Delete `supabase/functions/quick-note/` — still on disk although the stability journal
  recorded deleting it.
- `assistant/constants.ts`: rename `CAPTURE_DRAFT_KEY` value `'captureFAB.voiceDraft'` →
  `'capture.sharedDraft'` (session-scoped; losing one in-flight draft across deploy is fine).
- Remove the `settings.defaultSortOrder = 'label'` option (nothing reads it).
- Leave unwired but record in DESIGN.md Planned: someday-review + routine-decision helpers
  (`taskContracts.ts` — implemented and tested, UI never designed); close-day UI
  consolidation (`CloseDayCard` inside ReflectionPage stays for now — Phase 4 already
  removed the night-anchor path into it).
- Docs: fix the two stale spots in `docs/cove.md` (the "full TodoPage behind '⋯ tools'"
  claim and the `day/` orphan note); update the tasks README Deferred table;
  `docs/DESIGN.md`:
  - Correct the two overstated "Done" bullets — after Phases 3/6 the morning-pick swap and
    the on-card split are true again; make the wording match what shipped.
  - **Planned bucket (required):**
    - **Google Calendar task scheduling — unfinished, must finish before MVP-complete.**
      Auth + write edge fns exist and are wired into every task write, but three gates keep
      it dormant: no `VITE_GOOGLE_OAUTH_CLIENT_ID` on Netlify, `GOOGLE_OAUTH_CLIENT_ID/
      SECRET` edge secrets never confirmed, and the push predicate (urgent + plannedFor +
      dueTime) has never once fired. **⚠ The Google OAuth client secret was shared in a
      chat once — rotate it in Google Cloud Console and update the edge secret before ANY
      production exposure.**
    - Focus-timer ↔ task linking (deliberately deferred; the dead `startTask`/
      `completeTaskWithDuration` paths were removed in Phase 7).
    - Energy/context ranking bonuses (need a "today's energy" signal — the gate records
      *yesterday's*).
- `/finish-part` — folds journal learnings into CLAUDE.md, updates DESIGN.md changelog,
  archives `.claude/progress/20260819-mvp-polish.md`.

Final verify: `check:reach` clean with the shorter allowlist; full `/check`; one manual
day-loop: capture (incl. `#deadline` bare → capture anyway) → triage (skip, undo, route
against the AI) → gate (swap a pick) → Now (add pick, complete, split a stuck task) →
`/?route=tasks&intent=complete&taskId=…` → close day.

---

## Tips & gotchas (learned or verified this session)

- **Hard rules recap:** Cove has no red (warnings = amber family, `#a87a2e` is the used
  tone), no gradients, no `font-medium`, no nav badges, no viewport breakpoints inside the
  520px shell; confetti only via `useCelebration`. Tasks: only two write paths
  (`insertTask`/`insertTasks`, `persistTaskUpdate`), triage builds via `applyTriagePatch`,
  presentation only in `TASK_FLAG_META`, all date math via `parseDueDate` — `new
  Date('YYYY-MM-DD')` is banned (the quality-guard hook flags it, including false-positives
  on test literals like `new Date('2026-02-25T12:00:00')`, which are fine).
- **TaskDetailSheet is keyed, not synced.** Its internal draft seeds once from `task` via
  `useState`; callers MUST render it with `key={task.id}`. Forgetting the key = the sheet
  shows a stale task when switching rows.
- **Toast actions:** `toast.success(message, duration?, { label, onClick })` — action
  defaults the duration to 6 s. Keep the `ToastAction` interface un-exported.
- **`updateTask` and `toggleTask` are `Promise<void>`** in `TaskState` now — old code that
  treated them as `void` still works (`void toggleTask(id)`), but you can `await`/`catch`.
- **`useScheduleContext`** must keep queryKey `['urgent-schedule-context', userId, today]`
  — `useTaskTriage` and `useTaskRecommendation` share the fetch through it. (Yes, `today`
  there is the UTC date slice — pre-existing behaviour, kept verbatim on extraction.)
- **Anchor payloads self-heal, don't redeploy.** They're composed client-side in
  `notifications-schedule.service.ts` and reapplied ≤12 h via `ensureAnchorSchedule`
  (throttle key `notifications.anchorsAppliedAt` in localStorage — delete it, or save the
  Notifications settings once, to force an immediate reapply while testing).
- **sw.js only runs in production builds** (dev unregisters it) — test notification deep
  links in dev by opening `/?route=tasks&intent=complete&taskId=<id>` directly.
- **Gate/day state lives in several places:** check-in status = server `daily_plans` +
  localStorage mirror `cove_checkin_<date>` (the `checkinUnknown` guard in App.tsx covers
  the no-mirror case); routine markers = localStorage `routine_done_<phase>_<date>`;
  midday dismissal = `cove_midday_dismissed_<date>`; gate step + intention = sessionStorage.
- **Swap state (`rejectedIds`) is deliberately session-only** — refreshing the gate forgets
  swaps; that's accepted (suggestions are deterministic, so the same picks return unless
  swapped again).
- **Pre-existing lint noise, don't chase it:** ~134-error baseline (never lint the whole
  repo — changed files only), plus two `react-hooks/set-state-in-effect` warnings in
  `MoreFold.tsx`/`useTodayItems.ts` that predate this part. The commit gate runs `tsc -b`;
  husky + lint-staged run prettier/eslint --fix on staged files (LF→CRLF warnings on commit
  are OneDrive/Windows noise).
- **`getRankedTasks` filters completed AND parked tasks itself** — no need to pre-filter.
  A pressing task always has a recommendation entry; `NextUpCard` falls back to a plain
  `TaskRow` if the lookup ever misses.
- **PickSheet self-updates** because `rankMorningCandidates` excludes `plannedFor === today`
  — after `rescheduleMany([id], today)` the picked row drops out on the next render. It also
  excludes routines, locked, and parked tasks by design.
- **`suggestMorningPicks`' school cap backfills** — with only school tasks left it still
  fills all slots (cap yields rather than starves); the swap-flow tests in
  `morningPick.test.ts` cover this.
- **Undo semantics:** `undoLastBatch` restores the snapshot AND adds the ids to
  `failedAutoApply`, so restored tasks re-enter the review inbox instead of being instantly
  re-auto-applied.
- **Deleted-code check:** after any component add/remove run `npm run check:reach` — the
  Stop hook runs it advisory, but Phase 6 *requires* it to pass with the splitter allowlist
  entry removed.
