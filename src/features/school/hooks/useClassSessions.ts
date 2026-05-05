import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { dbToClassSession, classSessionToDb, type ClassSession } from '../../../services/supabase/converters/school';
import type { DbClassSession } from '../../../services/supabase/types/school-types';

const EMPTY: ClassSession[] = [];

export function useClassSessions(classId?: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: sessions = EMPTY, isLoading } = useQuery({
        queryKey: ['classSessions', userId, classId ?? null],
        queryFn: async () => {
            if (!userId) return [];
            let q = supabase.from('class_sessions').select('*').eq('user_id', userId)
                .order('day_of_week', { ascending: true })
                .order('start_time', { ascending: true });
            if (classId) q = q.eq('class_id', classId);
            const { data, error } = await q;
            if (error) throw error;
            return (data as DbClassSession[]).map(dbToClassSession);
        },
        enabled: !!userId,
    });

    const addSession = useCallback(async (params: {
        classId: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        location?: string;
    }) => {
        if (!userId) throw new Error('Not authenticated');
        const payload = classSessionToDb({
            userId,
            classId: params.classId,
            dayOfWeek: params.dayOfWeek,
            startTime: params.startTime,
            endTime: params.endTime,
            location: params.location ?? null,
        }, userId);
        const { error } = await supabase.from('class_sessions').insert(payload);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['classSessions', userId] });
    }, [userId, queryClient]);

    const deleteSession = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('class_sessions').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['classSessions', userId] });
    }, [userId, queryClient]);

    return { sessions, isLoading, addSession, deleteSession };
}
