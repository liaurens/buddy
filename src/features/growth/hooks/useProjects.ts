import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    createdAt: string;
    updatedAt: string;
}

interface DbProject {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    created_at: string;
    updated_at: string;
}

const dbToProject = (r: DbProject): Project => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
});

const EMPTY: Project[] = [];

export function useProjects(statusFilter: ProjectStatus | 'all' = 'active') {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: projects = EMPTY, isLoading } = useQuery({
        queryKey: ['projects', userId, statusFilter],
        queryFn: async () => {
            if (!userId) return [];
            let q = supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (statusFilter !== 'all') q = q.eq('status', statusFilter);
            const { data, error } = await q;
            if (error) throw error;
            return (data as DbProject[]).map(dbToProject);
        },
        enabled: !!userId,
    });

    const addProject = useCallback(async (params: { name: string; description?: string }) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('projects').insert({
            user_id: userId,
            name: params.name,
            description: params.description ?? null,
            status: 'active',
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
    }, [userId, queryClient]);

    const updateProject = useCallback(async (id: string, patch: { name?: string; description?: string | null; status?: ProjectStatus }) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('projects')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
    }, [userId, queryClient]);

    const deleteProject = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
    }, [userId, queryClient]);

    return { projects, isLoading, addProject, updateProject, deleteProject };
}
