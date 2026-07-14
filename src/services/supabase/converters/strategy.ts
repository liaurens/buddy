/**
 * Strategy Converters
 */

import type { Strategy } from '../../../features/toolbox/types';
import type { DbStrategy } from '../types';

export function dbToStrategy(db: DbStrategy): Strategy {
    return {
        id: db.id,
        title: db.title,
        description: db.description || '',
        category: db.category || '',
        tags: db.tags || [],
        content: db.content || undefined,
        findings: db.findings || [],
        isFavorite: db.is_favorite,
    };
}

export function strategyToDb(
    strategy: Omit<Strategy, 'id'> & { id?: string },
    userId: string,
): Omit<DbStrategy, 'id'> & { id?: string } {
    return {
        id: strategy.id,
        user_id: userId,
        title: strategy.title,
        description: strategy.description || null,
        category: strategy.category || null,
        tags: strategy.tags || null,
        content: strategy.content || null,
        findings: strategy.findings || null,
        is_favorite: strategy.isFavorite || false,
    };
}
