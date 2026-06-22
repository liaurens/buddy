/**
 * AI Service - Unified interface for OpenAI, Anthropic, and Gemini
 *
 * Currently used for task breakdown (AITaskSplitter). The daily-planning
 * AI flows have been removed.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

// ============================================================================
// Types
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string; // Optional: override default model
}

export interface AIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    tokensUsed?: number;
    model?: string;
}

/** A single task handed to the organizer. */
export interface TaskOrganizationInput {
    id: string;
    title: string;
    priority?: string;
    dueDate?: string;
}

/** The organizer's proposed categorization for one task. */
export interface TaskOrganizationSuggestion {
    id: string;
    taskTypeId: string | null;
    kind: 'urgent' | 'backlog' | 'deadline' | 'routine' | 'standard';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    dueDate: string | null;
    reason: string;
}

/** A captured task handed to the morning triage router. */
export interface TaskTriageInput {
    id: string;
    title: string;
    dueDate?: string;
    priority?: string;
}

/** A school assignment the triage router can route a task into. */
export interface TriageAssignmentOption {
    id: string;
    title: string;
    className?: string;
}

export type TriageDestinationValue = 'urgent' | 'today' | 'someday' | 'school' | 'routine';

/** The router's proposed destination + full profile for one captured task. */
export interface TaskTriageSuggestion {
    id: string;
    destination: TriageDestinationValue;
    /** high = safe to auto-apply at capture; low = surface for human review. */
    confidence: 'high' | 'low';
    /** fixed = planner locks it; flexible = reschedulable. */
    hardness: 'fixed' | 'flexible' | null;
    /** YYYY-MM-DD when a concrete day is implied (mainly for "today"/"school"). */
    dueDate: string | null;
    /** today: optional start time HH:MM. */
    dueTime: string | null;
    /** school: which assignment to link to (null = loose school task). */
    assignmentId: string | null;
    /** routine: cadence to repeat on. */
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
    /** Where it gets done (free text), e.g. "Library". */
    location: string | null;
    context: 'computer' | 'phone' | 'home' | 'out' | 'anywhere' | null;
    energy: 'low' | 'medium' | 'high' | null;
    estimatedMinutes: number | null;
    reason: string;
}

// ============================================================================
// Provider Configuration
// ============================================================================

const DEFAULT_MODELS = {
    openai: 'gpt-4o', // Latest GPT-4 optimized model
    anthropic: 'claude-sonnet-4-20250514', // Latest Claude Sonnet
    gemini: 'gemini-3-flash-preview', // Gemini 3.0 Preview (free tier)
} as const;

// ============================================================================
// AI Service Class
// ============================================================================

export class AIService {
    private config: AIConfig;
    private openaiClient?: OpenAI;
    private anthropicClient?: Anthropic;
    private geminiClient?: GoogleGenAI;

    constructor(config: AIConfig) {
        this.config = config;
        this.initializeClient();
    }

    private initializeClient(): void {
        if (this.config.provider === 'openai') {
            this.openaiClient = new OpenAI({
                apiKey: this.config.apiKey,
                dangerouslyAllowBrowser: true, // Required for client-side usage
            });
        } else if (this.config.provider === 'anthropic') {
            this.anthropicClient = new Anthropic({
                apiKey: this.config.apiKey,
                dangerouslyAllowBrowser: true, // Required for client-side usage
            });
        } else {
            this.geminiClient = new GoogleGenAI({
                apiKey: this.config.apiKey,
            });
        }
    }

    /**
     * Break down a large task into subtasks
     */
    async breakdownTask(
        taskTitle: string,
        taskDescription: string,
        estimatedMinutes: number,
    ): Promise<AIResponse<{ subtasks: Array<{ title: string; estimatedMinutes: number }> }>> {
        const systemPrompt = `You are a task breakdown expert. Break down tasks into actionable subtasks.`;

        const userPrompt = `Break down this task into 3-5 concrete subtasks:

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}
Estimated time: ${estimatedMinutes} minutes

Return a JSON object with this structure:
{
  "subtasks": [
    { "title": "Subtask 1", "estimatedMinutes": 10 },
    { "title": "Subtask 2", "estimatedMinutes": 15 }
  ]
}`;

        type BreakdownData = { subtasks: Array<{ title: string; estimatedMinutes: number }> };
        try {
            if (this.config.provider === 'openai') {
                return await this.generateWithOpenAI<BreakdownData>(systemPrompt, userPrompt);
            } else if (this.config.provider === 'anthropic') {
                return await this.generateWithAnthropic<BreakdownData>(systemPrompt, userPrompt);
            } else {
                return await this.generateWithGemini<BreakdownData>(systemPrompt, userPrompt);
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Task breakdown failed',
            };
        }
    }

