import type { DetectedIntent, Intent } from './types.ts'

interface RuleMatch {
  test: (input: string) => boolean
  intent: Intent
  extractParams: (input: string) => Record<string, unknown>
}

const RULES: RuleMatch[] = [
  // Shopping notes
  {
    test: (s) =>
      /-(?:shop|boodschap|boodschappen)\b/i.test(s) ||
      /^(?:koop|buy|haal|boodschappen[: ])/i.test(s),
    intent: 'note.create.shopping',
    extractParams: (s) => ({ content: s }),
  },

  // Reminder tasks
  {
    test: (s) => /^(?:herinner|remind me|remind|herinner me)/i.test(s),
    intent: 'task.create.reminder',
    extractParams: (s) => ({ content: s }),
  },

  // Task creation
  {
    test: (s) =>
      /-(?:task|todo|taak)\b/i.test(s) ||
      /^(?:maak taak|create task|add task|nieuwe taak|new task)[:. ]/i.test(s),
    intent: 'task.create',
    extractParams: (s) => ({ content: s }),
  },

  // Tracker check-in
  {
    test: (s) =>
      /\bcheck[-\s]?in\b/i.test(s) ||
      /\b(?:mood|stemming|energy|energie|sleep|slaap)\s+\d/i.test(s),
    intent: 'tracker.checkin',
    extractParams: (s) => ({ content: s }),
  },

  // Tracker query
  {
    test: (s) =>
      s.trim().endsWith('?') &&
      /\b(?:sleep|slaap|mood|stemming|energy|energie|focus|stress)\b/i.test(s),
    intent: 'tracker.query',
    extractParams: (s) => ({ content: s }),
  },

  // Today's tasks
  {
    test: (s) =>
      /\b(?:vandaag|today)\b/i.test(s) &&
      /\b(?:taken|tasks|todo|doen)\b/i.test(s),
    intent: 'task.list.today',
    extractParams: () => ({}),
  },

  // Calendar / agenda
  {
    test: (s) => /\b(?:agenda|calendar|afspraken|events|schedule)\b/i.test(s),
    intent: 'calendar.today',
    extractParams: () => ({}),
  },

  // Habits / streak
  {
    test: (s) => /\b(?:streak|habit|gewoonte|gewoontes|consistency)\b/i.test(s),
    intent: 'habits.status',
    extractParams: () => ({}),
  },

  // Notification
  {
    test: (s) => /\b(?:notificatie|herinnering|reminder|notification|herinner me om)\b/i.test(s),
    intent: 'notification.schedule',
    extractParams: (s) => ({ content: s }),
  },

  // Note creation (generic flags)
  {
    test: (s) => /-\w+/.test(s) || /^(?:note|notitie|schrijf|schrijf op)[: ]/i.test(s),
    intent: 'note.create',
    extractParams: (s) => ({ content: s }),
  },

  // Task list (no filters)
  {
    test: (s) => /^(?:wat moet ik doen|show tasks|list tasks|mijn taken|toon taken)\b/i.test(s),
    intent: 'task.list',
    extractParams: () => ({}),
  },
]

/**
 * Rule-based intent detection. Fast, free, offline-capable.
 */
function detectByRules(input: string): DetectedIntent | null {
  for (const rule of RULES) {
    if (rule.test(input)) {
      return {
        intent: rule.intent,
        params: rule.extractParams(input),
        method: 'rule',
      }
    }
  }
  return null
}

/**
 * AI-based intent classification. Only called when rules don't match.
 */
async function classifyWithAI(input: string, aiKey: string, aiProvider: string): Promise<DetectedIntent> {
  const systemPrompt = `You are an intent classifier for a personal productivity assistant.
Classify the user input into exactly one intent from this list:
- note.create (creating a general note)
- note.create.shopping (shopping list item)
- task.create (creating a task/todo)
- task.create.reminder (create a task with a reminder)
- task.list (list open tasks)
- task.list.today (list today's tasks)
- task.complete (mark a task as done)
- tracker.checkin (log health metrics: mood, sleep, energy, etc.)
- tracker.query (query health data/trends)
- calendar.today (show today's calendar events)
- habits.status (check habit streaks and status)
- notification.schedule (schedule a notification/reminder)
- general.question (general question or unclassified)

Reply with ONLY valid JSON in this format:
{"intent": "...", "params": {"content": "..."}}

Do not include any other text.`

  try {
    let url: string
    let body: Record<string, unknown>
    let headers: Record<string, string>

    if (aiProvider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages'
      headers = {
        'x-api-key': aiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      }
      body = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: systemPrompt,
        messages: [{ role: 'user', content: input }],
      }
    } else {
      // OpenAI compatible
      url = 'https://api.openai.com/v1/chat/completions'
      headers = {
        'Authorization': `Bearer ${aiKey}`,
        'content-type': 'application/json',
      }
      body = {
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`AI API error: ${res.status}`)

    const data = await res.json()
    const text =
      aiProvider === 'anthropic'
        ? data.content?.[0]?.text
        : data.choices?.[0]?.message?.content

    const parsed = JSON.parse(text ?? '{}')
    return {
      intent: parsed.intent ?? 'unknown',
      params: parsed.params ?? { content: input },
      method: 'ai',
    }
  } catch {
    return { intent: 'note.create', params: { content: input }, method: 'ai' }
  }
}

/**
 * Main intent resolution: rules first, AI fallback.
 */
export async function resolveIntent(
  input: string,
  aiConfig?: { key: string; provider: string }
): Promise<DetectedIntent> {
  // Try rule-based first
  const ruleResult = detectByRules(input)
  if (ruleResult) return ruleResult

  // AI fallback if configured
  if (aiConfig?.key) {
    return classifyWithAI(input, aiConfig.key, aiConfig.provider)
  }

  // Default: create a note
  return { intent: 'note.create', params: { content: input }, method: 'rule' }
}
