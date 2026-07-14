/**
 * Planning Converters (ActivityTemplate, CalendarEvent)
 */

import type { ActivityTemplate, CalendarEvent } from '../../../types/planning';
import type { DbActivityTemplate, DbCalendarEvent } from '../types';

export function dbToActivityTemplate(db: DbActivityTemplate): ActivityTemplate {
    return {
        id: db.id,
        userId: db.user_id,
        name: db.name,
        emoji: db.emoji || undefined,
        description: db.description || undefined,
        category: db.category as ActivityTemplate['category'],
        defaultMinutes: db.default_minutes,
        historicalMinutes: db.historical_minutes || undefined,
        averageMinutes: db.average_minutes || undefined,
        frequency: (db.frequency as ActivityTemplate['frequency']) || undefined,
        preferredTimeSlot:
            (db.preferred_time_slot as ActivityTemplate['preferredTimeSlot']) || undefined,
        preferredStartTime: db.preferred_start_time || undefined,
        isActive: db.is_active,
        createdAt: db.created_at,
        updatedAt: db.updated_at || undefined,
    };
}

export function activityTemplateToDb(
    template: Omit<ActivityTemplate, 'id' | 'createdAt'> & { id?: string },
    userId: string,
): Omit<DbActivityTemplate, 'id' | 'created_at'> & { id?: string } {
    return {
        id: template.id,
        user_id: userId,
        name: template.name,
        emoji: template.emoji || null,
        description: template.description || null,
        category: template.category,
        default_minutes: template.defaultMinutes,
        historical_minutes: template.historicalMinutes || null,
        average_minutes: template.averageMinutes || null,
        frequency: template.frequency || null,
        preferred_time_slot: template.preferredTimeSlot || null,
        preferred_start_time: template.preferredStartTime || null,
        is_active: template.isActive,
        updated_at: template.updatedAt || null,
    };
}

export function dbToCalendarEvent(db: DbCalendarEvent): CalendarEvent {
    return {
        id: db.id,
        userId: db.user_id,
        title: db.title,
        description: db.description || undefined,
        location: db.location || undefined,
        startTime: db.start_time,
        endTime: db.end_time,
        isAllDay: db.is_all_day,
        travelTimeMinutes: db.travel_time_minutes || undefined,
        travelFromLocation: db.travel_from_location || undefined,
        source: db.source as CalendarEvent['source'],
        externalId: db.external_id || undefined,
        calendarName: db.calendar_name || undefined,
        createdAt: db.created_at,
        syncedAt: db.synced_at || undefined,
    };
}

export function calendarEventToDb(
    event: Omit<CalendarEvent, 'id' | 'createdAt'> & { id?: string },
    userId: string,
): Omit<DbCalendarEvent, 'id' | 'created_at'> & { id?: string } {
    return {
        id: event.id,
        user_id: userId,
        title: event.title,
        description: event.description || null,
        location: event.location || null,
        start_time: event.startTime,
        end_time: event.endTime,
        is_all_day: event.isAllDay,
        travel_time_minutes: event.travelTimeMinutes || null,
        travel_from_location: event.travelFromLocation || null,
        source: event.source,
        external_id: event.externalId || null,
        calendar_name: event.calendarName || null,
        synced_at: event.syncedAt || null,
    };
}
