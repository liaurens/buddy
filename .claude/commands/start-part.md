---
description: Start (or resume) a tracked progress journal for a new part/feature.
argument-hint: <part name>
allowed-tools: Bash(date:*), Bash(git diff:*), Bash(git status:*), Bash(mkdir:*), Bash(mv:*)
---

Begin work on a part: **$ARGUMENTS**

This project keeps ONE active part at a time, so the quick-notes file (`journal-notes.md`) is never
ambiguous about which part a note belongs to. Do these in order:

1. **Resume or guard against the current active part.** Find the most recently modified `*.md` in
   `.claude/progress/` (ignore `done/`):
   - If one exists and its **Status checklist is incomplete**: do NOT create a new journal. Keep
     using it — summarize its Status and Next steps and continue from there. Stop here.
   - If one exists and its **Status checklist is complete**: close it out first by following the
     steps in `.claude/commands/finish-part.md` for that part (fold its notes + learnings, update
     docs, archive it), then continue to step 2.
   - If none exists: continue to step 2.

2. **Create the new journal:**
   - Get the date: run `date -u +%Y%m%d`.
   - Slugify the part name (lowercase, `-` separated).
   - Copy `.claude/templates/progress.md` to `.claude/progress/<date>-<slug>.md`, filling in the
     part name, today's date, and the Goal.
   - Briefly outline the planned steps in the **Status** checklist.

3. **Point the notes file at this part.** Overwrite `journal-notes.md` (project root) with:

       # Quick notes — ACTIVE PART: <date>-<slug> (<part name>)

       > Appended from the iPhone shortcut and `/note`. Folded into this part's journal on `/finish-part`.

Keep the journal updated AS YOU WORK — especially **Errors & gotchas** and **Next steps** — so it is
resumable in a fresh session. Jot stray thoughts with `/note` or the iPhone shortcut. When the part
is done, run `/finish-part`.
