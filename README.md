# Student Buddy

Student Buddy is a React PWA that helps students capture tasks, choose a manageable next step, follow daily routines, and reflect on their progress. It combines task triage, school planning, health tracking, reminders, focus tools, and a structured AI assistant.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. See [the quickstart](docs/help/QUICKSTART.md) for details.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run lint` | Run ESLint |
| `npm run test:run` | Run unit tests once |
| `npm run e2e` | Run Playwright end-to-end tests |

## Documentation

- [Design and current status](docs/DESIGN.md)
- [Tasks and capture-triage](docs/tasks.md)
- [Testing](docs/TESTING.md)
- [Documentation index](docs/README.md)

Developer conventions and database notes are in [CLAUDE.md](CLAUDE.md).
