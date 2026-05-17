import type { ToolDefinition, ToolResult, AgentContext, Domain, Intent } from '../types.ts'
import { callAI } from '../core/ai-wrapper.ts'
import { logError, extractError } from '../core/error-logger.ts'
import { parseSlashCommand, parseLegacyFlag } from '../core/command-parser.ts'
import { matchRules, matchDynamicRules, loadDynamicRules } from '../core/rule-engine.ts'

// ─── Conversation System Prompt ────────────────────────────────────────────

const CONVERSATION_SYSTEM_PROMPT = `You are Buddy, a helpful personal assistant for a student.
You help with studying, productivity, health, and daily life.
Answer questions concisely and helpfully. Keep responses under 200 words.
Be friendly but not overly chatty. Use plain language.

You can also suggest slash commands when relevant:
- /task <text> — create a task
- /note <text> — save a note
- /shop <text> — add to shopping list
- /checkin mood 4 energy 3 — log health metrics
- /today — see today's tasks
- /agenda — see today's calendar
- /help — see all commands

If the user seems to want to create a task, note, or track something,
suggest the appropriate command rather than doing it yourself.`

// ─── Action Handlers ────────────────────────────────────────────────────────

interface CommandMetadata {
  command: string
  description: string
  domain: string
  action: string
  primary: boolean
}

async function collectCommandMetadata(): Promise<CommandMetadata[]> {
  // Lazy import to avoid circular dependency at module load time.
  const { ALL_TOOLS } = await import('./registry.ts')

  const commands: CommandMetadata[] = []
  for (const tool of ALL_TOOLS) {
    for (const cmd of tool.commands) {
      commands.push({
        command: cmd.command,
        description: cmd.description,
        domain: tool.domain,
        action: cmd.action,
        primary: cmd.primary === true,
      })
    }
  }
  commands.sort((a, b) => a.command.localeCompare(b.command))
  return commands
}

async function handleHelp(_params: Record<string, unknown>, _context: AgentContext): Promise<ToolResult> {
  const commands = await collectCommandMetadata()
  const helpText = commands
    .map(c => `${c.command} — ${c.description}`)
    .join('\n')

  return {
    success: true,
    action_taken: 'Available commands',
    data: { commands, help: helpText },
  }
}

async function handleCommands(_params: Record<string, unknown>, _context: AgentContext): Promise<ToolResult> {
  const commands = await collectCommandMetadata()
  return {
    success: true,
    action_taken: 'Loaded commands',
    data: { commands },
  }
}

// Short user-facing label for the ghost chip. Falls back to the domain or
// the action prefix when no override applies.
const LABEL_BY_ACTION: Partial<Record<Intent, string>> = {
  'task.create': 'task',
  'task.create.reminder': 'task + reminder',
  'task.list': 'tasks',
  'task.list.today': "today's tasks",
  'task.complete': 'complete task',
  'note.create': 'note',
  'note.create.shopping': 'shopping list',
  'note.query': 'search notes',
  'tracker.checkin': 'check-in',
  'tracker.query': 'health query',
  'mood.log': 'mood',
  'journal.write': 'journal',
  'calendar.today': 'agenda',
  'habits.status': 'habits',
  'notification.schedule': 'reminder',
  'goal.create': 'goal',
  'study.log': 'study log',
  'system.help': 'help',
}

function previewLabel(domain: Domain, action: Intent): string {
  return LABEL_BY_ACTION[action] ?? action.split('.')[0] ?? domain
}

type PreviewSource = 'slash' | 'flag' | 'rule' | 'dynamic_rule' | 'none'

