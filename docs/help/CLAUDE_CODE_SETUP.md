# Claude Code Setup — Agents, Commands, Hooks & Workflows

This repo ships project-specific Claude Code tooling so that working with Claude is faster, safer, and resumable. Everything lives under `.claude/` (checked into git, except local scratch) plus a few root config files.

If you're new here: read the project `CLAUDE.md` first — it holds the hard rules these tools enforce.

---

## TL;DR — the everyday flow

1. Starting a feature/task? → `/start-part <name>` (creates a resumable journal).
2. Work as normal. Hooks quietly format your edits and warn about rule violations.
3. Need the data layer or an edge function? → `/new-domain`, `/new-migration`, `/deploy-fn`, or the matching agent.
4. Before committing → `/check` (lint + typecheck + tests). Commit triggers auto-format on staged files.
5. Done? → `/finish-part` (folds learnings into `CLAUDE.md`, updates `docs/DESIGN.md`, generates UML/docs if the change was big).

---

## 1. Hooks (automatic, advisory)

Configured in `.claude/settings.json`; scripts live in `.claude/hooks/`. **All hooks are advisory — they never block an edit or a commit.** Node-based, so they work on Windows/PowerShell and macOS/Linux alike.

| Hook | When | What it does |
|---|---|---|
| `quality-guard.mjs` | after every Edit/Write/MultiEdit | Warns (to Claude) if the edit introduces `any`, `console.log` in `src/`, the `tracker_entries` / `from('tasks')` naming gotchas, or raw locale date formatting. Scans code/SQL only — skips docs & markdown. |
| `format-edited.mjs` | after every Edit/Write/MultiEdit | Runs Prettier on just the file that changed. No-ops silently if Prettier isn't installed. |
| `stop-audit.mjs` | when a session ends | Scans git-changed `src/` files for leftover `console.log` / `any` / `tracker_entries` and prints a summary. |
| `resume-context.mjs` | at session start | Lists any unfinished progress journals (`.claude/progress/`) with their Status + Next steps so you can pick up where you left off. |

**Why advisory?** With a known lint baseline, hard blocks would create friction. These nudge Claude to self-correct without stopping work. The real gate is `/check` + the pre-commit hook.

---

## 2. Agents (`.claude/agents/`)

Specialized subagents that encode this project's patterns. Claude invokes them automatically when relevant, or you can ask for one by name.

| Agent | Use it for |
|---|---|
| `supabase-domain` | Scaffolding a **new data domain** end-to-end: `Db<X>` row type → converter (`dbToX`/`xToDb`) → both barrel re-exports → a timestamped migration. Mirrors `src/services/supabase/converters/todo.ts`. |
| `edge-fn` | Building/editing **Supabase edge functions** (Deno): `_shared/` helpers, service-role + explicit `userId` filtering, pg_cron awareness, deploy steps. |
| `pwa-reviewer` | **Reviewing your diff** against the project hard rules (no `any`, naming gotchas, immutability, boundary validation, no `console.log` in `src/`, date-fns, feature-module layout). Read-only. |
| `vitest-author` | Writing **Vitest tests** in the existing style (globals on, jsdom, `*.test.ts` beside code). Prioritizes converters, parsers, calculations, rule engine. |

---

## 3. Slash commands (`.claude/commands/`)

| Command | Args | What it does |
|---|---|---|
| `/check` | — | Runs `npm run lint`, `tsc -b`, `npm run test:run`; reports only the failures + a commit-safe verdict. |
| `/new-domain` | `<Name> [fields]` | Delegates to `supabase-domain` to scaffold a new data domain. |
| `/new-migration` | `<description>` | Creates `supabase/migrations/<UTC-timestamp>_<slug>.sql` with an RLS-enabled skeleton. Does **not** apply it. |
| `/deploy-fn` | `<function-name>` | Deploys an edge function (`--project-ref kdwgznfszbrysepsltua`) and checks logs/advisors via the Supabase MCP. |
| `/db` | `<question>` | Answers questions about the **live** schema/data via the Supabase/postgres MCP (read-only). |
| `/start-part` | `<part name>` | Starts or resumes a progress journal. |
| `/finish-part` | `[part name]` | Closes out a part (see workflow below). |

