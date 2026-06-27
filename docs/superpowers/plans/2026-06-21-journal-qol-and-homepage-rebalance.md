# Journal QoL + Homepage Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the progress-journal workflow easier to start and capturable from an iPhone, and rebalance the homepage so the task-triage entry is as prominent as the daily routine while the capture bar is smaller.

**Architecture:** Part 1 is Claude Code tooling — a single root-level `journal-notes.md` (gitignored, OneDrive-synced → reachable from `@` and from an iPhone Shortcut) plus edits to the `/start-part` and `/finish-part` slash commands and a new `/note` command that rotate/append to it. Part 2 is app UI — a new `TriageInboxCard` (counts the inbox locally, no AI call), a `compact` mode on `AssistantPromptBar`, and a `view: 'triage'` deep-link that auto-opens the existing Tasks-tab triage modal.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind, lucide-react, Vitest, Claude Code slash commands (markdown).

## Global Constraints

- TypeScript strict — no `any`. Immutable updates only (spread, no mutation).
- No `console.log` in app code.
- `npm run lint`, `tsc -b` (via `npm run build`), and `npm run test:run` must stay green.
- Reference spec: `docs/superpowers/specs/2026-06-21-journal-qol-and-homepage-rebalance-design.md`.
- One active part at a time: `journal-notes.md` is never rotated out from under an unfinished part.
- `journal-notes.md` lives at the project root and is gitignored (local scratch).

---

### Task 0: Feature branch

**Files:** none (git only).

- [ ] **Step 1: Create and switch to a feature branch**

```bash
git checkout -b feat/journal-qol-homepage-rebalance
```

- [ ] **Step 2: Confirm the branch**

Run: `git branch --show-current`
Expected: `feat/journal-qol-homepage-rebalance`

---

## Part 1 — Journal QoL (Claude Code tooling)

### Task 1: Seed `journal-notes.md` and gitignore it

**Files:**
- Create: `journal-notes.md`
- Modify: `.gitignore` (append one entry after the `.claude/progress/` line)

- [ ] **Step 1: Create the root notes file in its empty state**

Create `journal-notes.md` with exactly:

```markdown
# Quick notes — (no active part)

> Start or resume a part to attach notes here. Appended from the iPhone shortcut and `/note`,
> folded into the part's journal on `/finish-part`.
```

- [ ] **Step 2: Gitignore it**

In `.gitignore`, after the existing line `.claude/progress/`, add:

```
# Active-part quick-notes scratchpad (local, OneDrive-synced, fed by /note + iPhone shortcut)
journal-notes.md
```

- [ ] **Step 3: Verify git ignores it**

Run: `git status --porcelain journal-notes.md`
Expected: no output (the file is ignored).

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(journal): add gitignored journal-notes.md scratchpad"
```

---

### Task 2: `/note` slash command

**Files:**
- Create: `.claude/commands/note.md`

- [ ] **Step 1: Write the command file**

Create `.claude/commands/note.md` with exactly:

```markdown
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
```

- [ ] **Step 2: Manual verification**

In a Claude Code session run `/note remember to test the empty state`. Confirm `journal-notes.md`
now has an `ACTIVE PART` header (naming the most recent journal) and a `- [HH:MM] remember to test
the empty state` line. Then run `/note` with no text and confirm it reports the active part + recent
notes without appending.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/note.md
git commit -m "feat(journal): add /note command to append to the active part's notes"
```

---

### Task 3: Rework `/start-part` (create-first + one-active-part guard)

**Files:**
- Modify: `.claude/commands/start-part.md` (full rewrite)

**Interfaces:**
- Consumes: the `## Status` checklist and first-heading part name in `.claude/progress/*.md`; the
  `/finish-part` flow defined in `.claude/commands/finish-part.md`.
- Produces: a `journal-notes.md` header of the form `# Quick notes — ACTIVE PART: <date>-<slug> (<part name>)`.

- [ ] **Step 1: Replace the file contents**

Overwrite `.claude/commands/start-part.md` with exactly:

```markdown
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
```

- [ ] **Step 2: Manual verification**

