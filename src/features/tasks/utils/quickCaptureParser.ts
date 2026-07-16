/**
 * Quick Capture Parser
 *
 * Takes free-form text like "email mom tomorrow 2pm !" and pulls out a
 * task draft: title (cleaned), task type, due date/time, priority, energy.
 * Deterministic — no AI.
 */

import type {
    Task,
    TaskType,
    TaskEnergy,
    TaskKind,
    TaskFlag,
    RecurrencePattern,
    TriageSource,
} from '../types';

export interface ParsedDraft {
    title: string;
    taskTypeId?: string;
    dueDate?: string; // YYYY-MM-DD; real deadline only
    plannedFor?: string; // YYYY-MM-DD; day it appears in the plan
    dueTime?: string; // HH:MM
    priority?: Task['priority'];
    energy?: TaskEnergy;
    kind?: TaskKind; // explicit kind detected from text (e.g. "!!!" → urgent, "someday" → backlog)
    waitingOn?: string;
    startDate?: string;
    notes?: string;
    flag?: TaskFlag;
    recurrence?: RecurrencePattern;
    triageSource?: TriageSource;
    /** More than one explicitly typed flag blocks capture. */
    conflictingFlags?: TaskFlag[];
    errors?: string[];
}

// Keyword → preset task type NAME. Hits matched against the name on the user's
// task_types row, so renaming the preset still works as long as the name stays.
const TYPE_KEYWORDS: Record<string, string[]> = {
    Email: ['email', 'reply', 'inbox', 'mail', 'send', 'forward', 'respond', 'mailen'],
    Home: [
        'clean',
        'laundry',
        'dishes',
        'room',
        'vacuum',
        'tidy',
        'wash',
        'kitchen',
        'bathroom',
        'trash',
        'fold',
        'repair',
        'opruimen',
        'stofzuigen',
        'afwas',
    ],
    Study: [
        'read',
        'study',
        'chapter',
        'homework',
        'assignment',
        'essay',
        'paper',
        'review',
        'flashcard',
        'notes',
        'exam',
        'lecture',
        'tentamen',
        'toets',
        'huiswerk',
        'leren',
        'samenvatting',
        'college',
    ],
    Errands: [
        'buy',
        'pickup',
        'pick up',
        'shop',
        'pharmacy',
        'groceries',
        'grocery',
        'store',
        'return',
        'boodschappen',
        'kopen',
        'ophalen',
        'supermarkt',
        'apotheek',
    ],
    Admin: [
        'call',
        'appt',
        'appointment',
        'form',
        'pay',
        'bill',
        'schedule',
        'book',
        'submit',
        'sign',
        'renew',
        'cancel',
        'bellen',
        'afspraak',
        'betalen',
        'rekening',
        'formulier',
        'verzekering',
        'opzeggen',
    ],
    Health: [
        'gym',
        'workout',
        'walk',
        'run',
        'stretch',
        'meditate',
        'yoga',
        'sleep',
        'water',
        'sporten',
        'hardlopen',
        'wandelen',
        'dokter',
        'tandarts',
        'huisarts',
        'medicijn',
    ],
    Work: [
        'meeting',
        'deck',
        'report',
        'presentation',
        'standup',
        'sync',
        'review pr',
        'deploy',
        'shift',
        'dienst',
        'rooster',
        'stage',
        'sollicitatie',
    ],
};

const WEEKDAY_INDEX: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tue: 2,
    tues: 2,
    wed: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    fri: 5,
    sat: 6,
    zondag: 0,
    maandag: 1,
    dinsdag: 2,
    woensdag: 3,
    donderdag: 4,
    vrijdag: 5,
    zaterdag: 6,
};

const FLAG_ALIASES: Record<string, TaskFlag> = {
    urgent: 'urgent',
    dringend: 'urgent',
    today: 'today',
    vandaag: 'today',
    deadline: 'deadline',
    due: 'deadline',
    waiting: 'waiting',
    wachten: 'waiting',
    school: 'school',
    studie: 'school',
    routine: 'routine',
    someday: 'someday',
    ooit: 'someday',
};

function toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function nextWeekday(from: Date, targetDow: number): Date {
    const d = new Date(from);
    const diff = (targetDow - d.getDay() + 7) % 7 || 7;
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
        if (h < 24 && min < 60)
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    return undefined;
}

