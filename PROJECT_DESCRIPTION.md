# Student Buddy - Detailed Project Description

> A long-form product and technical research brief for Student Buddy.
> This document is meant to give a researcher, designer, engineer, or AI agent
> enough context to understand what the product is, why it exists, how users move
> through it, and how the major systems fit together.

---

## 1. Executive Summary

Student Buddy is a personal Progressive Web App (PWA) for executive function,
self-regulation, school/life organization, and personal insight. It is designed
for people who do not primarily need a more powerful todo list; they need a
calmer external structure that helps them capture what is on their mind, decide
what matters next, follow through during the day, and learn from what actually
happened.

The product combines:

- A daily "Now" surface for what matters next, including overdue tasks and
  school deadlines.
- A natural-language AI capture assistant with an offline-safe capture queue.
- A task and note system.
- Routines, checklists, reminders, and notifications, anchored by
  self-sustaining morning and evening push nudges.
- AI-assisted daily planning and reflection, with an explicit "close the day"
  end state.
- Health, mood, focus, protocol, and experiment tracking.
- A school module for classes, assignments, deadlines, schedules, and course PDF
  import.
- A growth hub for goals, skills, projects, XP, and progress.
- A toolbox for personal strategies and coping tactics.
- A Supabase backend with Row-Level Security, Edge Functions, and user-owned AI
  provider keys.
- Lightweight usage instrumentation (`app_events`) so product decisions can be
  based on observed behavior rather than guesses.

The central product loop is:

```text
capture -> organize -> plan -> act -> log -> reflect -> learn -> adapt
```

The app's product stance is that the user is capable and intelligent, but may
benefit from a system that reduces ambiguity, lowers activation energy, preserves
self-knowledge, and makes patterns visible. It should feel like a practical
executive-function scaffold, not a productivity scoreboard.

---

## 2. Product Philosophy

### 2.1 The Problem Space

Student Buddy lives at the intersection of productivity software, self-tracking,
AI assistance, and behavioral support. It is built around the observation that
many people with ADHD, executive-function challenges, mood variability, chronic
stress, or heavy cognitive load do not fail because they lack goals. They fail
because the bridge between intention and action is too fragile.

Common pain points:

- Tasks are captured in too many places and lose context.
- The user cannot easily tell what is urgent, what is important, and what can
  wait.
- Time estimates are unreliable.
- The day becomes reactive after one interruption.
- Routines work for a few days and then disappear.
- Useful discoveries about sleep, mood, focus, medication, caffeine, exercise,
  or workload are forgotten.
- Existing todo apps store obligations but do not help the user recover when the
  day goes sideways.
- AI assistants can be helpful, but generic chat alone does not become a trusted
  life system unless it can read and update the user's structured data.

Student Buddy tries to solve these problems with structure, memory, feedback,
and light automation.

### 2.2 The Design Principle

The app should reduce cognitive load at every step. It should make common
actions fast, obvious, and forgiving:

- Capture first, categorize later.
- Use natural language when the user is tired.
- Offer structured forms when accuracy matters.
- Prefer small next actions over large abstract goals.
- Use reminders and nudges carefully.
- Reflect patterns without moralizing.
- Preserve user agency; the app suggests, the user decides.

The tone should be concrete and nonjudgmental:

- Good: "Two high-effort tasks were skipped after class blocks. Try moving deep
  work earlier tomorrow."
- Bad: "You failed to complete your plan."

### 2.3 Target Users

Primary users:

- Students balancing classes, assignments, deadlines, routines, and personal
  care.
- People with ADHD or related executive-function difficulty.
- Knowledge workers who need a flexible personal operating system.
- People experimenting with sleep, medication timing, supplements, caffeine,
  exercise, mood, and focus.
- Users comfortable bringing their own OpenAI, Anthropic, or Google API key.

Secondary users:

- Researchers or clinicians interested in N-of-1 personal science workflows.
- Power users who want a unified task, tracking, reflection, and AI capture
  system.
- People who have outgrown lightweight habit trackers but do not want a heavy
  enterprise project management tool.

### 2.4 What Student Buddy Is Not

Student Buddy is not:

- A generic chatbot with a todo feature.
- A habit streak app optimized for shame or pressure.
- A medical device or diagnostic system.
- A school LMS replacement.
- A full team project manager.
- A passive analytics dashboard.

It is a personal scaffold for planning, self-observation, and follow-through.

---

## 3. Core User Model

Student Buddy assumes that the user has fluctuating capacity. A good day and a
bad day need different interfaces.

On a high-capacity day, the user may want:

- A full morning planning routine.
- A time-blocked calendar.
- Rich task metadata.
- Experiment analysis.
- Detailed reflection.

On a low-capacity day, the user may only be able to:

- Open the Now page.
- Dump a sentence into Capture.
- Pick the next small task.
- Run a light routine.
- Log mood or energy with one line.

The product therefore provides both structured and lightweight paths:

- Full routines and light routines.
- Dedicated pages and natural-language capture.
- Detailed trackers and quick check-ins.
- Manual task editing and AI task splitting.
- Calendar planning and simple "next up" views.

The goal is continuity. Even when the user cannot use the whole system, they can
still use a small part of it and keep the feedback loop alive.

---

## 4. The Product Loop

