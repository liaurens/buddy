import { useEffect, useState } from 'react';
import {
    getRoutineProgress,
    ROUTINE_PROGRESS_EVENT,
    type RoutineProgress,
} from '../services/routine-progress';

/**
 * Live view of today's routine completion markers. Re-reads when any
 * component marks a phase done (custom event) or when another tab updates
 * localStorage (storage event).
 */
export function useRoutineProgress(dateKey: string): RoutineProgress {
    const [progress, setProgress] = useState<RoutineProgress>(() => getRoutineProgress(dateKey));

    useEffect(() => {
        const refresh = () => setProgress(getRoutineProgress(dateKey));
        refresh();
        window.addEventListener(ROUTINE_PROGRESS_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(ROUTINE_PROGRESS_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, [dateKey]);

    return progress;
}
