import { parseDateExpression } from '../date-parser.ts'
import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleGoalCreate(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''

  if (!content.trim()) {
    return {
      success: false,
      action_taken: 'Please provide a goal. Example: /goal Read 20 books this year',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const targetDate = parseDateExpression(content)

  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      user_id: context.userId,
      title: content.trim(),
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
    action_taken: `Goal created: "${content.trim()}"${dateStr}`,
    data: { goal_id: goal.id, title: content.trim(), target_date: targetDate },
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
  const content = (params.content as string) || ''

  // Parse: expect "goal title 50" or "goal title 50%"
  const percentMatch = content.match(/(\d+)\s*%?\s*$/)
  if (!percentMatch) {
    return {
      success: false,
      action_taken: 'Please include a progress percentage. Example: /progress Read 20 books 50',
      data: {},
    }
  }

  const progress = parseInt(percentMatch[1], 10)
  if (progress < 0 || progress > 100) {
    return {
      success: false,
      action_taken: 'Progress must be between 0 and 100',
      data: {},
    }
  }

  const searchTerm = content.replace(/\d+\s*%?\s*$/, '').trim()
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
  const content = (params.content as string) || ''

  if (!content.trim()) {
    return {
      success: false,
      action_taken: 'Please specify which goal. Example: /goal.done Read 20 books',
      data: {},
    }
  }

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
    { action: 'goal.create', description: 'Create a new goal', handler: handleGoalCreate },
    { action: 'goal.list', description: 'List active goals', handler: handleGoalList },
    { action: 'goal.progress', description: 'Update goal progress', handler: handleGoalProgress },
    { action: 'goal.complete', description: 'Mark a goal as completed', handler: handleGoalComplete },
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
