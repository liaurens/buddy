import { describe, it, expect } from 'vitest';
import { format, addDays, subDays } from 'date-fns';
import { formatRowMeta } from './rowMeta';
import type { Task } from '../../tasks/types';

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: overrides.id || '1',
        title: overrides.title || 'Test task',
        completed: false,
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

// A Wednesday at local noon — weekday-name cases stay deterministic.
const today = new Date('2026-02-25T12:00:00');
const iso = (d: Date) => format(d, 'yyyy-MM-dd');

describe('formatRowMeta', () => {
    it('returns null when there is nothing to say', () => {
        expect(formatRowMeta(makeTask(), today)).toBeNull();
    });

    it('marks overdue tasks with an alert tone and a day count', () => {
        const task = makeTask({ dueDate: iso(subDays(today, 3)) });
        expect(formatRowMeta(task, today)).toEqual({ text: 'overdue 3d', tone: 'alert' });
    });

    it('overdue beats a due time and an estimate', () => {
        const task = makeTask({
            dueDate: iso(subDays(today, 1)),
            dueTime: '14:00',
            estimatedTime: 30,
        });
        expect(formatRowMeta(task, today)).toEqual({ text: 'overdue 1d', tone: 'alert' });
    });

    it('shows the concrete time when due today with a time', () => {
        const task = makeTask({ dueDate: iso(today), dueTime: '14:00' });
        expect(formatRowMeta(task, today)).toEqual({ text: '14:00', tone: 'default' });
    });

    it('says "due today" and "due tomorrow" in words', () => {
        expect(formatRowMeta(makeTask({ dueDate: iso(today) }), today)).toEqual({
            text: 'due today',
            tone: 'default',
        });
        expect(formatRowMeta(makeTask({ dueDate: iso(addDays(today, 1)) }), today)).toEqual({
            text: 'due tomorrow',
            tone: 'default',
        });
    });

    it('uses the weekday inside the week and a short date beyond it', () => {
        // 2026-02-25 is a Wednesday; +3 days = Saturday.
        expect(formatRowMeta(makeTask({ dueDate: iso(addDays(today, 3)) }), today)).toEqual({
            text: 'due Sat',
            tone: 'default',
        });
        expect(formatRowMeta(makeTask({ dueDate: iso(addDays(today, 10)) }), today)).toEqual({
            text: 'due 7 Mar',
            tone: 'default',
        });
    });

    it('flags a deadline whose start day has passed untouched', () => {
        const task = makeTask({
            flag: 'deadline',
            startDate: iso(subDays(today, 2)),
            dueDate: iso(addDays(today, 3)),
            createdAt: subDays(today, 9).toISOString(),
        });
        expect(formatRowMeta(task, today)).toEqual({ text: 'start slipped', tone: 'alert' });
    });

    it('lets overdue outrank a slipped start', () => {
        const task = makeTask({
            flag: 'deadline',
            startDate: iso(subDays(today, 5)),
            dueDate: iso(subDays(today, 1)),
            createdAt: subDays(today, 9).toISOString(),
        });
        expect(formatRowMeta(task, today)).toEqual({ text: 'overdue 1d', tone: 'alert' });
    });

    it('does not flag a slipped start once the task has been touched', () => {
        const task = makeTask({
            flag: 'deadline',
            startDate: iso(subDays(today, 2)),
            dueDate: iso(addDays(today, 3)),
            createdAt: subDays(today, 9).toISOString(),
            lastTouchedAt: today.toISOString(),
        });
        expect(formatRowMeta(task, today)).toEqual({ text: 'due Sat', tone: 'default' });
    });

    it('falls back to a due time, then the estimate, for undated tasks', () => {
        expect(formatRowMeta(makeTask({ dueTime: '09:30' }), today)).toEqual({
            text: '09:30',
            tone: 'default',
        });
        expect(formatRowMeta(makeTask({ estimatedTime: 15 }), today)).toEqual({
            text: '15 min',
            tone: 'default',
        });
    });
});
