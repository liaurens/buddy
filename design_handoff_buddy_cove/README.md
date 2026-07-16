# Handoff: Buddy Cove — full UI redesign of the Buddy app

## Overview
A calm, low-overwhelm redesign of the Buddy app (ADHD/autism life helper, repo `liaurens/buddy`) around a friendly animated whale mascot. Core principle: **one obvious next action, everything else quiet** — a mandatory morning check-in gate, a Now screen with max 3 picks, one-at-a-time inbox triage, and a close-day flow where unfinished tasks must be explicitly resolved.

Implement this as a new branch (e.g. `redesign/buddy-cove`) in the existing React + TypeScript codebase, reusing the existing feature logic (`src/features/day`, `src/features/tasks`, etc.) and replacing the presentation layer.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, NOT production code to copy. Recreate them in the repo's existing environment (React + TS + the existing styling approach), wired to the real stores/hooks that already exist. The prototype's demo state (hardcoded picks, fake streak) maps to real data sources noted below.

- `Buddy Cove.dc.html` — the full prototype (all screens + flows). Open in a browser; interactive.
- `Feature Map.dc.html` — agreed feature placement doc (FRONT / ONE TAP / FOLDED / QUIET).
- `Buddy Redesign.dc.html` — earlier explorations (context only; direction "1b" won).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, shadows and copy are final and should be matched closely. Phone-first (max-width 520px shell centered on desktop; on laptop the shell stays centered on the `#dcebf3` backdrop).

## Design Tokens
Font: **Nunito** (Google Fonts), weights 400/600/700/800/900. Base text color `#1d3a4d`.

Colors:
- App background `#e9f4f9`; page backdrop behind shell `#dcebf3`; cards `#fff`
- Ink/primary dark `#1d3a4d`; secondary text `#5c86a0`; muted `#7fa6bb`; faint `#9cb9c9`
- Accent blue `#4d9fd6` (whale, active nav, primary buttons); light blue `#7cc3e8`; pale `#bfe2f5`
- Success green `#5cb586` (checks), deep green `#3d8a63`; streak orange `#f2a541` / `#e0862a` / text-on-amber `#c07a1e`
- Tints: amber `#fdeeda`, blue `#e3f0fa`, green `#e6f4ec`, purple `#efe9f8` (+`#7a5fb0`), pink `#fbe9ec` (+`#e8899a`), pink accent `#f7b8c2`
- Inactive borders `#bcd8e8` / `#c6dbe7`; close-day overlay bg `#1d3a4d`, its muted text `#a8cbde`

Shape & depth: cards radius 16–22px, buttons 11–20px, chips pill (999px); shadow `0 3px 12px rgba(40,90,130,.09)`; nav bar `border-radius 26px 26px 0 0` + `0 -4px 16px rgba(40,90,130,.08)`.

Type scale: screen titles 900/22px; card titles 800/14.5–15px; body 600–700/13–14px; section labels 800/13px uppercase, letter-spacing .08em, color `#7fa6bb`; chips 800/11–12.5px.

Animations: `bob` (whale, translateY 0→-5px, 3.5s ease-in-out infinite), `spout` (bubbles, staggered opacity/rise), `checkpop` (scale .6→1.25→1, .35–.4s), `confetti` (6 particles translate to per-particle offsets + rotate 220deg, .75–.95s), `fadeslide` (opacity 0/translateY 10px → visible, .3–.4s, on every screen change), `overlayin` (fade, .35s). **Respect `prefers-reduced-motion`: disable confetti and bob.**

Whale mascot: inline SVG (see prototype) — body ellipse accent color, belly `#bfe2f5`, tail rotated ellipse, eye `#173042`, pink cheek `#f7b8c2` at 70%, spout bubbles `#7cc3e8`. Sizes: 86×70 (Now hero), 76×62 (gate), 110×90 (close-day).

## Screens / Views

