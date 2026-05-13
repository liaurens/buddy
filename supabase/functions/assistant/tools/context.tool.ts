import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

/**
 * Returns a snapshot of the user's current state across the app. Cheap parallel
 * reads; the model should call this once at the start of any ambiguous or
 * "what should I work on?"–style request to ground its decisions.
 */
async function handleSummary(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  const userId = context.userId
  const today = new Date().toISOString().slice(0, 10)

  // Run reads in parallel — none of them block each other.
  const [
    pendingRes,
    goalsRes,
    moodRes,
    routinesRes,
    timeBlocksRes,
    skillsRes,
  ] = await Promise.all([
    sb.from('todos')
      .select('id, title, due_date, priority')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('due_date', { ascending: true, nullsLast: true })
      .limit(5),
    sb.from('goals')
      .select('id, title, progress')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5),
    sb.from('smart_notes')
      .select('content, created_at, flag')
      .eq('user_id', userId)
      .eq('flag', 'mood')
      .order('created_at', { ascending: false })
      .limit(1),
    sb.from('task_routines')
      .select('name')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .limit(10),
    sb.from('time_blocks')
      .select('id, title, start_time, end_time, status')
      .eq('user_id', userId)
      .gte('start_time', '00:00:00')
      .limit(10),
    sb.from('skill_logs')
      .select('skill_id, skills(name)')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(5),
  ])

  const pendingTasks = pendingRes.data ?? []
  const goals = goalsRes.data ?? []
  const recentMood = moodRes.data?.[0] ?? null
  const routines = (routinesRes.data ?? []).map((r: { name: string }) => r.name)
  const timeBlocks = timeBlocksRes.data ?? []
  // deno-lint-ignore no-explicit-any
  const recentSkillNames = Array.from(new Set((skillsRes.data ?? []).map((s: any) => s.skills?.name).filter(Boolean)))

  const { count: pendingCount } = await sb
    .from('todos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', false)

  // deno-lint-ignore no-explicit-any
  const topTasks = pendingTasks.map((t: any) =>
    `${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}${t.priority ? ` [${t.priority}]` : ''}`
  )

  // deno-lint-ignore no-explicit-any
  const goalSummary = goals.map((g: any) => `${g.title} (${g.progress ?? 0}%)`)

  return {
    success: true,
    action_taken: 'User context loaded.',
    data: {
      today,
      pending_tasks: {
        count: pendingCount ?? pendingTasks.length,
        top_5: topTasks,
      },
      active_goals: {
        count: goals.length,
        list: goalSummary,
      },
      recent_mood: recentMood,
      active_routines: routines,
      today_time_blocks: {
        count: timeBlocks.length,
        // deno-lint-ignore no-explicit-any
        list: timeBlocks.map((b: any) => `${b.start_time}-${b.end_time}: ${b.title} (${b.status})`),
      },
      recent_skills_logged: recentSkillNames,
    },
  }
}

export const contextTool: ToolDefinition = {
  id: 'context',
  domain: 'extra',
  description: 'Read-only snapshot of the user\'s current state — pending tasks, active goals, recent mood, active routines, today\'s schedule.',

  actions: [
    {
      action: 'context.summary',
      description: 'Get a snapshot of the user\'s current state: today\'s date, pending task count + top 5, active goals, latest mood log, routine names, today\'s time blocks, recently practiced skills. Call this first for ANY ambiguous request ("what should I work on", "how am I doing", "plan my day"). Cheap to call — single round of parallel reads.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleSummary,
    },
  ],

  commands: [
    { command: '/context', action: 'context.summary', description: 'Snapshot of your current state' },
  ],

  rules: [],
}