### 4.1 Capture

Capture is the first-class entry point. The user can capture:

- Tasks.
- Notes.
- Shopping items.
- Reminders.
- Health and mood check-ins (via trackers).
- School assignments.
- Goal progress.
- Questions for the assistant.

Capture happens through:

- The Assistant/Capture tab, built on a shared `CaptureInput` component with
  brain-dump mode, voice draft, route-preview ghost chips, and a
  backend-sourced command list.
- The floating capture button.
- Slash commands such as `/task`, `/note`, `/checkin`, `/remind`, `/done`,
  `/today`, and `/shop`.
- Dedicated UI forms inside feature pages.
- The OS share sheet: the PWA manifest declares a Web Share Target, so shared
  text/URLs land in the capture input (pre-filled, user confirms before
  submit).
- The iPhone Shortcut path, which routes through the assistant endpoint.

The assistant edge function accepts natural language and routes it to structured
tools. Dedicated UI flows can bypass language routing and invoke a tool directly
when the intent is already known.

Capture is offline-safe: submissions that fail at the network level are written
to an IndexedDB outbox (`src/services/offline/captureOutbox.ts`), replayed FIFO
on login and whenever connectivity returns, and surfaced through a "pending
sync" badge. The scope is deliberately capture-only, not general offline CRUD —
the goal is that no capture is ever lost, because one lost capture teaches the
brain not to trust the inbox.

### 4.2 Organize

Captured items are routed into the correct domain:

- Tasks go to the `todos` table.
- Notes go to `smart_notes`.
- Health logs go to `entries`.
- Tracker definitions go to `trackers`.
- School deadlines go to `assignments`.
- Class sessions go to `class_sessions`.
- Goals and projects go to their own improvement tables.
- Reminders become scheduled notification records.

The app tries to keep the user's working memory clear. Quick capture does not
require choosing every field up front, but richer fields are available later:
priority, estimate, due date, labels, project, recurrence, task type, reminder
cadence, class, checkpoints, and more.

### 4.3 Plan

Planning turns open obligations and current capacity into a realistic day.
Student Buddy supports:

- Calendar events.
- Daily plans.
- Time blocks.
- Morning and midday routines.
- Light and full routine modes.
- AI-generated schedules.
- Reflection-informed planning.

The planner should account for:

- Available hours.
- Mood and energy.
- Medication timing where relevant.
- Existing calendar commitments.
- Task priority and deadlines.
- Historical duration estimates.
- Whether the user needs an ambitious day or a minimum viable day.

### 4.4 Act

During the day, the app helps the user stay oriented through:

- The Now page.
- Next Up card (tasks, calendar, and school assignments merged).
- Today timeline.
- Reminders.
- In-app reminder banners.
- Web Push notifications, anchored by two daily time-based nudges: a morning
  "plan today" notification and an evening "close the day" notification, both
  deep-linking into the Day flow.
- Pomodoro focus sessions.
- Task completion and snoozing.
- Routines and checklists.

The anchor notifications are designed to be reliable: the
`schedule-notifications` function re-enqueues the next day's occurrence after
each fire (self-sustaining), and the client re-applies the schedule at most
once per 12 hours on app open (self-healing) so the trigger layer survives
server-side hiccups.

The app should make it easy to recover from drift. The ideal behavior is not
"never go off track"; it is "notice drift early and lower the cost of returning."

### 4.5 Log

The app collects both explicit and implicit data:

- Explicit: tracker entries, mood logs, reflections, task completions,
  focus sessions, experiment check-ins, protocol adherence.
- Implicit: assistant logs, routing methods, skipped time blocks, overdue tasks,
  reminder interactions, and app usage events.

Usage instrumentation lives in the `app_events` table: app opens (tagged with
their source — direct, notification, or share), route visits, capture
submissions, capture syncs, and day closes. Logging is fire-and-forget and must
never break the UX. This exists so "why isn't the app being used?" can be
answered with data — distinguishing "never opens the app" from "opens it,
finds nothing actionable, leaves" — and so module-freezing decisions can be
based on what is actually touched.

This data is used to improve planning, reveal patterns, and make the
assistant more useful.

### 4.6 Reflect

Reflection happens through:

- Night reflection.
- Planner reflection.
- Tracker check-ins.
- Insight cards.
- Experiment analysis.
- An explicit "Close day" step at the end of the night reflection.

Closing the day is the defined end state of the daily loop. One tap marks the
`daily_plans` row for the date as closed (`closed_at`), shows tomorrow's top
item, and feeds a low-pressure continuity indicator — days closed this week,
deliberately not a streak that punishes a miss. This gives the evening anchor
notification something to land on and gives the loop a visible reward.

The reflection layer is intended to answer questions like:

- What helped today?
- What got in the way?
- What should be repeated tomorrow?
- Which patterns are emerging over weeks?
- Which assumptions about focus, sleep, medication, caffeine, or workload are
  actually supported by personal data?

### 4.7 Learn and Adapt

The product learns in two ways:

1. User-facing learning: tracker analysis, experiments, protocols, routines, and
   planner history reveal personal patterns.
2. System-facing learning: assistant logs feed the HR Agent and Trainer Agent,
   which identify missed phrases, errors, and repeated AI-routed intents, then
   generate dynamic routing rules so future requests become cheaper and faster.

