/**
 * Calendar Service - iCal/CalDAV Integration
 *
 * Fetches and parses calendar events from external sources:
 * - iCal URLs (Apple Calendar, Google Calendar public links)
 * - CalDAV endpoints
 */

import ICAL from 'ical.js';
import type { CalendarEvent } from '../../../types/planning';
import { supabase } from '../../../services/supabase';

// ============================================================================
// Types
// ============================================================================

export interface CalendarSyncResult {
    success: boolean;
    events: CalendarEvent[];
    error?: string;
    syncedAt: string;
}

export interface CalendarConfig {
    url: string;
    calendarName: string;
    source: 'ical' | 'caldav';
}

// ============================================================================
// Calendar Service
// ============================================================================

/**
 * Normalize calendar URL (convert webcal:// to https://)
 */
function normalizeCalendarUrl(url: string): string {
    // Convert webcal:// to https://
    if (url.startsWith('webcal://')) {
        return url.replace('webcal://', 'https://');
    }
    // Convert http:// to https:// for security
    if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
    }
    return url;
}

/**
 * Fetch and parse iCal feed from URL
 */
export async function fetchICalFeed(url: string): Promise<CalendarSyncResult> {
    const syncedAt = new Date().toISOString();

    try {
        // Normalize URL (webcal:// → https://)
        const normalizedUrl = normalizeCalendarUrl(url);

        // Fetch the iCal data
        const response = await fetch(normalizedUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch calendar: ${response.statusText}`);
        }

        const icalData = await response.text();

        // Parse iCal data
        const events = parseICalData(icalData, normalizedUrl);

        return {
            success: true,
            events,
            syncedAt,
        };
    } catch (error: any) {
        return {
            success: false,
            events: [],
            error: error.message || 'Failed to fetch calendar',
            syncedAt,
        };
    }
}

/**
 * Parse iCal data into CalendarEvent array
 */
export function parseICalData(icalData: string, sourceUrl?: string): CalendarEvent[] {
    try {
        const jcalData = ICAL.parse(icalData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        const events: CalendarEvent[] = [];
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        for (const vevent of vevents) {
            const event = new ICAL.Event(vevent);

            // Only include events in the next 7 days
            const startDate = event.startDate.toJSDate();
            if (startDate < now || startDate > sevenDaysFromNow) {
                continue;
            }

            const endDate = event.endDate.toJSDate();

            // Extract calendar name from URL or use default
            let calendarName = 'External Calendar';
            if (sourceUrl) {
                // Try to extract calendar name from URL
                const match = sourceUrl.match(/\/([^\/]+)\.ics$/);
                if (match) {
                    calendarName = match[1].replace(/_/g, ' ');
                }
            }

            const calendarEvent: CalendarEvent = {
                id: crypto.randomUUID(),
                userId: '', // Will be set when saving to DB
                title: event.summary || 'Untitled Event',
                description: event.description || undefined,
                location: event.location || undefined,
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                isAllDay: event.startDate.isDate,
                source: 'ical',
                externalId: event.uid,
                calendarName,
                createdAt: new Date().toISOString(),
            };

            events.push(calendarEvent);
        }

        return events;
    } catch (error) {
        console.error('Failed to parse iCal data:', error);
        return [];
    }
}

/**
 * Calculate travel time buffer based on location
 * Simple heuristic - can be enhanced with actual distance calculations
 */
export function estimateTravelTime(fromLocation?: string, toLocation?: string): number {
    if (!toLocation) return 0;
    if (!fromLocation) return 15; // Default 15 min buffer if no starting location

    // Simple heuristic based on keywords
    const locationLower = toLocation.toLowerCase();

    if (locationLower.includes('home') || locationLower.includes('house')) {
        return 0; // Already at home
    }

    if (locationLower.includes('nearby') || locationLower.includes('local')) {
        return 10; // 10 min for local
    }

    if (locationLower.includes('office') || locationLower.includes('work')) {
        return 20; // 20 min for office
    }

    if (locationLower.includes('airport') || locationLower.includes('station')) {
        return 30; // 30 min for major transit hubs
    }

    // Default buffer
    return 15;
}

/**
 * Merge calendar events with travel time buffers
 */
export function addTravelTimeBuffers(
    events: CalendarEvent[],
    currentLocation?: string
): CalendarEvent[] {
    return events.map(event => {
        const travelTime = estimateTravelTime(currentLocation, event.location);

        return {
            ...event,
            travelTimeMinutes: travelTime > 0 ? travelTime : undefined,
            travelFromLocation: currentLocation,
        };
    });
}

/**
 * Filter events for a specific date
 */
export function filterEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return events.filter(event => {
        const eventStart = new Date(event.startTime);
        return eventStart >= targetDate && eventStart < nextDay;
    });
}

/**
 * Sort events chronologically
 */
export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
    return [...events].sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
}

/**
 * Save calendar events to database
 * Replaces existing events from the same source
 */
export async function saveCalendarEventsToDatabase(
    userId: string,
    events: CalendarEvent[],
    source: string = 'ical'
): Promise<{ success: boolean; error?: string; savedCount: number }> {
    try {
        // Delete existing events from this source (to avoid duplicates)
        const { error: deleteError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('user_id', userId)
            .eq('source', source);

        if (deleteError) {
            console.error('Failed to delete old calendar events:', deleteError);
            return {
                success: false,
                error: deleteError.message,
                savedCount: 0,
            };
        }

        // Insert new events
        if (events.length > 0) {
            const eventsToInsert = events.map(event => ({
                ...event,
                user_id: userId,
                userId: undefined, // Remove camelCase field
            }));

            const { error: insertError, count } = await supabase
                .from('calendar_events')
                .insert(eventsToInsert);

            if (insertError) {
                console.error('Failed to insert calendar events:', insertError);
                return {
                    success: false,
                    error: insertError.message,
                    savedCount: 0,
                };
            }

            return {
                success: true,
                savedCount: events.length,
            };
        }

        return {
            success: true,
            savedCount: 0,
        };
    } catch (error: any) {
        console.error('Error saving calendar events to database:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
            savedCount: 0,
        };
    }
}