export function parseQuickCapture(
    input: string,
    types: TaskType[],
    now: Date = new Date(),
): ParsedDraft {
    let text = input.trim();
    if (!text) return { title: '' };

    let priority: Task['priority'] | undefined;
    let energy: TaskEnergy | undefined;
    let dueDate: string | undefined;
    let plannedFor: string | undefined;
    let dueTime: string | undefined;
    let taskTypeId: string | undefined;
    let kind: TaskKind | undefined;
    let flag: TaskFlag | undefined;
    let recurrence: RecurrencePattern | undefined;
    let waitingOn: string | undefined;
    const errors: string[] = [];

    // Explicit typed flags. Keep ordinary #labels untouched; only curated aliases
    // are workflow flags. Multiple different flags are a hard validation error.
    const typedFlags: TaskFlag[] = [];
    text = text.replace(/#([\p{L}]+)/giu, (whole, raw: string) => {
        const parsed = FLAG_ALIASES[raw.toLowerCase()];
        if (!parsed) return whole;
        typedFlags.push(parsed);
        return ' ';
    });
    const uniqueFlags = [...new Set(typedFlags)];
    if (uniqueFlags.length === 1) flag = uniqueFlags[0];
    if (uniqueFlags.length > 1) {
        errors.push(`Choose one task flag: ${uniqueFlags.join(', ')}.`);
    }

    // Priority: leading !!! (urgent kind), !! (urgent), or ! (high)
    const prMatch = text.match(/^(!!!|!!|!)\s+/);
    if (prMatch) {
        if (prMatch[1] === '!!!') {
            priority = 'urgent';
            kind = 'urgent';
            if (!flag) flag = 'urgent';
        } else if (prMatch[1] === '!!') priority = 'urgent';
        else priority = 'high';
        text = text.slice(prMatch[0].length);
    }

    // Kind keyword: "someday"/"backlog" → backlog (no-pressure list)
    const kindMatch = text.match(/\b(someday|backlog)\b[:\s]*/i);
    if (kindMatch) {
        kind = 'backlog';
        if (!flag) flag = 'someday';
        text = text.replace(kindMatch[0], ' ');
    }

    // Obvious recurrence phrases. A typed routine without a cadence remains
    // incomplete so the UI can ask for confirmation (manual confirmation defaults daily).
    const recurrencePhrases: Array<[RegExp, RecurrencePattern]> = [
        [/\b(every day|daily|dagelijks|elke dag)\b/i, 'daily'],
        [/\b(every weekday|weekdays|werkdagen|elke werkdag)\b/i, 'weekdays'],
        [/\b(every week|weekly|wekelijks|elke week)\b/i, 'weekly'],
        [/\b(every month|monthly|maandelijks|elke maand)\b/i, 'monthly'],
    ];
    for (const [pattern, value] of recurrencePhrases) {
        if (pattern.test(text)) {
            recurrence = value;
            flag ??= 'routine';
            text = text.replace(pattern, ' ');
            break;
        }
    }

    const waitingMatch = text.match(
        /\b(?:waiting (?:on|for)|wacht(?:en)? op)\s+([^,;]+?)(?=\s+(?:by|due|on|today|tomorrow|vandaag|morgen)\b|$)/i,
    );
    if (waitingMatch) {
        waitingOn = waitingMatch[1].trim();
        flag ??= 'waiting';
        text = text.replace(waitingMatch[0], ' ');
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

    // A deadline marker changes the meaning of the following date. Without it,
    // natural dates are planning days and never silently become deadlines.
    const deadlineMarker = /\b(?:due|deadline|uiterlijk|verval(?:t|datum)?)\s+(?:on\s+|op\s+)?/i;
    const hasDeadlineMarker = deadlineMarker.test(text);
    if (hasDeadlineMarker) {
        flag ??= 'deadline';
        text = text.replace(deadlineMarker, ' ');
    }

    // Date phrases (English and Dutch)
    const lower = text.toLowerCase();
    let parsedDate: string | undefined;
    if (/\b(today|vandaag)\b/.test(lower)) {
        parsedDate = toIsoDate(now);
        text = text.replace(/\b(today|vandaag)\b/i, ' ');
    } else if (/\b(tonight|vanavond)\b/.test(lower)) {
        parsedDate = toIsoDate(now);
        if (!dueTime) dueTime = '20:00';
        text = text.replace(/\b(tonight|vanavond)\b/i, ' ');
    } else if (/\b(tomorrow|morgen)\b/.test(lower)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        parsedDate = toIsoDate(d);
        text = text.replace(/\b(tomorrow|morgen)\b/i, ' ');
    } else if (/\b(next\s+week|volgende\s+week)\b/.test(lower)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        parsedDate = toIsoDate(d);
        text = text.replace(/\b(next\s+week|volgende\s+week)\b/i, ' ');
    } else {
        const inMatch = lower.match(/\b(?:in|over)\s+(\d+)\s+(?:days?|dagen)\b/);
        if (inMatch) {
            const d = new Date(now);
            d.setDate(d.getDate() + parseInt(inMatch[1], 10));
            parsedDate = toIsoDate(d);
            text = text.replace(new RegExp(inMatch[0], 'i'), ' ');
        } else {
            for (const [name, dow] of Object.entries(WEEKDAY_INDEX)) {
                const re = new RegExp(`\\b${name}\\b`, 'i');
                if (re.test(lower)) {
                    parsedDate = toIsoDate(nextWeekday(now, dow));
                    text = text.replace(re, ' ');
                    break;
                }
            }
        }
    }

    if (parsedDate) {
        if (hasDeadlineMarker || flag === 'deadline') dueDate = parsedDate;
        else {
            plannedFor = parsedDate;
            flag ??= 'today';
        }
    }

    // Explicit workflow flags own the field meaning even if another heuristic fired.
    if (flag === 'today') plannedFor ??= toIsoDate(now);
    if (flag === 'someday') plannedFor = undefined;
    if (flag === 'deadline' && !dueDate) {
        errors.push('A #deadline task needs a due date, for example “due Friday”.');
    }
    if (flag === 'waiting' && !waitingOn) {
        errors.push('A #waiting task needs who or what you are waiting on.');
    }
    if (flag === 'routine' && !recurrence) {
        errors.push('A #routine task needs a recurrence.');
    }

    // Type detection — first match wins. Match against the user's actual
    // type names so renamed presets still resolve.
    const titleLower = text.toLowerCase();
    for (const [presetName, words] of Object.entries(TYPE_KEYWORDS)) {
        if (words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(titleLower))) {
            const match = types.find((t) => t.name.toLowerCase() === presetName.toLowerCase());
            if (match) {
                taskTypeId = match.id;
                break;
            }
        }
    }

    const title = text.replace(/\s+/g, ' ').trim();
    return {
        title,
        taskTypeId,
        dueDate,
        plannedFor,
        dueTime,
        priority,
        energy,
        kind,
        flag,
        recurrence,
        waitingOn,
        triageSource: flag || parsedDate || recurrence ? 'parser' : undefined,
        conflictingFlags: uniqueFlags.length > 1 ? uniqueFlags : undefined,
        errors: errors.length ? errors : undefined,
    };
}
