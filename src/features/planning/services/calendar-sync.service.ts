/**
 * Calendar Sync Service
 * Fetches iCal via the calendar-proxy edge function, parses it, and upserts
 * events into the calendar_events table.
 */

import { supabase } from '../../../services/supabase';
import { getCategorySettings, updateCategorySettings } from '../../../services/settings';

interface ParsedEvent {
    externalId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: string; // ISO
    endTime: string; // ISO
    isAllDay: boolean;
}

/**
 * Parse a single iCal DTSTART/DTEND line to ISO datetime.
 * Handles:
 *   20260201T090000Z                (UTC)
 *   20260201T090000                 (floating, treat as local)
 *   20260201                        (all-day date-only)
 *   TZID=Europe/Amsterdam:20260201T090000  (timezone-aware; we treat as local)
 */
function parseIcalDateTime(value: string): { iso: string; isAllDay: boolean } {
    const v = value.trim();
    // Date-only (all-day)
    if (/^\d{8}$/.test(v)) {
        const y = v.slice(0, 4),
            m = v.slice(4, 6),
            d = v.slice(6, 8);
        const date = new Date(`${y}-${m}-${d}T00:00:00`);
        return { iso: date.toISOString(), isAllDay: true };
    }
    // Datetime, possibly with Z (UTC) or without (floating/local)
    const match = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!match) {
        // Fallback: try to let Date parse it
        const parsed = new Date(v);
        return {
            iso: isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
            isAllDay: false,
        };
    }
    const [, y, mo, d, h, mi, s, z] = match;
    if (z === 'Z') {
        return { iso: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString(), isAllDay: false };
    }
    // Floating: treat as local time
    return { iso: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).toISOString(), isAllDay: false };
}

/** Unfold iCal line continuations (RFC 5545: lines starting with whitespace continue the previous line). */
function unfoldIcal(raw: string): string {
    return raw.replace(/\r?\n[ \t]/g, '');
}

function unescapeIcalText(value: string): string {
    return value
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

function parseIcalEvents(icalText: string, includeAllDay: boolean): ParsedEvent[] {
    const unfolded = unfoldIcal(icalText);
    const events: ParsedEvent[] = [];
    const blocks = unfolded.split('BEGIN:VEVENT');

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i].split('END:VEVENT')[0];

        const getLine = (prop: string): string | null => {
            // Matches PROP or PROP;PARAMS: followed by value until newline
            const re = new RegExp(`^${prop}(?:;[^:\\n]*)?:(.+)$`, 'mi');
            const m = block.match(re);
            return m ? m[1].trim() : null;
        };
        const getLineRaw = (prop: string): { params: string; value: string } | null => {
            const re = new RegExp(`^${prop}((?:;[^:\\n]*)?):(.+)$`, 'mi');
            const m = block.match(re);
            return m ? { params: m[1], value: m[2].trim() } : null;
        };

        const uid = getLine('UID');
        const summary = getLine('SUMMARY');
        const description = getLine('DESCRIPTION');
        const location = getLine('LOCATION');
        const dtstartRaw = getLineRaw('DTSTART');
        const dtendRaw = getLineRaw('DTEND');

        if (!uid || !dtstartRaw) continue;

        const start = parseIcalDateTime(dtstartRaw.value);
        const end = dtendRaw
            ? parseIcalDateTime(dtendRaw.value)
            : {
                  iso: new Date(new Date(start.iso).getTime() + 60 * 60 * 1000).toISOString(),
                  isAllDay: start.isAllDay,
              };

        if (start.isAllDay && !includeAllDay) continue;

        events.push({
            externalId: uid,
            title: summary ? unescapeIcalText(summary) : '(no title)',
            description: description ? unescapeIcalText(description) : undefined,
            location: location ? unescapeIcalText(location) : undefined,
            startTime: start.iso,
            endTime: end.iso,
            isAllDay: start.isAllDay,
        });
    }

    return events;
}

export interface SyncResult {
    eventsFound: number;
    eventsUpserted: number;
    skipped: number;
    error?: string;
}

/**
 * Sync calendar events from the user's configured iCal URL.
 * Returns counts + any error for UI feedback.
 */
export async function syncCalendar(userId: string): Promise<SyncResult> {
    const settings = await getCategorySettings(userId, 'calendar');
    if (!settings.calendarUrl) {
        return {
            eventsFound: 0,
            eventsUpserted: 0,
            skipped: 0,
            error: 'No calendar URL configured',
        };
    }

    // Call the edge function proxy
    const { data, error } = await supabase.functions.invoke('calendar-proxy', {
        body: { url: settings.calendarUrl },
    });

    if (error) {
        return {
            eventsFound: 0,
            eventsUpserted: 0,
            skipped: 0,
            error: `Proxy failed: ${error.message}`,
        };
    }

    // Proxy can return either text/calendar or JSON with { ical: "..." } or { error: "..." }
    let icalText: string | null = null;
    if (typeof data === 'string') {
        icalText = data;
    } else if (data && typeof data === 'object') {
        if ('error' in data)
            return { eventsFound: 0, eventsUpserted: 0, skipped: 0, error: String(data.error) };
        if ('ical' in data && typeof data.ical === 'string') icalText = data.ical;
        if ('data' in data && typeof data.data === 'string') icalText = data.data;
    }
    if (!icalText) {
        return {
            eventsFound: 0,
            eventsUpserted: 0,
            skipped: 0,
            error: 'Proxy returned no iCal data',
        };
    }

    const parsed = parseIcalEvents(icalText, settings.includeAllDayEvents);

    // Filter by min event duration (0 = keep all)
    const minDurationMs = (settings.minEventDurationMinutes ?? 0) * 60 * 1000;
    const filtered = parsed.filter((e) => {
        if (e.isAllDay) return true;
        const durationMs = new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
        return durationMs >= minDurationMs;
    });

    if (filtered.length === 0) {
        await updateCategorySettings(userId, 'calendar', {
            lastSyncTime: new Date().toISOString(),
        });
        return { eventsFound: parsed.length, eventsUpserted: 0, skipped: parsed.length };
    }

    const rows = filtered.map((e) => ({
        user_id: userId,
        title: e.title,
        description: e.description ?? null,
        location: e.location ?? null,
        start_time: e.startTime,
        end_time: e.endTime,
        is_all_day: e.isAllDay,
        source: 'ical',
        external_id: e.externalId,
        calendar_name: settings.calendarName ?? null,
        synced_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(rows, { onConflict: 'user_id,external_id' });

    if (upsertError) {
        return {
            eventsFound: parsed.length,
            eventsUpserted: 0,
            skipped: 0,
            error: `Upsert failed: ${upsertError.message}`,
        };
    }

    await updateCategorySettings(userId, 'calendar', { lastSyncTime: new Date().toISOString() });

    return {
        eventsFound: parsed.length,
        eventsUpserted: rows.length,
        skipped: parsed.length - filtered.length,
    };
}

/**
 * Sync if stale (last sync > maxAgeMinutes). Used for background/auto-sync on app open.
 */
export async function syncCalendarIfStale(
    userId: string,
    maxAgeMinutes = 60,
): Promise<SyncResult | null> {
    const settings = await getCategorySettings(userId, 'calendar');
    if (!settings.calendarUrl) return null;
    if (settings.lastSyncTime) {
        const ageMs = Date.now() - new Date(settings.lastSyncTime).getTime();
        if (ageMs < maxAgeMinutes * 60 * 1000) return null;
    }
    return syncCalendar(userId);
}
