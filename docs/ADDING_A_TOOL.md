# Adding a New Tool to the Assistant

This guide walks through adding a new tool to the multi-agent assistant so that it slots into the existing 3-tier routing pipeline (slash commands → rules → AI classification) with no manual wiring.

Everything downstream — the General Manager, Domain Managers, command parser, rule engine, AI classifier, and `/help` — auto-discovers from the tool registry. Your job is to produce one `ToolDefinition` and register it.

Related reading: `ARCHITECTURE_PLAN.md` (big picture), `CLAUDE.md` (table names and gotchas).

---

## TL;DR Checklist

1. Decide the **domain** the tool belongs to (existing or new).
2. Add every new action name to the `Intent` union in `supabase/functions/assistant/types.ts`.
3. Create `supabase/functions/assistant/tools/<my-tool>.tool.ts` exporting a `ToolDefinition`.
4. Import and add it to `ALL_TOOLS` in `supabase/functions/assistant/tools/registry.ts`.
5. (If the domain is new) add it to the `Domain` union in `types.ts` and to `DOMAINS` in `managers/index.ts`.
6. (If new tables are needed) add a numbered migration in `supabase/migrations/` and apply it (MCP or CLI).
7. Deploy the edge function: `supabase functions deploy assistant`.
8. Add a test in `src/features/assistant/tests/` or `supabase/functions/assistant/tests/`.

---

## 1. Pick the Domain

Existing domains (see `types.ts` → `Domain`):
`planning | health | mental | content | improvement | studying | projects | extra`

Rule of thumb: reuse an existing domain unless the new capability is genuinely orthogonal to all of them. A new domain costs nothing at runtime (managers are factory-built) but it does add a concept users have to reason about.

**Adding a new domain:**
- Add the string literal to the `Domain` union in `supabase/functions/assistant/types.ts`.
- Append it to the `DOMAINS` array in `supabase/functions/assistant/managers/index.ts`.

---

## 2. Declare the Intents

Every action a tool exposes must have a unique string in the `Intent` union (`types.ts`). The naming convention is `<tool-area>.<verb>`:

```ts
// types.ts
export type Intent =
  | ...existing intents...
  // Flashcards (new tool)
  | 'flashcard.create'
  | 'flashcard.review'
  | 'flashcard.stats'
```

Why this matters: the `Intent` union is the single source of truth used by the AI classifier prompt, the rule engine, the command parser, and `DomainManager.hasAction()`. If an action isn't in the union, TypeScript catches it at build time.

---

## 3. Write the Tool File

Create `supabase/functions/assistant/tools/flashcards.tool.ts`. A tool has four pieces:

### 3a. Action handlers

Each handler is `(params, context) => Promise<ToolResult>`. `context` gives you `userId`, `supabase` (service-role client — RLS is bypassed, so **always filter by `context.userId` yourself**), `source`, and optional `aiConfig`.

```ts
import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

async function handleFlashcardCreate(
  params: Record<string, unknown>,
  context: AgentContext,
): Promise<ToolResult> {
  const content = (params.content as string) || ''
  if (!content.trim()) {
    return { success: false, action_taken: 'Give a front/back: /flashcard Front :: Back', data: {} }
  }
  const [front, back] = content.split('::').map(s => s.trim())
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const { data, error } = await supabase
    .from('flashcards')
    .insert({ user_id: context.userId, front, back })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to create flashcard', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Flashcard created: ${front}`,
    data: { id: data.id },
    suggestions: ['/flashcard.review'],
  }
}
```

Handler conventions:
- Return `success: false` with a helpful `action_taken` when input is malformed — do not throw.
- Put machine-readable context under `data`; put user-facing text under `action_taken`.
- Use `suggestions` to nudge the user toward logical follow-up commands.
- **Never forget `user_id: context.userId`** on inserts and `.eq('user_id', context.userId)` on selects. Edge functions use the service role key which bypasses RLS.

### 3b. Tool definition

```ts
export const flashcardsTool: ToolDefinition = {
  id: 'flashcards',
  domain: 'studying',
  description: 'Spaced-repetition flashcards',

  actions: [
    { action: 'flashcard.create', description: 'Create a flashcard', handler: handleFlashcardCreate },
    { action: 'flashcard.review', description: 'Review due flashcards', handler: handleFlashcardReview },
    { action: 'flashcard.stats',  description: 'View flashcard stats',  handler: handleFlashcardStats  },
  ],

  commands: [
    { command: '/flashcard',        action: 'flashcard.create', description: 'Create flashcard: /flashcard Front :: Back' },
    { command: '/flashcard.review', action: 'flashcard.review', description: 'Review due flashcards' },
    { command: '/flashcard.stats',  action: 'flashcard.stats',  description: 'Flashcard statistics' },
  ],

  rules: [
    {
      pattern: /\b(?:flashcard|kaartje|review cards)\b/i,
      action: 'flashcard.review',
    },
  ],
}
```

Rule-writing tips:
- Keep patterns tight. A too-generic rule (e.g. `/learn/i`) will swallow input intended for other tools.
- The command parser picks the **longest** matching prefix, so `/flashcard.review` wins over `/flashcard`. No extra work needed.
- If a rule needs to extract structured params from the match, provide `extractParams`. Otherwise the whole input is passed as `{ content: input }`.

---

## 4. Register the Tool

Open `supabase/functions/assistant/tools/registry.ts` and add one import + one array entry:

```ts
import { flashcardsTool } from './flashcards.tool.ts'

