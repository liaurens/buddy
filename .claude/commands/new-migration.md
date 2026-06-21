---
description: Create a new timestamped Supabase migration skeleton (RLS-enabled).
argument-hint: <short description, e.g. "add streaks to goals">
allowed-tools: Bash(date:*)
---

Create a new migration file for: **$ARGUMENTS**

Steps:
1. Get a UTC timestamp: run `date -u +%Y%m%d%H%M%S`. Use it as the 14-digit prefix. Verify it sorts AFTER the latest file in `supabase/migrations/` (bump if needed).
2. Slugify the description (lowercase, words joined by `_`).
3. Create `supabase/migrations/<timestamp>_<slug>.sql`.
4. Populate it following the shape of a recent migration (e.g. `supabase/migrations/20260618000000_task_kinds.sql`):
   - `create table` / `alter table` as appropriate.
   - For new tables: `alter table public.<t> enable row level security;` plus per-operation policies scoped to `auth.uid() = user_id`.
   - Add a brief comment header describing the change.

Honor the naming gotchas (`entries`, `todos`). Show me the final file. Do NOT apply it — tell me to run `supabase db push` (or use the Supabase MCP `apply_migration`) when ready.
