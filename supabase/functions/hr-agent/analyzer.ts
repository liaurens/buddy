/**
 * HR Analyzer — pattern detection over assistant logs
 *
 * Each analyzer function takes a batch of logs and returns findings.
 */

export interface Finding {
  type: 'unmatched_pattern' | 'error_cluster' | 'slow_route' | 'usage_trend' | 'ai_cost' | 'habit_trend' | 'overdue_cluster'
  severity: 'info' | 'warning' | 'critical' | 'nudge' | 'urgent'
  data: Record<string, unknown>
}

// deno-lint-ignore no-explicit-any
type LogEntry = Record<string, any>

/**
 * Find inputs that fell through to AI classification or defaulted to note.create.
 * These are candidates for new routing rules.
 */
export function analyzeUnmatchedPatterns(logs: LogEntry[]): Finding[] {
  const aiRouted = logs.filter(l =>
    l.detection_method === 'ai' ||
    (l.detection_method === 'rule' && l.detected_intent === 'note.create' && !l.input?.startsWith('/'))
  )

  if (aiRouted.length < 3) return []

  // Group by detected intent to find patterns
  const byIntent = new Map<string, string[]>()
  for (const log of aiRouted) {
    const intent = log.detected_intent || 'unknown'
    if (!byIntent.has(intent)) byIntent.set(intent, [])
    byIntent.get(intent)!.push(log.input)
  }

  const findings: Finding[] = []
  for (const [intent, examples] of byIntent) {
    if (examples.length >= 3) {
      findings.push({
        type: 'unmatched_pattern',
        severity: examples.length >= 10 ? 'warning' : 'info',
        data: {
          summary: `${examples.length} inputs routed via AI to "${intent}" — consider adding a rule`,
          intent,
          examples: examples.slice(0, 10),
          count: examples.length,
          proposed_rule: {
            domain: logs.find(l => l.detected_intent === intent)?.domain || 'extra',
            action: intent,
          },
        },
      })
    }
  }

  return findings
}

/**
 * Find repeated errors from specific tools or domains.
 */
export function analyzeErrorClusters(logs: LogEntry[]): Finding[] {
  const errors = logs.filter(l => {
    const resp = l.response
    return resp && (resp.success === false || resp.error)
  })

  if (errors.length < 3) return []

  // Group by domain + tool
  const byKey = new Map<string, LogEntry[]>()
  for (const log of errors) {
    const key = `${log.domain || 'unknown'}:${log.tool_id || 'unknown'}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(log)
  }

  const findings: Finding[] = []
  for (const [key, errorLogs] of byKey) {
    if (errorLogs.length >= 3) {
      const [domain, toolId] = key.split(':')
      const errorMessages = errorLogs
        .map(l => l.response?.action_taken || l.response?.error || 'Unknown error')
        .slice(0, 5)

      findings.push({
        type: 'error_cluster',
        severity: errorLogs.length >= 10 ? 'critical' : 'warning',
        data: {
          summary: `${errorLogs.length} errors in ${domain}/${toolId}`,
          domain,
          tool_id: toolId,
          error_count: errorLogs.length,
          error_messages: errorMessages,
          examples: errorLogs.slice(0, 5).map(l => l.input),
        },
      })
    }
  }

  return findings
}

/**
 * Find requests with unusually high latency.
 */
export function analyzeSlowRoutes(logs: LogEntry[]): Finding[] {
  const withLatency = logs.filter(l => l.latency_ms && l.latency_ms > 0)
  if (withLatency.length < 5) return []

  // Calculate average latency
  const avgLatency = withLatency.reduce((sum, l) => sum + l.latency_ms, 0) / withLatency.length
  const threshold = Math.max(avgLatency * 3, 2000) // 3x average or 2 seconds

  const slow = withLatency.filter(l => l.latency_ms > threshold)
  if (slow.length < 3) return []

  return [{
    type: 'slow_route',
    severity: slow.some(l => l.latency_ms > 5000) ? 'warning' : 'info',
    data: {
      summary: `${slow.length} requests exceeded ${Math.round(threshold)}ms (avg: ${Math.round(avgLatency)}ms)`,
      avg_latency_ms: Math.round(avgLatency),
      threshold_ms: Math.round(threshold),
      slow_count: slow.length,
      examples: slow.slice(0, 5).map(l => ({
        input: l.input,
        latency_ms: l.latency_ms,
        domain: l.domain,
        intent: l.detected_intent,
      })),
    },
  }]
}

/**
 * Analyze command and domain usage patterns.
 */
export function analyzeUsageTrends(logs: LogEntry[]): Finding[] {
  if (logs.length < 10) return []

  // Count by domain
  const domainCounts: Record<string, number> = {}
  const commandCounts: Record<string, number> = {}
  const methodCounts: Record<string, number> = {}

  for (const log of logs) {
    const domain = log.domain || 'unknown'
    domainCounts[domain] = (domainCounts[domain] || 0) + 1

    const method = log.detection_method || 'unknown'
    methodCounts[method] = (methodCounts[method] || 0) + 1

    if (log.detection_method === 'command') {
      const cmd = log.input?.split(' ')[0] || 'unknown'
      commandCounts[cmd] = (commandCounts[cmd] || 0) + 1
    }
  }

  // Sort domains by usage
  const sortedDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)

  const topDomain = sortedDomains[0]
  const summary = sortedDomains
    .map(([d, c]) => `${d}: ${c}`)
    .join(', ')

  return [{
    type: 'usage_trend',
    severity: 'info',
    data: {
      summary: `${logs.length} total requests. Top domain: ${topDomain[0]} (${topDomain[1]}). ${summary}`,
      total_requests: logs.length,
      domain_counts: domainCounts,
      command_counts: commandCounts,
      method_counts: methodCounts,
    },
  }]
}

/**
 * Analyze error logs from assistant_error_logs table.
 * Groups by error_type + step to find recurring issues.
 */
export function analyzeErrorLogs(errorLogs: LogEntry[]): Finding[] {
  if (errorLogs.length < 3) return []

  // Group by error_type + step
  const byKey = new Map<string, LogEntry[]>()
  for (const log of errorLogs) {
    const key = `${log.error_type || 'unknown'}:${log.step || 'unknown'}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(log)
  }

  const findings: Finding[] = []
  for (const [key, logs] of byKey) {
    if (logs.length >= 3) {
      const [errorType, step] = key.split(':')
      findings.push({
        type: 'error_cluster',
        severity: logs.length >= 10 ? 'critical' : 'warning',
        data: {
          summary: `${logs.length} "${errorType}" errors at "${step}" step`,
          source: 'error_logs',
          error_type: errorType,
          step,
          error_count: logs.length,
          error_messages: logs.slice(0, 5).map(l => l.error_message || 'Unknown'),
          examples: logs.slice(0, 5).map(l => l.input || ''),
          domains: [...new Set(logs.map(l => l.domain).filter(Boolean))],
          ai_providers: [...new Set(logs.map(l => l.ai_provider).filter(Boolean))],
        },
      })
    }
  }

  return findings
}

