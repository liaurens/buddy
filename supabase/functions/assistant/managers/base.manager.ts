/**
 * Domain Manager Factory
 *
 * Auto-creates a manager for any domain by reading registered tools.
 * Each manager only has access to its own domain's tools and actions.
 */

import type { Domain, ToolDefinition, ToolResult, AgentContext, Intent } from '../types.ts';
import { ALL_TOOLS } from '../tools/registry.ts';

export interface DomainManager {
    domain: Domain;
    tools: ToolDefinition[];
    hasAction: (action: Intent) => boolean;
    execute: (
        action: Intent,
        params: Record<string, unknown>,
        context: AgentContext,
    ) => Promise<ToolResult>;
}

export function createDomainManager(domain: Domain): DomainManager {
    const tools = ALL_TOOLS.filter((t) => t.domain === domain);

    // Build action → handler map for this domain
    const actionMap = new Map<
        string,
        (params: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>
    >();
    for (const tool of tools) {
        for (const action of tool.actions) {
            actionMap.set(action.action, action.handler);
        }
    }

    return {
        domain,
        tools,

        hasAction(action: Intent): boolean {
            return actionMap.has(action);
        },

        async execute(
            action: Intent,
            params: Record<string, unknown>,
            context: AgentContext,
        ): Promise<ToolResult> {
            const handler = actionMap.get(action);
            if (!handler) {
                return {
                    success: false,
                    action_taken: `Unknown action "${action}" for domain "${domain}"`,
                    data: {},
                };
            }
            return handler(params, context);
        },
    };
}
