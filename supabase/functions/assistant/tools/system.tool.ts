import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

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

// ─── Tool Definition ────────────────────────────────────────────────────────

export const systemTool: ToolDefinition = {
  id: 'system',
  domain: 'extra',
  description: 'System commands: help, feedback',

  actions: [
    { action: 'system.help', description: 'Show available commands', handler: handleHelp },
    { action: 'system.feedback', description: 'Send feedback', handler: handleFeedback },
    { action: 'general.question', description: 'General question or unclassified input', handler: handleFeedback },
  ],

  commands: [
    { command: '/help', action: 'system.help', description: 'Show all available commands' },
    { command: '/feedback', action: 'system.feedback', description: 'Send feedback: /feedback Great feature!' },
  ],

  rules: [],
}
