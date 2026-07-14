# Testing

| Command | Purpose |
| --- | --- |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run the unit suite once |
| `npm run test:coverage` | Run unit tests with a coverage report |
| `npm run e2e` | Run Playwright browser tests |

Unit tests live next to the code or in feature `tests/` folders. Focus new unit tests on pure logic: parsers, date calculations, task ordering and routing, converters, schemas, and assistant rules. Mock Supabase/network boundaries when testing services.

React pages, hooks, and remote I/O are primarily verified through manual and Playwright flows. The coverage report is generated in `coverage/`; treat its current output as the source of truth rather than recording stale percentages here.

Vitest runs in jsdom with globals enabled and setup in `src/test/setup.ts`.
