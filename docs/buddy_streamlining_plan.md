# Buddy — Streamlining Plan

## Status (2026-04-21)

- **Phase 1 — Now layout**: done. `HomePage` is `AssistantPromptBar` → `NextUpCard` → `TodayCard` → `InsightCard` → `RecentCaptures`. Tool grid and `HabitDashboard` removed.
- **Phase 2 — Capture mechanics**: mostly done. Shared `COMMANDS` registry, `PRIMARY_COMMANDS` top-4 picker, multiline brain-dump chunking, `CaptureFAB` (tap + long-press voice) wired end-to-end into `AssistantPromptBar` via `sessionStorage`. Classifier now reports `confidence` and surfaces clarification candidates when ambiguous. NL rule ghost-chip preview not shipped.
- **Phase 3 — Day view**: scaffold only. `DayPage` shell with morning/midday/night tabs embeds existing `PlanPage` / `CheckInPage` / `ReflectionPage`. Full split blocked on the 71 KB `PlannerPage.tsx` audit.
- **Phase 4 — Agent visibility**: partial. Migration adds `user_visible` / `seen_at`. `InsightCard` live on Home; HR agent now emits `habit_trend` and `overdue_cluster` findings flagged user-visible. Weekly digest and trainer-rule toasts deferred pending end-to-end push verification.
- **Phase 5 — Settings consolidation**: done. All 13 modals live in the `MePage` registry; no more per-page gear icons.
- **Phase 6 — Unified stuff model**: untouched; revisit after living with 1–5.

## Guiding principle

A daily buddy should do **two things well**:

1. **Capture anything in one place, zero decisions** — thought, task, mood, shopping item, health metric, journal line — all go through one input.
2. **Tell the user what matters right now** — one proactive surface, always on the home screen, computed from the data you already have.

Everything else is an archive/browse concern and should not compete for attention on the home screen.

The current app violates both: the home screen is a launcher with 11 tiles, and capture requires the user to pre-classify (task vs note vs check-in vs journal vs shopping) and then navigate to the right page. Your assistant infrastructure already supports (1), but the UI still routes around it. Fix (1) first — it's the biggest unlock for the smallest code change.

---V=

## Target information architecture

Collapse **17 routes → 4 bottom tabs + 1 detail layer**.

| Tab       | Purpose                                                                 | Replaces                                                       |
|-----------|-------------------------------------------------------------------------|----------------------------------------------------------------|
| **Now**   | Today surface — next action, pending check-in, fresh insight, capture   | `home`, `planning`, `planner`, `reflection`, `check-in`, `focus` |
| **Capture** | Full-screen capture + assistant chat. Long press FAB from anywhere.    | `assistant` (chat page), most slash-command discovery           |
| **Browse** | All your stuff: tasks, notes, checklists, health data, goals, projects | `tasks`, `notes`, `checklists`, `health`, `protocols`, `experiments`, `toolbox`, `growth`, `calendar` |
| **Me**    | Account, settings, data, AI config, dev portal                          | `account`, 13 per-page `SettingsModal`s, `DevPortal`            |

Detail pages (task detail, tracker detail, experiment setup, protocol editor) push on top of Browse, they are not top-level destinations.

**Concrete: delete from `routes.ts`:** `planning`, `planner`, `reflection`, `check-in`, `protocols`, `experiments`, `focus`, `toolbox`, `growth`, `checklists`, `notes`, `assistant`. Keep as routes only for deep-linking from notifications — not as navigation tiles.

---

## Phase 1 — Home becomes "Now" (highest ROI, ~1 day)

**File: `src/features/core/pages/HomePage.tsx`** — currently 240 lines with 11 tool tiles and an accordion. Replace with roughly this structure:

