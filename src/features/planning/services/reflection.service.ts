/**
 * Reflection Service - Learning from actual vs estimated time
 *
 * Tracks:
 * - Time variance (actual - estimated)
 * - Completion patterns
 * - Buffer time adequacy
 * - Task-specific accuracy
 */

import { supabase } from '../../../services/supabase';

// ============================================================================
// Types
// ============================================================================

export interface TimeBlockCompletion {
    blockId: string;
    taskId?: string;
    activityName: string;
    estimatedMinutes: number;
    actualMinutes: number;
    variance: number; // actual - estimated
    variancePercent: number; // (actual - estimated) / estimated * 100
    completedAt: string;
}

export interface DayReflection {
    date: string;
    totalBlocks: number;
    completedBlocks: number;
    completionRate: number;
    totalEstimatedMinutes: number;
    totalActualMinutes: number;
    totalVariance: number;
    avgVariancePercent: number;
    underestimated: TimeBlockCompletion[]; // Took longer than expected
    overestimated: TimeBlockCompletion[]; // Took less time than expected
    accurate: TimeBlockCompletion[]; // Within 10% of estimate
}

export interface LearningPattern {
    pattern: string; // e.g., "Meetings always run 15min over"
    category: 'task_type' | 'time_of_day' | 'buffer' | 'general';
    avgVariancePercent: number;
    sampleSize: number;
    recommendation: string;
}

// ============================================================================
// Time Block Completion
// ============================================================================

/**
 * Record a completed time block with actual time
 */
export async function recordBlockCompletion(
    userId: string,
    blockId: string,
    actualMinutes: number
): Promise<void> {
    try {
        // Update time block with actual minutes and completion time
        const { error } = await supabase
            .from('time_blocks')
            .update({
                actual_minutes: actualMinutes,
                completed_at: new Date().toISOString(),
                status: 'completed',
            })
            .eq('id', blockId)
            .eq('user_id', userId);

        if (error) throw error;

        // If block has a task, update task's historical minutes
        const { data: block } = await supabase
            .from('time_blocks')
            .select('task_id, title')
            .eq('id', blockId)
            .single();

        if (block?.task_id) {
            await updateTaskHistory(userId, block.task_id, actualMinutes);
        }
    } catch (error) {
        console.error('Failed to record block completion:', error);
        throw error;
    }
}

/**
 * Update task's historical minutes (learning data)
 */
async function updateTaskHistory(
    userId: string,
    taskId: string,
    actualMinutes: number
): Promise<void> {
    try {
        const { data: task } = await supabase
            .from('todos')
            .select('historical_minutes')
            .eq('id', taskId)
            .eq('user_id', userId)
            .single();

        if (!task) return;

        // Add to historical minutes (keep last 10)
        const historical = task.historical_minutes || [];
        const updated = [...historical, actualMinutes].slice(-10);

        await supabase
            .from('todos')
            .update({ historical_minutes: updated })
            .eq('id', taskId)
            .eq('user_id', userId);
    } catch (error) {
        console.error('Failed to update task history:', error);
    }
}

// ============================================================================
// Daily Reflection
// ============================================================================

/**
 * Generate reflection for a specific day
 */
