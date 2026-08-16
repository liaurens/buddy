/**
 * taskBoard — the two-tier shape the Tasks screen renders.
 *
 * The screen has to answer two different questions without feeling like a
 * backlog dump:
 *   "what needs me?"      → `now`, a short ranked list
 *   "what else exists?"   → `sections`, one per flag, folded, counts always visible
 *
 * Both come from here so the page stays presentational and the rules are
 * testable. Every active task appears exactly once across now / nowOverflow /
 * sections — nothing is duplicated, and nothing is silently dropped.
 *
 * Pure: the caller injects `today` and the score map (from getRankedTasks).
 */

import type { Task, TaskFlag } from '../types';
import { TASK_FLAG_ORDER, deriveTaskFlag } from './taskFlags';
import { sortTasksCanonical } from './taskOrdering';
import { isTaskParked } from './taskContracts';
import { parseDueDate } from './dueDates';

/** How many pressing tasks the Now tier shows before folding the rest away. */
export const NOW_LIMIT = 5;

/** The flags that get their own folded section. `urgent` and `today` live in Now. */
const SECTION_FLAGS: TaskFlag[] = TASK_FLAG_ORDER.filter((f) => f !== 'urgent' && f !== 'today');

export interface TaskBoardSection {
    flag: TaskFlag;
    tasks: Task[];
}

export interface TaskBoard {
    /** The pressing set, ranked, capped at `nowLimit`. */
    now: Task[];
    /** The rest of the pressing set — revealed by "+N more", never hidden outright. */
    nowOverflow: Task[];
    /** One entry per non-Now flag, in TASK_FLAG_ORDER. Empty sections are kept so
     *  the overview stays complete: a count of (0) is information too. */
    sections: TaskBoardSection[];
    /** Active (incomplete) tasks on the board. */
    activeCount: number;
}

export interface BuildTaskBoardOptions {
    /** Today as YYYY-MM-DD — injected so the result is deterministic. */
    today: string;
    nowLimit?: number;
}

/**
 * Does this task need attention today?
 *
 * Flag first (urgent / today are pressing by definition), then dates, so a
 * school deadline that has gone overdue surfaces instead of staying politely
 * folded under School. Parked tasks are never pressing — a waiting task whose
 * chase date has not arrived is deliberately not your problem yet.
 */
function isPressing(task: Task, today: string, now: Date): boolean {
    if (isTaskParked(task, now)) return false;
    const flag = deriveTaskFlag(task);
    if (flag === 'urgent' || flag === 'today') return true;
    if (task.plannedFor && task.plannedFor <= today) return true;
    if (task.dueDate && task.dueDate <= today) return true;
    return false;
}

export function buildTaskBoard(
    tasks: Task[],
    scoreById: Map<string, number>,
    opts: BuildTaskBoardOptions,
): TaskBoard {
    const { today, nowLimit = NOW_LIMIT } = opts;
    const now = parseDueDate(today);
    const active = tasks.filter((t) => !t.completed);

    const pressing: Task[] = [];
    const byFlag = new Map<TaskFlag, Task[]>(SECTION_FLAGS.map((f) => [f, []]));

    for (const task of active) {
        if (isPressing(task, today, now)) {
            pressing.push(task);
            continue;
        }
        // A non-pressing urgent/today task (parked) still needs a home; fall
        // back to Someday so it stays reachable rather than vanishing.
        const flag = deriveTaskFlag(task);
        (byFlag.get(flag) ?? byFlag.get('someday')!).push(task);
    }

    const ranked = sortTasksCanonical(pressing, scoreById);

    return {
        now: ranked.slice(0, nowLimit),
        nowOverflow: ranked.slice(nowLimit),
        sections: SECTION_FLAGS.map((flag) => ({
            flag,
            tasks: sortTasksCanonical(byFlag.get(flag)!, scoreById),
        })),
        activeCount: active.length,
    };
}
