# Buddy: From Capable to Used

## A daily-use improvement report based on the actual routine, the AuDHD research, and the current product state

---

## 1. The core diagnosis

The June 2026 audit already identified the right frame: daily use is a habit problem (trigger → low-friction action → closure), not a capability problem. This report sharpens that with two inputs the audit didn't have: your actual daily routine, and which features you actually use.

The honest reading of those two inputs is this: **Buddy is still designed around an idealized day, while your real day has exactly two phone windows and a hard phone cutoff at night.** The app's daily loop (capture → organize → plan → act → log → reflect → learn → adapt) has eight stages. Your observed usage covers three: Shortcut capture, picking a few small tasks, and the daily reflection. That is not a failure of discipline — it is the system telling you what the minimum viable loop actually is. The AuDHD literature you collected predicts exactly this: monotropic attention and dopamine economics mean any step that doesn't pay for itself immediately gets dropped, and PDA means any step that feels like an imposed demand gets actively avoided.

The strategic conclusion: stop treating the unused 80% as features waiting to be adopted. Treat the used 20% as the product, and rebuild the daily experience around it.

---

## 2. Your routine is the real product spec

Mapping the routine to app opportunity:

| Routine moment | Phone available? | What it means for Buddy |
|---|---|---|
| Wake → go downstairs | Yes, immediately | The phone is the *first object of the day*. The ~40 min morning scroll is a guaranteed, daily, high-availability window. |
| Breakfast (phone or dog) | Partially | Secondary morning window. |
| School / gym | Pocket only | Capture-only territory. The Shortcut is the right tool here; nothing else should expect attention. |
| Work | Pocket only | Same: capture-only. |
| Evening: eat + short phone session | Yes, briefly | The *only* evening window. Short. This is where close-day must land. |
| Phone goes downstairs | No | Hard cutoff. Anything scheduled after this moment is dead on arrival. |

Three consequences follow directly:

**First, the morning anchor notification is competing with the wrong thing.** It doesn't need to get you to pick up the phone — you already do that within minutes of waking. It needs to win the *first 90 seconds of the scroll*, before Reddit/YouTube/whatever captures the session. That changes its design: it should fire at (or just before) your typical wake time, sit at the top of the lock screen, and deep-link into a flow that completes in under two minutes. The current morning notification deep-links into the Day flow — verify that the landing target is the *shortest possible* version of "pick today's 2–3 tasks," not the full morning routine. The AuDHD doc is explicit on this: task initiation threshold must approach zero, and a multi-step morning planning ritual on a freshly-woken, unmedicated, dopamine-depleted brain is a threshold, not a ramp.

**Second, the evening anchor must fire *during* the eat-and-phone window, not at a "sensible" evening time.** If close-day fires at 21:30 and the phone went downstairs at 21:00, the trigger layer — which the project description correctly calls the layer everything else depends on — silently fails every night. Use `app_events` to find the actual time-of-day distribution of your evening opens, set the evening anchor ~10 minutes into that window, and accept that the window is short: the close-day flow already targets 90 seconds, which is right.

**Third, the phone-downstairs rule is a feature, not a constraint to fight.** It's a textbook guardrail against the "dessert trap" from the dopamine-menu framework, and it's already working for you. Do not build anything that requires evening phone access after the cutoff (late reminders, bedtime check-ins, sleep logging prompts). The day, from Buddy's perspective, ends when the phone goes downstairs.

---

## 3. What the usage pattern says, feature by feature

The three things you use map cleanly onto the three habit-loop stages:

The **Shortcut capture** works because it has near-zero friction, demands nothing (no categorization, no app open, no decisions), and gives instant closure ("it's out of my head"). This is the brain-dump strategy from the research, mechanized. It's the strongest thing in the product. Protect it: the offline outbox guarantee ("no capture is ever lost") is exactly right, because one lost capture re-teaches the brain not to trust the inbox.

**Picking a few small tasks** works because it's a *choice*, not a schedule. The research's PDA section explains why this survives where the AI time-block planner doesn't: a generated schedule is a stack of external demands and triggers the autonomy threat response; choosing 2–3 items from a list preserves autonomy while still bounding the day. It's also the "visual dashboard with only 2–3 visible tasks" strategy verbatim.

