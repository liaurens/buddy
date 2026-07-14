import type { AgentContext, ToolDefinition, ToolResult } from '../types.ts';
import { callAI } from '../core/ai-wrapper.ts';
import { hashCaptureToken } from '../../_shared/capture-token.ts';

type AIProvider = 'openai' | 'anthropic' | 'gemini';

function asProvider(value: unknown): AIProvider {
    return value === 'anthropic' || value === 'gemini' ? value : 'openai';
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value)
        ? value.filter(
              (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
          )
        : [];
}

function parseJSON(content: string): Record<string, unknown> {
    const cleaned = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('AI returned an invalid JSON object');
    }
    return parsed as Record<string, unknown>;
}

async function generateJSON(
    context: AgentContext,
    purpose: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1600,
): Promise<Record<string, unknown>> {
    if (!context.aiConfig?.key) throw new Error('AI is not configured');
    const result = await callAI(userPrompt, context.aiConfig, {
        purpose,
        model: context.aiConfig.model,
        maxTokens,
        temperature: 0.2,
        responseFormat: 'json',
        systemPrompt,
    });
    return parseJSON(result.content);
}

async function handleConfigStatus(
    _params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const supabase = context.supabase as {
        from: (table: string) => {
            select: (columns: string) => {
                eq: (
                    column: string,
                    value: string,
                ) => {
                    maybeSingle: () => Promise<{
                        data: Record<string, unknown> | null;
                        error: { message: string } | null;
                    }>;
                };
            };
        };
    };
    const { data, error } = await supabase
        .from('ai_credentials')
        .select('provider, model')
        .eq('user_id', context.userId)
        .maybeSingle();
    if (error)
        return {
            success: false,
            action_taken: 'Could not load AI settings',
            data: { error: error.message },
        };
    return {
        success: true,
        action_taken: 'Loaded AI settings',
        data: {
            configured: Boolean(data),
            provider: asProvider(data?.provider),
            model: typeof data?.model === 'string' ? data.model : null,
        },
    };
}

