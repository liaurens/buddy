import { energyToScale, moodToScale, scaleToEnergy, scaleToMood } from './moodScale';
import type { EnergyIndex, MoodIndex } from '../components';

describe('moodToScale', () => {
    it('maps the five taps into the 1-10 CHECK range', () => {
        expect(moodToScale(0)).toBe(2);
        expect(moodToScale(1)).toBe(4);
        expect(moodToScale(2)).toBe(6);
        expect(moodToScale(3)).toBe(8);
        expect(moodToScale(4)).toBe(10);
    });

    it('round-trips through scaleToMood', () => {
        for (const mood of [0, 1, 2, 3, 4] as MoodIndex[]) {
            expect(scaleToMood(moodToScale(mood))).toBe(mood);
        }
    });
});

describe('energyToScale', () => {
    it('maps low/medium/high into the 1-10 range', () => {
        expect(energyToScale(0)).toBe(3);
        expect(energyToScale(1)).toBe(6);
        expect(energyToScale(2)).toBe(9);
    });

    it('round-trips through scaleToEnergy', () => {
        for (const energy of [0, 1, 2] as EnergyIndex[]) {
            expect(scaleToEnergy(energyToScale(energy))).toBe(energy);
        }
    });
});

describe('scale clamping', () => {
    it('clamps out-of-range stored values instead of crashing', () => {
        expect(scaleToMood(0)).toBe(0);
        expect(scaleToMood(11)).toBe(4);
        expect(scaleToEnergy(0)).toBe(0);
        expect(scaleToEnergy(11)).toBe(2);
    });
});
