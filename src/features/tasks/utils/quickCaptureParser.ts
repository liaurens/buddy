/**
 * Quick Capture Parser
 *
 * Takes free-form text like "email mom tomorrow 2pm !" and pulls out a
 * task draft: title (cleaned), task type, due date/time, priority, energy.
 * Deterministic — no AI.
 */

import type { Task, TaskType, TaskEnergy, TaskKind } from '../types';

export interface ParsedDraft {
    title: string;
    taskTypeId?: string;
    dueDate?: string;        // YYYY-MM-DD
    dueTime?: string;        // HH:MM
    priority?: Task['priority'];
    energy?: TaskEnergy;
    kind?: TaskKind;         // explicit kind detected from text (e.g. "!!!" → urgent, "someday" → backlog)
}

// Keyword → preset task type NAME. Hits matched against the name on the user's
// task_types row, so renaming the preset still works as long as the name stays.
const TYPE_KEYWORDS: Record<string, string[]> = {
    Email:   ['email', 'reply', 'inbox', 'mail', 'send', 'forward'],
    Home:    ['clean', 'laundry', 'dishes', 'room', 'vacuum', 'tidy', 'wash', 'kitchen', 'bathroom', 'trash', 'fold'],
    Study:   ['read', 'study', 'chapter', 'homework', 'assignment', 'essay', 'paper', 'review', 'flashcard', 'notes'],
    Errands: ['buy', 'pickup', 'pick up', 'shop', 'pharmacy', 'groceries', 'grocery', 'store', 'return'],
    Admin:   ['call', 'appt', 'appointment', 'form', 'pay', 'bill', 'schedule', 'book', 'submit', 'sign'],
    Health:  ['gym', 'workout', 'walk', 'run', 'stretch', 'meditate', 'yoga', 'sleep', 'water'],
    Work:    ['meeting', 'deck', 'report', 'presentation', 'standup', 'sync', 'review pr', 'deploy'],
};

const WEEKDAY_INDEX: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

function toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function nextWeekday(from: Date, targetDow: number): Date {
    const d = new Date(from);
    const diff = ((targetDow - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
}

/** Parse a 12h or 24h time like "2pm", "2:30pm", "14:00" → "HH:MM" */
function parseTime(raw: string): string | undefined {
    const m12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (m12) {
        let h = parseInt(m12[1], 10);
        const min = m12[2] ? parseInt(m12[2], 10) : 0;
        const ap = m12[3].toLowerCase();
        if (h === 12) h = 0;
        if (ap === 'pm') h += 12;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    const m24 = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
        const h = parseInt(m24[1], 10);
        const min = parseInt(m24[2], 10);
        if (h < 24 && min < 60) return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    return undefined;
}

export function parseQuickCapture(input: string, types: TaskType[], now: Date = new Date()): ParsedDraft {
    let text = input.trim();
    if (!text) return { title: '' };

    let priority: Task['priority'] | undefined;
    let energy: TaskEnergy | undefined;
    let dueDate: string | undefined;
    let dueTime: string | undefined;
    let taskTypeId: string | undefined;
    let kind: TaskKind | undefined;

    // Priority: leading !!! (urgent kind), !! (urgent), or ! (high)
    const prMatch = text.match(/^(!!!|!!|!)\s+/);
    if (prMatch) {
        if (prMatch[1] === '!!!') { priority = 'urgent'; kind = 'urgent'; }
        else if (prMatch[1] === '!!') priority = 'urgent';
        else priority = 'high';
        text = text.slice(prMatch[0].length);
    }

    // Kind keyword: "someday"/"backlog" → backlog (no-pressure list)
    const kindMatch = text.match(/\b(someday|backlog)\b[:\s]*/i);
    if (kindMatch) {
        kind = 'backlog';
        text = text.replace(kindMatch[0], ' ');
    }

    // Energy prefix
    const enMatch = text.match(/\b(low|medium|med|high)\s+energy\b[:\s]*/i);
    if (enMatch) {
        const e = enMatch[1].toLowerCase();
        energy = e === 'med' ? 'medium' : (e as TaskEnergy);
        text = text.replace(enMatch[0], ' ');
    }

    // Explicit time: "at 2pm" / "@ 14:00" / standalone "2pm"
    const timeRe = /\b(?:at\s+|@\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i;
    const tMatch = text.match(timeRe);
    if (tMatch) {
        const t = parseTime(tMatch[1].trim());
        if (t) {
            dueTime = t;
            text = text.replace(tMatch[0], ' ');
        }
    }

    // Date phrases
    const lower = text.toLowerCase();
    if (/\btoday\b/.test(lower)) {
        dueDate = toIsoDate(now);
        text = text.replace(/\btoday\b/i, ' ');
    } else if (/\btonight\b/.test(lower)) {
        dueDate = toIsoDate(now);
        if (!dueTime) dueTime = '20:00';
        text = text.replace(/\btonight\b/i, ' ');
    } else if (/\btomorrow\b/.test(lower)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        dueDate = toIsoDate(d);
        text = text.replace(/\btomorrow\b/i, ' ');
    } else if (/\bnext\s+week\b/.test(lower)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        dueDate = toIsoDate(d);
        text = text.replace(/\bnext\s+week\b/i, ' ');
    } else {
        const inMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
        if (inMatch) {
            const d = new Date(now);
            d.setDate(d.getDate() + parseInt(inMatch[1], 10));
            dueDate = toIsoDate(d);
            text = text.replace(new RegExp(inMatch[0], 'i'), ' ');
        } else {
            for (const [name, dow] of Object.entries(WEEKDAY_INDEX)) {
                const re = new RegExp(`\\b${name}\\b`, 'i');
                if (re.test(lower)) {
                    dueDate = toIsoDate(nextWeekday(now, dow));
                    text = text.replace(re, ' ');
                    break;
                }
            }
        }
    }

    // Type detection — first match wins. Match against the user's actual
    // type names so renamed presets still resolve.
    const titleLower = text.toLowerCase();
    for (const [presetName, words] of Object.entries(TYPE_KEYWORDS)) {
        if (words.some(w => new RegExp(`\\b${w}\\b`, 'i').test(titleLower))) {
            const match = types.find(t => t.name.toLowerCase() === presetName.toLowerCase());
            if (match) {
                taskTypeId = match.id;
                break;
            }
        }
    }

    const title = text.replace(/\s+/g, ' ').trim();
    return { title, taskTypeId, dueDate, dueTime, priority, energy, kind };
}
