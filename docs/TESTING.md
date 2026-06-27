# Testing & Coverage Dashboard

A living overview of **what is tested and how well**. Regenerate the numbers any
time with `npm run test:coverage`.

> Last refreshed: 2026-06-21 · **24 test files · 335 tests passing**

---

## How to run

| Command | What it does |
| --- | --- |
| `npm test` | Vitest in watch mode (re-runs on save) |
| `npm run test:run` | Single full run (CI-style) |
| `npm run test:coverage` | Full run **+ coverage report** |
| `npx vitest run path/to/file.test.ts` | Run a single test file |

After `npm run test:coverage`, open the interactive HTML report:

```
coverage/index.html   ← click through every file, line-by-line
```

The terminal prints a per-file table; `coverage/coverage-summary.json` holds the
machine-readable totals.

---

## What we test (and what we don't)

This project deliberately concentrates unit tests on **pure logic** — the code
where a wrong line silently corrupts data or routing. UI and I/O are validated
differently, so they're excluded from the coverage scope to keep the numbers
honest and actionable (configured in `vitest.config.ts`).

| Layer | Unit-tested? | Why |
| --- | --- | --- |
| Utils, parsers, converters, calculations | ✅ Yes — target ~90%+ | Pure functions; cheap to test, expensive to get wrong |
| Rule engine / command parsing (assistant) | ✅ Yes | Routing correctness is critical |
| React components & pages (`.tsx`) | ❌ No | MVP decision; covered by manual/E2E (Playwright) |
| Hooks (`useX.ts`) | ❌ Not yet | Thin React-Query wrappers over the data layer |
| Supabase operations / network services | ❌ No | I/O against live Supabase; covered manually / via E2E |
| Type-only modules, barrels, constants | ❌ N/A | No executable logic |

---

## Coverage by tier

`npm run test:coverage` measures **every `.ts` logic file** (`all: true`), so the
headline % includes large I/O layers we don't unit-test by design. Read it by
tier, not as a single number.

### Tier 1 — Pure logic (our actual unit-test target)

These are the files unit tests are meant to cover. They are in good shape:

| File | Stmts | Covered by |
| --- | --- | --- |
| `src/utils/analysis.ts` | 100% | `analysis.test.ts` |
| `src/services/supabase/converters/todo.ts` | 100% | `converters/todo.test.ts` ⭐ new |
| `src/features/tasks/utils/sanitizeTriageSuggestions.ts` | 100% | `sanitizeTriageSuggestions.test.ts` |
| `src/features/tasks/utils/taskRecommender.ts` | 100% | `taskRecommender.test.ts` |
| `src/features/tasks/utils/taskKind.ts` | 95% | `taskKind.test.ts` |
| `src/features/tasks/utils/quickCaptureParser.ts` | 96% | `quickCaptureParser.test.ts` |
| `src/features/core/utils/todaySummary.ts` | 96% | `todaySummary.test.ts` |
| `src/features/day/services/routine-progress.ts` | 95% | `routine-progress.test.ts` |
| `src/services/offline/captureOutbox.ts` | 95% | `captureOutbox.test.ts` |
| `src/features/tasks/services/triageLearnings.ts` | 88% | `triageLearnings.test.ts` ⭐ new |

The assistant suite (`src/features/assistant/tests/*`) additionally validates the
rule engine, command parser, AI classifier, schema validator and tool registry.
That logic mostly lives in the Deno edge functions (`supabase/functions/`), which
are outside this frontend coverage scope — the tests reproduce/exercise the rules
directly, so the behaviour is covered even though it doesn't show in the table.

### Tier 2 — Known gaps (highest-value next tests)

Pure, easy-to-test logic currently at **0%** — the best ROI for new tests:

| File | Why it's worth testing |
| --- | --- |
| `src/services/supabase/converters/{tracker,goal,school,planning,protocol,…}.ts` | Pure `dbToX`/`xToDb` mappers, same shape as the now-100% `todo` converter |
| `src/features/tasks/utils/recurrence.ts` | Recurrence date math — easy to get off-by-one |
| `src/features/health-tracking/utils/stats.ts` | Tracker statistics / aggregation |
| `src/lib/validation/schemas.ts` & `src/services/settings/settings.schemas.ts` | Zod schemas — validate accept/reject cases |

### Tier 3 — Intentionally not unit-tested

Hooks (`**/hooks/**`), Supabase operations (`operations/**`), and network
services (notifications, calendar/Google sync, AI providers). These are exercised
through manual testing and the Playwright E2E suite (`npm run e2e`).

---

## Test inventory

| Test file | Subject under test |
| --- | --- |
| `utils/analysis.test.ts` | Correlation / analysis math |
| `core/tests/todaySummary.test.ts` | Home "today" summary builder |
| `day/tests/routine-progress.test.ts` | Daily routine completion tracking |
| `planning/tests/closeDay.test.ts` | Close-day reflection logic |
| `notifications/tests/day-of-week-picker.test.ts` | Day-of-week picker component logic |
| `tasks/utils/quickCaptureParser.test.ts` | Natural-language quick-capture parsing |
| `tasks/utils/taskKind.test.ts` | `deriveTaskKind` classification |
| `tasks/utils/taskRecommender.test.ts` | "Next up" task recommendation |
| `tasks/utils/organizeSuggestions.test.ts` | AI organize-suggestion sanitising |
| `tasks/utils/sanitizeTriageSuggestions.test.ts` | AI triage-suggestion sanitising |
| `tasks/utils/triageRouting.test.ts` | Triage destination → write routing |
| `tasks/services/triageLearnings.test.ts` ⭐ | Triage correction doc (append, 40-cap, format) |
| `services/supabase/converters/todo.test.ts` ⭐ | Todo ↔ DB row mapping (null/undefined, `??` vs `||`, round-trip) |
| `services/offline/tests/captureOutbox.test.ts` | Offline capture outbox |
| `assistant/tests/rule-engine.test.ts` | Tier-2 NL routing rules |
| `assistant/tests/command-parser.test.ts` | Slash-command parsing |
| `assistant/tests/ai-classifier.test.ts` | Intent classification |
| `assistant/tests/date-parser.test.ts` | Date expression parsing |
| `assistant/tests/schema-validator.test.ts` | Tool-arg schema validation |
| `assistant/tests/tool-registry.test.ts` | Tool registry wiring |
| `assistant/tests/agent-loop.test.ts` | Assistant agent loop |
| `assistant/tests/general-manager.test.ts` | GM supervisor logic |
| `assistant/tests/hr-analyzer.test.ts` | HR-agent analysis |
| `assistant/tests/rule-generator.test.ts` | Trainer-agent rule generation |

⭐ = added in the 2026-06-21 quality pass.

---

## Conventions

- Tests live **next to the code** (`foo.ts` → `foo.test.ts`) or in a feature
  `tests/` folder. Both are picked up by `vitest.config.ts`.
- Vitest globals are enabled — no need to import `describe`/`it`/`expect`.
- Environment is `jsdom`; setup in `src/test/setup.ts` adds jest-dom matchers.
- Mock the data layer (`@/services/supabase`) with `vi.mock` when testing a
  service in isolation — see `triageLearnings.test.ts` for the pattern.
