# Multi-Agent Assistant Architecture Plan

## Overview

Redesign the assistant system from a single-function monolith to a multi-agent architecture with:
- **General Manager (III)** - Routes commands via slash commands, rules, or AI fallback
- **Domain-specific Assistant Managers (IV)** - Execute domain logic with access to AI wrapper + DB
- **HR Agent (V)** - Monitors logs/errors, produces findings (cron + on-demand)
- **Trainer Agent (VI)** - Uses findings to improve routing rules and tool configs
- **Enhanced Error/Logging (I)** - Detailed structured logging for self-learning
- **Easy Communication (II)** - Unified input handling (web, Siri, iPhone)

---

## Runtime Architecture

**Single edge function for the request path + separate functions for background agents.**

| Function | Trigger | Components |
|----------|---------|------------|
| `assistant` | HTTP (user request) | Auth, General Manager, Assistant Managers, Tools |
| `hr-agent` | Cron (daily) + HTTP (on-demand) | HR analyzer, findings writer |
| `trainer-agent` | HTTP (triggered by HR or manual) | Trainer, rule updater |

Rationale: Keeps the hot path in one function (avoids multiple cold starts), while background processing runs independently.

---

## New Command System (Slash Commands)

Replace `-flag` prefixes with `/command` syntax. Three routing tiers:

### Tier 1: Slash Commands (zero AI cost)
```
/note Buy milk and cheese          → content manager, note.create
/shop Melk en kaas                 → content manager, note.create.shopping
/find machine learning notes       → content manager, note.query
/task Fix bike tire by friday      → productivity manager, task.create
/task.list                         → productivity manager, task.list
/today                             → productivity manager, task.list.today
/done fix bike                     → productivity manager, task.complete
/agenda                            → productivity manager, calendar.today
/habits                            → productivity manager, habits.status
/remind 14:00 call dentist         → productivity manager, notification.schedule
/checkin mood 4 energy 3           → health manager, tracker.checkin
/health how was my sleep?          → health manager, tracker.query
/help                              → system manager
```

### Tier 2: Rule-Based (no AI cost)
Natural language patterns (Dutch + English) that match without AI. Same concept as current rules but organized by domain.

### Tier 3: AI Fallback
Unflagged natural language → cheap AI call classifies into domain + action.

### Backward Compatibility
Old `-flag` syntax (e.g., `-shop`, `-task`) is translated to new slash commands during a transition period.

### Command Registry
```typescript
const COMMAND_MAP: Record<string, { domain: Domain; action: Action }> = {
  '/note':       { domain: 'content',      action: 'note.create' },
  '/shop':       { domain: 'content',      action: 'note.create.shopping' },
  '/find':       { domain: 'content',      action: 'note.query' },
  '/task':       { domain: 'productivity', action: 'task.create' },
  '/task.list':  { domain: 'productivity', action: 'task.list' },
  '/today':      { domain: 'productivity', action: 'task.list.today' },
  '/done':       { domain: 'productivity', action: 'task.complete' },
  '/agenda':     { domain: 'productivity', action: 'calendar.today' },
  '/habits':     { domain: 'productivity', action: 'habits.status' },
  '/remind':     { domain: 'productivity', action: 'notification.schedule' },
  '/checkin':    { domain: 'health',       action: 'tracker.checkin' },
  '/health':     { domain: 'health',       action: 'tracker.query' },
  '/help':       { domain: 'system',       action: 'system.help' },
  '/feedback':   { domain: 'system',       action: 'system.feedback' },
}
```

---

## Domain Groupings (Assistant Managers)

### 1. Productivity Manager
- **Tools**: tasks, calendar, habits, notifications
- **Actions**: task.create, task.create.reminder, task.list, task.list.today, task.complete, calendar.today, habits.status, notification.schedule
- **DB**: todos, settings (calendar_url), notifications
- **Rationale**: All "what do I need to do and when" — can cross-reference tasks + calendar + habits