    /**
     * Propose a categorization (type, kind, priority, due date) for a batch of
     * tasks so the user can approve or adjust them quickly.
     */
    async organizeTasks(
        tasks: TaskOrganizationInput[],
        taskTypes: Array<{ id: string; name: string }>,
        todayIso: string,
    ): Promise<AIResponse<{ suggestions: TaskOrganizationSuggestion[] }>> {
        const typeList = taskTypes.length
            ? taskTypes.map((t) => `- ${t.name} (id: ${t.id})`).join('\n')
            : '(no task types defined — use null)';
        const taskList = tasks
            .map(
                (t) =>
                    `- id: ${t.id} | "${t.title}"${t.dueDate ? ` | due ${t.dueDate}` : ''}${t.priority ? ` | priority ${t.priority}` : ''}`,
            )
            .join('\n');

        const systemPrompt = `You organize a user's task inbox. For each task, propose the best categorization so the user can approve it quickly.

Rules:
- "taskTypeId" MUST be one of the provided type ids, or null if none fits.
- "kind" is exactly one of: urgent, deadline, standard, routine, backlog.
  - urgent: important and should be scheduled now.
  - deadline: due later, remind as it nears.
  - standard: everyday task tied to a day.
  - routine: repeats on a schedule.
  - backlog: someday / no pressure.
- "priority" is exactly one of: urgent, high, medium, low.
- "dueDate" is "YYYY-MM-DD" or null. Today is ${todayIso}. Only set a due date when the task clearly implies one.
- "reason" is a short justification (8 words max).
- Return one suggestion per task, keeping the exact id given.

Return a JSON object:
{
  "suggestions": [
    { "id": "...", "taskTypeId": "..." | null, "kind": "standard", "priority": "medium", "dueDate": null, "reason": "..." }
  ]
}`;

        const userPrompt = `Task types:
${typeList}

Tasks to organize:
${taskList}`;

        type OrganizeData = { suggestions: TaskOrganizationSuggestion[] };
        try {
            if (this.config.provider === 'openai') {
                return await this.generateWithOpenAI<OrganizeData>(systemPrompt, userPrompt);
            } else if (this.config.provider === 'anthropic') {
                return await this.generateWithAnthropic<OrganizeData>(systemPrompt, userPrompt);
            } else {
                return await this.generateWithGemini<OrganizeData>(systemPrompt, userPrompt);
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Task organization failed',
            };
        }
    }

    /**
     * Morning triage: route each captured task to a destination (urgent / today /
     * someday / school / routine). Learns from the user's past corrections, which
     * are passed in as a free-form doc and injected as worked examples.
     */
    async triageTasks(
        tasks: TaskTriageInput[],
        assignments: TriageAssignmentOption[],
        learningsDoc: string,
        todayIso: string,
    ): Promise<AIResponse<{ suggestions: TaskTriageSuggestion[] }>> {
        const assignmentList = assignments.length
            ? assignments
                  .map(
                      (a) =>
                          `- id: ${a.id} | "${a.title}"${a.className ? ` (${a.className})` : ''}`,
                  )
                  .join('\n')
            : '(no active assignments — never use the school destination)';
        const taskList = tasks
            .map(
                (t) =>
                    `- id: ${t.id} | "${t.title}"${t.dueDate ? ` | due ${t.dueDate}` : ''}${t.priority ? ` | priority ${t.priority}` : ''}`,
            )
            .join('\n');

        const learnings = learningsDoc.trim()
            ? `\n\nThe user has corrected you before. Learn from these and match their judgement:\n${learningsDoc.trim()}`
            : '';

        const systemPrompt = `You sort a user's captured task inbox. For each task pick the single best destination AND infer its full profile so the user barely has to touch it.

Destinations (use exactly one of these strings):
- "urgent": a big deal that must be scheduled onto the calendar now.
- "today": a normal task to do today.
- "someday": no pressure, no deadline — a backlog item.
- "school": belongs to school. Set "assignmentId" to a listed assignment id when it clearly matches one; otherwise leave it null (it becomes a loose school task — still valid).
- "routine": a repeating habit/chore — set "recurrence" to one of daily, weekly, weekdays, monthly.

Profile fields (infer when reasonably implied, else null):
- "confidence": "high" only when the destination AND the key fields are obvious from the title. Use "low" when the title is vague, ambiguous between destinations, or you are guessing — low-confidence tasks are shown to the user instead of auto-applied.
- "hardness": "fixed" when tied to a real moment that can't move (appointment, class, exam, hard deadline); "flexible" when it can slide. null if unclear.
- "dueDate": "YYYY-MM-DD" when a concrete day is implied, else null. Today is ${todayIso}.
- "dueTime": "HH:MM" or null. Only for "today" when a time is clearly implied.
- "assignmentId": one of the listed assignment ids, or null. Never invent one.
- "recurrence": null unless destination is "routine".
- "location": short free text (e.g. "Library", "home") or null.
- "context": one of computer, phone, home, out, anywhere — or null.
- "energy": low, medium, or high — or null.
- "estimatedMinutes": a positive integer estimate, or null.
- "reason": a short justification (8 words max).

Rules:
- Return one suggestion per task, keeping the exact id given.
- Be conservative with "confidence":"high" — when unsure, use "low".${learnings}

Return a JSON object:
{
  "suggestions": [
    { "id": "...", "destination": "today", "confidence": "low", "hardness": null, "dueDate": null, "dueTime": null, "assignmentId": null, "recurrence": null, "location": null, "context": null, "energy": null, "estimatedMinutes": null, "reason": "..." }
  ]
}`;

        const userPrompt = `Active assignments:
${assignmentList}

Captured tasks to sort:
${taskList}`;

        type TriageData = { suggestions: TaskTriageSuggestion[] };
        try {
            if (this.config.provider === 'openai') {
                return await this.generateWithOpenAI<TriageData>(systemPrompt, userPrompt);
            } else if (this.config.provider === 'anthropic') {
                return await this.generateWithAnthropic<TriageData>(systemPrompt, userPrompt);
            } else {
                return await this.generateWithGemini<TriageData>(systemPrompt, userPrompt);
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Task triage failed',
            };
        }
    }

