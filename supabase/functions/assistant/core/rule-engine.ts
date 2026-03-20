/**
 * Rule Engine — Tier 2: Natural language pattern matching (no AI cost)
 *
 * Auto-collects rules from all registered tools and matches input
 * against them. Rules are checked in registration order.
 */

import type { Domain, Intent, RoutedCommand, RuleDefinition } from '../types.ts'
import { ALL_TOOLS } from '../tools/registry.ts'

interface RegisteredRule extends RuleDefinition {
  domain: Domain
}

// Build rule list from all registered tools
const ALL_RULES: RegisteredRule[] = ALL_TOOLS.flatMap(tool =>
  tool.rules.map(rule => ({ ...rule, domain: tool.domain }))
)

/**
 * Tries to match input against registered natural language rules.
 * Returns null if no rule matches.
 */
export function matchRules(input: string): RoutedCommand | null {
  for (const rule of ALL_RULES) {
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
 * Get all registered rules (useful for debugging/HR agent).
 */
export function getAllRules(): RegisteredRule[] {
  return ALL_RULES
}