export const ALL_TOOLS: ToolDefinition[] = [
  // ...existing...
  flashcardsTool,
]
```

That's the entire wiring step. The General Manager, Domain Managers, `/help`, the AI classifier's system prompt, and the rule engine all rebuild themselves from `ALL_TOOLS`.

---

## 5. Database Schema (if needed)

If the tool needs a new table:

1. Create a numbered migration: `supabase/migrations/<NNNN>_flashcards.sql`.
2. Always enable RLS and add a user-scoped policy — the frontend uses the anon key and will be blocked otherwise.

```sql
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back  text not null,
  created_at timestamptz not null default now()
);

alter table public.flashcards enable row level security;

create policy "own rows" on public.flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

3. Apply the migration. Preferred path on this project is Supabase MCP (project id `kdwgznfszbrysepsltua`); CLI push also works.
4. Document the table in `CLAUDE.md` under "Table → Purpose mapping" and `ARCHITECTURE_PLAN.md` under "Core App Tables".

**Naming gotchas** (from `CLAUDE.md`): tasks live in `todos`, health check-ins live in `entries`. Don't invent plural forms.

---

## 6. Deploy and Verify

```bash
supabase functions deploy assistant
npm run build   # catches type errors; `npx tsc --noEmit` hangs on this repo
```

Smoke-test from the DevPanel or chat:
- Slash command: `/flashcard Capital of France :: Paris`
- Natural language: `flashcard review`
- Unmatched: ensure the AI classifier picks it up or falls through to `general.question`.

Check `assistant_logs` to confirm `detection_method`, `domain`, and `tool_id` are set correctly. Errors land in `assistant_error_logs` with the pipeline step — useful when the routing went to the wrong place.

---

## 7. Tests

Existing test locations:
- `supabase/functions/assistant/tests/` — unit tests for registry, classifier, rule engine.
- `src/features/assistant/tests/` — Vitest tests for the frontend-facing surface.

Minimum-viable test: prove that the slash command and at least one rule route to the right `{ domain, action }`. The tool-registry test in `src/features/assistant/tests/tool-registry.test.ts` is a good template.

Run: `npm run test:run` (or `npx vitest run <path>` for a single file).

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
| --- | --- | --- |
| New `Intent` string not added to the union | TypeScript error in tool file | Add it to `types.ts` first |
| Handler forgets to filter by `user_id` | Cross-user data leak (service role bypasses RLS) | Always `.eq('user_id', context.userId)` |
| Rule pattern too broad | Tool "steals" input from other tools | Tighten regex; add word boundaries |
| Two commands share a prefix | Shorter one wins unexpectedly | Longest-match is built in — just don't register the shorter one at a more specific action |
| Migration added but not applied | 500 errors from edge function | Apply via MCP or `supabase db push` |
| Forgot to deploy edge function | Old behavior persists after code change | `supabase functions deploy assistant` |
| `tsc --noEmit` hangs | Build appears frozen | Use `npm run build` |

---

## Where Things Get Auto-Wired

For the curious, here is what reads `ALL_TOOLS` at runtime:

- `core/command-parser.ts` — builds `/help` list and slash → action map.
- `core/rule-engine.ts` — flattens all `rules[]` into the Tier-2 matcher.
- `core/ai-classifier.ts` — injects intent + domain lists into the classifier prompt.
- `managers/base.manager.ts` — builds per-domain action → handler maps.
- `managers/index.ts` — instantiates one manager per domain.

If you ever add a feature that needs registry awareness (analytics, docs generation, etc.), iterate `ALL_TOOLS` — don't maintain a parallel list.
