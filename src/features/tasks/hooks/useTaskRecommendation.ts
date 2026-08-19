/**
 * useTaskRecommendation — the ranked "what should I do now" view of tasks.
 *
 * Wraps getRankedTasks with the two context signals the app can actually
 * provide: home days per task type (the TaskTypeManager setting) and the free
 * minutes left in today's calendar (via useScheduleContext). Energy/context
 * bonuses in scoreTask stay unwired — the app has no "today's energy" signal
 * yet (the morning gate records yesterday's).
 */

import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { useTaskTypes } from './useTaskTypes';
import { useScheduleContext } from './useScheduleContext';
import { getRankedTasks, type TaskRecommendation } from '../utils/taskRecommender';

export interface UseTaskRecommendationReturn {
    /** The single best task to work on right now */
    recommended: TaskRecommendation | null;
    /** All active tasks ranked by score */
    ranked: TaskRecommendation[];
    /** Recommendation per task id — reasons and next subtask included. */
    byId: Map<string, TaskRecommendation>;
    /** Score per task id — the shape buildTaskBoard/sortTasksCanonical want. */
    scoreById: Map<string, number>;
    /** Number of active (incomplete) tasks */
    activeCount: number;
}

export function useTaskRecommendation(): UseTaskRecommendationReturn {
    const { tasks } = useTasks();
    const { taskTypes } = useTaskTypes();
    const { freeMinutes } = useScheduleContext();

    return useMemo(() => {
        const today = new Date();
        const homeDaysByType = new Map(
            taskTypes
                .filter((type) => type.homeDays?.length)
                .map((type) => [type.id, type.homeDays ?? []]),
        );
        const ranked = getRankedTasks(tasks, today, homeDaysByType, {
            nextFreeBlockMinutes: freeMinutes,
        });
        const byId = new Map(ranked.map((r) => [r.task.id, r] as const));
        const scoreById = new Map(ranked.map((r) => [r.task.id, r.score] as const));
        const activeCount = tasks.filter((t) => !t.completed).length;

        return { recommended: ranked[0] ?? null, ranked, byId, scoreById, activeCount };
    }, [tasks, taskTypes, freeMinutes]);
}
