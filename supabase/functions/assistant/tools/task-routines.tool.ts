import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Helpers ────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function findRoutine(name: string, userId: string, supabase: any) {
  const exact = await supabase
    .from('task_routines')
    .select('id, name, emoji, description')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (exact.data) return exact.data
  const fuzzy = await supabase
    .from('task_routines')
    .select('id, name, emoji, description')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return fuzzy.data
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleCreateRoutine(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (typeof params.name === 'string' ? params.name : (params.content as string) || '').trim()
  if (!name) {
    return { success: false, action_taken: 'Provide a routine name. Example: { name: "morning", items: ["shower","breakfast"] }', data: {} }
  }
  const items = Array.isArray(params.items) ? (params.items as unknown[]).map(String).filter(Boolean) : []
  const emoji = typeof params.emoji === 'string' ? params.emoji : null
  const description = typeof params.description === 'string' ? params.description : null

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: routine, error } = await supabase
    .from('task_routines')
    .insert({ user_id: context.userId, name, emoji, description })
    .select('id, name')
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to create routine', data: { error: error.message } }
  }

  let itemCount = 0
  if (items.length > 0) {
    const rows = items.map((title, idx) => ({
      routine_id: routine.id,
      title,
      sort_order: idx,
    }))
    const { error: itemErr, count } = await supabase
      .from('task_routine_items')
      .insert(rows, { count: 'exact' })
    if (itemErr) {
      return {
        success: true,
        action_taken: `Routine "${name}" created but items failed: ${itemErr.message}`,
        data: { routine_id: routine.id, name },
      }
    }
    itemCount = count ?? items.length
  }

  return {
    success: true,
    action_taken: `Routine "${name}" created${itemCount ? ` with ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}.`,
    data: { routine_id: routine.id, name, item_count: itemCount },
    suggestions: itemCount === 0 ? ['Add items with routine_add_item'] : ['Run with routine_run'],
  }
}

async function handleListRoutines(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: routines, error } = await supabase
    .from('task_routines')
    .select('id, name, emoji, description, task_routine_items(count)')
    .eq('user_id', context.userId)
    .order('name', { ascending: true })
  if (error) {
    return { success: false, action_taken: 'Failed to list routines', data: { error: error.message } }
  }
  // deno-lint-ignore no-explicit-any
  const list = (routines ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    item_count: r.task_routine_items?.[0]?.count ?? 0,
  }))
  if (list.length === 0) {
    return {
      success: true,
      action_taken: 'No routines yet. Create one with routine_create.',
      data: { routines: [], count: 0 },
    }
  }
  // deno-lint-ignore no-explicit-any
  const summary = list.map((r: any) => `• ${r.emoji ? r.emoji + ' ' : ''}${r.name} (${r.item_count} items)`).join('\n')
  return {
    success: true,
    action_taken: `${list.length} routine${list.length === 1 ? '' : 's'}:\n${summary}`,
    data: { routines: list, count: list.length },
  }
}

async function handleAddItem(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const routineName = (params.routine as string || '').trim()
  const title = (params.title as string || '').trim()
  if (!routineName || !title) {
    return { success: false, action_taken: 'Provide routine and title.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const routine = await findRoutine(routineName, context.userId, supabase)
  if (!routine) {
    return { success: false, action_taken: `Could not find routine "${routineName}"`, data: {} }
  }

  let sortOrder = typeof params.order === 'number' ? params.order : null
  if (sortOrder === null) {
    const { data: last } = await supabase
      .from('task_routine_items')
      .select('sort_order')
      .eq('routine_id', routine.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    sortOrder = (last?.sort_order ?? -1) + 1
  }

  const { error } = await supabase
    .from('task_routine_items')
    .insert({
      routine_id: routine.id,
      title,
      sort_order: sortOrder,
      energy: typeof params.energy === 'string' ? params.energy : null,
      estimated_time: typeof params.estimated_time === 'number' ? params.estimated_time : null,
    })
  if (error) {
    return { success: false, action_taken: 'Failed to add item', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Added "${title}" to routine "${routine.name}".`,
    data: { routine_id: routine.id, item_title: title },
  }
}

