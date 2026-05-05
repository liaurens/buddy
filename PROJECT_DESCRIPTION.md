# Student Buddy — Project Description (Research Brief)

> A long-form description of what this product is, who it is for, and how its pieces actually work together. Written to be handed to a researcher, designer, or AI agent as background context. Focuses on **how & why**, not on code.

---

## 1. What it is, in one paragraph

Student Buddy is a personal Progressive Web App (PWA) for **executive function, self-regulation, and holistic life tracking**. It is built for people — students, knowledge workers, and especially people with ADHD or related executive-function difficulties — whose problem is not lack of willpower but lack of structure, mirrors, and gentle external scaffolding. It combines a task manager, an AI day-planner, a quantified-self tracking system, a personal experiments engine, a routines/checklists layer, a Pomodoro focus timer, and an AI assistant that learns from the user's own behavior over time. Everything is optional and modular, but the components are designed to feed each other in a single loop: **plan → act → log → reflect → learn → adapt**.

---

## 2. Who it is for and why it exists

The target user is someone who:

- Has trouble estimating time, starting tasks, or staying on track without external reminders.
- Wants to understand themselves — sleep, mood, focus, medication effects, supplement protocols — instead of just following generic productivity advice.
- Has tried "normal" todo apps (Todoist, Things, Notion) and found them too inert: they hold tasks, but they don't *help*.
- Is comfortable bringing their own AI API keys (OpenAI, Anthropic, Google) and treats AI as a coach rather than a dictator.

Four problems the app explicitly solves:

1. **Time blindness** — tasks always take longer than expected; days feel chaotic.
2. **Hidden cause/effect relationships** — "why do I focus better some days?" is unanswered without data.
3. **Fragmented self-knowledge** — what worked yesterday is forgotten by tomorrow.
4. **Intention-action gaps** — plans look good on paper but dissolve in practice.

The philosophy is **N-of-1 personal science** combined with **behavioral activation**: instead of telling the user what to do, it gives them a structured container for their day, observes what they actually do, and reflects patterns back. The app's tone is encouraging, never judgmental: *"You completed 3 of 5 blocks. The two skips were both hard tasks after a meeting — let's try scheduling hard work earlier tomorrow."*

---

## 3. The core daily loop

A typical day in the app looks like this:

**Morning (full or "light" routine).** The user opens the app and is walked through a morning sequence: a quick comms triage, a reflection on yesterday, a glance at today's calendar + open tasks, and finally a **Plan Day** step. They tell the app three things — *how do you feel (1–10), how many hours do you have, did you take meds* — and Buddy generates a **time-blocked schedule** for the day. The plan accounts for energy curves (hard work in peak windows), historical task duration (the app remembers that the user always underestimates writing tasks by ~40%), external calendar events, and a chosen *mode*: standard, chronobiological (respects medication timing), or behavioral activation (used when mood ≤ 4 — structure over ambition).

**During the day.** The user works through time blocks. Tasks can be completed via UI or via slash commands in the assistant chat (`/done write essay`). The app logs actual duration so future estimates improve. An **off-track scanner** runs every 15 minutes server-side and gently nudges if the user has been idle for hours, missed a routine, or has overdue high-priority tasks. Notifications respect quiet hours and per-hour rate limits.

**Evening.** A reflection routine asks how the day went, prompts a short journal, and shows simple feedback like "your focus was high — you slept 8h last night." Over weeks, this builds the dataset that powers correlation analysis and experiments.

The **five pillars** (visible in commit history as the conceptual spine of the app) are: **Tasks, Reflection, Planner, Experiments, Tracker**. Each pillar works alone, but the value compounds when used together.

---

## 4. Feature modules — what each does for the user

### Planning
The most active feature. Generates AI day plans from current state (mood, energy, meds, hours), open tasks (with priority, estimate, due date), calendar events, recurring activity templates, and historical task durations. Time blocks have status `pending → active → completed/skipped`. Reflection at end of day closes the loop and feeds into tomorrow's plan.

### Health Tracking (Quantified Self)
Users define **trackers** for anything they care about: sleep, mood, focus, caffeine, supplements, exercise. Trackers have type (number, rating, boolean, text), optional goal, and cadence (daily, episodic, weekly). After ~2–3 weeks of data, **correlation analysis** computes Pearson correlations across all pairs and surfaces patterns ("focus correlates 0.82 with sleep"). **Protocols** codify supplement/medication regimens with on/off cycles, doses, expected effects, and linked trackers. **Experiments** let the user pick two trackers and run a structured A/B over time ("does caffeine actually help my focus?"). This is real personal-biohacking infrastructure, not just journaling.

### Tasks
Tasks have title, due date, time estimate, priority, subtasks, labels, location, recurrence, project assignment, and now **per-task reminders**. Quick capture via slash commands (`/task`, `/note`, `/shop`) makes inbox-zero friction-free. Notes auto-categorize via flag-based routing (a note tagged `#shop` lands in the shopping category). The recommendation engine ranks tasks by priority + due date + historical completion rate. An AI task splitter breaks big tasks into estimated subtasks the planner can fit into a week.

### Assistant (the centerpiece — see §5)
A chat interface backed by a hierarchical intent router with three tiers, multiple background agents, and continuous learning. Acts as both an interaction surface and the brain that ties the other features together.

### Checklists
Reusable templates for recurring routines (morning, evening, weekly review). Auto-reset after completion. Critical scaffolding for users who benefit from external structure.

### Toolbox (Strategy Library)
A user-built library of personal coping/productivity strategies ("5-minute walk to reset", "Pomodoro when stuck"). Not pre-filled; grown organically. The assistant can surface a relevant strategy when it detects the user is stuck.

