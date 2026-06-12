/**
 * Tests for the Trainer Agent rule generator.
 *
 * Tests keyword extraction, pattern building, and rule generation logic.
 */
import { describe, it, expect } from 'vitest'

// ─── Pure functions (mirrors trainer-agent/rule-generator.ts) ────────────────

function extractCommonKeywords(examples: string[]): string[] {
  const stopWords = new Set([
    'de', 'het', 'een', 'van', 'in', 'op', 'aan', 'met', 'voor', 'is', 'en', 'ik', 'je', 'mijn',
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'with', 'for', 'is', 'and', 'i', 'my', 'me',
    'to', 'do', 'it', 'this', 'that', 'what', 'how', 'can', 'will', 'would',
  ])

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

  const threshold = Math.max(2, Math.floor(examples.length * 0.5))
  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= threshold)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern(keywords: string[]): string | null {
  if (keywords.length === 0) return null
  if (keywords.length === 1) {
    return `\\b${escapeRegex(keywords[0])}\\b`
  }
  const alternation = keywords.map(k => escapeRegex(k)).join('|')
  return `\\b(?:${alternation})\\b`
}

// ─── Mock Supabase for generateRules ─────────────────────────────────────────

type Finding = Record<string, unknown>

interface GenerateResult {
  rulesCreated: number
}

async function generateRules(
  finding: Finding,
  supabase: MockSupabase
): Promise<GenerateResult> {
  switch (finding.type) {
    case 'unmatched_pattern':
      return handleUnmatchedPattern(finding, supabase)
    case 'error_cluster':
      return handleErrorCluster(finding, supabase)
    default:
      return { rulesCreated: 0 }
  }
}

async function handleUnmatchedPattern(
  finding: Finding,
  supabase: MockSupabase
): Promise<GenerateResult> {
  const data = finding.data as Record<string, unknown> | undefined
  const examples: string[] = (data?.examples as string[]) || []
  const proposedRule = data?.proposed_rule as Record<string, string> | undefined
  const domain: string = proposedRule?.domain || 'extra'
  const action: string = proposedRule?.action || (data?.intent as string) || 'general.question'

  if (examples.length < 3) return { rulesCreated: 0 }

  const keywords = extractCommonKeywords(examples)
  if (keywords.length === 0) return { rulesCreated: 0 }

  const pattern = buildPattern(keywords)
  if (!pattern) return { rulesCreated: 0 }

  const { data: existing } = await supabase
    .from('assistant_rules')
    .select('id')
    .eq('user_id', finding.user_id as string)
    .eq('action', action)
    .eq('active', true)
    .limit(1)

  if (existing && (existing as unknown[]).length > 0) return { rulesCreated: 0 }

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

  if (error) return { rulesCreated: 0 }
  return { rulesCreated: 1 }
}

async function handleErrorCluster(
  finding: Finding,
  supabase: MockSupabase
): Promise<GenerateResult> {
  const data = finding.data as Record<string, unknown> | undefined
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

// ─── Mock Supabase chain builder ─────────────────────────────────────────────

interface MockSupabase {
  from: (table: string) => MockQueryBuilder
  _inserts: Array<{ table: string; data: unknown }>
  _selectResults: Map<string, unknown[]>
}

interface MockQueryBuilder {
  select: (cols: string) => MockQueryBuilder
  insert: (data: unknown) => Promise<{ error: null | { message: string } }>
  eq: (col: string, val: unknown) => MockQueryBuilder
  limit: (n: number) => Promise<{ data: unknown[] }>
}

function createMockSupabase(selectResults?: Map<string, unknown[]>): MockSupabase {
  const inserts: Array<{ table: string; data: unknown }> = []
  const results = selectResults || new Map()

  const mock: MockSupabase = {
    _inserts: inserts,
    _selectResults: results,
    from(table: string) {
      const currentTable = table
      const builder: MockQueryBuilder = {
        select(_cols: string) { return builder },
        eq(_col: string, _val: unknown) { return builder },
        async limit(_n: number) {
          return { data: results.get(currentTable) || [] }
        },
        async insert(data: unknown) {
          inserts.push({ table: currentTable, data })
          return { error: null }
        },
      }
      return builder
    },
  }
  return mock
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractCommonKeywords', () => {
  it('extracts words appearing in 50%+ of examples', () => {
    const examples = [
      'check my workout progress',
      'show workout stats',
      'how is my workout going',
    ]
    const keywords = extractCommonKeywords(examples)
    expect(keywords).toContain('workout')
  })

  it('filters out stop words', () => {
    const examples = [
      'the quick brown fox',
      'a quick red fox',
      'the quick blue fox',
    ]
    const keywords = extractCommonKeywords(examples)
    expect(keywords).not.toContain('the')
    expect(keywords).not.toContain('a')
    expect(keywords).toContain('quick')
    expect(keywords).toContain('fox')
  })

  it('filters out short words (<=2 chars)', () => {
    const examples = [
      'go to gym',
      'go to pool',
      'go to park',
    ]
    const keywords = extractCommonKeywords(examples)
    expect(keywords).not.toContain('go')
    expect(keywords).not.toContain('to')
  })

  it('returns max 5 keywords', () => {
    const examples = Array.from({ length: 10 }, () =>
      'alpha bravo charlie delta echo foxtrot golf hotel'
    )
    const keywords = extractCommonKeywords(examples)
    expect(keywords.length).toBeLessThanOrEqual(5)
  })

  it('returns empty for no common words', () => {
    const examples = [
      'completely unique phrase one',
      'totally different words here',
      'nothing overlaps at all',
    ]
    const keywords = extractCommonKeywords(examples)
    // No word appears in 50%+ (threshold = 2)
    expect(keywords.length).toBe(0)
  })
})

