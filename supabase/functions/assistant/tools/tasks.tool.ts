import { parseDateExpression } from '../date-parser.ts'
import type { ToolResult } from '../types.ts'

export async function createTask(
  title: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  options: { dueDate?: string; priority?: string; isReminder?: boolean } = {}
): Promise<ToolResult> {
  // Parse date from title if not provided
  const dueDate = options.dueDate || parseDateExpression(title)

  // Clean date expressions from title if date was extracted
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
  // First try exact title match
  let { data: task } = await supabase
    .from('todos')
    .select('id, title')
    .eq('user_id', userId)
    .eq('completed', false)
    .ilike('title', titleOrId)
    .single()

  // Fuzzy match: contains
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
