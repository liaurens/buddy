# Notifications

Every nudge the app sends, and every tap that comes back. Diagrams:
[diagrams/notifications.md](diagrams/notifications.md).

## Purpose

Two jobs, and they pull in opposite directions:

1. **Reach the user when the app is closed** — a reminder that only fires while
   you are looking at the app is not a reminder.
2. **Never be noise.** A nudge that is hours late, that arrives at 02:00, or
   whose button does nothing is worse than silence, because it teaches the user
   to dismiss without reading. Most of the rules below exist to protect this.

## Data model

One table does the work: **`scheduled_notifications`**.

| Column | Meaning |
| --- | --- |
| `tool_category` | Which subsystem asked (`routine_morning/midday/night`, `off_track`, `task`, …). Used for bulk cancel. |
| `notification_type` | The kind of nudge. `routine_reminder` is special — see quiet hours. |
| `scheduled_for` | When it should fire. Deferrals rewrite this. |
| `status` | `pending` → `sent` / `expired` / `cancelled`. |
| `source_type` / `source_id` | Back-link to the originating record — `('task', todoId)` is what makes the action buttons possible. |
| `dedup_key` | `UNIQUE(user_id, dedup_key)` partial index; the off-track scanner leans on it entirely. |
| `data` | JSON payload: `route`, `step`, `intent`, `taskId`, `daysOfWeek`. This is the deep link. |

Supporting tables: `notification_subscriptions` (push endpoints, one per
device) and `notification_logs` (delivery log).

## Key files

| Layer | File |
| --- | --- |
| Row writers (generic) | `src/services/notifications/scheduler.service.ts` — `scheduleTaskReminders`, `computeTaskReminderFireTimes`, `cancelTaskReminders`, `snoozeTaskReminder`, `scheduleDailyNotification` |
| Task reminders | `src/features/tasks/services/taskWrites.ts` → `syncTaskReminders` (called by every write and delete path) |
| Daily anchors | `src/features/notifications/services/notifications-schedule.service.ts` — `reapplyNotificationSchedule`, `ensureAnchorSchedule` |
| Delivery | `supabase/functions/schedule-notifications/` (flush) → `supabase/functions/send-notification/` (Web Push) |
| Proactive nudges | `supabase/functions/off-track-scanner/` |
| Device side | `public/sw.js` — renders the notification, attaches action buttons, builds the deep-link URL |
| Deep-link parsing | `src/utils/navIntent.ts` — `parseNavIntent`, the single reader of `?intent/taskId/step` |
| Deep-link execution | `src/components/notifications/NotificationIntentHandler.tsx` (headless) |

## Flow

**Scheduling.** A task write goes through `insertTask` / `persistTaskUpdate`,
which calls `syncTaskReminders`. That resolves the fire moment from the task's
flag (`deadline` reminds off `dueDate`, everything else off `plannedFor`), picks
the cadence (per-task, else the user's default), and writes pending rows. A
completed, un-reminded or undated task gets its rows cancelled instead — so
there is no path where a reminder outlives its reason.

**Delivery.** A pg_cron job hits `schedule-notifications` every minute with a
`Bearer sb_publishable_…` header. It reads due pending rows and either expires,
defers, or delivers them; delivery goes on to `send-notification`, which pushes
to each subscription and prunes dead ones.

**Acting on it.** `sw.js` renders the notification. For any row with
`data.sourceType === 'task'` it auto-attaches **Mark done** and **Snooze 15m**,
and turns a tap into `/?route=tasks&intent=complete|snooze&taskId=…`. On open,
`parseNavIntent` reads those params and `NotificationIntentHandler` executes
them — completing through the full `toggleTask` pipeline (assignment mirror,
recurrence spawn, reminder cancel) or scheduling exactly one fresh nudge — then
toasts a receipt and clears the params.

**Anchors.** Morning / midday / night are `routine_reminder` rows written from
the user's settings. Their payloads are composed **client-side**, so changing
anchor copy or routing needs no edge deploy; `ensureAnchorSchedule` re-applies
them at most once per 12 hours on app open, which is what makes a single missed
day self-heal.

## Gotchas

- **`sw.js` only runs in production builds** (dev unregisters it). Test deep
  links in dev by opening `/?route=tasks&intent=complete&taskId=<id>` directly.
- **Anchor payloads self-heal — don't redeploy for them.** The 12-hour throttle
  is `notifications.anchorsAppliedAt` in localStorage; delete it, or save the
  Notifications settings once, to force an immediate re-apply while testing.
- **Routine anchors ignore quiet hours on purpose.** Without that, a night
  anchor at 22:00 against a quiet-hours start of 22:00 is suppressed every
  single night.
- **Staleness beats delivery.** Anything more than `MAX_STALENESS_MINUTES`
  (120) past its `scheduled_for` is expired, not sent, so an outage cannot
  flood the user on recovery. Deferred rows get a fresh `scheduled_for`, so a
  quiet-hours hold is never counted as stale. Expired anchors still call
  `rescheduleRoutineForTomorrow`.
- **`verify_jwt` is the usual cause of silent death.** `supabase/config.toml`
  pins it per function and `supabase functions deploy` defaults to `true` for
  anything not declared there — that default killed push for six weeks. When a
  cron-invoked function looks dead, read `net._http_response`: it stores the
  gateway's reply, which pg_cron itself ignores (`cron.job_run_details` reports
  `succeeded` for a 401, because the POST went out fine).
- **The Supabase CLI has no `functions logs` subcommand.** To confirm a
  redeployed function still boots without triggering its side effects, send it
  an `OPTIONS` request — module-level code runs on boot, so a boot crash 500s
  before the CORS branch can answer.
- **The off-track scanner classifies by flag, not priority.** "The flag decides
  urgency" is a whole-project invariant and it applies server-side too; the
  scanner used to filter `priority IN ('urgent','high')`, which silently
  excluded overdue `deadline` and `school` tasks — the two kinds that reliably
  *have* a due date. `waiting` / `routine` / `someday` stay out deliberately.
- **Deletes must go through `deleteTaskFully`.** A raw `.delete()` on `todos`
  leaves its pending rows behind to fire at a task that no longer exists.
- **`send-notification` deletes a subscription on 404, 410 and on 400
  `VapidPkHashMismatch`** — the last means the subscription was created against
  a rotated VAPID key and can never be delivered to; the device re-subscribes
  on its next app open.
- **Never put a badge or count on the nav** to reflect any of this. That is a
  hard Cove rule.
