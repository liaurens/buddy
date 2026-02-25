/**
 * Task Recommender
 *
 * Scores and ranks active tasks to find the best one to work on today.
 * Factors: overdue status, due today, due date proximity, priority level.
 * If a task has subtasks, surfaces the first incomplete subtask.
 */

import { differenceInCalendarDays, startOfDay } from 'date-fns';
import type { Task, Subtask } from '../types';

export interface TaskRecommendation {
    /** The recommended task */
    task: Task;
    /** If the task has subtasks, the specific subtask to work on */
    subtask: Subtask | null;
    /** The computed score (higher = more urgent) */
    score: number;
    /** Human-readable reason for the recommendation */
    reason: string;
}

const PRIORITY_WEIGHTS: Record<string, number> = {
    urgent: 60,
    high: 40,
    medium: 20,
    low: 10,
};

/**
 * Score a single task based on due date and priority
 */
function scoreTask(task: Task, today: Date): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Priority score
    const priorityScore = PRIORITY_WEIGHTS[task.priority || 'medium'] || 20;
    score += priorityScore;

    if (!task.dueDate) {
        // No due date - only scored by priority
        reasons.push(`${task.priority || 'medium'} priority`);
        return { score, reason: reasons.join(', ') };
    }

    const dueDate = startOfDay(new Date(task.dueDate));
    const todayStart = startOfDay(today);
    const daysUntilDue = differenceInCalendarDays(dueDate, todayStart);

    if (daysUntilDue < 0) {
        // Overdue
        score += 100 + Math.min(Math.abs(daysUntilDue) * 5, 50); // More overdue = higher score, cap at +50
        reasons.push(`overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`);
    } else if (daysUntilDue === 0) {
        // Due today
        score += 80;
        reasons.push('due today');
    } else if (daysUntilDue === 1) {
        // Due tomorrow
        score += 50;
        reasons.push('due tomorrow');
    } else if (daysUntilDue <= 7) {
        // Due this week
        score += Math.max(0, 35 - daysUntilDue * 4);
        reasons.push(`due in ${daysUntilDue} days`);
    }

    if (task.priority === 'urgent' || task.priority === 'high') {
        reasons.unshift(`${task.priority} priority`);
    }

    return { score, reason: reasons.join(', ') };
}

/**
 * Find the first incomplete subtask of a task
 */
function getNextSubtask(task: Task): Subtask | null {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    return task.subtasks.find(st => !st.completed) || null;
}

/**
 * Get the top recommended task for today
 */
export function getRecommendedTask(tasks: Task[], today: Date = new Date()): TaskRecommendation | null {
    const activeTasks = tasks.filter(t => !t.completed);

    if (activeTasks.length === 0) return null;

    let best: TaskRecommendation | null = null;

    for (const task of activeTasks) {
        const { score, reason } = scoreTask(task, today);
        const subtask = getNextSubtask(task);

        if (!best || score > best.score) {
            best = { task, subtask, score, reason };
        }
    }

    return best;
}

/**
 * Get all tasks ranked by recommendation score
 */
export function getRankedTasks(tasks: Task[], today: Date = new Date()): TaskRecommendation[] {
    const activeTasks = tasks.filter(t => !t.completed);

    return activeTasks
        .map(task => {
            const { score, reason } = scoreTask(task, today);
            const subtask = getNextSubtask(task);
            return { task, subtask, score, reason };
        })
        .sort((a, b) => b.score - a.score);
}
