import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import {
    dbToAssignment,
    assignmentToDb,
    type Assignment,
    type AssignmentStatus,
} from '../../../services/supabase/converters/school';
import type { DbAssignment } from '../../../services/supabase/types/school-types';
import { todoToDb } from '../../../services/supabase/converters/todo';
import { buildAssignmentTodo } from '../utils/assignmentTodo';

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
            let q = supabase
                .from('assignments')
                .select('*')
                .eq('user_id', userId)
                .order('deadline', { ascending: true });
            if (classId) q = q.eq('class_id', classId);
            if (activeOnly) q = q.in('status', ['pending', 'in_progress']);
            const { data, error } = await q;
            if (error) throw error;
            return (data as DbAssignment[]).map(dbToAssignment);
        },
        enabled: !!userId,
    });

    const addAssignment = useCallback(
        async (params: {
            classId: string;
            title: string;
            description?: string;
            deadline: string;
            estimatedMinutes?: number;
        }): Promise<string> => {
            if (!userId) throw new Error('Not authenticated');
            const payload = assignmentToDb(
                {
                    userId,
                    classId: params.classId,
                    title: params.title,
                    description: params.description ?? null,
                    deadline: params.deadline,
                    status: 'pending',
                    estimatedMinutes: params.estimatedMinutes ?? null,
                    checkpoints: null,
                },
                userId,
            );
            const { data, error } = await supabase
                .from('assignments')
                .insert(payload)
                .select('id')
                .single();
            if (error) throw error;
            const assignmentId = (data as { id: string }).id;

            // Mirror the deadline onto a linked todo so it shows on the one
            // trusted task surface. Non-fatal: the assignment stands either way.
            try {
                const todo = buildAssignmentTodo(
                    {
                        id: assignmentId,
                        title: params.title,
                        deadline: params.deadline,
                        estimatedMinutes: params.estimatedMinutes ?? null,
                    },
                    new Date(),
                );
                const { error: todoError } = await supabase
                    .from('todos')
                    .insert(todoToDb({ ...todo, id: uuidv4() }, userId));
                if (todoError) throw todoError;
            } catch (todoErr) {
                console.error('Failed to create linked todo for assignment:', todoErr);
            }

            queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
            return assignmentId;
        },
        [userId, queryClient],
    );

    const updateAssignment = useCallback(
        async (
            id: string,
            patch: Partial<Omit<Assignment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
        ) => {
            if (!userId) throw new Error('Not authenticated');
            const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (patch.classId !== undefined) dbPatch.class_id = patch.classId;
            if (patch.title !== undefined) dbPatch.title = patch.title;
            if (patch.description !== undefined) dbPatch.description = patch.description;
            if (patch.deadline !== undefined) dbPatch.deadline = patch.deadline;
            if (patch.status !== undefined) dbPatch.status = patch.status;
            if (patch.estimatedMinutes !== undefined)
                dbPatch.estimated_minutes = patch.estimatedMinutes;
            if (patch.checkpoints !== undefined) dbPatch.checkpoints = patch.checkpoints;
            const { error } = await supabase
                .from('assignments')
                .update(dbPatch)
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;

            // Keep the linked todo in sync (non-fatal — assignment update stands).
            try {
                if (patch.deadline !== undefined) {
                    // Move the todo with the deadline, unless the user already
                    // pulled it into today (or earlier) on purpose.
                    const todayIso = format(new Date(), 'yyyy-MM-dd');
                    const { error: dueError } = await supabase
                        .from('todos')
                        .update({ due_date: format(new Date(patch.deadline), 'yyyy-MM-dd') })
                        .eq('assignment_id', id)
                        .eq('user_id', userId)
                        .eq('completed', false)
                        .gt('due_date', todayIso);
                    if (dueError) throw dueError;
                }
                if (patch.status !== undefined) {
                    const finished = patch.status === 'submitted' || patch.status === 'graded';
                    const { error: statusError } = await supabase
                        .from('todos')
                        .update(
                            finished
                                ? { completed: true, completed_at: new Date().toISOString() }
                                : { completed: false, completed_at: null },
                        )
                        .eq('assignment_id', id)
                        .eq('user_id', userId)
                        .eq('completed', !finished);
                    if (statusError) throw statusError;
                }
            } catch (todoErr) {
                console.error('Failed to sync linked todo for assignment:', todoErr);
            }

            queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, queryClient],
    );

    const setStatus = useCallback(
        async (id: string, status: AssignmentStatus) => {
            await updateAssignment(id, { status });
        },
        [updateAssignment],
    );

    const deleteAssignment = useCallback(
        async (id: string) => {
            if (!userId) throw new Error('Not authenticated');
            const { error: todoError } = await supabase
                .from('todos')
                .delete()
                .eq('assignment_id', id)
                .eq('user_id', userId);
            if (todoError) throw todoError;
            const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, queryClient],
    );

    return { assignments, isLoading, addAssignment, updateAssignment, setStatus, deleteAssignment };
}
