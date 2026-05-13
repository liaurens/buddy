import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleAddStrategy(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const title = (typeof params.title === 'string' ? params.title : '').trim()
  const content = (typeof params.content === 'string' ? params.content
    : typeof params.description === 'string' ? params.description : '').trim()
  if (!title) {
    return { success: false, action_taken: 'Provide a strategy title.', data: {} }
  }
  const tags = Array.isArray(params.tags)
    ? (params.tags as unknown[]).map(String).filter(Boolean)
    : []

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: strategy, error } = await supabase
    .from('strategies')
    .insert({
      user_id: context.userId,
      title,
      description: content || null,
      content: content || null,
      category: typeof params.category === 'string' ? params.category : null,
      tags,
      is_favorite: false,
    })
    .select('id, title')
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to add strategy', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Strategy "${title}" added.`,
    data: { strategy_id: strategy.id, title },
  }
}

async function handleListStrategies(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const tag = typeof params.tag === 'string' ? params.tag : null
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  let query = supabase
    .from('strategies')
    .select('id, title, description, category, tags, is_favorite')
    .eq('user_id', context.userId)
    .order('is_favorite', { ascending: false })
    .order('title', { ascending: true })
    .limit(30)
  if (tag) {
    query = query.contains('tags', [tag])
  }
  const { data: strategies, error } = await query
  if (error) {
    return { success: false, action_taken: 'Failed to list strategies', data: { error: error.message } }
  }
  const list = strategies ?? []
  if (list.length === 0) {
    return {
      success: true,
      action_taken: tag ? `No strategies tagged "${tag}".` : 'No strategies yet. Add one with strategy_add.',
      data: { strategies: [], count: 0 },
    }
  }
  // deno-lint-ignore no-explicit-any
  const summary = list.map((s: any) => `• ${s.is_favorite ? '★ ' : ''}${s.title}${s.category ? ` [${s.category}]` : ''}`).join('\n')
  return {
    success: true,
    action_taken: `${list.length} strateg${list.length === 1 ? 'y' : 'ies'}:\n${summary}`,
    data: { strategies: list, count: list.length },
  }
}

async function handleFindStrategy(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const query = (params.query as string || (params.content as string) || '').trim()
  if (!query) {
    return { success: false, action_taken: 'Provide a search query.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  // Text search across title, description, content
  const pattern = `%${query}%`
  const { data: strategies, error } = await supabase
    .from('strategies')
    .select('id, title, description, content, category, tags')
    .eq('user_id', context.userId)
    .or(`title.ilike.${pattern},description.ilike.${pattern},content.ilike.${pattern}`)
    .limit(5)
  if (error) {
    return { success: false, action_taken: 'Failed to search strategies', data: { error: error.message } }
  }
  const list = strategies ?? []
  if (list.length === 0) {
    return {
      success: true,
      action_taken: `No strategies match "${query}".`,
      data: { strategies: [], count: 0 },
    }
  }
  // deno-lint-ignore no-explicit-any
  const summary = list.map((s: any) => {
    const preview = (s.content || s.description || '').slice(0, 120).replace(/\s+/g, ' ').trim()
    return `• ${s.title}${preview ? `\n  ${preview}${preview.length >= 120 ? '…' : ''}` : ''}`
  }).join('\n')
  return {
    success: true,
    action_taken: `Found ${list.length} matching strateg${list.length === 1 ? 'y' : 'ies'}:\n${summary}`,
    data: { strategies: list, count: list.length },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const strategiesTool: ToolDefinition = {
  id: 'strategies',
  domain: 'improvement',
  description: 'Toolbox: the user\'s personal library of strategies/tactics they\'ve collected. Search this first when the user asks "how do I handle X".',

  actions: [
    {
      action: 'strategy.add',
      description: 'Add a strategy to the user\'s toolbox. Title is short; content is the actual technique/notes.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name for the strategy.' },
          content: { type: 'string', description: 'The technique itself — steps, notes, when to apply.' },
          category: { type: 'string', description: 'Optional category (focus, stress, sleep, etc.).' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for filtering.' },
        },
        required: ['title'],
      },
      handler: handleAddStrategy,
    },
    {
      action: 'strategy.list',
      description: 'List the user\'s strategies, optionally filtered by tag.',
      inputSchema: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: 'Optional tag filter.' },
        },
      },
      handler: handleListStrategies,
    },
    {
      action: 'strategy.find',
      description: 'Text-search the toolbox by query (title/description/content). High-value — surface the user\'s own strategies before generic advice.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search query.' },
        },
        required: ['query'],
      },
      handler: handleFindStrategy,
    },
  ],

  commands: [
    { command: '/strategy', action: 'strategy.add', description: 'Add a strategy to your toolbox' },
    { command: '/strategies', action: 'strategy.list', description: 'List your strategies' },
    { command: '/strategy.find', action: 'strategy.find', description: 'Search strategies: /strategy.find stress' },
  ],

  rules: [],
}
