# Buddy App — Redesign Exploration

> Status: exploration only — no logic written here, just options, trade-offs and possibilities.
> Taal / Language: English (with Dutch originals where useful for clarity)

---

## 0. Where We Are Now — Current Architecture

```
App
├── Home (Daily Hub)         ← habit dashboard + notification cards + tool grid
├── Tasks (TodoPage)         ← smart-sorted list + AI subtask splitter
├── Notes (NotesPage)        ← Quick Note input + categorised notes list
├── Checklists               ← reusable checklist templates
├── Focus (Pomodoro)         ← timer only
├── Health / Tracker         ← dashboard + entry form + correlation analysis
├── Protocols                ← supplement / medication cycle tracker
├── Experiments              ← hypothesis testing with health data
├── Calendar                 ← external calendar sync view
├── Daily Plan               ← AI-generated time-block schedule
├── Reflection               ← end-of-day debrief
├── Toolbox                  ← personal strategy library (tagged, with findings log)
└── Check-In                 ← daily health metric capture
```

**Tech stack** (unchanged unless noted): React 19 + TypeScript + Vite, Tailwind CSS, React Query, Supabase (Postgres), PWA.

---

## 1. Summary of Your Redesign Notes (Dutch → structured)

| Original note | Distilled intent |
|---|---|
| Quick notes werkt goed maar moet uitgebreider en geïntegreerd | Quick Note → smart type detection → auto-route to Task / Fact / Shopping list / Document |
| Checklists verdienen niet een heel eigen vak | Checklists demoted → Sandbox / Lab section |
| Tracker niet als hoofddoel, meer als basistracking die terugslaat op Toolbox | Tracker stays but becomes a passive background layer; its insights feed Toolbox suggestions |
| Experimenten wel, maar focus meer op documentatie en export | Experiments → lighter, more export-focused |
| Daily hub moet meer laten zien, functioneert als persoonlijk assistent | Home becomes a true AI assistant hub |
| Tasks ophopen, AI rangschikken, dagelijks een moment inplannen | Task batching + AI daily scheduling session |
| Plannen is cluncy → tijdblindheidsTracker ipv echte planning | Replace Daily Plan with Time Blindness Tracker |
| Voice/shortcut → afspraak direct in iPhone calendar | iPhone Shortcut → Siri / voice-to-calendar pipeline |
| Persoonlijk assistent is het grote ding | AI chat layer wrapping all tools |
| Rabobank API onderzoek | Finance module — explore Rabobank Open Banking / PSD2 |

---

## 2. Proposed New Information Architecture

```
App
├── Hub (was: Home)                ← personal AI assistant + smart daily brief
│   ├── Quick capture bar          ← replaces QuickNoteInput, smarter
│   ├── "Today" cards              ← tasks due today, events, nudges from Tracker
│   ├── AI prompt bar              ← "what should I do now?" etc.
│   └── Tool shortcuts (collapsed) ← still accessible, just secondary
│
├── Tasks                          ← task inbox + accumulation queue + daily focus pick
│   ├── Inbox                      ← everything dumped here first
│   ├── Daily Focus                ← AI-picked subset for today
│   └── Archive                    ← completed
│
├── Tracker (simplified)           ← lightweight background check-in
│   ├── Quick check-in             ← mood, energy, sleep in <30 sec
│   └── Export / history           ← data export, simple graphs
│
├── Toolbox                        ← personal strategy library (unchanged concept)
│   └── Tracker nudges feed in     ← "Sleep has been poor → here's your sleep tactic"
│
├── Calendar (read-only sync)      ← context for assistant, not a planner
│
├── Time Tracker (was: Daily Plan) ← time blindness awareness tool
│   ├── "Where did my time go?"    ← log what you actually did
│   └── Gentle nudges              ← "you've been on X for 45 min"
│
├── Finance (new, research phase)  ← Rabobank API if feasible
│
└── Lab / Sandbox                  ← Checklists, Experiments, Reflection, Focus timer
    └── (small/unfinished tools)
```

---

## 3. Feature-by-Feature Exploration

---

### 3.1 Quick Notes — Smart Capture

