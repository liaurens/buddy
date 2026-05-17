# AI Capture And Tool Interaction Deep Dive

Date: 2026-05-13

## Scope

This document reviews the current AI capture path in Buddy and how it interacts with backend tools. The user phrasing was "AI trough capture"; there is no `trough` symbol, file, route, or feature in the repo, so this analysis treats that as "AI through capture": the capture surfaces that send user input into the assistant, and the assistant/tool pipeline that turns that input into actions.

Files reviewed include:

- `src/components/CaptureFAB.tsx`
- `src/features/assistant/components/AssistantPromptBar.tsx`
- `src/features/assistant/components/AssistantChat.tsx`
- `src/features/assistant/services/assistant.service.ts`
- `supabase/functions/assistant/index.ts`
- `supabase/functions/assistant/core/general-manager.ts`
- `supabase/functions/assistant/core/agent-loop.ts`
- `supabase/functions/assistant/core/ai-wrapper.ts`
- `supabase/functions/assistant/tools/*.tool.ts`
- `docs/buddy_streamlining_plan.md`
- `docs/help/ADDING_A_TOOL.md`
- `PROJECT_DESCRIPTION.md`

## Executive Summary

The architecture is strong: Buddy has a centralized assistant edge function, a registry-driven tool system, command/rule fast paths, an agentic tool-use loop, provider abstraction for Anthropic/OpenAI/Gemini, structured schemas for most tools, and logging that feeds HR/trainer agents. That is the right foundation for capture-first product behavior.

The main weakness is that the capture surfaces are not yet unified. The home prompt, full Capture chat, floating action button, and iPhone Shortcut capture paths behave differently. The iPhone path can use either the legacy `quick-note` endpoint or the real `assistant` endpoint, but the product/documentation should make the assistant-backed path the primary one when the user wants AI routing.

The biggest concrete issue: long-press voice capture in `CaptureFAB` writes the transcript to `sessionStorage` under `captureFAB.voiceDraft`, then navigates to the `assistant` route. The `assistant` route renders `AssistantChat`, but only `AssistantPromptBar` reads that session storage key. Since the FAB is hidden on Home and Assistant, the normal long-press path probably stores a transcript that is not consumed until the user later visits Home.

## Current Capture Surfaces

### 1. Home Prompt Bar

File: `src/features/assistant/components/AssistantPromptBar.tsx`

This is the most capture-oriented surface:

- Uses a textarea.
- Supports auto-grow up to 200px.
- Seeds from `sessionStorage.getItem('captureFAB.voiceDraft')`.
- Supports slash-command hints.
- Splits "brain dump" input on blank lines and sends each chunk sequentially.
- Writes user and assistant messages to local conversation history.
- Renders `AssistantResponseCard` for the most recent response.

This is the best current implementation of "capture anything." It handles multi-line input and batch-like capture better than the full chat.

Limitations:

- Only shown on Home.
- Uses frontend hardcoded commands from `src/features/assistant/constants/commands.ts`, not the backend registry.
- Brain dumps split only on blank lines, not each line or checkbox-style input.
- Each chunk is sent as an independent assistant call, so multi-item capture has no shared transaction, no bulk summary, and no cross-item dedupe.

### 2. Full Capture Chat

File: `src/features/assistant/components/AssistantChat.tsx`

This is the `assistant` route. It is more of a conversation UI:

- Uses a single-line input.
- Stores local conversations in `localStorage`.
- Shows a sidebar of conversations.
- Shows command hints.
- Sends exactly one input at a time.

Limitations:

- Does not read `captureFAB.voiceDraft`.
- Does not support textarea input.
- Does not support brain-dump chunking.
- Duplicates command hint logic instead of sharing the richer `AssistantPromptBar` behavior.
- Uses the same stale frontend command list.

Product implication: the thing named "Capture" is less capable as a capture tool than the prompt embedded on Home.

### 3. Floating Capture FAB

File: `src/components/CaptureFAB.tsx`

Behavior:

- Hidden on `home` and `assistant`.
- Tap navigates to `assistant`.
- Long press starts browser `SpeechRecognition`.
- On speech result, navigates to `assistant` and stores the transcript in `sessionStorage`.

