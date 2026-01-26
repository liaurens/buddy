/**
 * Planning Service - Daily plan generation and management
 *
 * Orchestrates:
 * - Context gathering (calendar, tasks, templates, patterns)
 * - AI-powered plan generation
 * - Plan persistence to database
 * - Plan retrieval and updates
 */

import { supabase } from '../../../services/supabase';
import { initializeAIService } from './ai.service';
import { generateDailyPlanSystemPrompt, generateDailyPlanUserPrompt } from './ai-prompts';
import { getLearningPatternsForPlanning } from './reflection.service';
import type {
    DailyPlan,
    TimeBlock,
    PlanGenerationContext,
    PlanSuggestion,
    CalendarEvent,
    ActivityTemplate
} from '../../../types/planning';
import type { Task } from '../../../types';

// ============================================================================
// Context Gathering
// ============================================================================

/**
 * Fetch calendar events for a specific date
 */
async function getCalendarEventsForDate(userId: string, date: string): Promise<CalendarEvent[]> {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', userId)
            .gte('start_time', startOfDay.toISOString())
            .lte('start_time', endOfDay.toISOString())
            .order('start_time', { ascending: true });

        if (error) {
            // If table doesn't exist, return empty array (graceful degradation)
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                console.warn('calendar_events table not found - returning empty array');
                return [];
            }
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Failed to fetch calendar events:', error);
        return [];
    }
}

/**
 * Fetch pending tasks for planning
 */
async function getPendingTasks(userId: string): Promise<Task[]> {
    try {
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', userId)
            .eq('completed', false)
            .order('priority', { ascending: false })
            .order('dueDate', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Failed to fetch pending tasks:', error);
        return [];
    }
}

/**
 * Fetch active activity templates
 */
async function getActivityTemplates(userId: string): Promise<ActivityTemplate[]> {
    try {
        const { data, error } = await supabase
            .from('activity_templates')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            // If table doesn't exist, return empty array (graceful degradation)
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                console.warn('activity_templates table not found - returning empty array');
                return [];
            }
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Failed to fetch activity templates:', error);
        return [];
    }
}

/**
 * Build complete planning context
 */
export async function buildPlanningContext(
    userId: string,
    date: string,
    userState?: {
        mood?: number;
        energy?: number;
        sleepHours?: number;
    },
    preferences?: {
        workStartTime?: string;
        workEndTime?: string;
        includeLunchBreak?: boolean;
        lunchDuration?: number;
        includeShortBreaks?: boolean;
        shortBreakInterval?: number;
    }
): Promise<PlanGenerationContext> {
    const [calendarEvents, tasks, activityTemplates, learningPatterns] = await Promise.all([
        getCalendarEventsForDate(userId, date),
        getPendingTasks(userId),
        getActivityTemplates(userId),
        getLearningPatternsForPlanning(userId, 5),
    ]);

    // Format tasks for planning context
    const formattedTasks = tasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority || 'medium',
        estimatedTime: t.estimatedTime,
        deadline: t.dueDate,
    }));

    return {
        date,
        mood: userState?.mood,
        energy: userState?.energy,
        sleepHours: userState?.sleepHours,
        tasks: formattedTasks,
        calendarEvents,
        activityTemplates,
        learningPatterns,
        workStartTime: preferences?.workStartTime,
        workEndTime: preferences?.workEndTime,
        breakPreferences: preferences ? {
            includeLunchBreak: preferences.includeLunchBreak ?? true,
            lunchDuration: preferences.lunchDuration,
            includeShortBreaks: preferences.includeShortBreaks ?? true,
            shortBreakInterval: preferences.shortBreakInterval,
        } : undefined,
    };
}

// ============================================================================
// Plan Generation
// ============================================================================

/**
 * Generate a daily plan using AI
 */
export async function generateDailyPlan(
    userId: string,
    context: PlanGenerationContext
): Promise<PlanSuggestion> {
    try {
        // Get AI configuration
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .eq('user_id', userId)
            .in('key', ['ai_provider', 'ai_api_key', 'ai_model']);

        if (!settings || settings.length === 0) {
            throw new Error('AI not configured. Please configure AI in Settings.');
        }

        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        const provider = settingsMap['ai_provider'] as 'openai' | 'anthropic' | 'gemini';
        const apiKey = settingsMap['ai_api_key'];
        const model = settingsMap['ai_model'];

        if (!provider || !apiKey) {
            throw new Error('AI provider or API key not configured');
        }

        // Initialize AI service
        const aiService = initializeAIService({
            provider,
            apiKey,
            model: model || undefined,
        });

        // Generate plan
        const systemPrompt = generateDailyPlanSystemPrompt();
        const userPrompt = generateDailyPlanUserPrompt(context);

        const result = await aiService.generateDailyPlan(
            context,
            systemPrompt,
            userPrompt
        );

        if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to generate plan');
        }

        return result.data;
    } catch (error) {
        console.error('Failed to generate daily plan:', error);
        throw error;
    }
}

