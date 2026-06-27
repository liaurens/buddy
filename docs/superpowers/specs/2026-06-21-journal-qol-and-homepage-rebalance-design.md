# Journal QoL + Homepage Rebalance — Design

> Created 2026-06-21. Two independent quality-of-life improvements bundled in one spec:
> (1) make the progress-journal workflow easier to start and capturable from an iPhone,
> (2) rebalance the homepage so the task-triage entry is as prominent as the daily routine
> and the capture bar is smaller.

## Goal

**Part 1 — Journal QoL.** Reduce the friction of starting and feeding the per-part progress
journals (described in the project `CLAUDE.md` under "Working on a part"):

- Starting a part is currently a `/start-part` slash command whose first step is a "check for an
  existing journal" pass, and the journal files live under `.claude/progress/` — a dot-directory
  that `@`-autocomplete in Claude Code skips, so they can't be referenced quickly.
- There is no lightweight way to jot a thought about the *active* part from a phone.

**Part 2 — Homepage rebalance.** On the home screen the task-triage ("reorganize tasks") entry
should sit at the same visual weight as the Daily Routine card, while the capture (assistant
prompt) bar should be smaller.

## Key insight (Part 1)

The repository lives **inside OneDrive**
(`…/OneDrive - Hogeschool Rotterdam/Documents/school/project5.6p2/code/buddy`), which already
syncs to the user's iPhone. Therefore a single stable, gitignored notes file at the **project
root** is reachable from **both**:

- `@journal-notes.md` inside Claude Code (root is not a dot-directory → `@`-autocomplete sees it), and
- the iPhone, via the Files/OneDrive "Append to Text File" Shortcut action.

No server, no network dependency, works offline. That one file is the backbone of Part 1.

### One active part at a time

A single rotating notes file only makes sense if there is a single "active part" it belongs to.
So `/start-part` enforces **one active part at a time**:

- If the current active part is **done** (Status checklist complete) → close/finish it first, then
  create the new journal and rotate the notes file to it.
- If the current active part is **not done** → do **not** create a new journal. Keep using the
  existing (older) part and its notes; resume from its Next steps.

This makes the active-part question unambiguous, which is what lets the phone target one file.

---

## Part 1 — Detailed design

### 1.1 `journal-notes.md` (project root, gitignored)

A single rotating scratchpad that always represents the **active** part's quick notes.

- **Stable path** so the iPhone Shortcut has one fixed target and `@journal-notes.md` always works.
- **Prominent active-part marker.** The file is never anonymous — its header always names the
  part the notes currently belong to, e.g.:

  ```markdown
  # Quick notes — ACTIVE PART: 20260621-tasks (tasks)

  > Appended from the iPhone shortcut and `/note`. Folded into this part's journal on `/finish-part`.

  - [09:14] remember to check the urgent-inbox empty state
  - [11:02] ask supervisor about the triage learning doc
  ```

- **Per-part by rotation.** It is "single file" for the phone's sake, but each part still ends up
  with its own notes: the file folds into a part's journal and resets only when that part is
  **finished** (`/finish-part`) or when a **done** part is closed out by `/start-part`. It is never
  rotated out from under an unfinished part.
- **Gitignored.** Add `journal-notes.md` to `.gitignore` (alongside the existing
  `.claude/progress/` entry) — it is local scratch, same as the journals.

### 1.2 `/note <text>` slash command

New command `.claude/commands/note.md` — the desk-side equivalent of the phone Shortcut.

- Appends `- [HH:MM] <text>` to `journal-notes.md` (creating the file with a header derived from the
  current active part — the most recently modified `.claude/progress/*.md` — if it does not exist).
- `allowed-tools` limited to the date lookup it needs (`Bash(date:*)`); the append itself uses the
  file tools.
- If `$ARGUMENTS` is empty, it does nothing but report the current active part + last few notes.

### 1.3 `/start-part` streamline + one-active-part guard

Edit `.claude/commands/start-part.md`:

- Reframe the steps **create-first**: lead with "create (or resume) the journal", treating the
  duplicate/active-part check as a guard rather than the headline step.
- **One-active-part guard.** Before creating a new journal, inspect the current active journal (most
  recently modified `.claude/progress/*.md`, if any):
  - If its Status checklist is **complete** → run the close-out (the `/finish-part` flow: fold its
    `journal-notes.md` notes in, archive it), then proceed to create the new journal.
  - If its Status is **incomplete** → stop and keep the user on that existing part: summarize its
    Status + Next steps and resume there instead of creating a duplicate.
