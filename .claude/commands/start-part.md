---
description: Start (or resume) a tracked progress journal for a new part/feature.
argument-hint: <part name>
allowed-tools: Bash(date:*)
---

Begin work on a new "part": **$ARGUMENTS**

Steps:
1. Check `.claude/progress/` for an existing unfinished journal that matches this part. If one exists, open and continue it instead of creating a duplicate — summarize its current Status and Next steps and pick up from there.
2. Otherwise create a new journal:
   - Get the date: run `date -u +%Y%m%d`.
   - Slugify the part name (lowercase, `-` separated).
   - Copy `.claude/templates/progress.md` to `.claude/progress/<date>-<slug>.md`, filling in the part name, today's date, and the Goal.
3. Briefly outline the planned steps in the **Status** checklist.

Keep this file updated AS YOU WORK — especially the **Errors & gotchas** and **Next steps** sections — so the work is resumable in a fresh session. The file is gitignored (local scratch). When the part is done, run `/finish-part`.