export async function generateDayReflection(
    userId: string,
    date: string
): Promise<DayReflection> {
    try {
        // Fetch all blocks for this day's plan
        const { data: plan } = await supabase
            .from('daily_plans')
            .select('id')
            .eq('user_id', userId)
            .eq('date', date)
            .single();

        if (!plan) {
            throw new Error('No plan found for this date');
        }

        const { data: blocks } = await supabase
            .from('time_blocks')
            .select('*')
            .eq('plan_id', plan.id)
            .eq('user_id', userId);

        if (!blocks || blocks.length === 0) {
            throw new Error('No blocks found for this plan');
        }

        // Calculate completions
        const completions: TimeBlockCompletion[] = blocks
            .filter(b => b.status === 'completed' && b.actual_minutes)
            .map(b => {
                const variance = b.actual_minutes! - b.estimated_minutes;
                const variancePercent = (variance / b.estimated_minutes) * 100;

                return {
                    blockId: b.id,
                    taskId: b.task_id || undefined,
                    activityName: b.title,
                    estimatedMinutes: b.estimated_minutes,
                    actualMinutes: b.actual_minutes!,
                    variance,
                    variancePercent,
                    completedAt: b.completed_at!,
                };
            });

        // Categorize by accuracy
        const underestimated = completions.filter(c => c.variancePercent > 10);
        const overestimated = completions.filter(c => c.variancePercent < -10);
        const accurate = completions.filter(c => Math.abs(c.variancePercent) <= 10);

        // Calculate totals
        const totalEstimatedMinutes = blocks.reduce((sum, b) => sum + b.estimated_minutes, 0);
        const totalActualMinutes = completions.reduce((sum, c) => sum + c.actualMinutes, 0);
        const totalVariance = totalActualMinutes - totalEstimatedMinutes;
        const avgVariancePercent = completions.length > 0
            ? completions.reduce((sum, c) => sum + c.variancePercent, 0) / completions.length
            : 0;

        return {
            date,
            totalBlocks: blocks.length,
            completedBlocks: completions.length,
            completionRate: (completions.length / blocks.length) * 100,
            totalEstimatedMinutes,
            totalActualMinutes,
            totalVariance,
            avgVariancePercent,
            underestimated,
            overestimated,
            accurate,
        };
    } catch (error) {
        console.error('Failed to generate day reflection:', error);
        throw error;
    }
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect learning patterns from historical data
 */
export async function detectPatterns(
    userId: string,
    days: number = 30
): Promise<LearningPattern[]> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Fetch completed blocks from last N days
        const { data: blocks } = await supabase
            .from('time_blocks')
            .select('title, estimated_minutes, actual_minutes, completed_at')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .not('actual_minutes', 'is', null)
            .gte('completed_at', cutoffDate.toISOString());

        if (!blocks || blocks.length === 0) {
            return [];
        }

        const patterns: LearningPattern[] = [];

        // Pattern 1: Overall estimation accuracy
        const variances = blocks.map(b => {
            const variance = b.actual_minutes! - b.estimated_minutes;
            return (variance / b.estimated_minutes) * 100;
        });

        const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;

        if (Math.abs(avgVariance) > 15) {
            patterns.push({
                pattern: avgVariance > 0
                    ? `You typically underestimate tasks by ${Math.round(avgVariance)}%`
                    : `You typically overestimate tasks by ${Math.round(Math.abs(avgVariance))}%`,
                category: 'general',
                avgVariancePercent: avgVariance,
                sampleSize: blocks.length,
                recommendation: avgVariance > 0
                    ? `Add ${Math.round(avgVariance)}% buffer to all task estimates`
                    : 'You can be more ambitious with your planning',
            });
        }

        // Pattern 2: Specific task types (e.g., "meeting", "email", "coding")
        const taskGroups = new Map<string, number[]>();

        blocks.forEach(b => {
            const titleLower = b.title.toLowerCase();
            let category = 'other';

            if (titleLower.includes('meeting') || titleLower.includes('call')) {
                category = 'meetings';
            } else if (titleLower.includes('email') || titleLower.includes('message')) {
                category = 'communication';
            } else if (titleLower.includes('code') || titleLower.includes('develop') || titleLower.includes('programming')) {
                category = 'coding';
            } else if (titleLower.includes('write') || titleLower.includes('document') || titleLower.includes('report')) {
                category = 'writing';
            }

            if (!taskGroups.has(category)) {
                taskGroups.set(category, []);
            }

            const variance = ((b.actual_minutes! - b.estimated_minutes) / b.estimated_minutes) * 100;
            taskGroups.get(category)!.push(variance);
        });

        // Analyze each category
        taskGroups.forEach((variances, category) => {
            if (variances.length >= 3) { // Need at least 3 samples
                const avg = variances.reduce((a, b) => a + b, 0) / variances.length;

                if (Math.abs(avg) > 20) {
                    patterns.push({
                        pattern: avg > 0
                            ? `${category} tasks typically take ${Math.round(avg)}% longer than estimated`
                            : `${category} tasks typically take ${Math.round(Math.abs(avg))}% less time than estimated`,
                        category: 'task_type',
                        avgVariancePercent: avg,
                        sampleSize: variances.length,
                        recommendation: avg > 0
                            ? `Increase ${category} estimates by ${Math.round(avg)}%`
                            : `Reduce ${category} estimates by ${Math.round(Math.abs(avg))}%`,
                    });
                }
            }
        });

        return patterns;
    } catch (error) {
        console.error('Failed to detect patterns:', error);
        return [];
    }
}

