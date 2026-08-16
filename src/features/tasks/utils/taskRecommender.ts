/**
 * Task Recommender
 *
 * Scores and ranks active tasks to find the best one to work on today.
 * Factors: overdue status, due today, due date proximity, priority level,
 * staleness (keeps slipping), and backlog age (waiting for weeks).
 * If a task has subtasks, surfaces the first incomplete subtask.
 *
 * The FLAG is the single urgency signal. `urgent` outweighs a plain due-today
 * task (overdue still tops everything); `priority` only grades high/medium/low
 * *within* a flag. Before the 2026-08 collapse both columns claimed urgency and
 * could disagree — a stale `priority: 'urgent'` on a parked task used to jump
 * the queue.
 */

import type { Task, Subtask } from '../types';
import { daysUntilDue as daysUntilDueHelper } from './dueDates';
import { isStale } from './staleness';
import { isTaskParked, taskFitsHomeDay } from './taskContracts';
import { deriveTaskFlag } from './taskFlags';

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

export interface TaskRankingContext {
    nextFreeBlockMinutes?: number;
    energy?: Task['energy'];
    context?: Task['context'];
}

/** The urgent flag must outrank a plain medium due-today task (20 + 80 = 100). */
const URGENT_FLAG_WEIGHT = 120;

/** Grades a task *within* its flag. `urgent` here reads as `high` — only the flag makes a task urgent. */
const PRIORITY_WEIGHTS: Record<string, number> = {
    urgent: 40,
    high: 40,
    medium: 20,
    low: 10,
};

/**
 * The base weight for a task: the urgent flag, or the priority grade.
 * Exported for the README's worked example and so tests can assert the split.
 */
export function urgencyWeight(
    task: Pick<
        Task,
        'flag' | 'priority' | 'recurrence' | 'assignmentId' | 'plannedFor' | 'dueDate' | 'waitingOn'
    >,
): { weight: number; reason: string } {
    if (deriveTaskFlag(task) === 'urgent') return { weight: URGENT_FLAG_WEIGHT, reason: 'urgent' };
    const priority = task.priority || 'medium';
    return { weight: PRIORITY_WEIGHTS[priority] ?? 20, reason: `${priority} priority` };
}

/** Bonus for tasks that keep slipping — resurface instead of letting them rot. */
const STALE_BONUS = 15;
/** Undated tasks age upward slowly: +1 per waiting week, capped. */
const BACKLOG_AGE_CAP = 8;

/**
 * Score a single task based on due date and priority.
 * Exported so other pick policies (e.g. the morning pick) can compose it.
 */
export function scoreTask(
    task: Task,
    today: Date,
    homeDaysByType: ReadonlyMap<string, number[]> = new Map(),
    rankingContext: TaskRankingContext = {},
): { score: number; reason: string } {
    if (isTaskParked(task, today))
        return {
            score: 0,
            reason:
                deriveTaskFlag(task) === 'waiting'
                    ? 'waiting to follow up'
                    : `starts ${task.startDate}`,
        };
    let score = 0;
    const reasons: string[] = [];
    const todayIso = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
    ].join('-');

    if (task.plannedFor) {
        if (task.plannedFor < todayIso) {
            score += 95;
            reasons.push('planned day passed');
        } else if (task.plannedFor === todayIso) {
            score += 70;
            reasons.push('planned today');
        }
    }

    // Urgency: the flag, or the priority grade beneath it.
    const urgency = urgencyWeight(task);
    score += urgency.weight;

    if (!task.dueDate) {
        // No due date — urgency plus slow aging so old captures resurface.
        const daysSinceCreated = Math.max(
            0,
            Math.floor((today.getTime() - new Date(task.createdAt).getTime()) / 86_400_000),
        );
        const ageWeeks = Math.min(Math.floor(daysSinceCreated / 7), BACKLOG_AGE_CAP);
        score += ageWeeks;
        reasons.push(urgency.reason);
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

        if (urgency.weight >= PRIORITY_WEIGHTS.high) {
            reasons.unshift(urgency.reason);
        }
    }

    if (isStale(task, today)) {
        score += STALE_BONUS;
        reasons.push('keeps slipping');
    }

    if (taskFitsHomeDay(task, homeDaysByType, today)) {
        score += 12;
        reasons.push('fits today');
    }

    if (
        rankingContext.nextFreeBlockMinutes != null &&
        task.estimatedTime != null &&
        task.estimatedTime <= rankingContext.nextFreeBlockMinutes
    ) {
        score += 10;
        reasons.push('fits the next free block');
    }
    if (rankingContext.energy && task.energy === rankingContext.energy) {
        score += 8;
        reasons.push('matches your energy');
    }
    if (rankingContext.context && task.context === rankingContext.context) {
        score += 8;
        reasons.push('fits your context');
    }

    return { score, reason: reasons.join(', ') };
}

/**
 * Find the first incomplete subtask of a task
 */
function getNextSubtask(task: Task): Subtask | null {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    return task.subtasks.find((st) => !st.completed) || null;
}

/**
 * Get the top recommended task for today
 */
export function getRecommendedTask(
    tasks: Task[],
    today: Date = new Date(),
    homeDaysByType: ReadonlyMap<string, number[]> = new Map(),
): TaskRecommendation | null {
    return getRankedTasks(tasks, today, homeDaysByType)[0] ?? null;
}

/**
 * Get all tasks ranked by recommendation score. Same tie-break chain as the
 * canonical comparator (taskOrdering.ts): score desc → dueDate asc (undated
 * last) → createdAt asc → id asc.
 */
export function getRankedTasks(
    tasks: Task[],
    today: Date = new Date(),
    homeDaysByType: ReadonlyMap<string, number[]> = new Map(),
    rankingContext: TaskRankingContext = {},
): TaskRecommendation[] {
    const activeTasks = tasks.filter((task) => !task.completed && !isTaskParked(task, today));

    return activeTasks
        .map((task) => {
            const { score, reason } = scoreTask(task, today, homeDaysByType, rankingContext);
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
