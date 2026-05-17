import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { dbToClass, classToDb, type SchoolClass } from '../../../services/supabase/converters/school';
import type { DbClass } from '../../../services/supabase/types/school-types';

const EMPTY: SchoolClass[] = [];

export function useClasses(includeArchived = false) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: classes = EMPTY, isLoading } = useQuery({
        queryKey: ['classes', userId, includeArchived],
        queryFn: async () => {
            if (!userId) return [];
            let q = supabase.from('classes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (!includeArchived) q = q.eq('archived', false);
            const { data, error } = await q;
            if (error) throw error;
            return (data as DbClass[]).map(dbToClass);
        },
        enabled: !!userId,
    });

    const addClass = useCallback(async (params: {
        name: string;
        instructor?: string;
        term?: string;
        color?: string;
    }) => {
        if (!userId) throw new Error('Not authenticated');
        const payload = classToDb({
            userId,
            name: params.name,
            instructor: params.instructor ?? null,
            term: params.term ?? null,
            color: params.color ?? '#6366f1',
            archived: false,
        }, userId);
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['classes', userId] });
    }, [userId, queryClient]);

    const updateClass = useCallback(async (id: string, patch: Partial<Omit<SchoolClass, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
        if (!userId) throw new Error('Not authenticated');
        const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.instructor !== undefined) dbPatch.instructor = patch.instructor;
        if (patch.term !== undefined) dbPatch.term = patch.term;
        if (patch.color !== undefined) dbPatch.color = patch.color;
        if (patch.archived !== undefined) dbPatch.archived = patch.archived;
        const { error } = await supabase.from('classes').update(dbPatch).eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['classes', userId] });
    }, [userId, queryClient]);

    const deleteClass = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { data: assignmentRows, error: assignmentReadError } = await supabase
            .from('assignments')
            .select('id')
            .eq('class_id', id)
            .eq('user_id', userId);
        if (assignmentReadError) throw assignmentReadError;

        const assignmentIds = (assignmentRows ?? []).map(row => row.id as string);
        if (assignmentIds.length > 0) {
            const { error: todoError } = await supabase
                .from('todos')
                .delete()
                .eq('user_id', userId)
                .in('assignment_id', assignmentIds);
            if (todoError) throw todoError;
        }

        const { data: documentRows, error: documentReadError } = await supabase
            .from('class_documents')
            .select('storage_path')
            .eq('class_id', id)
            .eq('user_id', userId);
        if (documentReadError) throw documentReadError;

        const storagePaths = (documentRows ?? []).map(row => row.storage_path as string).filter(Boolean);
        if (storagePaths.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('class-documents')
                .remove(storagePaths);
            if (storageError) throw storageError;
        }

        const { error } = await supabase.from('classes').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['classes', userId] });
        queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
        queryClient.invalidateQueries({ queryKey: ['classSessions', userId] });
        queryClient.invalidateQueries({ queryKey: ['classDocuments', userId] });
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    return { classes, isLoading, addClass, updateClass, deleteClass };
}
