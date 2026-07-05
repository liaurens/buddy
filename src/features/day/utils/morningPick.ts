/**
 * Morning pick — deterministic "what today gets" suggestions.
 *
 * Composes the task recommender's urgency score with a small-task bias so the
 * morning flow can offer 2–3 concrete, startable items without any AI call.
 * The recommender answers "what should I do right now"; this answers "which few
 * things should today get". Accepting a pick sets its due date to today
 * (rescheduleMany), so candidates already due today are excluded, as are locked
 * tasks (rescheduleMany silently skips them) and routines (they schedule
 * themselves).
 *
 * Pure: callers inject `today`; no Date.now() so tests stay deterministic.
 */

import type { Task } from '../../tasks/types';
import { scoreTask } from '../../tasks/utils/taskRecommender';
import { isLocked } from '../../tasks/utils/triageRouting';
import { parseDueDate } from '../../tasks/utils/dueDates';

export interface MorningPickOptions {
    /** Today's date, yyyy-MM-dd (injected — no internal clock). */
    today: string;
    /** Estimates at or under this read as "small". */
    smallTaskMinutes?: number;
}

export interface MorningCandidate {
    task: Task;
    score: number;
    reason: string;
}

export const SMALL_TASK_MINUTES = 30;
export const TINY_TASK_MINUTES = 15;
export const BIG_TASK_MINUTES = 90;
/** Max school-linked suggestions per morning (diversity guard). */
export const SCHOOL_SLOT_CAP = 2;

const SMALL_BONUS = 25;
const TINY_BONUS = 10;
const BIG_PENALTY = 15;
const VAGUE_PENALTY = 5;

/** Routines schedule themselves — never suggest them as picks. */
function isRoutine(task: Task): boolean {
    return task.kind === 'routine' || (!!task.recurrence && task.recurrence !== 'none');
}

function isSchool(task: Task): boolean {
    return !!task.assignmentId || task.triageDestination === 'school';
}

/**
 * Rank all pickable tasks, best first. Deterministic: ties break on createdAt
 * (oldest first) then id.
 */
export function rankMorningCandidates(tasks: Task[], opts: MorningPickOptions): MorningCandidate[] {
    const smallCutoff = opts.smallTaskMinutes ?? SMALL_TASK_MINUTES;
    const now = parseDueDate(opts.today);

    return tasks
        .filter(
            (t) =>
                !t.completed &&
                t.dueDate !== opts.today &&
                !isRoutine(t) &&
                !isLocked(t),
        )
        .map((task) => {
            const base = scoreTask(task, now);
            let score = base.score;
            const reasons: string[] = [base.reason];

            const est = task.estimatedTime;
            if (est && est <= smallCutoff) {
                score += SMALL_BONUS;
                if (est <= TINY_TASK_MINUTES) score += TINY_BONUS;
                reasons.push(`quick (~${est} min)`);
            } else if (est && est >= BIG_TASK_MINUTES) {
                score -= BIG_PENALTY;
            } else if (!est && (!task.subtasks || task.subtasks.length === 0)) {
                score -= VAGUE_PENALTY;
            }

            return { task, score, reason: reasons.filter(Boolean).join(', ') };
        })
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const byAge = a.task.createdAt.localeCompare(b.task.createdAt);
            return byAge !== 0 ? byAge : a.task.id.localeCompare(b.task.id);
        });
}

/**
 * Take the top `slots` candidates, capping school-linked items at
 * SCHOOL_SLOT_CAP so a deadline-heavy week doesn't fill every slot. If the cap
 * leaves slots empty, backfill with the remaining best regardless of source.
 */
export function suggestMorningPicks(
    ranked: MorningCandidate[],
    slots: number,
): MorningCandidate[] {
    const picks: MorningCandidate[] = [];
    let schoolCount = 0;

    for (const candidate of ranked) {
        if (picks.length >= slots) break;
        if (isSchool(candidate.task)) {
            if (schoolCount >= SCHOOL_SLOT_CAP) continue;
            schoolCount += 1;
        }
        picks.push(candidate);
    }

    if (picks.length < slots) {
        const chosen = new Set(picks.map((c) => c.task.id));
        for (const candidate of ranked) {
            if (picks.length >= slots) break;
            if (!chosen.has(candidate.task.id)) picks.push(candidate);
        }
    }

    return picks;
}

/** The best-ranked candidate not already shown or accepted (for per-slot Swap). */
export function nextSwapCandidate(
    ranked: MorningCandidate[],
    excludeIds: Set<string>,
): MorningCandidate | null {
    return ranked.find((c) => !excludeIds.has(c.task.id)) ?? null;
}