/**
 * Check-in habit trend — compare last 7 days of `entries` rows against the prior 7.
 * Emits a user-facing finding if the user went from a consistent habit to a drop-off,
 * or from near-zero to consistent (both are worth celebrating/nudging).
 */
export async function analyzeHabitTrend(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<Finding[]> {
  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('entries')
    .select('entry_date')
    .eq('user_id', userId)
    .gte('entry_date', fourteenDaysAgo.toISOString().slice(0, 10))

  if (error || !data) return []

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

  const recentDays = new Set<string>()
  const priorDays = new Set<string>()
  for (const row of data) {
    const d = row.entry_date as string
    if (d >= cutoff) recentDays.add(d)
    else priorDays.add(d)
  }

  const recent = recentDays.size
  const prior = priorDays.size

  // Only emit if there's a meaningful shift and enough history to compare.
  if (prior < 3) return []
  const drop = prior - recent
  if (drop < 2) return []

  return [{
    type: 'habit_trend',
    severity: drop >= 4 ? 'nudge' : 'info',
    data: {
      summary: `Check-ins ${recent}/7 this week, down from ${prior}/7 last week`,
      recent_days: recent,
      prior_days: prior,
    },
  }]
}

/**
 * Overdue cluster — count todos past due by more than 7 days that are still incomplete.
 * Cluster of 3+ is worth surfacing as a nudge so the user can bulk-archive or reschedule.
 */
export async function analyzeOverdueCluster(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<Finding[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('todos')
    .select('id, title, due_date, completed')
    .eq('user_id', userId)
    .eq('completed', false)
    .lt('due_date', weekAgo)
    .not('due_date', 'is', null)
    .limit(50)

  if (error || !data || data.length < 3) return []

  return [{
    type: 'overdue_cluster',
    severity: 'nudge',
    data: {
      summary: `${data.length} tasks overdue by more than a week — archive or reschedule?`,
      count: data.length,
      examples: data.slice(0, 5).map((t: { title: string; due_date: string }) => ({
        title: t.title,
        due_date: t.due_date,
      })),
    },
  }]
}

/**
 * Analyze AI token usage and cost.
 */
export function analyzeAICost(logs: LogEntry[]): Finding[] {
  const aiLogs = logs.filter(l => l.tokens_used && l.tokens_used > 0)
  if (aiLogs.length === 0) return []

  const totalTokens = aiLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0)
  const totalCalls = aiLogs.length
  const avgTokens = Math.round(totalTokens / totalCalls)

  return [{
    type: 'ai_cost',
    severity: totalTokens > 50000 ? 'warning' : 'info',
    data: {
      summary: `${totalCalls} AI calls used ${totalTokens} tokens (avg: ${avgTokens}/call)`,
      total_tokens: totalTokens,
      total_calls: totalCalls,
      avg_tokens_per_call: avgTokens,
      ai_percentage: Math.round((totalCalls / logs.length) * 100),
    },
  }]
}
