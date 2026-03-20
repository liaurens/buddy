# Multi-Agent Assistant Architecture Plan

## Overview

Redesign the assistant system from a single-function monolith to a multi-agent architecture with:
- **General Manager (III)** - Routes commands via slash commands, rules, or AI fallback
- **Domain-specific Assistant Managers (IV)** - 8 domain groups with plug-and-play tool registration
- **HR Agent (V)** - Monitors logs/errors, produces findings (cron + on-demand)
- **Trainer Agent (VI)** - Uses findings to improve routing rules and tool configs
- **Enhanced Error/Logging (I)** - Detailed structured logging for self-learning
- **Easy Communication (II)** - Unified input handling (web, Siri, iPhone)

---

## Runtime Architecture

**Single edge function for the request path + separate functions for background agents.**

| Function | Trigger | Components |
|----------|---------|------------|
| `assistant` | HTTP (user request) | Auth, General Manager, 8 Domain Managers, Tools |
| `hr-agent` | Cron (daily) + HTTP (on-demand) | HR analyzer, findings writer |
| `trainer-agent` | HTTP (triggered by HR or manual) | Trainer, rule updater |

---

## Domain Groups (8 Assistant Managers)

Each domain manager is a group that can have any number of tools registered to it.

### 1. Planning
**What**: Scheduling, time management, getting things done.
**Current tools**: tasks, calendar, habits, notifications
**Commands**: `/task`, `/done`, `/today`, `/agenda`, `/habits`, `/remind`
**Future tools**: pomodoro, weekly planner, deadlines

### 2. Health
**What**: Physical health metrics and tracking.
**Current tools**: tracker (checkin + query for sleep, energy, exercise)
**Commands**: `/checkin`, `/health`
**Future tools**: protocols, supplements, diet, fitness logs

### 3. Mental
**What**: Emotional wellbeing, mood, reflection.
**Current tools**: tracker (mood subset), notes (journaling)
**Commands**: `/mood`, `/journal`, `/reflect`
**Future tools**: gratitude log, stress tracker, mindfulness reminders

### 4. Content
**What**: Notes, lists, knowledge capture.
**Current tools**: notes (create, shopping, query)
**Commands**: `/note`, `/shop`, `/find`
**Future tools**: bookmarks, summaries, read-later

### 5. Personal Improvement
**What**: Self-development, goals, growth tracking.
**Current tools**: (none yet — new domain)
**Commands**: `/goal`, `/progress`, `/review`
**Future tools**: goal tracker, skill logger, weekly review

### 6. Studying
**What**: Academic work, learning, revision.
**Current tools**: (none yet — new domain)
**Commands**: `/study`, `/flashcard`, `/exam`
**Future tools**: flashcards, study timer, exam planner, lecture notes

### 7. Projects
**What**: Multi-step project management.
**Current tools**: (none yet — new domain)
**Commands**: `/project`, `/milestone`
**Future tools**: project tracker, milestone tracker, kanban

### 8. Extra (System/Catch-all)
**What**: Meta-operations, help, feedback, anything that doesn't fit elsewhere.
**Current tools**: general questions, help
**Commands**: `/help`, `/feedback`, `/status`
**Future tools**: settings, integrations

```typescript
type Domain =
  | 'planning'
  | 'health'
  | 'mental'
  | 'content'
  | 'improvement'
  | 'studying'
  | 'projects'
  | 'extra'
```

---

## Tool Registration System

The key design: **adding a new tool to a domain = one file + one registration call**.

### Tool Definition Interface

Every tool implements this interface:

```typescript
// In types.ts
interface ToolDefinition {
  /** Unique tool ID */
  id: string                              // e.g. 'tasks', 'flashcards'

  /** Which domain this tool belongs to */
  domain: Domain

  /** Human-readable description */
  description: string

  /** Actions this tool can handle */
  actions: ActionDefinition[]

  /** Slash commands that route to this tool */
  commands: CommandDefinition[]

  /** Natural language rules (Tier 2) for this tool */
  rules: RuleDefinition[]
}

interface ActionDefinition {
  action: string                          // e.g. 'task.create'
  description: string
  handler: (params: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>
}

interface CommandDefinition {
  command: string                         // e.g. '/task'
  action: string                         // maps to which action
  description: string                    // for /help display
}

interface RuleDefinition {
  pattern: RegExp
  action: string
  extractParams?: (match: RegExpMatchArray, input: string) => Record<string, unknown>
}
```

### Example: Registering the Tasks Tool