async function handleConfigSave(
    params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const provider = asProvider(params.provider);
    const apiKey = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
    const model =
        typeof params.model === 'string' && params.model.trim() ? params.model.trim() : null;
    const supabase = context.supabase as {
        from: (table: string) => {
            select: (columns: string) => {
                eq: (
                    column: string,
                    value: string,
                ) => {
                    maybeSingle: () => Promise<{
                        data: { api_key?: string } | null;
                        error: { message: string } | null;
                    }>;
                };
            };
            upsert: (
                value: Record<string, unknown>,
                options: Record<string, unknown>,
            ) => Promise<{ error: { message: string } | null }>;
        };
    };
    const { data: existing, error: readError } = await supabase
        .from('ai_credentials')
        .select('api_key')
        .eq('user_id', context.userId)
        .maybeSingle();
    if (readError)
        return {
            success: false,
            action_taken: 'Could not load AI settings',
            data: { error: readError.message },
        };
    const secret = apiKey || existing?.api_key;
    if (!secret)
        return { success: false, action_taken: 'Enter an API key before saving', data: {} };
    const { error } = await supabase.from('ai_credentials').upsert(
        {
            user_id: context.userId,
            provider,
            api_key: secret,
            model,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
    );
    if (error)
        return {
            success: false,
            action_taken: 'Could not save AI settings',
            data: { error: error.message },
        };
    return {
        success: true,
        action_taken: 'AI settings saved',
        data: { configured: true, provider, model },
    };
}

async function handleConfigTest(
    params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const candidateKey = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
    const config = candidateKey
        ? {
              key: candidateKey,
              provider: asProvider(params.provider),
              model:
                  typeof params.model === 'string' && params.model.trim()
                      ? params.model.trim()
                      : undefined,
          }
        : context.aiConfig;
    if (!config?.key) return { success: false, action_taken: 'AI is not configured', data: {} };
    const result = await callAI('Return {"ok":true}.', config, {
        purpose: 'connection_test',
        model: config.model,
        maxTokens: 40,
        temperature: 0,
        responseFormat: 'json',
        systemPrompt: 'Return valid JSON only.',
    });
    return {
        success: true,
        action_taken: 'AI connection works',
        data: { ok: true, provider: result.provider, model: result.model },
    };
}

async function handleCaptureTokenStatus(
    _params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const { data, error } = await context.supabase
        .from('capture_tokens')
        .select('token_prefix, created_at, last_used_at')
        .eq('user_id', context.userId)
        .maybeSingle();
    if (error)
        return {
            success: false,
            action_taken: 'Could not load capture token status',
            data: { error: error.message },
        };
    return {
        success: true,
        action_taken: 'Loaded capture token status',
        data: {
            configured: Boolean(data),
            prefix: data?.token_prefix ?? null,
            createdAt: data?.created_at ?? null,
            lastUsedAt: data?.last_used_at ?? null,
        },
    };
}

async function handleCaptureTokenRotate(
    _params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const random = crypto.getRandomValues(new Uint8Array(24));
    const secret = `qn_${Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    const tokenHash = await hashCaptureToken(secret);
    const { error } = await context.supabase.from('capture_tokens').upsert(
        {
            user_id: context.userId,
            token_hash: tokenHash,
            token_prefix: secret.slice(0, 7),
            created_at: new Date().toISOString(),
            last_used_at: null,
        },
        { onConflict: 'user_id' },
    );
    if (error)
        return {
            success: false,
            action_taken: 'Could not rotate capture token',
            data: { error: error.message },
        };
    return {
        success: true,
        action_taken: 'Capture token rotated',
        data: { configured: true, prefix: secret.slice(0, 7), token: secret },
    };
}

async function handleAccountSecretsClear(
    _params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const [aiResult, tokenResult] = await Promise.all([
        context.supabase.from('ai_credentials').delete().eq('user_id', context.userId),
        context.supabase.from('capture_tokens').delete().eq('user_id', context.userId),
    ]);
    const error = aiResult.error ?? tokenResult.error;
    if (error) {
        return {
            success: false,
            action_taken: 'Could not remove private credentials',
            data: { error: error.message },
        };
    }
    return { success: true, action_taken: 'Private credentials removed', data: {} };
}

async function handleSplit(
    params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const title = typeof params.title === 'string' ? params.title.trim() : '';
    if (!title) return { success: false, action_taken: 'Task title is required', data: {} };
    const estimatedMinutes =
        typeof params.estimatedMinutes === 'number' ? params.estimatedMinutes : 60;
    const systemPrompt =
        typeof params.systemPrompt === 'string'
            ? params.systemPrompt
            : 'Break tasks into concrete, independently actionable subtasks. Return JSON only.';
    const userPrompt =
        typeof params.userPrompt === 'string'
            ? params.userPrompt
            : `Break down "${title}" into 3-5 subtasks totaling about ${estimatedMinutes} minutes. Return {"subtasks":[{"title":"...","estimatedMinutes":10}]}.`;
    const data = await generateJSON(context, 'task_split', systemPrompt, userPrompt);
    return { success: true, action_taken: 'Generated task breakdown', data };
}

async function handleOrganize(
    params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const tasks = asRecordArray(params.tasks);
    const taskTypes = asRecordArray(params.taskTypes);
    const todayIso =
        typeof params.todayIso === 'string'
            ? params.todayIso
            : new Date().toISOString().slice(0, 10);
    const systemPrompt = `Organize tasks. Return JSON only. kind: urgent|deadline|standard|routine|backlog; priority: urgent|high|medium|low; taskTypeId must be a supplied id or null; dueDate is YYYY-MM-DD or null. Today is ${todayIso}.`;
    const userPrompt = `Task types: ${JSON.stringify(taskTypes)}\nTasks: ${JSON.stringify(tasks)}\nReturn {"suggestions":[{"id":"...","taskTypeId":null,"kind":"standard","priority":"medium","dueDate":null,"reason":"short reason"}]}.`;
    const data = await generateJSON(context, 'task_organize', systemPrompt, userPrompt);
    return { success: true, action_taken: 'Generated task organization suggestions', data };
}

async function handleTriage(
    params: Record<string, unknown>,
    context: AgentContext,
): Promise<ToolResult> {
    const tasks = asRecordArray(params.tasks);
    const assignments = asRecordArray(params.assignments);
    const taskTypes = asRecordArray(params.taskTypes);
    const todayIso =
        typeof params.todayIso === 'string'
            ? params.todayIso
            : new Date().toISOString().slice(0, 10);
    const learnings =
        typeof params.learningsDoc === 'string' ? params.learningsDoc.slice(0, 8000) : '';
    const systemPrompt = `Sort captured tasks. Destinations: urgent, today, someday, school, routine. Return JSON only. Use confidence high only when the route is obvious. Today is ${todayIso}. Use only supplied assignment ids and task type names.`;
    const userPrompt = `Assignments: ${JSON.stringify(assignments)}\nTask types: ${JSON.stringify(taskTypes)}\nPast corrections: ${learnings}\nTasks: ${JSON.stringify(tasks)}\nReturn {"suggestions":[{"id":"...","destination":"today","confidence":"low","hardness":null,"dueDate":null,"dueTime":null,"assignmentId":null,"recurrence":null,"location":null,"context":null,"energy":null,"estimatedMinutes":null,"taskTypeName":null,"reason":"short reason"}]}.`;
    const data = await generateJSON(context, 'task_triage', systemPrompt, userPrompt, 2400);
    return { success: true, action_taken: 'Generated triage suggestions', data };
}

export const taskAITool: ToolDefinition = {
    id: 'task-ai',
    domain: 'planning',
    description: 'Direct UI-only task AI and credential actions',
    actions: [
        {
            action: 'ai.config.status',
            description: 'Read AI configuration status',
            handler: handleConfigStatus,
        },
        {
            action: 'ai.config.save',
            description: 'Save AI configuration',
            handler: handleConfigSave,
        },
        {
            action: 'ai.config.test',
            description: 'Test AI configuration',
            handler: handleConfigTest,
        },
        {
            action: 'capture.token.status',
            description: 'Read shortcut capture token status',
            handler: handleCaptureTokenStatus,
        },
        {
            action: 'capture.token.rotate',
            description: 'Rotate shortcut capture token',
            handler: handleCaptureTokenRotate,
        },
        {
            action: 'account.secrets.clear',
            description: 'Remove private credentials during account data reset',
            handler: handleAccountSecretsClear,
        },
        { action: 'task.ai.split', description: 'Break down a task', handler: handleSplit },
        { action: 'task.ai.organize', description: 'Organize tasks', handler: handleOrganize },
        { action: 'task.ai.triage', description: 'Triage captured tasks', handler: handleTriage },
    ],
    commands: [],
    rules: [],
};
