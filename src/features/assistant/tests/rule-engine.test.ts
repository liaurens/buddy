/**
 * Tests for the rule engine — Tier 2 natural language routing.
 *
 * Tests rule matching patterns extracted from tool definitions.
 */
import { describe, it, expect } from 'vitest'

// Reproduce the rule definitions from the tools for testing

interface RuleDefinition {
  pattern: RegExp
  action: string
  domain: string
  extractParams?: (match: RegExpMatchArray, input: string) => Record<string, unknown>
}

const RULES: RuleDefinition[] = [
  // Content: Shopping notes
  {
    pattern: /(?:^-(?:shop|boodschap|boodschappen)\b|^(?:koop|buy|haal|boodschappen[: ]))/i,
    action: 'note.create.shopping',
    domain: 'content',
    extractParams: (_m, input) => ({ content: input }),
  },
  // Planning: Reminder tasks
  {
    pattern: /^(?:herinner|remind me|remind|herinner me)/i,
    action: 'task.create.reminder',
    domain: 'planning',
    extractParams: (_m, input) => ({ content: input, isReminder: true }),
  },
  // Planning: Task creation
  {
    pattern: /(?:^-(?:task|todo|taak)\b|^(?:maak taak|create task|add task|nieuwe taak|new task)[:.  ])/i,
    action: 'task.create',
    domain: 'planning',
    extractParams: (_m, input) => ({ content: input }),
  },
  // Health: Check-in (before generic notes to avoid -\w+ matching "check-in")
  {
    pattern: /(?:\bcheck[-\s]?in\b|\b(?:sleep|slaap|energy|energie|exercise|sport)\s+\d)/i,
    action: 'tracker.checkin',
    domain: 'health',
    extractParams: (_m, input) => ({ content: input }),
  },
  // Content: Generic notes
  {
    pattern: /(?:-\w+|^(?:note|notitie|schrijf|schrijf op)[: ])/i,
    action: 'note.create',
    domain: 'content',
    extractParams: (_m, input) => ({ content: input }),
  },
  // Planning: Today's tasks (matches either order: "today tasks" or "tasks today")
  {
    pattern: /(?:\b(?:vandaag|today)\b.*\b(?:taken|tasks|todo|doen)\b|\b(?:taken|tasks|todo|doen)\b.*\b(?:vandaag|today)\b)/i,
    action: 'task.list.today',
    domain: 'planning',
  },
  // Planning: Task list
  {
    pattern: /^(?:wat moet ik doen|show tasks|list tasks|mijn taken|toon taken)\b/i,
    action: 'task.list',
    domain: 'planning',
  },
  // Planning: Calendar
  {
    pattern: /\b(?:agenda|calendar|afspraken|events|schedule)\b/i,
    action: 'calendar.today',
    domain: 'planning',
  },
  // Planning: Habits
  {
    pattern: /\b(?:streak|habit|gewoonte|gewoontes|consistency)\b/i,
    action: 'habits.status',
    domain: 'planning',
  },
  // Planning: Notifications
  {
    pattern: /\b(?:notificatie|herinnering|reminder|notification|herinner me om)\b/i,
    action: 'notification.schedule',
    domain: 'planning',
    extractParams: (_m, input) => ({ content: input }),
  },
  // Health: Query
  {
    pattern: /\b(?:sleep|slaap|energy|energie|focus|stress)\b.*\?$/i,
    action: 'tracker.query',
    domain: 'health',
    extractParams: (_m, input) => ({ content: input }),
  },
]

function matchRules(input: string) {
  for (const rule of RULES) {
    const match = rule.pattern.exec(input)
    if (match) {
      const params = rule.extractParams
        ? rule.extractParams(match, input)
        : { content: input }
      return {
        domain: rule.domain,
        action: rule.action,
        params,
        rawInput: input,
        routingMethod: 'rule',
      }
    }
  }
  return null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Rule Engine - Shopping notes', () => {
  it('matches "koop melk"', () => {
    const result = matchRules('koop melk en kaas')
    expect(result!.action).toBe('note.create.shopping')
    expect(result!.domain).toBe('content')
  })

  it('matches "buy milk"', () => {
    const result = matchRules('buy milk and cheese')
    expect(result!.action).toBe('note.create.shopping')
  })

  it('matches "boodschappen: melk"', () => {
    const result = matchRules('boodschappen: melk kaas')
    expect(result!.action).toBe('note.create.shopping')
  })

  it('matches "haal brood"', () => {
    const result = matchRules('haal brood van de bakker')
    expect(result!.action).toBe('note.create.shopping')
  })
})