Re-read the file and confirm: step 1 resumes an incomplete part instead of creating a new one, closes
out a completed part first, and step 3 sets the `ACTIVE PART` header. (Two unfinished journals exist
today — `20260619-google-calendar.md`, `20260621-tasks.md` — so a dry run should resume the most
recent rather than spawn a third.)

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/start-part.md
git commit -m "feat(journal): one-active-part guard + notes init in /start-part"
```

---

### Task 4: Wire notes folding into `/finish-part`

**Files:**
- Modify: `.claude/commands/finish-part.md` (insert a step before "Archive the journal")

**Interfaces:**
- Consumes: the `ACTIVE PART: <date>-<slug>` marker in `journal-notes.md`.
- Produces: a `## Personal notes` section appended to the archived journal; resets `journal-notes.md`
  to the `(no active part)` empty state.

- [ ] **Step 1: Renumber and insert the fold step**

In `.claude/commands/finish-part.md`, the current step 5 is "Archive the journal." Insert a new
step 5 (and renumber the archive step to 6) so the list reads:

```markdown
5. **Fold quick notes.** If `journal-notes.md` (project root) exists and its `ACTIVE PART` header
   names the part being finished, append its bullet lines to the journal under a new
   `## Personal notes` section. Then reset `journal-notes.md` to its empty state:

       # Quick notes — (no active part)

       > Start or resume a part to attach notes here. Appended from the iPhone shortcut and `/note`,
       > folded into the part's journal on `/finish-part`.

   If the header names a different part (or `(no active part)`), leave `journal-notes.md` untouched.

6. **Archive the journal.** Move the progress file to `.claude/progress/done/` (create the folder if
   needed). Do not delete unless I confirm.
```

(The original "Archive the journal" step 5 body is preserved verbatim as the new step 6 — do not
drop the "create the folder if needed / do not delete unless I confirm" wording.)

- [ ] **Step 2: Manual verification**

Re-read the file and confirm the fold step sits before archiving, only acts when the header matches
the finishing part, and resets the notes file afterward.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/finish-part.md
git commit -m "feat(journal): fold journal-notes.md into the part on /finish-part"
```

---

### Task 5: iPhone Shortcut setup doc

**Files:**
- Create: `docs/help/journal-notes-iphone.md`

- [ ] **Step 1: Write the doc**

Create `docs/help/journal-notes-iphone.md` with exactly:

```markdown
# Quick journal notes from your iPhone

`journal-notes.md` lives at the repo root, inside OneDrive, so it syncs to your phone. An iOS
Shortcut can append a thought to it in two taps — no laptop session needed. Whatever you add belongs
to the **active part** (named in the file's header) and gets folded into that part's journal when you
run `/finish-part`.

## One-time setup (iOS Shortcuts app)

1. New Shortcut → add **Ask for Input** (Input Type: Text, prompt: "Journal note").
2. Add **Append to Text File**:
   - **File:** browse to OneDrive →
     `Documents/school/project5.6p2/code/buddy/journal-notes.md`
   - **Text to append:** `Provided Input` (prefix with a new line, e.g. set the text to a newline
     then the input, so each note lands on its own line).
3. Name it "Journal note" and add it to your Home Screen (or the Share Sheet) for one-tap capture.

> Tip: if you want timestamps like the `/note` command produces, add a **Format Date** action
> (format `HH:mm`) and make the appended text `- [<time>] <input>`.

## How it rotates

- The file header always names the active part: `# Quick notes — ACTIVE PART: <date>-<slug> (...)`.
- `/start-part` re-points the header to the new part (only when the previous part is done or absent —
  one active part at a time).
- `/finish-part` folds the notes into the finished part's journal and clears the file.

So you can always just append; the desktop commands handle attribution and cleanup.
```

- [ ] **Step 2: Commit**

```bash
git add docs/help/journal-notes-iphone.md
git commit -m "docs(journal): iPhone shortcut setup for quick journal notes"
```

---

## Part 2 — Homepage rebalance (app UI)

### Task 6: Inbox-count helper (TDD)

**Files:**
- Create: `src/features/tasks/utils/inbox.ts`
- Test: `src/features/tasks/utils/inbox.test.ts`

**Interfaces:**
- Produces: `isInInbox(task: Task): boolean` and `countInbox(tasks: Task[]): number`.

- [ ] **Step 1: Write the failing test**

Create `src/features/tasks/utils/inbox.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isInInbox, countInbox } from './inbox';
import type { Task } from '../types';

