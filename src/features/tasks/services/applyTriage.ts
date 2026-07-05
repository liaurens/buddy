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

/**
 * Pure: the task as it should exist after routing to `destination`.
 * routeTaskPatch supplies the routing fields; when it sets a kind, the kind's
 * canonical signal (e.g. urgent ⇒ priority urgent) is written through too.
 */
export function applyTriagePatch(
    task: Task,
    destination: TriageDestination,
    detail: TriageDetail,
    opts: TriageOpts,
): Task {
    const patch = routeTaskPatch(destination, detail, {
        nowIso: opts.nowIso,
        todayIso: opts.todayIso,
    });
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
