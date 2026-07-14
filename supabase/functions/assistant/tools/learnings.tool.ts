import type { AssistantSupabaseClient, ToolResult } from '../types.ts';

export type LearningType = 'new_rule' | 'correction' | 'behavior' | 'note';

export interface Learning {
    id: string;
    user_id: string;
    type: LearningType;
    content: Record<string, unknown>;
    active: boolean;
    created_at: string;
}

export async function createLearning(
    userId: string,
    type: LearningType,
    content: Record<string, unknown>,
    supabase: AssistantSupabaseClient,
): Promise<ToolResult> {
    const { data, error } = await supabase
        .from('assistant_learnings')
        .insert({ user_id: userId, type, content })
        .select()
        .single();

    if (error) {
        return {
            success: false,
            action_taken: 'Failed to save learning',
            data: { error: error.message },
        };
    }

    return {
        success: true,
        action_taken: `Learning recorded (${type})`,
        data: { learning_id: data.id },
    };
}

export async function getLearnings(
    userId: string,
    supabase: AssistantSupabaseClient,
    type?: LearningType,
): Promise<Learning[]> {
    let query = supabase
        .from('assistant_learnings')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (type) {
        query = query.eq('type', type);
    }

    const { data } = await query;
    return data ?? [];
}

export interface LogEntry {
    userId: string;
    input: string;
    detectedIntent: string;
    detectionMethod: string;
    response: Record<string, unknown>;
    source: string;
    tokensUsed: number;
    latencyMs: number;
    domain?: string;
    toolId?: string;
    routingMethod?: string;
    errorDetails?: Record<string, unknown>;
    aiCalls?: Array<Record<string, unknown>>;
    processingSteps?: Array<Record<string, unknown>>;
}

export async function logInteraction(
    entry: LogEntry,
    supabase: AssistantSupabaseClient,
): Promise<void> {
    try {
        await supabase.from('assistant_logs').insert({
            user_id: entry.userId,
            input: entry.input,
            detected_intent: entry.detectedIntent,
            detection_method: entry.detectionMethod,
            response: entry.response,
            tokens_used: entry.tokensUsed,
            latency_ms: entry.latencyMs,
            source: entry.source,
            domain: entry.domain || null,
            tool_id: entry.toolId || null,
            routing_method: entry.routingMethod || null,
            error_details: entry.errorDetails || null,
            ai_calls: entry.aiCalls || [],
            processing_steps: entry.processingSteps || [],
        });
    } catch {
        // Non-critical, don't throw
    }
}
