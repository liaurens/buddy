/**
 * Class-session time repair for the course importer.
 *
 * Deliberately dependency-free — no Deno remote imports — so `tsc -b` compiles
 * it and the Vitest suite can test the real implementation rather than a copy.
 *
 * Why this exists: the extractor is asked for 24-hour `HH:mm`, but course PDFs
 * are often laid out in 12-hour form ("1:30 – 4:00"). The model read those
 * digits literally and emitted `01:30`/`04:00`, which is a valid `HH:mm` string,
 * so `isTimeString` waved it through and `class_sessions.start_time` — a naive
 * `time without time zone` — stored a class at half past one in the morning. The
 * UI then rendered it faithfully, so nothing looked broken anywhere.
 *
 * Nobody teaches at 01:30. That makes the dropped-PM case recoverable rather
 * than ambiguous, and repairing it here (before the import preview) means the
 * corrected time is shown to the user for approval instead of written silently.
 */

/** Earliest hour a real class is assumed to start. Before this reads as dropped PM. */
const EARLIEST_PLAUSIBLE_MIN = 6 * 60; // 06:00
/** Latest end-of-day for a class. */
const LATEST_PLAUSIBLE_MIN = 23 * 60 + 59; // 23:59
/** Longest single session we'll accept; beyond this the pair is incoherent. */
const MAX_DURATION_MIN = 12 * 60;
const HALF_DAY_MIN = 12 * 60;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface RepairedSession {
    startTime: string;
    endTime: string;
    /** True when a dropped PM was inferred and corrected. */
    repaired: boolean;
}

export function parseHHMM(value: string): number | null {
    const match = HHMM.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

export function formatHHMM(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function plausible(start: number, end: number): boolean {
    return (
        start >= EARLIEST_PLAUSIBLE_MIN &&
        end > start &&
        end <= LATEST_PLAUSIBLE_MIN &&
        end - start <= MAX_DURATION_MIN
    );
}

/**
 * Normalise a session's start/end pair.
 *
 * Returns `null` when the pair can't be made sense of — matching the importer's
 * existing contract of omitting ambiguous items rather than guessing at them.
 */
export function repairSessionTimes(rawStart: string, rawEnd: string): RepairedSession | null {
    const start = parseHHMM(rawStart);
    const end = parseHHMM(rawEnd);
    if (start === null || end === null) return null;

    // Already sensible — leave it alone.
    if (plausible(start, end)) {
        return { startTime: rawStart, endTime: rawEnd, repaired: false };
    }

    // Whole session read as AM: "1:30 – 4:00" became 01:30–04:00.
    if (start < EARLIEST_PLAUSIBLE_MIN) {
        const s = start + HALF_DAY_MIN;
        const e = end + HALF_DAY_MIN;
        if (plausible(s, e)) {
            return { startTime: formatHHMM(s), endTime: formatHHMM(e), repaired: true };
        }
    }

    // Only the end lost its PM: "11:00 – 1:00" became 11:00–01:00, so the end
    // reads as earlier than the start.
    if (end <= start) {
        const e = end + HALF_DAY_MIN;
        if (plausible(start, e)) {
            return { startTime: rawStart, endTime: formatHHMM(e), repaired: true };
        }
    }

    return null;
}
