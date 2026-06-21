# Multi-Agent Assistant Architecture

## Status: Core Complete, All 8 Domains Active

| Component | Status |
|-----------|--------|
| General Manager (routing) | Done |
| 8 Domain Managers | Done |
| Tool Registration System | Done — 12 tools registered |
| AI Wrapper (Anthropic/OpenAI/Gemini) | Done |
| Error Logging | Done — `assistant_error_logs` table |
| HR Agent | Done — deployed, manual trigger via DevPanel |
| Trainer Agent | Done — deployed, manual trigger via DevPanel |
| Conversational AI | Done |
| Frontend (chat, guide, bubbles) | Done |

---

## Runtime Architecture

**Single edge function for the request path + separate functions for background agents.**

| Function | Trigger | Components |
|----------|---------|------------|
| `assistant` | HTTP (user request) | Auth, General Manager, 8 Domain Managers, 12 Tools |
| `hr-agent` | Cron (daily) + HTTP (on-demand) | HR analyzer, findings writer |
| `trainer-agent` | HTTP (triggered by HR or manual) | Trainer, rule updater |

---

## Domain Groups (8 Managers, 12 Tools)

### 1. Planning (4 tools)
**Tools**: tasks, calendar, habits, notifications
**Commands**: `/task`, `/done`, `/today`, `/task.list`, `/agenda`, `/habits`, `/remind`
**Future**: pomodoro, weekly planner

### 2. Health (1 tool)
**Tools**: tracker
**Commands**: `/checkin`, `/health`
**Future**: protocols, supplements, fitness logs

### 3. Mental (2 tools)
**Tools**: mood, journal
**Commands**: `/mood`, `/mood.history`, `/journal`, `/reflect`
**Future**: gratitude log, mindfulness reminders

### 4. Content (1 tool)
**Tools**: notes
**Commands**: `/note`, `/shop`, `/find`
**Future**: bookmarks, summaries

### 5. Personal Improvement (1 tool)
**Tools**: goals
**Commands**: `/goal`, `/goals`, `/progress`, `/goal.done`
**Future**: skill logger, weekly review

### 6. Studying (1 tool)
**Tools**: study
**Commands**: `/study`, `/study.stats`
**Future**: flashcards, exam planner

### 7. Projects (1 tool)
**Tools**: projects
**Commands**: `/project`, `/projects`, `/project.status`, `/project.add`
**Future**: milestones, kanban

### 8. Extra (1 tool)
**Tools**: system (help, feedback, general.question)
**Commands**: `/help`, `/feedback`
**AI fallback**: conversational AI for unmatched input

---

## Three-Tier Routing

All routing is auto-built from the tool registry:

1. **Slash Commands** (zero AI cost) — `/task Buy milk`, `/mood 4`, `/study Linear algebra 2h`
2. **Natural Language Rules** (zero AI cost) — "Koop melk" → shopping, "hoe voel ik me" → mood query
3. **AI Classification** (cheap model fallback) — anything unmatched → AI classifies into domain + action

Dynamic rules from `assistant_rules` table are loaded at Tier 2b (trainer-generated).

---

## Tool Registration System

Adding a new tool = one file + one import:

```typescript
// tools/my-tool.tool.ts
export const myTool: ToolDefinition = {
  id: 'my-tool',
  domain: 'studying',
  actions: [...],
  commands: [...],
  rules: [...],
}

// tools/registry.ts — add one import + one array entry
```

General Manager, Domain Managers, command parser, rule engine, and AI classifier all auto-discover from the registry.

---

## Database Tables

### Core App Tables
| Table | Domain | Notes |
|-------|--------|-------|
| `todos` | planning | Has `project_id` FK to projects |
| `entries` | health | Health metric entries |
| `trackers` | health | Tracker definitions |
| `smart_notes` | content, mental | Notes + journal entries (via category) |
| `note_categories` | content, mental | Per-user categories (incl. "journal") |
| `goals` | improvement | NEW — title, status, progress %, target date |
| `projects` | improvement | NEW — name, status, linked to todos |
| `study_sessions` | studying | NEW — subject, duration, notes |
| `daily_plans` | planning | AI daily planning |
| `time_blocks` | planning | Time block scheduling |
| `calendar_events` | planning | External calendar sync |

