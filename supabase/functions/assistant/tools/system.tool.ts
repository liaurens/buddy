import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'
import { callAI } from '../core/ai-wrapper.ts'
import { logError, extractError } from '../core/error-logger.ts'

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

async function handleHelp(_params: Record<string, unknown>, _context: AgentContext): Promise<ToolResult> {
  // Lazy import to avoid circular dependency at module load time
  const { ALL_TOOLS } = await import('./registry.ts')

  const commands: Array<{ command: string; description: string; domain: string }> = []
  for (const tool of ALL_TOOLS) {
    for (const cmd of tool.commands) {
      commands.push({
        command: cmd.command,
        description: cmd.description,
        domain: tool.domain,
      })
    }
  }
  commands.sort((a, b) => a.command.localeCompare(b.command))

  const helpText = commands
    .map(c => `${c.command} — ${c.description}`)
    .join('\n')

  return {
    success: true,
    action_taken: 'Available commands',
    data: { commands, help: helpText },
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
