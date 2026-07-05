/**
 * Task Recommender
 *
 * Scores and ranks active tasks to find the best one to work on today.
 * Factors: overdue status, due today, due date proximity, priority level,
 * staleness (keeps slipping), and backlog age (waiting for weeks).
 * If a task has subtasks, surfaces the first incomplete subtask.
 *
 * Priority is the single urgency signal: kind='urgent' write-through
 * guarantees priority='urgent', and its weight puts a dateless urgent task
 * above a plain due-today one (overdue still tops everything).
 */

import type { Task, Subtask } from '../types';
import { daysUntilDue as daysUntilDueHelper } from './dueDates';
import { isStale } from './staleness';

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
    // Urgent must outrank a plain medium due-today task (20 + 80 = 100).
    urgent: 120,
    high: 40,
    medium: 20,
    low: 10,
};

/** Bonus for tasks that keep slipping — resurface instead of letting them rot. */
const STALE_BONUS = 15;
/** Undated tasks age upward slowly: +1 per waiting week, capped. */
const BACKLOG_AGE_CAP = 8;

/**
 * Score a single task based on due date and priority.
 * Exported so other pick policies (e.g. the morning pick) can compose it.
 */
export function scoreTask(task: Task, today: Date): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Priority score
    const priorityScore = PRIORITY_WEIGHTS[task.priority || 'medium'] || 20;
    score += priorityScore;

    if (!task.dueDate) {
        // No due date — priority plus slow aging so old captures resurface.
        const daysSinceCreated = Math.max(
            0,
            Math.floor((today.getTime() - new Date(task.createdAt).getTime()) / 86_400_000),
        );
        const ageWeeks = Math.min(Math.floor(daysSinceCreated / 7), BACKLOG_AGE_CAP);
        score += ageWeeks;
        reasons.push(`${task.priority || 'medium'} priority`);
        if (ageWeeks > 0) reasons.push(`waiting ${ageWeeks} week${ageWeeks === 1 ? '' : 's'}`);
    } else {
        const daysUntilDue = daysUntilDueHelper(task.dueDate, today);

        if (daysUntilDue < 0) {
            // Overdue
            score += 100 + Math.min(Math.abs(daysUntilDue) * 5, 50); // More overdue = higher score, cap at +50
            reasons.push(
                `overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`,
            );
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
    }

    if (isStale(task, today)) {
        score += STALE_BONUS;
        reasons.push('keeps slipping');
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
    return getRankedTasks(tasks, today)[0] ?? null;
}

/**
 * Get all tasks ranked by recommendation score. Same tie-break chain as the
 * canonical comparator (taskOrdering.ts): score desc → dueDate asc (undated
 * last) → createdAt asc → id asc.
 */
export function getRankedTasks(tasks: Task[], today: Date = new Date()): TaskRecommendation[] {
    const activeTasks = tasks.filter(t => !t.completed);

    return activeTasks
        .map(task => {
            const { score, reason } = scoreTask(task, today);
            const subtask = getNextSubtask(task);
            return { task, subtask, score, reason };
        })
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const aDue = a.task.dueDate ?? '9999-99-99';
            const bDue = b.task.dueDate ?? '9999-99-99';
            if (aDue !== bDue) return aDue.localeCompare(bDue);
            const byAge = a.task.createdAt.localeCompare(b.task.createdAt);
            if (byAge !== 0) return byAge;
            return a.task.id.localeCompare(b.task.id);
        });
}