### Assistant Infrastructure Tables
| Table | Purpose |
|-------|---------|
| `assistant_logs` | Every interaction logged with domain, tool, routing method, AI calls, processing steps |
| `assistant_learnings` | Self-learning records (new_rule, correction, behavior, note) |
| `assistant_findings` | HR agent analysis output (unmatched patterns, error clusters, slow routes, usage trends) |
| `assistant_rules` | Trainer-generated dynamic routing rules |
| `assistant_error_logs` | Dedicated error logging with full context for debugging |
| `settings` | Per-user key-value store (AI keys, preferences) |

---

## AI Integration

### Providers
- **Anthropic** (Claude) — default: `claude-haiku-4-5-20251001`
- **OpenAI** — default: `gpt-4o-mini`
- **Google Gemini** — default: `gemini-2.5-flash`

User configures provider + API key in Account settings. The `ai-wrapper.ts` routes to the correct provider API.

### AI Usage Points
1. **Intent classification** (Tier 3) — cheap model, ~100 tokens
2. **Conversational AI** (`general.question`) — 500 tokens, for unmatched natural language
3. **Journal reflection** (`journal.reflect`) — 300 tokens, summarizes recent entries

---

## Self-Learning Loop

```
User Input → General Manager → Domain Manager → Tool → Response
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

## File Structure

```
supabase/functions/assistant/
  index.ts                          # Entry: CORS, auth, AI config → General Manager
  types.ts                          # Domain, Intent, ToolDefinition, AgentContext
  auth.ts                           # JWT + API key authentication
  date-parser.ts                    # Dutch/English date parsing

  core/
    general-manager.ts              # 3-tier routing + execution + logging
    command-parser.ts               # Tier 1: slash commands (auto-built)
    rule-engine.ts                  # Tier 2: NL rules (static + dynamic)
    ai-classifier.ts               # Tier 3: AI fallback (auto-built intent list)
    ai-wrapper.ts                   # Unified AI: Anthropic/OpenAI/Gemini
    error-handler.ts                # PipelineTracker, safeExecute()
    error-logger.ts                 # logError() → assistant_error_logs

  managers/
    base.manager.ts                 # createDomainManager() factory
    index.ts                        # All 8 managers (auto-generated)

  tools/
    registry.ts                     # ★ Central registry — 12 tools
    tasks.tool.ts                   # Planning: tasks CRUD
    calendar.tool.ts                # Planning: calendar/agenda
    habits.tool.ts                  # Planning: habit streaks
    notifications.tool.ts           # Planning: reminders
    tracker.tool.ts                 # Health: checkin + query
    mood.tool.ts                    # Mental: mood logging + trends
    journal.tool.ts                 # Mental: journal entries + AI reflection
    notes.tool.ts                   # Content: notes + shopping
    goals.tool.ts                   # Improvement: goal CRUD + progress
    study.tool.ts                   # Studying: session logging + stats
    projects.tool.ts                # Projects: project CRUD + task linking
    system.tool.ts                  # Extra: help, feedback, conversational AI
    learnings.tool.ts               # Internal: interaction logging

supabase/functions/hr-agent/
  index.ts                          # Entry point (cron + on-demand)
  analyzer.ts                       # 6 analyzers
  findings-writer.ts                # Writes to assistant_findings

supabase/functions/trainer-agent/
  index.ts                          # Entry point (on-demand)
  rule-generator.ts                 # Generates rules from findings
```

---

## Agent Specifications

| Agent | IQ | Access | Usage | Notes |
|-------|-----|--------|-------|-------|
| General Manager | 3/10 | 9/10 | 7/10 | Every request. Mostly routing, AI only as last resort |
| Domain Managers | 4/10 | 3/10 | 4/10 | Only own tools + DB. AI for journal reflection |
| HR Agent | 5/10 | 6/10 | 1/10 | Manual trigger via DevPanel. Pattern recognition over logs |
| Trainer Agent | 6/10 | 4/10 | 1/10 | Highest IQ. Generates regex patterns + improvements |

---

## Remaining Work

### Future Enhancements
- Frontend command palette / autocomplete
- Siri Shortcuts deep integration
- Flashcards tool (studying domain)
- Pomodoro tool (planning domain)
- Weekly review tool (improvement domain)