### 2. Health Manager
- **Tools**: tracker (checkin + query)
- **Actions**: tracker.checkin, tracker.query
- **DB**: trackers, tracker_entries
- **Rationale**: Self-contained health metrics. Future: protocols, supplements, correlations

### 3. Content Manager
- **Tools**: notes (create, shopping, query)
- **Actions**: note.create, note.create.shopping, note.query
- **DB**: smart_notes, note_categories
- **Rationale**: Content creation and retrieval. Future: note summarization, journaling

### 4. System Manager
- **Tools**: general questions, help, feedback
- **Actions**: general.question, system.help, system.feedback
- **DB**: assistant_logs, assistant_learnings
- **Rationale**: Meta-operations and catch-all

```typescript
type Domain = 'productivity' | 'health' | 'content' | 'system'
```

---

## File Structure

```
supabase/functions/assistant/
  index.ts                              # Entry: CORS, auth, hand off to General Manager
  types.ts                              # All shared types
  auth.ts                               # Authentication (unchanged)
  date-parser.ts                        # Date parsing (unchanged)

  core/
    general-manager.ts                  # III: Command parsing → domain routing
    command-parser.ts                   # Slash command + legacy flag parsing
    rule-engine.ts                      # Tier 2 natural language rules by domain
    ai-classifier.ts                    # Tier 3 AI fallback for unmatched input
    ai-wrapper.ts                       # I: Unified AI call wrapper with logging/retries/token tracking
    error-handler.ts                    # I: Structured error handling

  managers/
    base.manager.ts                     # Manager interface/base
    productivity.manager.ts             # IV: Tasks + calendar + habits + notifications
    health.manager.ts                   # IV: Tracker checkin + query
    content.manager.ts                  # IV: Notes create + query
    system.manager.ts                   # IV: Help + feedback + general

  tools/                                # Existing tools, refactored to use ai-wrapper
    notes.tool.ts
    tasks.tool.ts
    tracker.tool.ts
    calendar.tool.ts
    habits.tool.ts
    notifications.tool.ts
    learnings.tool.ts

supabase/functions/hr-agent/            # V: HR Agent (separate function)
  index.ts                              # Entry: cron or on-demand trigger
  analyzer.ts                           # Log analysis, pattern detection
  findings-writer.ts                    # Write findings to DB

supabase/functions/trainer-agent/       # VI: Trainer Agent (separate function)
  index.ts                              # Entry: triggered by HR or manual
  rule-generator.ts                     # Generate new routing rules from findings
  tool-optimizer.ts                     # Suggest tool improvements
```

---

## Enhanced Logging (Component I)

### Database Changes

