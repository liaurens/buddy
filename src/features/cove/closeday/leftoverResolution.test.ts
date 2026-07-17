import {
    addResolution,
    buildLeftoverResolution,
    EMPTY_COUNTS,
    leftoverIntro,
    summarizeResolutions,
} from './leftoverResolution';

describe('buildLeftoverResolution', () => {
    it('builds simple actions without text', () => {
        expect(buildLeftoverResolution('t1', 'tomorrow')).toEqual({
            taskId: 't1',
            action: 'tomorrow',
        });
        expect(buildLeftoverResolution('t1', 'letGo')).toEqual({ taskId: 't1', action: 'letGo' });
    });

    it('requires text for rename and follow-up', () => {
        expect(buildLeftoverResolution('t1', 'rename', '')).toBeNull();
        expect(buildLeftoverResolution('t1', 'rename', '   ')).toBeNull();
        expect(buildLeftoverResolution('t1', 'followUp')).toBeNull();
    });

    it('trims the text', () => {
        expect(buildLeftoverResolution('t1', 'rename', '  new title ')).toEqual({
            taskId: 't1',
            action: 'rename',
            text: 'new title',
        });
        expect(buildLeftoverResolution('t1', 'followUp', ' send attachment ')).toEqual({
            taskId: 't1',
            action: 'followUp',
            text: 'send attachment',
        });
    });
});

describe('addResolution / summarizeResolutions', () => {
    it('counts renames as moves', () => {
        let counts = addResolution(EMPTY_COUNTS, 'tomorrow');
        counts = addResolution(counts, 'rename');
        expect(counts.moved).toBe(2);
        expect(summarizeResolutions(counts)).toBe('2 moved to tomorrow');
    });

    it('joins parts with a middle dot', () => {
        let counts = addResolution(EMPTY_COUNTS, 'tomorrow');
        counts = addResolution(counts, 'followUp');
        counts = addResolution(counts, 'letGo');
        expect(summarizeResolutions(counts)).toBe(
            '1 moved to tomorrow · 1 follow-up saved · 1 let go',
        );
    });

    it('is empty when nothing was resolved', () => {
        expect(summarizeResolutions(EMPTY_COUNTS)).toBe('');
    });
});

describe('leftoverIntro', () => {
    it('handles singular and plural kindly', () => {
        expect(leftoverIntro(1)).toBe('1 task didn’t happen today — that’s okay.');
        expect(leftoverIntro(2)).toBe('2 tasks didn’t happen today — that’s okay.');
    });
});
