---
description: Append a quick note to the active part's journal-notes.md (desk-side twin of the iPhone shortcut).
argument-hint: <note text>
allowed-tools: Bash(date:*)
---

Append a quick thought to the active part's notes file: **$ARGUMENTS**

Steps:
1. Get the time: run `date +%H:%M`.
2. Read `journal-notes.md` (project root). If it does not exist, or its header is `(no active part)`,
   set its header from the current active part — the most recently modified `.claude/progress/*.md`
   (ignore `done/`). Use that file's `<date>-<slug>` name and the part name from its first heading:

       # Quick notes — ACTIVE PART: <date>-<slug> (<part name>)

       > Appended from the iPhone shortcut and `/note`. Folded into this part's journal on `/finish-part`.

3. Append a single line to the end of `journal-notes.md`:

       - [<HH:MM>] $ARGUMENTS

4. Confirm: echo the active part from the header and the line you added.

If `$ARGUMENTS` is empty, do NOT append — just report the active part from the header and the last
few notes already in the file.