What is good:

- Persistent capture entry point is the right interaction model.
- Long-press voice is low-friction.
- It uses native browser speech recognition, so no AI transcription cost.

Critical issue:

- The transcript is stored for `AssistantPromptBar`, but the FAB navigates to `AssistantChat`.
- `AssistantChat` never reads `captureFAB.voiceDraft`.
- The transcript is therefore not shown in the Capture input after voice capture.

Other limitations:

- Voice capture does not auto-submit. That is conservative and probably correct, but the confirmation UI needs to reliably receive the transcript.
- Browser `SpeechRecognition` support is uneven, especially in iOS PWA mode.
- There is no fallback path to typed capture after unsupported voice besides an alert.
- No visual state is shown beyond the button icon/animation.

### 4. iPhone Shortcut Capture

Files:

- `supabase/functions/quick-note/index.ts`
- `supabase/functions/assistant/index.ts`
- `supabase/functions/assistant/auth.ts`

There are two viable iPhone Shortcut modes.

#### Mode A: Fast Quick Note

Endpoint:

```text
POST /functions/v1/quick-note
```

Request body:

```json
{
  "content": "Buy milk -boodschap",
  "api_key": "YOUR_API_KEY"
}
```

Behavior:

- Uses the separate `quick-note` edge function.
- Authenticates using `quick_note_api_key`.
- Parses a `-flag`.
- Inserts directly into `smart_notes`.
- Does not require an AI provider key.

This mode is useful as a cheap, deterministic fallback for saving raw notes.

#### Mode B: Real AI Assistant Capture

Endpoint:

```text
POST /functions/v1/assistant
```

Request body:

```json
{
  "input": "Add a task to call the dentist tomorrow at 9 and remind me",
  "api_key": "YOUR_API_KEY",
  "source": "iphone"
}
```

Behavior:

- Uses the main assistant edge function.
- Authenticates with the same `quick_note_api_key` lookup in `assistant/auth.ts`.
- Loads the user's configured AI provider/API key/model from `settings`.
- Runs the normal assistant pipeline: slash commands, legacy flags, static rules, dynamic rules, and then the agentic AI tool loop when an AI key is configured.
- Can create tasks, notes, reminders, mood logs, journal entries, goals, school assignments, checklist interactions, strategy lookups, and other registered tool actions.
- Writes normal assistant logs, so HR/trainer learning can see these captures.
- Lets Siri/Shortcuts capture natural language without embedding the user's Anthropic/OpenAI/Gemini key in the Shortcut.

Suggested Shortcut response handling:

- Use "Get Contents of URL" with method `POST`.
- Send JSON to `/functions/v1/assistant`.
- Show `action_taken` from the JSON response in a notification.
- Optionally show `steps` when present for multi-tool actions.

What is good:

- Low-friction, reliable, API-key based shortcut capture.
- Does not require the full Supabase auth session from Shortcuts.
- Can be cheap and deterministic through `quick-note`, or fully AI/tool-capable through `assistant`.
- The assistant path uses the user's own configured AI settings and keeps provider secrets server-side.

Limitations:

- The legacy `quick-note` path still bypasses the assistant tool system.
- The legacy `quick-note` path can only create notes.
- The assistant path depends on the user's AI settings when the input requires real AI; without an AI provider key, it still handles slash/rule/legacy captures but cannot do open-ended AI reasoning.
- The request body currently has no `timezone`, `clientRequestId`, or explicit `mode`, so Siri/Shortcut captures can still suffer from date ambiguity and duplicate submission.
- The existing Shortcut docs should clearly offer both modes and recommend the assistant endpoint for real AI capture.

Product implication: mobile capture does not need to be note-only. The app already has the auth and assistant plumbing to support real AI capture from iPhone/Siri; the remaining work is to document it, make it robust, and optionally keep `quick-note` as a fast fallback.

## Backend Assistant Flow

Current flow for normal web assistant requests:

