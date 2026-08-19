/**
 * useScheduleContext — how much of today is actually free.
 *
 * Reads the user's night time and today's calendar events, and derives the
 * free minutes left before the day ends. Shared by triage (AI workload
 * context, urgent-day selection) and the task recommender ("fits the next
 * free block" bonus) — both consumers mount at once on the Tasks screen, so
 * the queryKey must stay identical for React Query to dedupe the fetch.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { getCategorySettings } from '../../../services/settings';
import { remainingCalendarMinutes } from '../utils/taskFlags';

export interface ScheduleContext {
    /** The user's configured night time, HH:mm. */
    nightTime: string;
    /** Free minutes between now and night time, minus calendar events.
     *  Undefined while loading or when the calendar query failed. */
    freeMinutes: number | undefined;
}

export function useScheduleContext(): ScheduleContext {
    const { user } = useAuth();
    const userId = user?.id;
    const todayIso = new Date().toISOString().slice(0, 10);

    const query = useQuery({
        queryKey: ['urgent-schedule-context', userId, todayIso],
        enabled: !!userId,
        staleTime: 60_000,
        queryFn: async () => {
            const now = new Date();
            const endOfDay = new Date(`${todayIso}T23:59:59`);
            const [settings, eventsResult] = await Promise.all([
                getCategorySettings(userId!, 'notifications').catch(() => ({
                    nightTime: '21:00',
                })),
                supabase
                    .from('calendar_events')
                    .select('start_time, end_time')
                    .eq('user_id', userId!)
                    .gte('end_time', now.toISOString())
                    .lte('start_time', endOfDay.toISOString()),
            ]);

            if (eventsResult.error) {
                console.warn(
                    'Urgent scheduling: calendar availability unavailable:',
                    eventsResult.error.message,
                );
            }
            const blocks = (eventsResult.data ?? []).map((event) => ({
                start: event.start_time,
                end: event.end_time,
            }));
            return {
                nightTime: settings.nightTime,
                freeMinutes: eventsResult.error
                    ? undefined
                    : remainingCalendarMinutes(blocks, now, settings.nightTime),
            };
        },
    });

    return {
        nightTime: query.data?.nightTime ?? '21:00',
        freeMinutes: query.data?.freeMinutes,
    };
}