```typescript
// tools/tasks.tool.ts
import { ToolDefinition } from '../types.ts'

export const tasksTool: ToolDefinition = {
  id: 'tasks',
  domain: 'planning',
  description: 'Create, list, and complete tasks',

  actions: [
    { action: 'task.create',     description: 'Create a new task',     handler: createTask },
    { action: 'task.list',       description: 'List open tasks',       handler: listTasks },
    { action: 'task.list.today', description: 'List today\'s tasks',   handler: listTodayTasks },
    { action: 'task.complete',   description: 'Mark a task as done',   handler: completeTask },
  ],

  commands: [
    { command: '/task',      action: 'task.create',     description: 'Create a task: /task Buy groceries by friday' },
    { command: '/task.list', action: 'task.list',        description: 'List all open tasks' },
    { command: '/today',     action: 'task.list.today',  description: 'Show today\'s tasks' },
    { command: '/done',      action: 'task.complete',    description: 'Complete a task: /done buy groceries' },
  ],

  rules: [
    { pattern: /^(-task|-todo|-taak)\s+/i, action: 'task.create',
      extractParams: (m, input) => ({ title: input.replace(m[0], '').trim() }) },
    { pattern: /\b(wat moet ik doen|show tasks|list tasks|mijn taken)\b/i, action: 'task.list' },
    { pattern: /\b(vandaag|today).*(taken|tasks|todo|doen)\b/i, action: 'task.list.today' },
  ]
}
```

### Example: Adding a Brand New "Flashcards" Tool to Studying

To add a completely new tool, create one file:

```typescript
// tools/flashcards.tool.ts
import { ToolDefinition } from '../types.ts'

export const flashcardsTool: ToolDefinition = {
  id: 'flashcards',
  domain: 'studying',
  description: 'Create and review flashcards',

  actions: [
    { action: 'flashcard.create', description: 'Create a flashcard', handler: createFlashcard },
    { action: 'flashcard.review', description: 'Start review session', handler: reviewFlashcards },
  ],

  commands: [
    { command: '/flashcard', action: 'flashcard.create', description: 'Create flashcard: /flashcard Q: What is X? A: Y' },
    { command: '/review',    action: 'flashcard.review',  description: 'Start a flashcard review session' },
  ],

  rules: [
    { pattern: /\b(flashcard|kaartje)\b/i, action: 'flashcard.create' },
  ]
}

async function createFlashcard(params, context) { /* ... */ }
async function reviewFlashcards(params, context) { /* ... */ }
```

Then register it in the tool registry:

```typescript
// tools/registry.ts
import { tasksTool } from './tasks.tool.ts'
import { calendarTool } from './calendar.tool.ts'
import { flashcardsTool } from './flashcards.tool.ts'
// ... etc

export const ALL_TOOLS: ToolDefinition[] = [
  // Planning
  tasksTool,
  calendarTool,
  habitsTool,
  notificationsTool,
  // Health
  trackerTool,
  // Mental
  moodTool,
  journalTool,
  // Content
  notesTool,
  // Studying
  flashcardsTool,
  // ... add new tools here
]
```

**That's it.** The General Manager auto-discovers commands and rules from the registry. The domain manager auto-discovers its tools.

### How the General Manager Uses the Registry

```typescript
// core/general-manager.ts
import { ALL_TOOLS } from '../tools/registry.ts'

// Build command map automatically from all registered tools
const COMMAND_MAP = new Map<string, { domain: Domain; action: string }>()
for (const tool of ALL_TOOLS) {
  for (const cmd of tool.commands) {
    COMMAND_MAP.set(cmd.command, { domain: tool.domain, action: cmd.action })
  }
}

// Build rule list automatically from all registered tools
const ALL_RULES = ALL_TOOLS.flatMap(tool =>
  tool.rules.map(rule => ({ ...rule, domain: tool.domain }))
)

// Route: Tier 1 (commands) → Tier 2 (rules) → Tier 3 (AI)
```

### How Domain Managers Use the Registry

```typescript
// managers/base.manager.ts
import { ALL_TOOLS } from '../tools/registry.ts'

function createDomainManager(domain: Domain) {
  const tools = ALL_TOOLS.filter(t => t.domain === domain)

  // Build action→handler map for this domain
  const actionMap = new Map<string, ActionDefinition['handler']>()
  for (const tool of tools) {
    for (const action of tool.actions) {
      actionMap.set(action.action, action.handler)
    }
  }

  return {
    domain,
    tools,
    async execute(action: string, params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
      const handler = actionMap.get(action)
      if (!handler) return { success: false, action_taken: `Unknown action: ${action}`, data: {} }
      return handler(params, context)
    }
  }
}

// All 8 managers are created automatically:
export const managers = {
  planning: createDomainManager('planning'),
  health: createDomainManager('health'),
  mental: createDomainManager('mental'),
  content: createDomainManager('content'),
  improvement: createDomainManager('improvement'),
  studying: createDomainManager('studying'),
  projects: createDomainManager('projects'),
  extra: createDomainManager('extra'),
}
```

