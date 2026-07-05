import { describe, it, expect } from 'vitest';
import { routeTaskPatch, isDestinationReady, isLocked, kindToDestination, type TriageDetail } from './triageRouting';

const opts = { nowIso: '2026-06-21T08:00:00.000Z', todayIso: '2026-06-21' };

describe('routeTaskPatch', () => {
    it('urgent flags the task and leaves it unscheduled for the Urgent inbox', () => {
        const patch = routeTaskPatch('urgent', {}, opts);
        expect(patch.kind).toBe('urgent');
        expect(patch.dueDate).toBeUndefined();
        expect(patch.triagedAt).toBe(opts.nowIso);
        expect(patch.triageDestination).toBe('urgent');
    });

    it('today sets the due date to today and keeps the optional time', () => {
        const patch = routeTaskPatch('today', { time: '13:00' }, opts);
        expect(patch.dueDate).toBe('2026-06-21');
        expect(patch.dueTime).toBe('13:00');
        expect(patch.kind).toBeUndefined();
    });

    it('someday makes it a no-pressure backlog item with no date', () => {
        const patch = routeTaskPatch('someday', {}, opts);
        expect(patch.kind).toBe('backlog');
        expect(patch.dueDate).toBeUndefined();
    });

    it('school links the chosen assignment', () => {
        const patch = routeTaskPatch('school', { assignmentId: 'a1' }, opts);
        expect(patch.assignmentId).toBe('a1');
        expect(patch.triagedAt).toBe(opts.nowIso);
    });

    it('routine sets a cadence, defaulting to daily', () => {
        expect(routeTaskPatch('routine', {}, opts).recurrence).toBe('daily');
        expect(routeTaskPatch('routine', { recurrence: 'weekly' }, opts).recurrence).toBe('weekly');
        expect(routeTaskPatch('routine', {}, opts).kind).toBe('routine');
    });

    it('always stamps triagedAt so the task leaves the inbox', () => {
        for (const d of ['urgent', 'today', 'someday', 'school', 'routine'] as const) {
            expect(routeTaskPatch(d, { assignmentId: 'a1' }, opts).triagedAt).toBe(opts.nowIso);
        }
    });
});

describe('routeTaskPatch — metadata', () => {
    it('writes the full profile and persists the destination for "today"', () => {
        const detail: TriageDetail = {
            time: '14:30',
            hardness: 'flexible',
            location: 'Library',
            context: 'computer',
            energy: 'high',
            estimatedMinutes: 45,
        };
        const patch = routeTaskPatch('today', detail, opts);
        expect(patch.dueDate).toBe('2026-06-21');
        expect(patch.dueTime).toBe('14:30');
        expect(patch.hardness).toBe('flexible');
        expect(patch.location).toBe('Library');
        expect(patch.context).toBe('computer');
        expect(patch.energy).toBe('high');
        expect(patch.estimatedTime).toBe(45);
        expect(patch.triageDestination).toBe('today');
        expect(patch.triagedAt).toBe(opts.nowIso);
    });

    it('seeds an escalating reminder cadence for fixed tasks and single for flexible', () => {
        expect(routeTaskPatch('today', { hardness: 'fixed' }, opts).reminderCadence).toBe('smart');
        expect(routeTaskPatch('today', { hardness: 'flexible' }, opts).reminderCadence).toBe(
            'single',
        );
    });

    it('keeps the loose-school destination even without an assignment', () => {
        const patch = routeTaskPatch('school', {}, opts);
        expect(patch.triageDestination).toBe('school');
        expect(patch.assignmentId).toBeUndefined();
    });
});

describe('isDestinationReady', () => {
    it('treats every destination as ready (school without an assignment is a loose school task)', () => {
        expect(isDestinationReady('school', {})).toBe(true);
        expect(isDestinationReady('school', { assignmentId: 'a1' })).toBe(true);
        expect(isDestinationReady('urgent', {})).toBe(true);
        expect(isDestinationReady('today', {})).toBe(true);
        expect(isDestinationReady('someday', {})).toBe(true);
        expect(isDestinationReady('routine', {})).toBe(true);
    });
});

describe('isLocked', () => {
    it('is true for a fixed task with a date', () => {
        expect(isLocked({ hardness: 'fixed', dueDate: '2026-06-22' })).toBe(true);
    });
    it('is false for a fixed task with no date', () => {
        expect(isLocked({ hardness: 'fixed' })).toBe(false);
    });
    it('is false for a flexible task', () => {
        expect(isLocked({ hardness: 'flexible', dueDate: '2026-06-22' })).toBe(false);
    });
});

describe('kindToDestination', () => {
    it('maps each explicit capture kind to its destination', () => {
        expect(kindToDestination('urgent')).toBe('urgent');
        expect(kindToDestination('backlog')).toBe('someday');
        expect(kindToDestination('routine')).toBe('routine');
        expect(kindToDestination('deadline')).toBe('today');
        expect(kindToDestination('standard')).toBe('today');
    });
});