```text
UI capture
  -> sendAssistantMessage(input)
  -> Supabase edge function: assistant
  -> authenticateRequest()
  -> load user's AI settings
  -> handleRequest(input, context)
       1. parseSlashCommand()
       2. parseLegacyFlag()
       3. matchRules()
       4. loadDynamicRules() + matchDynamicRules()
       5. if AI key exists: runAgentLoop()
       6. otherwise: general.question setup message
  -> ToolResult / AssistantResponse
  -> assistant_logs and assistant_error_logs
```

Direct invocation also exists:

```text
invokeAssistantAction(domain, action, params)
  -> assistant edge function
  -> skip routing
  -> getManager(domain).execute(action, params, context)
```

In the current frontend, direct invocation is only found in clarification candidate buttons. The broader claim in `PROJECT_DESCRIPTION.md` that dedicated UIs bypass routing by directly calling tools is not true across the inspected app surface.

## Tool System

The backend tool architecture is registry-first:

- `supabase/functions/assistant/tools/registry.ts` imports all tools and exports `ALL_TOOLS`.
- `command-parser.ts` builds slash-command maps from `ALL_TOOLS`.
- `rule-engine.ts` flattens static rules from `ALL_TOOLS` and loads dynamic rules from `assistant_rules`.
- `base.manager.ts` creates per-domain action maps from `ALL_TOOLS`.
- `agent-loop.ts` exposes all schema-backed actions as AI callable tools.
- `system.help` dynamically reads `ALL_TOOLS` for the live backend command list.

Current backend tool coverage from the registry:

| Domain | Tools |
| --- | --- |
| `planning` | tasks, task routines, task types, checklists, calendar, habits, notifications |
| `health` | tracker, experiment agent |
| `mental` | mood, journal |
| `content` | notes |
| `improvement` | goals, skills, strategies |
| `studying` | study |
| `projects` | projects |
| `school` | school |
| `extra` | context, system |

There are 20 registered tool files and about 64 schema-backed actions exposed to the agent loop. A few actions remain intentionally schema-less, such as `general.question`, to prevent recursive tool calling.

## What Works Well

### Strong capture-first foundation

The backend already treats natural language as an action surface. The user can type "add a task to call mom tomorrow", "log mood 4", "what should I work on", or `/task ...`, and the same assistant endpoint is intended to decide what to do.

### Cost-aware routing

The pipeline tries cheap paths first:

1. Slash commands.
2. Legacy flags.
3. Static regex rules.
4. Dynamic trainer-generated rules.
5. AI tool loop only when needed and configured.

That is a good structure for frequent capture, where most inputs should become near-zero-cost over time.

### Registry-driven backend

Backend tool discovery is mostly centralized. Adding a backend tool requires adding a tool definition and registering it. Commands, rules, managers, and help output then work from the same source.

### Structured tool calling

Most actions have `inputSchema`, and `agent-loop.ts` validates model-generated arguments before executing handlers. Validation failures are fed back to the model, giving it a chance to self-correct.

### Multi-step AI behavior

The agent loop supports multiple tool calls across turns, up to 8 iterations and 15 total tool executions. This makes requests like "create this assignment and remind me two days before" possible without adding a custom orchestration endpoint for every workflow.

### Provider abstraction

The assistant supports Anthropic, OpenAI, and Gemini in one wrapper, including tool/function calls and document tool calls for import flows.

### Observability and learning hooks

The system logs assistant interactions to `assistant_logs`, tool failures to `assistant_error_logs`, and has HR/trainer agents that can generate findings and dynamic routing rules. This is a good base for making the assistant cheaper and better with actual usage.

### Service-role risk is acknowledged in code conventions

The tool guide explicitly warns that edge functions bypass RLS and handlers must filter by `context.userId`. Most inspected handlers follow that pattern.

## What Can Be Better

### Unify the two web capture UIs

`AssistantPromptBar` and `AssistantChat` should not have separate capture semantics. Today:

| Capability | Home PromptBar | Full Capture Chat |
| --- | --- | --- |
| Textarea | Yes | No |
| Voice draft consumption | Yes | No |
| Brain-dump chunking | Yes | No |
| Conversation sidebar | No | Yes |
| Command hints | Yes | Yes, duplicated |