function makeTask(over: Partial<Task>): Task {
    return { id: 't1', title: 'Task', completed: false, createdAt: '2026-06-21T00:00:00.000Z', ...over };
}

describe('isInInbox', () => {
    it('true for an active, untriaged task', () => {
        expect(isInInbox(makeTask({}))).toBe(true);
    });
    it('false once completed', () => {
        expect(isInInbox(makeTask({ completed: true }))).toBe(false);
    });
    it('false once triaged', () => {
        expect(isInInbox(makeTask({ triagedAt: '2026-06-21T08:00:00.000Z' }))).toBe(false);
    });
});

describe('countInbox', () => {
    it('counts only active, untriaged tasks', () => {
        const tasks = [
            makeTask({ id: 'a' }),
            makeTask({ id: 'b', completed: true }),
            makeTask({ id: 'c', triagedAt: '2026-06-21T08:00:00.000Z' }),
            makeTask({ id: 'd' }),
        ];
        expect(countInbox(tasks)).toBe(2);
    });
    it('returns 0 for an empty list', () => {
        expect(countInbox([])).toBe(0);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/tasks/utils/inbox.test.ts`
Expected: FAIL — cannot resolve `./inbox` / `isInInbox is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/features/tasks/utils/inbox.ts`:

```ts
import type { Task } from '../types';

/** A task is in the capture inbox when it's active and not yet routed by triage. */
export function isInInbox(task: Task): boolean {
    return !task.completed && !task.triagedAt;
}

/** Count the active, untriaged tasks waiting in the capture inbox. */
export function countInbox(tasks: Task[]): number {
    return tasks.reduce((n, t) => (isInInbox(t) ? n + 1 : n), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/tasks/utils/inbox.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/tasks/utils/inbox.ts src/features/tasks/utils/inbox.test.ts
git commit -m "feat(tasks): add inbox-count helper with tests"
```

---

### Task 7: `TriageInboxCard` component

**Files:**
- Create: `src/features/core/components/TriageInboxCard.tsx`

**Interfaces:**
- Consumes: `useTasks()` → `{ tasks: Task[] }`; `countInbox(tasks)` from Task 6; `AppRoute`.
- Produces: default-exported `TriageInboxCard` with prop `{ onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void }`.

- [ ] **Step 1: Write the component**

Create `src/features/core/components/TriageInboxCard.tsx`:

```tsx
/**
 * TriageInboxCard — home-screen entry to the capture-inbox triage flow.
 *
 * Sits at the same visual weight as the Daily Routine card. Counts the inbox
 * locally (no AI sort fires on the home screen) and links to the Tasks-tab
 * triage modal. Hides itself when the inbox is empty.
 */

import React from 'react';
import { Inbox, Sparkles, ChevronRight } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { countInbox } from '../../tasks/utils/inbox';
import type { AppRoute } from '../../../constants/routes';

interface Props {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const TriageInboxCard: React.FC<Props> = ({ onNavigate }) => {
    const { tasks } = useTasks();
    const count = countInbox(tasks);

    if (count === 0) return null;

    const openTriage = () => onNavigate('tasks', { view: 'triage' });

    return (
        <section className="app-surface">
            <button type="button" onClick={openTriage} className="group w-full p-5 text-left">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                            <Inbox size={18} className="text-indigo-600" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-slate-950">Reorganize tasks</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                {count} captured {count === 1 ? 'task' : 'tasks'} to sort
                            </p>
                        </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-sm font-semibold text-indigo-700">
                        {count}
                    </span>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <Sparkles size={14} className="text-violet-500" />
                    AI pre-sorts them — review &amp; route in one tap.
                </div>
            </button>

            <button
                type="button"
                onClick={openTriage}
                className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-medium text-indigo-900 transition-colors hover:bg-slate-50"
            >
                <span>Sort inbox</span>
                <ChevronRight size={15} className="text-slate-400" />
            </button>
        </section>
    );
};

export default TriageInboxCard;
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: `tsc -b` passes (no type errors); Vite build completes.

- [ ] **Step 3: Commit**

```bash
git add src/features/core/components/TriageInboxCard.tsx
git commit -m "feat(home): add TriageInboxCard (local count, no AI call)"
```

---

### Task 8: `compact` mode on `AssistantPromptBar`

**Files:**
- Modify: `src/features/assistant/components/AssistantPromptBar.tsx`

**Interfaces:**
- Produces: `AssistantPromptBarProps` gains `compact?: boolean` (default `false`).

- [ ] **Step 1: Add the `compact` prop to the interface**

In `src/features/assistant/components/AssistantPromptBar.tsx`, change the props interface from:

```tsx
interface AssistantPromptBarProps {
  onNavigate?: (route: AppRoute) => void
  placeholder?: string
  onMessageSent?: (input: string) => void
}
```

to:

```tsx
interface AssistantPromptBarProps {
  onNavigate?: (route: AppRoute) => void
  placeholder?: string
  onMessageSent?: (input: string) => void
  compact?: boolean
}
```

- [ ] **Step 2: Destructure `compact` in the component signature**

Change:

```tsx
const AssistantPromptBar: React.FC<AssistantPromptBarProps> = ({
  onNavigate,
  placeholder = 'Capture anything — type / for commands…',
  onMessageSent,
}) => {
```

to:

```tsx
const AssistantPromptBar: React.FC<AssistantPromptBarProps> = ({
  onNavigate,
  placeholder = 'Capture anything — type / for commands…',
  onMessageSent,
  compact = false,
}) => {
```

- [ ] **Step 3: Tighten padding and the leading icon when compact**

Change the section + icon block from:

```tsx
      <section className="app-surface p-3 sm:p-4">
        <div className="flex items-end gap-3">
          <div className="mb-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-600">
            <PencilLine size={21} />
          </div>
```

to:

```tsx
      <section className={`app-surface ${compact ? 'p-2.5' : 'p-3 sm:p-4'}`}>
        <div className="flex items-end gap-3">
          <div className={`mb-1 flex flex-shrink-0 items-center justify-center rounded-lg text-slate-600 ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
            <PencilLine size={compact ? 18 : 21} />
          </div>
```

- [ ] **Step 4: Hide the examples row when compact (keep the sync badge)**

Change the footer row from:

```tsx
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-1 text-[11px] text-slate-500">
          <PendingSyncBadge />
          <span>Examples:</span>
          {['Call mom tomorrow', 'Read ch. 4', 'Grocery list'].map(example => (
            <button
              key={example}
              type="button"
              onClick={() => captureInputRef.current?.fill(example)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-700"
            >
              {example}
            </button>
          ))}
        </div>
```

to:

```tsx
        <div className={`flex flex-wrap items-center gap-2 pl-1 text-[11px] text-slate-500 ${compact ? 'mt-2' : 'mt-3'}`}>
          <PendingSyncBadge />
          {!compact && <span>Examples:</span>}
          {!compact &&
            ['Call mom tomorrow', 'Read ch. 4', 'Grocery list'].map(example => (
              <button
                key={example}
                type="button"
                onClick={() => captureInputRef.current?.fill(example)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-700"
              >
                {example}
              </button>
            ))}
        </div>
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: passes; no other call-site breaks (the prop is optional).

- [ ] **Step 6: Commit**

```bash
git add src/features/assistant/components/AssistantPromptBar.tsx
git commit -m "feat(assistant): compact mode for AssistantPromptBar"
```

---

### Task 9: Deep-link the triage modal in `TodoPage`

**Files:**
- Modify: `src/features/tasks/pages/TodoPage.tsx:51` and `:59`

**Interfaces:**
- Consumes: `initialParams?.view === 'triage'` (sent by `TriageInboxCard`).

- [ ] **Step 1: Add the deep-link flag next to the existing `deepLinkUrgent`**

Change (around line 51):

```tsx
    const deepLinkUrgent = initialParams?.view === 'urgent';
```

to:

```tsx
    const deepLinkUrgent = initialParams?.view === 'urgent';
    const deepLinkTriage = initialParams?.view === 'triage';
```

- [ ] **Step 2: Initialize `showTriage` from the flag**

Change (around line 59):

```tsx
    const [showTriage, setShowTriage] = useState(false);
```

to:

```tsx
    const [showTriage, setShowTriage] = useState(deepLinkTriage);
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/features/tasks/pages/TodoPage.tsx
git commit -m "feat(tasks): open triage modal via view=triage deep-link"
```

---

### Task 10: Mount the card + compact capture on `HomePage`

**Files:**
- Modify: `src/features/core/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `TriageInboxCard` (Task 7); `AssistantPromptBar` `compact` (Task 8).

- [ ] **Step 1: Import `TriageInboxCard`**

After the existing component imports (below `import TodayCard from '../components/TodayCard';`), add:

```tsx
import TriageInboxCard from '../components/TriageInboxCard';
```

- [ ] **Step 2: Make the capture bar compact**

Change:

```tsx
            <AssistantPromptBar onNavigate={onNavigate} />
```

to:

```tsx
            <AssistantPromptBar onNavigate={onNavigate} compact />
```

- [ ] **Step 3: Add the triage card under the routine in the left column**

Change:

```tsx
                <section className="space-y-5">
                    <DailyRoutineCard onNavigate={onNavigate} />

                    <div className="hidden lg:block">
                        <InsightCard />
                    </div>
                </section>
```

to:

```tsx
                <section className="space-y-5">
                    <DailyRoutineCard onNavigate={onNavigate} />

                    <TriageInboxCard onNavigate={onNavigate} />

                    <div className="hidden lg:block">
                        <InsightCard />
                    </div>
                </section>
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: passes.

- [ ] **Step 5: Manual verification (dev server)**

Run `npm run dev`. With at least one untriaged task captured, confirm on the home screen: the
"Reorganize tasks" card shows under the Daily Routine card with the correct count; tapping "Sort
inbox" opens the Tasks-tab "Sort your inbox" modal; the capture bar is visibly smaller (no Examples
chips). With an empty inbox, the card is absent.

- [ ] **Step 6: Commit**

```bash
git add src/features/core/pages/HomePage.tsx
git commit -m "feat(home): prominent triage card + compact capture bar"
```

---

### Task 11: Full green check

**Files:** none.

- [ ] **Step 1: Lint, typecheck, tests**

Run: `npm run lint && npm run build && npm run test:run`
Expected: lint clean (no new errors vs the ~170 baseline), `tsc -b` passes, all tests pass
(including the 5 new inbox tests).

- [ ] **Step 2: Final review commit (only if lint auto-fixes changed files)**

```bash
git add -A
git commit -m "chore: lint/format pass for journal-qol + homepage rebalance"
```

---

## Self-Review

**Spec coverage:**
- §1.1 `journal-notes.md` + gitignore → Task 1. Active-part marker header → Tasks 2/3/4 set it.
- §1.2 `/note` command → Task 2.
- §1.3 `/start-part` create-first + one-active-part guard + notes init → Task 3.
- §1.4 `/finish-part` fold + reset → Task 4.
- §1.5 iPhone doc → Task 5.
- §2.1 `TriageInboxCard` (local count, hides when empty, indigo accent) → Tasks 6 (helper) + 7.
- §2.2 `view: 'triage'` deep-link → Task 9.
- §2.3 compact capture bar → Task 8.
- §2.4 homepage layout (compact capture; routine → triage → insight) → Task 10.
- Testing (inbox predicate unit test; manual checks) → Task 6 + manual steps + Task 11.

**Placeholder scan:** none — all command/doc files and code blocks are complete and literal.

**Type consistency:** `isInInbox`/`countInbox` defined in Task 6 are used verbatim in Task 7;
`compact` prop added in Task 8 is the same name used in Task 10; `view: 'triage'` produced in Task 7
matches `initialParams?.view === 'triage'` consumed in Task 9. `onNavigate` signature
`(tab: AppRoute, params?: Record<string, unknown>) => void` matches `HomePage`'s prop.