// ============================================================================
// Plan Persistence
// ============================================================================

/**
 * Save a generated plan to the database
 */
export async function savePlanToDatabase(
    userId: string,
    date: string,
    suggestion: PlanSuggestion,
    context: PlanGenerationContext,
    aiModel?: string
): Promise<DailyPlan> {
    try {
        // Create plan record
        const { data: plan, error: planError } = await supabase
            .from('daily_plans')
            .insert({
                user_id: userId,
                date,
                mood_at_plan_time: context.mood,
                energy_at_plan_time: context.energy,
                sleep_hours_at_plan_time: context.sleepHours,
                ai_model_used: aiModel,
                ai_reasoning: suggestion.reasoning,
                ai_warnings: suggestion.warnings || [],
                status: 'active',
                total_planned_minutes: suggestion.totalMinutes,
            })
            .select()
            .single();

        if (planError) throw planError;

        // Create time blocks
        const blocks = suggestion.blocks.map((block, idx) => ({
            plan_id: plan.id,
            user_id: userId,
            task_id: block.taskId,
            activity_template_id: block.activityTemplateId,
            calendar_event_id: block.calendarEventId,
            title: block.title,
            description: block.description,
            start_time: block.startTime,
            end_time: block.endTime,
            estimated_minutes: block.estimatedMinutes,
            status: 'pending' as const,
            sort_order: idx,
        }));

        const { data: savedBlocks, error: blocksError } = await supabase
            .from('time_blocks')
            .insert(blocks)
            .select();

        if (blocksError) throw blocksError;

        return {
            ...plan,
            blocks: savedBlocks || [],
        };
    } catch (error) {
        console.error('Failed to save plan to database:', error);
        throw error;
    }
}

// ============================================================================
// Plan Retrieval
// ============================================================================

/**
 * Load plan for a specific date
 */
export async function loadPlanForDate(userId: string, date: string): Promise<DailyPlan | null> {
    try {
        const { data: plan, error: planError } = await supabase
            .from('daily_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (planError) {
            if (planError.code === 'PGRST116') {
                // No plan found
                return null;
            }
            // Check for table doesn't exist error
            if (planError.code === '42P01' || planError.message?.includes('does not exist')) {
                throw new Error('Planning tables not found. Please run the database migration (docs/daily_planning_migration.sql in Supabase SQL Editor).');
            }
            throw planError;
        }

        // Load time blocks
        const { data: blocks, error: blocksError } = await supabase
            .from('time_blocks')
            .select('*')
            .eq('plan_id', plan.id)
            .order('sort_order', { ascending: true });

        if (blocksError) throw blocksError;

        return {
            ...plan,
            blocks: blocks || [],
        };
    } catch (error: any) {
        console.error('Failed to load plan for date:', error);
        // Re-throw to let the component handle it
        throw error;
    }
}

/**
 * Get recent plans for historical context
 */
export async function getRecentPlans(userId: string, limit: number = 7): Promise<DailyPlan[]> {
    try {
        const { data: plans, error } = await supabase
            .from('daily_plans')
            .select('*, time_blocks(*)')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return plans || [];
    } catch (error) {
        console.error('Failed to get recent plans:', error);
        return [];
    }
}

// ============================================================================
// Block Updates
// ============================================================================

/**
 * Update time block status
 */
export async function updateBlockStatus(
    userId: string,
    blockId: string,
    status: TimeBlock['status'],
    actualMinutes?: number
): Promise<void> {
    try {
        const updates: Partial<TimeBlock> = { status };

        if (status === 'active') {
            updates.startedAt = new Date().toISOString();
        } else if (status === 'completed' && actualMinutes !== undefined) {
            updates.actualMinutes = actualMinutes;
            updates.completedAt = new Date().toISOString();
        }

        const { error } = await supabase
            .from('time_blocks')
            .update(updates)
            .eq('id', blockId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Failed to update block status:', error);
        throw error;
    }
}

/**
 * Mark block as started
 */
export async function startBlock(userId: string, blockId: string): Promise<void> {
    await updateBlockStatus(userId, blockId, 'active');
}

/**
 * Mark block as completed with actual time
 */
export async function completeBlock(
    userId: string,
    blockId: string,
    actualMinutes: number
): Promise<void> {
    await updateBlockStatus(userId, blockId, 'completed', actualMinutes);
}

/**
 * Skip a block (won't complete it today)
 */
export async function skipBlock(userId: string, blockId: string): Promise<void> {
    await updateBlockStatus(userId, blockId, 'skipped');
}
