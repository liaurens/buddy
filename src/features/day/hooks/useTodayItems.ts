import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase, dbToCalendarEvent } from '../../../services/supabase';
import type { DbCalendarEvent } from '../../../services/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../../tasks/hooks/useTasks';
import type { Task } from '../../tasks/types';
import type { CalendarEvent } from '../../planning/types';

export type TimelineItem =
    | { kind: 'event'; time: string; sortKey: number; event: CalendarEvent }
    | { kind: 'pick'; time: string | null; sortKey: number; task: Task };

interface UseTodayItems {
    events: CalendarEvent[];
    picks: Task[];
    timedItems: TimelineItem[];
    untimedPicks: Task[];
    completedCount: number;
    totalCount: number;
    estimatedTotalMinutes: number;
    isLoading: boolean;
    refetchEvents: () => void;
}

function timeFromIso(iso: string): { hhmm: string; sortKey: number } {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return { hhmm: `${hh}:${mm}`, sortKey: d.getHours() * 60 + d.getMinutes() };
}

function sortKeyForHHMM(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/**
 * Returns today's calendar events + picks (todos due today), merged into a
 * single time-sorted timeline. Untimed picks are returned separately so the
 * caller can render them in an "Anytime" group.
 */
export function useTodayItems(dateKey?: string): UseTodayItems {
    const { user } = useAuth();
    const today = useMemo(() => dateKey ?? format(new Date(), 'yyyy-MM-dd'), [dateKey]);
    const { tasks, isLoading: tasksLoading } = useTasks();

    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const eventsQuery = useQuery({
        queryKey: ['calendar_events', user?.id, today],
        queryFn: async () => {
            if (!user?.id) return [] as CalendarEvent[];
            const dayStart = new Date(`${today}T00:00:00`);
            const dayEnd = new Date(`${today}T23:59:59`);
            const { data, error } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user.id)
                .gte('start_time', dayStart.toISOString())
                .lte('start_time', dayEnd.toISOString())
                .order('start_time', { ascending: true });
            if (error) throw error;
            return ((data ?? []) as DbCalendarEvent[]).map(dbToCalendarEvent);
        },
        enabled: !!user?.id,
        staleTime: 60_000,
    });

    useEffect(() => {
        if (eventsQuery.data) setEvents(eventsQuery.data);
    }, [eventsQuery.data]);

    const picks = useMemo(() => tasks.filter((t) => t.dueDate === today), [tasks, today]);

    const timedItems = useMemo<TimelineItem[]>(() => {
        const items: TimelineItem[] = [];

        for (const ev of events) {
            const { hhmm, sortKey } = timeFromIso(ev.startTime);
            items.push({ kind: 'event', time: hhmm, sortKey, event: ev });
        }
        for (const t of picks) {
            if (t.dueTime) {
                items.push({
                    kind: 'pick',
                    time: t.dueTime,
                    sortKey: sortKeyForHHMM(t.dueTime),
                    task: t,
                });
            }
        }
        items.sort((a, b) => a.sortKey - b.sortKey);
        return items;
    }, [events, picks]);

    const untimedPicks = useMemo(() => picks.filter((t) => !t.dueTime), [picks]);

    const estimatedTotalMinutes = useMemo(
        () => picks.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0),
        [picks],
    );

    const completedCount = useMemo(() => picks.filter((t) => t.completed).length, [picks]);

    const refetchEvents = useCallback(() => {
        void eventsQuery.refetch();
    }, [eventsQuery]);

    return {
        events,
        picks,
        timedItems,
        untimedPicks,
        completedCount,
        totalCount: picks.length,
        estimatedTotalMinutes,
        isLoading: tasksLoading || eventsQuery.isLoading,
        refetchEvents,
    };
}

export function formatMinutesTotal(mins: number): string {
    if (mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
