/**
 * Task Type Converters
 */

import type { TaskType } from '../../../features/tasks/types';
import type { DbTaskType } from '../types';

export function dbToTaskType(db: DbTaskType): TaskType {
    return {
        id: db.id,
        name: db.name,
        emoji: db.emoji || undefined,
        color: db.color || undefined,
        sortOrder: db.sort_order,
        isPreset: db.is_preset,
        createdAt: db.created_at,
        homeDays: db.home_days || undefined,
    };
}

export function taskTypeToDb(
    t: Omit<TaskType, 'id' | 'createdAt'> & { id?: string },
    userId: string,
): Omit<DbTaskType, 'id' | 'created_at'> & { id?: string } {
    return {
        id: t.id,
        user_id: userId,
        name: t.name,
        emoji: t.emoji || null,
        color: t.color || null,
        sort_order: t.sortOrder,
        is_preset: t.isPreset,
        home_days: t.homeDays || null,
    };
}
