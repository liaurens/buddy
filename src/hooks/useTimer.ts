/**
 * Timer Hook - Time tracking with localStorage persistence
 *
 * Features:
 * - Start/stop/pause/resume timer
 * - Persists across page refreshes
 * - Calculates elapsed time
 * - Auto-saves on unmount
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerState {
    blockId: string | null;
    startTime: number | null; // Unix timestamp in ms
    pausedAt: number | null;
    elapsedBeforePause: number; // Total elapsed before current pause (in ms)
    isRunning: boolean;
}

interface UseTimerReturn {
    elapsedMinutes: number;
    elapsedSeconds: number;
    isRunning: boolean;
    isPaused: boolean;
    activeBlockId: string | null;
    start: (blockId: string) => void;
    stop: () => number; // Returns elapsed minutes
    pause: () => void;
    resume: () => void;
    reset: () => void;
}

const STORAGE_KEY = 'daily_planner_timer';

/**
 * Load timer state from localStorage
 */
function loadTimerState(): TimerState {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load timer state:', error);
    }

    return {
        blockId: null,
        startTime: null,
        pausedAt: null,
        elapsedBeforePause: 0,
        isRunning: false,
    };
}

/**
 * Save timer state to localStorage
 */
function saveTimerState(state: TimerState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Failed to save timer state:', error);
    }
}

/**
 * Clear timer state from localStorage
 */
function clearTimerState(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear timer state:', error);
    }
}

/**
 * Timer hook with persistence
 */
export function useTimer(): UseTimerReturn {
    const [timerState, setTimerState] = useState<TimerState>(loadTimerState);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const intervalRef = useRef<number | null>(null);

    // Calculate elapsed time
    const calculateElapsed = useCallback((): number => {
        if (!timerState.startTime) return 0;

        if (timerState.pausedAt) {
            // Paused: return elapsed up to pause time
            return timerState.elapsedBeforePause;
        }

        if (timerState.isRunning) {
            // Running: calculate from start time + any previous elapsed
            return (currentTime - timerState.startTime) + timerState.elapsedBeforePause;
        }

        return timerState.elapsedBeforePause;
    }, [timerState, currentTime]);

    const elapsedMs = calculateElapsed();
    const elapsedMinutes = Math.floor(elapsedMs / 1000 / 60);
    const elapsedSeconds = Math.floor((elapsedMs / 1000) % 60);

    // Update current time every second when running
    useEffect(() => {
        if (timerState.isRunning && !timerState.pausedAt) {
            intervalRef.current = window.setInterval(() => {
                setCurrentTime(Date.now());
            }, 1000);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [timerState.isRunning, timerState.pausedAt]);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        saveTimerState(timerState);
    }, [timerState]);

    // Start timer for a block
    const start = useCallback((blockId: string) => {
        const newState: TimerState = {
            blockId,
            startTime: Date.now(),
            pausedAt: null,
            elapsedBeforePause: 0,
            isRunning: true,
        };
        setTimerState(newState);
        setCurrentTime(Date.now());
    }, []);

    // Stop timer and return elapsed minutes
    const stop = useCallback((): number => {
        const elapsed = calculateElapsed();
        const minutes = Math.ceil(elapsed / 1000 / 60); // Round up to nearest minute

        // Clear state
        const newState: TimerState = {
            blockId: null,
            startTime: null,
            pausedAt: null,
            elapsedBeforePause: 0,
            isRunning: false,
        };
        setTimerState(newState);
        clearTimerState();

        return minutes;
    }, [calculateElapsed]);

    // Pause timer
    const pause = useCallback(() => {
        if (!timerState.isRunning || timerState.pausedAt) return;

        const elapsed = calculateElapsed();
        setTimerState(prev => ({
            ...prev,
            pausedAt: Date.now(),
            elapsedBeforePause: elapsed,
            isRunning: false,
        }));
    }, [timerState, calculateElapsed]);

    // Resume timer
    const resume = useCallback(() => {
        if (timerState.isRunning || !timerState.pausedAt) return;

        setTimerState(prev => ({
            ...prev,
            startTime: Date.now(),
            pausedAt: null,
            isRunning: true,
        }));
        setCurrentTime(Date.now());
    }, [timerState]);

    // Reset timer without stopping
    const reset = useCallback(() => {
        setTimerState(prev => ({
            ...prev,
            startTime: Date.now(),
            pausedAt: null,
            elapsedBeforePause: 0,
        }));
        setCurrentTime(Date.now());
    }, []);

    return {
        elapsedMinutes,
        elapsedSeconds,
        isRunning: timerState.isRunning && !timerState.pausedAt,
        isPaused: !!timerState.pausedAt,
        activeBlockId: timerState.blockId,
        start,
        stop,
        pause,
        resume,
        reset,
    };
}
