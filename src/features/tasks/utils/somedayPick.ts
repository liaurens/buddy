/**
 * One-a-day someday pick — choose the single backlog task to surface in the
 * anti-overwhelm focus card. Never returns more than one; the full list is shown
 * elsewhere. Longest-waiting first so nothing rots forever, deterministic tie-break.
 */

import type { Task } from '../types';
import { deriveTaskKind } from './taskKind';

export interface PickSomedayOpts {
    /** Task ids to exclude (e.g. already shown / "not today" this session). */
    skip?: string[];
}

export function pickSomeday(tasks: Task[], opts: PickSomedayOpts = {}): Task | null {
    const skip = new Set(opts.skip ?? []);
    const candidates = tasks
        .filter((t) => !t.completed && !skip.has(t.id) && deriveTaskKind(t) === 'backlog')
        .sort((a, b) => {
            const byAge = a.createdAt.localeCompare(b.createdAt); // oldest first
            return byAge !== 0 ? byAge : a.title.localeCompare(b.title);
        });
    return candidates[0] ?? null;
}
