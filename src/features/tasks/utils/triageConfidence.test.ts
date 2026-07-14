import { describe, it, expect } from 'vitest';
import { splitByConfidence, suggestionToDetail } from './triageConfidence';
import type { TaskTriageSuggestion } from '../../assistant/services/ai-actions.service';

function sug(p: Partial<TaskTriageSuggestion>): TaskTriageSuggestion {
    return {
        id: 'x',
        destination: 'today',
        confidence: 'low',
        hardness: null,
        dueDate: null,
        dueTime: null,
        assignmentId: null,
        recurrence: null,
        location: null,
        context: null,
        energy: null,
        estimatedMinutes: null,
        taskTypeId: null,
        reason: '',
        ...p,
    };
}

describe('splitByConfidence', () => {
    it('separates high-confidence from the rest', () => {
        const { autoApply, review } = splitByConfidence([
            sug({ id: 'a', confidence: 'high' }),
            sug({ id: 'b', confidence: 'low' }),
        ]);
        expect(autoApply.map((s) => s.id)).toEqual(['a']);
        expect(review.map((s) => s.id)).toEqual(['b']);
    });
});

describe('suggestionToDetail', () => {
    it('carries time, hardness, location, context, energy and minutes', () => {
        const d = suggestionToDetail(
            sug({
                destination: 'today',
                dueTime: '09:30',
                hardness: 'fixed',
                location: 'Gym',
                context: 'out',
                energy: 'high',
                estimatedMinutes: 30,
            }),
        );
        expect(d).toEqual({
            time: '09:30',
            hardness: 'fixed',
            location: 'Gym',
            context: 'out',
            energy: 'high',
            estimatedMinutes: 30,
        });
    });
    it('carries a resolved taskTypeId', () => {
        expect(suggestionToDetail(sug({ taskTypeId: 'type-1' })).taskTypeId).toBe('type-1');
        expect(suggestionToDetail(sug({})).taskTypeId).toBeUndefined();
    });

    it('carries assignmentId for school and recurrence for routine', () => {
        expect(
            suggestionToDetail(sug({ destination: 'school', assignmentId: 'a1' })).assignmentId,
        ).toBe('a1');
        expect(
            suggestionToDetail(sug({ destination: 'routine', recurrence: 'weekly' })).recurrence,
        ).toBe('weekly');
    });
});