describe('Rule Engine - Task creation', () => {
  it('matches "create task"', () => {
    const result = matchRules('create task finish report')
    expect(result!.action).toBe('task.create')
    expect(result!.domain).toBe('planning')
  })

  it('matches "nieuwe taak"', () => {
    const result = matchRules('nieuwe taak rapport afmaken')
    expect(result!.action).toBe('task.create')
  })

  it('matches "remind me"', () => {
    const result = matchRules('remind me to call the dentist')
    expect(result!.action).toBe('task.create.reminder')
  })

  it('matches "herinner me"', () => {
    const result = matchRules('herinner me om de tandarts te bellen')
    expect(result!.action).toBe('task.create.reminder')
  })
})

describe('Rule Engine - Task lists', () => {
  it('matches "wat moet ik doen"', () => {
    const result = matchRules('wat moet ik doen')
    expect(result!.action).toBe('task.list')
  })

  it('matches "show tasks"', () => {
    const result = matchRules('show tasks')
    expect(result!.action).toBe('task.list')
  })

  it('matches "vandaag taken"', () => {
    const result = matchRules('wat zijn mijn taken vandaag')
    // This should match "vandaag" + "taken" pattern
    expect(result!.action).toBe('task.list.today')
  })

  it('matches "today tasks"', () => {
    const result = matchRules('what are my tasks for today')
    expect(result!.action).toBe('task.list.today')
  })
})

describe('Rule Engine - Calendar', () => {
  it('matches "agenda"', () => {
    const result = matchRules('toon mijn agenda')
    expect(result!.action).toBe('calendar.today')
    expect(result!.domain).toBe('planning')
  })

  it('matches "calendar"', () => {
    const result = matchRules('show my calendar')
    expect(result!.action).toBe('calendar.today')
  })

  it('matches "afspraken"', () => {
    const result = matchRules('wat zijn mijn afspraken')
    expect(result!.action).toBe('calendar.today')
  })
})

describe('Rule Engine - Health check-in', () => {
  it('matches "check-in"', () => {
    const result = matchRules('check-in mood 4 energy 3')
    expect(result!.action).toBe('tracker.checkin')
    expect(result!.domain).toBe('health')
  })

  it('matches "sleep 7"', () => {
    const result = matchRules('sleep 7')
    expect(result!.action).toBe('tracker.checkin')
  })

  it('matches "energie 3"', () => {
    const result = matchRules('energie 3')
    expect(result!.action).toBe('tracker.checkin')
  })
})

describe('Rule Engine - Health query', () => {
  it('matches "how was my sleep?"', () => {
    const result = matchRules('how was my sleep?')
    expect(result!.action).toBe('tracker.query')
    expect(result!.domain).toBe('health')
  })

  it('matches "hoe is mijn stress?"', () => {
    const result = matchRules('hoe is mijn stress?')
    expect(result!.action).toBe('tracker.query')
  })

  it('does not match without question mark', () => {
    const result = matchRules('my sleep was good')
    // Should not match tracker.query (no ?)
    expect(result?.action).not.toBe('tracker.query')
  })
})

describe('Rule Engine - Habits', () => {
  it('matches "streak"', () => {
    const result = matchRules('show my streak')
    expect(result!.action).toBe('habits.status')
  })

  it('matches "gewoonte"', () => {
    const result = matchRules('hoe gaat mijn gewoonte')
    expect(result!.action).toBe('habits.status')
  })
})

describe('Rule Engine - Notifications', () => {
  it('matches "reminder"', () => {
    const result = matchRules('set a reminder for 14:00')
    expect(result!.action).toBe('notification.schedule')
  })

  it('matches "herinnering"', () => {
    const result = matchRules('maak een herinnering')
    expect(result!.action).toBe('notification.schedule')
  })
})

describe('Rule Engine - Notes', () => {
  it('matches "note: something"', () => {
    const result = matchRules('note: this is important')
    expect(result!.action).toBe('note.create')
    expect(result!.domain).toBe('content')
  })

  it('matches "schrijf op"', () => {
    const result = matchRules('schrijf op dat ik morgen vrij ben')
    expect(result!.action).toBe('note.create')
  })
})

describe('Rule Engine - Unmatched', () => {
  it('returns null for unrecognized input', () => {
    expect(matchRules('hello world')).toBeNull()
    expect(matchRules('random text without keywords')).toBeNull()
  })
})