**Current state:** Single text input with `-flag` detection. Works well but the output is always a "note" regardless of content.

**Problem:** The user has to decide what kind of thing they're capturing. That's cognitive overhead.

**Redesign goal:** One capture bar everywhere. AI or rule-based logic decides what it is.

#### Option A — Rule-based type detection (no AI cost)
Parse the text for signal words/patterns before saving:

| Pattern | Detected type | Auto action |
|---|---|---|
| Starts with "Koop / Buy / Boodschap(pen)" or `-shop` | Shopping item | Append to Shopping List |
| Contains `@[name]` or `-fact` | Fact / knowledge | Create / append to a Facts document |
| Starts with "Herinner / Remind" | Reminder | Create task with due date |
| Ends with `?` | Question / research | Create task labeled "Onderzoek" |
| `-task` flag | Task | Add to task inbox |
| `-doc` flag | Document seed | Create new note document |
| None of the above | Plain note | Inbox note as today |

**Pros:** Zero AI cost, fast, predictable.
**Cons:** User has to learn signal words; misdetection is silent.

#### Option B — Light AI classification on save
Send the text to Claude (haiku-level, cheap) with a short prompt:
> "Classify this capture as one of: task / shopping / fact / reminder / note. Reply with just the type."

Then route accordingly.

**Pros:** Zero learning curve, natural language.
**Cons:** Small latency, small AI cost per capture, needs network.

#### Option C — Hybrid (recommended)
Use rule-based detection as the primary path (instant, offline-capable).
If no rule matches, offer a quick type picker (5 icon buttons) inline — not a full modal, just a one-tap row that appears.
AI classification reserved for the AI assistant chat.

#### Auto-actions per type

**Shopping item** → append to a persistent Shopping List note. If the note doesn't exist, create it. Format it as a markdown checklist so individual items can be ticked off.

**Fact** → append to a "Facts & Knowledge" document, timestamped. Think of it as a personal wiki entry.

**Task** → drop into Task Inbox with priority = medium by default.

**Reminder** → attempt to parse a time ("morgen 10u" = tomorrow 10:00) and create a task with a due date. If parsing fails, just ask "When?" with quick options (Today / Tomorrow / Next week).

---

### 3.2 Tasks — Accumulation + Daily Focus

**Current state:** Everything lives in one list, smart-sorted by score. AI can split tasks into subtasks.

**Problem:** Tasks pile up visually. There's no clear "what am I doing today?" moment. The daily planning module is separate and clunky.

**Redesign goal:** Decouple collection from execution.

#### Architecture: Two-bucket model

```
Inbox (all tasks)
    ↓  (AI session, once a day)
Daily Focus (3-7 tasks picked for today)
    ↓  (done / skipped)
Archive
```

**Inbox** — where everything lands. No pressure to process immediately.

**Daily Focus session** — once per day (morning, or whenever the user opens the Hub), the app offers: "Ready to pick your tasks for today?" Then:
1. Shows top N ranked tasks (AI-scored by priority, due date, estimated time, past completion patterns).
2. User can accept the AI pick or swap tasks in/out.
3. Result = a short, focused list for the day.
4. Tasks not picked stay in the Inbox without guilt.

#### AI ranking signals (already partially exists via `taskRecommender.ts`)
- Priority field
- Due date (overdue > due today > due soon)
- Estimated time vs. available time today (from calendar sync)
- Streak / habit data (is this a recurring task?)
- Past completion time of day (do they usually do hard tasks in the morning?)

#### Option A — Simple queue
No AI at all. Tasks are manually ranked via drag-and-drop. Daily Focus = top 5.
**Pros:** No AI cost, fast.
**Cons:** Requires manual maintenance; ADHD-unfriendly.

#### Option B — AI session (recommended)
A short, conversational AI moment. Not a chat — a structured prompt:
> "Here are your 5 best tasks for today based on your schedule and priorities. [List]. Tap to swap any out."

**Pros:** Low friction, feels like a coach.
**Cons:** Small AI cost once per day.

#### Option C — Automatic, silent pick
AI picks the daily list automatically at 8 AM (push notification). User opens the app to see the list already set.
**Pros:** Zero friction.
**Cons:** User may feel no agency; hard to implement reliably with PWA push.