---

## 5. Information Architecture

### 5.1 Top-Level Navigation

The current app is organized around four top-level tabs:

- `Now`: the home surface for the current day.
- `Capture`: the assistant and natural-language input surface.
- `Browse`: the hub for all modules.
- `Me`: account, settings, preferences, and user-facing personal context.

This is intentionally simpler than exposing every feature as a permanent tab.
The app contains many modules, so the primary navigation prioritizes orientation
over completeness. Browse provides access to deeper areas.

### 5.2 Main Routes

The app supports these routes:

- `home`: Now page.
- `assistant`: Capture/chat assistant.
- `browse`: module browser.
- `me`: personal page.
- `account`: account/settings.
- `today`: daily routines and reflection.
- `tasks`: todo/task management.
- `notes`: smart notes.
- `checklists`: reusable checklists and routines.
- `toolbox`: personal strategy library.
- `focus`: Pomodoro focus timer.
- `calendar`: calendar and time blocks.
- `reflection`: planning/reflection page.
- `health`: tracker dashboard.
- `protocols`: supplement/medication protocol management.
- `experiments`: personal experiments.
- `growth`: growth hub for skills, goals, projects, XP.
- `goals`: growth hub opened to goals.
- `school`: classes, assignments, sessions, documents.
- `notifications`: notification and reminder management.

### 5.3 Now Page

The Now page is the calm operational center. It includes:

- Date and greeting.
- Daily routine card.
- Assistant prompt bar.
- Next Up card.
- Today card.
- Insight card.
- Recent captures.

Its job is to answer: "What should I pay attention to now?" It should avoid
being a dense dashboard. It is a steering surface.

A core requirement is that the Now page tells the truth. The first screen must
never under-report a deadline, or the user correctly learns the app cannot be
trusted and routes around it. Concretely:

- Next Up merges `todos`, calendar events, and school `assignments` — school
  deadlines (the highest-stakes daily content for a student) surface here, not
  only inside the School module.
- The Today card shows overdue tasks as the primary line when non-zero, plus
  due-today count, event count, and school assignments due within 7 days. The
  counting logic lives in a tested `summarizeToday` utility.

### 5.4 Browse Page

Browse is the app map. It exposes shortcuts and module lists:

- Routines.
- Calendar.
- Notes.
- School.
- Health.
- Tasks.
- Growth.
- AI Capture.
- Notifications.
- Settings.

Browse matters because the app is broad. A user should never need to remember
which hidden menu contains a feature.

---

## 6. Feature Modules

### 6.1 Assistant and Capture

The assistant is both an interaction surface and an orchestration layer. It can:

- Create tasks.
- Mark tasks done.
- List today's tasks.
- Create notes.
- Create shopping items.
- Search notes.
- Log health check-ins (including mood, via trackers).
- Create reminders.
- Query calendar/agenda.
- Manage checklists.
- Create and update goals.
- Log skill practice and manage strategies.
- Handle school-related requests.
- Answer general questions when no structured action applies.

The tool surface was deliberately pruned in June 2026: habits, mood, journal,
study, projects, task-routines, task-types, and context tools were removed
(they live in git history). Every registered tool's schema is sent to the model
on each AI-routed request, so a lean registry is cheaper and routes more
accurately.

The assistant supports explicit slash commands and natural language. It should
be forgiving when the user uses short, messy, or tired-language inputs.

Examples:

```text
/task Finish statistics worksheet by Friday estimate 45m
/done email professor
/checkin mood 4 energy 3 focus 2
/remind 14:00 call dentist
/shop oat milk, bananas, toothpaste
Log 90 minutes of calculus study
I feel awful and only have two hours today
```

### 6.2 Tasks

Tasks are the core obligation container. A task can include:

- Title.
- Due date.
- Priority.
- Estimated time.
- Status.
- Subtasks.
- Labels.
- Location/context.
- Project.
- Task type.
- Recurrence.
- Reminder settings.

The tasks feature supports:

- Quick capture.
- Task filtering.
- Task recommendation.
- Recurring tasks.
- Task type organization.
- Bulk actions.
- Snoozing.
- AI task splitting.
- Deep links from notifications.

(The habit dashboard, streak calendar, and streak calculator were removed in
the June 2026 prune — streak mechanics conflicted with the product guardrail
against shame-based motivation and were not used.)

Implementation detail: tasks are stored in the `todos` table, not a `tasks`
table. This naming detail matters for future agents and database work.

### 6.3 Notes

Notes are for low-friction capture of thoughts, shopping items, ideas, and
general content. They support:

- Smart categories.
- Quick note input.
- Category management.
- Search/find behavior.
- Flag-based routing such as shopping capture.
- Integration with the assistant.

Notes are stored in `smart_notes`, with categories in `note_categories`.
Journal-like content can also use this infrastructure through category and tool
semantics.

### 6.4 Daily Routines

The Day page supports morning, midday, and night flows. It has two intensity
modes:

- Full routine: more complete, useful when the user has capacity.
- Light day: faster, useful when the user is overwhelmed or short on time.

Morning and midday have dedicated full/light components. Night routes into
reflection. The selected routine mode is persisted locally so the user can keep a
preferred default.

