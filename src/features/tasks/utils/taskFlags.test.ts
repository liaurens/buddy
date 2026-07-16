import { describe, expect, it } from 'vitest';
import type { Task, TaskFlag } from '../types';
import {
    applyTaskFlag,
    deriveTaskFlag,
    remainingCalendarMinutes,
    selectUrgentPlannedDate,
} from './taskFlags';

const NOW = new Date('2026-07-14T10:00:00');

function task(patch: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'Task',
        completed: false,
        createdAt: NOW.toISOString(),
        priority: 'medium',
        recurrence: 'none',
        ...patch,
    };
}

describe('applyTaskFlag', () => {
    it('applies every flag contract without destroying a real deadline', () => {
        const cases: Array<[TaskFlag, Partial<Task>, Partial<Task>]> = [
            ['today', {}, { plannedFor: '2026-07-14' }],
            [
                'urgent',
                { dueDate: '2026-07-20' },
                {
                    plannedFor: '2026-07-14',
                    dueDate: '2026-07-20',
                    priority: 'urgent',
                    reminderCadence: 'smart',
                },
            ],
            [
                'deadline',
                { dueDate: '2026-07-20' },
                { dueDate: '2026-07-20', reminderEnabled: true },
            ],
            [
                'waiting',
                { waitingOn: 'Alex' },
                { plannedFor: '2026-07-17', waitingOn: 'Alex', reminderCadence: 'single' },
            ],
            [
                'school',
                { dueDate: '2026-07-20' },
                { triageDestination: 'school', reminderEnabled: true },
            ],
            ['routine', { recurrence: 'weekly' }, { recurrence: 'weekly', reminderEnabled: true }],
            [
                'someday',
                { plannedFor: '2026-07-14', reminderEnabled: true },
                { plannedFor: undefined, reminderEnabled: false },
            ],
        ];

        for (const [flag, input, expected] of cases) {
            const result = applyTaskFlag(task(input), flag, { now: NOW, manuallyConfirmed: true });
            expect(result.errors).toEqual([]);
            expect(result.task).toMatchObject({ flag, ...expected });
        }
    });

    it('reports required-field failures', () => {
        expect(applyTaskFlag(task(), 'deadline', { now: NOW }).errors).not.toHaveLength(0);
        expect(applyTaskFlag(task(), 'waiting', { now: NOW }).errors).not.toHaveLength(0);
        expect(applyTaskFlag(task(), 'routine', { now: NOW }).errors).not.toHaveLength(0);
    });

    it('derives flags for legacy rows', () => {
        expect(deriveTaskFlag(task({ kind: 'urgent' }))).toBe('urgent');
        expect(deriveTaskFlag(task({ assignmentId: 'a1' }))).toBe('school');
        expect(deriveTaskFlag(task({ kind: 'backlog' }))).toBe('someday');
    });
});

describe('selectUrgentPlannedDate', () => {
    it('uses today when the normal-day capacity contract is satisfied', () => {
        expect(
            selectUrgentPlannedDate({
                now: NOW,
                plannedTaskCount: 2,
                remainingCalendarMinutes: 30,
            }),
        ).toBe('2026-07-14');
    });

    it.each([
        [{ dayMode: 'survival' as const }, 'survival day'],
        [{ plannedTaskCount: 3 }, 'full three-task plan'],
        [{ remainingCalendarMinutes: 29 }, 'insufficient calendar time'],
        [{ nightTime: '09:00' }, 'night boundary'],
    ])('uses tomorrow for $1', (patch, _label) => {
        expect(selectUrgentPlannedDate({ now: NOW, ...patch })).toBe('2026-07-15');
    });

    it('uses a 30-minute estimate by default and always honors an explicit day', () => {
        expect(selectUrgentPlannedDate({ now: NOW, remainingCalendarMinutes: 29 })).toBe(
            '2026-07-15',
        );
        expect(
            selectUrgentPlannedDate({
                now: NOW,
                dayMode: 'survival',
                explicitPlannedFor: '2026-07-18',
            }),
        ).toBe('2026-07-18');
    });
});

describe('remainingCalendarMinutes', () => {
    it('clips and merges overlapping events before calculating free time', () => {
        expect(
            remainingCalendarMinutes(
                [
                    { start: '2026-07-14T10:30:00', end: '2026-07-14T11:00:00' },
                    { start: '2026-07-14T10:45:00', end: '2026-07-14T11:15:00' },
                    { start: '2026-07-14T12:30:00', end: '2026-07-14T13:00:00' },
                ],
                NOW,
                '12:00',
            ),
        ).toBe(75);
    });

    it('returns zero at or after the configured night boundary', () => {
        expect(remainingCalendarMinutes([], NOW, '09:00')).toBe(0);
    });
});
