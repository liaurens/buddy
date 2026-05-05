import { parseDateExpression } from '../date-parser.ts'
import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleGoalCreate(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const title = typeof params.title === 'string' && params.title.trim()
    ? params.title.trim()
    : ((params.content as string) || '').trim()

  if (!title) {
    return {
      success: false,
      action_taken: 'Please provide a goal. Example: /goal Read 20 books this year',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const targetDate = typeof params.target_date === 'string' && params.target_date
    ? params.target_date
    : parseDateExpression(title)

  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      user_id: context.userId,
      title,
      target_date: targetDate,
      status: 'active',
      progress: 0,
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to create goal', data: { error: error.message } }
  }

  const dateStr = targetDate ? ` (target: ${targetDate})` : ''
  return {
    success: true,
    action_taken: `Goal created: "${title}"${dateStr}`,
    data: { goal_id: goal.id, title, target_date: targetDate },
    suggestions: ['/goals', '/progress'],
  }
}

async function handleGoalList(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const { data: goals, error } = await supabase
    .from('goals')
    .select('id, title, status, progress, target_date, created_at')
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return { success: false, action_taken: 'Failed to list goals', data: { error: error.message } }
  }

  const count = goals?.length ?? 0
  if (count === 0) {
    return {
      success: true,
      action_taken: 'No active goals. Create one with /goal',
      data: { goals: [], count: 0 },
      suggestions: ['/goal'],
    }
  }

  // deno-lint-ignore no-explicit-any
  const summary = goals.map((g: any) => {
    const progress = g.progress > 0 ? ` (${g.progress}%)` : ''
    const date = g.target_date ? ` — target: ${g.target_date}` : ''
    return `• ${g.title}${progress}${date}`
  }).join('\n')

  return {
    success: true,
    action_taken: `${count} active goal${count === 1 ? '' : 's'}:\n${summary}`,
    data: { goals: goals ?? [], count },
  }
}

async function handleGoalProgress(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // Structured-params path
  let progress: number | null = null
  let searchTerm = ''
  if (typeof params.progress === 'number') {
    progress = params.progress
    searchTerm = (typeof params.title === 'string' ? params.title : '').trim()
  } else {
    const content = (params.content as string) || ''
    const percentMatch = content.match(/(\d+)\s*%?\s*$/)
    if (percentMatch) {
      progress = parseInt(percentMatch[1], 10)
      searchTerm = content.replace(/\d+\s*%?\s*$/, '').trim()
    }
  }
  if (progress === null) {
    return {
      success: false,
      action_taken: 'Please include a progress percentage. Example: /progress Read 20 books 50',
      data: {},
    }
  }
  if (progress < 0 || progress > 100) {
    return { success: false, action_taken: 'Progress must be between 0 and 100', data: {} }
  }
  if (!searchTerm) {
    return {
      success: false,
      action_taken: 'Please specify which goal. Example: /progress Read 20 books 50',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  // Fuzzy match goal by title
  const { data: goal } = await supabase
    .from('goals')
    .select('id, title')
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .ilike('title', `%${searchTerm}%`)
    .limit(1)
    .single()

  if (!goal) {
    return {
      success: false,
      action_taken: `Could not find active goal matching "${searchTerm}"`,
      data: {},
      suggestions: ['/goals'],
    }
  }

  const { error } = await supabase
    .from('goals')
    .update({ progress, updated_at: new Date().toISOString() })
    .eq('id', goal.id)

  if (error) {
    return { success: false, action_taken: 'Failed to update progress', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `"${goal.title}" — progress updated to ${progress}%`,
    data: { goal_id: goal.id, title: goal.title, progress },
  }
}

async function handleGoalComplete(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const target = typeof params.title === 'string' && params.title.trim()
    ? params.title.trim()
    : ((params.content as string) || '').trim()

  if (!target) {
    return {
      success: false,
      action_taken: 'Please specify which goal. Example: /goal.done Read 20 books',
      data: {},
    }
  }
  const content = target

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  // Fuzzy match
  const { data: goal } = await supabase
    .from('goals')
    .select('id, title')
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .ilike('title', `%${content.trim()}%`)
    .limit(1)
    .single()

  if (!goal) {
    return {
      success: false,
      action_taken: `Could not find active goal matching "${content.trim()}"`,
      data: {},
      suggestions: ['/goals'],
    }
  }

  const { error } = await supabase
    .from('goals')
    .update({ status: 'completed', progress: 100, updated_at: new Date().toISOString() })
    .eq('id', goal.id)

  if (error) {
    return { success: false, action_taken: 'Failed to complete goal', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Goal completed: "${goal.title}"`,
    data: { goal_id: goal.id, title: goal.title },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const goalsTool: ToolDefinition = {
  id: 'goals',
  domain: 'improvement',
  description: 'Create and track personal goals',

  actions: [
    {
      action: 'goal.create',
      description: 'Create a new personal goal.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The goal as a short statement (e.g. "Read 20 books")' },
          target_date: { type: 'string', format: 'date', description: 'Optional target date (YYYY-MM-DD or ISO 8601)' },
        },
        required: ['title'],
      },
      handler: handleGoalCreate,
    },
    {
      action: 'goal.list',
      description: 'List the user\'s active goals.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleGoalList,
    },
    {
      action: 'goal.progress',
      description: 'Set the percentage progress on an existing goal (matched by title).',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Goal title to fuzzy-match' },
          progress: { type: 'integer', description: 'Progress 0-100' },
        },
        required: ['title', 'progress'],
      },
      handler: handleGoalProgress,
    },
    {
      action: 'goal.complete',
      description: 'Mark a goal as completed.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Goal title to fuzzy-match' },
        },
        required: ['title'],
      },
      handler: handleGoalComplete,
    },
  ],

  commands: [
    { command: '/goal', action: 'goal.create', description: 'Create a goal: /goal Read 20 books this year' },
    { command: '/goals', action: 'goal.list', description: 'List active goals' },
    { command: '/progress', action: 'goal.progress', description: 'Update progress: /progress Read 20 books 50' },
    { command: '/goal.done', action: 'goal.complete', description: 'Complete a goal: /goal.done Read 20 books' },
  ],

  rules: [
    {
      pattern: /\b(?:doel|goal|voornemen|resolution)\b/i,
      action: 'goal.create',
      extractParams: (_m, input) => ({ content: input }),
    },
    {
      pattern: /\b(?:doelen|goals|mijn doelen|my goals)\b/i,
      action: 'goal.list',
    },
    {
      pattern: /\b(?:progress|voortgang)\b.*\d/i,
      action: 'goal.progress',
      extractParams: (_m, input) => ({ content: input }),
    },
  ],
}