**Adding a new domain group** = add it to the Domain type. That's it — `createDomainManager` handles the rest.

---

## New Command System (Slash Commands)

Three routing tiers, all auto-built from the tool registry:

### Tier 1: Slash Commands (zero AI cost)
```
/note Buy milk and cheese          → content
/shop Melk en kaas                 → content (shopping)
/find machine learning notes       → content (query)
/task Fix bike tire by friday      → planning
/task.list                         → planning
/today                             → planning (today's tasks)
/done fix bike                     → planning (complete)
/agenda                            → planning (calendar)
/habits                            → planning
/remind 14:00 call dentist         → planning (notification)
/checkin mood 4 energy 3           → health
/health how was my sleep?          → health (query)
/mood 4                            → mental
/journal Today was productive      → mental
/goal Read 20 books this year      → improvement
/study Linear algebra ch 5         → studying
/flashcard Q: Mitosis? A: ...      → studying
/project Build portfolio site      → projects
/help                              → extra
```

### Tier 2: Rule-Based (no AI cost)
Auto-collected from all tool `rules` arrays. Natural language patterns in Dutch + English.

### Tier 3: AI Fallback
Unflagged natural language → cheap AI call classifies into domain + action.

### Backward Compatibility
Old `-flag` syntax translated to new slash commands during transition.

---

## File Structure

```
supabase/functions/assistant/
  index.ts                              # Entry: CORS, auth → General Manager
  types.ts                              # All shared types (Domain, ToolDefinition, etc.)
  auth.ts                               # Authentication (unchanged)
  date-parser.ts                        # Date parsing (unchanged)

  core/
    general-manager.ts                  # III: Auto-routes using registry
    command-parser.ts                   # Tier 1: slash command parsing
    rule-engine.ts                      # Tier 2: NL rules (auto-built from registry)
    ai-classifier.ts                    # Tier 3: AI fallback
    ai-wrapper.ts                       # I: Unified AI calls with logging
    error-handler.ts                    # I: Structured error handling

  managers/
    base.manager.ts                     # createDomainManager() — auto-builds from registry
    index.ts                            # Exports all 8 managers

  tools/
    registry.ts                         # ★ Central registry — import all tools here
    notes.tool.ts                       # Content domain
    tasks.tool.ts                       # Planning domain
    calendar.tool.ts                    # Planning domain
    habits.tool.ts                      # Planning domain
    notifications.tool.ts              # Planning domain
    tracker.tool.ts                     # Health domain
    mood.tool.ts                        # Mental domain (new, split from tracker)
    journal.tool.ts                     # Mental domain (new)
    learnings.tool.ts                   # System/internal

supabase/functions/hr-agent/            # V: HR Agent
  index.ts
  analyzer.ts
  findings-writer.ts

supabase/functions/trainer-agent/       # VI: Trainer Agent
  index.ts
  rule-generator.ts
  tool-optimizer.ts
```

---

## Enhanced Logging (Component I)

### Database Changes

```sql
-- Enhance assistant_logs
ALTER TABLE assistant_logs
  ADD COLUMN domain TEXT,                       -- which domain handled it
  ADD COLUMN tool_id TEXT,                      -- which tool handled it
  ADD COLUMN routing_method TEXT,               -- 'command' | 'rule' | 'ai'
  ADD COLUMN error_details JSONB,               -- structured error info
  ADD COLUMN ai_calls JSONB DEFAULT '[]',       -- [{model, tokens_in, tokens_out, latency_ms, purpose}]
  ADD COLUMN processing_steps JSONB DEFAULT '[]'; -- [{step, duration_ms, result}]

-- New table for HR findings
CREATE TABLE assistant_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,                           -- 'unmatched_pattern' | 'error_cluster' | 'slow_route' | 'usage_trend'
  severity TEXT DEFAULT 'info',                 -- 'info' | 'warning' | 'critical'
  data JSONB NOT NULL,
  status TEXT DEFAULT 'new',                    -- 'new' | 'reviewed' | 'applied' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- New table for trainer-generated rules (loaded by General Manager at runtime)
CREATE TABLE assistant_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  domain TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence REAL DEFAULT 0.8,
  source TEXT DEFAULT 'trainer',                -- 'manual' | 'trainer' | 'builtin'
  active BOOLEAN DEFAULT true,
  finding_id UUID REFERENCES assistant_findings(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### AI Wrapper (ai-wrapper.ts)

```typescript
interface AICallOptions {
  purpose: string           // 'intent_classification' | 'date_parsing' | 'content_generation'
  model?: string
  maxTokens?: number
  temperature?: number
}

