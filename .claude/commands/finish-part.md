---
description: Finish a part — fold learnings into CLAUDE.md, update docs/DESIGN.md, generate UML/docs if significant, archive the journal.
argument-hint: [part name — optional; defaults to the active journal]
allowed-tools: Bash(date:*), Bash(git diff:*), Bash(git status:*), Bash(mkdir:*), Bash(mv:*)
---

Wrap up a part. If a name is given (**$ARGUMENTS**) use that journal; otherwise use the most recently modified file in `.claude/progress/`.

Do these in order:

1. **Review the journal.** Read the active `.claude/progress/*.md`. Confirm the Status checklist is complete; if not, tell me what's left and stop.

2. **Fold durable learnings into `CLAUDE.md`.** Take entries under "Candidate learnings for CLAUDE.md" that matter to the WHOLE project (gotchas, conventions, non-obvious decisions — not one-off task detail) and integrate them into the appropriate existing section of the project `CLAUDE.md`. Don't duplicate what's already there.

3. **Update `docs/DESIGN.md`.** Move this part from `🚧 In progress` / `📋 Planned` to `✅ Done`, and add a dated entry to the **Changelog** (run `date -u +%Y-%m-%d`). Create `docs/DESIGN.md` from scratch if it doesn't exist yet (Overview, Architecture mermaid, Status buckets, Changelog, Feature docs index).

4. **Significance check → maybe generate UML + a feature doc.** Inspect the diff (`git diff --name-only` against the part's starting point, plus `git status`). If ANY of these hold, it's significant:
   - a new feature module under `src/features/`,
   - a new Supabase domain/table or a new migration,
   - a new edge function under `supabase/functions/`,
   - or roughly 8+ files changed.

   If significant:
   - Write a focused `docs/<feature>.md` (purpose, data model, key files, flow, gotchas).
   - Generate a **Mermaid** diagram in `docs/diagrams/<feature>.md` (ER diagram for a DB domain, sequence/flow for an edge function or multi-step flow, component diagram for a feature) and embed/link it from the feature doc.
   - Add the feature doc to the **Feature docs index** in `docs/DESIGN.md`.

   If NOT significant: skip diagrams/docs — only the Status + Changelog update from step 3.

5. **Archive the journal.** Move the progress file to `.claude/progress/done/` (create the folder if needed). Do not delete unless I confirm.

Report what you folded into CLAUDE.md, what changed in docs/DESIGN.md, and whether a diagram/feature doc was generated.
