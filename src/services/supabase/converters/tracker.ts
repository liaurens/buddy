/**
 * Tracker and Entry Converters
 * Convert between DB types (snake_case) and App types (camelCase)
 */

import type {
    TrackerDefinition,
    TrackerCadence,
    Entry,
} from '../../../features/health-tracking/types';
import type { DbTracker, DbEntry } from '../types';

export function dbToTracker(db: DbTracker): TrackerDefinition {
    return {
        id: db.id,
        name: db.name,
        emoji: db.emoji || '',
        type: db.type as TrackerDefinition['type'],
        unit: db.unit || undefined,
        group: db.group || undefined,
        goal: db.goal || undefined,
        checkinConfig: db.checkin_config || undefined,
        cadence: (db.cadence as TrackerCadence | null) ?? 'daily',
        scale: db.scale || undefined,
    };
}

export function trackerToDb(
    tracker: TrackerDefinition,
    userId: string,
): Omit<DbTracker, 'created_at'> {
    return {
        id: tracker.id,
        user_id: userId,
        name: tracker.name,
        emoji: tracker.emoji || null,
        type: tracker.type,
        unit: tracker.unit || null,
        group: tracker.group || null,
        goal: tracker.goal || null,
        checkin_config: tracker.checkinConfig || null,
        cadence: tracker.cadence || 'daily',
        scale: tracker.scale || null,
    };
}

export function dbToEntry(db: DbEntry): Entry {
    return {
        id: db.id,
        trackerId: db.tracker_id,
        value: db.value ?? 0,
        textValue: db.text_value || undefined,
        timestamp: db.timestamp,
        notes: db.notes || undefined,
        metadata: db.metadata || undefined,
    };
}

export function entryToDb(
    entry: Omit<Entry, 'id'> & { id?: string },
    userId: string,
): Omit<DbEntry, 'id'> & { id?: string } {
    return {
        id: entry.id,
        user_id: userId,
        tracker_id: entry.trackerId,
        value: entry.value,
        text_value: entry.textValue || null,
        timestamp: entry.timestamp,
        notes: entry.notes || null,
        metadata: entry.metadata || null,
    };
}
