/**
 * Rule Engine — Tier 2: Natural language pattern matching (no AI cost)
 *
 * Two rule sources:
 * 1. Static rules — auto-collected from registered tools at import time
 * 2. Dynamic rules — loaded from assistant_rules table at runtime (trainer-generated)
 *
 * Static rules are checked first, then dynamic rules.
 */

import type { Domain, Intent, RoutedCommand, RuleDefinition } from '../types.ts'
import { ALL_TOOLS } from '../tools/registry.ts'

interface RegisteredRule extends RuleDefinition {
  domain: Domain
}

interface DynamicRule {
  id: string
  domain: string
  pattern: string   // regex string from DB
  action: string
  confidence: number
}

// Build static rule list from all registered tools.
//
// Built lazily on first use (not at module load). Reading ALL_TOOLS at import
// time hits its temporal dead zone via the registry → system.tool → rule-engine
// → registry import cycle and throws "Cannot access 'ALL_TOOLS' before
// initialization", crashing the edge function at boot. Deferring to first call
// sidesteps the cycle. See command-parser.ts for the same fix.
let staticRules: RegisteredRule[] | null = null
function getStaticRules(): RegisteredRule[] {
  if (staticRules) return staticRules
  staticRules = ALL_TOOLS.flatMap(tool =>
    tool.rules.map(rule => ({ ...rule, domain: tool.domain }))
  )
  return staticRules
}

/**
 * Tries to match input against static registered rules.
 * Returns null if no rule matches.
 */
export function matchRules(input: string): RoutedCommand | null {
  // Check static rules first
  for (const rule of getStaticRules()) {
    const match = rule.pattern.exec(input)
    if (match) {
      const params = rule.extractParams
        ? rule.extractParams(match, input)
        : { content: input }

      return {
        domain: rule.domain,
        action: rule.action as Intent,
        params,
        rawInput: input,
        routingMethod: 'rule',
      }
    }
  }
  return null
}

/**
 * Match against dynamic rules loaded from the database.
 * Called after static rules fail but before AI classification.
 */
export function matchDynamicRules(input: string, dynamicRules: DynamicRule[]): RoutedCommand | null {
  for (const rule of dynamicRules) {
    try {
      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(input)) {
        return {
          domain: rule.domain as Domain,
          action: rule.action as Intent,
          params: { content: input },
          rawInput: input,
          routingMethod: 'rule',
        }
      }
    } catch {
      // Invalid regex — skip this rule
      console.error(`Invalid dynamic rule pattern: ${rule.pattern} (rule ${rule.id})`)
    }
  }
  return null
}

/**
 * Load active dynamic rules for a user from the database.
 */
export async function loadDynamicRules(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<DynamicRule[]> {
  const { data, error } = await supabase
    .from('assistant_rules')
    .select('id, domain, pattern, action, confidence')
    .eq('user_id', userId)
    .eq('active', true)
    .order('confidence', { ascending: false })

  if (error) {
    console.error('Failed to load dynamic rules:', error.message)
    return []
  }

  return data ?? []
}

/**
 * Get all static rules (useful for debugging/HR agent).
 */
export function getAllRules(): RegisteredRule[] {
  return getStaticRules()
}
