/**
 * Routine progress markers.
 *
 * Tracks which daily routine phases (morning / midday / night) the user has
 * explicitly finished today. Stored per-day in localStorage so the home page
 * shows real progress — a phase only counts once the user completes it, never
 * just because the clock moved past it.
 */

export type RoutinePhase = 'morning' | 'midday' | 'night';

export const ROUTINE_PHASES: readonly RoutinePhase[] = ['morning', 'midday', 'night'] as const;

/** Fired on window whenever a marker changes, so mounted cards can refresh. */
export const ROUTINE_PROGRESS_EVENT = 'routine-progress-changed';

const storageKey = (phase: RoutinePhase, dateKey: string) => `routine_done_${phase}_${dateKey}`;

function emitChange(): void {
    try {
        window.dispatchEvent(new CustomEvent(ROUTINE_PROGRESS_EVENT));
    } catch {
        /* ignore — non-browser env */
    }
}

/** Mark a routine phase as finished for the given day (yyyy-MM-dd). */
export function markRoutineDone(phase: RoutinePhase, dateKey: string): void {
    try {
        localStorage.setItem(storageKey(phase, dateKey), '1');
    } catch {
        /* ignore — storage unavailable */
    }
    emitChange();
}

/** Undo a finished marker (e.g. when the user reopens a closed day). */
export function clearRoutineDone(phase: RoutinePhase, dateKey: string): void {
    try {
        localStorage.removeItem(storageKey(phase, dateKey));
    } catch {
        /* ignore — storage unavailable */
    }
    emitChange();
}

/** Whether a routine phase was explicitly finished on the given day. */
export function isRoutineDone(phase: RoutinePhase, dateKey: string): boolean {
    try {
        return localStorage.getItem(storageKey(phase, dateKey)) === '1';
    } catch {
        return false;
    }
}

export interface RoutineProgress {
    morning: boolean;
    midday: boolean;
    night: boolean;
    doneCount: number;
}

/** Snapshot of all three phase markers for the given day. */
export function getRoutineProgress(dateKey: string): RoutineProgress {
    const morning = isRoutineDone('morning', dateKey);
    const midday = isRoutineDone('midday', dateKey);
    const night = isRoutineDone('night', dateKey);
    return {
        morning,
        midday,
        night,
        doneCount: [morning, midday, night].filter(Boolean).length,
    };
}
