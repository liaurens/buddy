import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import {
    getCheckinState,
    getLocalCheckinStatus,
    markCheckinDone,
    markCheckinSkipped,
    type CheckinState,
} from '../services/checkin.service';

/** Server-backed check-in state with a localStorage hint for first paint. */
export function useCheckinStatus(dateKey: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;
    const queryKey = ['checkin', userId, dateKey];

    const query = useQuery<CheckinState>({
        queryKey,
        queryFn: () => getCheckinState(userId!, dateKey),
        enabled: !!userId,
        staleTime: 60_000,
        placeholderData: () => {
            const local = getLocalCheckinStatus(dateKey);
            return local ? { status: local, intention: null } : undefined;
        },
    });

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey });
        // The gate writes to daily_plans; capacity/intention readers share it.
        void queryClient.invalidateQueries({ queryKey: ['dayCapacity', userId, dateKey] });
    }, [queryClient, queryKey, userId, dateKey]);

    const doneMutation = useMutation({
        mutationFn: (opts: { intention?: string }) => markCheckinDone(userId!, dateKey, opts),
        onSuccess: invalidate,
    });

    const skipMutation = useMutation({
        mutationFn: () => markCheckinSkipped(userId!, dateKey),
        onSuccess: invalidate,
    });

    return {
        state: query.data ?? null,
        isLoading: query.isLoading,
        markDone: doneMutation.mutateAsync,
        markSkipped: skipMutation.mutateAsync,
        isSaving: doneMutation.isPending || skipMutation.isPending,
    };
}
