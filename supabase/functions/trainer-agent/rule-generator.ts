/**
 * Rule Generator — turns HR findings into routing rules.
 *
 * For unmatched_pattern findings:
 * - Analyzes example inputs to find common keywords
 * - Generates a regex pattern that matches them
 * - Creates an assistant_rules entry
 *
 * For error_cluster findings:
 * - Logs a correction learning for future review
 *
 * For other findings:
 * - Marks as reviewed (informational)
 */

// deno-lint-ignore no-explicit-any
type Finding = Record<string, any>

interface GenerateResult {
  rulesCreated: number
}

export async function generateRules(
  finding: Finding,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<GenerateResult> {
  switch (finding.type) {
    case 'unmatched_pattern':
      return handleUnmatchedPattern(finding, supabase)
    case 'error_cluster':
      return handleErrorCluster(finding, supabase)
    case 'slow_route':
      return handleSlowRoute(finding, supabase)
    case 'usage_trend':
      return handleUsageTrend(finding, supabase)
    case 'ai_cost':
      return handleAICost(finding, supabase)
    default:
      return { rulesCreated: 0 }
  }
}

async function handleUnmatchedPattern(
  finding: Finding,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<GenerateResult> {
  const data = finding.data
  const examples: string[] = data?.examples || []
  const domain: string = data?.proposed_rule?.domain || 'extra'
  const action: string = data?.proposed_rule?.action || data?.intent || 'general.question'

  if (examples.length < 3) return { rulesCreated: 0 }

  // Extract common keywords from examples
  const keywords = extractCommonKeywords(examples)
  if (keywords.length === 0) return { rulesCreated: 0 }

  // Build a regex pattern from common keywords
  const pattern = buildPattern(keywords)
  if (!pattern) return { rulesCreated: 0 }

  // Check if a similar rule already exists
  const { data: existing } = await supabase
    .from('assistant_rules')
    .select('id')
    .eq('user_id', finding.user_id)
    .eq('action', action)
    .eq('active', true)
    .limit(1)

  if (existing && existing.length > 0) return { rulesCreated: 0 }

  // Create the rule
  const { error } = await supabase
    .from('assistant_rules')
    .insert({
      user_id: finding.user_id,
      domain,
      pattern,
      action,
      confidence: Math.min(0.5 + (examples.length * 0.05), 0.95),
      source: 'trainer',
      active: true,
      finding_id: finding.id,
    })

  if (error) {
    console.error('Failed to create rule:', error.message)
    return { rulesCreated: 0 }
  }

  return { rulesCreated: 1 }
}

async function handleErrorCluster(
  finding: Finding,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<GenerateResult> {
  // Log as a correction learning for future review
  const data = finding.data
  await supabase
    .from('assistant_learnings')
    .insert({
      user_id: finding.user_id,
      type: 'correction',
      content: {
        source: 'hr_agent',
        domain: data?.domain,
        tool_id: data?.tool_id,
        error_count: data?.error_count,
        error_messages: data?.error_messages,
        finding_id: finding.id,
      },
    })

  return { rulesCreated: 0 }
}

async function handleSlowRoute(
  finding: Finding,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<GenerateResult> {
  const data = finding.data
  await supabase
    .from('assistant_learnings')
    .insert({
      user_id: finding.user_id,
      type: 'behavior',
      content: {
        source: 'hr_agent',
        finding_type: 'slow_route',
        avg_latency_ms: data?.avg_latency_ms,
        threshold_ms: data?.threshold_ms,
        slow_count: data?.slow_count,
        examples: data?.examples?.slice(0, 3),
        finding_id: finding.id,
      },
    })
  return { rulesCreated: 0 }
}

async function handleUsageTrend(
  finding: Finding,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<GenerateResult> {
  const data = finding.data
  await supabase
    .from('assistant_learnings')
    .insert({
      user_id: finding.user_id,
      type: 'note',
      content: {
        source: 'hr_agent',
        finding_type: 'usage_trend',
        total_requests: data?.total_requests,
        domain_counts: data?.domain_counts,
        command_counts: data?.command_counts,
        method_counts: data?.method_counts,
        finding_id: finding.id,
      },
    })
  return { rulesCreated: 0 }
}

async function handleAICost(
  finding: Finding,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<GenerateResult> {
  const data = finding.data
  await supabase
    .from('assistant_learnings')
    .insert({
      user_id: finding.user_id,
      type: 'behavior',
      content: {
        source: 'hr_agent',
        finding_type: 'ai_cost',
        total_tokens: data?.total_tokens,
        total_calls: data?.total_calls,
        avg_tokens_per_call: data?.avg_tokens_per_call,
        ai_percentage: data?.ai_percentage,
        finding_id: finding.id,
      },
    })
  return { rulesCreated: 0 }
}

/**
 * Extract common keywords from a list of example inputs.
 * Filters out stop words and very short words.
 */
function extractCommonKeywords(examples: string[]): string[] {
  const stopWords = new Set([
    'de', 'het', 'een', 'van', 'in', 'op', 'aan', 'met', 'voor', 'is', 'en', 'ik', 'je', 'mijn',
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'with', 'for', 'is', 'and', 'i', 'my', 'me',
    'to', 'do', 'it', 'this', 'that', 'what', 'how', 'can', 'will', 'would',
  ])

  // Count word frequency across all examples
  const wordCounts = new Map<string, number>()
  for (const example of examples) {
    const words = new Set(
      example.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
    )
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    }
  }

  // Find words that appear in at least 50% of examples
  const threshold = Math.max(2, Math.floor(examples.length * 0.5))
  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= threshold)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word)
}

/**
 * Build a regex pattern from common keywords.
 * Uses word boundary matching.
 */
function buildPattern(keywords: string[]): string | null {
  if (keywords.length === 0) return null

  if (keywords.length === 1) {
    return `\\b${escapeRegex(keywords[0])}\\b`
  }

  // Match any of the keywords
  const alternation = keywords.map(k => escapeRegex(k)).join('|')
  return `\\b(?:${alternation})\\b`
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
