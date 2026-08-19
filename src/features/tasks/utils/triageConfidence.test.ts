import { describe, it, expect } from 'vitest';
import { mergeProfileDetail, splitByConfidence, suggestionToDetail } from './triageConfidence';
import type { TaskTriageSuggestion } from '../../assistant/services/ai-actions.service';

function sug(p: Partial<TaskTriageSuggestion>): TaskTriageSuggestion {
    return {
        id: 'x',
        destination: 'today',
        confidence: 0.5,
        hardness: null,
        dueDate: null,
        dueTime: null,
        plannedFor: null,
        waitingOn: null,
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
            sug({ id: 'a', confidence: 0.8 }),
            sug({ id: 'b', confidence: 0.79 }),
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

describe('mergeProfileDetail', () => {
    const aiDetail = {
        dueDate: '2026-09-01',
        plannedFor: '2026-08-20',
        waitingOn: 'Alex',
        recurrence: 'daily' as const,
        estimatedMinutes: 30,
        energy: 'low' as const,
        taskTypeId: 'type-1',
        context: 'home',
        location: 'desk',
        hardness: 'flexible' as const,
    };

    it('keeps everything when the tap agrees with the suggestion', () => {
        expect(mergeProfileDetail(aiDetail, 'deadline', 'deadline')).toEqual(aiDetail);
    });

    it('keeps only the profile when routing somewhere else', () => {
        expect(mergeProfileDetail(aiDetail, 'someday', 'deadline')).toEqual({
            estimatedMinutes: 30,
            energy: 'low',
            taskTypeId: 'type-1',
            context: 'home',
            location: 'desk',
            hardness: 'flexible',
        });
    });

    it('keeps the profile when there was no suggestion at all', () => {
        expect(mergeProfileDetail(aiDetail, 'today', undefined)).not.toHaveProperty('dueDate');
        expect(mergeProfileDetail({}, 'today', undefined)).toEqual({});
    });
});
