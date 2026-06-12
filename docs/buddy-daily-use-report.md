# Buddy — Daily-Use Report

**Scope:** Why the app isn't being used consistently, and what changes would most increase the probability of daily use. Based on a full read of the repository as of commit `eda309e` (README, PROJECT_DESCRIPTION.md, CLAUDE.md, docs/buddy_streamlining_plan.md, docs/five_pillars_plan.md, source code, edge functions, commit history Jan–May 2026).

---

## 1. Where one assumption in the request is wrong

The request asks for "more integration and better overall experience" to drive daily use. The repository's own history contradicts the implied premise that adding capability increases use. Between January and May 2026 the app gained: a growth hub with XP/levels/titles, per-task reminders, an off-track scanner, task types and routines, a school module with AI PDF import, goals, projects, study sessions, and a three-tier self-improving assistant. Usage did not follow. Both existing planning documents in `docs/` already diagnose this — the streamlining plan opens with "the home screen is a launcher with 11 tiles" and the five-pillars plan exists because the five core surfaces weren't trustworthy.

Daily use of a personal tool is a habit-formation problem, not a capability problem. A habit needs three things: a reliable external **trigger**, a **low-friction action**, and a **visible reward/closure**. The codebase is strong on action (capture is genuinely good now) and weak on trigger and closure. More features will not fix a missing trigger. The recommendations below are therefore mostly not new features — several are about finishing, wiring, or removing things.

---

## 2. Current state, verified against the code

The streamlining plan's phases are in this state: Phase 1 (Now layout) done — `HomePage.tsx` is now 83 lines with prompt bar, NextUpCard, TodayCard, InsightCard, RecentCaptures. Phase 2 (unified capture) done — shared `CaptureInput` with brain-dump, voice draft, route-preview ghost chips, backend-sourced command list. Phase 5 (settings consolidation) done. Phase 3 (Day view merge) is scaffold only, blocked on the 71 KB `PlannerPage.tsx` audit. Phase 4 (agent visibility) is partial — InsightCard is live, but the weekly digest and trainer-rule toasts are explicitly "deferred pending end-to-end push verification." Phase 6 (unified stuff model) untouched.

That deferral note is the single most important sentence in the repo. It means the trigger layer of the entire product — push notifications — has never been verified working end-to-end. The same open question appears verbatim at the bottom of the streamlining plan ("Is push currently working end-to-end, or is that a separate rabbit hole?") and was never answered.

Other verified gaps:

`NextUpCard` reads from `useTasks` (the `todos` table) and calendar; `TodayCard` queries `calendar_events`. Neither reads the `assignments` table. School deadlines — for a student, the highest-stakes daily content in the app — do not appear on the Now page. They only surface inside the School module and the `SchoolPlanningPicker` in the Day flow. PROJECT_DESCRIPTION.md §16 lists "better integration between school assignments and the main task planner" as a future opportunity, confirming this is a known hole.

`TodayCard` contains no overdue-task logic (no reference to overdue or to `todos` due-date buckets in the component). The five-pillars plan flagged exactly this ("`TodayCard.tsx` counts `due_date = today` only; misses overdue") and prescribed a fix; it does not appear to have shipped to this card.

There is no offline capture queue. The PWA caches the app shell (`vite-plugin-pwa`, `registerType: 'autoUpdate'`), but a capture submitted without connectivity fails — there is no IndexedDB outbox or replay logic anywhere in `src/services` or the assistant feature. PROJECT_DESCRIPTION.md §13 states offline behavior should prioritize "avoiding data loss on capture where possible"; the code does not implement it.

The daily loop has no defined end state. Reflection exists (`ReflectionPage`, night routine), but nothing closes the day — no "day complete" state, no streak of completed days, no reason to return in the evening other than self-discipline, which is the exact resource the app's target user (per §2.1 of the project description) lacks.

Calendar integration is read-only iCal polling through `calendar-proxy`. There is no two-way sync, so the planner's time blocks never appear in the calendar the user actually looks at (phone calendar), and the app's plan competes with rather than inhabits the user's existing time surface.

The AI-dependent paths (tier-3 assistant routing, plan generation, school import) require a user-supplied API key configured in Settings. There is no non-AI fallback for plan generation. If the key lapses or errors, the morning-planning path degrades to nothing rather than to a heuristic plan.

