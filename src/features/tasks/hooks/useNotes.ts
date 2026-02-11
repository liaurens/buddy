import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import type { SmartNote, NoteCategory, SmartNotesState } from '../types';
import {
    supabase,
    dbToSmartNote,
    smartNoteToDb,
    dbToNoteCategory,
    type DbSmartNote,
    type DbNoteCategory,
} from '../../../services/supabase';

// Default categories to seed for new users
const DEFAULT_CATEGORIES: Omit<NoteCategory, 'id' | 'createdAt'>[] = [
    { name: 'Groceries', flag: 'boodschap', emoji: '🛒', color: '#22c55e' },
    { name: 'Todo', flag: 'todo', emoji: '✅', color: '#3b82f6' },
    { name: 'Work', flag: 'werk', emoji: '💼', color: '#8b5cf6' },
    { name: 'Ideas', flag: 'idee', emoji: '💡', color: '#f59e0b' },
    { name: 'Project', flag: 'project', emoji: '📁', color: '#ec4899' },
];

/**
 * Parses note content to extract flag and clean content.
 * Flags are words starting with '-' (e.g., "-boodschap", "-todo")
 */
function parseNoteContent(content: string): { cleanContent: string; flag: string | null } {
    const flagMatch = content.match(/-(\w+)/);
    if (flagMatch) {
        const flag = flagMatch[1].toLowerCase();
        const cleanContent = content.replace(/-\w+/, '').trim();
        return { cleanContent, flag };
    }
    return { cleanContent: content, flag: null };
}

export const useNotes = (): SmartNotesState => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch categories
    const { data: categories = [] } = useQuery({
        queryKey: ['note_categories', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('note_categories')
                .select('*')
                .eq('user_id', userId)
                .order('name', { ascending: true });

            if (error) throw error;

            // Seed default categories if none exist
            if (data.length === 0) {
                const categoriesToInsert = DEFAULT_CATEGORIES.map(c => ({
                    id: uuidv4(),
                    user_id: userId,
                    name: c.name,
                    flag: c.flag,
                    emoji: c.emoji || null,
                    color: c.color || null,
                }));

                const { data: seeded, error: seedError } = await supabase
                    .from('note_categories')
                    .insert(categoriesToInsert)
                    .select();

                if (seedError) {
                    console.error('Error seeding categories:', seedError);
                    return [];
                }
                return (seeded as DbNoteCategory[]).map(dbToNoteCategory);
            }

            return (data as DbNoteCategory[]).map(dbToNoteCategory);
        },
        enabled: !!userId,
    });

    // Fetch notes
    const { data: notes = [], isLoading } = useQuery({
        queryKey: ['smart_notes', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error} = await supabase
                .from('smart_notes')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data as DbSmartNote[]).map(dbToSmartNote);
        },
        enabled: !!userId,
    });

    // Add a note with automatic flag detection and sorting
    const addNote = useCallback(async (content: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { cleanContent, flag } = parseNoteContent(content);

        // Find matching category by flag
        let categoryId: string | undefined;
        if (flag) {
            const matchingCategory = categories.find(c => c.flag.toLowerCase() === flag);
            if (matchingCategory) {
                categoryId = matchingCategory.id;
            }
        }

        const newNote: SmartNote = {
            id: uuidv4(),
            content: cleanContent,
            categoryId,
            flag: flag || undefined,
            processed: false,
            createdAt: new Date().toISOString(),
        };

        const dbNote = smartNoteToDb(newNote, userId);
        const { error } = await supabase.from('smart_notes').insert({
            ...dbNote,
            created_at: newNote.createdAt,
        });

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['smart_notes', userId] });
    }, [userId, categories, queryClient]);

    const updateNote = useCallback(async (note: SmartNote) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('smart_notes')
            .update({
                content: note.content,
                category_id: note.categoryId || null,
                flag: note.flag || null,
                processed: note.processed,
                updated_at: new Date().toISOString(),
            })
            .eq('id', note.id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['smart_notes', userId] });
    }, [userId, queryClient]);

    const deleteNote = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('smart_notes')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['smart_notes', userId] });
    }, [userId, queryClient]);

    const moveToCategory = useCallback(async (noteId: string, categoryId: string | null) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('smart_notes')
            .update({
                category_id: categoryId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', noteId)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['smart_notes', userId] });
    }, [userId, queryClient]);

    const markProcessed = useCallback(async (noteId: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('smart_notes')
            .update({
                processed: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', noteId)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['smart_notes', userId] });
    }, [userId, queryClient]);

    // Category management
    const addCategory = useCallback(async (category: Omit<NoteCategory, 'id' | 'createdAt'>) => {
        if (!userId) throw new Error('Not authenticated');

        const newCategory = {
            id: uuidv4(),
            user_id: userId,
            name: category.name,
            flag: category.flag.toLowerCase(),
            emoji: category.emoji || null,
            color: category.color || null,
        };

        const { error } = await supabase.from('note_categories').insert(newCategory);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['note_categories', userId] });
    }, [userId, queryClient]);

    const updateCategory = useCallback(async (category: NoteCategory) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('note_categories')
            .update({
                name: category.name,
                flag: category.flag.toLowerCase(),
                emoji: category.emoji || null,
                color: category.color || null,
            })
            .eq('id', category.id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['note_categories', userId] });
    }, [userId, queryClient]);

    const deleteCategory = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        // Move notes in this category to inbox (null category)
        await supabase
            .from('smart_notes')
            .update({ category_id: null })
            .eq('category_id', id)
            .eq('user_id', userId);

        const { error } = await supabase
            .from('note_categories')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['note_categories', userId] });
        queryClient.invalidateQueries({ queryKey: ['smart_notes', userId] });
    }, [userId, queryClient]);

    return {
        notes,
        categories,
        isLoading,
        addNote,
        updateNote,
        deleteNote,
        moveToCategory,
        markProcessed,
        addCategory,
        updateCategory,
        deleteCategory,
    };
};
