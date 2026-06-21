---
description: Scaffold a new Supabase data domain (Db type + converter + barrels + migration).
argument-hint: <DomainName> [brief description of fields]
---

Use the `supabase-domain` agent to scaffold a new data domain named: **$ARGUMENTS**

Delegate to that agent. It will follow the repo's 3-layer pattern (Db row type → converter → both barrel re-exports → timestamped migration), mirroring `src/services/supabase/converters/todo.ts`.

After it finishes, show me the list of files created/edited and the migration filename, and remind me how to apply the migration. Do not apply the migration automatically.
