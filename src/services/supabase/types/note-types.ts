/**
 * Database types for Notes and Categories
 */

export interface DbNoteCategory {
    id: string;
    user_id: string;
    name: string;
    flag: string;
    emoji: string | null;
    color: string | null;
    created_at: string;
}

export interface DbSmartNote {
    id: string;
    user_id: string;
    content: string;
    category_id: string | null;
    flag: string | null;
    processed: boolean;
    created_at: string;
    updated_at: string | null;
}
