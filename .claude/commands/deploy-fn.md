---
description: Deploy a Supabase edge function and check its logs for boot errors.
argument-hint: <function-name>
allowed-tools: Bash(supabase functions deploy:*)
---

Deploy the edge function: **$ARGUMENTS**

Steps:
1. Confirm `supabase/functions/$ARGUMENTS/` exists.
2. Deploy: `supabase functions deploy $ARGUMENTS --project-ref kdwgznfszbrysepsltua`.
3. After deploy, use the Supabase MCP tools `get_logs` and `get_advisors` to check for boot/runtime errors (watch for circular-import TDZ crashes — a known past failure mode).
4. Report the deploy result and any errors found. If the function is invoked by a pg_cron migration, remind me to verify the cron still points at the right name.
