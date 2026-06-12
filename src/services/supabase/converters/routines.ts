/**
 * Routine + Routine Item Converters
 */

import type { Routine, RoutineItem } from '../../../features/tasks/types';
import type { DbTaskRoutine, DbTaskRoutineItem } from '../types';

export function dbToRoutineItem(db: DbTaskRoutineItem): RoutineItem {
    return {
        id: db.id,
        routineId: db.routine_id,
        title: db.title,
        taskTypeId: db.task_type_id || undefined,
        energy: db.energy || undefined,
        estimatedTime: db.estimated_time ?? undefined,
        sortOrder: db.sort_order,
    };
}

export function routineItemToDb(item: Omit<RoutineItem, 'id'> & { id?: string }): Omit<DbTaskRoutineItem, 'id'> & { id?: string } {
    return {
        id: item.id,
        routine_id: item.routineId,
        title: item.title,
        task_type_id: item.taskTypeId || null,
        energy: item.energy || null,
        estimated_time: item.estimatedTime ?? null,
        sort_order: item.sortOrder,
    };
}

export function dbToRoutine(db: DbTaskRoutine, items: DbTaskRoutineItem[] = []): Routine {
    return {
        id: db.id,
        name: db.name,
        emoji: db.emoji || undefined,
        description: db.description || undefined,
        createdAt: db.created_at,
        items: items.map(dbToRoutineItem),
    };
}

export function routineToDb(r: Omit<Routine, 'id' | 'createdAt' | 'items'> & { id?: string }, userId: string): Omit<DbTaskRoutine, 'id' | 'created_at'> & { id?: string } {
    return {
        id: r.id,
        user_id: userId,
        name: r.name,
        emoji: r.emoji || null,
        description: r.description || null,
    };
}