The full Capture route should use the same input component/logic as the Home prompt, or both should share a `CaptureInput` core.

### Fix voice capture handoff

The current long-press voice path writes to `sessionStorage` but navigates to a component that does not read it. That breaks the intended zero-friction voice flow.

Recommended behavior:

- Long-press transcribes.
- Navigate to Capture.
- Fill the Capture input with the transcript.
- Focus input with caret at the end.
- Let user edit and submit.

### Replace hardcoded frontend command hints

Backend `/help` can list all registered commands, but frontend hints only include 13 commands. The backend registry exposes many more, including:

- `/journal`
- `/reflect`
- `/mood`
- `/mood.history`
- `/study`
- `/study.stats`
- `/routine`
- `/routines`
- `/routine.run`
- `/experiment`
- `/experiments`
- `/context`
- `/strategy`
- `/strategies`
- `/goal`
- `/goals`
- `/skill`
- `/skills`
- `/checklist`
- `/checklists`
- `/project`
- `/projects`
- `/tasktype`
- `/tasktypes`

The frontend command list is already drifting from the backend tool registry. This makes discovery worse than actual capability.

### Clarification UI is not wired to the current Tier 3 path

There is an `ai-classifier.ts` that supports confidence and alternatives, and `AssistantResponseCard` can render clarification candidate buttons. But `general-manager.ts` now uses `runAgentLoop()` as Tier 3 when AI is configured, not `classifyWithAI()`.

Current behavior:

- Empty agent loop returns `data.clarify = true`.
- It does not return `data.candidates`.
- The clarification button UI has little or no current path to receive candidates.

The docs and tests still describe an AI classifier fallback, while runtime uses an agentic tool loop. The product intent is good, but the implementation and docs have diverged.

### Tool list is too broad for every AI request

The agent loop exposes all schema-backed actions to the model on every AI-routed request. That improves capability but increases:

- Prompt size.
- Token cost.
- Tool-selection confusion.
- Chance of unrelated tools being called.

A better pattern is two-stage:

1. Cheap route/domain narrowing.
2. Expose only the likely domain tools plus a few global tools like `context.summary` and `system.help`.

### Timezone handling is too weak for date-heavy capture

`agent-loop.ts` says "Today's date (user's local)" but computes it with `new Date().toISOString().slice(0, 10)`, which is UTC date on the edge runtime, not necessarily the user's local date.

This affects:

- "tomorrow"
- "next Tuesday"
- reminders at local times
- assignments due dates
- daily planning/check-in flows

The frontend knows the user's browser timezone, but it is not passed in `AssistantRequest`.

### Multi-step actions lack transaction semantics

The agent loop can execute several tools, but there is no transaction or rollback. This is acceptable for best-effort assistant behavior, but risky for requests that create related objects:

- assignment + reminder
- class + assignment
- project + task
- routine + routine items
- task + notification

Some tools implement atomic composition internally, such as school assignment creation with reminder fields. That pattern should be preferred for common multi-object workflows.

### Dedupe and idempotency are missing

Repeated submits or network retries can create duplicates. The assistant request body has no client-generated idempotency key, and tool handlers do not appear to dedupe recent equivalent captures.

This matters most for:

- voice capture, where users may retry after UI uncertainty
- brain dumps, where partial failure can lead to resubmission
- quick iPhone capture, where Shortcuts can be tapped repeatedly

### Direct tool invocation is underused

The direct path exists and is useful. It should be used by dedicated UI flows where intent is already known, but current code search only found it in clarification buttons.

Examples where direct invocation could reduce duplication:

- task form submit
- quick note submit
- mood check-in
- routine run
- checklist item check
- school assignment create

This would make assistant logs reflect more of the user's actual capture/actions and reduce parallel business logic.

### Tests do not fully validate the real registry

`tool-registry.test.ts` uses mock tools and a mock `Domain` union that does not include `school`. That validates the pattern, not the actual registry. It would not catch:

- a real command collision
- an action missing from the `Intent` union
- a command pointing at a missing action in a real tool
- a new domain missing from `DOMAINS`
- missing `inputSchema` coverage for agent-callable actions

