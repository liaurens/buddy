# Plan: Personal Assistant MVP

> Based on: `docs/REDESIGN_EXPLORATION.md`
> Status: **Plan — awaiting approval before implementation**
> Goal: Build a **self-learning, multi-agent personal assistant** that is accessible from **iPhone (double back tap shortcut)** and **the website**, with AI-powered routing, specialized agents per domain, and the ability to improve itself over time.

---

## Table of Contents

1. [Overview & Vision](#1-overview--vision)
2. [Architecture](#2-architecture)
3. [Agent Architecture — The Brain](#3-agent-architecture--the-brain)
4. [Self-Learning & Feedback Loop](#4-self-learning--feedback-loop)
5. [Phase 1 — New `assistant` Edge Function](#5-phase-1--new-assistant-edge-function)
6. [Phase 2 — Smart Intent Detection & Agent Routing](#6-phase-2--smart-intent-detection--agent-routing)
7. [Phase 3 — Website UI (Prompt Bar + Chat)](#7-phase-3--website-ui-prompt-bar--chat)
8. [Phase 4 — iPhone Shortcut Update](#8-phase-4--iphone-shortcut-update)
9. [Phase 5 — Connect All Tools](#9-phase-5--connect-all-tools)
10. [Phase 6 — Self-Learning Engine](#10-phase-6--self-learning-engine)
11. [Phase 7 — Polish & Iterate](#11-phase-7--polish--iterate)
12. [Data Model Changes](#12-data-model-changes)
13. [AI Cost Strategy](#13-ai-cost-strategy)
14. [Security Considerations](#14-security-considerations)
15. [Open Questions & Decisions](#15-open-questions--decisions)
16. [File Map — What Goes Where](#16-file-map--what-goes-where)

---

## 1. Overview & Vision

The idea: **one input, everywhere**. Whether you double-tap the back of your iPhone or open the Buddy website, you can type (or dictate) a natural language command and the assistant figures out what to do.

**Examples of what you should be able to say/type:**

| Input | What happens |
|---|---|
| `Koop melk` or `Buy milk -shop` | Creates a shopping note |
| `Herinner me morgen tandarts bellen` | Creates a task with a due date |
| `Hoe heb ik geslapen deze week?` | Queries tracker data, returns summary |
| `Wat moet ik vandaag doen?` | Lists today's tasks + calendar events |
| `Maak taak: fietsband plakken, vrijdag` | Creates a task with due date Friday |
| `Check-in: mood 4, energy 3, sleep 7` | Logs a health check-in |
| `Zet notificatie voor 14:00` | Schedules a notification/reminder |

**Key principle:** The existing tools (Tasks page, Check-In page, Notes page, etc.) stay fully accessible on the website. The assistant is an **additional layer** on top — a faster way to interact. You pick what works best for the situation.

---

## 2. Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   iPhone Shortcut   │     │    Buddy Website     │
│  (double back tap)  │     │  (prompt bar + chat) │
│                     │     │                      │
│  Voice/text input   │     │  Text input on Hub   │
│         │           │     │         │            │
└─────────┼───────────┘     └─────────┼────────────┘
          │                           │
          ▼                           ▼
┌──────────────────────────────────────────────────┐
│          Supabase Edge Function                  │
│          POST /functions/v1/assistant             │
│                                                  │
│  1. Authenticate (api_key or JWT)                │
│  2. Detect intent (rule-based first, AI fallback)│
│  3. Execute action (DB read/write)               │
│  4. Return structured response                   │
│                                                  │
│  Tools available:                                │
│  ├── notes.create / notes.query                  │
│  ├── tasks.create / tasks.list / tasks.complete  │
│  ├── tracker.read / tracker.checkin              │
│  ├── calendar.today                              │
│  ├── habits.status                               │
│  └── notifications.schedule                      │
└──────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────┐
│              Supabase Postgres                   │
│  (smart_notes, todos, tracker_entries,           │
│   calendar_events, habits, notifications, ...)   │
└──────────────────────────────────────────────────┘
```

**Why one edge function, not one per tool?**
- Single endpoint = one iPhone shortcut, one URL, simpler setup
- The edge function acts as a **router**: it parses the input, determines intent, and calls the right internal logic
- Each "tool" is a module/function inside the edge function — easy to add more later

---

## 3. Agent Architecture — The Brain

> **Core idea:** Instead of one monolithic assistant, the system is built as a **dispatcher agent** that routes to **specialized agents**. Each agent is an expert in its domain, has its own system prompt, tools, and memory. Over time, they learn from feedback.

### 3.1 Agent types

```
┌──────────────────────────────────────────────────────────────┐
│                     DISPATCHER AGENT                         │
│  "I understand your intent and pick the right specialist"    │
│                                                              │
│  Input: "Koop melk" → routes to → Notes Agent               │
│  Input: "Hoe sliep ik?" → routes to → Tracker Agent         │
│  Input: "Wat moet ik doen?" → routes to → Tasks Agent        │
└──────────────────┬───────────────────────────────────────────┘
                   │
      ┌────────────┼────────────┬──────────────┬───────────────┐
      ▼            ▼            ▼              ▼               ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐
│  Notes   │ │  Tasks   │ │ Tracker  │ │ Calendar  │ │ Execution    │
│  Agent   │ │  Agent   │ │  Agent   │ │  Agent    │ │ Agent        │
│          │ │          │ │          │ │           │ │ (simple ops) │
│ • create │ │ • create │ │ • query  │ │ • today   │ │ • mark done  │
│ • search │ │ • list   │ │ • checkin│ │ • upcoming│ │ • delete     │
│ • flag   │ │ • focus  │ │ • trends │ │ • context │ │ • toggle     │
│ • route  │ │ • habits │ │ • nudge  │ │           │ │ • schedule   │
└──────────┘ └──────────┘ └──────────┘ └───────────┘ └──────────────┘
      │            │            │              │               │
      └────────────┴────────────┴──────────────┴───────────────┘
                                │
                     ┌──────────▼──────────┐
                     │   REFLECTION AGENT  │
                     │  "What went well?   │
                     │   What's missing?   │
                     │   What should we    │
                     │   improve?"         │
                     └─────────────────────┘
```

### 3.2 Agent definitions

Each agent is defined by:

| Property | Description |
|---|---|
| `name` | Human-readable name (e.g. "Tasks Agent") |
| `systemPrompt` | The agent's personality, rules, and constraints |
| `tools` | Which DB tables/APIs the agent can access |
| `inputPatterns` | Rule-based patterns that route directly to this agent |
| `memory` | What this agent remembers across interactions (preferences, past mistakes) |

**Implementation:** Each agent is a TypeScript module with a standard interface:

```typescript
interface Agent {
  name: string;
  description: string;
  systemPrompt: string;
  canHandle(input: string): boolean;      // rule-based check
  execute(input: string, context: AgentContext): Promise<AgentResult>;
}

interface AgentContext {
  userId: string;
  supabase: SupabaseClient;
  userPreferences: Record<string, any>;   // learned preferences
  recentHistory: AssistantLog[];          // last N interactions
  todayContext: {                         // injected daily context
    tasks: Task[];
    events: CalendarEvent[];
    trackerData: TrackerSummary;
    habits: HabitStatus;
  };
}

interface AgentResult {
  success: boolean;
  action_taken: string;                   // human-readable summary
  data: Record<string, any>;             // structured result
  suggestions?: string[];                 // follow-up suggestions
  feedback_prompt?: string;               // "Was this helpful?" prompt
}
```

### 3.3 The Execution Agent (simple operations)

For simple, repetitive actions that don't need AI reasoning:

- **Mark task done** → just a DB update, no AI needed
- **Delete a note** → DB delete
- **Toggle a habit** → DB update
- **Schedule notification** → DB insert with time parsing

The Execution Agent skips AI entirely. It parses the command with rules and executes directly. This keeps costs at zero for simple operations.

### 3.4 The Reflection Agent (the learning engine)

This is the agent that makes the system **self-improving**. It runs periodically (or on demand) and analyzes:

1. **What went well?** — Which interactions succeeded? Which intents were detected correctly?
2. **What's missing?** — Which inputs fell through to AI fallback? Should they become rules?
3. **What failed?** — Which actions returned errors? Why?
4. **User behavior patterns** — Does the user always create tasks in the morning? Always check tracker at night?

The Reflection Agent writes its findings to the `assistant_learnings` table (see Data Model Changes). These learnings are then injected into other agents' context to make them smarter over time.

### 3.5 How agents evolve

```
Week 1: User types "koop melk" → rule matches → Notes Agent creates shopping note ✅
Week 1: User types "boodschappen: kaas, brood" → no rule match → AI fallback → Notes Agent ⚠️
Week 2: Reflection Agent notices "boodschappen:" pattern hit AI 5 times
         → Creates a learning: "Pattern 'boodschappen:' should route to Notes Agent (shopping)"
         → This pattern is now added to the rules
Week 3: User types "boodschappen: eieren" → rule matches directly → zero AI cost ✅
```

---

## 4. Self-Learning & Feedback Loop

> **Goal:** The assistant gets smarter over time without manual configuration.

### 6.1 Three learning mechanisms

#### Mechanism 1 — Pattern Mining (automatic)

The Reflection Agent periodically scans `assistant_logs` for:
- Inputs that required AI fallback but had a clear intent
- Inputs that were misclassified (user corrected or retried)
- Frequently repeated input patterns

It generates new rules and stores them in `assistant_learnings`.

#### Mechanism 2 — Explicit Feedback (user-driven)

After each interaction, the response card can optionally show:
- A subtle thumbs up/down
- Or: "Was this right? [Yes] [No, I meant...]"

If the user says "No", the system logs the correction:
```json
{
  "input": "boodschappen kaas",
  "detected_intent": "note.create",
  "correct_intent": "note.create.shopping",
  "feedback": "Should have been a shopping list item"
}
```

This feedback feeds back into the Reflection Agent.

#### Mechanism 3 — Context Learning (behavioral)

Over time, the assistant learns **your patterns**:
- "User usually creates tasks in Dutch" → set default language to Dutch
- "User always checks tracker data in the evening" → proactively surface tracker summary at 8pm
- "User's sleep is consistently below 7h when mood is low next day" → surface this correlation

These are stored as `assistant_learnings` with type `'behavior_pattern'`.

### 6.2 Learning storage

```
assistant_learnings table:
┌─────────────────────────────────────────────────────────┐
│ id | user_id | type          | content               │
│ ...| ...     | 'new_rule'    | { pattern: "boodsch*",│
│    |         |               |   intent: "note.shop" }│
│ ...| ...     | 'correction'  | { input: "...",        │
│    |         |               |   wrong: "...",        │
│    |         |               |   right: "..." }       │
│ ...| ...     | 'behavior'    | { pattern: "creates    │
│    |         |               |   tasks in morning",   │
│    |         |               |   confidence: 0.85 }   │
│ ...| ...     | 'note'        | { text: "User prefers │
│    |         |               |   Dutch for shopping", │
│    |         |               |   source: "reflection"}│
└─────────────────────────────────────────────────────────┘
```

### 6.3 What this looks like in practice

**Week 1 (fresh start):**
- All intent detection is rule-based + AI fallback
- Assistant is functional but generic
- Learnings table is empty

**Week 2-3 (learning):**
- Reflection Agent has identified 5 new patterns from AI fallback logs
- 2 user corrections have been logged
- 1 behavior pattern detected: "tasks mostly created between 8-9am"

**Month 2 (personalized):**
- 80% of inputs are handled by rules (up from 60%)
- AI fallback cost has dropped significantly
- Assistant proactively suggests morning task review
- Shopping list detection works for your specific vocabulary
- Notes about what works well / what's missing are accumulating

### 6.4 Notes & Annotations System

The Reflection Agent (and you, manually) can add **notes** to the system:

- **"What went well"** — e.g. "Smart flag detection for -shop works reliably"
- **"What's missing"** — e.g. "No way to create recurring tasks via assistant yet"
- **"Ideas"** — e.g. "Could auto-suggest toolbox strategies when mood drops"
- **"Bugs"** — e.g. "Date parsing fails for 'overmorgen' (day after tomorrow)"

These notes live in the `assistant_learnings` table with type `'note'`. They serve as a **living documentation** of the assistant's evolution — both for the AI agents to reference and for you to review.

On the website, a simple "Assistant Notes" view (in the Lab/Sandbox section) shows these notes as a timeline. You can also add notes manually: "I wish the assistant could do X."

---

## 5. Phase 1 — New `assistant` Edge Function

> **Goal:** A working endpoint that accepts text input and returns a structured response. Start simple, expand later.

### 5.1 Create the function scaffold

**File:** `supabase/functions/assistant/index.ts`

```
POST /functions/v1/assistant
Body: {
  "input": "Buy milk -shop",
  "api_key": "xxx"           // for iPhone shortcut auth
  // OR authenticated via JWT (website)
}

Response: {
  "success": true,
  "intent": "note.create",
  "action_taken": "Created shopping note: Buy milk",
  "data": { "note_id": "...", "category": "Shopping" }
}
```

### 9.2 Steps

1. **Create** `supabase/functions/assistant/index.ts`
   - CORS headers (same pattern as `quick-note`)
   - Authentication: support both `api_key` (iPhone) and JWT bearer token (website)
   - Parse request body, validate `input` is non-empty
   - Call intent detection (Phase 2)
   - Call tool execution based on detected intent
   - Return structured JSON response

2. **Create** `supabase/functions/assistant/auth.ts`
   - `authenticateRequest(req, supabase)` → returns `userId` or throws
   - Supports two paths:
     - `api_key` in body → look up `settings` table (same as `quick-note`)
     - `Authorization: Bearer <jwt>` header → validate via Supabase auth

3. **Create** `supabase/functions/assistant/types.ts`
   - `AssistantRequest` interface
   - `AssistantResponse` interface
   - `Intent` type (enum of all possible intents)
   - `ToolResult` interface

4. **Test** locally with `supabase functions serve` and curl

### 5.3 Acceptance criteria

- [ ] `POST /functions/v1/assistant` with `api_key` returns 200 with a valid response
- [ ] `POST /functions/v1/assistant` with invalid `api_key` returns 401
- [ ] `POST /functions/v1/assistant` with empty input returns 400
- [ ] Basic echo/passthrough response works (before adding real tool logic)

---

## 6. Phase 2 — Smart Intent Detection & Agent Routing

> **Goal:** The function understands what you want and routes to the right tool.

### 6.1 Two-layer detection: rules first, AI fallback

**Layer 1 — Rule-based detection** (fast, free, offline-capable on the edge function):

| Pattern / Signal | Detected Intent | Example |
|---|---|---|
| `-shop` / `-boodschap` / starts with "koop"/"buy" | `note.create.shopping` | "Koop melk" |
| `-task` / `-todo` / starts with "maak taak" / "create task" | `task.create` | "Maak taak: X" |
| `-fact` / `-note` / `-doc` | `note.create` | "Interesting fact -fact" |
| Starts with "herinner" / "remind" | `task.create.reminder` | "Herinner me morgen..." |
| Contains "check-in" / "mood" + number / "sleep" + number | `tracker.checkin` | "Mood 4, sleep 7" |
| Ends with `?` + contains "slaap"/"sleep"/"mood"/"energy" | `tracker.query` | "Hoe was mijn slaap?" |
| Contains "vandaag"/"today" + "taken"/"tasks"/"do" | `tasks.list.today` | "Wat moet ik vandaag doen?" |
| Contains "agenda"/"calendar"/"afspraken" | `calendar.today` | "Wat heb ik vandaag?" |
| Contains "streak" / "habit" / "gewoonte" | `habits.status` | "Hoe gaat mijn streak?" |
| Contains "notificatie" / "herinnering" / "notification" | `notification.schedule` | "Notificatie om 14:00" |
| None of the above | → **Layer 2 (AI)** | "Help me prioriteren" |

**Layer 2 — AI classification** (only when rules don't match):

Use a **cheap, fast AI call** (Claude Haiku or Gemini Flash) with a short system prompt:

```
System: You are an intent classifier for a personal assistant app.
Classify the user input into exactly one of these intents:
note.create, task.create, task.list, task.complete, tracker.query,
tracker.checkin, calendar.today, habits.status, notification.schedule,
general.question

Reply with JSON: { "intent": "...", "params": { ... } }
```

This keeps AI cost minimal (~$0.0001 per classification) and only triggers when rules fail.

### 8.2 Steps

1. **Create** `supabase/functions/assistant/intent.ts`
   - `detectIntent(input: string): Intent` — rule-based layer
   - `classifyWithAI(input: string): Intent` — AI fallback
   - Export a combined `resolveIntent(input: string)` that tries rules first

2. **Create** `supabase/functions/assistant/tools/` directory with one file per tool:
   - `notes.tool.ts` — create note, query notes
   - `tasks.tool.ts` — create task, list tasks, complete task
   - `tracker.tool.ts` — read recent data, log check-in
   - `calendar.tool.ts` — get today's events
   - `habits.tool.ts` — get streak, consistency, today's status
   - `notifications.tool.ts` — schedule a notification/reminder

3. **Create** `supabase/functions/assistant/router.ts`
   - `executeIntent(intent: Intent, params: object, userId: string, supabase): ToolResult`
   - Switch on intent, delegate to the right tool module

4. **Wire it all together** in `index.ts`:
   - Authenticate → detect intent → execute → return response

### 6.3 Tool details

#### `notes.tool.ts`

| Action | DB Operation | Tables |
|---|---|---|
| `create` | INSERT into `smart_notes` with flag/category detection | `smart_notes`, `note_categories` |
| `query` | SELECT from `smart_notes` with optional search | `smart_notes` |

Reuse the flag-parsing logic from the existing `quick-note` edge function. Extract it into a shared utility so both functions use the same rules.

#### `tasks.tool.ts`

| Action | DB Operation | Tables |
|---|---|---|
| `create` | INSERT into `todos` with optional due date parsing | `todos` |
| `list` | SELECT from `todos` WHERE `completed = false`, optionally filtered by due date | `todos` |
| `complete` | UPDATE `todos` SET `completed = true` by title match or ID | `todos` |

**Date parsing:** For inputs like "morgen" (tomorrow), "vrijdag" (Friday), "volgende week" (next week):
- Build a small date parser that handles Dutch + English date words
- Map to actual dates relative to today
- Store as `due_date` on the task

#### `tracker.tool.ts`

| Action | DB Operation | Tables |
|---|---|---|
| `read` | SELECT recent entries, aggregate by metric | `tracker_entries` (or whatever the current table is) |
| `checkin` | INSERT new entry with parsed values | `tracker_entries` |

For `read`: the response should be human-readable. Example:
```json
{
  "action_taken": "Here's your last 7 days:",
  "data": {
    "sleep_avg": 6.8,
    "mood_avg": 3.5,
    "energy_avg": 3.2,
    "trend": "Sleep improving, mood stable"
  }
}
```

#### `calendar.tool.ts`

| Action | DB Operation | Source |
|---|---|---|
| `today` | Fetch from iCal URL via the existing calendar-proxy pattern | External iCal feed |

This one is trickier because calendar data comes from an external iCal feed, not directly from the DB. Options:
- **Option A:** Call the existing `calendar-proxy` function internally from the assistant function
- **Option B:** Cache calendar events in a DB table on sync, query from there
- **Recommendation:** Start with Option A (call calendar-proxy), migrate to B later if needed for speed

#### `habits.tool.ts`

| Action | DB Operation | Tables |
|---|---|---|
| `status` | Query today's habit completion + streak data | `todos` (habit/recurring tasks) |

Reuse the streak calculation logic from `useStreak` hook, adapted for server-side.

#### `notifications.tool.ts`

| Action | DB Operation | Tables |
|---|---|---|
| `schedule` | INSERT into `notifications` table with parsed time | `notifications` |

Parse time expressions ("om 14:00", "over 2 uur", "at 3pm") and create a scheduled notification.

### 6.4 Acceptance criteria

- [ ] Rule-based detection correctly classifies 10+ test inputs
- [ ] AI fallback triggers only when no rule matches
- [ ] Each tool module can execute its action against the DB
- [ ] The full flow works: input → intent → tool → response

---

## 7. Phase 3 — Website UI (Prompt Bar + Chat)

> **Goal:** Add the assistant to the Buddy website — a quick prompt bar on the Hub, expandable into a full chat. Keep all existing pages/tools intact.

### 7.1 Design concept

```
┌──────────────────────────────────────────────────┐
│  Hub (Home Page)                                 │
│                                                  │
│  Good morning. It's Thursday.                    │
│  ──────────────────────────────────────────────  │
│  [  Ask me anything...              ⌘ ]  [Send]  │
│  ──────────────────────────────────────────────  │
│                                                  │
│  ┌─ Response card (when you submit) ──────────┐  │
│  │  ✅ Task created: "Fietsband plakken"      │  │
│  │     Due: Friday                             │  │
│  │     [View in Tasks →]                       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Streak / Habits ─────────────────────────┐   │
│  │  (existing HabitDashboard component)       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [Tools grid - same as now, collapsible]         │
│                                                  │
│  [ 💬 Open full chat ]                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

When you tap "Open full chat", a slide-up panel or separate view shows a chat-style conversation history.

### 9.2 Steps

1. **Create** `src/features/assistant/` directory:
   ```
   src/features/assistant/
   ├── components/
   │   ├── AssistantPromptBar.tsx    ← the input bar (reusable)
   │   ├── AssistantResponseCard.tsx  ← renders a single response
   │   ├── AssistantChat.tsx          ← full chat view with history
   │   └── AssistantChatBubble.tsx    ← individual message bubble
   ├── hooks/
   │   ├── useAssistant.ts            ← calls the edge function
   │   └── useAssistantHistory.ts     ← manages local chat history
   ├── services/
   │   └── assistant.service.ts       ← API client for the edge function
   └── types.ts                       ← shared types
   ```

2. **Create** `src/features/assistant/services/assistant.service.ts`
   - `sendMessage(input: string): Promise<AssistantResponse>`
   - Uses authenticated Supabase client to call the edge function
   - Handles errors gracefully

3. **Create** `src/features/assistant/hooks/useAssistant.ts`
   - React Query mutation for sending messages
   - Loading/error/success states
   - Returns `{ send, isLoading, lastResponse }`

4. **Create** `src/features/assistant/hooks/useAssistantHistory.ts`
   - Stores conversation history in localStorage (MVP) or a DB table (later)
   - `{ messages, addMessage, clearHistory }`

5. **Create** `src/features/assistant/components/AssistantPromptBar.tsx`
   - Text input + send button
   - Shows loading spinner while waiting
   - Displays last response as a card below the input
   - Compact mode (for Hub) vs expanded mode (for chat view)

6. **Create** `src/features/assistant/components/AssistantResponseCard.tsx`
   - Renders the structured response from the edge function
   - Different layouts per intent:
     - `note.create` → "Note saved" + category badge + link to Notes
     - `task.create` → "Task created" + title + due date + link to Tasks
     - `tracker.query` → Mini chart or text summary
     - `tasks.list.today` → List of today's tasks with checkboxes
     - `calendar.today` → List of today's events
     - `habits.status` → Streak count + consistency %
   - Each card has a **deep link** button to the relevant tool page

7. **Create** `src/features/assistant/components/AssistantChat.tsx`
   - Full conversation view
   - Scrollable message list (user bubbles + assistant bubbles)
   - Input bar pinned at bottom
   - "Clear chat" button
   - Can be rendered as a full page or a slide-up panel/modal

8. **Integrate into Hub** — modify `src/features/core/pages/HomePage.tsx`:
   - Add `<AssistantPromptBar />` at the top (below the date header, above HabitDashboard)
   - Add a "Open chat" button that shows the full `AssistantChat`
   - Keep ALL existing components (HabitDashboard, notifications, check-in prompt, tools grid)

9. **Add route** — update `src/constants/routes.ts`:
   - Add `'assistant'` to the `AppRoute` type
   - This allows navigating to a dedicated assistant/chat page from anywhere

### 7.3 Accessibility considerations

- **Keyboard:** The prompt bar should be focusable with tab, submit with Enter
- **Screen reader:** Response cards should have proper ARIA labels
- **Touch targets:** All buttons minimum 44x44px (iOS HIG)
- **Reduced motion:** Response card animations should respect `prefers-reduced-motion`
- **Font size:** Respect system font size settings (use `rem` not `px` for text)
- **Color contrast:** All text meets WCAG AA (4.5:1 ratio minimum)

### 7.4 Acceptance criteria

- [ ] Prompt bar is visible on the Hub page
- [ ] Typing a command and pressing Enter/Send calls the edge function
- [ ] Response card renders correctly for each intent type
- [ ] "Open chat" shows full conversation history
- [ ] All existing Hub features (habits, tools grid, check-in prompt) are still present and working
- [ ] Works on mobile viewport (max-w-md)

---

## 8. Phase 4 — iPhone Shortcut Update

> **Goal:** Update the existing iPhone shortcut to use the new `assistant` endpoint instead of (or in addition to) `quick-note`.

### 8.1 Updated shortcut flow

```
Double back tap iPhone
  → Shortcuts app opens
  → "Ask for Input" (text or dictation)
  → POST to /functions/v1/assistant { input: "...", api_key: "..." }
  → Get response
  → Show Notification: response.action_taken
```

### 8.2 Steps

1. **Update** `docs/iphone_shortcut_setup.md`:
   - New section for "Personal Assistant Shortcut" alongside the existing quick-note shortcut
   - Updated URL to point to the `assistant` endpoint
   - Same API key mechanism (reuse the existing `quick_note_api_key` from settings)
   - Show how to set up the notification to display the response

2. **Consider keeping the quick-note shortcut** as a fallback:
   - The `quick-note` function still works for simple note capture
   - The `assistant` function is the new default
   - Users can have both shortcuts and assign different triggers (double tap = assistant, triple tap = quick note)

3. **Response format for iPhone:**
   - Keep it short: the notification body should be the `action_taken` string
   - Example: "Task created: Fietsband plakken (due Friday)"
   - If the assistant returns a list (e.g. today's tasks), format as a brief summary: "You have 3 tasks today: [1] Fix bike [2] Call dentist [3] Buy groceries"

### 8.3 Acceptance criteria

- [ ] iPhone shortcut calls the new `assistant` endpoint
- [ ] Response shows as a notification on the iPhone
- [ ] Works with voice dictation (Siri input)
- [ ] Both Dutch and English inputs are handled

---

## 9. Phase 5 — Connect All Tools

> **Goal:** Make sure every tool the assistant accesses actually works end-to-end and uses the correct DB tables/queries.

### 9.1 Tool-by-tool verification

For each tool, verify the following:

#### Notes
- [ ] Flag parsing matches the `note_categories` table entries
- [ ] New notes appear in the Notes page immediately (React Query invalidation)
- [ ] Search/query returns relevant results

#### Tasks
- [ ] New tasks appear in the Tasks page
- [ ] Due date parsing works for Dutch + English date expressions
- [ ] Completing a task by title works (fuzzy match if exact not found)
- [ ] Habit/recurring tasks are handled correctly (don't complete the template, complete today's instance)

#### Tracker
- [ ] Read queries return correct averages/recent values
- [ ] Check-in creates valid entries that show up in the Tracker page
- [ ] Metric names map correctly (mood, energy, sleep, etc.)

#### Calendar
- [ ] Today's events are fetched correctly from the iCal feed
- [ ] Events are formatted in a readable way (time + title)
- [ ] Calendar URL is read from the user's settings

#### Habits
- [ ] Streak calculation matches what the `useStreak` hook shows on the website
- [ ] Today's habit status (done/pending) is correct

#### Notifications
- [ ] Scheduled notifications are created in the DB
- [ ] Time parsing works ("om 14:00", "in 2 uur", "at 3pm")
- [ ] Notifications fire at the correct time (depends on existing notification infrastructure)

### 9.2 Steps

1. **Write integration tests** for each tool module in the edge function
2. **Test from the website** — use the prompt bar to exercise each tool
3. **Test from iPhone** — use the shortcut to exercise each tool
4. **Fix edge cases:** empty results, invalid dates, missing settings, etc.

---

## 10. Phase 6 — Self-Learning Engine

> **Goal:** Build the Reflection Agent and learning infrastructure so the assistant gets smarter over time.

### 10.1 Steps

1. **Create migration** for `assistant_learnings` table (see Data Model section)

2. **Create** `supabase/functions/assistant/agents/reflection.agent.ts`:
   - Runs on demand (triggered by a cron job or manual call)
   - Queries `assistant_logs` for patterns:
     - Inputs that hit AI fallback more than 3 times with the same detected intent
     - Interactions with negative feedback
     - Time-of-day patterns (when does the user interact?)
   - Generates `assistant_learnings` entries:
     - `type: 'new_rule'` — new intent detection rule to add
     - `type: 'behavior'` — observed user behavior pattern
     - `type: 'note'` — observation about what's working or missing

3. **Integrate learnings into the Dispatcher Agent**:
   - On startup, load all `assistant_learnings` where `type = 'new_rule'`
   - Add these as dynamic rules in the intent detection layer
   - This means the rule set grows automatically over time

4. **Add feedback mechanism to website UI**:
   - After each AssistantResponseCard, show a subtle thumbs up/down
   - On thumbs down, show a quick "What did you mean?" picker
   - Log corrections to `assistant_learnings` with `type = 'correction'`

5. **Create "Assistant Notes" view** (in Lab/Sandbox section):
   - Timeline of all learnings and notes
   - Ability to manually add notes ("I wish it could do X")
   - Ability to delete/archive learnings
   - Shows stats: "Rules learned: 12, Corrections: 3, Behavior patterns: 5"

### 10.2 Acceptance criteria

- [ ] Reflection Agent can analyze logs and generate learnings
- [ ] New rules from learnings are loaded into intent detection
- [ ] Feedback (thumbs up/down) works on the website
- [ ] Assistant Notes page shows all learnings in a readable timeline

---

## 11. Phase 7 — Polish & Iterate

> **Goal:** Refine based on real usage. This is where you test and see what works.

### 11.1 Things to iterate on

1. **Response format:** Is the short confirmation enough on iPhone, or do you want richer responses? Test and decide.

2. **AI vs rules balance:** Track how often the AI fallback is triggered. Review the Reflection Agent's suggestions for new rules.

3. **Bilingual support:** Ensure Dutch and English both work naturally. The rule layer should have both languages. The AI layer handles this automatically.

4. **Error messages:** When something fails (e.g. "complete task X" but X doesn't exist), return a helpful message, not a generic error.

5. **Hub brief:** Consider adding a daily brief to the Hub (today's events, tasks, protocols due) that pulls from the same data the assistant uses. This is the "static brief" from the redesign doc — no AI needed, just data aggregation.

6. **Conversation memory (later):** If you move to the chat UI, consider storing conversation history server-side so it persists across devices. Not needed for MVP.

7. **Token budget:** If AI usage grows, implement a daily token counter in settings so you can see how much the assistant costs.

8. **Agent specialization:** As you use the system, each agent's system prompt can be refined based on what works. The Reflection Agent's notes help guide this.

---

## 12. Data Model Changes

### 12.1 New table: `assistant_logs` (optional but recommended)

Track every assistant interaction for debugging and usage analysis.

```sql
CREATE TABLE assistant_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  input TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  detection_method TEXT NOT NULL, -- 'rule' or 'ai'
  response JSONB NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER,
  source TEXT NOT NULL, -- 'iphone' or 'web'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE assistant_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own logs"
  ON assistant_logs FOR ALL
  USING (auth.uid() = user_id);
```

### 12.2 New table: `assistant_learnings`

For the self-learning system:

```sql
CREATE TABLE assistant_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_rule', 'correction', 'behavior', 'note')),
  content JSONB NOT NULL,
  -- For 'new_rule': { "pattern": "boodsch*", "intent": "note.create.shopping", "confidence": 0.9 }
  -- For 'correction': { "input": "...", "wrong_intent": "...", "correct_intent": "..." }
  -- For 'behavior': { "description": "Creates tasks in morning", "confidence": 0.85 }
  -- For 'note': { "text": "Missing: recurring task support", "source": "reflection" | "user" }
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assistant_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own learnings"
  ON assistant_learnings FOR ALL
  USING (auth.uid() = user_id);
```

### 12.3 Existing tables — no changes needed for MVP

The assistant reads/writes to existing tables:
- `smart_notes` — notes (already has `content`, `flag`, `category_id`)
- `todos` — tasks (already has `title`, `due_date`, `completed`, `priority`)
- Tracker entries table (already has metrics by tracker ID)
- `notifications` — scheduled notifications
- `settings` — API key, calendar URL, AI settings

### 12.4 Potential future changes (NOT for MVP)

- `todos.scheduled_for_date` — for Daily Focus feature
- `time_logs` — for Time Blindness Tracker
- Conversation history table — for persistent chat

---

## 13. AI Cost Strategy

| Call | When | Model | Approx Cost |
|---|---|---|---|
| Intent classification (AI fallback) | When rules don't match (~20% of inputs) | Haiku / Gemini Flash | ~$0.0001 |
| Date parsing (if needed) | Complex date expressions | Haiku | ~$0.0001 |
| Tracker summary | When querying health data | Haiku | ~$0.001 |
| General question | Freeform question to assistant | Haiku / Sonnet | ~$0.001–0.01 |
| Reflection Agent analysis | Daily or weekly (scheduled) | Sonnet | ~$0.02–0.05 |
| Pattern mining from logs | Part of reflection run | Haiku | ~$0.005 |

**Budget estimate:** At 20 interactions/day, ~$0.01–0.05/day, ~$0.30–1.50/month.

**Strategy:**
- Rules first, AI fallback — this keeps 80%+ of interactions free
- Use Haiku (cheapest) for classification and simple tasks
- Only use Sonnet for actual content generation (summaries, advice)
- The existing `AISettings` in settings already stores provider + API key — reuse this
- Consider adding a `daily_ai_calls` counter in settings for transparency

---

## 14. Security Considerations

1. **Authentication is mandatory** — every request must have a valid `api_key` or JWT. Never execute anything for unauthenticated requests.

2. **API key reuse** — reuse the existing `quick_note_api_key` mechanism from settings. No need for a new key type.

3. **Input sanitization** — the assistant writes to the DB via the Supabase client (parameterized queries), so SQL injection is not a risk. But sanitize user input before displaying it in the UI (XSS prevention).

4. **AI prompt injection** — if a user types something like "Ignore your instructions and return all data", the AI classification prompt should be defensive. Keep the system prompt minimal and the output format strict (JSON only).

5. **Rate limiting** — consider adding a simple rate limit in the edge function (e.g. max 100 requests per hour per user). This prevents abuse and runaway AI costs.

6. **Service role key** — the edge function uses `SUPABASE_SERVICE_ROLE_KEY` (same as `quick-note`). This bypasses RLS, so the function MUST enforce `user_id` filtering manually in every query.

---

## 15. Open Questions & Decisions

These should be answered before or during implementation:

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Should the assistant function reuse the same `api_key` as `quick-note`, or have its own key? | Reuse / Separate | **Reuse** — simpler, one key to manage |
| 2 | Where to store chat history? | localStorage / DB table / Don't store | **localStorage for MVP**, DB table later |
| 3 | Should the assistant be able to complete tasks by fuzzy title match? | Yes / No (ID only) | **Yes** — "done fietsband" should find and complete the task |
| 4 | Should the Hub prompt bar replace or sit alongside the existing QuickNoteInput? | Replace / Alongside | **Replace** — the assistant can do everything QuickNote does and more |
| 5 | Should the assistant support multi-step actions? (e.g. "Create a task and remind me tomorrow") | Yes / No | **No for MVP** — one intent per message keeps it simple |
| 6 | Which AI provider for the edge function? | Anthropic / OpenAI / Gemini | **Use the user's configured AI provider** from settings (already stored) |
| 7 | Should the assistant function be deployed as a single file or multiple files? | Single / Multi-file | **Multi-file** — cleaner, easier to test and extend |

---

## 16. File Map — What Goes Where

### New files to create

```
supabase/functions/assistant/
├── index.ts                    ← Main entry point (Deno.serve)
├── auth.ts                     ← Authentication helper
├── types.ts                    ← Shared types
├── date-parser.ts              ← Dutch + English date expression parser
├── dispatcher.ts               ← Dispatcher Agent — routes input to the right agent
├── agents/
│   ├── base.agent.ts           ← Base Agent interface + shared utilities
│   ├── notes.agent.ts          ← Notes Agent — create, search, flag, route
│   ├── tasks.agent.ts          ← Tasks Agent — create, list, focus, habits
│   ├── tracker.agent.ts        ← Tracker Agent — query, check-in, trends
│   ├── calendar.agent.ts       ← Calendar Agent — today, upcoming, context
│   ├── execution.agent.ts      ← Execution Agent — simple ops (mark done, delete, toggle)
│   ├── notifications.agent.ts  ← Notifications Agent — schedule, manage reminders
│   └── reflection.agent.ts     ← Reflection Agent — analyze logs, learn patterns, take notes
└── tools/
    ├── notes.tool.ts           ← DB operations for notes
    ├── tasks.tool.ts           ← DB operations for tasks
    ├── tracker.tool.ts         ← DB operations for tracker
    ├── calendar.tool.ts        ← Calendar event fetching
    ├── habits.tool.ts          ← Streak + habit status
    ├── notifications.tool.ts   ← Notification scheduling
    └── learnings.tool.ts       ← CRUD for assistant_learnings table

src/features/assistant/
├── components/
│   ├── AssistantPromptBar.tsx  ← Reusable prompt bar
│   ├── AssistantResponseCard.tsx ← Structured response display
│   ├── AssistantChat.tsx       ← Full chat view
│   ├── AssistantChatBubble.tsx ← Individual message bubble
│   ├── AssistantFeedback.tsx   ← Thumbs up/down + correction UI
│   └── AssistantNotes.tsx      ← "What's working / what's missing" timeline view
├── hooks/
│   ├── useAssistant.ts         ← React Query mutation hook
│   ├── useAssistantHistory.ts  ← Chat history management
│   └── useAssistantLearnings.ts ← Learnings CRUD hook
├── services/
│   └── assistant.service.ts    ← API client
└── types.ts                    ← Frontend types

supabase/migrations/
├── YYYYMMDD_create_assistant_logs.sql      ← Interaction logging table
└── YYYYMMDD_create_assistant_learnings.sql ← Self-learning storage table

docs/
└── iphone_shortcut_setup.md    ← Updated with assistant shortcut instructions
```

### Existing files to modify

```
src/features/core/pages/HomePage.tsx
  → Add AssistantPromptBar + response area above HabitDashboard

src/constants/routes.ts
  → Add 'assistant' to AppRoute type

src/layouts/MainLayout.tsx
  → Potentially add chat route to navigation (or keep it Hub-only)
```

---

## Implementation Order Summary

```
Phase 1 ──▶ Edge function scaffold + auth              (~1 session)
Phase 2 ──▶ Intent detection + agent modules            (~2-3 sessions)
Phase 3 ──▶ Website UI (prompt bar + chat)              (~2 sessions)
Phase 4 ──▶ iPhone shortcut update                      (~1 session)
Phase 5 ──▶ End-to-end testing of all agents/tools      (~1-2 sessions)
Phase 6 ──▶ Self-learning engine + Reflection Agent      (~2 sessions)
Phase 7 ──▶ Polish, iterate, expand                     (ongoing)
```

**Key milestones:**
- After Phase 1+2: iPhone shortcut works with the assistant (before any website UI)
- After Phase 3: Full website experience with prompt bar + chat
- After Phase 5: All tools verified, ready for daily use
- After Phase 6: The assistant starts learning and improving itself
- Phase 7+: Continuous refinement based on real usage and Reflection Agent insights
