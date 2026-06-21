---
description: Run lint, typecheck, and tests; summarize only the failures.
allowed-tools: Bash(npm run lint), Bash(npx tsc -b), Bash(npm run test:run), Bash(npx prettier --check .)
---

Run the project's quality gate and report results concisely.

Run these (continue even if earlier ones fail) and collect output:
1. `npm run lint`
2. `npx tsc -b`
3. `npm run test:run`

Then summarize:
- A one-line PASS/FAIL per step.
- For FAILs, list only the actual errors (file:line + message), not the full log. Note that the lint step has a known pre-existing baseline of errors — distinguish baseline noise from anything in the user's current diff (`git diff --name-only`) where possible.
- End with a short verdict: is the working tree safe to commit?

Do not attempt fixes unless the user asks — this command only reports.