**Daily reflection** works because it has a defined end state (close day), a small visible reward (continuity indicator), and low input demand.

Everything else — trackers, protocols, experiments, growth hub/XP, focus timer, checklists, toolbox-as-a-page, calendar time-blocking — is currently dead weight *on the daily path*. Some of it may have value as occasional infrastructure, but none of it has earned a place in the daily loop, and per the research, every visible-but-unused element is not neutral: it adds visual demand load (PDA), decision surface (paralysis), and ambient guilt ("I'm not using my own app properly"), which is the RSD/shame channel the product guardrails explicitly try to avoid.

---

## 4. AuDHD mechanics → concrete design implications

**Autistic inertia (can't change state).** The transitions in your day are physical and already exist: coming downstairs, leaving for school/gym, sitting down to eat. Buddy should attach to these existing transition anchors rather than invent new ones. The morning pick attaches to "downstairs + phone in hand." Close-day attaches to "evening eating." Don't add app moments that require a state change of their own — that's asking inertia to solve inertia.

**ADHD task paralysis (can't start vague/boring things).** The pick-3 flow should bias toward concrete, small, pre-split tasks. AI task splitting exists in the codebase but is buried in the task UI. Move it to the moment of need: when a task in Next Up has sat untouched for two days or been snoozed twice, surface a one-tap "split this" affordance on the card itself. Micro-splitting on demand, at the point of avoidance, is worth more than splitting as a feature you have to remember exists.

**PDA (demands trigger threat response).** This is the strongest argument for the "flexible template" planner from the research and against the current AI time-block scheduler. Structure of the day fixed (morning pick, capture all day, evening close), content of the day free. Concretely: deprioritize or remove AI schedule generation from the daily path, and reframe the planner around the already-proposed "minimum viable day vs. ideal day" distinction — but make *minimum viable day the default*, with ideal-day as the opt-in for high-capacity mornings. Notification copy matters here too: "Pick what today gets" reads as autonomy; "Time to plan your day" reads as a demand. Audit all notification and UI copy for imperative phrasing.

**Time blindness.** The anchors handle the macro level. At the micro level, the one place a visual timer earns its keep is the focus feature — but only if reframed. A Pomodoro page you must navigate to will stay unused. A "20 minutes on this" button on a task card, starting a visible shrinking-time indicator, is the bounded-contract pattern from the research with zero navigation cost.

**Dopamine economics.** The toolbox is conceptually your dopamine menu, and it's unused for the predictable reason: a library you have to browse has high friction at exactly the moment (stuck, depleted) when friction tolerance is lowest. Invert it: the toolbox becomes a *source* that the app draws from contextually. Stuck signals already exist in the data (snoozed tasks, untouched plan, off-track scanner). When one fires, surface a single strategy as a card — one, not a list — matched to the situation. "Appetizer"-class strategies (2–5 min resets) for task initiation failure; "special"-class for days where nothing got touched. This is also the only realistic future for the off-track scanner: not "you're behind" (shame channel) but "here's one small move."

**Energy-matched days over time-matched days.** The light/full routine modes already encode this, but mode selection is itself a decision. Simplify to a single question at the morning pick — effectively "normal day or survival day?" — and let it set everything downstream: survival day shows one task instead of three, suppresses all non-anchor notifications, and pre-fills the reflection. The research's motivation-matching table (high executive energy → analytical work; brain fog → physical routine work) can later inform *which* tasks get suggested per mode, using existing task-type metadata.

---

## 5. The prescription: a three-touch day

Target state — the entire daily contract between you and Buddy:

**Touch 1 — Morning, ~2 minutes.** Anchor notification at wake time → deep-link → screen shows: overdue/due-today truth (already built), a deterministic suggestion of 2–3 small tasks (see below), one tap each to accept/swap, optional "survival day" toggle. Done. No mood sliders, no schedule generation, no routine checklist unless you opt in.

**Touch 2 — During the day, ~0 minutes of app time.** Shortcut capture only. The app makes no claims on your attention between the anchors. In-app, the only daytime surface that matters is Next Up if you happen to open it.

**Touch 3 — Evening, ~90 seconds, inside the eat-and-phone window.** Anchor notification → close-day flow: check off what happened, max three reflection inputs (one rating, one free-text "what helped / what blocked," tomorrow's top item), tap close. Continuity indicator updates.

Total daily demand: under 5 minutes, both demands landing in windows where the phone is already in hand. This is a contract an AuDHD nervous system can keep on a bad day — which, per the research, is the only kind of day worth designing for, because good days take care of themselves.

Everything else in the app re-frames as **occasional infrastructure**: school import at semester start, tracker review when curious, experiments when a genuine question exists. None of it should appear on the Now page or in the daily notifications.

---

## 6. Specific build items, in priority order

**P0 — Anchor timing calibration.** Query `app_events` for your real open-time distributions; move the morning anchor to wake time and the evening anchor inside the dinner window. Zero new code beyond a settings change, highest leverage in the entire report, because every downstream feature depends on the trigger firing when the phone is reachable.

**P0 — Deterministic morning pick.** The §16 "non-AI degradation" item, promoted to mandatory: the morning flow must never depend on an AI call succeeding. The task-recommender scoring heuristic generates the 2–3 suggestions; AI is an enhancement, not a dependency. A morning flow that can fail is a trigger that teaches the brain the app is unreliable, and per your own Now-page principle, trust does not survive that.

**P1 — Now page reduction.** Now = chosen tasks (with done/snooze/split), capture bar, close-day button in the evening. Move the insight card, recent captures, and routine card off the default view or behind a fold. Apply the same test the tool registry already uses: anything that doesn't earn its place in a normal day's 5 minutes goes to Browse.

**P1 — School assignments auto-generate linked todos.** Resolve the §16 open question as yes. You have one trusted surface (Next Up); a deadline that lives only in the School module is a deadline the system is hiding. Auto-create the todo on assignment creation, link them, complete both together.

**P2 — Contextual toolbox + on-card task splitting.** As described in §4: strategies surface at stuck signals; split surfaces on stale task cards.

**P2 — Execute the module-freeze policy.** The 30-day `app_events` rule is already specified — run it. Expect it to remove growth/XP, protocols, experiments, focus-as-a-page, and checklists from the daily path. Keep the data, drop the navigation. Each removal is also a token saving on every AI-routed assistant call.

**P3 — Survival-day mode** as the single capacity switch described above, replacing the light/full mode-selection decision.

**P3 — iCal feed** (§16): publish chosen tasks and deadlines to the phone's native calendar. This puts the plan where the eyes already are during pocket-phone hours without requiring an app open — a genuinely AuDHD-aligned move because it adds zero demand.

---

## 7. What not to build (PDA traps and dead ends)

No streaks — already correctly removed; don't let them return as XP mechanics in disguise. No additional daily notifications beyond the two anchors; the research is unambiguous that notification pressure converts to demand-avoidance, and the off-track scanner should stay rate-limited and gentle or stay off. No mandatory mood/energy ratings as gates in front of any flow. No AI-generated full-day schedules on the default path. No new capture surfaces — the Shortcut won; invest there (e.g., the §16 idea of Shortcuts posting Apple Health sleep data is fine because it's fully passive). And no new feature modules at all until the three-touch loop has held for 30 consecutive days of data.

---

## 8. How you'll know it's working

Define success narrowly and measure it with what's already instrumented: **days closed per week** (the continuity metric, target: trending up over 4 weeks), **captures per day** (proxy for trust in the inbox), and **morning-anchor → app-open conversion within 10 minutes** (proxy for trigger placement). Review the `app_events` numbers monthly, on a calendar reminder outside Buddy so the review doesn't depend on the system it's evaluating. If days-closed doesn't move after the P0/P1 changes, the next suspect is the evening window timing, not the feature set.

One honest caveat from the research to hold onto: no tool fixes a dysregulated nervous system. On genuine shutdown days, the correct app behavior is silence plus a one-tap survival mode — and the correct personal behavior is the noodprotocol from your research doc, not a better planner. Build Buddy to be excellent at the 5-minute contract and absent the rest of the time; that absence is the feature.
