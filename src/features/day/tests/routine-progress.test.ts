import { describe, it, expect, beforeEach } from 'vitest';
import {
    markRoutineDone,
    clearRoutineDone,
    isRoutineDone,
    getRoutineProgress,
    ROUTINE_PROGRESS_EVENT,
} from '../services/routine-progress';

const DATE = '2026-06-12';

describe('routine-progress', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts with nothing done', () => {
        expect(getRoutineProgress(DATE)).toEqual({
            morning: false,
            midday: false,
            night: false,
            doneCount: 0,
        });
    });

    it('marks and reads a phase as done', () => {
        markRoutineDone('morning', DATE);
        expect(isRoutineDone('morning', DATE)).toBe(true);
        expect(getRoutineProgress(DATE).doneCount).toBe(1);
    });

    it('keeps days independent', () => {
        markRoutineDone('morning', DATE);
        expect(isRoutineDone('morning', '2026-06-13')).toBe(false);
    });

    it('clears a marker (e.g. reopening a closed day)', () => {
        markRoutineDone('night', DATE);
        clearRoutineDone('night', DATE);
        expect(isRoutineDone('night', DATE)).toBe(false);
    });

    it('counts all three phases', () => {
        markRoutineDone('morning', DATE);
        markRoutineDone('midday', DATE);
        markRoutineDone('night', DATE);
        expect(getRoutineProgress(DATE).doneCount).toBe(3);
    });

    it('emits a change event on mark and clear', () => {
        let fired = 0;
        const listener = () => {
            fired += 1;
        };
        window.addEventListener(ROUTINE_PROGRESS_EVENT, listener);
        markRoutineDone('morning', DATE);
        clearRoutineDone('morning', DATE);
        window.removeEventListener(ROUTINE_PROGRESS_EVENT, listener);
        expect(fired).toBe(2);
    });
});
