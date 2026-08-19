/**
 * navIntent — what a deep-link actually asks the app to do.
 *
 * Notification action buttons and anchor taps arrive as query params
 * (?route=…&intent=…&taskId=…&step=…). This is the one parser for them, so
 * the service worker's URLs and the app's handling can't quietly drift apart
 * — which is exactly what happened before: the params were parsed and then
 * handed to nothing, so "Mark done" on the lock screen did nothing.
 */

export type NavIntent =
    | { kind: 'complete'; taskId: string }
    | { kind: 'snooze'; taskId: string }
    | { kind: 'closeday' };

export function parseNavIntent(
    params: Record<string, unknown> | null | undefined,
): NavIntent | null {
    if (!params) return null;
    const intent = typeof params.intent === 'string' ? params.intent : null;
    const taskId =
        typeof params.taskId === 'string' && params.taskId.length > 0 ? params.taskId : null;

    if (intent === 'complete' && taskId) return { kind: 'complete', taskId };
    if (intent === 'snooze' && taskId) return { kind: 'snooze', taskId };
    if (intent === 'closeday') return { kind: 'closeday' };
    return null;
}