Routines are not just checklists. They are transition aids. Their job is to help
the user move from ambiguity into action at predictable points in the day.

### 6.5 Checklists

Checklists provide reusable procedure memory. They are useful for:

- Morning routines.
- Evening shutdown.
- Weekly review.
- Packing lists.
- Cleaning sequences.
- Study setup.
- Medication or supplement prep.
- Repeated admin workflows.

The app treats checklists as reusable scaffolds, not one-time tasks. They are
especially important for users who perform better when a familiar external
sequence is available.

### 6.6 Planning and Calendar

The planning module includes:

- Calendar events.
- Calendar sync.
- Daily plans.
- Time blocks.
- Reflection history.
- Mood/energy history.
- AI planning service.
- Reflection capture.

Planning is the main place where structured obligations, personal state, and
time meet. The intended behavior is not just scheduling every minute. It is
creating a realistic container for the day, with enough detail to reduce
ambiguity and enough flexibility to survive interruptions.

Time blocks can represent planned work, routines, breaks, school sessions, and
other commitments. Reflection closes the loop so future plans can become more
realistic.

### 6.7 Focus

The focus feature is a configurable Pomodoro-style timer. It supports:

- Work/break cycles.
- Focus session structure.
- Settings modal.
- Potential integration with tracker data and planner blocks.

Its purpose is activation and containment. It gives the user a small contract:
"work on this for one bounded interval."

### 6.8 Health Tracking

Health tracking is the quantified-self layer. Users can define trackers for:

- Sleep.
- Mood.
- Energy.
- Focus.
- Caffeine.
- Exercise.
- Medication.
- Supplements.
- Symptoms.
- Anything else that matters personally.

Trackers support different data types and cadences:

- Number.
- Rating/scale.
- Boolean.
- Text.
- Daily.
- Weekly.
- Episodic.

Entries are stored in the `entries` table. Tracker definitions are stored in
`trackers`. This naming detail matters: tracker check-ins are not stored in a
`tracker_entries` table.

The analysis layer can surface:

- Trends.
- Segment comparisons.
- Basic statistical summaries.
- Relationships between inputs and outcomes.

(The server-side correlations agent and the top-correlations card were removed
in the June 2026 prune; correlation-style insight now flows through experiments
and the insight card rather than a standing dashboard.)

The product philosophy is N-of-1 personal science. The app does not claim that a
correlation proves causation. Instead, it gives the user better questions and
more structured evidence.

### 6.9 Protocols

Protocols codify repeated supplement, medication, or habit regimens. They can
represent:

- Dose.
- Timing.
- Cycle.
- Expected effect.
- Linked trackers.
- On/off phases.

Protocols help answer questions like:

- Did I follow the regimen?
- What changed while I was on it?
- What should I track to know whether it helps?

### 6.10 Experiments

Experiments let the user test personal hypotheses. A user might ask:

- Does caffeine improve my focus or just increase anxiety?
- Do morning walks improve mood?
- Does sleep duration predict afternoon energy?
- Does a supplement correlate with better focus?

The experiments module supports:

- Experiment creation.
- Metric selection.
- Phase timelines.
- Check-ins.
- Details and analysis.
- An experiment agent for AI-assisted setup or interpretation.

This module should encourage careful thinking. It should help the user define
what they are testing and what evidence would count as useful.

### 6.11 School

The school module supports students directly. It includes:

- Classes.
- Instructors.
- Terms.
- Class colors.
- Archived classes.
- Assignments.
- Assignment deadlines.
- Assignment status: pending, in progress, submitted, graded.
- Estimated minutes.
- Assignment checkpoints.
- Weekly class sessions.
- Session locations.
- Deadline list.
- Class list.
- Weekly schedule grid.
- Checkpoint panel.
- Course document uploads.

Course documents are PDF files uploaded to Supabase Storage. The app can analyze
uploaded course PDFs through the `school-import` Edge Function. The AI import
flow can extract:

- A course summary.
- Assignments.
- Deadlines.
- Estimated minutes where available.
- Checkpoints.
- Weekly sessions.
- Locations.

The user sees a preview before committing the import. This matters because course
documents can be ambiguous and the AI should not silently write questionable
data. The import flow is structured as:

```text
upload PDF -> analyze -> preview extracted data -> optionally revise/reanalyze -> commit
```

The `school-import` function authenticates the request, verifies class access,
downloads selected PDFs from storage, calls the configured AI provider with
document input, normalizes the structured payload, stores extracted summaries,
and commits selected assignments/sessions for the authenticated user.

### 6.12 Growth Hub

The growth hub adds a progress and motivation layer. It includes:

- Skills.
- Projects.
- Goals.
- XP.
- Levels.
- Titles.
- Manual activity logging.
- Goal progress.

The goal is to make long-term development visible. This is especially useful
when progress is real but delayed, fragmented, or hard to perceive day to day.

The growth hub is not meant to replace planning. It answers a different
question: "What am I becoming better at over time?"

### 6.13 Goals and Projects

Goals represent desired outcomes or directions. Projects group work and can link
to tasks. The assistant has tools for:

- Creating goals.
- Listing goals.
- Updating progress.
- Marking goals done.

