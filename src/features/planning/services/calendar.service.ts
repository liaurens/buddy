/**
 * Calendar Service - iCal/CalDAV Integration
 *
 * Fetches and parses calendar events from external sources.
 * Uses Supabase Edge Function as primary fetch method,
 * falls back to CORS proxies if unavailable.
 */

import ICAL from 'ical.js';
import type { CalendarEvent } from '../../../types/planning';
import { supabase } from '../../../services/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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

function normalizeCalendarUrl(url: string): string {
    if (url.startsWith('webcal://')) {
        return url.replace('webcal://', 'https://');
    }
    if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
    }
    return url;
}

const CORS_PROXIES = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://proxy.cors.sh/${url}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function wrapWithCorsProxy(url: string, proxyIndex: number = 0): string {
    const proxy = CORS_PROXIES[proxyIndex] || CORS_PROXIES[0];
    return proxy(url);
}

async function fetchViaEdgeFunction(url: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/calendar-proxy`;
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify({ url }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            return { success: false, error: result.error || 'Edge function failed' };
        }

        return { success: true, data: result.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

async function fetchViaCorsProxy(url: string, proxyIndex: number = 0): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const normalizedUrl = normalizeCalendarUrl(url);
        const fetchUrl = wrapWithCorsProxy(normalizedUrl, proxyIndex);

        const response = await fetch(fetchUrl, {
            headers: { 'Accept': 'text/calendar, text/plain, */*' },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const icalData = await response.text();

        if (!icalData.includes('BEGIN:VCALENDAR')) {
            throw new Error('Invalid calendar data received');
        }

        return { success: true, data: icalData };
    } catch (error: any) {
        if (proxyIndex < CORS_PROXIES.length - 1) {
            return fetchViaCorsProxy(url, proxyIndex + 1);
        }
        return { success: false, error: error.message };
    }
}

export async function fetchICalFeed(url: string): Promise<CalendarSyncResult> {
    const syncedAt = new Date().toISOString();
    const normalizedUrl = normalizeCalendarUrl(url);

    let result = await fetchViaEdgeFunction(url);

    if (!result.success) {
        result = await fetchViaCorsProxy(url);
    }

    if (!result.success || !result.data) {
        return {
            success: false,
            events: [],
            error: result.error || 'Failed to fetch calendar',
            syncedAt,
        };
    }

    const events = parseICalData(result.data, normalizedUrl);

    return { success: true, events, syncedAt };
}

export function parseICalData(icalData: string, sourceUrl?: string): CalendarEvent[] {
    try {
        const jcalData = ICAL.parse(icalData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        const events: CalendarEvent[] = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

        for (const vevent of vevents) {
            const event = new ICAL.Event(vevent);
            const startDate = event.startDate.toJSDate();

            if (startDate < thirtyDaysAgo || startDate > ninetyDaysFromNow) {
                continue;
            }

            const endDate = event.endDate.toJSDate();

            let calendarName = 'External Calendar';
            if (sourceUrl) {
                const match = sourceUrl.match(/\/([^\/]+)\.ics$/);
                if (match) {
                    calendarName = match[1].replace(/_/g, ' ');
                }
            }

            events.push({
                id: crypto.randomUUID(),
                userId: '',
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
            });
        }

        return events;
    } catch (error) {
        console.error('Failed to parse iCal data:', error);
        return [];
    }
}

export function estimateTravelTime(fromLocation?: string, toLocation?: string): number {
    if (!toLocation) return 0;
    if (!fromLocation) return 15;

    const locationLower = toLocation.toLowerCase();

    if (locationLower.includes('home') || locationLower.includes('house')) return 0;
    if (locationLower.includes('nearby') || locationLower.includes('local')) return 10;
    if (locationLower.includes('office') || locationLower.includes('work')) return 20;
    if (locationLower.includes('airport') || locationLower.includes('station')) return 30;

    return 15;
}

export function addTravelTimeBuffers(events: CalendarEvent[], currentLocation?: string): CalendarEvent[] {
    return events.map(event => ({
        ...event,
        travelTimeMinutes: estimateTravelTime(currentLocation, event.location) || undefined,
        travelFromLocation: currentLocation,
    }));
}

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

export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
    return [...events].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
}

export async function saveCalendarEventsToDatabase(
    userId: string,
    events: CalendarEvent[],
    source: string = 'ical'
): Promise<{ success: boolean; error?: string; savedCount: number }> {
    try {
        if (events.length === 0) {
            return { success: true, savedCount: 0 };
        }

        await supabase
            .from('calendar_events')
            .delete()
            .eq('user_id', userId)
            .eq('source', source);

        const eventsToInsert = events.map(event => ({
            user_id: userId,
            title: event.title,
            description: event.description || null,
            location: event.location || null,
            start_time: event.startTime,
            end_time: event.endTime,
            is_all_day: event.isAllDay || false,
            travel_time_minutes: event.travelTimeMinutes || null,
            travel_from_location: event.travelFromLocation || null,
            source: source,
            external_id: event.externalId || null,
            calendar_name: event.calendarName || null,
            synced_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
            .from('calendar_events')
            .insert(eventsToInsert)
            .select();

        if (error) {
            return { success: false, error: error.message, savedCount: 0 };
        }

        return { success: true, savedCount: data?.length || 0 };
    } catch (error: any) {
        return { success: false, error: error.message, savedCount: 0 };
    }
}
