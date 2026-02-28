import type { ToolResult } from '../types.ts'

interface CheckinValues {
  [metric: string]: number
}

/**
 * Parses a check-in string like "mood 4, energy 3, sleep 7.5"
 */
export function parseCheckinValues(input: string): CheckinValues {
  const values: CheckinValues = {}
  const metricAliases: Record<string, string> = {
    mood: 'mood', stemming: 'mood', gevoel: 'mood',
    energy: 'energy', energie: 'energy',
    sleep: 'sleep', slaap: 'sleep',
    focus: 'focus', concentratie: 'focus',
    stress: 'stress',
    pain: 'pain', pijn: 'pain',
    exercise: 'exercise', sport: 'exercise',
    caffeine: 'caffeine', koffie: 'caffeine',
    alcohol: 'alcohol',
    water: 'water',
    steps: 'steps', stappen: 'steps',
  }

  // Match patterns like "metric 4", "metric: 4", "metric=4"
  const pattern = /(\w+)\s*[:=]?\s*(\d+(?:\.\d+)?)/g
  let match
  while ((match = pattern.exec(input.toLowerCase())) !== null) {
    const rawMetric = match[1]
    const value = parseFloat(match[2])
    const canonical = metricAliases[rawMetric]
    if (canonical) {
      values[canonical] = value
    }
  }

  return values
}

export async function logCheckin(
  values: CheckinValues,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  if (Object.keys(values).length === 0) {
    return {
      success: false,
      action_taken: 'No valid metrics found in check-in',
      data: {},
    }
  }

  // Find tracker IDs for each metric name
  const { data: trackers } = await supabase
    .from('trackers')
    .select('id, name')
    .eq('user_id', userId)

  if (!trackers || trackers.length === 0) {
    return {
      success: false,
      action_taken: 'No trackers configured',
      data: {},
    }
  }

  const entries = []
  const logged: string[] = []
  const now = new Date().toISOString()

  for (const [metric, value] of Object.entries(values)) {
    const tracker = trackers.find(
      (t: { id: string; name: string }) =>
        t.name.toLowerCase() === metric ||
        t.name.toLowerCase().includes(metric)
    )
    if (tracker) {
      entries.push({
        user_id: userId,
        tracker_id: tracker.id,
        value,
        timestamp: now,
      })
      logged.push(`${metric}: ${value}`)
    }
  }

  if (entries.length === 0) {
    return {
      success: false,
      action_taken: 'No matching trackers found for the given metrics',
      data: { available_trackers: trackers.map((t: { name: string }) => t.name) },
    }
  }

  const { error } = await supabase.from('tracker_entries').insert(entries)

  if (error) {
    return { success: false, action_taken: 'Failed to save check-in', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Check-in logged: ${logged.join(', ')}`,
    data: { logged, count: entries.length },
    suggestions: ['View in Health →'],
  }
}

export async function queryTracker(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  days = 7
): Promise<ToolResult> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: entries, error } = await supabase
    .from('tracker_entries')
    .select('tracker_id, value, timestamp, trackers(name)')
    .eq('user_id', userId)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false })

  if (error) {
    return { success: false, action_taken: 'Failed to query tracker data', data: { error: error.message } }
  }

  if (!entries || entries.length === 0) {
    return {
      success: true,
      action_taken: `No tracker data in the last ${days} days`,
      data: { entries: [], summary: {} },
    }
  }

  // Aggregate by metric
  const summary: Record<string, { avg: number; count: number; values: number[] }> = {}
  for (const entry of entries) {
    // deno-lint-ignore no-explicit-any
    const name = (entry.trackers as any)?.name ?? entry.tracker_id
    if (!summary[name]) {
      summary[name] = { avg: 0, count: 0, values: [] }
    }
    summary[name].values.push(entry.value)
    summary[name].count++
  }

  for (const metric of Object.keys(summary)) {
    const { values } = summary[metric]
    summary[metric].avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  }

  const summaryLines = Object.entries(summary)
    .map(([name, stats]) => `${name}: avg ${stats.avg} (${stats.count} entries)`)
    .join(', ')

  return {
    success: true,
    action_taken: `Last ${days} days: ${summaryLines}`,
    data: { summary, days, entry_count: entries.length },
  }
}
