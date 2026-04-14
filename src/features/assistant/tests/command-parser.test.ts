/**
 * Tests for the command parser — Tier 1 routing.
 *
 * These test the pure parsing logic extracted from the Deno edge function
 * so they can run in Vitest without Deno dependencies.
 */
import { describe, it, expect } from 'vitest'

// We test the parsing logic directly since the actual module uses Deno imports.
// Extract the core logic to test.

// ─── Command Map (mirrors command-parser.ts) ─────────────────────────────────

const COMMAND_MAP = new Map([
  ['/task', { domain: 'planning', action: 'task.create' }],
  ['/task.list', { domain: 'planning', action: 'task.list' }],
  ['/today', { domain: 'planning', action: 'task.list.today' }],
  ['/done', { domain: 'planning', action: 'task.complete' }],
  ['/agenda', { domain: 'planning', action: 'calendar.today' }],
  ['/habits', { domain: 'planning', action: 'habits.status' }],
  ['/remind', { domain: 'planning', action: 'notification.schedule' }],
  ['/plan', { domain: 'planning', action: 'plan.start' }],
  ['/plan.review', { domain: 'planning', action: 'plan.review' }],
  ['/plan.close', { domain: 'planning', action: 'plan.close' }],
  ['/checkin', { domain: 'health', action: 'tracker.checkin' }],
  ['/health', { domain: 'health', action: 'tracker.query' }],
  ['/note', { domain: 'content', action: 'note.create' }],
  ['/shop', { domain: 'content', action: 'note.create.shopping' }],
  ['/find', { domain: 'content', action: 'note.query' }],
  ['/help', { domain: 'extra', action: 'system.help' }],
  ['/feedback', { domain: 'extra', action: 'system.feedback' }],
])

function parseSlashCommand(input: string) {
  if (!input.startsWith('/')) return null

  let bestMatch: { command: string; entry: { domain: string; action: string } } | null = null

  for (const [command, entry] of COMMAND_MAP) {
    if (input === command || input.startsWith(command + ' ')) {
      if (!bestMatch || command.length > bestMatch.command.length) {
        bestMatch = { command, entry }
      }
    }
  }

  if (!bestMatch) return null

  const content = input.slice(bestMatch.command.length).trim()
  return {
    domain: bestMatch.entry.domain,
    action: bestMatch.entry.action,
    params: content ? { content } : {},
    rawInput: input,
    routingMethod: 'command',
  }
}

const LEGACY_FLAG_MAP: Record<string, string> = {
  '-shop': '/shop',
  '-boodschap': '/shop',
  '-boodschappen': '/shop',
  '-task': '/task',
  '-todo': '/task',
  '-taak': '/task',
}

