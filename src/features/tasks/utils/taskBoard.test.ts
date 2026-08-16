import { describe, it, expect } from 'vitest';
import { buildTaskBoard, NOW_LIMIT } from './taskBoard';
import type { Task, TaskFlag } from '../types';

const TODAY = '2026-08-16';

function task(p: Partial<Task> & { id: string }): Task {
    return {
        title: p.id,
        completed: false,
        createdAt: '2026-08-01T09:00:00.000Z',
        flag: 'someday',
        ...p,
    };
}

/** Equal scores everywhere unless a test says otherwise — isolates the grouping rules. */
const noScores = new Map<string, number>();

function flagsOf(board: ReturnType<typeof buildTaskBoard>): TaskFlag[] {
    return board.sections.map((s) => s.flag);
}
function idsIn(board: ReturnType<typeof buildTaskBoard>, flag: TaskFlag): string[] {
    return board.sections.find((s) => s.flag === flag)!.tasks.map((t) => t.id);
}

describe('buildTaskBoard', () => {
    it('drops completed tasks entirely', () => {
        const board = buildTaskBoard(
            [task({ id: 'done', flag: 'today', plannedFor: TODAY, completed: true })],
            noScores,
            { today: TODAY },
        );
        expect(board.now).toEqual([]);
        expect(board.activeCount).toBe(0);
    });

    it('pulls urgent and today-flagged tasks into Now', () => {
        const board = buildTaskBoard(
            [
                task({ id: 'u', flag: 'urgent' }),
                task({ id: 't', flag: 'today', plannedFor: TODAY }),
                task({ id: 's', flag: 'someday' }),
            ],
            noScores,
            { today: TODAY },
        );
        expect(board.now.map((t) => t.id).sort()).toEqual(['t', 'u']);
        expect(idsIn(board, 'someday')).toEqual(['s']);
    });

    it('pulls anything overdue or due today into Now regardless of flag', () => {
        const board = buildTaskBoard(
            [
                task({ id: 'overdue-school', flag: 'school', plannedFor: '2026-08-10' }),
                task({ id: 'due-today', flag: 'deadline', dueDate: TODAY }),
                task({ id: 'later', flag: 'deadline', dueDate: '2026-09-01' }),
            ],
            noScores,
            { today: TODAY },
        );
        expect(board.now.map((t) => t.id).sort()).toEqual(['due-today', 'overdue-school']);
        expect(idsIn(board, 'deadline')).toEqual(['later']);
        expect(idsIn(board, 'school')).toEqual([]);
    });

    it('never shows a task in both Now and a section', () => {
        const board = buildTaskBoard(
            [
                task({ id: 'u', flag: 'urgent' }),
                task({ id: 't', flag: 'today', plannedFor: TODAY }),
                task({ id: 'd', flag: 'deadline', dueDate: '2026-09-01' }),
            ],
            noScores,
            { today: TODAY },
        );
        const sectioned = board.sections.flatMap((s) => s.tasks.map((t) => t.id));
        const nowIds = board.now.map((t) => t.id);
        expect(sectioned.filter((id) => nowIds.includes(id))).toEqual([]);
    });

    it('keeps parked tasks out of Now but still lists them in their section', () => {
        // A waiting task whose chase date is in the future is parked: it must not
        // demand attention, but it must stay visible so nothing feels lost.
        const board = buildTaskBoard(
            [
                task({
                    id: 'parked',
                    flag: 'waiting',
                    waitingOn: 'Alex',
                    plannedFor: '2026-09-01',
                }),
            ],
            noScores,
            { today: TODAY },
        );
        expect(board.now).toEqual([]);
        expect(idsIn(board, 'waiting')).toEqual(['parked']);
    });

    it('renders every flag section, including empty ones, in TASK_FLAG_ORDER', () => {
        const board = buildTaskBoard([], noScores, { today: TODAY });
        expect(flagsOf(board)).toEqual(['deadline', 'school', 'routine', 'waiting', 'someday']);
        expect(board.sections.every((s) => s.tasks.length === 0)).toBe(true);
    });

    it('caps Now and moves the rest to nowOverflow rather than hiding them', () => {
        const many = Array.from({ length: NOW_LIMIT + 3 }, (_, i) =>
            task({ id: `u${i}`, flag: 'urgent' }),
        );
        const board = buildTaskBoard(many, noScores, { today: TODAY });
        expect(board.now).toHaveLength(NOW_LIMIT);
        expect(board.nowOverflow).toHaveLength(3);
        // Overflow is not silently dropped, and not duplicated into a section either.
        const sectioned = board.sections.flatMap((s) => s.tasks.map((t) => t.id));
        expect(sectioned).toEqual([]);
        expect(board.now.length + board.nowOverflow.length).toBe(many.length);
    });

    it('honours an explicit nowLimit', () => {
        const board = buildTaskBoard(
            [task({ id: 'a', flag: 'urgent' }), task({ id: 'b', flag: 'urgent' })],
            noScores,
            { today: TODAY, nowLimit: 1 },
        );
        expect(board.now).toHaveLength(1);
        expect(board.nowOverflow).toHaveLength(1);
    });

    it('orders Now and each section by the canonical comparator', () => {
        const scores = new Map([
            ['low', 10],
            ['high', 90],
        ]);
        const board = buildTaskBoard(
            [
                task({ id: 'low', flag: 'urgent' }),
                task({ id: 'high', flag: 'urgent' }),
                task({ id: 's-low', flag: 'someday' }),
                task({ id: 's-high', flag: 'someday' }),
            ],
            new Map([...scores, ['s-low', 1], ['s-high', 50]]),
            { today: TODAY },
        );
        expect(board.now.map((t) => t.id)).toEqual(['high', 'low']);
        expect(idsIn(board, 'someday')).toEqual(['s-high', 's-low']);
    });

    it('counts every active task exactly once across Now, overflow and sections', () => {
        const tasks = [
            task({ id: 'u', flag: 'urgent' }),
            task({ id: 't', flag: 'today', plannedFor: TODAY }),
            task({ id: 'd', flag: 'deadline', dueDate: '2026-09-01' }),
            task({ id: 'sc', flag: 'school' }),
            task({ id: 'r', flag: 'routine', recurrence: 'daily' }),
            task({ id: 'w', flag: 'waiting', waitingOn: 'Sam', plannedFor: '2026-09-01' }),
            task({ id: 'sd', flag: 'someday' }),
            task({ id: 'done', flag: 'someday', completed: true }),
        ];
        const board = buildTaskBoard(tasks, noScores, { today: TODAY });
        const seen = [
            ...board.now,
            ...board.nowOverflow,
            ...board.sections.flatMap((s) => s.tasks),
        ].map((t) => t.id);
        expect(seen).toHaveLength(7);
        expect(new Set(seen).size).toBe(7);
        expect(seen).not.toContain('done');
        expect(board.activeCount).toBe(7);
    });
});
