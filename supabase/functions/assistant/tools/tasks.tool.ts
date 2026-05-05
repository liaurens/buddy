import { parseDateExpression } from '../date-parser.ts'
import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  options: { dueDate?: string; priority?: string; isReminder?: boolean } = {}
): Promise<ToolResult> {
  const dueDate = options.dueDate || parseDateExpression(title)

  const cleanTitle = dueDate
    ? title
        .replace(/\b(morgen|tomorrow|overmorgen|volgende week|next week)\b/gi, '')
        .replace(/\b(monday|maandag|tuesday|dinsdag|wednesday|woensdag|thursday|donderdag|friday|vrijdag|saturday|zaterdag|sunday|zondag)\b/gi, '')
        .replace(/\b(om|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
        .trim()
    : title

  const { data: task, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      title: cleanTitle,
      completed: false,
      due_date: dueDate,
      priority: options.priority || null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to create task', data: { error: error.message } }
  }

  const dueDateStr = dueDate ? ` (due ${dueDate})` : ''
  return {
    success: true,
    action_taken: `Task created: "${cleanTitle}"${dueDateStr}`,
    data: { task_id: task.id, title: cleanTitle, due_date: dueDate },
    suggestions: ['View in Tasks →'],
  }
}

export async function listTasks(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  options: { todayOnly?: boolean; limit?: number } = {}
): Promise<ToolResult> {
  let query = supabase
    .from('todos')
    .select('id, title, due_date, priority, completed')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('due_date', { ascending: true, nullsLast: true })
    .limit(options.limit || 10)

  if (options.todayOnly) {
    const today = new Date().toISOString().split('T')[0]
    query = query.lte('due_date', today)
  }

  const { data: tasks, error } = await query

  if (error) {
    return { success: false, action_taken: 'Failed to list tasks', data: { error: error.message } }
  }

  const count = tasks?.length ?? 0
  const label = options.todayOnly ? "today's tasks" : 'open tasks'
  return {
    success: true,
    action_taken: `You have ${count} ${label}`,
    data: { tasks: tasks ?? [], count },
  }
}

export async function completeTask(
  titleOrId: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  let { data: task } = await supabase
    .from('todos')
    .select('id, title')
    .eq('user_id', userId)
    .eq('completed', false)
    .ilike('title', titleOrId)
    .single()

  if (!task) {
    const { data: fuzzyTask } = await supabase
      .from('todos')
      .select('id, title')
      .eq('user_id', userId)
      .eq('completed', false)
      .ilike('title', `%${titleOrId}%`)
      .limit(1)
      .single()
    task = fuzzyTask
  }

  if (!task) {
    return {
      success: false,
      action_taken: `Could not find task matching "${titleOrId}"`,
      data: {},
    }
  }

  const { error } = await supabase
    .from('todos')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('id', task.id)
    .eq('user_id', userId)

  if (error) {
    return { success: false, action_taken: 'Failed to complete task', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Task completed: "${task.title}"`,
    data: { task_id: task.id, title: task.title },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

async function handleCreateTask(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // Structured-params path (agent loop)
  if (typeof params.title === 'string' && params.title.trim()) {
    return createTask(params.title.trim(), context.userId, context.supabase, {
      dueDate: typeof params.due_date === 'string' ? params.due_date : undefined,
      priority: typeof params.priority === 'string' ? params.priority : undefined,
      isReminder: !!params.is_reminder,
    })
  }
  // Legacy raw-text path (rule routing passes the whole input as `content`)
  const content = (params.content as string) || ''
  return createTask(content, context.userId, context.supabase, {
    isReminder: params.isReminder as boolean,
  })
}

async function handleListTasks(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  return listTasks(context.userId, context.supabase)
}

async function handleListTodayTasks(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  return listTasks(context.userId, context.supabase, { todayOnly: true })
}

async function handleCompleteTask(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const target = (params.title as string) || (params.target as string) || (params.content as string) || ''
  return completeTask(target, context.userId, context.supabase)
}

export const tasksTool: ToolDefinition = {
  id: 'tasks',
  domain: 'planning',
  description: 'Create, list, and complete tasks',

  actions: [
    {
      action: 'task.create',
      description: 'Create a new todo task. Use due_date for an ISO 8601 deadline; use is_reminder=true if it is a reminder-style task.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title (required).' },
          due_date: { type: 'string', format: 'date-time', description: 'ISO 8601 deadline (optional).' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Task priority' },
          is_reminder: { type: 'boolean', description: 'True if the task is a reminder rather than a regular todo.' },
        },
        required: ['title'],
      },
      handler: handleCreateTask,
    },
    {
      action: 'task.create.reminder',
      description: 'Create a reminder-style task with a due date.',
      // No inputSchema — the agent loop should use task.create with is_reminder=true.
      // This action stays for the legacy /remind rule path only.
      handler: handleCreateTask,
    },
    {
      action: 'task.list',
      description: 'List the user\'s open (uncompleted) tasks.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Max tasks to return (default 10)' },
        },
      },
      handler: handleListTasks,
    },
    {
      action: 'task.list.today',
      description: "List the user's tasks that are due today or overdue.",
      inputSchema: { type: 'object', properties: {} },
      handler: handleListTodayTasks,
    },
    {
      action: 'task.complete',
      description: 'Mark a task as done by title (fuzzy match) or task id.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title to fuzzy-match' },
        },
      },
      handler: handleCompleteTask,
    },
  ],

  commands: [
    { command: '/task', action: 'task.create', description: 'Create a task: /task Fix bike tire by friday' },
    { command: '/task.list', action: 'task.list', description: 'List all open tasks' },
    { command: '/today', action: 'task.list.today', description: "Show today's tasks" },
    { command: '/done', action: 'task.complete', description: 'Complete a task: /done fix bike' },
  ],

  rules: [
    // Reminder tasks
    {
      pattern: /^(?:herinner|remind me|remind|herinner me)/i,
      action: 'task.create.reminder',
      extractParams: (_m, input) => ({ content: input, isReminder: true }),
    },
    // Task creation
    {
      pattern: /(?:^-(?:task|todo|taak)\b|^(?:maak taak|create task|add task|nieuwe taak|new task)[:.  ])/i,
      action: 'task.create',
      extractParams: (_m, input) => ({ content: input }),
    },
    // Today's tasks
    {
      pattern: /(?:\b(?:vandaag|today)\b.*\b(?:taken|tasks|todo|doen)\b|\b(?:taken|tasks|todo|doen)\b.*\b(?:vandaag|today)\b)/i,
      action: 'task.list.today',
    },
    // Task list
    {
      pattern: /^(?:wat moet ik doen|show tasks|list tasks|mijn taken|toon taken)\b/i,
      action: 'task.list',
    },
  ],
}