### Documentation is stale in key places

Examples:

- `PROJECT_DESCRIPTION.md` and `docs/help/ADDING_A_TOOL.md` describe Tier 3 as AI classification, but runtime uses an agentic tool-use loop.
- `docs/buddy_streamlining_plan.md` says phase 2 has a shared command registry; the frontend still has a hardcoded command list.
- The iPhone Shortcut setup should distinguish fast `quick-note` capture from real AI assistant capture.

## What Is Missing

### A single capture contract

There should be one conceptual contract for capture:

```ts
CaptureInput {
  text: string
  source: 'home' | 'capture' | 'fab_voice' | 'iphone' | 'siri' | 'shortcut'
  mode?: 'single' | 'brain_dump' | 'voice_draft'
  timezone: string
  clientRequestId: string
}
```

All capture surfaces should feed this same contract into the assistant endpoint.

### A first-class bulk capture action

Current brain-dump support is frontend-only: split on blank lines and send each chunk as a separate request. A backend `capture.bulk` or `system.capture_bulk` action would allow:

- one response summarizing all created items
- one idempotency key
- consistent partial-failure reporting
- better dedupe
- easier mobile/shortcut support
- learning from whole brain dumps rather than isolated chunks

### A command metadata endpoint or shared registry

The frontend needs backend command metadata without importing Deno edge-function modules into Vite. Options:

- Add assistant action `system.commands` returning registry commands and primary suggestions.
- Generate a shared JSON file from `ALL_TOOLS`.
- Keep a shared TypeScript metadata file for command labels only.

The lowest-risk option is a `system.commands` action and a cached frontend hook.

### A rule-preview endpoint

The streamlining plan mentions a ghost chip like "-> shopping list" before send. That is still missing.

A lightweight endpoint could run the non-mutating routing tiers:

- slash command parse
- legacy flag parse
- static rule match
- dynamic rule match

It should return `{ domain, action, label, confidenceSource }` without executing anything.

### A unified capture inbox/view

`RecentCaptures` currently merges:

- todos
- smart_notes
- entries

It excludes many assistant-created objects:

- checklists
- goals
- projects
- skills logs
- strategies
- routines
- school assignments
- notifications
- journal entries if stored as categorized notes may appear, but not semantically

The app needs a broader "captured objects" view or a lightweight `captures` projection if capture is the primary interaction model.

### Stronger tool coverage for core app actions

The assistant can create/list many things, but several important actions are missing or thin:

- Plan actions exist in the `Intent` union but there is no registered planner tool.
- Calendar only has `calendar.today`; no create/update/delete event tool.
- Tasks can create/list/complete/remind, but no update, delete, snooze, priority change, project assignment through task tool, or subtask management.
- Notes can create/query, but no update/delete/category management.
- Notifications can schedule, but no list/cancel/update general notifications.
- Tracker can check in/query, but no tracker create/update through assistant.
- Protocols are not exposed as assistant tools.
- Experiments are mostly delegated to `experiment.ask` and `experiment.list`.
- School import/document analysis is separate from assistant tools.

### User confirmation policy

The assistant currently biases toward action. That is correct for capture, but some actions should probably require confirmation:

- delete
- bulk complete
- destructive updates
- sending notifications to external surfaces
- overwriting routines/checklists
- creating many items from one vague brain dump

The missing piece is not a blanket confirmation step; it is a per-action risk level in tool metadata.

### Tool result normalization

Tool results are user-facing strings plus arbitrary data. That works, but richer UI needs a normalized result shape:

```ts
{
  entityType: 'task' | 'note' | 'assignment' | ...
  entityId: string
  operation: 'created' | 'updated' | 'listed' | 'completed'
  route?: AppRoute
  displayTitle: string
}
```

This would make `AssistantResponseCard`, `RecentCaptures`, and future browse views easier to keep consistent.

### Assistant memory boundaries

The agent loop receives a fresh per-request message history. It can see tool results inside a single request, but it does not load relevant past conversation context from `useAssistantHistory` or server-side memory. For capture, that is often fine. For follow-ups like "actually make that tomorrow" after a previous capture, it is likely insufficient.