```
┌─────────────────────────────────┐
│ Fri, Apr 17                     │
│                                 │
│ [ Capture input — full width ]  │ ← AssistantPromptBar, promoted
│                                 │
│ ┌─ Next up ────────────────┐   │ ← ONE card, computed
│ │ 🎯 Fix bike tire         │   │
│ │    due today · 30 min    │   │
│ │    [Start focus] [Done]  │   │
│ └──────────────────────────┘   │
│                                 │
│ ┌─ Today ─────────────────┐   │
│ │ ✓ Check-in not done      │   │ ← only shows if action needed
│ │ 3 tasks · 2 events       │   │
│ │ [Open day view]          │   │
│ └──────────────────────────┘   │
│                                 │
│ ┌─ Insight ───────────────┐   │ ← surfaced from HR agent
│ │ Sleep trending down 4d   │   │
│ │ [See trend]              │   │
│ └──────────────────────────┘   │
│                                 │
│ Recent captures (last 5)        │ ← tiny list, tap to edit
└─────────────────────────────────┘
```

**Specific changes:**

- **Delete the `tools` array (lines 55–133)** and the "Tools" grid section (211–235). Move access to tools behind the **Browse** tab.
- **Delete `HabitDashboard`** from home or collapse it into the "Today" card as one line. It's too heavy for a glanceable surface.
- **Delete `actionItems` accordion** (160–208). Replace with the "Today" card which shows pending check-in + task/event counts as one tap target.
- **Promote `AssistantPromptBar`** to the dominant element. Remove the "Open full chat" link — tapping the input should expand to full chat if the user wants history.
- **Add a "Next up" card**: query `useTaskRecommendation` (already exists) + first upcoming calendar event; pick whichever is sooner/higher priority. This is the one thing the user should do next, rendered as a card with `[Start focus]` and `[Done]` actions.
- **Add an "Insight" card**: read from `assistant_findings` table (HR agent already writes there) and surface the newest unseen finding. This is where your agent infrastructure starts paying off visibly. Dismissing marks it as seen.

**Do not add more cards.** The discipline here is: if a card doesn't change day-to-day, it doesn't belong on Now.

---

## Phase 2 — Unify capture (~2 days)

Right now there are 5+ capture paths: task form (`TodoPage`), note form (`NotesPage`), check-in modal, journal prompts, shopping-list shortcut. The assistant already routes all of these via 3-tier routing. Make capture the default and these forms the exception.

**File: `src/features/assistant/components/AssistantPromptBar.tsx`**

- **Remove the hardcoded `COMMANDS` array (lines 9–23).** Build it from the tool registry. There's already a registry at `supabase/functions/assistant/tools/registry.ts`; expose it to the frontend via a small endpoint or mirror the command list in a shared TS const used by both sides. Hardcoding the list in two files guarantees drift.
- **Shorten the hint dropdown to 4 commands** by default, with "Show all" at bottom. 13 commands in a picker overwhelms the choice. Top 4: `/task`, `/note`, `/checkin`, `/remind`.
- **Surface NL rule matches as a preview before send.** When the user types "koop melk", show a ghost "→ shopping list" chip under the input. This makes the invisible NL tier visible without forcing slash syntax. If they hit Enter, it routes. If it's wrong, they retry.
- **Accept multiline input** (textarea, auto-grow). Brain dumps are a daily-buddy primitive. The assistant should split a multi-line dump into multiple captures in one go — add a `bulk` action that chunks by newline and routes each.

**New file: `src/components/CaptureFAB.tsx`**

Persistent floating action button, visible on every tab except Capture. Tap = open Capture tab with input focused. Long-press = voice capture (browser SpeechRecognition → text → assistant.send). This is the "zero-friction-from-anywhere" surface.

**File: `supabase/functions/assistant/core/ai-classifier.ts`**

- The AI classifier is the Tier 3 fallback. Right now it classifies into domain+action. **Add a `confidence` field**, and if confidence < threshold, return a clarification response with 2–3 disambiguation buttons ("Task? Note? Shopping?"). This prevents silent misrouting, which is the single most trust-destroying failure mode in a capture-first app.

---

## Phase 3 — Merge Check-in / Journal / Reflection / Planner into one daily flow (~3 days)

Right now the user has to visit:

