---
description: Deploy a Supabase edge function and check its logs for boot errors.
argument-hint: <function-name>
allowed-tools: Bash(npx supabase functions deploy:*)
---

Deploy the edge function: **$ARGUMENTS**

Steps:
1. Confirm `supabase/functions/$ARGUMENTS/` exists (exact spelling — a past typo deployed `quik-note`).
2. Deploy (trim output): `npx supabase functions deploy $ARGUMENTS --project-ref kdwgznfszbrysepsltua --use-api 2>&1 | tail -10`.
3. Check boot health with the Supabase MCP `get_logs` (service `edge-function`) — look only at entries for `$ARGUMENTS`; watch for circular-import TDZ crashes (a known past failure mode). Skip `get_advisors` unless the deploy touched the database.
4. Report in a few lines: deploy OK/failed + any boot errors. If the function is invoked by a pg_cron migration (`schedule-notifications`, `off-track-scanner`), remind me to verify the cron still points at the right name.
