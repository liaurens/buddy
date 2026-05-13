/**
 * Planning Types
 *
 * Calendar events synced from external calendars + activity templates
 * used by the Full daily routine. The AI planner stack has been removed.
 */

/**
 * Reusable template for standard activities
 * E.g., "Morning routine", "Commute", "Lunch"
 */
export interface ActivityTemplate {
    id: string;
    userId: string;
    name: string;
    emoji?: string;
    description?: string;
    category: 'routine' | 'chore' | 'health' | 'work' | 'leisure' | 'transit' | 'meal' | 'other';

    defaultMinutes: number;
    historicalMinutes?: number[];
    averageMinutes?: number;

    frequency?: 'daily' | 'weekly' | 'monthly' | 'as-needed';
    preferredTimeSlot?: 'morning' | 'afternoon' | 'evening' | 'any';
    preferredStartTime?: string;

    isActive: boolean;
    createdAt: string;
    updatedAt?: string;
}

/**
 * Calendar event imported from external calendar (iCal/CalDAV)
 */
export interface CalendarEvent {
    id: string;
    userId: string;
    title: string;
    description?: string;
    location?: string;

    startTime: string;
    endTime: string;
    isAllDay: boolean;

    travelTimeMinutes?: number;
    travelFromLocation?: string;

    source: 'ical' | 'caldav' | 'manual';
    externalId?: string;
    calendarName?: string;

    createdAt: string;
    syncedAt?: string;
}