describe('buildPattern', () => {
  it('returns null for empty keywords', () => {
    expect(buildPattern([])).toBeNull()
  })

  it('builds single-keyword pattern with word boundaries', () => {
    const pattern = buildPattern(['workout'])
    expect(pattern).toBe('\\bworkout\\b')
  })

  it('builds alternation pattern for multiple keywords', () => {
    const pattern = buildPattern(['workout', 'exercise'])
    expect(pattern).toBe('\\b(?:workout|exercise)\\b')
  })

  it('escapes regex special characters', () => {
    const pattern = buildPattern(['c++'])
    expect(pattern).toBe('\\bc\\+\\+\\b')
  })

  it('generated patterns match expected inputs', () => {
    const pattern = buildPattern(['workout', 'exercise'])!
    const regex = new RegExp(pattern, 'i')
    expect(regex.test('check my workout')).toBe(true)
    expect(regex.test('daily exercise log')).toBe(true)
    expect(regex.test('hello world')).toBe(false)
  })
})

describe('generateRules', () => {
  it('creates a rule for unmatched_pattern with enough examples', async () => {
    const supabase = createMockSupabase()
    const finding = {
      id: 'f1',
      user_id: 'u1',
      type: 'unmatched_pattern',
      data: {
        intent: 'tracker.checkin',
        examples: [
          'check my workout progress',
          'show workout stats',
          'how is my workout going',
          'workout summary please',
        ],
      },
    }

    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(1)
    expect(supabase._inserts.length).toBe(1)
    expect(supabase._inserts[0].table).toBe('assistant_rules')

    const inserted = supabase._inserts[0].data as Record<string, unknown>
    expect(inserted.domain).toBe('extra')
    expect(inserted.action).toBe('tracker.checkin')
    expect(inserted.source).toBe('trainer')
    expect(inserted.active).toBe(true)
    expect(typeof inserted.pattern).toBe('string')
  })

  it('skips when fewer than 3 examples', async () => {
    const supabase = createMockSupabase()
    const finding = {
      id: 'f2',
      user_id: 'u1',
      type: 'unmatched_pattern',
      data: { intent: 'x', examples: ['one', 'two'] },
    }
    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(0)
  })

  it('skips when a matching rule already exists', async () => {
    const selectResults = new Map([
      ['assistant_rules', [{ id: 'existing-rule' }]],
    ])
    const supabase = createMockSupabase(selectResults)
    const finding = {
      id: 'f3',
      user_id: 'u1',
      type: 'unmatched_pattern',
      data: {
        intent: 'tracker.checkin',
        examples: [
          'check my workout progress',
          'show workout stats',
          'how is my workout going',
        ],
      },
    }
    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(0)
  })

  it('uses proposed_rule domain/action when available', async () => {
    const supabase = createMockSupabase()
    const finding = {
      id: 'f4',
      user_id: 'u1',
      type: 'unmatched_pattern',
      data: {
        intent: 'fallback.intent',
        proposed_rule: { domain: 'health', action: 'tracker.checkin' },
        examples: [
          'log my workout today',
          'record workout session',
          'save workout data',
        ],
      },
    }
    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(1)

    const inserted = supabase._inserts[0].data as Record<string, unknown>
    expect(inserted.domain).toBe('health')
    expect(inserted.action).toBe('tracker.checkin')
  })

  it('calculates confidence based on example count', async () => {
    const supabase = createMockSupabase()
    const finding = {
      id: 'f5',
      user_id: 'u1',
      type: 'unmatched_pattern',
      data: {
        intent: 'test',
        examples: Array.from({ length: 10 }, (_, i) => `workout session number ${i}`),
      },
    }
    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(1)

    const inserted = supabase._inserts[0].data as Record<string, unknown>
    // confidence = min(0.5 + 10*0.05, 0.95) = min(1.0, 0.95) = 0.95
    expect(inserted.confidence).toBe(0.95)
  })

  it('handles error_cluster by creating a learning entry', async () => {
    const supabase = createMockSupabase()
    const finding = {
      id: 'f6',
      user_id: 'u1',
      type: 'error_cluster',
      data: {
        domain: 'health',
        tool_id: 'tracker',
        error_count: 15,
        error_messages: ['No trackers configured'],
      },
    }
    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(0)
    expect(supabase._inserts.length).toBe(1)
    expect(supabase._inserts[0].table).toBe('assistant_learnings')

    const inserted = supabase._inserts[0].data as Record<string, unknown>
    expect(inserted.user_id).toBe('u1')
    expect(inserted.type).toBe('correction')
  })

  it('returns 0 rules for unknown finding types', async () => {
    const supabase = createMockSupabase()
    const finding = { id: 'f7', user_id: 'u1', type: 'slow_route', data: {} }
    const result = await generateRules(finding, supabase)
    expect(result.rulesCreated).toBe(0)
    expect(supabase._inserts.length).toBe(0)
  })
})