    // ========================================================================
    // Provider-specific implementations
    // ========================================================================

    private async generateWithOpenAI<T = unknown>(
        systemPrompt: string,
        userPrompt: string,
    ): Promise<AIResponse<T>> {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        const model = this.config.model || DEFAULT_MODELS.openai;

        const completion = await this.openaiClient.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const data = JSON.parse(content) as T;

        return {
            success: true,
            data,
            tokensUsed: completion.usage?.total_tokens,
            model,
        };
    }

    private async generateWithAnthropic<T = unknown>(
        systemPrompt: string,
        userPrompt: string,
    ): Promise<AIResponse<T>> {
        if (!this.anthropicClient) {
            throw new Error('Anthropic client not initialized');
        }

        const model = this.config.model || DEFAULT_MODELS.anthropic;

        const message = await this.anthropicClient.messages.create({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.7,
        });

        const content = message.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type from Anthropic');
        }

        // Extract JSON from response (Claude may wrap it in markdown)
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const data = JSON.parse(jsonText) as T;

        return {
            success: true,
            data,
            tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
            model,
        };
    }

    private async generateWithGemini<T = unknown>(
        systemPrompt: string,
        userPrompt: string,
    ): Promise<AIResponse<T>> {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }

        const model = this.config.model || DEFAULT_MODELS.gemini;
        const prompt = `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown formatting.`;

        const response = await this.geminiClient.models.generateContent({
            model,
            contents: prompt,
            config: {
                temperature: 0.7,
                responseMimeType: 'application/json',
            },
        });

        const text = response.text || '';
        const data = JSON.parse(text) as T;

        return {
            success: true,
            data,
            tokensUsed: response.usageMetadata?.totalTokenCount,
            model,
        };
    }

    /**
     * Test the AI connection
     */
    async testConnection(): Promise<{ success: boolean; error?: string }> {
        try {
            const systemPrompt = 'You are a helpful assistant.';
            const userPrompt = 'Respond with a JSON object: { "status": "ok" }';

            let result;
            if (this.config.provider === 'openai') {
                result = await this.generateWithOpenAI(systemPrompt, userPrompt);
            } else if (this.config.provider === 'anthropic') {
                result = await this.generateWithAnthropic(systemPrompt, userPrompt);
            } else {
                result = await this.generateWithGemini(systemPrompt, userPrompt);
            }

            return { success: result.success };
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Connection test failed',
            };
        }
    }
}

// ============================================================================
// Singleton factory
// ============================================================================

let aiServiceInstance: AIService | null = null;

/**
 * Initialize the AI service with configuration
 */
export function initializeAIService(config: AIConfig): AIService {
    aiServiceInstance = new AIService(config);
    return aiServiceInstance;
}

/**
 * Get the current AI service instance
 */
export function getAIService(): AIService | null {
    return aiServiceInstance;
}

/**
 * Check if AI service is configured
 */
export function isAIConfigured(): boolean {
    return aiServiceInstance !== null;
}