- **`check-in`** (`CheckInPage.tsx`, 220 lines) for mood/energy + prompts + wins + health metrics drawer
- **`reflection`** for evening reflection
- **`planning`** / **`planner`** (71KB file — that alone is a red flag) for morning planning
- **`calendar`** for events

These are phases of the same daily loop. Collapse into one **Day view** with three modes: *Morning*, *Midday check*, *Evening*. Auto-select mode based on time of day.

**New file: `src/features/day/pages/DayPage.tsx`**

```
┌─────────────────────────────────┐
│ Today — Fri, Apr 17             │
│ [ Morning ] [ Midday ] [ Night ]│ ← auto-selected, user can override
│                                 │
│ MORNING mode:                   │
│   Energy now: [1–5]             │
│   Focus hours today: [input]    │
│   Top priority: [pick from      │
│     recommended task]           │
│   [Generate plan] — AI planner  │
│                                 │
│ MIDDAY mode:                    │
│   How's it going? mood [1–5]    │
│   Stuck? [surface strategy]     │
│                                 │
│ NIGHT mode:                     │
│   3 wins (DailyWins component)  │
│   2 prompts (DailyJournalForm)  │
│   Rate the day [1–5]            │
│   [Tomorrow preview]            │
└─────────────────────────────────┘
```

**Concrete refactor:**

- Move `CheckInPage`, `ReflectionPage`, `PlanPage`, `PlannerPage` into `src/features/day/` as internal sub-components (`MorningMode.tsx`, `MiddayMode.tsx`, `NightMode.tsx`). They stop being pages.
- The `daily_plans` table already exists and stores a day's state — good, reuse it. The three modes all read/write the same row.
- Route `/today` in the assistant and the "Today" card on Now both deep-link here.
- The 71KB `PlannerPage.tsx` almost certainly has a lot of duplicated date logic and form state that would shrink significantly once it's sharing `daily_plans` state with the other modes. Split it as you migrate.

**Do not preserve all three pages' feature sets verbatim.** Audit what you actually use daily. If you haven't touched an "active experiments" reminder on the check-in page in a month, kill it and let experiments live in the Browse → Health section.

---

## Phase 4 — Make the agent infrastructure visible (~1–2 days)

You built HR agent + Trainer agent + `assistant_findings` + `assistant_rules` and none of it reaches the user. Right now it's a dev-panel feature. This is the single biggest waste in the codebase relative to how much effort it took to build.

**File: `src/features/assistant/components/AssistantDevPanel.tsx`** — keep for you, move behind the Me tab.

**New: surface findings proactively.**

1. **Insight card on Now** (already covered in Phase 1). Pull latest unread row from `assistant_findings`. Render with a "snooze" / "dismiss" / "open in Browse" action.
2. **Weekly digest.** Every Sunday evening, the HR agent runs a wider analysis and writes a `weekly_digest` finding. Push notification at 20:00 Sunday. Digest = 3–5 bullets: "You logged check-in 5/7 days", "Top 3 correlations: X → Y (r=0.6)", "2 tasks overdue > 7 days — auto-archive?".
3. **Trainer rule visibility.** When the trainer adds a new NL rule based on your phrasing, show a small toast the next time the rule fires: "Learned: 'boodschap' → shopping list. [Keep] [Undo]". One-tap rejection prevents the agent from silently shaping your phrasing space.

**Files: `supabase/functions/hr-agent/analyzer.ts`, `supabase/functions/hr-agent/findings-writer.ts`**

- Add a `user_visible: boolean` column to `assistant_findings` (migration needed). Not every finding should be shown — usage trends and error clusters are for you as the dev, but correlation insights and habit trends are for the user. Tag them at write-time.
- Add a `severity` field (`info | nudge | urgent`) so the frontend can style them.

---

## Phase 5 — Settings consolidation (~0.5 day, low risk)

**File: `src/App.tsx`** — the `SETTINGS_MODALS` map has 13 entries. Each page has its own gear icon doing something different. This is unusable on a daily basis.

