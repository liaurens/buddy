import { describe, it, expect } from 'vitest';
import { addDays, format } from 'date-fns';
import { deriveTaskKind, kindSignalPatch, DEADLINE_HORIZON_DAYS } from './taskKind';
import type { Task } from '../types';

const base: Pick<Task, 'kind' | 'recurrence' | 'priority' | 'dueDate' | 'reminderEnabled' | 'reminderAt'> = {
    recurrence: 'none',
};

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

describe('deriveTaskKind', () => {
    it('honors an explicit kind over derived signals', () => {
        expect(deriveTaskKind({ ...base, kind: 'backlog', priority: 'urgent' })).toBe('backlog');
    });

    it('classifies recurring tasks as routine', () => {
        expect(deriveTaskKind({ ...base, recurrence: 'weekly' })).toBe('routine');
    });

    it('routine wins over urgent priority', () => {
        expect(deriveTaskKind({ ...base, recurrence: 'daily', priority: 'urgent' })).toBe('routine');
    });

    it('classifies urgent priority as urgent', () => {
        expect(deriveTaskKind({ ...base, priority: 'urgent' })).toBe('urgent');
    });

    it('classifies a far-out due date with a reminder as deadline', () => {
        const dueDate = iso(addDays(new Date(), DEADLINE_HORIZON_DAYS + 5));
        expect(deriveTaskKind({ ...base, dueDate, reminderEnabled: true })).toBe('deadline');
    });

    it('classifies a far-out due date WITHOUT a reminder as standard', () => {
        const dueDate = iso(addDays(new Date(), DEADLINE_HORIZON_DAYS + 5));
        expect(deriveTaskKind({ ...base, dueDate })).toBe('standard');
    });

    it('classifies a near due date as standard', () => {
        const dueDate = iso(addDays(new Date(), 1));
        expect(deriveTaskKind({ ...base, dueDate, reminderEnabled: true })).toBe('standard');
    });

    it('classifies a task with no due date as backlog', () => {
        expect(deriveTaskKind({ ...base })).toBe('backlog');
    });

    it('is timezone-safe: horizon boundary holds with an injected late-night clock', () => {
        // Late-night "today": a UTC-midnight parse would push the due date a day
        // off and flip deadline/standard at the horizon boundary.
        const today = new Date(2026, 6, 4, 23, 30);
        const dueDate = format(addDays(today, DEADLINE_HORIZON_DAYS), 'yyyy-MM-dd');
        expect(deriveTaskKind({ ...base, dueDate, reminderEnabled: true }, today)).toBe('deadline');
        const nearDate = format(addDays(today, DEADLINE_HORIZON_DAYS - 1), 'yyyy-MM-dd');
        expect(deriveTaskKind({ ...base, dueDate: nearDate, reminderEnabled: true }, today)).toBe('standard');
    });
});

describe('kindSignalPatch', () => {
    it('seeds urgent priority for the urgent kind', () => {
        expect(kindSignalPatch('urgent')).toEqual({ kind: 'urgent', priority: 'urgent' });
    });

    it('returns just the kind for non-urgent kinds', () => {
        expect(kindSignalPatch('deadline')).toEqual({ kind: 'deadline' });
        expect(kindSignalPatch('backlog')).toEqual({ kind: 'backlog' });
    });
});
