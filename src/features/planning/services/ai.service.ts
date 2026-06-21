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
        estimatedMinutes: number
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

        try {
            if (this.config.provider === 'openai') {
                return await this.generateWithOpenAI(systemPrompt, userPrompt);
            } else if (this.config.provider === 'anthropic') {
                return await this.generateWithAnthropic(systemPrompt, userPrompt);
            } else {
                return await this.generateWithGemini(systemPrompt, userPrompt);
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
            ? taskTypes.map(t => `- ${t.name} (id: ${t.id})`).join('\n')
            : '(no task types defined — use null)';
        const taskList = tasks
            .map(t => `- id: ${t.id} | "${t.title}"${t.dueDate ? ` | due ${t.dueDate}` : ''}${t.priority ? ` | priority ${t.priority}` : ''}`)
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

        try {
            if (this.config.provider === 'openai') {
                return await this.generateWithOpenAI(systemPrompt, userPrompt);
            } else if (this.config.provider === 'anthropic') {
                return await this.generateWithAnthropic(systemPrompt, userPrompt);
            } else {
                return await this.generateWithGemini(systemPrompt, userPrompt);
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Task organization failed',
            };
        }
    }

    // ========================================================================
    // Provider-specific implementations
    // ========================================================================

    private async generateWithOpenAI(
        systemPrompt: string,
        userPrompt: string
    ): Promise<AIResponse<any>> {
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

        const data = JSON.parse(content);

        return {
            success: true,
            data,
            tokensUsed: completion.usage?.total_tokens,
            model,
        };
    }

    private async generateWithAnthropic(
        systemPrompt: string,
        userPrompt: string
    ): Promise<AIResponse<any>> {
        if (!this.anthropicClient) {
            throw new Error('Anthropic client not initialized');
        }

        const model = this.config.model || DEFAULT_MODELS.anthropic;

        const message = await this.anthropicClient.messages.create({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt },
            ],
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

        const data = JSON.parse(jsonText);

        return {
            success: true,
            data,
            tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
            model,
        };
    }

    private async generateWithGemini(
        systemPrompt: string,
        userPrompt: string
    ): Promise<AIResponse<any>> {
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
        const data = JSON.parse(text);

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