### Focus
Configurable Pomodoro timer. Can optionally log to a focus tracker and integrate with the planner.

### Growth Hub (recently added)
A gamified skill-progression layer — XP, levels, titles (Novice → Grandmaster), grouped by project. Manual XP entry. Designed for ADHD users who benefit from visible progress bars and a sense of accumulating mastery.

---

## 5. The AI Assistant System (the most novel piece)

Implemented as a Supabase Edge Function. It is **not** a thin wrapper around an LLM — it is a hierarchical, cost-aware router with self-improvement loops.

### Three-tier routing

For every user input, the assistant tries:

1. **Slash commands** (zero cost). Pre-parsed: `/task`, `/checkin mood 7 energy 5`, `/today`, `/remind 14:00 call dentist`.
2. **Rules** (zero cost). Regex/pattern matching against the input. Includes both **static rules** (hardcoded per tool) and **dynamic rules** (generated by the trainer agent — see below).
3. **AI classification** (cheap LLM call, fallback only). When slash and rules miss, a small model classifies intent + domain + confidence. If confidence is below 0.5, the assistant asks the user to clarify between the top candidates instead of guessing.

Once intent is resolved, the request is dispatched to a **domain manager** (planning, health, content, mental, improvement, studying, projects, extra), which calls the appropriate **tool** (a typed action like `task.create`, `tracker.checkin`, `plan.generate`, `mood.log`, `goal.progress`).

Dedicated UIs (e.g. the planner page) **bypass routing entirely** by calling tools directly with structured arguments — no NLP needed when the intent is already known.

### Self-improvement loop: HR Agent + Trainer Agent

These run server-side on cron and make the assistant smarter over time **without retraining any model**.

- **HR Agent** (daily, ~3 AM). Reads `assistant_logs` (every assistant request is logged with input, detection method, domain, tool, AI calls, processing steps). Analyzes patterns purely with code — no AI. Writes findings: unmatched patterns, error clusters, habit drift, overdue clusters.
- **Trainer Agent** (after HR). Reads new findings. For unmatched patterns, generates a regex rule (e.g. `"what['s]+ due" → task.list.today`) and writes it to the `assistant_rules` table.
- At runtime, the general manager loads each user's dynamic rules and checks them between static rules and the AI tier. So a phrase that fell through to AI yesterday is matched for free tomorrow.

The user never sees this machinery. They just notice the assistant getting more responsive and cheaper over time.

### Off-track scanner
A separate cron (every 15 min) checks per-user state for: overdue high-priority tasks, missed routines (e.g. morning routine usually 6–9 AM and it's now 11), skipped check-ins, prolonged idleness. Each potential nudge has a `dedup_key` to prevent duplicates and respects quiet hours + rate limits. Enqueued into `scheduled_notifications`, flushed via Web Push.

---

## 6. Data, privacy, and the trust model

- **Backend**: Supabase Postgres. All tables in `public` schema with **Row-Level Security** — users can only read/write their own rows.
- **Frontend** uses the anon key (RLS enforced). **Edge functions** use the service role key (RLS bypassed; user ID passed explicitly).
- **AI keys are user-owned**: the user enters their own OpenAI / Anthropic / Google API key in Settings, stored in the `settings` table. The product never holds shared model credentials. Cost and choice of model are the user's.
- **Full data export/import** from the Account page (JSON dump of all trackers, entries, tasks, notes, experiments). The user owns their data and can leave.
- **PWA / offline**: service worker caches assets and local state, so the app remains usable on a flaky connection.

---

## 7. Notable architecture choices and why

- **No router library.** `App.tsx` is a `useState<AppRoute>` with a switch. Navigation flows via `onNavigate(tab, params?)` props. Deliberate: the app is a mobile-first SPA where a full router would be overkill, and per-route settings modals are registered in a single `SETTINGS_MODALS` map.
- **React Query** for all server state. Caches assistant responses and DB reads, auto-invalidates on mutations.
- **Three AI providers, user-supplied keys.** Provider-agnostic by design.
- **Edge functions in Deno** for low-latency cold starts (~100–200ms) and clean TypeScript.
- **Three-layer Supabase data pattern**: `Db*` row types → bidirectional converters → higher-level operations. Keeps the domain model independent of the database shape.
- **Feature modules are self-contained** (`src/features/*` with their own components, hooks, services, types, barrel exports). Cross-feature interaction happens through typed assistant tools and shared converters, not direct imports.
- **Critical naming gotchas** worth knowing: tasks are stored in the `todos` table (never `tasks`); tracker check-ins are in the `entries` table (never `tracker_entries`).

---

## 8. Recent direction (as of May 2026)

The latest commit shipped a **Growth Hub** (XP/skills/levels grouped by project), **per-task reminders** with configurable cadence, the **off-track scanner** cron, and **light** variants of the morning/midday routines (~2–3 minutes vs. the full 10–15 minute version). Earlier work introduced the notifications system, daily routine wizard, goals, and a redesign of the health tracking and daily routine forms.

The trajectory is clear: the core loop (plan → act → reflect) is stable; current effort is on **scaffolding around it** — reminders, nudges, lighter on-ramps, visible progress — so the user stays in the loop even on bad days.

---

## 9. The mental model in one sentence

> Student Buddy is not a task manager. It is a **self-regulation scaffold** that combines a personal science engine, an AI day-planner, and a learning assistant — built on the assumption that the user is smart and capable and just needs better mirrors and gentler nudges.