---

### 3.3 Daily Hub — Personal Assistant

**Current state:** A grid of tool buttons + habit dashboard + notification cards. Functional but passive — the user has to know what they want to do.

**Problem:** High friction. Opening the app doesn't immediately help you know what to do next.

**Redesign goal:** The Hub should greet you, know your context, and ask/tell you what's relevant — like a morning briefing from a smart assistant.

#### What the Hub should surface

```
Good morning. It's Tuesday.
─────────────────────────────────────────────────────
📅 You have: standup at 10:00, doctor at 14:00
✅ Today's focus: [Task 1], [Task 2], [Task 3]
💊 Protocols: Magnesium due
📊 Sleep last 3 nights: below avg → sleep tip from Toolbox
─────────────────────────────────────────────────────
[ What should I do now? ] ← AI prompt bar
[ Quick note... ]         ← capture bar
```

This requires the Hub to read from:
- Calendar (events today)
- Tasks (daily focus list)
- Protocols (doses due)
- Tracker (recent patterns → Toolbox nudge)

All of this data is already available through existing hooks; it just needs to be aggregated.

#### The AI prompt bar

A text input on the Hub where the user can type natural language queries:
- "What should I work on?"
- "Sla op dat ik morgen de tandarts bel"
- "Hoeveel heb ik geslapen deze week gemiddeld?"
- "Maak een taak: fiets band plakken, vrijdag"

The assistant has access to (via context injected into the prompt):
- Today's tasks
- Calendar events
- Recent tracker entries
- Active protocols
- Toolbox strategies

**Cost consideration:** Each prompt call costs tokens. Options:
- **Cheap (haiku):** Fast, low cost, limited reasoning. Good for routing / simple queries.
- **Capable (sonnet):** Better at multi-step responses. Use when writing content or doing complex scheduling.
- Implement a "daily token budget" — cap at e.g. 50 assistant interactions per day, show a counter.

#### Option A — Static brief only (no AI)
The Hub just shows a beautiful, structured daily brief pulled from real data. No chat. No AI cost.
**Pros:** Zero AI cost, fast, always works offline.
**Cons:** Can't respond to natural language requests.

#### Option B — Brief + AI prompt bar (recommended)
Static brief for context, AI bar for ad-hoc questions and capture.
Keep the AI bar prominent but show a subtle "AI credit" indicator so cost is visible.

#### Option C — Full conversational assistant
Replace the entire Hub with a chat interface (like a personal Siri).
**Pros:** Most natural.
**Cons:** Very high AI cost; hard to glanceable; loses structure.

---

### 3.4 Tracker — Background Layer

**Current state:** Full feature section with dashboard, entry form, correlation analysis, protocols, experiments, and check-in. Heavy.

**Problem:** The tracker is positioned as a main destination but the user mostly just needs the data to flow into other parts of the app (Hub nudges, Toolbox suggestions).

**Redesign goal:** Make daily check-in invisible/frictionless. Keep the data but reduce the surface area.

#### Daily check-in: 3 taps max

Replace the full Check-In page with a widget that can appear in the Hub or as a notification:

```
How are you? [😴 1][😐 2][🙂 3][😊 4][🤩 5]   Sleep: [__] hrs   Energy: [1-5]
```

Save on submission. No page navigation required.

#### Tracker page (simplified)
Keep as a secondary destination. Remove sub-tabs. Just:
- A timeline of recent entries
- A simple sparkline per metric
- Export button (CSV / JSON)

Remove: complex correlation heatmaps (can go to Lab).

#### Toolbox nudges from Tracker data
This is a key design idea: **the Tracker feeds the Toolbox passively**.

Logic (can be rule-based):
- If sleep average < threshold for N days → surface "Sleep" tagged Toolbox strategies
- If mood has been declining → surface "Anxiety" or "Energy" strategies
- If a protocol has been inconsistent → gentle reminder card on Hub

This turns the Tracker from a passive data store into an active coaching layer — without building a new feature, just connecting existing ones.

---

### 3.5 Planning — Replace with Time Blindness Tracker

