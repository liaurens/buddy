# Tasks capture-triage — flow diagram

How a captured task moves from the inbox to its destination, through the single
write path shared by every routing route. See [../tasks.md](../tasks.md).

```mermaid
flowchart TD
  Capture["Capture task<br/>(QuickCapture / phone)"]
  ExplicitKind{"Explicit kind?"}
  Inbox["Inbox<br/>todos.triaged_at = NULL"]
  SkipInbox["Skip inbox<br/>stamp triaged_at +<br/>triage_destination (kindToDestination)"]

  Capture --> ExplicitKind
  ExplicitKind -->|yes| SkipInbox
  ExplicitKind -->|no| Inbox

  Eager{"Online + AI configured?"}
  Inbox --> Eager
  Eager -->|yes| AIInfer["eagerTriage → ai.triageTasks()<br/>infers destination + profile<br/>(hardness, energy, estimate, task type)"]
  Eager -->|no| Morning

  Conf{"High confidence?"}
  AIInfer --> Conf
  Conf -->|yes| Auto["Auto-apply route<br/>auto_triaged = true"]
  Conf -->|no| Morning["Morning 'Sort inbox' step<br/>/ TodoPage banner + TriageInbox"]

  Auto -->|write fails| Morning
  Auto --> Review["'I sorted these' review"]
  Review -->|confirm| WritePath
  Review -->|correct| Learn["clear auto_triaged<br/>append settings.triage_learnings"]
  Morning -->|accept / edit| WritePath
  Morning -->|edit a suggestion| Learn
  Learn --> WritePath

  WritePath["ONE write path<br/>applyTriagePatch (routeTaskPatch ∘ kindSignalPatch,<br/>profile fills gaps only)<br/>→ persistTaskUpdate (columns + reminders + Google)"]
  WritePath --> Routed

  Routed{"triage_destination"}
  Routed -->|urgent| Urgent["UrgentInboxCard → UrgentScheduleModal<br/>→ Google Calendar (not live in prod)"]
  Routed -->|today| Today["dueDate = today → day plan /<br/>morning pick / TodayFocusCard"]
  Routed -->|someday| Someday["kind=backlog → one-a-day card<br/>(ages upward in score over weeks)"]
  Routed -->|school| School["assignmentId set → derives kind 'school';<br/>loose school (no assignment)<br/>→ SchoolPlanningPicker"]
  Routed -->|routine| Routine["recurrence (default daily) → routine kind"]

  School -.->|mirror| Assignments["assignments table<br/>completion syncs both ways"]
  Learn -.->|sharpens next run| AIInfer
```

## Ordering & stuck signals (all list surfaces)

```mermaid
flowchart LR
  Score["getRankedTasks score<br/>priority (urgent=120) + due bumps<br/>+ stale +15 + backlog aging"]
  Sort["sortTasksCanonical<br/>score desc → dueDate asc → createdAt → id"]
  Views["Type / Schedule / Kind views<br/>morning pick (small-task bias)<br/>Next Up"]
  Stuck["snooze_count ≥ 2 or untouched ≥ 2d past due<br/>→ isStale → 'Split this?' chip"]

  Score --> Sort --> Views
  Stuck -.->|+15 resurfaces| Score
```