There is no usage instrumentation for the app itself. `assistant_logs` records assistant interactions in detail, but nothing records app opens, route visits, or surface engagement. The current situation — "I don't know why I'm not using it" — is partly a measurement gap: there is no data to distinguish "never opens the app" from "opens it, finds nothing actionable, leaves."

---

## 3. Why daily use fails — causal chain

The failure mode, reconstructed from the above: nothing external prompts an open (push unverified). When an open does happen, the Now page omits the most consequential items (assignments, overdue tasks), so the surface under-reports reality and trust erodes — the five-pillars plan's own phrase is "tasks overview that you can trust at a glance," and the home surface currently doesn't meet that bar for a student. Capture away from the desk is fragile (no offline queue; PWA must be foregrounded; the iPhone shortcut works but is a parallel path the user must remember). The day never formally ends, so there is no completion reward and no anchor for the evening return visit. Meanwhile, roughly half the modules (growth XP, experiments, protocols, toolbox, strategies) impose ambient complexity — they widen Browse, the assistant tool registry, and the maintenance surface — while contributing nothing to a normal day. The product loop in §1 of the project description is `capture → organize → plan → act → log → reflect → learn → adapt`; in practice the chain currently breaks at `act` (no re-entry trigger) and at `reflect` (no pull back into the app).

---

## 4. Recommendations, in priority order

The ordering principle: fix the trigger first, then make the first screen truthful, then remove friction, then close the loop, then cut weight. Items 1–4 are prerequisites for everything else mattering.

**1. Verify and anchor push notifications (highest priority, blocking).**
Answer the open question from your own plan. Test the full chain: `scheduled_notifications` → cron → `send-notification` → service worker → deep link, on the actual phone, installed PWA. Then add two *time-based* anchor notifications that work from day one because they don't depend on behavior data: a morning nudge (~start of day: "Plan today — 2 due, 1 overdue") and an evening nudge (~21:00: "Close the day — 90 seconds"). Both deep-link to the Day view. Known platform constraint to verify against: iOS only delivers Web Push to PWAs added to the home screen (iOS 16.4+), and subscriptions can be dropped — build a subscription-health check into the Me page so a silently dead subscription is visible. Until this works, Phase 4's digest, the off-track scanner, and per-task reminders are all dead infrastructure.

**2. Make the Now page tell the truth: merge assignments and overdue into Next Up / Today.**
Extend `useNextUp` to consider `assignments` (pending/in-progress with nearest deadline) alongside `todos` and calendar events, and fix `TodayCard` to show `N overdue · M due today · K assignments due ≤7d`, with overdue rendered as the primary line when non-zero. This is a query/merge change, not a schema change — the converters and hooks already exist (`useAssignments` is already used in `SchoolPlanningPicker`). This is the single highest-leverage *content* change: the first screen must never under-report a deadline, or the user correctly learns the app can't be trusted and routes around it. Longer term, decide whether assignments auto-generate linked `todos` (one source of truth for "what do I act on"), but the merged read is enough to start.

**3. Offline capture outbox.**
IndexedDB queue: capture writes locally first, syncs when online, replays on reconnect, shows a "pending sync" badge. Without this, every capture attempt in a train/lecture hall/elevator is a coin flip, and one lost capture teaches the brain not to rely on the inbox. This directly implements the stated-but-unbuilt requirement in PROJECT_DESCRIPTION §13. Scope: capture only, not full offline CRUD.

**4. Define "day done" and reward it.**
Evening flow ends in an explicit completion state: a one-tap "Close day" after the night reflection that (a) marks the `daily_plans` row closed, (b) shows tomorrow's top item, and (c) increments a low-pressure continuity indicator — days-closed-this-week, not a streak that punishes a miss (the project's own guardrail: "do not add motivational mechanics that create shame"). This gives the evening notification from item 1 something to land on and gives the loop a reward.

