---
description: Answer a question about the live database schema/data using the Supabase MCP.
argument-hint: <question, e.g. "columns on the todos table">
---

Answer this database question using the Supabase / postgres MCP tools (read-only): **$ARGUMENTS**

Guidance:
- Use `list_tables`, `execute_sql`, or the postgres `query` tool to introspect the real schema in project `kdwgznfszbrysepsltua`.
- Prefer schema introspection (`information_schema` / `list_tables`) for structure questions; only `SELECT` for data questions.
- Never run a mutating statement from this command — read-only only.
- Remember the naming gotchas: health check-ins are in `entries`, todos are in `todos`.
- Answer concisely with the concrete result (column list, row, etc.).