**Current state:** AI-generated time-block daily schedule. Clunky, separate from calendar, hard to maintain.

**Problem:** Full scheduling is complex and requires the user to plan ahead accurately — something that's hard with time blindness.

**Redesign goal:** Instead of planning the future, track the present/past. "What am I doing / what did I just do?"

#### Time Blindness Tracker concept

The core insight: people with time blindness don't need a perfect plan — they need gentle awareness of where time is going.

**Features:**
- **Current activity log:** "I'm working on X" — a simple tap to set what you're doing now.
- **Auto-nudge:** after a configurable time (e.g. 45 min), a notification: "You've been on [X] for 45 minutes. Still on track?"
- **Quick log:** tap to log what just happened ("took a break", "got distracted", "finished task").
- **End-of-day review:** simple timeline showing logged activities — "here's where your time went".

This is much lighter to implement than full scheduling and far more useful in practice.

#### Calendar sync — keep as read-only

The calendar view stays but only as a context source for the AI assistant and Hub. It shows events; it does not plan time blocks.

---

### 3.6 iPhone Voice Shortcut → Calendar

**Goal:** Say "Hey Siri, new appointment: dentist Thursday 3pm" and have it land directly in iPhone Calendar — possibly also logged in Buddy.

#### Option A — Native iOS Shortcuts only
Use the iOS Shortcuts app to create a shortcut that:
1. Listens for voice input (dictation).
2. Sends the text to the Buddy web API (a Supabase Edge Function).
3. The Edge Function calls Claude to parse the appointment.
4. The parsed event is added to the user's calendar via CalDAV or the Calendar app via Shortcuts' "Add New Event" action.

**What already exists:** `supabase/functions/calendar-proxy/` and the Shortcuts setup doc (`docs/iphone_shortcut_setup.md`).

**What's needed:**
- An Edge Function that accepts free text + returns a parsed event (`title`, `date`, `time`, `location`).
- A Shortcut that calls the Edge Function, takes the result, and passes it to "Add New Event" (built-in Shortcut action — no API needed for the Calendar write).

**Feasibility:** High. The Shortcut action "Add New Event" writes directly to iOS Calendar without any API credentials. Claude parses the natural language. Cost: 1 Claude call per appointment.

#### Option B — Buddy API as intermediary
Voice → Shortcut → Buddy API → parse → return structured event → Shortcut writes to Calendar.
Same as A but the parsing is on the server side (more robust, no API key on device).

#### Option C — Completely native Siri
Use Siri's built-in "create calendar event" capability. No Buddy integration at all.
**Pros:** Zero development, already works.
**Cons:** No Buddy logging, no smart categorisation.

**Recommendation:** Option B. The Edge Function already exists; just add a `/parse-event` endpoint. The Shortcut does the Calendar write natively. Clean separation.

---

### 3.7 Checklists — Demote to Lab/Sandbox

**Current state:** Full dedicated section with templates and checklist management.

**Decision:** Checklists are useful but not a primary daily-use feature. Move to the Lab/Sandbox section.

**Lab/Sandbox** is a new lightweight section that houses:
- Checklists
- Experiments (from health-tracking, simplified)
- Reflection (end-of-day review)
- Focus / Pomodoro timer
- Any future experimental tools

The Lab is accessible from the Hub via a single "Lab" button in the tool grid. It doesn't get a primary nav slot.

**Visual approach:** The Lab page is a simple grid/list of cards, one per tool. Tapping a card opens the tool inline or in a modal.

---

### 3.8 Toolbox — Strengthen the Connection to Tracker

**Current state:** Personal strategy library — tagged entries with a findings log. Standalone.

**Redesign enhancement:** Make Toolbox reactive.

**New flow:**
1. User has been sleeping badly (Tracker data).
2. Hub shows nudge: "Your sleep has been below average. Tip: [Sleep strategy from Toolbox]".
3. Tapping the nudge opens the Toolbox entry directly.
4. After trying the strategy, user logs a finding in the Toolbox ("tried this, helped 4/5").

This closes the loop: Tracker data → Toolbox recommendation → Finding logged → data gets richer.

