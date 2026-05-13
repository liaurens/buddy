/**
 * Experiment Agent Tool
 *
 * Routes experiment-related assistant requests to the experiment-agent
 * edge function. Useful when the user mentions "experiment" or asks about
 * their trial data from the main chat instead of from inside a specific
 * experiment detail page.
 */

import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleExperimentAsk(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = ((params.content as string) || '').trim()
  if (!content) {
    return {
      success: false,
      action_taken: 'Ask something about your experiment. Example: /experiment how should I design my ADHD trial?',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  // Find the most recently active experiment to use as default context
  const { data: active } = await supabase
    .from('experiments')
    .select('id, name')
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const experimentId = active?.id ?? null

  // Call experiment-agent via service-to-service HTTP with service role key
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    // Mint a short-lived token so the agent can authenticate as this user.
    // We bypass JWT by calling our own function with service role + x-user-id,
    // but experiment-agent validates JWT. Simpler: duplicate the logic inline
    // by invoking the agent via service role — but that requires refactoring.
    //
    // For now we cannot easily forward the user's JWT (we don't have it here),
    // so we directly call the AI logic inline instead of the subagent endpoint.
    // This keeps the main assistant decoupled while still answering the user.
    const { runAgent } = await import('../../experiment-agent/experiment-ai.ts')

    // Load AI config from settings
    const { data: aiSettings } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', context.userId)
      .in('key', ['ai_aiProvider', 'ai_aiApiKey', 'ai_aiModel'])

    const aiConfig = (aiSettings ?? []).reduce((acc: Record<string, string>, s: { key: string; value: string }) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const apiKey = aiConfig['ai_aiApiKey']
    if (!apiKey) {
      return {
        success: false,
        action_taken: 'Experiment agent needs an AI API key — set one in Settings',
        data: {},
      }
    }

    // Load recent conversation history (if any, for the same experiment scope)
    const { data: existing } = await supabase
      .from('experiment_agent_conversations')
      .select('id, messages')
      .eq('user_id', context.userId)
      .eq('experiment_id', experimentId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const history = (existing?.messages ?? []) as Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>

    const result = await runAgent(
      content,
      history,
      {
        key: apiKey,
        provider: aiConfig['ai_aiProvider'] || 'anthropic',
        model: aiConfig['ai_aiModel'] && aiConfig['ai_aiModel'] !== 'null' ? aiConfig['ai_aiModel'] : undefined,
      },
      { userId: context.userId, supabase, experimentId: experimentId || undefined }
    )

    // Persist
    const now = new Date().toISOString()
    const newHistory = [
      ...history,
      { role: 'user' as const, content, timestamp: now },
      { role: 'assistant' as const, content: result.reply, timestamp: now },
    ]
    if (existing?.id) {
      await supabase
        .from('experiment_agent_conversations')
        .update({ messages: newHistory, updated_at: now })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('experiment_agent_conversations')
        .insert({ user_id: context.userId, experiment_id: experimentId, messages: newHistory })
    }

    return {
      success: true,
      action_taken: result.reply,
      data: {
        experiment_id: experimentId,
        experiment_name: active?.name,
        tools_used: result.toolsUsed,
      },
      suggestions: ['/experiment.list'],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      action_taken: `Experiment agent failed: ${message}`,
      data: { error: message, url: supabaseUrl ? 'ok' : 'missing', service: serviceKey ? 'ok' : 'missing' },
    }
  }
}

async function handleExperimentList(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const { data: experiments, error } = await supabase
    .from('experiments')
    .select('id, name, status, hypothesis, start_date')
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return { success: false, action_taken: 'Failed to list experiments', data: { error: error.message } }
  }

  const count = experiments?.length ?? 0
  if (count === 0) {
    return {
      success: true,
      action_taken: 'No experiments yet. Create one from the Experiments tab.',
      data: { experiments: [], count: 0 },
    }
  }

  // deno-lint-ignore no-explicit-any
  const summary = experiments.map((e: any) => `• ${e.name} [${e.status || 'active'}]`).join('\n')

  return {
    success: true,
    action_taken: `${count} experiment${count === 1 ? '' : 's'}:\n${summary}`,
    data: { experiments: experiments ?? [], count },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const experimentAgentTool: ToolDefinition = {
  id: 'experiment-agent',
  domain: 'health',
  description: 'Ask the experiment agent about your self-experiments',

  actions: [
    {
      action: 'experiment.ask',
      description: 'Ask a free-text question about the user\'s active self-experiment. Use when the user mentions "experiment", "trial", "A/B test", or asks for analysis of their experimental data.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The question or request about the experiment.' },
        },
        required: ['content'],
      },
      handler: handleExperimentAsk,
    },
    {
      action: 'experiment.list',
      description: 'List all of the user\'s self-experiments.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleExperimentList,
    },
  ],

  commands: [
    { command: '/experiment', action: 'experiment.ask', description: 'Ask the experiment agent: /experiment how is my trial going?' },
    { command: '/experiments', action: 'experiment.list', description: 'List all experiments' },
    { command: '/experiment.list', action: 'experiment.list', description: 'List all experiments' },
  ],

  rules: [
    {
      pattern: /\b(?:my experiment|mijn experiment|the experiment|het experiment|adhd medication|adhd medicatie|trial)\b/i,
      action: 'experiment.ask',
      extractParams: (_m, input) => ({ content: input }),
    },
    {
      pattern: /\b(?:my experiments|mijn experimenten|all experiments|alle experimenten)\b/i,
      action: 'experiment.list',
    },
  ],
}