---

## 4. Progress journal workflow (resumable work)

The "part" workflow keeps multi-step work organized and survivable across sessions.

```mermaid
flowchart LR
  A["/start-part name"] --> B["journal in .claude/progress/<date>-slug.md"]
  B --> C["work — keep Status / Gotchas / Next steps updated"]
  C --> D["/finish-part"]
  D --> E["fold learnings into CLAUDE.md"]
  D --> F["update docs/DESIGN.md (status + changelog)"]
  D --> G{"significant?"}
  G -- "yes" --> H["generate docs/diagrams + docs/feature.md"]
  G -- "no" --> I["status/changelog only"]
  D --> J["archive journal to .claude/progress/done/"]
```

- **Journals are gitignored** (`.claude/progress/`) — they're local scratch, not committed. They persist on disk so a fresh session can resume; the `resume-context` hook surfaces them automatically at startup.
- **Template:** `.claude/templates/progress.md` — sections for Goal, Status checklist, Key context/decisions, Errors & gotchas, Next steps, and **Candidate learnings for CLAUDE.md**.
- **`/finish-part` "significance" rule** — it auto-generates a Mermaid diagram (`docs/diagrams/<feature>.md`) and a feature page (`docs/<feature>.md`) only when the part added a new feature module, a new Supabase domain/table/migration, a new edge function, or touched ~8+ files. Small parts only bump the status + changelog — no doc churn.

`docs/DESIGN.md` is the **living status/architecture overview** — what's Done vs Planned, the top-level architecture diagram, the changelog, and an index of generated feature docs.

---

## 5. Formatting & pre-commit

- **Prettier** is configured in `.prettierrc.json` (single quotes, 4-space indent, semicolons, width 100). Ignore rules in `.prettierignore`.
  - `npm run format` — format the whole repo.
  - `npm run format:check` — check without writing (CI-friendly).
- **husky + lint-staged** — `.husky/pre-commit` runs `lint-staged` on **staged files only**: Prettier on `*.{ts,tsx,js,jsx,mjs,cjs,json,css}` and `eslint --fix` on `*.{ts,tsx}`. Because it's scoped to staged files, the existing lint baseline in untouched files never blocks a commit.
  - `tsc` is intentionally **not** in pre-commit (whole-project, too slow) — use `/check` and/or CI for that.

> First-time setup on a fresh clone: `npm install` runs the `prepare` script, which initializes husky automatically. No manual step needed.

---

## 6. File map

```
.claude/
  settings.json            # hook wiring (shared)
  settings.local.json      # personal permissions allowlist (not part of this setup)
  hooks/
    quality-guard.mjs
    format-edited.mjs
    stop-audit.mjs
    resume-context.mjs
  agents/
    supabase-domain.md  edge-fn.md  pwa-reviewer.md  vitest-author.md
  commands/
    check.md  new-domain.md  new-migration.md  deploy-fn.md  db.md
    start-part.md  finish-part.md
  templates/
    progress.md
  progress/                # gitignored local journals (created on demand)
.prettierrc.json  .prettierignore
.husky/pre-commit
docs/DESIGN.md             # living status/architecture doc
```

---

## 7. Troubleshooting

- **Hooks aren't running** — they're defined in `.claude/settings.json`; restart the Claude Code session after changing it. Hooks need `node` on PATH (Node 24 in this project).
- **Prettier reformats too much** — adjust `.prettierrc.json` or add paths to `.prettierignore`. The format-on-edit hook only touches the single file you edited.
- **A commit is blocked by eslint** — lint-staged only gates the files you staged. Fix the reported issues, or stage fewer files. (It does not enforce the whole-repo baseline.)
- **Quality-guard warned on a doc that describes a rule** — it only scans `.ts/.tsx/.js/.jsx/.mjs/.cjs/.sql`; markdown is skipped, so this shouldn't happen. If it does, the file extension is likely code.
- **Resume hook didn't surface a journal** — confirm the file is in `.claude/progress/` and ends in `.md`. The folder is gitignored by design.

---

_Maintained as part of the repo's developer tooling. When you change the hooks/agents/commands, update this doc (and `CLAUDE.md`’s "Claude Code helpers" section)._
