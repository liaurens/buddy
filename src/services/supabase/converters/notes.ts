/**
 * Smart Notes and Category Converters
 */

import type { NoteCategory, SmartNote } from '../../../features/tasks/types';
import type { DbNoteCategory, DbSmartNote } from '../types';

export function dbToNoteCategory(db: DbNoteCategory): NoteCategory {
    return {
        id: db.id,
        name: db.name,
        flag: db.flag,
        emoji: db.emoji || undefined,
        color: db.color || undefined,
        createdAt: db.created_at,
    };
}

export function dbToSmartNote(db: DbSmartNote): SmartNote {
    return {
        id: db.id,
        content: db.content,
        categoryId: db.category_id || undefined,
        flag: db.flag || undefined,
        processed: db.processed,
        createdAt: db.created_at,
        updatedAt: db.updated_at || undefined,
    };
}

export function smartNoteToDb(
    note: Omit<SmartNote, 'id' | 'createdAt'> & { id?: string },
    userId: string,
): Omit<DbSmartNote, 'id' | 'created_at'> & { id?: string } {
    return {
        id: note.id,
        user_id: userId,
        content: note.content,
        category_id: note.categoryId || null,
        flag: note.flag || null,
        processed: note.processed,
        updated_at: note.updatedAt || null,
    };
}
