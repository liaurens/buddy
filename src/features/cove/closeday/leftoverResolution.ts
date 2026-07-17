/**
 * Close-day leftover resolution — pure descriptors and copy.
 * Nothing carries over silently: every unfinished pick gets an explicit
 * decision (→ tomorrow / done-but-follow-up / rename / let it go).
 */

export type LeftoverAction = 'tomorrow' | 'rename' | 'followUp' | 'letGo';

export interface LeftoverResolution {
    taskId: string;
    action: LeftoverAction;
    /** Rename: the new title. Follow-up: the follow-up task title. */
    text?: string;
}

/**
 * Validates input for an action. Returns null when required text is missing
 * (rename needs a title; follow-up needs the follow-up task).
 */
export function buildLeftoverResolution(
    taskId: string,
    action: LeftoverAction,
    text?: string,
): LeftoverResolution | null {
    const trimmed = text?.trim() ?? '';
    if ((action === 'rename' || action === 'followUp') && trimmed.length === 0) {
        return null;
    }
    return {
        taskId,
        action,
        ...(trimmed ? { text: trimmed } : {}),
    };
}

export interface ResolutionCounts {
    moved: number;
    followUps: number;
    letGo: number;
}

export const EMPTY_COUNTS: ResolutionCounts = { moved: 0, followUps: 0, letGo: 0 };

export function addResolution(counts: ResolutionCounts, action: LeftoverAction): ResolutionCounts {
    return {
        moved: counts.moved + (action === 'tomorrow' || action === 'rename' ? 1 : 0),
        followUps: counts.followUps + (action === 'followUp' ? 1 : 0),
        letGo: counts.letGo + (action === 'letGo' ? 1 : 0),
    };
}

/** "1 moved to tomorrow · 1 follow-up saved · 1 let go" — empty string when nothing resolved. */
export function summarizeResolutions(counts: ResolutionCounts): string {
    return [
        counts.moved ? `${counts.moved} moved to tomorrow` : null,
        counts.followUps ? `${counts.followUps} follow-up saved` : null,
        counts.letGo ? `${counts.letGo} let go` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

export function leftoverIntro(count: number): string {
    return count === 1
        ? '1 task didn’t happen today — that’s okay.'
        : `${count} tasks didn’t happen today — that’s okay.`;
}