async function handleRoutePreview(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = typeof params.content === 'string' ? params.content.trim() : ''
  if (!content) {
    return {
      success: true,
      action_taken: 'No input to preview',
      data: { matched: false, source: 'none' as PreviewSource },
    }
  }

  let routed = parseSlashCommand(content)
  let source: PreviewSource = routed ? 'slash' : 'none'

  if (!routed) {
    routed = parseLegacyFlag(content)
    if (routed) source = 'flag'
  }
  if (!routed) {
    routed = matchRules(content)
    if (routed) source = 'rule'
  }
  if (!routed) {
    try {
      const dynamicRules = await loadDynamicRules(context.userId, context.supabase)
      const dynamicResult = matchDynamicRules(content, dynamicRules)
      if (dynamicResult) {
        routed = dynamicResult
        source = 'dynamic_rule'
      }
    } catch {
      // Best-effort: dynamic rules failing shouldn't break the preview.
    }
  }

  if (!routed) {
    return {
      success: true,
      action_taken: 'No deterministic match',
      data: { matched: false, source: 'none' as PreviewSource },
    }
  }

  return {
    success: true,
    action_taken: 'Routing preview',
    data: {
      matched: true,
      domain: routed.domain,
      action: routed.action,
      label: previewLabel(routed.domain, routed.action),
      source,
    },
  }
}

async function handleFeedback(params: Record<string, unknown>, _context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''
  return {
    success: true,
    action_taken: `Feedback received: "${content}"`,
    data: { feedback: content },
  }
}

async function handleGeneralQuestion(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''

  if (!context.aiConfig?.key) {
    return {
      success: true,
      action_taken: "I'd love to help, but I need an AI provider to answer questions. Go to Account settings and add your API key (Anthropic, OpenAI, or Google Gemini) to enable AI responses.",
      data: {
        message: 'AI not configured',
        needsSetup: true,
        isConversational: true,
      },
      suggestions: ['Open Account settings to configure AI'],
    }
  }

  try {
    const aiResult = await callAI(content, context.aiConfig, {
      purpose: 'conversation',
      model: context.aiConfig.model,
      maxTokens: 500,
      temperature: 0.7,
      systemPrompt: CONVERSATION_SYSTEM_PROMPT,
    })

    return {
      success: true,
      action_taken: aiResult.content,
      data: {
        aiResponse: aiResult.content,
        isConversational: true,
        tokensUsed: aiResult.tokensIn + aiResult.tokensOut,
        model: aiResult.model,
        provider: aiResult.provider,
      },
    }
  } catch (err) {
    const { message, stack } = extractError(err)
    logError({
      userId: context.userId,
      input: content,
      errorType: 'ai_error',
      errorMessage: message,
      errorStack: stack,
      step: 'ai_conversation',
      aiProvider: context.aiConfig?.provider,
      context: { action: 'general.question' },
    }, context.supabase)

    return {
      success: false,
      action_taken: 'Failed to generate a response. Please check your AI API key in Account settings.',
      data: {
        error: message,
        isConversational: true,
      },
    }
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const systemTool: ToolDefinition = {
  id: 'system',
  domain: 'extra',
  description: 'System commands: help, feedback, general questions',

  actions: [
    {
      action: 'system.help',
      description: 'List all of the slash commands the user has available. Call this when the user asks "what can you do", "what commands are there", or similar.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleHelp,
    },
    // Schema-less: UI metadata only. Not exposed to the agent loop — only the
    // direct-invoke path uses it.
    { action: 'system.commands', description: 'Return slash command metadata for UI hint dropdowns', handler: handleCommands },
    // Schema-less: read-only routing preview for the UI ghost chip. Doesn't
    // execute the matched action, just reports what *would* run via the
    // deterministic tiers (slash → flag → static rule → dynamic rule).
    { action: 'system.route_preview', description: 'Preview which deterministic action would handle the input', handler: handleRoutePreview },
    { action: 'system.feedback', description: 'Send feedback', handler: handleFeedback },
    // NOTE: general.question is intentionally schema-less. It's the conversational
    // fallback when no other tool matches — exposing it as a tool would let the
    // agent loop recurse into itself.
    { action: 'general.question', description: 'Answer general questions using AI', handler: handleGeneralQuestion },
  ],

  commands: [
    { command: '/help', action: 'system.help', description: 'Show all available commands' },
    { command: '/feedback', action: 'system.feedback', description: 'Send feedback: /feedback Great feature!' },
  ],

  rules: [],
}
