import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

const PomodoroTimer: React.FC = () => {
    const toast = useToast();
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'work' | 'break'>('work');

    useEffect(() => {
        let interval: any = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            // Play sound or notify?
            if (mode === 'work') {
                toast.success("Focus session complete! Take a break.");
                setMode('break');
                setTimeLeft(5 * 60);
            } else {
                toast.info("Break over! Ready to focus?");
                setMode('work');
                setTimeLeft(25 * 60);
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft, mode]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
    };

    const switchMode = (newMode: 'work' | 'break') => {
        setMode(newMode);
        setIsActive(false);
        setTimeLeft(newMode === 'work' ? 25 * 60 : 5 * 60);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = mode === 'work'
        ? ((25 * 60 - timeLeft) / (25 * 60)) * 100
        : ((5 * 60 - timeLeft) / (5 * 60)) * 100;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
                {mode === 'work' ? <Brain className="text-indigo-500" /> : <Coffee className="text-emerald-500" />}
                Focus Timer
            </h2>

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

                    <div className="text-5xl font-bold text-slate-800 font-mono">
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={toggleTimer}
                        className={`p-4 rounded-full text-white transition-all transform hover:scale-105 ${isActive
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : mode === 'work' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-500 hover:bg-emerald-600'
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
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => switchMode('work')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'work' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Focus (25m)
                    </button>
                    <button
                        onClick={() => switchMode('break')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'break' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Break (5m)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PomodoroTimer;