function parseLegacyFlag(input: string) {
  for (const [flag, command] of Object.entries(LEGACY_FLAG_MAP)) {
    if (input.toLowerCase().startsWith(flag + ' ') || input.toLowerCase() === flag) {
      const newInput = command + input.slice(flag.length)
      return parseSlashCommand(newInput)
    }
  }
  const flagMatch = input.match(/-(\w+)/)
  if (flagMatch) {
    const flag = `-${flagMatch[1].toLowerCase()}`
    const command = LEGACY_FLAG_MAP[flag]
    if (command) {
      const content = input.replace(/-\w+/, '').trim()
      const entry = COMMAND_MAP.get(command)
      if (entry) {
        return {
          domain: entry.domain,
          action: entry.action,
          params: { content },
          rawInput: input,
          routingMethod: 'legacy',
        }
      }
    }
  }
  return null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseSlashCommand', () => {
  it('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello world')).toBeNull()
    expect(parseSlashCommand('buy milk')).toBeNull()
    expect(parseSlashCommand('')).toBeNull()
  })

  it('parses /task with content', () => {
    const result = parseSlashCommand('/task Fix bike tire by friday')
    expect(result).not.toBeNull()
    expect(result!.domain).toBe('planning')
    expect(result!.action).toBe('task.create')
    expect(result!.params).toEqual({ content: 'Fix bike tire by friday' })
    expect(result!.routingMethod).toBe('command')
  })

  it('parses /task without content', () => {
    const result = parseSlashCommand('/task')
    expect(result).not.toBeNull()
    expect(result!.action).toBe('task.create')
    expect(result!.params).toEqual({})
  })

  it('prefers longer command match (/task.list over /task)', () => {
    const result = parseSlashCommand('/task.list')
    expect(result!.action).toBe('task.list')
  })

  it('parses /today', () => {
    const result = parseSlashCommand('/today')
    expect(result!.action).toBe('task.list.today')
    expect(result!.domain).toBe('planning')
  })

  it('parses /done with target', () => {
    const result = parseSlashCommand('/done fix bike')
    expect(result!.action).toBe('task.complete')
    expect(result!.params).toEqual({ content: 'fix bike' })
  })

  it('parses /note with content', () => {
    const result = parseSlashCommand('/note Meeting notes from today')
    expect(result!.domain).toBe('content')
    expect(result!.action).toBe('note.create')
    expect(result!.params).toEqual({ content: 'Meeting notes from today' })
  })

  it('parses /shop', () => {
    const result = parseSlashCommand('/shop Melk en kaas')
    expect(result!.domain).toBe('content')
    expect(result!.action).toBe('note.create.shopping')
    expect(result!.params).toEqual({ content: 'Melk en kaas' })
  })

  it('parses /find', () => {
    const result = parseSlashCommand('/find machine learning')
    expect(result!.action).toBe('note.query')
  })

  it('parses /checkin with metrics', () => {
    const result = parseSlashCommand('/checkin mood 4 energy 3')
    expect(result!.domain).toBe('health')
    expect(result!.action).toBe('tracker.checkin')
    expect(result!.params).toEqual({ content: 'mood 4 energy 3' })
  })

  it('parses /health query', () => {
    const result = parseSlashCommand('/health how was my sleep?')
    expect(result!.domain).toBe('health')
    expect(result!.action).toBe('tracker.query')
  })

  it('parses /agenda', () => {
    const result = parseSlashCommand('/agenda')
    expect(result!.domain).toBe('planning')
    expect(result!.action).toBe('calendar.today')
  })

  it('parses /habits', () => {
    const result = parseSlashCommand('/habits')
    expect(result!.action).toBe('habits.status')
  })

  it('parses /remind', () => {
    const result = parseSlashCommand('/remind 14:00 call dentist')
    expect(result!.action).toBe('notification.schedule')
    expect(result!.params).toEqual({ content: '14:00 call dentist' })
  })

  it('parses /plan', () => {
    const result = parseSlashCommand('/plan')
    expect(result!.domain).toBe('planning')
    expect(result!.action).toBe('plan.start')
  })

  it('prefers /plan.review over /plan', () => {
    const result = parseSlashCommand('/plan.review')
    expect(result!.action).toBe('plan.review')
  })

  it('prefers /plan.close over /plan', () => {
    const result = parseSlashCommand('/plan.close')
    expect(result!.action).toBe('plan.close')
  })

  it('parses /help', () => {
    const result = parseSlashCommand('/help')
    expect(result!.domain).toBe('extra')
    expect(result!.action).toBe('system.help')
  })

  it('parses /feedback', () => {
    const result = parseSlashCommand('/feedback Great feature!')
    expect(result!.action).toBe('system.feedback')
    expect(result!.params).toEqual({ content: 'Great feature!' })
  })

  it('returns null for unknown slash command', () => {
    expect(parseSlashCommand('/unknown something')).toBeNull()
  })
})

describe('parseLegacyFlag', () => {
  it('translates -shop prefix', () => {
    const result = parseLegacyFlag('-shop Melk en kaas')
    expect(result).not.toBeNull()
    expect(result!.domain).toBe('content')
    expect(result!.action).toBe('note.create.shopping')
  })

  it('translates -task prefix', () => {
    const result = parseLegacyFlag('-task Fix bike')
    expect(result).not.toBeNull()
    expect(result!.action).toBe('task.create')
  })

  it('translates -todo prefix', () => {
    const result = parseLegacyFlag('-todo Buy groceries')
    expect(result!.action).toBe('task.create')
  })

  it('translates -taak prefix', () => {
    const result = parseLegacyFlag('-taak Fietsband plakken')
    expect(result!.action).toBe('task.create')
  })

  it('translates -boodschappen prefix', () => {
    const result = parseLegacyFlag('-boodschappen Kaas')
    expect(result!.action).toBe('note.create.shopping')
  })

  it('handles flag in the middle of content', () => {
    const result = parseLegacyFlag('buy milk -shop')
    expect(result).not.toBeNull()
    expect(result!.action).toBe('note.create.shopping')
    expect(result!.params).toEqual({ content: 'buy milk' })
  })

  it('returns null for non-flag input', () => {
    expect(parseLegacyFlag('hello world')).toBeNull()
    expect(parseLegacyFlag('/task something')).toBeNull()
  })

  it('returns null for unknown flag', () => {
    expect(parseLegacyFlag('-unknown stuff')).toBeNull()
  })
})
