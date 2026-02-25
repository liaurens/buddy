/**
 * useTaskRecommendation Hook
 *
 * Provides the smart task recommendation based on due dates and priority.
 */

import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { getRecommendedTask, getRankedTasks, type TaskRecommendation } from '../utils/taskRecommender';

export interface UseTaskRecommendationReturn {
    /** The single best task to work on right now */
    recommended: TaskRecommendation | null;
    /** All active tasks ranked by score */
    ranked: TaskRecommendation[];
    /** Number of active (incomplete) tasks */
    activeCount: number;
}

export function useTaskRecommendation(): UseTaskRecommendationReturn {
    const { tasks } = useTasks();

    return useMemo(() => {
        const today = new Date();
        const recommended = getRecommendedTask(tasks, today);
        const ranked = getRankedTasks(tasks, today);
        const activeCount = tasks.filter(t => !t.completed).length;

        return { recommended, ranked, activeCount };
    }, [tasks]);
}
