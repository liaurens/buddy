import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getDayCapacity, setDayCapacity, type DayCapacity } from '../services/dayCapacity';

/** Read/set today's capacity (normal | survival). */
export function useDayCapacity(date: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: capacity = 'normal', isLoading } = useQuery({
        queryKey: ['dayCapacity', userId, date],
        queryFn: () => getDayCapacity(userId!, date),
        enabled: !!userId,
        staleTime: 60_000,
    });

    const setCapacity = useCallback(
        async (next: DayCapacity) => {
            if (!userId) return;
            await setDayCapacity(userId, date, next);
            queryClient.invalidateQueries({ queryKey: ['dayCapacity', userId, date] });
        },
        [userId, date, queryClient],
    );

    return { capacity, isLoading, setCapacity };
}