- When a new journal *is* created, **(re)initialize `journal-notes.md`** with the header
  `# Quick notes — ACTIVE PART: <date>-<slug> (<part name>)`.

### 1.4 `/finish-part` integration

Edit `.claude/commands/finish-part.md`:

- Add a step (before archiving): if `journal-notes.md`'s active-part marker matches the part being
  finished, append its bullets to the journal under a `## Personal notes` section, then reset the
  file to an empty state (no active part) so stale notes don't bleed into the next part.

### 1.5 iPhone Shortcut setup doc

New `docs/help/journal-notes-iphone.md` — a short, concrete how-to:

- The on-phone OneDrive path: `Documents/school/project5.6p2/code/buddy/journal-notes.md`.
- A 2-action Shortcut: **Ask for Input** (text) → **Append to Text File** at that path, appending
  `\n- [time] <input>`. (Plus an optional "Add to Home Screen / share-sheet" note.)
- A line explaining the rotation behavior (notes belong to the active part; they get folded in on
  `/finish-part`).

---

## Part 2 — Detailed design

### 2.1 `TriageInboxCard` (new, `src/features/core/components/`)

A summary card matching `DailyRoutineCard`'s visual weight, placed in the prominent left column
directly under the routine card.

- **Counts the inbox locally** from `useTasks`: `tasks.filter(t => !t.completed && !t.triagedAt)`.
  This deliberately does **not** use `useTaskTriage`, so **no AI sort fires on the home screen**
  (the triage query only runs inside the Tasks-tab modal).
- **Hides when empty** (`return null` when count is 0), mirroring `UrgentInboxCard`.
- Shows "N tasks to sort" + a short hint ("AI pre-sorts them — review & route in one tap") and a
  **"Sort inbox"** button → `onNavigate('tasks', { view: 'triage' })`.
- Styling reuses the existing `app-surface` card idiom and an indigo/violet accent (distinct from
  the routine's emerald and the urgent card's rose).

### 2.2 Deep-link the triage modal

`src/features/tasks/pages/TodoPage.tsx` already has a `showTriage` modal and reads
`initialParams?.view === 'urgent'`. Add:

```ts
const deepLinkTriage = initialParams?.view === 'triage';
const [showTriage, setShowTriage] = useState(deepLinkTriage);
```

so navigating from the home card auto-opens "Sort your inbox".

### 2.3 Compact capture bar

Add a `compact?: boolean` prop to `AssistantPromptBar` (`src/features/assistant/components/`):

- When `compact`, hide the "Examples:" chip row and tighten padding (`p-3 sm:p-4` → `p-2.5`,
  smaller leading icon). The `PendingSyncBadge` stays.
- `HomePage` passes `compact`. Other call-sites are unchanged (default `false`).

### 2.4 Homepage layout

`src/features/core/pages/HomePage.tsx`:

- `AssistantPromptBar` rendered with `compact`.
- Left column order: `DailyRoutineCard` → `TriageInboxCard` → (desktop) `InsightCard`.
- Right aside unchanged (`TodayCard`, mobile `InsightCard`).

---

## Out of scope (YAGNI)

- No strict one-file-per-active-part notes (single rotating file + one-active-part guard chosen).
- No server/edge-function path for phone notes (OneDrive file append is sufficient).
- No changes to triage routing logic, the AI service, or the Tasks tab beyond the deep-link.
- No new routes/constants — `view: 'triage'` reuses the existing `initialParams` mechanism.

## Testing

- **Unit (Vitest):** the inbox-count predicate is trivial; if extracted to a helper, cover
  `!completed && !triagedAt`. The slash commands and docs are not unit-tested (out of band).
- **Manual:** capture untriaged tasks → `TriageInboxCard` shows the count on home → "Sort inbox"
  opens the modal → capture bar is visibly smaller; `/note hi` appends to `journal-notes.md` with
  the correct active-part header; `/start-part` honors the one-active-part guard (resumes an
  unfinished part, closes a done one); `/finish-part` folds notes in and resets the file.
- Project rules: `npm run lint`, `tsc -b`, `npm run test:run` stay green; no `console.log`; no
  `any`; immutable updates.
