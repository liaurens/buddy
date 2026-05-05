import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleMoodLog(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // Structured-params path: explicit value (+ optional note)
  let moodValue: number | null = null
  let note = ''
  if (typeof params.value === 'number' && Number.isInteger(params.value)) {
    moodValue = params.value
    note = typeof params.note === 'string' ? params.note : ''
  } else {
    const content = (params.content as string) || ''
    const moodMatch = content.match(/(\d)/)
    if (moodMatch) {
      moodValue = parseInt(moodMatch[1], 10)
      note = content.replace(/^\s*\d\s*/, '').trim()
    }
  }

  if (moodValue === null) {
    return {
      success: false,
      action_taken: 'Please provide a mood value (1-5). Example: /mood 4',
      data: {},
    }
  }

  if (moodValue < 1 || moodValue > 5) {
    return {
      success: false,
      action_taken: 'Mood must be between 1 and 5',
      data: {},
    }
  }

  // Find the mood tracker
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: trackers } = await supabase
    .from('trackers')
    .select('id, name')
    .eq('user_id', context.userId)
    .or('name.ilike.mood,name.ilike.stemming')
    .limit(1)

  if (!trackers || trackers.length === 0) {
    return {
      success: false,
      action_taken: 'No mood tracker found. Create a "mood" tracker in Health Tracking first.',
      data: {},
    }
  }

  const tracker = trackers[0]
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('entries')
    .insert({
      user_id: context.userId,
      tracker_id: tracker.id,
      value: moodValue,
      timestamp: now,
    })

  if (error) {
    return { success: false, action_taken: 'Failed to log mood', data: { error: error.message } }
  }

  const moodLabels: Record<number, string> = { 1: 'very low', 2: 'low', 3: 'okay', 4: 'good', 5: 'great' }

  return {
    success: true,
    action_taken: `Mood logged: ${moodValue}/5 (${moodLabels[moodValue]})${note ? ` — "${note}"` : ''}`,
    data: { mood: moodValue, label: moodLabels[moodValue], note: note || null },
    suggestions: ['View in Health →'],
  }
}

async function handleMoodQuery(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: entries, error } = await supabase
    .from('entries')
    .select('value, timestamp, trackers(name)')
    .eq('user_id', context.userId)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false })

  if (error) {
    return { success: false, action_taken: 'Failed to query mood data', data: { error: error.message } }
  }

  // Filter to mood entries only
  // deno-lint-ignore no-explicit-any
  const moodEntries = (entries || []).filter((e: any) => {
    const name = e.trackers?.name?.toLowerCase() || ''
    return name === 'mood' || name === 'stemming'
  })

  if (moodEntries.length === 0) {
    return {
      success: true,
      action_taken: 'No mood entries in the last 7 days',
      data: { entries: [], days: 7 },
    }
  }

  // deno-lint-ignore no-explicit-any
  const values = moodEntries.map((e: any) => e.value)
  const avg = Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 10) / 10

  return {
    success: true,
    action_taken: `Last 7 days: ${moodEntries.length} mood entries, average ${avg}/5`,
    data: {
      entries: moodEntries,
      average: avg,
      count: moodEntries.length,
      days: 7,
    },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const moodTool: ToolDefinition = {
  id: 'mood',
  domain: 'mental',
  description: 'Log and query mood',

  actions: [
    {
      action: 'mood.log',
      description: 'Log the user\'s current mood on a 1–5 scale, with an optional note.',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'integer', description: 'Mood 1 (very low) to 5 (great)' },
          note: { type: 'string', description: 'Optional context (e.g. "rough sleep")' },
        },
        required: ['value'],
      },
      handler: handleMoodLog,
    },
    {
      action: 'mood.query',
      description: 'View the user\'s mood entries over the last 7 days.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleMoodQuery,
    },
  ],

  commands: [
    { command: '/mood', action: 'mood.log', description: 'Log mood: /mood 4 feeling good' },
    { command: '/mood.history', action: 'mood.query', description: 'View mood history' },
  ],

  rules: [
    {
      pattern: /\b(?:mood|stemming|humeur)\b.*\d/i,
      action: 'mood.log',
      extractParams: (_m, input) => ({ content: input }),
    },
    {
      pattern: /\b(?:hoe voel|how.*feel|mood.*histor|stemming.*week)\b/i,
      action: 'mood.query',
    },
  ],
}
