/**
 * deadlineWorkday — when should work on a deadline actually start?
 *
 * Provenance: a hand-port of `suggestDeadlineWorkday` in
 * `src/features/tasks/utils/taskFlags.ts`. Edge functions cannot import from
 * `src/`, and the import path is the only reason this is a copy — if the rule
 * there changes, change it here too.
 *
 * Same rule as the client: back up one workday per started two hours of
 * estimated effort (minimum one), skipping weekends, and never suggest a day
 * that has already passed. `school-import` used to take a flat three UTC days
 * off the deadline, so an imported assignment landed on a different day than
 * the identical one typed into the app — and could land on a Sunday.
 *
 * All arithmetic is done at UTC noon on purpose: UTC has no DST, so adding and
 * subtracting whole days can never shift the calendar date. The server has no
 * access to the user's timezone, so "today" here is the UTC day.
 */

const MS_PER_DAY = 86_400_000;

/** Parse a plain `yyyy-MM-dd` at UTC noon — a stable anchor for day math. */
function parseDay(isoDate: string): Date {
    return new Date(`${isoDate}T12:00:00Z`);
}

function toIsoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
    const day = d.getUTCDay();
    return day === 0 || day === 6;
}

export function suggestDeadlineWorkday(
    dueDate: string,
    estimatedMinutes: number | null | undefined,
    now: Date,
): string {
    const workdaysNeeded = Math.max(1, Math.ceil((estimatedMinutes ?? 30) / 120));
    let candidate = parseDay(dueDate);
    let remaining = workdaysNeeded;
    while (remaining > 0) {
        candidate = new Date(candidate.getTime() - MS_PER_DAY);
        if (!isWeekend(candidate)) remaining -= 1;
    }
    const today = toIsoDay(now);
    const result = toIsoDay(candidate);
    return result < today ? today : result;
}