/**
 * Get average actual time for similar tasks
 */
export async function getAverageTimeForSimilarTasks(
    userId: string,
    taskTitle: string,
    limit: number = 10
): Promise<number | null> {
    try {
        // Simple similarity: match by common words
        const words = taskTitle.toLowerCase().split(' ').filter(w => w.length > 3);

        if (words.length === 0) return null;

        const { data: blocks } = await supabase
            .from('time_blocks')
            .select('title, actual_minutes')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .not('actual_minutes', 'is', null)
            .limit(limit * 2); // Get more to filter

        if (!blocks || blocks.length === 0) return null;

        // Filter by similarity
        const similar = blocks.filter(b => {
            const blockTitle = b.title?.toLowerCase() || '';
            return words.some(word => blockTitle.includes(word));
        });

        if (similar.length === 0) return null;

        // Calculate average
        const sum = similar.reduce((acc, b) => acc + (b.actual_minutes || 0), 0);
        return Math.round(sum / similar.length);
    } catch (error) {
        console.error('Failed to get average time for similar tasks:', error);
        return null;
    }
}

// ============================================================================
// AI Planning Integration
// ============================================================================

/**
 * Get learning patterns formatted for AI planning context
 * Returns only the most actionable patterns
 */
export async function getLearningPatternsForPlanning(
    userId: string,
    limit: number = 5
): Promise<LearningPattern[]> {
    try {
        const allPatterns = await detectPatterns(userId, 30);

        // Filter to most significant patterns (high variance, good sample size)
        return allPatterns
            .filter(p => Math.abs(p.avgVariancePercent) > 10 && p.sampleSize >= 3)
            .sort((a, b) => Math.abs(b.avgVariancePercent) - Math.abs(a.avgVariancePercent))
            .slice(0, limit);
    } catch (error) {
        console.error('Failed to get learning patterns for planning:', error);
        return [];
    }
}

/**
 * Adjust estimate based on learning patterns
 * Used to automatically apply learned variance to new task estimates
 */
export function applyLearningToEstimate(
    taskTitle: string,
    baseEstimate: number,
    patterns: LearningPattern[]
): number {
    if (!patterns || patterns.length === 0) return baseEstimate;

    const titleLower = taskTitle.toLowerCase();

    // Try to find task-type specific pattern first
    const taskTypePattern = patterns.find(p => {
        if (p.category !== 'task_type') return false;

        // Check if pattern applies to this task
        if (titleLower.includes('meeting') || titleLower.includes('call')) {
            return p.pattern.toLowerCase().includes('meeting');
        }
        if (titleLower.includes('code') || titleLower.includes('develop')) {
            return p.pattern.toLowerCase().includes('coding');
        }
        if (titleLower.includes('write') || titleLower.includes('document')) {
            return p.pattern.toLowerCase().includes('writing');
        }
        if (titleLower.includes('email') || titleLower.includes('message')) {
            return p.pattern.toLowerCase().includes('communication');
        }

        return false;
    });

    // Use task-type pattern if found, otherwise use general pattern
    const applicablePattern = taskTypePattern || patterns.find(p => p.category === 'general');

    if (!applicablePattern) return baseEstimate;

    // Apply the variance
    const adjustmentFactor = 1 + (applicablePattern.avgVariancePercent / 100);
    const adjustedEstimate = Math.ceil(baseEstimate * adjustmentFactor);

    return adjustedEstimate;
}
