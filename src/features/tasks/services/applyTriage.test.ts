import { describe, it, expect } from 'vitest';
import { applyTriagePatch } from './applyTriage';
import type { TriageDestination } from '../utils/triageRouting';
import type { Task } from '../types';

const NOW_ISO = '2026-07-04T08:00:00.000Z';
const TODAY_ISO = '2026-07-04';
const OPTS = { nowIso: NOW_ISO, todayIso: TODAY_ISO };

function task(p: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'captured thing',
        completed: false,
        createdAt: '2026-07-03T00:00:00.000Z',
        subtasks: [],
        recurrence: 'none',
        priority: 'medium',
        ...p,
    };
}

describe('applyTriagePatch', () => {
    it('urgent sets BOTH kind and priority (write-through, unlike the old eager path)', () => {
        const out = applyTriagePatch(task(), 'urgent', {}, OPTS);
        expect(out.kind).toBe('urgent');
        expect(out.priority).toBe('urgent');
        expect(out.dueDate).toBeUndefined();
    });

    it('stamps triagedAt AND triageDestination for every destination', () => {
        const destinations: TriageDestination[] = ['urgent', 'today', 'someday', 'school', 'routine'];
        for (const destination of destinations) {
            const out = applyTriagePatch(task(), destination, {}, OPTS);
            expect(out.triagedAt).toBe(NOW_ISO);
            expect(out.triageDestination).toBe(destination);
        }
    });

    it('today puts the task on the plan with the chosen time', () => {
        const out = applyTriagePatch(task(), 'today', { time: '14:00' }, OPTS);
        expect(out.dueDate).toBe(TODAY_ISO);
        expect(out.dueTime).toBe('14:00');
    });

    it('routine sets recurrence (defaults daily)', () => {
        expect(applyTriagePatch(task(), 'routine', {}, OPTS).recurrence).toBe('daily');
        expect(
            applyTriagePatch(task(), 'routine', { recurrence: 'weekly' }, OPTS).recurrence,
        ).toBe('weekly');
    });

    it('school links the assignment', () => {
        expect(applyTriagePatch(task(), 'school', { assignmentId: 'a9' }, OPTS).assignmentId).toBe(
            'a9',
        );
    });

    it('records autoTriaged as given (default false)', () => {
        expect(applyTriagePatch(task(), 'someday', {}, OPTS).autoTriaged).toBe(false);
        expect(
            applyTriagePatch(task(), 'someday', {}, { ...OPTS, autoTriaged: true }).autoTriaged,
        ).toBe(true);
    });
});