**Implementation consideration:** No new tables needed. Just a query: `SELECT * FROM strategies WHERE tags && ARRAY['Sleep']` when the Tracker signals a sleep pattern.

---

### 3.9 Finance — Rabobank API Research

**Goal:** Use bank data to map spending with AI assistance.

#### Rabobank Open Banking
Rabobank participates in PSD2 (EU open banking directive). They expose an API for:
- Account information (balances, transactions)
- Payment initiation (out of scope for now)

**Access path:**
1. Register as a developer at `developer.rabobank.nl`.
2. Create an app and get client credentials.
3. User authenticates via OAuth2 (they log in to Rabobank, grant access to your app).
4. App receives an access token to fetch transactions.

**Security considerations (critical):**
- **Never store the access token on the client.** Always go through Buddy's backend (Supabase Edge Function).
- The Edge Function acts as a proxy: client calls Buddy API → Buddy calls Rabobank API → returns data.
- Tokens should be encrypted at rest in Supabase (use `pgcrypto` or store in a separate vault table with RLS).
- Refresh tokens must be rotated and stored server-side only.
- Transactions contain highly sensitive PII — apply strict Row Level Security in Supabase.
- Consider: do you even want to store raw transactions? Alternative: fetch → AI summary → store only the summary.

**What AI can do with the data:**
- Categorise transactions (food, transport, subscriptions, etc.) with Claude.
- Flag unusual spending ("this week you spent 3x your normal amount on food delivery").
- Monthly summary: "Here's where your money went in January."
- Budget tracking: "You set a €200/month dining budget; you're at €180 with 10 days to go."

**Implementation options:**

| Option | Description | Complexity | Privacy risk |
|---|---|---|---|
| A — Full integration | Fetch + store + AI categorise | High | High |
| B — On-demand fetch | Fetch only when user requests, don't store raw data | Medium | Low |
| C — Manual import | User exports CSV from Rabobank app, uploads to Buddy | Low | Minimal |

**Recommendation:** Start with Option C (manual CSV import) to validate the feature without touching OAuth or live API. If it proves useful, upgrade to Option B (on-demand, no storage of raw transactions).

**Feasibility check:**
- Rabobank PSD2 API exists and is documented.
- OAuth2 + Edge Function pattern is straightforward.
- Main risk: Rabobank may require you to be a registered AISP (Account Information Service Provider) under PSD2 regulation, which has compliance requirements in the Netherlands. This is worth investigating before building.

---

## 4. Navigation Redesign

**Current:** 10+ items in a tab bar / tool grid — overwhelming.

**Proposed:** Primary navigation with 4-5 slots max, everything else in secondary menus.

### Option A — Bottom nav (4 tabs) + Hub as home

```
[ Hub ]  [ Tasks ]  [ Tracker ]  [ Toolbox ]  [ Lab ]
```

- Hub = home + assistant
- Tasks = inbox + daily focus
- Tracker = lightweight check-in + history
- Toolbox = strategy library
- Lab = checklists, experiments, reflection, focus, finance (later)

### Option B — Hub-centric with swipe panels
Hub is the only primary view. Other tools are accessed via swipe or tapping cards on the Hub. No permanent bottom nav.
**Pros:** Clean, everything through the assistant.
**Cons:** Discoverability suffers; hard to deep-link.

### Option C — Current grid, reorganised
Keep the existing tab structure but reorganise it: primary tools in the nav, secondary in a "More" tab.
**Pros:** Lowest refactoring cost.
**Cons:** "More" tabs are a UX smell; doesn't feel like an assistant.

**Recommendation:** Option A for now. It's a clean step forward from the current state without a full rewrite of navigation.

---

## 5. AI Cost Model

Every AI feature has a cost. Here's a framework for thinking about it:

| Feature | Frequency | Model | Approx cost |
|---|---|---|---|
| Quick note classification | Every capture | Haiku | ~$0.0001 per note |
| Daily task ranking | Once/day | Haiku | ~$0.001 |
| Hub assistant prompt | Ad-hoc | Haiku/Sonnet | ~$0.001–0.01 |
| Event parsing (Shortcut) | Per appointment | Haiku | ~$0.001 |
| Finance categorisation | Monthly batch | Sonnet | ~$0.01–0.05 |
| AI task splitting | On demand | Sonnet | ~$0.005 |

