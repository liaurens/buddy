import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Settings } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings, type PomodoroSettings } from '../../../services/settings';
import {
    DEFAULT_WORK_MINUTES,
    DEFAULT_BREAK_MINUTES,
    AUTOSTART_DELAY_MS,
} from '../../../constants/config';
import PomodoroSettingsModal from './PomodoroSettingsModal';

const PomodoroTimer: React.FC = () => {
    const toast = useToast();
    const { user } = useAuth();
    const [settings, setSettings] = useState<PomodoroSettings | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_MINUTES * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'work' | 'break'>('work');

    // Load settings on mount
    useEffect(() => {
        if (user) {
            getCategorySettings(user.id, 'pomodoro')
                .then((data) => {
                    setSettings(data);
                    setTimeLeft(data.workDuration * 60);
                })
                .catch((error) => {
                    console.error('Failed to load pomodoro settings:', error);
                });
        }
    }, [user]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            if (settings) {
                if (mode === 'work') {
                    if (settings.soundEnabled) {
                        // Play sound (future enhancement)
                    }
                    toast.success('Focus session complete! Take a break.');
                    setMode('break');
                    setTimeLeft(settings.shortBreakDuration * 60);
                    if (settings.autoStartBreaks) {
                        setTimeout(() => setIsActive(true), AUTOSTART_DELAY_MS);
                    }
                } else {
                    if (settings.soundEnabled) {
                        // Play sound (future enhancement)
                    }
                    toast.info('Break over! Ready to focus?');
                    setMode('work');
                    setTimeLeft(settings.workDuration * 60);
                    if (settings.autoStartPomodoros) {
                        setTimeout(() => setIsActive(true), AUTOSTART_DELAY_MS);
                    }
                }
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft, mode]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        if (settings) {
            setTimeLeft(
                mode === 'work' ? settings.workDuration * 60 : settings.shortBreakDuration * 60,
            );
        }
    };

    const switchMode = (newMode: 'work' | 'break') => {
        setMode(newMode);
        setIsActive(false);
        if (settings) {
            setTimeLeft(
                newMode === 'work' ? settings.workDuration * 60 : settings.shortBreakDuration * 60,
            );
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const workDuration = settings?.workDuration || DEFAULT_WORK_MINUTES;
    const breakDuration = settings?.shortBreakDuration || DEFAULT_BREAK_MINUTES;

    const progress =
        mode === 'work'
            ? ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100
            : ((breakDuration * 60 - timeLeft) / (breakDuration * 60)) * 100;

    return (
        <div className="app-page-readable">
            <div className="app-surface p-6">
                <div className="flex items-center justify-end mb-6 lg:justify-between">
                    <h2 className="app-title hidden items-center gap-2 lg:flex">
                        {mode === 'work' ? (
                            <Brain className="text-indigo-500" />
                        ) : (
                            <Coffee className="text-emerald-500" />
                        )}
                        Focus Timer
                    </h2>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Pomodoro Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>

                <div className="flex flex-col items-center">
                    {/* Timer Display */}
                    <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                        {/* Circular Progress Background */}
                        <svg className="absolute w-full h-full transform -rotate-90">
                            <circle
                                cx="96"
                                cy="96"
                                r="88"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                className="text-slate-100"
                            />
                            <circle
                                cx="96"
                                cy="96"
                                r="88"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 88}
                                strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
                                className={`${mode === 'work' ? 'text-indigo-500' : 'text-emerald-500'} transition-all duration-1000 ease-linear`}
                                strokeLinecap="round"
                            />
                        </svg>

                        <div className="font-mono text-5xl font-semibold text-slate-900">
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4 mb-6">
                        <button
                            onClick={toggleTimer}
                            className={`p-4 rounded-full text-white transition-all transform hover:scale-105 ${
                                isActive
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : mode === 'work'
                                      ? 'bg-indigo-600 hover:bg-indigo-700'
                                      : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                        >
                            {isActive ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            className="p-4 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                            <RotateCcw size={24} />
                        </button>
                    </div>

                    {/* Mode Switcher */}
                    <div className="app-segmented">
                        <button
                            onClick={() => switchMode('work')}
                            className={`app-segment ${
                                mode === 'work' ? 'app-segment-active text-indigo-700' : ''
                            }`}
                        >
                            Focus ({workDuration}m)
                        </button>
                        <button
                            onClick={() => switchMode('break')}
                            className={`app-segment ${
                                mode === 'break' ? 'app-segment-active text-emerald-700' : ''
                            }`}
                        >
                            Break ({breakDuration}m)
                        </button>
                    </div>
                </div>

                {/* Settings Modal */}
                <PomodoroSettingsModal
                    isOpen={showSettings}
                    onClose={() => {
                        setShowSettings(false);
                        // Reload settings after closing modal
                        if (user) {
                            getCategorySettings(user.id, 'pomodoro').then((data) => {
                                setSettings(data);
                                // Reset timer to new duration if not active
                                if (!isActive) {
                                    setTimeLeft(
                                        mode === 'work'
                                            ? data.workDuration * 60
                                            : data.shortBreakDuration * 60,
                                    );
                                }
                            });
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default PomodoroTimer;
