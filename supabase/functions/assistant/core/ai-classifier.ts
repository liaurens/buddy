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

Also report confidence in [0, 1]. Lower confidence (< 0.5) when:
- The input is a short fragment (1–2 words) that could fit multiple domains
- Multiple intents seem equally plausible
- The input is ambiguous between e.g. task / note / shopping / tracker check-in

When confidence is < 0.5, include 2–3 "alternatives" (never the same as the top pick) so the user can disambiguate.

Reply with ONLY valid JSON in this format:
{"intent": "...", "domain": "...", "params": {"content": "..."}, "confidence": 0.0, "alternatives": [{"intent": "...", "domain": "...", "label": "short user-facing label"}]}

Do not include any other text.`

export interface ClarifyCandidate {
  intent: Intent
  domain: Domain
  label: string
}

export interface ClassifyResult {
  routed: RoutedCommand
  aiResult: AICallResult
  confidence: number
  alternatives: ClarifyCandidate[]
}

function normalizeAlternatives(raw: unknown): ClarifyCandidate[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((a): ClarifyCandidate | null => {
      if (!a || typeof a !== 'object') return null
      const obj = a as Record<string, unknown>
      const intent = typeof obj.intent === 'string' ? obj.intent as Intent : null
      const domain = typeof obj.domain === 'string' ? obj.domain as Domain : null
      const label = typeof obj.label === 'string' ? obj.label : null
      if (!intent || !domain || !label) return null
      return { intent, domain, label }
    })
    .filter((a): a is ClarifyCandidate => a !== null)
    .slice(0, 3)
}

/**
 * Classify input using AI. Returns a routed command + AI call metadata.
 */
export async function classifyWithAI(
  input: string,
  aiKey: string,
  aiProvider: string,
  aiModel?: string
): Promise<ClassifyResult> {
  try {
    const aiResult = await callAI(input, { key: aiKey, provider: aiProvider }, {
      purpose: 'intent_classification',
      model: aiModel,
      maxTokens: 200,
      temperature: 0,
      systemPrompt: SYSTEM_PROMPT,
    })

    const parsed = JSON.parse(aiResult.content || '{}')
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 1

    return {
      routed: {
        domain: (parsed.domain as Domain) || 'extra',
        action: (parsed.intent as Intent) || 'general.question',
        params: parsed.params ?? { content: input },
        rawInput: input,
        routingMethod: 'ai',
      },
      aiResult,
      confidence,
      alternatives: normalizeAlternatives(parsed.alternatives),
    }
  } catch (err) {
    console.error('[ai-classifier] Classification failed:', err)
    // Fallback: route to general.question instead of silently creating a note
    return {
      routed: {
        domain: 'extra',
        action: 'general.question',
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
      confidence: 1,
      alternatives: [],
    }
  }
}
