# Backlog: full revision of the assistant learnings system

*Created 2026-06-11 during the dead-code cleanup. Decision: keep the learnings tool and the HR/trainer agents, but the whole loop needs a redesign before it earns its keep.*

## Why this exists

The learnings pipeline (hr-agent → assistant_findings → trainer-agent → assistant_rules, plus the `learnings` tool and `assistant_learnings` table) has run for weeks and produced: 20 learnings, 6 findings, and **exactly 1 generated rule**. The machinery is sound architecturally but is not changing assistant behavior in practice.

## What was kept vs. removed (2026-06 cleanup)

- **Kept**: `learnings.tool.ts` (note: it is *not* registered in the tool registry — only `logInteraction` is imported by the general manager), `hr-agent`, `trainer-agent`, `assistant_learnings` / `assistant_findings` / `assistant_rules` tables, the dev panel triggers.
- **Removed**: `correlations-agent` (never produced output; deployed function still needs deletion in the Supabase dashboard).

## Revision goals (when picked up)

1. **Close the loop**: learnings should observably change routing/answers. Today rules are loaded at runtime but almost none exist. Decide: should the trainer generate rules more aggressively, or should learnings be injected into the agent-loop system prompt directly?
2. **Decide the trigger model**: HR/trainer currently run manually from the dev panel. Either schedule them (cron, like off-track-scanner) or fire them after every N interactions — manual invocation guarantees they don't run.
3. **Re-register or delete the learnings tool**: it exists but is unregistered, so the assistant can't read its own learnings mid-conversation. Either register it (so "remember that I prefer X" works end-to-end) or fold learning-capture into the system tool.
4. **Measure**: add a counter (e.g. `app_events` event or `assistant_logs` column) for "rule applied" so the next audit can tell whether the system does anything.
5. **Reflection input**: the reflection page saves wins/blockers as `assistant_learnings` rows (`reflection_*` subtypes) that the planner reads back — that path IS alive and must keep working through any refactor.
