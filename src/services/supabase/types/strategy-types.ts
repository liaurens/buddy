/**
 * Database types for Strategies
 */

export interface DbStrategy {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string[] | null;
    content: string | null;
    findings: Array<{
        id: string;
        date: string;
        note: string;
        rating: number;
    }> | null;
    is_favorite: boolean;
}
