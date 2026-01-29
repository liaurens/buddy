import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklistsService } from '../services/checklists.service';
import type { Checklist, ChecklistItem } from '../types';

export const useChecklists = () => {
    const queryClient = useQueryClient();

    const { data: checklists = [], isLoading, error } = useQuery({
        queryKey: ['checklists'],
        queryFn: checklistsService.getAll,
    });

    const createMutation = useMutation({
        mutationFn: checklistsService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklists'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (variables: { id: string; updates: Partial<Checklist> }) =>
            checklistsService.update(variables.id, variables.updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklists'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: checklistsService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklists'] });
        },
    });

    // Helper Actions

    const createChecklist = async (data: Partial<Checklist>) => {
        return createMutation.mutateAsync(data);
    };

    const updateChecklist = async (checklist: Checklist) => {
        return updateMutation.mutateAsync({ id: checklist.id, updates: checklist });
    };

    const deleteChecklist = async (id: string) => {
        return deleteMutation.mutateAsync(id);
    };

    const resetChecklist = async (checklist: Checklist) => {
        const newItems = checklist.items.map(i => ({ ...i, isChecked: false }));
        return updateMutation.mutateAsync({
            id: checklist.id,
            updates: { items: newItems }
        });
    };

    const addItem = async (checklist: Checklist, text: string) => {
        const newItem: ChecklistItem = {
            id: crypto.randomUUID(),
            text,
            isChecked: false
        };
        const newItems = [...checklist.items, newItem];
        return updateMutation.mutateAsync({
            id: checklist.id,
            updates: { items: newItems }
        });
    };

    const toggleItem = async (checklist: Checklist, itemId: string) => {
        const newItems = checklist.items.map(i =>
            i.id === itemId ? { ...i, isChecked: !i.isChecked } : i
        );
        return updateMutation.mutateAsync({
            id: checklist.id,
            updates: { items: newItems }
        });
    };

    const deleteItem = async (checklist: Checklist, itemId: string) => {
        const newItems = checklist.items.filter(i => i.id !== itemId);
        return updateMutation.mutateAsync({
            id: checklist.id,
            updates: { items: newItems }
        });
    };

    return {
        checklists,
        isLoading,
        error,
        createChecklist,
        updateChecklist,
        deleteChecklist,
        resetChecklist,
        addItem,
        toggleItem,
        deleteItem
    };
};
