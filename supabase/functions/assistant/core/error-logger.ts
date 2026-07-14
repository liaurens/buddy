import type { AssistantSupabaseClient } from '../types.ts';

/**
 * Error Logger — Dedicated error logging for the assistant pipeline.
 *
 * Captures every error with full context (input, step, stack trace, partial state)
 * into the assistant_error_logs table. All logging is non-blocking (fire-and-forget)
 * so errors in the logger never break the main flow.
 *
 * This data feeds future self-learning: pattern detection, auto-rule generation,
 * and anomaly analysis via the HR/trainer agent system.
 */

export type ErrorType =
    | 'routing_error'
    | 'execution_error'
    | 'ai_error'
    | 'validation_error'
    | 'auth_error';
export type ErrorStep =
    | 'routing'
    | 'execution'
    | 'ai_classification'
    | 'ai_conversation'
    | 'parsing'
    | 'auth'
    | 'validation';

export interface ErrorLogEntry {
    userId: string;
    input: string;
    errorType: ErrorType;
    errorMessage: string;
    errorStack?: string;
    step: ErrorStep;
    domain?: string;
    intent?: string;
    routingMethod?: string;
    aiProvider?: string;
    aiModel?: string;
    requestMetadata?: Record<string, unknown>;
    context?: Record<string, unknown>;
}

/**
 * Log an error to the assistant_error_logs table.
 * Non-blocking — never throws, never interrupts the main flow.
 */
export async function logError(
    entry: ErrorLogEntry,
    supabase: AssistantSupabaseClient,
): Promise<void> {
    try {
        await supabase.from('assistant_error_logs').insert({
            user_id: entry.userId,
            input: entry.input,
            error_type: entry.errorType,
            error_message: entry.errorMessage,
            error_stack: entry.errorStack || null,
            step: entry.step,
            domain: entry.domain || null,
            intent: entry.intent || null,
            routing_method: entry.routingMethod || null,
            ai_provider: entry.aiProvider || null,
            ai_model: entry.aiModel || null,
            request_metadata: entry.requestMetadata || {},
            context: entry.context || {},
        });
    } catch {
        // Non-critical — swallow silently so the main flow is never affected
        console.error('[error-logger] Failed to log error to database');
    }
}

/**
 * Helper: extract error info from an unknown error value.
 */
export function extractError(err: unknown): { message: string; stack?: string } {
    if (err instanceof Error) {
        return { message: err.message, stack: err.stack };
    }
    return { message: String(err) };
}
