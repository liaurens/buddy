import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { dbToAssignment, assignmentToDb, type Assignment, type AssignmentStatus } from '../../../services/supabase/converters/school';
import type { DbAssignment } from '../../../services/supabase/types/school-types';

const EMPTY: Assignment[] = [];

interface UseAssignmentsOptions {
    classId?: string;
    activeOnly?: boolean;
}

export function useAssignments(options: UseAssignmentsOptions = {}) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;
    const { classId, activeOnly = false } = options;

    const { data: assignments = EMPTY, isLoading } = useQuery({
        queryKey: ['assignments', userId, classId ?? null, activeOnly],
        queryFn: async () => {
            if (!userId) return [];
            let q = supabase.from('assignments').select('*').eq('user_id', userId).order('deadline', { ascending: true });
            if (classId) q = q.eq('class_id', classId);
            if (activeOnly) q = q.in('status', ['pending', 'in_progress']);
            const { data, error } = await q;
            if (error) throw error;
            return (data as DbAssignment[]).map(dbToAssignment);
        },
        enabled: !!userId,
    });

    const addAssignment = useCallback(async (params: {
        classId: string;
        title: string;
        description?: string;
        deadline: string;
        estimatedMinutes?: number;
    }) => {
        if (!userId) throw new Error('Not authenticated');
        const payload = assignmentToDb({
            userId,
            classId: params.classId,
            title: params.title,
            description: params.description ?? null,
            deadline: params.deadline,
            status: 'pending',
            estimatedMinutes: params.estimatedMinutes ?? null,
            checkpoints: null,
        }, userId);
        const { error } = await supabase.from('assignments').insert(payload);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
    }, [userId, queryClient]);

    const updateAssignment = useCallback(async (id: string, patch: Partial<Omit<Assignment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
        if (!userId) throw new Error('Not authenticated');
        const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (patch.classId !== undefined) dbPatch.class_id = patch.classId;
        if (patch.title !== undefined) dbPatch.title = patch.title;
        if (patch.description !== undefined) dbPatch.description = patch.description;
        if (patch.deadline !== undefined) dbPatch.deadline = patch.deadline;
        if (patch.status !== undefined) dbPatch.status = patch.status;
        if (patch.estimatedMinutes !== undefined) dbPatch.estimated_minutes = patch.estimatedMinutes;
        if (patch.checkpoints !== undefined) dbPatch.checkpoints = patch.checkpoints;
        const { error } = await supabase.from('assignments').update(dbPatch).eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
    }, [userId, queryClient]);

    const setStatus = useCallback(async (id: string, status: AssignmentStatus) => {
        await updateAssignment(id, { status });
    }, [updateAssignment]);

    const deleteAssignment = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('assignments').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
    }, [userId, queryClient]);

    return { assignments, isLoading, addAssignment, updateAssignment, setStatus, deleteAssignment };
}