Projects remain in the database and UI (tasks can link to a project), but the
assistant's dedicated projects tool was removed in the June 2026 prune.

These features connect daily tasks to longer-running intentions.

### 6.14 Toolbox

The toolbox is a personal strategy library. It is not meant to be a generic tips
page. It should grow from the user's actual life:

- "Take a 5-minute walk before starting a writing task."
- "Use Pomodoro when stuck."
- "Open the document and write one bad sentence."
- "Make lunch before the 13:00 energy dip."
- "When mood is under 4, use light routine only."

The assistant can eventually surface relevant strategies when the user appears
stuck or repeatedly skips a certain kind of task.

### 6.15 Notifications and Reminders

The notification system includes:

- Notification permission prompt.
- In-app reminder banner.
- Scheduled notifications.
- Daily anchor notifications: morning ("plan today", with live due/overdue
  counts filled in at send time) and evening ("close the day — 90 seconds").
- Self-sustaining routine reminders: after a routine reminder fires, the
  `schedule-notifications` function enqueues the next day's occurrence, with
  guards against duplicates and against backlogged rows producing already-due
  sends.
- Client-side self-healing: the app re-applies the anchor schedule at most
  once per 12 hours on open, so the nudges survive a broken server-side chain.
- Per-task reminders.
- Notification management page.
- A push subscription health card, so a silently dead subscription (an iOS
  Web Push failure mode) is visible instead of invisible.
- Web Push service worker support.
- Deep links back into the app.
- Quiet hours and rate-limiting behavior in the off-track scanner path.

Notifications are meant to be useful, not noisy. They should help the user
return to intention, especially when time blindness or context switching has
pulled them away. The anchor notifications are treated as the trigger layer of
the entire product: without a reliable external prompt to open the app, every
downstream feature is dead infrastructure.

### 6.16 Account and Settings

Settings include:

- Supabase-authenticated account state.
- AI provider selection.
- User-owned API keys.
- Model preferences.
- Notification preferences.
- Export/import flows.
- App preferences.
- Feature settings modals registered from the app shell.

The app expects the user to supply their own AI keys. This keeps cost and
provider choice under user control.

---

## 7. AI Assistant Architecture

### 7.1 Overview

The assistant is implemented as a Supabase Edge Function. It is not a thin
single-prompt chatbot. It is a hierarchical, cost-aware routing system with
structured tools, domain managers, logging, and a self-improvement loop.

The assistant request path:

```text
frontend -> assistant edge function -> auth -> general manager
         -> route intent -> domain manager -> tool -> database/action
         -> structured response -> frontend response card
```

The assistant supports two invocation modes:

1. Natural-language mode: the user enters text and the General Manager resolves
   intent.
2. Direct structured mode: a UI already knows the domain/action and invokes a
   tool directly, bypassing NLP.

### 7.2 Three-Tier Routing

Every natural-language assistant input goes through:

1. Slash commands.
   - Fast.
   - Deterministic.
   - Zero AI cost.
   - Examples: `/task`, `/done`, `/today`, `/note`, `/checkin`, `/remind`.

2. Rules.
   - Static rules from registered tools.
   - Dynamic rules from the `assistant_rules` table.
   - Zero AI cost.
   - Useful for common natural-language phrases.

3. AI agent loop.
   - Used only when commands and rules do not match.
   - Receives the tool registry as callable tools.
   - Can execute multi-step requests.
   - Bounded by iteration/tool limits.
   - Logs AI usage and failures.

If the AI loop produces no tool calls and no useful text, a cheap classifier can
produce clarification candidates so the UI can show possible actions instead of
guessing.

### 7.3 Tool Registry

The tool registry is the source of truth for assistant capabilities. Tools
declare:

- ID.
- Domain.
- Actions.
- Slash commands.
- Natural-language rules.
- Schemas/parameters.
- Execution behavior.

Current tool areas (after the June 2026 prune):

- Tasks.
- Checklists.
- Calendar.
- Notifications.
- Trackers.
- Experiment agent.
- Notes.
- Goals.
- Skills.
- Strategies.
- School.
- System.

The General Manager, command parser, rule engine, AI classifier, and domain
managers auto-discover capabilities through the registry. Adding a new assistant
capability should usually mean adding one tool file and registering it. The
registry is intentionally kept lean: every registered tool costs tokens on
every AI-routed request and widens the routing space, so tools that do not
earn their place in a normal day are removed rather than accumulated.

### 7.4 Domain Managers

Domain managers group tool execution by area:

- Planning.
- Health.
- Content.
- Improvement.
- School.
- Extra/system.

(The mental, studying, and projects domains were removed in the June 2026
prune along with their tools.)

The General Manager resolves the route, then delegates execution to the relevant
domain manager. This keeps the request path understandable and prevents one
giant assistant function from becoming the whole app.

### 7.5 Agentic Tool-Use Loop

For ambiguous or compound natural language, the assistant can run a bounded
agent loop. Example:

```text
"Log my mood as 4, add a reminder to call mom at 5, and make tomorrow lighter."
```

The model can choose multiple tools in sequence. The system records each step so
the frontend can show what happened and the backend can debug failures.

Important constraints:

- The loop is bounded.
- Tool execution is typed.
- Failures are logged.
- Empty outputs produce clarification instead of silent failure.
- Dedicated UIs do not pay this cost when they already know the action.

