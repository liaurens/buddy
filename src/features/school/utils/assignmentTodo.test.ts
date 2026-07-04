import { describe, it, expect } from 'vitest';
import { buildAssignmentTodo } from './assignmentTodo';

const NOW = new Date('2026-07-04T09:00:00.000Z');

describe('buildAssignmentTodo', () => {
    it('mirrors the assignment onto a routed deadline todo', () => {
        const todo = buildAssignmentTodo(
            {
                id: 'a1',
                title: 'Essay draft',
                deadline: new Date(2026, 6, 10, 12, 0).toISOString(),
                estimatedMinutes: 90,
            },
            NOW,
        );
        expect(todo).toMatchObject({
            title: 'Essay draft',
            completed: false,
            dueDate: '2026-07-10',
            kind: 'deadline',
            estimatedTime: 90,
            assignmentId: 'a1',
            triageDestination: 'school',
            triagedAt: NOW.toISOString(),
        });
        expect(todo.hardness).toBeUndefined();
    });

    it('uses the local date for a near-midnight deadline', () => {
        // 23:30 local on the 10th must not roll into the 11th (or back to the 9th).
        const deadline = new Date(2026, 6, 10, 23, 30).toISOString();
        expect(buildAssignmentTodo({ id: 'a', title: 't', deadline }, NOW).dueDate).toBe(
            '2026-07-10',
        );
    });

    it('leaves estimate unset when the assignment has none', () => {
        const todo = buildAssignmentTodo(
            { id: 'a', title: 't', deadline: NOW.toISOString(), estimatedMinutes: null },
            NOW,
        );
        expect(todo.estimatedTime).toBeUndefined();
    });
});
