/**
 * AI Classifier — Tier 3: AI-based intent classification (fallback)
 *
 * Only called when neither slash commands nor rules match.
 * Uses the AI wrapper for structured, tracked AI calls.
 */

import type { Domain, Intent, RoutedCommand } from '../types.ts'
import { ALL_TOOLS } from '../tools/registry.ts'
import { callAI, type AICallResult } from './ai-wrapper.ts'

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

function buildDomainList(): string {
  const domains = new Set<string>()
  for (const tool of ALL_TOOLS) {
    domains.add(tool.domain)
  }
  return Array.from(domains).join(', ')
}

const SYSTEM_PROMPT = `You are an intent classifier for a personal productivity assistant.
Classify the user input into exactly one intent and domain.

Available domains: ${buildDomainList()}

Available intents:
${buildIntentList()}

If the input doesn't clearly match any intent, use:
- intent: "general.question", domain: "extra"

Reply with ONLY valid JSON in this format:
{"intent": "...", "domain": "...", "params": {"content": "..."}}

Do not include any other text.`

export interface ClassifyResult {
  routed: RoutedCommand
  aiResult: AICallResult
}

/**
 * Classify input using AI. Returns a routed command + AI call metadata.
 */
export async function classifyWithAI(
  input: string,
  aiKey: string,
  aiProvider: string
): Promise<ClassifyResult> {
  try {
    const aiResult = await callAI(input, { key: aiKey, provider: aiProvider }, {
      purpose: 'intent_classification',
      maxTokens: 100,
      temperature: 0,
      systemPrompt: SYSTEM_PROMPT,
    })

    const parsed = JSON.parse(aiResult.content || '{}')

    return {
      routed: {
        domain: (parsed.domain as Domain) || 'extra',
        action: (parsed.intent as Intent) || 'general.question',
        params: parsed.params ?? { content: input },
        rawInput: input,
        routingMethod: 'ai',
      },
      aiResult,
    }
  } catch {
    // Fallback: create a note (safe default)
    return {
      routed: {
        domain: 'content',
        action: 'note.create',
        params: { content: input },
        rawInput: input,
        routingMethod: 'ai',
      },
      aiResult: {
        content: '',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 0,
        model: 'fallback',
        provider: aiProvider,
      },
    }
  }
}
