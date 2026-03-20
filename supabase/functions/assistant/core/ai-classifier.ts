/**
 * AI Classifier — Tier 3: AI-based intent classification (fallback)
 *
 * Only called when neither slash commands nor rules match.
 * Uses a cheap/fast model to classify into domain + action.
 */

import type { Domain, Intent, RoutedCommand } from '../types.ts'
import { ALL_TOOLS } from '../tools/registry.ts'

// Build the intent list dynamically from the registry
function buildIntentList(): string {
  const intents: string[] = []
  for (const tool of ALL_TOOLS) {
    for (const action of tool.actions) {
      intents.push(`- ${action.action} (${action.description}) [domain: ${tool.domain}]`)
    }
  }
  return intents.join('\n')
}

// Build the domain list
function buildDomainList(): string {
  const domains = new Set<string>()
  for (const tool of ALL_TOOLS) {
    domains.add(tool.domain)
  }
  return Array.from(domains).join(', ')
}

/**
 * Classify input using AI. Returns a routed command.
 */
export async function classifyWithAI(
  input: string,
  aiKey: string,
  aiProvider: string
): Promise<RoutedCommand> {
  const systemPrompt = `You are an intent classifier for a personal productivity assistant.
Classify the user input into exactly one intent and domain.

Available domains: ${buildDomainList()}

Available intents:
${buildIntentList()}

If the input doesn't clearly match any intent, use:
- intent: "general.question", domain: "extra"

Reply with ONLY valid JSON in this format:
{"intent": "...", "domain": "...", "params": {"content": "..."}}

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
      domain: (parsed.domain as Domain) || 'extra',
      action: (parsed.intent as Intent) || 'general.question',
      params: parsed.params ?? { content: input },
      rawInput: input,
      routingMethod: 'ai',
    }
  } catch {
    // Fallback: create a note (safe default)
    return {
      domain: 'content',
      action: 'note.create',
      params: { content: input },
      rawInput: input,
      routingMethod: 'ai',
    }
  }
}
