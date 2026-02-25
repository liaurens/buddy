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

/**
 * Validates calendar URLs to prevent SSRF attacks
 * @throws {Error} if URL is invalid or potentially malicious
 */
function validateCalendarUrl(url: string): void {
    try {
        const parsed = new URL(url);

        // Only allow HTTPS (except localhost for development)
        if (parsed.protocol !== 'https:' &&
            parsed.protocol !== 'webcal:' &&
            parsed.protocol !== 'http:' &&
            parsed.hostname !== 'localhost') {
            throw new Error('Only HTTPS and webcal URLs are allowed');
        }

        // Blacklist internal IP ranges to prevent SSRF
        const internalIpPatterns = [
            /^127\./,           // Loopback
            /^10\./,            // Private network
            /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private network
            /^192\.168\./,      // Private network
            /^169\.254\./,      // Link-local
            /^::1$/,            // IPv6 loopback
            /^fc00:/,           // IPv6 private
            /^fe80:/,           // IPv6 link-local
            /^localhost$/i,     // Localhost (block in production)
        ];

        // Block internal IPs in production
        if (import.meta.env.PROD) {
            if (internalIpPatterns.some(pattern => pattern.test(parsed.hostname))) {
                throw new Error('Internal URLs are not allowed');
            }
        }

        // Whitelist known calendar providers for security
        const allowedDomains = [
            'calendar.google.com',
            'outlook.office365.com',
            'outlook.live.com',
            'caldav.icloud.com',
            'ical.me',
            'p.ical.me',
            'calendar.yahoo.com',
            'calendar.proton.me',
            'calendly.com',
        ];

        const isAllowedDomain = allowedDomains.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
        );

        if (!isAllowedDomain && import.meta.env.PROD) {
            // In production, warn about untrusted domains but allow for flexibility
            console.warn(`[Security] Calendar URL from untrusted domain: ${parsed.hostname}`);
            // You can make this stricter by throwing an error instead of warning
        }

    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Invalid URL format');
        }
        throw error;
    }
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
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
    } catch (error: unknown) {
        if (proxyIndex < CORS_PROXIES.length - 1) {
            return fetchViaCorsProxy(url, proxyIndex + 1);
        }
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function fetchICalFeed(url: string): Promise<CalendarSyncResult> {
    const syncedAt = new Date().toISOString();

    // Validate URL to prevent SSRF attacks
    try {
        validateCalendarUrl(url);
    } catch (error) {
        return {
            success: false,
            events: [],
            error: error instanceof Error ? error.message : 'Invalid calendar URL',
            syncedAt,
        };
    }

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