```sql
-- Enhance assistant_logs
ALTER TABLE assistant_logs
  ADD COLUMN domain TEXT,                       -- which manager handled it
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
  data JSONB NOT NULL,                          -- finding-specific data
  status TEXT DEFAULT 'new',                    -- 'new' | 'reviewed' | 'applied' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- New table for trainer-generated rules
CREATE TABLE assistant_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  domain TEXT NOT NULL,
  pattern TEXT NOT NULL,                        -- regex or keyword pattern
  action TEXT NOT NULL,                         -- the intent/action to map to
  confidence REAL DEFAULT 0.8,
  source TEXT DEFAULT 'trainer',                -- 'manual' | 'trainer' | 'builtin'
  active BOOLEAN DEFAULT true,
  finding_id UUID REFERENCES assistant_findings(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### AI Wrapper (ai-wrapper.ts)

Unified AI access point that:
- Tracks tokens used per call
- Logs every AI call with purpose, model, latency
- Supports both Claude and OpenAI
- Provides retry logic
- Feeds data to HR agent via logs

```typescript
interface AICallOptions {
  purpose: string           // 'intent_classification' | 'date_parsing' | 'content_generation'
  model?: string            // override default
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
1. **Unmatched inputs** - inputs that fell through to AI or defaulted to note.create
2. **Error clusters** - repeated errors from specific tools or domains
3. **Slow routes** - requests with high latency
4. **Usage patterns** - which commands/domains are most used
5. **AI cost** - total tokens used, cost per request

### Findings format:
```typescript
interface Finding {
  type: 'unmatched_pattern' | 'error_cluster' | 'slow_route' | 'usage_trend' | 'ai_cost'
  severity: 'info' | 'warning' | 'critical'
  data: {
    summary: string
    examples: string[]          // sample inputs
    count: number               // how often this occurred
    suggestion?: string         // what to do about it
    proposed_rule?: {           // for unmatched patterns
      pattern: string
      domain: string
      action: string
    }
  }
}
```

### Schedule:
- **Cron**: Daily at 3 AM (via pg_cron → HTTP call)
- **On-demand**: Manual trigger via edge function HTTP endpoint

---

## Trainer Agent (Component VI)

### What it does:
1. Reads findings from `assistant_findings` where status = 'new'
2. For `unmatched_pattern` findings with enough examples (≥3):
   - Generates a regex pattern that matches the examples
   - Creates entry in `assistant_rules` table
   - Updates finding status to 'applied'
3. For `error_cluster` findings:
   - Logs to `assistant_learnings` with type 'correction'
4. For other findings:
   - Logs as notes for human review

### Self-improvement loop:
```
User input → General Manager → Assistant Manager → Tool → Response
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
                                    General Manager (uses rules for routing)
```

---

## Implementation Phases

### Phase 1: Core Restructure
1. Create `core/` directory with general-manager.ts, command-parser.ts
2. Create `managers/` directory with base.manager.ts + 4 domain managers
3. Refactor index.ts to use General Manager instead of direct intent→dispatch
4. Move intent detection rules into rule-engine.ts organized by domain
5. Add backward compatibility for old `-flag` syntax
6. Update types.ts with Domain, new Action types

### Phase 2: Slash Commands + AI Wrapper
1. Implement command-parser.ts with full slash command support
2. Create ai-wrapper.ts with unified AI access + logging
3. Create ai-classifier.ts for Tier 3 fallback
4. Refactor existing tools to use ai-wrapper
5. Update frontend AssistantPromptBar with `/` command hints

### Phase 3: Enhanced Logging
1. Migration to add new columns to assistant_logs
2. Migration to create assistant_findings table
3. Migration to create assistant_rules table
4. Update error-handler.ts for structured error logging
5. Add processing_steps tracking throughout the pipeline

### Phase 4: HR Agent
1. Create `supabase/functions/hr-agent/` edge function
2. Implement log analyzer (unmatched patterns, error clusters, usage trends)
3. Implement findings writer
4. Set up pg_cron schedule
5. Add on-demand trigger endpoint

### Phase 5: Trainer Agent
1. Create `supabase/functions/trainer-agent/` edge function
2. Implement rule generator from findings
3. Update General Manager to load rules from assistant_rules table
4. Set up trigger from HR agent
5. Add manual trigger endpoint

### Phase 6: Communication Layer Polish
1. Add Siri source handling in auth.ts
2. Update frontend with command palette / autocomplete
3. Add `/help` command that shows available commands

---

## Agent Specifications

### General Manager (III)
- **IQ: 3/10** - Mostly routing logic, minimal AI. Uses command parser first, then rules, then AI only as last resort.
- **Access: 9/10** - Can see all domains, routes to any manager
- **Usage: 7/10** - Every request goes through it

### Assistant Managers (IV)
- **IQ: 4/10** - Knows its domain deeply. Uses AI wrapper only when needed (e.g., complex date parsing, ambiguous content classification)
- **Access: 3/10** - Only its own tools and DB tables
- **Usage: 4/10** - Only handles requests for its domain

### HR Agent (V)
- **IQ: 5/10** - Pattern recognition over logs, needs some intelligence to cluster errors and detect trends
- **Access: 6/10** - Reads assistant_logs, writes assistant_findings
- **Usage: 1/10** - Runs once daily + on-demand

### Trainer Agent (VI)
- **IQ: 6/10** - Highest IQ — needs to generate regex patterns and suggest improvements
- **Access: 4/10** - Reads findings, writes rules and learnings
- **Usage: 1/10** - Runs after HR, infrequently
