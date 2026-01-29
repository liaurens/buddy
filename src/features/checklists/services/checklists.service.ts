import { supabase } from '@/services/supabase';
import type { Checklist, ChecklistItem } from '../types';

// DB Types
interface DbChecklist {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    emoji: string | null;
    items: ChecklistItem[]; // JSONB
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

// Converters
function dbToChecklist(db: DbChecklist): Checklist {
    return {
        id: db.id,
        name: db.name,
        description: db.description || undefined,
        emoji: db.emoji || undefined,
        items: Array.isArray(db.items) ? db.items : [],
        isPinned: db.is_pinned,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

function checklistToDb(checklist: Partial<Checklist>, userId: string): Partial<DbChecklist> {
    const db: Partial<DbChecklist> = {
        user_id: userId,
    };
    if (checklist.name !== undefined) db.name = checklist.name;
    if (checklist.description !== undefined) db.description = checklist.description || null;
    if (checklist.emoji !== undefined) db.emoji = checklist.emoji || null;
    if (checklist.items !== undefined) db.items = checklist.items;
    if (checklist.isPinned !== undefined) db.is_pinned = checklist.isPinned;

    return db;
}

export const checklistsService = {
    async getAll(): Promise<Checklist[]> {
        const { data, error } = await supabase
            .from('checklists')
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as DbChecklist[]).map(dbToChecklist);
    },

    async getById(id: string): Promise<Checklist> {
        const { data, error } = await supabase
            .from('checklists')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return dbToChecklist(data as DbChecklist);
    },

    async create(checklist: Partial<Checklist>): Promise<Checklist> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const dbPayload = checklistToDb(checklist, user.id);

        const { data, error } = await supabase
            .from('checklists')
            .insert(dbPayload)
            .select()
            .single();

        if (error) throw error;
        return dbToChecklist(data as DbChecklist);
    },

    async update(id: string, updates: Partial<Checklist>): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const dbPayload = checklistToDb(updates, user.id);
        dbPayload.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('checklists')
            .update(dbPayload)
            .eq('id', id);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('checklists')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
