/**
 * HR Analyzer — pattern detection over assistant logs
 *
 * Each analyzer function takes a batch of logs and returns findings.
 */

export interface Finding {
  type: 'unmatched_pattern' | 'error_cluster' | 'slow_route' | 'usage_trend' | 'ai_cost'
  severity: 'info' | 'warning' | 'critical'
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
