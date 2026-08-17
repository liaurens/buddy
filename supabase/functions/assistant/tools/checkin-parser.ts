/**
 * Free-text parser for health check-ins ("7 hours of sleep", "mood 8").
 *
 * Deliberately dependency-free — no Deno remote imports — so the app's
 * `tsc -b` can compile it and the Vitest suite in
 * `src/features/assistant/tests/tracker-checkin-parser.test.ts` can import the
 * real implementation instead of a mirrored copy that drifts.
 */

export interface CheckinValues {
    [metric: string]: number;
}

export const metricAliases: Record<string, string> = {
    mood: 'mood',
    stemming: 'mood',
    gevoel: 'mood',
    energy: 'energy',
    energie: 'energy',
    sleep: 'sleep',
    slaap: 'sleep',
    focus: 'focus',
    concentratie: 'focus',
    stress: 'stress',
    pain: 'pain',
    pijn: 'pain',
    exercise: 'exercise',
    sport: 'exercise',
    caffeine: 'caffeine',
    koffie: 'caffeine',
    alcohol: 'alcohol',
    water: 'water',
    steps: 'steps',
    stappen: 'steps',
};

/** Words allowed to sit between a number and its metric ("7 hours of sleep"). */
const FILLER =
    /^(?:hours?|hrs?|uur|uren|minutes?|mins?|minuten|glasses?|glazen|cups?|kopjes?|mg|ml|of|van|op|a|an|the|de|het)$/;

/**
 * Pull `{metric: number}` pairs out of free text. Both orders occur in real
 * phrasing and both must work: "sleep 7" / "mood: 8" put the metric first,
 * while "7 hours of sleep" and "8 glasses of water" put the number first.
 * Only matching the metric-first order made the natural phrasing parse to `{}`,
 * which surfaced to the user as "No valid metrics found in check-in".
 */
export function parseCheckinValues(input: string): CheckinValues {
    const values: CheckinValues = {};
    const tokens = input.toLowerCase().match(/[a-zà-ÿ]+|\d+(?:[.,]\d+)?/g) ?? [];

    const numberAt = (i: number) => parseFloat(tokens[i].replace(',', '.'));
    const isNumber = (i: number) => i >= 0 && i < tokens.length && /^\d/.test(tokens[i]);

    for (let i = 0; i < tokens.length; i++) {
        const canonical = metricAliases[tokens[i]];
        if (!canonical) continue;

        // "sleep 7", "mood: 8" — the number directly follows the metric.
        if (isNumber(i + 1)) {
            values[canonical] = numberAt(i + 1);
            continue;
        }

        // "7 hours of sleep" — walk back over filler words to the number.
        let j = i - 1;
        while (j >= 0 && FILLER.test(tokens[j])) j--;
        if (isNumber(j)) {
            values[canonical] = numberAt(j);
        }
    }

    return values;
}