### 1. Morning check-in gate (replaces DayPage light routine as app entry)
**The whole app is gated behind this, once per day.** If today's check-in isn't done, every route renders the gate. Skippable only via explicit "Skip the check-in today" text button. Persist done/skipped per calendar day (the existing routine store; prototype uses a per-day localStorage key).
- Header: bobbing whale (76×62) + greeting (time-aware: "Good morning" / "Hi — starting fresh." / "Evening — better late than never.") + subline; after 12:00 subline says the check-in still comes first.
- **Normal day / Survival day** segmented toggle (track `#d7e9f2`, active segment white card w/ shadow). Survival: green info card "one task is enough today", picks list becomes 1, gentle copy everywhere.
- 3 step chips with connector lines: **Comms → Yesterday → Plan** (active = accent bg/white; done = `#d3ecdd`/`#3d8a63` with ✓; future = `#d7e9f2`/`#7fa6bb`). Chips are tappable; "Next →" (accent) advances; final step has "Start my day →" (green `#5cb586`).
- Step 1 Comms: checklist cards (mail, school portal, messengers, bank — from user's existing comms routine config).
- Step 2 Yesterday: mood row (5 dots: rough `#e8899a`, meh `#f2a541`, okay `#7cc3e8`, good `#5cb586`, great `#3d8a63`; selected = dark ring + tinted bg) + energy Low/Med/High buttons (selected = dark bg, white text). Writes to the existing daily-log store.
- Step 3 Plan: protocols/meds checklist; "One word for today (optional)" input (`#eef6fa` field); read-only "Your three picks" card (auto-picked, smallest first; swap on Tasks); **folded "School deadlines (2) ⌄"** text button → unfolds card listing upcoming school deadlines (title + due; nearest due amber). Folded by default, always.

### 2. Now (home)
- Whale hero (86×70) + white speech bubble (radius `18px 18px 18px 4px`): greeting line + status line reacting to progress ("One small thing at a time. Ready?" / "1 down, 2 to go. No rush." / "Everything done. I'm so proud of you!").
- Chip row: streak (orange diamond + "4-day streak"), done-today (green dot), intention chip if set ("today: rest", blue dot).
- **Midday reset card** (amber `#fdeeda`), only 12:00–18:00, only if not all done and not dismissed: "Midday reset — how's it going?" + progress line + buttons "All good ✓" (dark) / "Adjust picks" (→ Tasks).
- "TODAY'S THREE" (or "JUST ONE TODAY" in survival): pick cards — 34px circle checkbox (empty: 2.5px `#bcd8e8` border; done: green with white ✓ + checkpop), title 800/15px (done → struck color `#9cb9c9`), tag chip (quick win=amber, school=blue, tiny=green). Tapping anywhere toggles; on completion 6-particle confetti bursts from the checkbox.
- When all picks done: dark primary button "Close the day with Buddy ✓". **Always also available**: outlined subtle button "Close the day anyway — we'll sort the rest together" (2px `#c6dbe7` border, `#5c86a0` text) when tasks remain.
- Capture pill "＋ Tell Buddy anything…" → Capture screen.
- "More — routine & stats ⌄" folds open: Daily-routine card (morning ✓ / midday / evening states), Your-week bar chart (7 bars, today = accent, empty days 6px stubs, insight line below), and a 3-stat row (done this week / day streak / routines kept). **No stats visible unfolded — keep Now minimal.**

### 3. Tasks
- Title + "Only what needs you. The rest is parked safely."
- **Inbox triage** (amber card): "N to sort — one at a time", showing exactly ONE item (white inner card) + three buttons: Today (dark) / Later (white) / School (white, blue text). Sorting reveals the next. Empty → green "Inbox empty — everything is sorted ✓".
- TODAY list: same checkbox rows, compact (28px circle), time label right; items sorted from inbox get a blue "new" chip.
- "Someday (2) — parked safely ⌄" folded; unfolds translucent rows. Someday items never show a count badge anywhere else.

### 4. Capture
- "Dump it here. Buddy sorts it — you don't have to decide now."
- Input card + accent "Capture it" button (Enter submits). New items appear under "SORTED BY BUDDY" with an auto tag (school/someday/reminder/today — real impl: existing AI assistant categorization; the assistant has **no separate chat UI**, it lives behind capture).

### 5. Browse
2-col grid of cards (icon tile + label + one-line desc): School, Calendar, Health, Notes, Focus timer, Checklists, Toolbox, Reflect. These route to the existing feature pages, restyled to these tokens. Per the agreed feature map: deep health analysis/experiments stay parked for now.

### 6. Me
Profile card + rows: Notifications & anchors, Quiet hours, Routine items (comms, meds), Google Calendar (status), Account & advanced. **No badges/counts anywhere in nav or Me.** (Prototype also has a demo-only "Reset day" button — don't ship.)

### 7. Close-day flow (full-screen overlay, `#1d3a4d`)
Layout: flex column, `align-items:center`, `justify-content: safe center`, `overflow-y:auto` (must not clip when content exceeds viewport).
- **Phase A — Leftovers** (only if unfinished picks exist): "Before we close…" + "N tasks didn't happen today — that's okay. Nothing carries over silently — decide for each one." Per task a translucent card (rgba(255,255,255,.08)) with 2×2 buttons:
  - **→ Tomorrow** (white/primary): reschedule to tomorrow's picks.
  - **Done, but…**: inline input "what's the follow-up task?" → marks done + creates the follow-up in inbox (green "Done ✓ + follow-up").
  - **Rename**: inline input prefilled with title → "Save → tomorrow" (rename + reschedule).
  - **Let it go** (pink text): delete.
  Cards resolve one by one; when none remain, auto-advance to Phase B. "Not yet" exits.
- **Phase B — Reflection**: whale + "Closing the day" + summary ("2 of 3 picks done · routine kept"); card with today's mood row (dark-styled), Energy Low/Med/High, "One line about today (optional)", and folded **"More reflection — the full questions ⌄"** → What went well? / What was hard? / What would make tomorrow easier? (existing reflection store fields). White "Close the day ✓" / "Not yet".
- **Phase C — Celebration**: 8-particle confetti + bobbing whale + "Day closed. You did it." + summary + "streak is now N days" (orange) + note line of what was resolved ("1 moved to tomorrow · 1 let go") + "Good night, Buddy 🌙".

### Bottom nav (fixed, all main screens)
White rounded-top bar, 5 items: Now, Tasks, Capture (+ circle), Browse (2×2 grid glyph), Me. Active = accent-filled glyph + `#1d3a4d` label; inactive = `#c6dbe7` outline glyph + `#9cb9c9`. Labels always visible. **Never any badge.** Bottom padding 26px (safe-area: use `env(safe-area-inset-bottom)`).

## Interactions & Behavior
- Screen changes animate with fadeslide (.35s). Checkbox completion: checkpop + confetti (skip when reduced-motion or a "celebrations" setting is off).
- Gate: shown when no check-in record for today; both finish and skip write the record.
- Midday card: dismissal persists for the day.
- Close-day: leftover resolution rules above; closing increments streak and writes the daily log.
- Whale speech bubble copy is state-driven; keep sentences short, warm, never guilt-inducing ("that's okay", "no rush").

## State Management (map to existing stores)
- `checkInDoneForDay(date)` + step data (comms checks, yesterday mood/energy, meds, intention, capacity normal|survival) → day/routine feature.
- Picks (max 3, 1 in survival) with done state → tasks feature; leftover resolutions: reschedule / rename+reschedule / delete / complete+spawn-follow-up.
- Inbox queue (triage one at a time), someday list, streak counter, week completion counts, midday-dismissed flag, close-day record (mood, energy, journal, extended answers).

## Agreed feature placement (from Feature Map)
FRONT: check-in gate, Now, midday reset, close-day, capture+triage, survival day. ONE TAP (Browse): tasks, school, calendar, health, notes, focus timer, checklists/toolbox. FOLDED: protocols→gate, reflection→close-day, urgent-scheduling→triage, stats→"More". QUIET: notifications settings, AI power tools, dev panels. Decisions: light morning routine only; school deadlines folded in gate step 3; deep health analysis parked; assistant chat fully folded into Capture.

## Assets
No binary assets. Whale = inline SVG (copy from prototype). Font via Google Fonts (self-host for production/PWA).

## Files
- `Buddy Cove.dc.html` — full interactive prototype (single file; template markup + a `Component` logic class at the bottom mirror the intended component tree and state).
- `Feature Map.dc.html` — feature placement doc.
- `Buddy Redesign.dc.html` — earlier direction explorations (reference only).
