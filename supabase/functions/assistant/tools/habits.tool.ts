import type { ToolResult } from '../types.ts'

export async function getHabitsStatus(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  const today = new Date().toISOString().split('T')[0]

  // Fetch habit-type tasks (recurring/is_habit)
  const { data: habits, error } = await supabase
    .from('todos')
    .select('id, title, completed, due_date, created_at')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('created_at', { ascending: true })

  if (error) {
    return { success: false, action_taken: 'Failed to query habits', data: { error: error.message } }
  }

  const openHabits = habits ?? []
  const count = openHabits.length
  const overdueCount = openHabits.filter(
    (h: { due_date?: string }) => h.due_date && h.due_date < today
  ).length

  if (count === 0) {
    return {
      success: true,
      action_taken: 'All tasks complete! Great job.',
      data: { open: 0, overdue: 0, tasks: [] },
    }
  }

  const summary = `${count} open task${count !== 1 ? 's' : ''}${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}`

  return {
    success: true,
    action_taken: summary,
    data: {
      open: count,
      overdue: overdueCount,
      tasks: openHabits.slice(0, 5),
    },
    suggestions: ['View in Tasks →'],
  }
}
