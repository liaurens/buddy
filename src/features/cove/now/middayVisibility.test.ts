import { middayLine, shouldShowMidday } from './middayVisibility';

const state = (over: Partial<Parameters<typeof shouldShowMidday>[1]> = {}) => ({
    donePicks: 0,
    totalPicks: 3,
    dismissed: false,
    ...over,
});

describe('shouldShowMidday', () => {
    it('shows only between 12:00 and 18:00', () => {
        expect(shouldShowMidday(11, state())).toBe(false);
        expect(shouldShowMidday(12, state())).toBe(true);
        expect(shouldShowMidday(17, state())).toBe(true);
        expect(shouldShowMidday(18, state())).toBe(false);
    });

    it('hides when dismissed', () => {
        expect(shouldShowMidday(14, state({ dismissed: true }))).toBe(false);
    });

    it('hides when all picks are done', () => {
        expect(shouldShowMidday(14, state({ donePicks: 3 }))).toBe(false);
    });

    it('hides when nothing is planned', () => {
        expect(shouldShowMidday(14, state({ donePicks: 0, totalPicks: 0 }))).toBe(false);
    });

    it('shows mid-afternoon with work remaining', () => {
        expect(shouldShowMidday(15, state({ donePicks: 1 }))).toBe(true);
    });
});

describe('middayLine', () => {
    it('reflects progress', () => {
        expect(middayLine(1, 3)).toBe('1 of 3 done so far — nice pace.');
    });

    it('stays kind at zero', () => {
        expect(middayLine(0, 3)).toBe('Nothing ticked yet — that’s okay.');
    });
});