interface AICallResult {
  content: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  model: string
}

async function callAI(prompt: string, options: AICallOptions, context: AgentContext): Promise<AICallResult>
```

---

## HR Agent (Component V)

### What it monitors:
1. **Unmatched inputs** — fell through to AI or defaulted to note.create
2. **Error clusters** — repeated errors from specific tools/domains
3. **Slow routes** — high latency requests
4. **Usage patterns** — which commands/domains are most used
5. **AI cost** — total tokens, cost per request
6. **Empty domains** — domains with registered tools but no usage (adoption tracking)

### Schedule:
- **Cron**: Daily at 3 AM
- **On-demand**: HTTP trigger

---

## Trainer Agent (Component VI)

### What it does:
1. Reads new findings from `assistant_findings`
2. For `unmatched_pattern` findings (≥3 examples): generates regex → `assistant_rules`
3. For `error_cluster` findings: logs corrections to `assistant_learnings`
4. For other findings: logs as notes for human review

### Self-improvement loop:
```
User input → General Manager → Domain Manager → Tool → Response
                                                     ↓
                                                assistant_logs
                                                     ↓
                                           HR Agent (analyzes)
                                                     ↓
                                           assistant_findings
                                                     ↓
                                          Trainer Agent (improves)
                                                     ↓
                                           assistant_rules
                                                     ↓
                                 General Manager (uses dynamic rules)
```

---

## Implementation Phases

### Phase 1: Core Restructure + Tool Registration
1. Define `ToolDefinition` interface and `Domain` type in types.ts
2. Refactor existing tools to implement `ToolDefinition` (tasks, notes, tracker, calendar, habits, notifications)
3. Create `tools/registry.ts` with all tool imports
4. Create `managers/base.manager.ts` with `createDomainManager()`
5. Create `core/general-manager.ts` that auto-routes from registry
6. Refactor `index.ts` to use General Manager
7. Backward compatibility for old `-flag` syntax

### Phase 2: Slash Commands + AI Wrapper
1. Implement `command-parser.ts` (reads commands from registry)
2. Implement `rule-engine.ts` (reads rules from registry)
3. Create `ai-wrapper.ts` with unified AI access + logging
4. Create `ai-classifier.ts` for Tier 3 fallback
5. Update frontend with `/` command hints

### Phase 3: New Domain Tools
1. Create `mood.tool.ts` (split mood metrics from tracker → mental domain)
2. Create `journal.tool.ts` (mental domain)
3. Scaffold empty tools for improvement, studying, projects domains
4. Verify easy registration works end-to-end

### Phase 4: Enhanced Logging
1. Migration: new columns on assistant_logs
2. Migration: assistant_findings table
3. Migration: assistant_rules table
4. Structured error handler
5. Processing step tracking

### Phase 5: HR Agent
1. Create `supabase/functions/hr-agent/`
2. Log analyzer (patterns, clusters, trends)
3. Findings writer
4. pg_cron schedule + on-demand endpoint

### Phase 6: Trainer Agent
1. Create `supabase/functions/trainer-agent/`
2. Rule generator from findings
3. General Manager loads dynamic rules from assistant_rules
4. Trigger from HR + manual endpoint

### Phase 7: Communication Polish
1. Siri source handling
2. Frontend command palette / autocomplete
3. `/help` command (auto-generated from registry)

---

## Agent Specifications

| Agent | IQ | Access | Usage | Notes |
|-------|-----|--------|-------|-------|
| General Manager | 3/10 | 9/10 | 7/10 | Every request. Mostly routing, AI only as last resort |
| Domain Managers | 4/10 | 3/10 | 4/10 | Only own tools + DB. AI wrapper available when needed |
| HR Agent | 5/10 | 6/10 | 1/10 | Daily cron. Pattern recognition over logs |
| Trainer Agent | 6/10 | 4/10 | 1/10 | Highest IQ. Generates regex patterns + improvements |
