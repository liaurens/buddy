import { useEffect, useState } from 'react';
import { useTaskRecommendation } from '../../tasks/hooks/useTaskRecommendation';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { dbToCalendarEvent } from '../../../services/supabase';
import type { DbCalendarEvent } from '../../../services/supabase';
import type { TaskRecommendation } from '../../tasks/utils/taskRecommender';
import type { CalendarEvent } from '../../planning/types';

export interface NextUp {
    kind: 'task' | 'event' | 'none';
    task?: TaskRecommendation;
    event?: CalendarEvent;
    /** Sort key in ms — when this thing wants attention */
    when?: number;
}

/** Pick whichever is sooner: the recommended task (by due date) or the next calendar event today. */
export function useNextUp(): NextUp {
    const { recommended } = useTaskRecommendation();
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

    if (eventWhen !== undefined && (taskWhen === undefined || eventWhen < taskWhen)) {
        return { kind: 'event', event: nextEvent!, when: eventWhen };
    }
    if (recommended) {
        return { kind: 'task', task: recommended, when: taskWhen };
    }
    return { kind: 'none' };
}