### 7.6 AI Providers

The backend supports:

- Anthropic.
- OpenAI.
- Google Gemini.

Provider and key are read from user settings. The user supplies the API key and
can choose the model. The AI wrapper abstracts provider differences for:

- Text calls.
- Tool/function calls.
- Document inputs for school import.
- Token/cost logging.

### 7.7 Self-Improvement Loop

The assistant has a system-facing learning loop:

```text
assistant request -> assistant_logs
                  -> HR Agent analyzes logs
                  -> assistant_findings
                  -> Trainer Agent generates improvements
                  -> assistant_rules
                  -> future requests route more cheaply
```

The HR Agent analyzes logs for:

- Unmatched patterns.
- Error clusters.
- Slow or expensive routes.
- Repeated AI-classified phrases.
- Habit drift or overdue clusters.
- Opportunities for new rules.

The Trainer Agent can generate dynamic regex-like routing rules from findings.
This does not retrain a model. It improves the routing layer.

### 7.8 Error Logging and Debuggability

The assistant logs:

- Input.
- Detected intent.
- Domain.
- Tool.
- Routing method.
- AI calls.
- Token usage.
- Latency.
- Processing steps.
- Error details.
- Failure transcripts for agent-loop errors.

Important tables:

- `assistant_logs`.
- `assistant_error_logs`.
- `assistant_findings`.
- `assistant_rules`.
- `assistant_learnings`.

This logging is essential because the assistant is a multi-step system. Without
structured logs, debugging would be guesswork.

---

## 8. Off-Track Detection and Notifications

The off-track scanner is a background Edge Function designed to notice when the
user may need a gentle nudge. It can look for signals such as:

- Overdue high-priority tasks.
- Missed routines.
- Skipped check-ins.
- Long idle periods.
- Important scheduled items that have not been acted on.

Potential nudges use deduplication keys so the same reminder is not repeatedly
sent. Notifications should respect:

- Quiet hours.
- Per-hour rate limits.
- User notification settings.
- Deep-link routing back into the relevant app page.

The scanner is not meant to nag. Its job is to catch obvious drift and offer an
easy re-entry point.

---

## 9. Data Model and Storage

### 9.1 Backend

The backend is Supabase:

- Postgres database.
- Supabase Auth.
- Supabase Storage.
- Supabase Edge Functions in Deno.
- Row-Level Security on user-owned tables.
- Service-role access inside Edge Functions with explicit user filters.

### 9.2 Core Tables by Domain

Product tables include:

- `todos`: tasks.
- `entries`: tracker entries/check-ins.
- `trackers`: tracker definitions.
- `smart_notes`: notes and note-like content.
- `note_categories`: note categories.
- `daily_plans`: daily planning records, including the `closed_at` timestamp
  that marks a day as explicitly closed.
- `time_blocks`: scheduled blocks.
- `calendar_events`: synced or created calendar events.
- `goals`: goals and progress.
- `projects`: projects.
- `task_types`: task organization/types.
- `app_events`: lightweight client-side usage events (opens, route visits,
  captures, day closes), RLS-protected per user.
- `task_reminders`: per-task reminder configuration.
- `notifications` / scheduled notification tables.
- `classes`: school classes.
- `assignments`: school assignments.
- `class_sessions`: weekly class meeting times.
- `class_documents`: uploaded course PDFs and extracted summaries.
- `protocols`: regimen/protocol definitions.
- `experiments`: personal experiments.
- `experiment_logs` / `experiment_checkins`: experiment data.
- `checklists`: reusable checklists.
- `settings`: user settings and AI configuration.
- `site_feedback`: user bug/feedback reports.

Assistant infrastructure tables include:

- `assistant_logs`.
- `assistant_error_logs`.
- `assistant_findings`.
- `assistant_rules`.
- `assistant_learnings`.

### 9.3 Converters

The frontend uses a three-layer data pattern:

```text
database row type -> converter -> domain object
domain object -> converter -> database insert/update shape
```

Converters live under `src/services/supabase/converters`. This keeps UI/domain
code insulated from database naming conventions such as `snake_case`,
foreign-key column names, and historical table names.

### 9.4 Naming Gotchas

Important naming details:

- Tasks are stored in `todos`, not `tasks`.
- Tracker check-ins are stored in `entries`, not `tracker_entries`.
- Notes are stored in `smart_notes`.
- School assignments are stored in `assignments`, not `todos`, although they may
  conceptually behave like deadlines/tasks.
- Uploaded class PDFs are represented in `class_documents` and stored in the
  `class-documents` storage bucket.
- `study_sessions` and `planner_drift_events` were dropped in June 2026
  (migration `20260610000002_drop_unused_tables.sql`) — no code reads or
  writes them anymore.

Future agents should check these names before writing queries or migrations.

---

## 10. Privacy, Security, and Trust Model

### 10.1 User-Owned Data

The product should treat the user's data as personal and portable. It supports
export/import flows and stores data per authenticated user.

### 10.2 Row-Level Security

Frontend database access uses the Supabase anon key and relies on Row-Level
Security. Users should only read and write their own rows.

Edge Functions use the service role key, which bypasses RLS. Therefore every
Edge Function must explicitly authenticate the request and filter by `user_id` or
otherwise verify ownership before reading or mutating data.

