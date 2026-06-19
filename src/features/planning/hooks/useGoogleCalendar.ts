/**
 * React Query hooks for the Google Calendar connection.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getConnectionStatus, disconnectGoogle, startGoogleAuth,
    isGoogleCalendarConfigured, type ConnectionStatus,
} from '../services/google-calendar.service';

const STATUS_KEY = ['google-calendar', 'status'] as const;

export function useGoogleCalendarConnection() {
    return useQuery<ConnectionStatus>({
        queryKey: STATUS_KEY,
        queryFn: getConnectionStatus,
        enabled: isGoogleCalendarConfigured,
        staleTime: 5 * 60 * 1000,
    });
}

export function useDisconnectGoogleCalendar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: disconnectGoogle,
        onSuccess: () => { void qc.invalidateQueries({ queryKey: STATUS_KEY }); },
    });
}

/** Connect = redirect to Google consent. Returns the imperative starter. */
export function useConnectGoogleCalendar() {
    return useMutation({ mutationFn: startGoogleAuth });
}

export { isGoogleCalendarConfigured };
