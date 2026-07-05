/**
 * applyTriage — one routing result, regardless of who decided.
 *
 * Manual triage (TriageInbox), the silent auto-apply effect, and eager
 * on-capture sorting all build their final task through applyTriagePatch, so
 * an AI-routed task and a human-routed task end up byte-identical: same
 * routing fields, same kind→priority write-through, same reminder scheduling
 * (via persistTaskUpdate).
 */

import type { Task } from '../types';
import {
    routeTaskPatch,
    type TriageDestination,
    type TriageDetail,
} from '../utils/triageRouting';
import { kindSignalPatch } from '../utils/taskKind';
import { persistTaskUpdate } from './taskWrites';

export interface TriageOpts {
    nowIso: string;
    todayIso: string;
    /** True when the AI routed this without a human confirming. */
    autoTriaged?: boolean;
}

/** Inferred profile fields — routing never overwrites what the task already has. */
const PROFILE_FIELDS = [
    'hardness',
    'location',
    'context',
    'energy',
    'estimatedTime',
    'taskTypeId',
] as const;

/**
 * Pure: the task as it should exist after routing to `destination`.
 * routeTaskPatch supplies the routing fields; when it sets a kind, the kind's
 * canonical signal (e.g. urgent ⇒ priority urgent) is written through too.
 * Inferred profile values (energy, estimate, type, …) fill gaps only.
 */
export function applyTriagePatch(
    task: Task,
    destination: TriageDestination,
    detail: TriageDetail,
    opts: TriageOpts,
): Task {
    const patch: Partial<Task> = routeTaskPatch(destination, detail, {
        nowIso: opts.nowIso,
        todayIso: opts.todayIso,
    });

    // Profile fields: drop uninferrred keys (spread would clobber existing
    // values with undefined) and keep the task's own values over inferred ones.
    // Routing fields (dueDate/dueTime/kind) stay untouched — their explicit
    // undefined is a deliberate clear (e.g. urgent drops the do-date).
    for (const field of PROFILE_FIELDS) {
        if (patch[field] === undefined || task[field] != null) delete patch[field];
    }

    const merged: Task = { ...task, ...patch, autoTriaged: opts.autoTriaged ?? false };
    return patch.kind ? { ...merged, ...kindSignalPatch(patch.kind) } : merged;
}

/** Route + persist (columns, reminders, Google) in one call. */
export async function applyTriage(
    userId: string,
    task: Task,
    destination: TriageDestination,
    detail: TriageDetail,
    opts: TriageOpts,
): Promise<Task> {
    return persistTaskUpdate(userId, applyTriagePatch(task, destination, detail, opts));
}
