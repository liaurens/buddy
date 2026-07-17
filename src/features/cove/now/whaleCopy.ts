/**
 * State-driven whale speech-bubble copy for the Now screen.
 * Sentences stay short, warm, never guilt-inducing (per the Cove spec).
 */

export interface WhaleCopy {
    greeting: string;
    status: string;
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
