import { useEffect, useState } from 'react';
import { useTaskRecommendation } from '../../tasks/hooks/useTaskRecommendation';
import { useAssignments } from '../../school/hooks/useAssignments';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { dbToCalendarEvent } from '../../../services/supabase';
import type { DbCalendarEvent } from '../../../services/supabase';
import type { TaskRecommendation } from '../../tasks/utils/taskRecommender';
import type { Assignment } from '../../../services/supabase/converters/school';
import type { CalendarEvent } from '../../planning/types';

export interface NextUp {
    kind: 'task' | 'event' | 'assignment' | 'none';
    task?: TaskRecommendation;
    event?: CalendarEvent;
    assignment?: Assignment;
    /** Sort key in ms — when this thing wants attention */
    when?: number;
}

/**
 * Pick whichever wants attention soonest: the recommended task (by due date),
 * the next calendar event today, or the nearest active school assignment.
 * Assignments are first-class here — a student's highest-stakes deadlines
 * must never be absent from the Now page.
 */
export function useNextUp(): NextUp {
    const { recommended } = useTaskRecommendation();
    const { assignments } = useAssignments({ activeOnly: true });
    const { user } = useAuth();
    const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', user.id)
            .gte('start_time', now.toISOString())
            .lte('start_time', endOfDay.toISOString())
            .order('start_time', { ascending: true })
            .limit(1)
            .then(({ data, error }) => {
                if (error || !data?.length) {
                    setNextEvent(null);
                    return;
                }
                setNextEvent(dbToCalendarEvent(data[0] as DbCalendarEvent));
            });
    }, [user?.id]);

    const taskWhen = recommended?.task.dueDate
        ? new Date(recommended.task.dueDate).getTime()
        : recommended ? Number.MAX_SAFE_INTEGER : undefined;
    const eventWhen = nextEvent ? new Date(nextEvent.startTime).getTime() : undefined;

    // Nearest active assignment by deadline (hook already sorts ascending).
    const nextAssignment = assignments.find(a => !Number.isNaN(new Date(a.deadline).getTime())) ?? null;
    const assignmentWhen = nextAssignment ? new Date(nextAssignment.deadline).getTime() : undefined;

    const candidates: NextUp[] = [];
    if (nextEvent && eventWhen !== undefined) {
        candidates.push({ kind: 'event', event: nextEvent, when: eventWhen });
    }
    if (recommended) {
        candidates.push({ kind: 'task', task: recommended, when: taskWhen });
    }
    if (nextAssignment && assignmentWhen !== undefined) {
        candidates.push({ kind: 'assignment', assignment: nextAssignment, when: assignmentWhen });
    }

    if (candidates.length === 0) {
        return { kind: 'none' };
    }

    return candidates.reduce((soonest, candidate) =>
        (candidate.when ?? Number.MAX_SAFE_INTEGER) < (soonest.when ?? Number.MAX_SAFE_INTEGER)
            ? candidate
            : soonest
    );
}
