# End-of-Day Review Slimming + Journal Tab — Design

**Date:** 2026-07-18
**Status:** Approved, ready for planning

## Summary

Split the day's reflection surface into two clearly separated experiences:

1. **End-of-day review** — the fast close ritual (`CloseDayOverlay`), trimmed to **2 basic questions** plus an **Extend →** button that jumps to the full journal page.
2. **The journal** — the `ReflectionPage`, restructured with two tabs: **Reflect** (the existing deep reflection form) and a new **Journal** tab that reads like an actual diary showing the core memory of every day.

All work stays inside the existing **Buddy Cove** design system — reusing `--cove-*` tokens, `.app-*` classes, and the shared primitives (`MoodRow`, `EnergyRow`, `Whale`, etc.). No new visual language is introduced.

## Motivation

Today the `CloseDayOverlay` "reflect" phase asks mood + energy + a one-line + a fold with three more questions. It is doing double duty as both the quick nightly close and the deep reflection, which makes the close heavier than it should be. Meanwhile the deeper reflection already has a home (`ReflectionPage`) that also hides a small collapsible 14-day journal read-back. This design separates the two: keep the close fast, and give the journal a real diary view.

## Part 1 — Slimmed end-of-day review (`CloseDayOverlay`)

The three-phase overlay (leftovers → reflect → celebrate) is unchanged except for the **reflect** phase. Leftover resolution and the celebration phase stay exactly as they are.

### Reflect phase — 2 questions

- **Q1: Mood + Energy** — the existing `MoodRow` / `EnergyRow` dark-variant tap rows. Saved to `daily_plans.mood_at_plan_time` / `energy_at_plan_time` on tap via `saveMoodEnergy` (through `moodScale`), exactly as today.
- **Q2: One line about today** — the existing single text field (`journalLine`).

**Removed:** the `Fold` ("More reflection — the full questions") and its three inputs (`workedLine`, `hardLine`, `easierLine`). Those deep prompts now live only on the journal page's Reflect tab.

### Buttons

- **`Close the day ✓`** (primary, unchanged) → save + `closeDay` + `markRoutineDone('night')` → **celebrate** phase.
- **`Extend →`** (new secondary) → performs the *same* save and close (streak locked in, `markRoutineDone('night')`), but **skips the celebrate phase** and instead navigates to the journal page (`reflection` route), landing on the **Reflect** tab so the user can keep writing.
- **`Not yet`** (unchanged) → dismisses the overlay without closing.

### Save behavior (both Close and Extend)

`finishClose` is refactored so both the normal close and the extend path share one save routine:

1. `saveReflectionItems(user.id, dateKey, [{ subtype: 'reflection_memory', text: journalLine }])` — only the memory line now (the win/challenge/priority items are no longer collected in the overlay).
2. **New:** when `journalLine` is non-empty, also `saveJournalEntry({ date: dateKey, prompts: [{ promptId: 'core_memory', question: "Today's core memory", answer: journalLine.trim() }], wins: [] })`. This mirrors what `ReflectionPage` already does and is the key data-flow fix — without it, quick closes never reach the Journal feed.
3. `closeDay(user.id, dateKey)` + `markRoutineDone('night', dateKey)` + streak invalidations (unchanged).

Then: Close → set `celebrate` phase; Extend → call the new navigation prop.

### Wiring

- `CloseDayOverlay` gains an `onNavigate: (tab: AppRoute) => void` prop.
- `NowPage` already receives `onNavigate` and renders `CloseDayOverlay`; it passes `onNavigate` down. The `Extend →` handler closes the overlay (`onClose`) and calls `onNavigate('reflection')`.

## Part 2 — Journal page tabs (`ReflectionPage`)

Add a Cove-styled segmented tab bar directly under the page header (which keeps the title + date picker + settings). Two tabs, controlled by local `useState<'reflect' | 'journal'>('reflect')`:

- **Reflect** (default) — every piece of the current page **except** the collapsible `JournalCard`, which is **removed** (now redundant with the Journal tab). That means: sparkline, capture form, `CloseDayCard`, `SkillsLogCard`, goals check-in, `StrategySpotlightCard`, and the collapsible day-metrics section.
- **Journal** — the new memory feed (Part 3).