- **Delete all 13 SettingsModal imports.** Move their content into one `SettingsPage` at `/me/settings`, organized by feature section with collapsible panels.
- The gear icon in the header goes away from per-page context. Settings is reached through the **Me** tab only.
- Exception: if a page has one setting that's frequently toggled (e.g., tracker "show in daily report"), put that toggle inline on the tracker card itself — don't hide it in a modal.

---

## Phase 6 — Unify the stuff model (larger, ~3–5 days, optional)

Currently you have `todos`, `smart_notes`, `checklists`, `strategies`, `goals`, `projects`, `study_sessions` — 7 tables for "things the user wrote down". They're legitimately different database-wise, but the user-facing capture should not make them decide up front.

**Minimal change** (do this first): a single **`captures`** view in Browse that pulls recent items from all 7 tables, sorted by creation time, filterable by type. The user captures → it lands in the right table via assistant routing → it shows up in `captures` regardless. This gives the *feel* of a unified inbox without migrating data.

**Larger change** (only if you confirm you want this): a polymorphic `items` table with a `type` column and a `payload` JSONB for type-specific fields. Strategies and notes could be the same table with a `category` flag. This is significant work (migrations, converters, hooks) — defer unless you find yourself capturing notes-that-should-be-tasks often.

---

## Cut list (delete these, they're not earning their space)

| File / area | Reason |
|---|---|
| `docs/adhd planning research.odt` (62KB) | Research artifact, belongs in a separate notes repo, not in the app |
| Tool tile grid on home (`HomePage.tsx` 211–235) | Replaced by Browse tab |
| `AssistantGuide.tsx` shown in chat | Move to a one-time onboarding screen, don't keep surfacing it |
| 13 per-page `*SettingsModal` files | Merge into SettingsPage |
| "Open full chat" link on home | Prompt bar should expand in place |
| Hub breadcrumb logic in `MainLayout.tsx` (15–31) | No hubs in the new IA |
| Context-aware bottom nav (MainLayout 67–169) | Fixed 4-tab nav, much simpler |
| `AssistantPromptBar` vs `AssistantChat` duplication of `COMMANDS` array and handler logic | Share via a common `useAssistantInput` hook |

---

## Suggested order of execution

Do these in order; each is independently shippable.

| # | Phase                           | Days | Risk | User impact |
|---|---------------------------------|------|------|-------------|
| 1 | Phase 5 — settings consolidation | 0.5  | low  | minor (but clears mental clutter for phases 2–4) |
| 2 | Phase 1 — Home becomes "Now"     | 1    | low  | high |
| 3 | Phase 2 — Unified capture        | 2    | med  | high |
| 4 | Phase 4 — Surface agent findings | 1–2  | low  | medium (compounds over time) |
| 5 | Phase 3 — Day view merge         | 3    | high | high |
| 6 | Phase 6 — Unified stuff model    | 3–5  | high | medium, optional |

Total realistic range for phases 1–5: **~8 working days**. Phase 6 only if needed after living with 1–5 for a few weeks.

---

## What I'm not sure about (answer these when you start)

1. **Voice capture priority.** A buddy on mobile lives or dies on voice input. Browser SpeechRecognition works on iOS PWAs but is flaky. Worth the investment, or is text enough?
2. **Notifications.** You have VAPID + `scheduled_notifications` wired. For the Insight card and weekly digest to matter, you need push actually delivering. Is push currently working end-to-end, or is that a separate rabbit hole?
3. **The 71KB `PlannerPage.tsx`.** Haven't read it in full. Before merging into Day view, check if there's a feature in there (AI-generated time blocks?) that's load-bearing for your actual daily use, or if it's aspirational scope.
4. **The HR/Trainer agents' current output quality.** If findings are mostly noise right now, surfacing them in the UI will hurt trust more than help. Check `assistant_findings` rows — are they actually useful? If not, Phase 4 needs a precursor: tune the analyzers before putting them in front of the user.

Answer those four before starting Phase 3, not before Phase 1. The first two phases are improvements regardless.