Potential fix:

- Keep capture actions stateless.
- Add explicit follow-up support in chat by sending recent conversation turns or selected previous response IDs.
- Prefer entity references over raw chat history where possible.

## Risk Ranking

### High priority

1. Voice capture handoff is broken or incomplete because the consumer component is not the one rendered after navigation.
2. Home prompt and full Capture chat have divergent capture behavior.
3. Frontend command hints are stale relative to backend tools.
4. Runtime Tier 3 behavior and docs/tests disagree: classifier vs agent loop.
5. Timezone is not part of assistant requests.

### Medium priority

1. All tools are exposed to AI on every AI-routed request.
2. No idempotency for duplicate capture.
3. Brain dumps are frontend-only sequential requests.
4. Legacy iPhone `quick-note` capture bypasses assistant tooling and learning; the assistant endpoint should be the recommended "real AI" Shortcut path.
5. Direct tool invocation exists but is barely used.

### Lower priority

1. Tool result shape is inconsistent.
2. Conversation follow-up memory is limited.
3. Registry tests validate mocks rather than the live registry.
4. Recent captures are not a complete capture ledger.

## Recommended Roadmap

### Phase 1: Make Capture Internally Consistent

Goal: one web capture behavior everywhere.

- Extract shared input behavior from `AssistantPromptBar`.
- Use it in both Home and full Capture chat.
- Make full Capture chat read and clear `captureFAB.voiceDraft`.
- Give full Capture chat textarea + brain-dump support.
- Keep the conversation sidebar if useful, but do not fork input semantics.

### Phase 2: Align Frontend Discovery With Backend Tools

Goal: no command drift.

- Add a backend command metadata action or endpoint.
- Replace `src/features/assistant/constants/commands.ts` hardcoding with fetched/cached metadata.
- Mark primary commands in backend metadata.
- Keep `/help` as the full backend truth.

### Phase 3: Make Routing Visible Before Mutation

Goal: user trust.

- Add a dry-run route preview for slash/rule/dynamic-rule matches.
- Show a small "will save as task/note/check-in" chip before submit.
- Add clarification candidates back into the active runtime path, either by restoring classifier for low-confidence cases or by teaching the agent loop to return structured candidates.

### Phase 4: Make Mobile/Siri Use The Assistant

Goal: one capture pipeline.

- Update Shortcut docs to offer two modes: fast note-only `quick-note`, and real AI `/assistant`.
- Recommend `/assistant` for Siri/natural-language capture:

```json
{
  "input": "Ask for Input result",
  "api_key": "YOUR_API_KEY",
  "source": "iphone"
}
```

- Add `timezone` and `clientRequestId` to the assistant request shape before making the Shortcut path first-class.
- Keep `quick-note` as a compatibility endpoint, a cheap fallback, or a wrapper that delegates to assistant when requested.
- Ensure assistant-based mobile capture writes assistant logs and surfaces a compact `action_taken` result that Shortcuts can show.

### Phase 5: Add Bulk Capture And Idempotency

Goal: reliable brain dumps.

- Add `clientRequestId` to assistant requests.
- Store recent request IDs or generated entity IDs to avoid duplicate creates.
- Add backend bulk capture orchestration with per-item results.
- Return a unified summary card.

### Phase 6: Narrow AI Tool Choice

Goal: lower cost and fewer wrong tool calls.

- Keep slash/rules first.
- Add cheap domain narrowing for AI requests.
- Expose only relevant tools to the model.
- Always expose safe global tools: `context.summary`, `system.help`, maybe `strategy.find`.

## Product Judgment

The backend is already close to a robust "AI captures everything" system. The main work is not adding more AI. It is making every capture surface use the same path, making tool routing visible enough to build trust, and closing the drift between backend capabilities and frontend discovery.

The most valuable near-term fix is to make the full Capture route use the same input behavior as the Home prompt and consume voice drafts correctly. That single change would make tap, type, brain dump, and long-press voice all converge on one working capture surface.