The tab bar uses existing tokens (e.g. a rounded segmented control on `--cove-*` surfaces, active segment filled, inactive muted), consistent with the rest of the Cove UI. Default tab is `reflect`; `Extend →` from the overlay lands here.

`JournalCard.tsx` becomes unused and is deleted (verify no other importers first).

## Part 3 — The Journal memory feed (new component)

A new presentational component (e.g. `src/features/planning/components/reflection/JournalFeed.tsx`).

### Behavior

- **Read-only.** No editing; writing happens only through the reflection form and the end-of-day review.
- **All-time**, newest first. Fetches `daily_journal_entries` across the full history using the existing `getJournalEntries({ from, to })` with a wide `from` (a fixed far-back date such as `2020-01-01`) and `to = today`. React Query, keyed per user.
- **Grouped by month** — a `groupEntriesByMonth` pure helper produces `{ label, entries }[]` (e.g. "July 2026") from the sorted entries. Month labels render as quiet section headers.

### Per-day card (Cove-styled: `.app-surface`, `shadow-cove`, `text-cove-*`)

- Date line, e.g. *Tuesday, Jul 14* (`format(parseISO(date), 'EEEE, MMM d')`).
- **Core memory** — shown prominently as the card's highlight (the `core_memory` prompt answer).
- **Gratitude** and **Challenge** — beneath, quieter styling, rendered only when present.
- Days with no core memory but other prompt content still render (memory area shows nothing rather than an empty highlight).

### Empty state

A `Whale` plus copy like "Your days will show up here as you close them." — celebratory/inviting, never shaming, consistent with the Cove tone rules.

## Data model

No schema changes. Everything reads/writes the existing `daily_journal_entries` table (`prompts` JSONB of `{ promptId, question, answer }`, plus `mood_rating`, `energy_rating`, `wins`). The only new write is the overlay mirroring its one-liner into `core_memory`, using the existing `saveJournalEntry` operation.

Mood/energy are intentionally **not** shown in the feed for this iteration: the daily mood/energy lives on `daily_plans`, not on the journal entry, and the chosen feed scope is core memory + gratitude + challenge. Pulling per-day mood/energy into the feed is a possible later enhancement, explicitly out of scope here.

## Components & boundaries

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `CloseDayOverlay` (edit) | Fast close: leftovers → 2-question reflect → celebrate/extend | `saveReflectionItems`, `saveJournalEntry`, `closeDay`, `markRoutineDone`, `onNavigate` |
| `NowPage` (edit) | Passes `onNavigate` into the overlay | `CloseDayOverlay` |
| `ReflectionPage` (edit) | Tab shell + Reflect tab content | `JournalFeed`, existing reflection cards |
| `JournalFeed` (new) | Read-only all-time memory feed, grouped by month | `getJournalEntries`, `groupEntriesByMonth` |
| `groupEntriesByMonth` (new pure helper) | Group sorted entries into month sections | — |
| `JournalCard` (delete) | (removed — superseded by `JournalFeed`) | — |

## Error handling

- Overlay save/close failures keep the current pattern: catch, `toast.error`, stay on the reflect phase (do not navigate on Extend if the save/close throws).
- `JournalFeed` handles React Query `isLoading` / `error` states with quiet Cove-styled messages; a fetch error shows a friendly "Could not load your journal" line rather than crashing the tab.

## Testing

- **Unit (vitest):** `groupEntriesByMonth` — ordering, month bucketing, empty input, single/multiple months. Lives alongside existing planning tests.
- The overlay refactor and tab switching are presentational; covered by manual verification (drive the close flow + tab switch in the running app per the repo's verify workflow). No new logic branch there warrants a dedicated unit test beyond the helper.

## Out of scope (YAGNI)

- Editing journal entries from the Journal tab.
- Mood/energy display in the feed.
- Free-form (blank-page) journaling separate from the structured prompts.
- Search / filtering the journal.
- Pagination/infinite scroll (all-time load is acceptable at current data volumes; revisit if entry counts grow large).
