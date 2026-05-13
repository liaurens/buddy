import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Helpers ────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function findType(name: string, userId: string, supabase: any) {
  const exact = await supabase
    .from('task_types')
    .select('id, name, emoji, color')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (exact.data) return exact.data
  const fuzzy = await supabase
    .from('task_types')
    .select('id, name, emoji, color')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return fuzzy.data
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleCreateType(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (typeof params.name === 'string' ? params.name : (params.content as string) || '').trim()
  if (!name) {
    return { success: false, action_taken: 'Provide a task type name. Example: { name: "work", emoji: "💼" }', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: last } = await supabase
    .from('task_types')
    .select('sort_order')
    .eq('user_id', context.userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (last?.sort_order ?? -1) + 1

  const { data: type, error } = await supabase
    .from('task_types')
    .insert({
      user_id: context.userId,
      name,
      emoji: typeof params.emoji === 'string' ? params.emoji : null,
      color: typeof params.color === 'string' ? params.color : null,
      sort_order: nextOrder,
      is_preset: false,
    })
    .select('id, name')
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to create task type', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Task type "${name}" created.`,
    data: { type_id: type.id, name },
  }
}

async function handleListTypes(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: types, error } = await supabase
    .from('task_types')
    .select('id, name, emoji, color, is_preset')
    .eq('user_id', context.userId)
    .order('sort_order', { ascending: true })
  if (error) {
    return { success: false, action_taken: 'Failed to list task types', data: { error: error.message } }
  }
  // deno-lint-ignore no-explicit-any
  const list = (types ?? []).map((t: any) => `• ${t.emoji ? t.emoji + ' ' : ''}${t.name}${t.is_preset ? ' (preset)' : ''}`)
  return {
    success: true,
    action_taken: list.length === 0
      ? 'No task types yet. Create one with tasktype_create.'
      : `${list.length} task type${list.length === 1 ? '' : 's'}:\n${list.join('\n')}`,
    data: { types: types ?? [], count: types?.length ?? 0 },
  }
}

async function handleAssignType(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const taskTitle = (params.task as string || '').trim()
  const typeName = (params.type as string || '').trim()
  if (!taskTitle || !typeName) {
    return { success: false, action_taken: 'Provide both task and type.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const type = await findType(typeName, context.userId, supabase)
  if (!type) {
    return { success: false, action_taken: `Could not find task type "${typeName}"`, data: {} }
  }
  const { data: task } = await supabase
    .from('todos')
    .select('id, title')
    .eq('user_id', context.userId)
    .eq('completed', false)
    .ilike('title', `%${taskTitle}%`)
    .limit(1)
    .maybeSingle()
  if (!task) {
    return { success: false, action_taken: `Could not find open task matching "${taskTitle}"`, data: {} }
  }
  const { error } = await supabase
    .from('todos')
    .update({ task_type_id: type.id })
    .eq('id', task.id)
    .eq('user_id', context.userId)
  if (error) {
    return { success: false, action_taken: 'Failed to assign task type', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Assigned type "${type.name}" to task "${task.title}".`,
    data: { task_id: task.id, type_id: type.id },
  }
}

async function handleDeleteType(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (params.name as string || '').trim()
  if (!name) {
    return { success: false, action_taken: 'Provide a type name to delete.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const type = await findType(name, context.userId, supabase)
  if (!type) {
    return { success: false, action_taken: `Could not find task type "${name}"`, data: {} }
  }
  const { error } = await supabase
    .from('task_types')
    .delete()
    .eq('id', type.id)
    .eq('user_id', context.userId)
  if (error) {
    return { success: false, action_taken: 'Failed to delete task type', data: { error: error.message } }
  }
  return { success: true, action_taken: `Deleted task type "${type.name}".`, data: { type_id: type.id } }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const taskTypesTool: ToolDefinition = {
  id: 'task-types',
  domain: 'planning',
  description: 'Manage user-defined task type taxonomy (work, study, errands, etc.). Used to categorize todos.',

  actions: [
    {
      action: 'tasktype.create',
      description: 'Create a new task type (category). Example: { name: "work", emoji: "💼", color: "#3b82f6" }.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Type name (e.g. "work", "study").' },
          emoji: { type: 'string', description: 'Optional single emoji.' },
          color: { type: 'string', description: 'Optional hex color (e.g. "#3b82f6").' },
        },
        required: ['name'],
      },
      handler: handleCreateType,
    },
    {
      action: 'tasktype.list',
      description: 'List the user\'s task types.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleListTypes,
    },
    {
      action: 'tasktype.assign',
      description: 'Assign a task type to an existing open task. Both fuzzy-matched.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Task title to fuzzy-match among open todos.' },
          type: { type: 'string', description: 'Task type name to fuzzy-match.' },
        },
        required: ['task', 'type'],
      },
      handler: handleAssignType,
    },
    {
      action: 'tasktype.delete',
      description: 'Delete a user-created task type (presets cannot be deleted by name lookup).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Type name to fuzzy-match.' },
        },
        required: ['name'],
      },
      handler: handleDeleteType,
    },
  ],

  commands: [
    { command: '/tasktype', action: 'tasktype.create', description: 'Create a task type' },
    { command: '/tasktypes', action: 'tasktype.list', description: 'List your task types' },
  ],

  rules: [],
}