This is especially important for:

- Assistant tools.
- School import.
- Notification sending.
- Background agents.
- Course document access.
- Any operation that reads from Supabase Storage.

### 10.3 AI Key Handling

The app uses user-supplied AI keys. This has several implications:

- The product does not need a shared AI provider key.
- The user controls provider and cost.
- Features requiring AI should fail gracefully when no key is configured.
- AI calls should be transparent enough that users understand why a feature
  needs a provider key.

### 10.4 AI Safety Boundaries

Student Buddy can help reflect on mood, routines, habits, and functioning, but
it should not present itself as a clinician. Health and medication-related
features should be framed as personal tracking and reflection, not diagnosis or
treatment advice.

For school import, the AI should not silently guess ambiguous dates or deadlines.
The preview step is mandatory because imported planning data can materially
affect the user's schedule.

---

## 11. Frontend Architecture

### 11.1 Stack

The frontend stack:

- React 19.
- TypeScript.
- Vite.
- Tailwind CSS.
- React Query.
- Recharts.
- Lucide React icons.
- Vite PWA plugin.
- Zod for validation where needed.
- Vitest and Testing Library for tests.
- Playwright for E2E smoke tests.

### 11.2 App Shell

The app does not use a router library. `App.tsx` keeps `activeTab` in React state
and renders a route switch. Navigation flows through `onNavigate(tab, params?)`.

This is a deliberate fit for a mobile-first SPA with a compact route set and
deep links from notifications. It also makes it straightforward for assistant
responses and cards to navigate the user into a specific feature.

### 11.3 Layout

The layout has:

- Desktop sidebar.
- Mobile top header.
- Mobile bottom tab bar.
- Floating capture button.
- In-app reminder banner.
- Dev portal.

The current top-level IA is:

- Now.
- Capture.
- Browse.
- Me.

The design direction is calm, utility-focused, and mobile-first. The app should
avoid turning every module into a dense admin dashboard on small screens.

### 11.4 Feature Organization

Feature code is organized under `src/features/*`. Major feature folders include:

- `assistant`.
- `browse`.
- `checklists`.
- `core`.
- `day`.
- `focus`.
- `growth`.
- `health-tracking`.
- `me`.
- `notifications`.
- `planning`.
- `school`.
- `tasks`.
- `toolbox`.

Shared service code lives under:

- `src/services/supabase`.
- `src/services/notifications`.
- `src/services/settings`.

The pattern is feature-first: components, hooks, services, pages, and types live
close to their product domain.

### 11.5 Server State

React Query handles server state. Hooks wrap Supabase operations and expose
domain-specific operations to components. Mutations should invalidate relevant
query keys so pages stay current after assistant actions, imports, edits, and
reminders.

---

## 12. Backend and Edge Functions

### 12.1 Main Edge Functions

Important Edge Functions include:

- `assistant`: request routing, tool execution, assistant logging.
- `hr-agent`: analyzes assistant logs and writes findings.
- `trainer-agent`: generates dynamic routing rules from findings.
- `off-track-scanner`: finds likely drift and schedules nudges.
- `schedule-notifications`: schedules or flushes notifications, and re-enqueues
  the next occurrence of routine anchor reminders after each fire.
- `send-notification`: sends Web Push notifications.
- `quick-note`: fast note capture.
- `calendar-proxy`: calendar integration helper.
- `experiment-agent`: experiment support.
- `school-import`: course PDF analysis and import.

(The `correlations-agent` function was removed in the June 2026 prune.)

### 12.2 Edge Function Principles

Edge Functions should:

- Authenticate the user.
- Explicitly verify ownership.
- Avoid cross-user reads or writes.
- Return structured success/error payloads.
- Keep AI calls bounded.
- Log enough context for debugging.
- Fail gracefully when settings or API keys are missing.

### 12.3 Cron and Background Work

Background work supports:

- Notification scheduling.
- Off-track scanning.
- HR/trainer learning.
- Potential future weekly reviews and correlations.

Background features should be careful with notification volume and should avoid
turning the app into a nagging system.

---

## 13. PWA and Offline Behavior

Student Buddy is a PWA. It includes:

- Web app manifest, including a Web Share Target so installed-PWA users can
  share text/URLs from other apps straight into capture.
- Icons.
- Service worker.
- Offline-capable asset caching.
- An IndexedDB offline capture outbox with automatic replay on reconnect and a
  pending-sync badge.
- Installable mobile experience.
- iPhone shortcut/setup documentation (the Shortcut routes through the
  assistant endpoint, enabling Back Tap / Action Button capture).

The PWA layer matters because this app is meant to be opened many times a day.
It should feel close to a native personal companion, especially on mobile.

Offline behavior prioritizes:

- Loading the app shell.
- Keeping the interface usable during flaky connectivity.
- Never losing a capture: writes queue locally first and sync when online.
- Clear feedback when a server-side action cannot complete.

Known platform limits are accepted facts, not planning gaps: a PWA cannot
provide iOS home/lock-screen widgets or HealthKit access, and iOS only
delivers Web Push to PWAs added to the home screen (16.4+). The subscription
health card exists because iOS can silently drop push subscriptions.

