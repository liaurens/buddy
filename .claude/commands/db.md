---
description: Answer a question about the live database schema/data using the Supabase MCP.
argument-hint: <question, e.g. "columns on the todos table">
---

Answer this database question using the Supabase / postgres MCP tools (read-only): **$ARGUMENTS**

Guidance:
- Prefer the postgres MCP `query` tool (read-only, pre-allowed) over Supabase `execute_sql`; use `list_tables` for structure overviews. Project: `kdwgznfszbrysepsltua`.
- Prefer schema introspection (`information_schema` / `list_tables`) for structure questions; only `SELECT` for data questions.
- Always `LIMIT` data queries (default `LIMIT 20`) and select only the columns you need — never pull whole tables into context.
- Never run a mutating statement from this command — read-only only.
- Remember the naming gotchas: health check-ins are in `entries`, todos are in `todos`.
- Answer concisely with the concrete result (column list, row, etc.).
