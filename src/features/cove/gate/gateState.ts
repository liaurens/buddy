/**
 * Pure gate logic: when the gate blocks the app, and its time-aware copy.
 */

import type { CheckinStatus } from '../services/checkin.service';

export function isGateNeeded(status: CheckinStatus | null | undefined): boolean {
    return status !== 'done' && status !== 'skipped';
}

export function gateGreeting(hour: number, name?: string): string {
    const suffix = name ? `, ${name}` : '';
    if (hour < 11) return `Good morning${suffix}!`;
    if (hour < 17) return `Hi${suffix} — starting fresh.`;
    return `Evening${suffix} — better late than never.`;
}

export function gateSubline(hour: number): string {
    return hour >= 12
        ? 'The check-in still comes first — it only takes a minute.'
        : 'Three tiny steps, then the day is yours.';
}
