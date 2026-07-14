/**
 * Date parser for Dutch + English natural language date expressions.
 * Returns an ISO date string (YYYY-MM-DD) or null if no date found.
 */
export function parseDateExpression(input: string): string | null {
    const now = new Date();
    const lower = input.toLowerCase();

    // Today
    if (/\b(today|vandaag|nu)\b/.test(lower)) {
        return toDateString(now);
    }

    // Tomorrow
    if (/\b(tomorrow|morgen)\b/.test(lower)) {
        return toDateString(addDays(now, 1));
    }

    // Day after tomorrow
    if (/\b(overmorgen|day after tomorrow)\b/.test(lower)) {
        return toDateString(addDays(now, 2));
    }

    // Next week
    if (/\b(volgende week|next week)\b/.test(lower)) {
        return toDateString(addDays(now, 7));
    }

    // Day names (Dutch + English)
    const dayMap: Record<string, number> = {
        monday: 1,
        maandag: 1,
        tuesday: 2,
        dinsdag: 2,
        wednesday: 3,
        woensdag: 3,
        thursday: 4,
        donderdag: 4,
        friday: 5,
        vrijdag: 5,
        saturday: 6,
        zaterdag: 6,
        sunday: 0,
        zondag: 0,
    };

    for (const [name, targetDay] of Object.entries(dayMap)) {
        if (lower.includes(name)) {
            const currentDay = now.getDay();
            let daysAhead = targetDay - currentDay;
            if (daysAhead <= 0) daysAhead += 7;
            return toDateString(addDays(now, daysAhead));
        }
    }

    // Time patterns: "om 14:00", "at 3pm", "at 15:00"
    const timeMatch = lower.match(/\b(?:om|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (timeMatch) {
        // Date is today if time is in the future, otherwise tomorrow
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2] || '0');
        const ampm = timeMatch[3];
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;

        const candidate = new Date(now);
        candidate.setHours(hour, minute, 0, 0);
        if (candidate <= now) {
            candidate.setDate(candidate.getDate() + 1);
        }
        return toDateString(candidate);
    }

    // Relative: "in X days/hours"
    const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDaysMatch) {
        return toDateString(addDays(now, parseInt(inDaysMatch[1])));
    }

    // Explicit date formats: "15 jan", "jan 15", "15-01", "01/15"
    const monthNames: Record<string, number> = {
        jan: 1,
        january: 1,
        januari: 1,
        feb: 2,
        february: 2,
        februari: 2,
        mar: 3,
        march: 3,
        maart: 3,
        apr: 4,
        april: 4,
        may: 5,
        mei: 5,
        jun: 6,
        june: 6,
        juni: 6,
        jul: 7,
        july: 7,
        juli: 7,
        aug: 8,
        august: 8,
        augustus: 8,
        sep: 9,
        september: 9,
        oct: 10,
        october: 10,
        oktober: 10,
        nov: 11,
        november: 11,
        dec: 12,
        december: 12,
    };

    for (const [name, month] of Object.entries(monthNames)) {
        const match = lower.match(
            new RegExp(`\\b(\\d{1,2})\\s+${name}\\b|\\b${name}\\s+(\\d{1,2})\\b`),
        );
        if (match) {
            const day = parseInt(match[1] || match[2]);
            const year = now.getFullYear();
            const date = new Date(year, month - 1, day);
            if (date < now) date.setFullYear(year + 1);
            return toDateString(date);
        }
    }

    return null;
}

/**
 * Parses a time expression for notification scheduling.
 * Returns { hours, minutes } or null.
 */
export function parseTimeExpression(input: string): { hours: number; minutes: number } | null {
    const lower = input.toLowerCase();

    // "om 14:00", "at 3:30pm", "at 15:00"
    const timeMatch = lower.match(/(?:om|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');
        const ampm = timeMatch[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        return { hours, minutes };
    }

    // "over 2 uur", "in 2 hours"
    const inHoursMatch = lower.match(/(?:over|in)\s+(\d+)\s+(?:uur|hours?|hr)/);
    if (inHoursMatch) {
        const now = new Date();
        now.setHours(now.getHours() + parseInt(inHoursMatch[1]));
        return { hours: now.getHours(), minutes: now.getMinutes() };
    }

    // "over 30 minuten", "in 30 minutes"
    const inMinutesMatch = lower.match(/(?:over|in)\s+(\d+)\s+(?:minuten|minutes?|min)/);
    if (inMinutesMatch) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + parseInt(inMinutesMatch[1]));
        return { hours: now.getHours(), minutes: now.getMinutes() };
    }

    return null;
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
}
