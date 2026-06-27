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
