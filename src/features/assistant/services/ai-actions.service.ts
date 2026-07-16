import { invokeAssistantAction } from './assistant.service';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIConfigStatus {
    configured: boolean;
    provider: AIProvider;
    model: string | null;
}

export interface TaskOrganizationInput {
    id: string;
    title: string;
    priority?: string;
    dueDate?: string;
}

export interface TaskOrganizationSuggestion {
    id: string;
    taskTypeId: string | null;
    kind: 'urgent' | 'backlog' | 'deadline' | 'routine' | 'standard';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    dueDate: string | null;
    reason: string;
}

export interface TaskTriageInput {
    id: string;
    title: string;
    dueDate?: string;
    priority?: string;
    plannedFor?: string;
    flag?: string;
    recurrence?: string;
    estimatedMinutes?: number;
}

export type TriageDestinationValue =
    | 'urgent'
    | 'today'
    | 'deadline'
    | 'waiting'
    | 'someday'
    | 'school'
    | 'routine';

export interface TriageAssignmentOption {
    id: string;
    title: string;
    className?: string;
}

export interface TriageTaskTypeOption {
    id: string;
    name: string;
}

export interface TaskTriageSuggestion {
    id: string;
    destination: TriageDestinationValue;
    /** Normalized 0..1 confidence; suggestions at 0.80 or above may auto-apply. */
    confidence: number;
    hardness: 'fixed' | 'flexible' | null;
    dueDate: string | null;
    dueTime: string | null;
    plannedFor: string | null;
    waitingOn: string | null;
    assignmentId: string | null;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
    location: string | null;
    context: 'computer' | 'phone' | 'home' | 'out' | 'anywhere' | null;
    energy: 'low' | 'medium' | 'high' | null;
    estimatedMinutes: number | null;
    taskTypeId: string | null;
    reason: string;
}

async function invokeAIAction<T>(action: string, params: Record<string, unknown>): Promise<T> {
    const response = await invokeAssistantAction('planning', action, params);
    if (!response.success)
        throw new Error(response.error || response.action_taken || 'AI request failed');
    return response.data as T;
}

export function getAIConfigStatus(): Promise<AIConfigStatus> {
    return invokeAIAction<AIConfigStatus>('ai.config.status', {});
}

export function saveAIConfig(config: {
    provider: AIProvider;
    apiKey?: string;
    model?: string | null;
}): Promise<AIConfigStatus> {
    return invokeAIAction<AIConfigStatus>('ai.config.save', config);
}

export function testAIConfig(config?: {
    provider: AIProvider;
    apiKey?: string;
    model?: string | null;
}): Promise<{ ok: boolean; provider: string; model: string }> {
    return invokeAIAction('ai.config.test', config ?? {});
}

export function splitTask(params: {
    title: string;
    description?: string;
    estimatedMinutes: number;
    systemPrompt?: string;
    userPrompt?: string;
}): Promise<{ subtasks: Array<{ title: string; estimatedMinutes: number }> }> {
    return invokeAIAction('task.ai.split', params);
}

export function organizeTasks(params: {
    tasks: TaskOrganizationInput[];
    taskTypes: Array<{ id: string; name: string }>;
    todayIso: string;
}): Promise<{ suggestions: TaskOrganizationSuggestion[] }> {
    return invokeAIAction('task.ai.organize', params);
}

export function triageTasks(params: {
    tasks: TaskTriageInput[];
    assignments: TriageAssignmentOption[];
    learningsDoc: string;
    todayIso: string;
    taskTypes?: TriageTaskTypeOption[];
    workload?: Array<{ plannedFor?: string; estimatedMinutes?: number; flag?: string }>;
    calendarAvailability?: Array<{ date: string; freeMinutes: number }>;
    dayCapacity?: 'normal' | 'survival';
}): Promise<{ suggestions: TaskTriageSuggestion[] }> {
    return invokeAIAction('task.ai.triage', params);
}
