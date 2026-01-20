import { supabase, getSetting, setSetting } from './supabase';
import type { Entry, TrackerDefinition, CorrelationResult } from '../types';

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}

// AI Provider types
export type AIProvider = 'openai' | 'anthropic' | 'custom';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model: string;
    baseUrl?: string; // For custom providers
}

export interface InsightRequest {
    correlations: CorrelationResult[];
    entries: Entry[];
    trackers: TrackerDefinition[];
    question?: string;
}

export interface InsightResponse {
    insights: string[];
    suggestions: string[];
    rawResponse?: string;
}

// Storage keys
const CONFIG_KEY_PROVIDER = 'ai_provider';
const CONFIG_KEY_API_KEY = 'ai_api_key';
const CONFIG_KEY_MODEL = 'ai_model';
const CONFIG_KEY_BASE_URL = 'ai_base_url';

/**
 * Get AI configuration from storage
 */
export async function getAIConfig(): Promise<AIConfig | null> {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const provider = await getSetting(userId, CONFIG_KEY_PROVIDER);
    const apiKey = await getSetting(userId, CONFIG_KEY_API_KEY);
    const model = await getSetting(userId, CONFIG_KEY_MODEL);
    const baseUrl = await getSetting(userId, CONFIG_KEY_BASE_URL);

    if (!provider || !apiKey) {
        return null;
    }

    return {
        provider: provider as AIProvider,
        apiKey,
        model: model || getDefaultModel(provider as AIProvider),
        baseUrl,
    };
}

/**
 * Save AI configuration
 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    await setSetting(userId, CONFIG_KEY_PROVIDER, config.provider);
    await setSetting(userId, CONFIG_KEY_API_KEY, config.apiKey);
    await setSetting(userId, CONFIG_KEY_MODEL, config.model);
    if (config.baseUrl) {
        await setSetting(userId, CONFIG_KEY_BASE_URL, config.baseUrl);
    }
}

/**
 * Clear AI configuration
 */
export async function clearAIConfig(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    // Set to empty string to clear
    await setSetting(userId, CONFIG_KEY_API_KEY, '');
}

/**
 * Get default model for provider
 */
function getDefaultModel(provider: AIProvider): string {
    switch (provider) {
        case 'openai':
            return 'gpt-4o-mini';
        case 'anthropic':
            return 'claude-3-haiku-20240307';
        case 'custom':
            return '';
        default:
            return '';
    }
}

/**
 * Build API endpoint for provider
 */
function getAPIEndpoint(config: AIConfig): string {
    if (config.baseUrl) {
        return config.baseUrl;
    }

    switch (config.provider) {
        case 'openai':
            return 'https://api.openai.com/v1/chat/completions';
        case 'anthropic':
            return 'https://api.anthropic.com/v1/messages';
        default:
            throw new Error('Unknown provider');
    }
}

/**
 * Format data for AI prompt
 */
function formatDataForPrompt(request: InsightRequest): string {
    const trackerMap = new Map(request.trackers.map(t => [t.id, t]));

    let prompt = `I'm tracking personal health metrics. Here's my data:\n\n`;

    // Summarize trackers
    prompt += `**Metrics I track:**\n`;
    request.trackers.forEach(t => {
        prompt += `- ${t.emoji} ${t.name} (${t.type}, ${t.unit || 'no unit'})\n`;
    });

    // Summarize correlations
    if (request.correlations.length > 0) {
        prompt += `\n**Correlations found:**\n`;
        request.correlations.forEach(c => {
            const inputTracker = trackerMap.get(c.inputTrackerId);
            const outputTracker = trackerMap.get(c.outputTrackerId);
            if (inputTracker && outputTracker) {
                prompt += `- ${inputTracker.name} → ${outputTracker.name}: r=${c.correlation.toFixed(2)}`;
                if (c.optimalLagHours > 0) {
                    prompt += ` (${c.optimalLagHours}h lag)`;
                }
                prompt += `\n`;
            }
        });
    }

    // Recent entries summary
    const last7Days = request.entries.slice(0, 50);
    if (last7Days.length > 0) {
        prompt += `\n**Recent entries (last ${last7Days.length}):**\n`;
        const byTracker: Record<string, number[]> = {};
        last7Days.forEach(e => {
            if (!byTracker[e.trackerId]) byTracker[e.trackerId] = [];
            byTracker[e.trackerId].push(e.value);
        });

        Object.entries(byTracker).forEach(([trackerId, values]) => {
            const tracker = trackerMap.get(trackerId);
            if (tracker) {
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                prompt += `- ${tracker.name}: avg ${avg.toFixed(1)} ${tracker.unit || ''} (${values.length} entries)\n`;
            }
        });
    }

    return prompt;
}

/**
 * Generate insights using AI (generic - works with OpenAI-compatible APIs)
 */
export async function generateInsights(
    request: InsightRequest,
    config: AIConfig
): Promise<InsightResponse> {
    const dataPrompt = formatDataForPrompt(request);

    const systemPrompt = `You are a helpful health data analyst. Analyze the user's tracking data and provide:
1. Key insights about patterns you notice
2. Actionable suggestions based on correlations
3. Things to watch out for or investigate further

Be concise, friendly, and focus on practical advice. Don't make medical claims.`;

    const userPrompt = request.question
        ? `${dataPrompt}\n\n**Question:** ${request.question}`
        : `${dataPrompt}\n\nWhat patterns and insights do you see in my data?`;

    try {
        const response = await callAI(config, systemPrompt, userPrompt);

        // Simple parsing - split into insights and suggestions
        const lines = response.split('\n').filter(l => l.trim());
        const insights: string[] = [];
        const suggestions: string[] = [];

        let currentSection = 'insights';
        lines.forEach(line => {
            const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
            if (cleanLine.toLowerCase().includes('suggestion') || cleanLine.toLowerCase().includes('recommend')) {
                currentSection = 'suggestions';
            }
            if (cleanLine && !cleanLine.match(/^#{1,3}\s/)) {
                if (currentSection === 'insights') {
                    insights.push(cleanLine);
                } else {
                    suggestions.push(cleanLine);
                }
            }
        });

        return {
            insights: insights.slice(0, 5),
            suggestions: suggestions.slice(0, 5),
            rawResponse: response,
        };
    } catch (error) {
        console.error('AI call failed:', error);
        throw error;
    }
}

/**
 * Make API call to AI provider
 */
async function callAI(config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> {
    const endpoint = getAPIEndpoint(config);

    // OpenAI-compatible format (works for most providers)
    const body = {
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Set auth header based on provider
    if (config.provider === 'openai' || config.provider === 'custom') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    } else if (config.provider === 'anthropic') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Extract content based on provider response format
    if (config.provider === 'anthropic') {
        return data.content?.[0]?.text || '';
    }

    // OpenAI format (default)
    return data.choices?.[0]?.message?.content || '';
}

/**
 * Check if AI is configured
 */
export async function isAIConfigured(): Promise<boolean> {
    const config = await getAIConfig();
    return config !== null && config.apiKey.length > 0;
}