---

## 14. Testing and Quality

The repo includes Vitest tests around critical assistant and task utilities:

- Command parsing.
- Rule engine.
- Rule generation.
- General manager.
- AI classifier.
- Agent loop.
- HR analyzer.
- Date parsing.
- Schema validation.
- Tool registry.
- Quick capture parsing.
- Task recommendation.
- Offline capture outbox.
- Close-day service and week-window logic.
- Today summary (overdue/due-today/school counting).
- Analysis utilities.

A Playwright smoke test (`e2e/app-smoke.spec.ts`) covers the app shell
end-to-end.

The most important quality risks are:

- Assistant actions mutating the wrong user data.
- AI routing silently choosing the wrong tool.
- Notification spam.
- Course import writing incorrect deadlines without user review.
- Planner overfitting to optimistic schedules.
- Tracker analysis implying causality too strongly.
- UI paths that require too much energy on low-capacity days.

Tests should focus heavily on:

- Zero-AI fast paths.
- Dynamic rule loading.
- Tool registry discovery.
- Multi-step assistant orchestration.
- User ID filtering in service-role functions.
- Error logging.
- Date/time parsing.
- Notification deduplication.
- Data converters.

---

## 15. Current Product Direction as of June 2026

Through May 2026 the project grew toward a fuller personal operating system:
Growth Hub with skills, goals, XP, levels, and projects; per-task reminders;
an off-track scanner cron; light and full daily routine modes; a school module
with classes, assignments, sessions, checkpoints, and AI PDF import; unified
capture (shared `CaptureInput` with brain-dump, voice draft, and route-preview
chips); and assistant learning infrastructure.

In June 2026 the direction shifted, prompted by a daily-use audit
(`docs/buddy-daily-use-report.md`): capability had grown for months without
usage following. The diagnosis was that daily use is a habit-formation
problem, not a capability problem — a habit needs a reliable external
**trigger**, a **low-friction action**, and a **visible reward/closure**, and
the app was strong on action but weak on trigger and closure. The June work
therefore mostly finished, wired, or removed things rather than adding
features:

- **Trigger**: morning and evening anchor push notifications, made
  self-sustaining (server re-enqueues the next occurrence) and self-healing
  (client re-applies the schedule every 12 hours), with a push subscription
  health card.
- **Truthful first screen**: Next Up and the Today card now merge school
  assignments and overdue tasks, so the Now page never under-reports a
  deadline.
- **Friction**: an IndexedDB offline capture outbox with replay and a
  pending-sync badge, plus a Web Share Target so OS-level shares land in
  capture.
- **Closure**: an explicit "Close day" end state on `daily_plans` with a
  days-closed-this-week continuity indicator (deliberately not a streak).
- **Measurement**: the `app_events` table instruments opens, route visits,
  captures, and day closes, so future cuts and freezes are data-driven.
- **Weight reduction**: the assistant tool registry was pruned (habits, mood,
  journal, study, projects, task-routines, task-types, context removed along
  with the mental/studying/projects domains); habit/streak UI, the daily
  journal forms, the top-correlations card, and the `correlations-agent`
  function were deleted; the unused `study_sessions` and
  `planner_drift_events` tables were dropped.

---

## 16. Future Opportunities

High-value future directions:

- Two-way time integration: publish the app's time blocks/deadlines as an iCal
  feed the phone's calendar subscribes to, so the plan appears where the user
  already looks instead of in a competing surface.
- Non-AI degradation for the daily path: plan generation should fall back to a
  deterministic heuristic (the task-recommender scoring) when no API key is
  configured or the provider errors.
- Weekly digest and trainer-rule visibility (deferred until push is verified
  end-to-end on the actual device).
- Module freezing driven by `app_events` data: anything untouched for 30 days
  gets removed from the daily path and the assistant hint surface, kept in the
  database.
- Day view merge (the `PlannerPage.tsx` refactor) — deliberately sequenced
  after the trigger/truth/closure work.
- Whether school assignments should auto-generate linked todos (one source of
  truth for "what do I act on").
- Command palette/autocomplete backed by the live tool registry.
- Optional iOS Shortcuts automation that POSTs Apple Health samples (sleep,
  steps) to an edge function nightly; Capacitor wrapping is the structural
  escape hatch if PWA limits keep hurting.
- Weekly review flow.
- Planner that explicitly distinguishes "ideal plan" from "minimum viable day."
- Flashcards and exam planning for the school/study domain.
- Experiment design guidance with clearer causal language.
- More visible AI audit trail for actions that mutate data.
- User-facing controls for assistant learning rules.
- Better notification digesting and batching.
- Calendar conflict handling.
- Export formats that are easy to inspect outside the app.

Product guardrails for future work:

- Do not make the app harder to use on low-capacity days.
- Do not make AI mandatory for basic workflows.
- Do not hide important mutations behind opaque assistant behavior.
- Do not overclaim health insights.
- Do not add motivational mechanics that create shame.
- Do not let navigation become a feature maze.

---

## 17. One-Sentence Mental Model

Student Buddy is a self-regulation scaffold: a personal system that combines
capture, planning, routines, reminders, health tracking, school organization,
reflection, and a learning AI assistant so the user can move from intention to
action with less friction and more self-knowledge.
