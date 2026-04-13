import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse duration from input like "2h", "90m", "1.5h", "30 min"
 */
function parseDuration(input: string): number | null {
  const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:h|uur|hour)/i)
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60)

  const minMatch = input.match(/(\d+)\s*(?:m|min|minuten|minutes)/i)
  if (minMatch) return parseInt(minMatch[1], 10)

  return null
}

/**
 * Extract subject by removing duration and command prefix.
 */
function parseSubject(input: string): string {
  return input
    .replace(/\d+(?:\.\d+)?\s*(?:h|uur|hour|m|min|minuten|minutes)\b/gi, '')
    .trim()
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleStudyLog(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''

  if (!content.trim()) {
    return {
      success: false,
      action_taken: 'Please provide a subject. Example: /study Linear algebra 2h',
      data: {},
    }
  }

  const duration = parseDuration(content)
  const subject = parseSubject(content)

  if (!subject) {
    return {
      success: false,
      action_taken: 'Please provide a subject. Example: /study Linear algebra 2h',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const { data: session, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: context.userId,
      subject,
      duration_minutes: duration,
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to log study session', data: { error: error.message } }
  }

  const durationStr = duration ? ` for ${duration >= 60 ? `${(duration / 60).toFixed(1)}h` : `${duration}m`}` : ''
  return {
    success: true,
    action_taken: `Study session logged: ${subject}${durationStr}`,
    data: { session_id: session.id, subject, duration_minutes: duration },
    suggestions: ['/study.stats'],
  }
}

async function handleStudyStats(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: sessions, error } = await supabase
    .from('study_sessions')
    .select('subject, duration_minutes, created_at')
    .eq('user_id', context.userId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, action_taken: 'Failed to query study data', data: { error: error.message } }
  }

  if (!sessions || sessions.length === 0) {
    return {
      success: true,
      action_taken: 'No study sessions in the last 7 days',
      data: { sessions: [], days: 7 },
      suggestions: ['/study'],
    }
  }

  // Group by subject
  const bySubject: Record<string, { count: number; totalMinutes: number }> = {}
  // deno-lint-ignore no-explicit-any
  for (const s of sessions as any[]) {
    const subj = s.subject
    if (!bySubject[subj]) bySubject[subj] = { count: 0, totalMinutes: 0 }
    bySubject[subj].count++
    bySubject[subj].totalMinutes += s.duration_minutes || 0
  }

  const summary = Object.entries(bySubject)
    .sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes)
    .map(([subject, stats]) => {
      const hours = (stats.totalMinutes / 60).toFixed(1)
      return `• ${subject}: ${stats.count} session${stats.count === 1 ? '' : 's'}${stats.totalMinutes > 0 ? `, ${hours}h` : ''}`
    })
    .join('\n')

  const totalMinutes = Object.values(bySubject).reduce((sum, s) => sum + s.totalMinutes, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  return {
    success: true,
    action_taken: `Last 7 days: ${sessions.length} sessions, ${totalHours}h total\n${summary}`,
    data: {
      by_subject: bySubject,
      total_sessions: sessions.length,
      total_minutes: totalMinutes,
      days: 7,
    },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const studyTool: ToolDefinition = {
  id: 'study',
  domain: 'studying',
  description: 'Log study sessions and view statistics',

  actions: [
    { action: 'study.log', description: 'Log a study session', handler: handleStudyLog },
    { action: 'study.stats', description: 'View study statistics', handler: handleStudyStats },
  ],

  commands: [
    { command: '/study', action: 'study.log', description: 'Log a study session: /study Linear algebra 2h' },
    { command: '/study.stats', action: 'study.stats', description: 'View study statistics for the last 7 days' },
  ],

  rules: [
    {
      pattern: /\b(?:studeren|study|leren|studying)\b/i,
      action: 'study.log',
      extractParams: (_m, input) => ({ content: input }),
    },
    {
      pattern: /\b(?:study.*stats|hoeveel.*gestudeerd|study.*time|studie.*overzicht)\b/i,
      action: 'study.stats',
    },
  ],
}
