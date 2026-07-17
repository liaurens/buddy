# Buddy Cove — the app's UI and daily loop

The Buddy Cove redesign (2026-07) replaced the whole presentation layer with a calm,
low-overwhelm UI around a whale mascot. Core principle: **one obvious next action,
everything else quiet.** The authoritative visual spec is
`design_handoff_buddy_cove/README.md` (final tokens, copy, behavior); the interactive
prototype is `design_handoff_buddy_cove/Buddy Cove.dc.html`.

## Purpose

The user's day is a loop the UI enforces gently:

1. **Morning check-in gate** — blocks every route once per calendar day (skippable
   only via an explicit text button). Steps: Comms checklist → Yesterday mood/energy
   → Plan (protocols, one-word intention, auto-picked ≤3 tasks, folded school
   deadlines). Normal/Survival toggle (survival = 1 pick, hushed notifications).
2. **Now** — whale + state-driven speech bubble, streak/done/intention chips, the
   picks (confetti on completion), a midday reset card (12:00–18:00, dismissible),
   capture pill, and a "More" fold hiding routine progress + week bars + 3 stats.
3. **Close-day overlay** — Phase A: every unfinished pick gets an explicit decision
   (→ Tomorrow / Done-but-follow-up / Rename / Let it go — nothing carries over
   silently). Phase B: mood/energy + one line (+ folded full questions). Phase C:
   celebration with the streak.

Tasks (one-at-a-time triage), Capture (dump box, invisible AI sorting), Browse
(2-col grid to everything else), and Me (quiet settings) complete the 5-tab nav.
**No badges or counts anywhere in nav.**

## Key files

| Area | Files |
| --- | --- |
| Tokens / motion | `src/index.css` (`--cove-*`, `.app-*`, `.cove-*` keyframe classes), `tailwind.config.js` (`cove.*`), Nunito via `@fontsource/nunito` in `main.tsx` |
| Shell | `src/layouts/MainLayout.tsx` (520px column, 5-tab nav, `navHidden` while gated) |
| Primitives | `src/features/cove/components/` (Whale, SpeechBubble, Fold, Confetti, PickCircle, MoodRow, EnergyRow, TagChip) + `hooks/useCelebration.ts` |
| Gate | `src/features/cove/gate/` (CheckInGate, StepChips, CommsStep, YesterdayStep, PlanStep, gateState, useCheckinStatus) + `services/checkin.service.ts` |
| Now | `src/features/cove/now/` (NowPage, MoreFold, whaleCopy, middayVisibility) |
| Close-day | `src/features/cove/closeday/` (CloseDayOverlay, leftoverResolution) + streak in `src/features/planning/services/closeDay.service.ts` |
| Tasks / Capture | `src/features/cove/tasks/CoveTasksPage.tsx`, `src/features/cove/capture/CoveCapturePage.tsx` |
| Mood scale | `src/features/cove/services/moodScale.ts` + `moodEnergy.service.ts` |

## Data model

All persistence reuses existing tables; one migration added gate columns:

- `daily_plans` (one row per user per date): `checked_in_at`, `checkin_skipped`,
  `intention` (migration `20260716000001_checkin_gate.sql`), plus the pre-existing
  `capacity`, `closed_at`, `mood_at_plan_time`, `energy_at_plan_time` (1–10 CHECK —
  the gate/close-day are the first writers, always via `moodScale.ts`).
- Picks = `todos` with `plannedFor = today` (`useTodayItems`); all task writes go
  through the existing single write path (`persistTaskUpdate` / `applyTriage`).
- Reflection lines → `assistant_learnings` (`saveReflectionItems` subtypes);
  streak **derived** from consecutive `closed_at` days (`computeCloseStreak`) —
  never stored.
- localStorage: `cove_checkin_<date>` (gate mirror), `cove_midday_dismissed_<date>`,
  `routine_done_{phase}_<date>`. sessionStorage: gate step/comms/intention per date.

## Flow

See [diagrams/cove.md](diagrams/cove.md) for the daily-loop sequence.

## Gotchas

- Confetti/bob/spout/checkpop disable under `prefers-reduced-motion` (CSS classes
  + `useCelebration` never arming).
- The gate must not block `/oauth/google/callback` or the login screen; `?route=`
  deep-link params survive gate completion (state is held in App, not the URL).
- `rescheduleMany` silently skips locked tasks — close-day "→ Tomorrow" relies on it.
- Follow-up tasks created in close-day are intentionally untriaged (they land in
  the capture inbox for Buddy to sort).
- Legacy power tools live on: full TodoPage behind "⋯ tools" on Tasks, assistant
  chat at the `assistant` route (Me → Account & advanced), analysis behind
  "Explore my data" on Health. Experiments UI is parked (route still resolves).
- Deleted: HomePage, DayPage, CaptureFAB (voice capture has no home right now).
  Several `src/features/day/` components are orphaned — cleanup candidates.
