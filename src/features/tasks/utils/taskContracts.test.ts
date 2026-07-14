import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
    isDeadlineParked,
    isDeadlineStartSlipped,
    isSomedayReviewEligible,
    isWaitingParked,
    missedRoutineOccurrences,
    needsRoutineDecision,
    pickSomedayReview,
    suggestedDeadlineStart,
    taskFitsHomeDay,
} from './taskContracts';

const now = new Date(2026, 6, 14, 12);

function task(overrides: Partial<Task> = {}): Task {
    return {
        id: overrides.id ?? 'task-1',
        title: overrides.title ?? 'Task',
        completed: false,
        createdAt: '2026-05-01T12:00:00.000Z',
        ...overrides,
    };
}

describe('task contracts', () => {
    it('parks waiting tasks until their chase date', () => {
        expect(isWaitingParked(task({ kind: 'waiting', dueDate: '2026-07-15' }), now)).toBe(true);
        expect(isWaitingParked(task({ kind: 'waiting', dueDate: '2026-07-14' }), now)).toBe(false);
    });

    it('suggests three days before a deadline but never before today', () => {
        expect(suggestedDeadlineStart('2026-07-20', now)).toBe('2026-07-17');
        expect(suggestedDeadlineStart('2026-07-15', now)).toBe('2026-07-14');
    });

    it('parks a deadline before start and detects an untouched slipped start', () => {
        const deadline = task({ kind: 'deadline', startDate: '2026-07-15' });
        expect(isDeadlineParked(deadline, now)).toBe(true);
        expect(isDeadlineStartSlipped({ ...deadline, startDate: '2026-07-13' }, now)).toBe(true);
        expect(
            isDeadlineStartSlipped(
                { ...deadline, startDate: '2026-07-13', lastTouchedAt: '2026-07-13T15:00:00Z' },
                now,
            ),
        ).toBe(false);
    });

    it('reviews only old someday tasks and picks the oldest', () => {
        const older = task({ id: 'old', kind: 'backlog', createdAt: '2026-05-01T12:00:00Z' });
        const newer = task({ id: 'new', kind: 'backlog', createdAt: '2026-06-20T12:00:00Z' });
        expect(isSomedayReviewEligible(older, now)).toBe(true);
        expect(isSomedayReviewEligible(newer, now)).toBe(false);
        expect(pickSomedayReview([newer, older], now)?.id).toBe('old');
    });

    it('derives missed routine occurrences for supported patterns', () => {
        expect(missedRoutineOccurrences('2026-07-10', 'daily', now)).toBe(4);
        expect(missedRoutineOccurrences('2026-07-07', 'weekly', now)).toBe(1);
        expect(missedRoutineOccurrences('2026-06-14', 'monthly', now)).toBe(1);
        expect(
            needsRoutineDecision(task({ dueDate: '2026-07-10', recurrence: 'daily' }), now),
        ).toBe(true);
    });

    it('boost eligibility follows task type home days', () => {
        const homeDays = new Map([['home', [2, 6]]]);
        expect(taskFitsHomeDay(task({ taskTypeId: 'home' }), homeDays, now)).toBe(true);
        expect(taskFitsHomeDay(task({ taskTypeId: 'admin' }), homeDays, now)).toBe(false);
    });
});
