/**
 * Experiment Agent AI
 *
 * Calls Anthropic (or a fallback provider) with function calling so the agent
 * can inspect, analyze, and modify experiments on the user's behalf.
 */

import { EXPERIMENT_TOOLS, executeTool, type ToolContext } from './tools.ts';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface AgentRunResult {
    reply: string;
    toolsUsed: string[];
    tokensIn: number;
    tokensOut: number;
}

interface AIConfig {
    key: string;
    provider: string;
    model?: string;
}

const SYSTEM_PROMPT = `You are the Experiment Agent — a scientific research assistant embedded in a personal health-tracking app.

The user runs self-experiments to understand their body and mind (e.g. ADHD medication trials, sleep interventions, supplement stacks). Each experiment has:
- A hypothesis, status, and optional tags
- **Custom metrics** — experiment-specific things to track daily (focus rating, side effects text, hours slept, etc.)
- **Phases** — time ranges like "Baseline", "10mg", "20mg" with start/end dates
- **Check-in entries** — daily values for each metric

Your role:
- Help the user **design** experiments: suggest metrics (quantitative + qualitative), recommend phase structure, refine hypotheses
- **Analyze** results: summarize trends, compare phases, flag when sample size is too small
- **Modify** the experiment when asked (add metrics, shift phases, change status)
- Be scientifically honest: correlation ≠ causation, small n is weak evidence, confounds matter

When the user asks about their experiment, CALL TOOLS to get real data before answering. Don't speculate when you can look up actual values.

Be concise and plain-spoken. No fluff, no hedging with bullet lists unless genuinely helpful. Write like a smart friend who happens to know statistics. Max 4-5 sentences for most replies unless the user asks for depth.

If the user describes a new tracking need (e.g. "I also want to track my headaches"), offer to add it via update_metrics — but confirm the shape first (rating 1-10? boolean? text?).

For ADHD medication experiments specifically: useful metrics include focus (rating 1-10), concentration hours (number), appetite (rating 1-5), side effects (text), irritability (rating 1-5), task completion (number).`;

export async function runAgent(
    userMessage: string,
    history: ChatMessage[],
    config: AIConfig,
    context: ToolContext,
): Promise<AgentRunResult> {
    if (config.provider !== 'anthropic') {
        // Fall back to a plain text reply without tools
        return runPlainText(userMessage, history, config);
    }

    const model = config.model || 'claude-haiku-4-5-20251001';
    const toolsUsed: string[] = [];
    let tokensIn = 0;
    let tokensOut = 0;

    // Build messages from history + new user turn
    const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = history.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    messages.push({ role: 'user', content: userMessage });

    // Agent loop — up to 5 tool calls per turn
    for (let iter = 0; iter < 5; iter++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': config.key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                tools: EXPERIMENT_TOOLS,
                messages,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Anthropic API error: ${res.status} ${errText}`);
        }

        const data = await res.json();
        tokensIn += data.usage?.input_tokens ?? 0;
        tokensOut += data.usage?.output_tokens ?? 0;

        // Append the assistant turn to history
        messages.push({ role: 'assistant', content: data.content });

        // Find tool_use blocks
        const toolUses = (data.content ?? []).filter(
            (b: { type: string }) => b.type === 'tool_use',
        );

        if (toolUses.length === 0) {
            // Terminal — extract text
            const textBlocks = (data.content ?? []).filter(
                (b: { type: string }) => b.type === 'text',
            );
            const reply =
                textBlocks
                    .map((b: { text: string }) => b.text)
                    .join('\n')
                    .trim() || 'Done.';
            return { reply, toolsUsed, tokensIn, tokensOut };
        }

        // Execute each tool and append results
        const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
        for (const use of toolUses) {
            toolsUsed.push(use.name);
            try {
                const result = await executeTool(use.name, use.input ?? {}, context);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: use.id,
                    content: JSON.stringify(result),
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: use.id,
                    content: JSON.stringify({ ok: false, summary: `Tool error: ${msg}` }),
                });
            }
        }

        messages.push({ role: 'user', content: toolResults });
    }

    return {
        reply: 'I got stuck in a loop — try rephrasing your question?',
        toolsUsed,
        tokensIn,
        tokensOut,
    };
}

async function runPlainText(
    userMessage: string,
    history: ChatMessage[],
    config: AIConfig,
): Promise<AgentRunResult> {
    // Simple fallback for non-Anthropic providers — no tool calls
    const messages = [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
    ];

    if (config.provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.key}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model || 'gpt-4o-mini',
                max_tokens: 1024,
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
            }),
        });
        if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
        const data = await res.json();
        return {
            reply: data.choices?.[0]?.message?.content ?? '',
            toolsUsed: [],
            tokensIn: data.usage?.prompt_tokens ?? 0,
            tokensOut: data.usage?.completion_tokens ?? 0,
        };
    }

    // Gemini or unknown — return a placeholder
    return {
        reply: 'The experiment agent requires an Anthropic API key for full functionality (tool calls). Please configure one in Settings.',
        toolsUsed: [],
        tokensIn: 0,
        tokensOut: 0,
    };
}
