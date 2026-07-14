---
description: Run typecheck, lint (changed files only), and tests; report only the failures.
allowed-tools: Bash(npx tsc:*), Bash(npx eslint:*), Bash(npx vitest:*), Bash(git diff:*), Bash(git ls-files:*)
---

Run the project's quality gate. Keep context small: never dump full logs — always trim with `head`/`tail` as shown.

Run these (continue even if earlier ones fail):

1. **Typecheck:** `npx tsc -b --pretty false 2>&1 | head -30`
2. **Lint — changed files ONLY.** The repo has a known ~170-error lint baseline; never run `npm run lint` on everything. Collect changed files (`git diff --name-only HEAD` plus `git ls-files --others --exclude-standard`), keep only `src/**/*.ts|tsx`, then `npx eslint <files> 2>&1 | tail -40`. No changed files → report "lint: skipped (no changed src files)".
3. **Tests:** `npx vitest run --reporter=dot 2>&1 | tail -30`

Then report:
- One PASS/FAIL line per step.
- For FAILs, only the actual errors (file:line + message) — no logs.
- End with a one-line verdict: is the working tree safe to commit?

Do not attempt fixes unless the user asks — this command only reports.
