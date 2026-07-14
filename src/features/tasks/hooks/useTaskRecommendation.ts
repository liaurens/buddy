/**
 * useTaskRecommendation Hook
 *
 * Provides the smart task recommendation based on due dates and priority.
 */

import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { useTaskTypes } from './useTaskTypes';
import {
    getRecommendedTask,
    getRankedTasks,
    type TaskRecommendation,
} from '../utils/taskRecommender';

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
    const { taskTypes } = useTaskTypes();

    return useMemo(() => {
        const today = new Date();
        const homeDaysByType = new Map(
            taskTypes
                .filter((type) => type.homeDays?.length)
                .map((type) => [type.id, type.homeDays ?? []]),
        );
        const recommended = getRecommendedTask(tasks, today, homeDaysByType);
        const ranked = getRankedTasks(tasks, today, homeDaysByType);
        const activeCount = tasks.filter((t) => !t.completed).length;

        return { recommended, ranked, activeCount };
    }, [tasks, taskTypes]);
}