**5. Reduce capture distance from the OS.**
Facts first: a PWA cannot provide iOS home/lock-screen widgets, and HealthKit is not accessible from a web app — don't plan around those. What is available: (a) add `share_target` to the web manifest so installed-PWA users (Android fully; iOS partially) can share text/URLs straight into capture; (b) promote the existing quick-note/assistant Shortcut into the primary mobile entry — Back Tap and an Action-Button/Lock-Screen Shortcut both can hit the `quick-note`/assistant endpoint, and commit `e88307b` already routes the Shortcut through the assistant with flags, so the backend is done — the gap is setup friction and habit, which the in-app docs partially address; (c) optional later: an iOS Shortcuts *automation* that POSTs Apple Health samples (sleep, steps) to an edge function nightly, eliminating the highest-decay manual entry in health tracking. If PWA limits keep hurting, the structural escape hatch is wrapping in Capacitor for real widgets/HealthKit — significant work, decide only after 1–4 are live.

**6. Two-way time integration instead of a parallel planner.**
Minimum version: publish the app's time blocks/deadlines as an iCal feed URL the phone's calendar subscribes to (read-only export is far cheaper than CalDAV write and avoids OAuth). Result: the plan made in Buddy appears where you already look for your day, instead of requiring a second glance surface. This converts the planner from a competing calendar into a layer on the existing one.

**7. Non-AI degradation for the daily path.**
Plan generation should fall back to a deterministic heuristic (the `taskRecommender` scoring already encodes the ranking logic: overdue → today → deadline proximity → priority, packed into stated available hours) when no key is configured or the provider errors. The project's own guardrail says "do not make AI mandatory for basic workflows"; today the morning plan violates it.

**8. Instrument before cutting.**
Add a minimal `app_events` log (app open, route visit, capture submitted, day closed) — a single table and a tiny hook. After two weeks you will know which Browse modules are actually touched. Then apply the existing cut-list discipline: anything untouched in 30 days (likely candidates based on the code: XP/levels/titles, experiments, protocols, toolbox) gets frozen behind Browse — kept in the database, removed from the assistant tool registry's hint surface and from any daily-path UI. This shrinks the assistant's routing space (cheaper, more accurate tier-3) and the app's perceived weight without deleting data.

**9. Finish Phase 4 (agent visibility) only after item 1.**
The weekly digest and trainer-rule toasts were correctly deferred. Once push is verified, ship the Sunday-evening digest exactly as specced in the streamlining plan — it's the feature that makes weeks of logging feel like it paid off, which is the long-term retention mechanism. Per the plan's own caveat, check `assistant_findings` quality first; surfacing noise costs more trust than it builds.

**10. Phase 3 (Day view merge) stays where your plan put it: after the above.**
It's the highest-risk refactor (71 KB `PlannerPage.tsx`) and it improves a flow the user only reaches *after* the trigger problem is solved. Do not start it before items 1, 2, and 4 are live.

---

## 5. Sequencing and effort

| # | Change | Effort | Dependency |
|---|--------|--------|------------|
| 1 | Push verification + 2 anchor notifications | 1–2 d (unbounded if broken) | none |
| 2 | Assignments + overdue on Now | 1 d | none |
| 3 | Offline capture outbox | 1–2 d | none |
| 4 | "Close day" state + continuity indicator | 1 d | 1 (for evening nudge) |
| 5 | share_target + Shortcut as primary entry | 0.5–1 d | none |
| 6 | iCal export feed | 1 d | none |
| 7 | Heuristic plan fallback | 0.5 d | none |
| 8 | app_events instrumentation → freeze unused modules | 0.5 d + 2 wk wait | none |
| 9 | Weekly digest + rule toasts | 1–2 d | 1 |
| 10 | Day view merge (Phase 3) | 3 d, high risk | 1, 2, 4 |

Items 1–5 total roughly one working week and address the trigger, truth, friction, and closure failures directly. Items 6–9 compound retention. Item 10 is polish on a flow that only matters once people arrive at it.

---

## 6. Success criteria

Measurable within four weeks of shipping items 1–5, using the instrumentation from item 8: app opened ≥5 days/week; ≥60 % of opens originate from a notification deep link or Shortcut (proving the trigger works); zero captures lost offline; "day closed" ≥4 days/week; no deadline (todo or assignment) due within 48 h absent from the Now page at any time. If after four weeks opens are happening but evening closure isn't, the problem is the reflection flow (revisit item 4's content); if opens aren't happening at all, the problem is still notifications (revisit item 1) — the instrumentation makes the two distinguishable, which they currently are not.