async function handleRemoveItem(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const routineName = (params.routine as string || '').trim()
  const item = (params.item as string || '').trim()
  if (!routineName || !item) {
    return { success: false, action_taken: 'Provide routine and item title.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const routine = await findRoutine(routineName, context.userId, supabase)
  if (!routine) {
    return { success: false, action_taken: `Could not find routine "${routineName}"`, data: {} }
  }
  const { data: target } = await supabase
    .from('task_routine_items')
    .select('id, title')
    .eq('routine_id', routine.id)
    .ilike('title', `%${item}%`)
    .limit(1)
    .maybeSingle()
  if (!target) {
    return { success: false, action_taken: `Could not find item "${item}" in routine "${routine.name}"`, data: {} }
  }
  const { error } = await supabase.from('task_routine_items').delete().eq('id', target.id)
  if (error) {
    return { success: false, action_taken: 'Failed to remove item', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Removed "${target.title}" from "${routine.name}".`,
    data: { routine_id: routine.id, item_id: target.id },
  }
}

async function handleRunRoutine(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const routineName = (params.routine as string || (params.content as string) || '').trim()
  if (!routineName) {
    return { success: false, action_taken: 'Provide a routine name to run.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const routine = await findRoutine(routineName, context.userId, supabase)
  if (!routine) {
    return { success: false, action_taken: `Could not find routine "${routineName}"`, data: {} }
  }
  const { data: items, error: itemsErr } = await supabase
    .from('task_routine_items')
    .select('title, task_type_id, energy, estimated_time, sort_order')
    .eq('routine_id', routine.id)
    .order('sort_order', { ascending: true })
  if (itemsErr) {
    return { success: false, action_taken: 'Failed to read routine items', data: { error: itemsErr.message } }
  }
  if (!items || items.length === 0) {
    return { success: true, action_taken: `Routine "${routine.name}" has no items yet.`, data: { count: 0 } }
  }

  const dueDateRaw = typeof params.date === 'string' ? params.date : null
  const dueDate = dueDateRaw ? dueDateRaw.slice(0, 10) : new Date().toISOString().slice(0, 10)

  // deno-lint-ignore no-explicit-any
  const rows = items.map((it: any, idx: number) => ({
    user_id: context.userId,
    title: it.title,
    completed: false,
    due_date: dueDate,
    task_type_id: it.task_type_id,
    energy: it.energy,
    estimated_time: it.estimated_time,
    routine_id: routine.id,
    routine_order: idx,
    created_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('todos').insert(rows)
  if (error) {
    return { success: false, action_taken: 'Failed to materialize routine tasks', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Created ${rows.length} task${rows.length === 1 ? '' : 's'} from routine "${routine.name}" for ${dueDate}.`,
    data: { routine_id: routine.id, count: rows.length, due_date: dueDate },
    suggestions: ['/today'],
  }
}

async function handleDeleteRoutine(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const routineName = (params.routine as string || (params.name as string) || '').trim()
  if (!routineName) {
    return { success: false, action_taken: 'Provide a routine name to delete.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const routine = await findRoutine(routineName, context.userId, supabase)
  if (!routine) {
    return { success: false, action_taken: `Could not find routine "${routineName}"`, data: {} }
  }
  await supabase.from('task_routine_items').delete().eq('routine_id', routine.id)
  const { error } = await supabase.from('task_routines').delete().eq('id', routine.id).eq('user_id', context.userId)
  if (error) {
    return { success: false, action_taken: 'Failed to delete routine', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Deleted routine "${routine.name}".`,
    data: { routine_id: routine.id },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const taskRoutinesTool: ToolDefinition = {
  id: 'task-routines',
  domain: 'planning',
  description: 'Manage recurring task routines (bundles of tasks the user runs together).',

  actions: [
    {
      action: 'routine.create',
      description: 'Create a new task routine. Example: { name: "morning", items: ["shower","breakfast","brush teeth"] }. Items optional — they can be added later.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Routine name (e.g. "morning", "evening wind-down")' },
          items: { type: 'array', items: { type: 'string' }, description: 'Initial task titles to add to the routine.' },
          emoji: { type: 'string', description: 'Optional emoji identifier.' },
          description: { type: 'string', description: 'Optional longer description.' },
        },
        required: ['name'],
      },
      handler: handleCreateRoutine,
    },
    {
      action: 'routine.list',
      description: 'List all of the user\'s task routines with their item counts.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleListRoutines,
    },
    {
      action: 'routine.add_item',
      description: 'Add a task to an existing routine. Routine fuzzy-matched by name.',
      inputSchema: {
        type: 'object',
        properties: {
          routine: { type: 'string', description: 'Routine name (fuzzy-matched).' },
          title: { type: 'string', description: 'New task title to add.' },
          order: { type: 'integer', description: 'Optional sort_order; appended to the end if omitted.' },
          energy: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Optional energy level for this task.' },
          estimated_time: { type: 'integer', description: 'Optional estimated minutes.' },
        },
        required: ['routine', 'title'],
      },
      handler: handleAddItem,
    },
    {
      action: 'routine.remove_item',
      description: 'Remove an item from a routine. Both routine and item fuzzy-matched.',
      inputSchema: {
        type: 'object',
        properties: {
          routine: { type: 'string', description: 'Routine name (fuzzy-matched).' },
          item: { type: 'string', description: 'Item title to remove (fuzzy-matched).' },
        },
        required: ['routine', 'item'],
      },
      handler: handleRemoveItem,
    },
    {
      action: 'routine.run',
      description: 'Materialize a routine as concrete todos for the given date (default: today). Creates one todo per routine item. Big win — single call to make many tasks.',
      inputSchema: {
        type: 'object',
        properties: {
          routine: { type: 'string', description: 'Routine name (fuzzy-matched).' },
          date: { type: 'string', format: 'date', description: 'YYYY-MM-DD; defaults to today.' },
        },
        required: ['routine'],
      },
      handler: handleRunRoutine,
    },
    {
      action: 'routine.delete',
      description: 'Delete a routine and all its items. Existing todos created from it are unaffected.',
      inputSchema: {
        type: 'object',
        properties: {
          routine: { type: 'string', description: 'Routine name (fuzzy-matched).' },
        },
        required: ['routine'],
      },
      handler: handleDeleteRoutine,
    },
  ],

  commands: [
    { command: '/routine', action: 'routine.create', description: 'Create a routine. Use the AI/JSON form for items.' },
    { command: '/routines', action: 'routine.list', description: 'List your task routines' },
    { command: '/routine.run', action: 'routine.run', description: 'Run a routine: /routine.run morning' },
  ],

  rules: [
    {
      pattern: /^(?:run|do|doe|start)\s+(?:my\s+|mijn\s+|the\s+)?(.+?)\s+routine$/i,
      action: 'routine.run',
      extractParams: (m) => ({ routine: m[1] }),
    },
    {
      pattern: /^(?:list|show|toon|laat\s+zien)\s+(?:my\s+|mijn\s+)?routines?$/i,
      action: 'routine.list',
    },
  ],
}
