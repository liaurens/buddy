/**
 * State-driven whale speech-bubble copy for the Now screen.
 * Sentences stay short, warm, never guilt-inducing (per the Cove spec).
 */

export interface WhaleCopy {
    greeting: string;
    status: string;
}

/** Longest email-derived name that still reads as a name, not an address. */
const MAX_NAME_LENGTH = 12;

/**
 * A first name guessed from an email, or undefined when the guess would read
 * badly. "sam.jones@…" → "Sam"; "laureensdekkers44@…" is too long → nameless
 * greeting. The app stores no profile name, so a careful guess with a graceful
 * fallback beats greeting people with their full inbox handle.
 */
export function displayNameFromEmail(email?: string | null): string | undefined {
    if (!email) return undefined;
    const local = email.split('@')[0] ?? '';
    const first = (local.split(/[._+-]/)[0] ?? '').replace(/\d+$/, '');
    if (!/^[a-zA-Z]+$/.test(first) || first.length > MAX_NAME_LENGTH) return undefined;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function whaleGreeting(hour: number, name?: string): string {
    const suffix = name ? `, ${name}` : '';
    if (hour < 11) return `Morning${suffix}!`;
    if (hour < 17) return `Hey${suffix}!`;
    return `Evening${suffix}!`;
}

export function whaleStatus(doneCount: number, totalCount: number, survival: boolean): string {
    if (totalCount === 0) {
        return 'Nothing planned yet — tell me anything, or grab a pick from Tasks.';
    }
    if (doneCount >= totalCount) {
        return 'Everything done. I’m so proud of you!';
    }
    if (doneCount > 0) {
        return `${doneCount} down, ${totalCount - doneCount} to go. No rush.`;
    }
    return survival ? 'Just one small thing today. Ready?' : 'One small thing at a time. Ready?';
}

export function whaleCopy(
    doneCount: number,
    totalCount: number,
    hour: number,
    survival: boolean,
    name?: string,
): WhaleCopy {
    return {
        greeting: whaleGreeting(hour, name),
        status: whaleStatus(doneCount, totalCount, survival),
    };
}
