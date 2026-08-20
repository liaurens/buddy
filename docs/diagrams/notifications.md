# Notifications — diagrams

Companion to [../notifications.md](../notifications.md).

## 1. The full lifecycle of one task reminder

From the write that creates it to the tap that acts on it. Everything below
`scheduled_notifications` is server-side and runs whether or not the app is open.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant App as App (React)
    participant TW as taskWrites.ts
    participant SS as scheduler.service.ts
    participant DB as scheduled_notifications
    participant Cron as pg_cron (1 min)
    participant Flush as edge: schedule-notifications
    participant Send as edge: send-notification
    participant SW as sw.js (prod only)
    participant IH as NotificationIntentHandler

    U->>App: save a task with a due date
    App->>TW: insertTask / persistTaskUpdate
    TW->>SS: syncTaskReminders(userId, task)
    Note over SS: cadence single / smart / aggressive<br/>→ computeTaskReminderFireTimes
    SS->>DB: insert pending rows (source_type 'task')

    loop every minute
        Cron->>Flush: POST + Bearer sb_publishable_…
        Flush->>DB: read pending, scheduled_for <= now
        alt more than 120 min late
            Flush->>DB: mark expired (a late nudge is noise)
        else quiet hours / rate limit
            Flush->>DB: defer with a fresh scheduled_for
            Note right of Flush: routine_reminder ignores quiet hours —<br/>the user picked those times
        else deliverable
            Flush->>Send: deliver payload
            Send-->>SW: Web Push
            Note right of Send: 404 / 410 / 400 VapidPkHashMismatch<br/>→ delete the subscription
        end
    end

    SW->>U: notification + "Mark done" / "Snooze 15m"
    U->>SW: taps an action
    SW->>App: open /?route=tasks&intent=complete&taskId=…
    App->>App: parseNavIntent(params)
    App->>IH: mount headless handler (outside the check-in gate)
    IH->>TW: toggleTask  ·  or snoozeTaskReminder
    IH->>U: toast receipt
```

## 2. Where reminder rows come from

Three independent producers write into the same table. Only the first is tied
to a user action.

```mermaid
flowchart TD
    subgraph Client
        A["task write<br/>insertTask · persistTaskUpdate"] --> S["syncTaskReminders"]
        B["Notifications settings saved<br/>or app open, ≤ once / 12 h"] --> R["ensureAnchorSchedule →<br/>reapplyNotificationSchedule"]
    end
    subgraph Server
        C["pg_cron, every 15 min"] --> O["edge: off-track-scanner"]
    end

    S --> T[("scheduled_notifications")]
    R --> T
    O --> T

    T --> F["edge: schedule-notifications<br/>(pg_cron, every minute)"]
    F --> P["edge: send-notification"]

    R -. "morning / midday / night anchors<br/>carry route + step + intent" .-> T
    O -. "overdue (by flag) · missed routine ·<br/>skipped check-in · idle" .-> T
```