**Strategy:** Use Haiku for classification/routing. Use Sonnet only for content generation (splitting tasks, writing summaries). Never use Opus for routine tasks.

**Transparency:** Consider showing the user a "monthly AI usage" stat in settings. Makes cost tangible and builds trust.

---

## 6. Data Model Considerations (no schema changes yet)

### Notes → Typed notes
Currently: `notes` table with `content`, `flag_category`, `created_at`.
To support typed capture: add a `type` column (`note | task | shopping | fact | reminder`).
Shopping items could be a JSON array on a "shopping list" note, or a separate `shopping_items` table.

### Tasks — Daily Focus
Add a `scheduled_for_date` column on `todos`. If set = this task is in the daily focus for that date.

### Tracker → Toolbox nudges
No schema change needed. Just a computed query at read time.

### Time Blindness Tracker
New table: `time_logs` (`id`, `user_id`, `activity`, `started_at`, `ended_at`, `notes`).

### Finance
If going with CSV import: `transactions` table (`id`, `user_id`, `date`, `amount`, `description`, `category`, `raw_description`).
Strict RLS: `user_id = auth.uid()` on all queries.

---

## 7. Open Questions

1. **AI assistant scope:** Should the assistant be able to *write* data (create tasks, log check-ins) or only *read* and *advise*? Writing is more powerful but more risky (wrong data created).

2. **Offline behaviour:** The PWA should degrade gracefully. Quick capture should work offline and sync later. Which features are "offline-first"?

3. **Notification reliability:** PWA push notifications are unreliable on iOS Safari. Is a native iOS Shortcut the better nudge mechanism for iPhone users?

4. **Rabobank AISP compliance:** Is registering as an AISP feasible for a personal project? Or is the CSV import route more practical long-term?

5. **Lab vs. deletion:** Should the demoted features (checklists, full reflection, Pomodoro) be actively maintained, or is the Lab just a holding area before they get removed?

6. **Toolbox tags ↔ Tracker metrics:** Currently Toolbox tags (Sleep, Energy, etc.) are hardcoded. Should they be linked to actual Tracker metric names dynamically?

7. **Daily Focus session UX:** Is a conversational AI session the right moment, or would a simple "Here are your 5 tasks, approve?" card be better (less intimidating)?

8. **Calendar write-back:** If the assistant creates a task with a due date, should it also create a calendar block? Or keep calendar read-only for now?

---

## 8. Phasing (rough, no timeline)

### Phase 1 — Foundation (lowest risk, highest daily value)
- Smart Quick Capture (hybrid rule-based + type picker)
- Hub redesign: structured brief + capture bar
- Tasks: Inbox + Daily Focus split
- Navigation: 5-tab bottom nav

### Phase 2 — Connection
- Tracker → Toolbox nudge engine
- Daily check-in widget on Hub (3-tap)
- Tracker simplified (remove heavy correlation UI to Lab)

### Phase 3 — Time Awareness
- Time Blindness Tracker (replace Daily Plan)
- iPhone Shortcut → voice → calendar event pipeline

### Phase 4 — Intelligence
- AI prompt bar on Hub (read-only assistant)
- AI writes data (create task, log entry) — careful scoping needed

### Phase 5 — Finance (research-gated)
- Verify Rabobank PSD2 / AISP feasibility
- CSV import prototype
- AI categorisation layer

---

## 9. Design Principles for the Redesign

1. **Every feature must earn its place on the primary nav.** If it's not used daily, it goes to the Lab.
2. **Capture should have zero friction.** The quick capture bar should be reachable from everywhere (sticky on Hub, floating button elsewhere).
3. **AI should reduce decisions, not require them.** If the user has to configure the AI, it's already failed.
4. **Tracker data should work for the user without the user having to look at it.** Passive coaching, not active dashboarding.
5. **Cost transparency.** The user should know roughly what the AI features cost. No hidden fees.
6. **Security first for finance.** If the finance feature can't be done safely, it shouldn't be done at all.
