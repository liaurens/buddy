/**
 * Daily Plan Page - View and execute today's plan
 *
 * Shows:
 * - Timeline of time blocks
 * - Start/pause/complete controls
 * - Progress tracking
 * - Empty state with "Generate Plan" CTA
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTimer } from '../../../hooks/useTimer';
import { loadPlanForDate, startBlock, completeBlock, skipBlock } from '../services/planning.service';
import { recordBlockCompletion } from '../services/reflection.service';
import PlanGenerator from '../components/PlanGenerator';
import PlanningSettingsModal from '../components/plan/PlanningSettingsModal';
import type { DailyPlan, TimeBlock } from '../../../types/planning';
import {
    Clock,
    Play,
    Pause,
    CheckCircle,
    SkipForward,
    Calendar,
    AlertCircle,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Settings
} from 'lucide-react';

const PlanPage: React.FC = () => {
    const { user } = useAuth();
    const timer = useTimer();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [plan, setPlan] = useState<DailyPlan | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [blockToSkip, setBlockToSkip] = useState<TimeBlock | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadPlan();
        }
    }, [user?.id, selectedDate]);

    const loadPlan = async () => {
        if (!user?.id) return;

        setLoading(true);
        setError(null);

        try {
            const data = await loadPlanForDate(user.id, selectedDate);
            setPlan(data);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load plan';

            // Check if it's a database table missing error
            if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
                setError('Database tables not set up. Please run the migration SQL in Supabase (see docs/daily_planning_migration.sql)');
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStartBlock = async (block: TimeBlock) => {
        if (!user?.id) return;

        try {
            await startBlock(user.id, block.id);
            timer.start(block.id);

            // Refresh plan
            await loadPlan();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to start block');
        }
    };

    const handlePauseBlock = () => {
        timer.pause();
    };

    const handleResumeBlock = () => {
        timer.resume();
    };

    const handleCompleteBlock = async (block: TimeBlock) => {
        if (!user?.id) return;

        try {
            const actualMinutes = timer.stop();

            // Update block status
            await completeBlock(user.id, block.id, actualMinutes);

            // Record for learning
            await recordBlockCompletion(user.id, block.id, actualMinutes);

            // Refresh plan
            await loadPlan();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to complete block');
        }
    };

    const handleSkipBlock = (block: TimeBlock) => {
        // Show confirmation dialog
        setBlockToSkip(block);
    };

    const confirmSkipBlock = async () => {
        if (!user?.id || !blockToSkip) return;

        try {
            // If timer is running for this block, stop it
            if (timer.activeBlockId === blockToSkip.id) {
                timer.stop();
            }

            await skipBlock(user.id, blockToSkip.id);
            setBlockToSkip(null);
            await loadPlan();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to skip block');
            setBlockToSkip(null);
        }
    };

    const cancelSkipBlock = () => {
        setBlockToSkip(null);
    };

    const handleDateChange = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const getBlockStatusColor = (block: TimeBlock): string => {
        if (block.status === 'completed') return 'bg-green-50 border-green-200';
        if (block.status === 'active') return 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200';
        if (block.status === 'skipped') return 'bg-slate-100 border-slate-200 opacity-60';
        return 'bg-white border-slate-200';
    };

    const getBlockStatusIcon = (block: TimeBlock) => {
        if (block.status === 'completed') return <CheckCircle className="text-green-600" size={20} />;
        if (block.status === 'active') return <Play className="text-indigo-600" size={20} />;
        if (block.status === 'skipped') return <SkipForward className="text-slate-400" size={20} />;
        return <Clock className="text-slate-400" size={20} />;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-600">Loading plan...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                        <AlertCircle className="inline mr-2" size={20} />
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    // Empty state - no plan for this date
    if (!plan) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Header with Settings */}
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Daily Plan</h1>
                            <p className="text-slate-500">Create and manage your daily schedule</p>
                        </div>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            aria-label="Planning Settings"
                        >
                            <Settings size={20} />
                        </button>
                    </div>

                    {/* Date Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => handleDateChange(-1)}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-3">
                            <Calendar className="text-slate-600" size={24} />
                            <h1 className="text-2xl font-bold text-slate-800">
                                {new Date(selectedDate).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </h1>
                        </div>
                        <button
                            onClick={() => handleDateChange(1)}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>

                    {/* Empty State */}
                    {isToday ? (
                        <PlanGenerator date={selectedDate} onPlanGenerated={loadPlan} />
                    ) : (
                        <div className="text-center py-12">
                            <Sparkles className="mx-auto text-slate-400 mb-4" size={64} />
                            <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                                No plan for this day
                            </h2>
                            <p className="text-slate-600">
                                No plan was created for this date
                            </p>
                        </div>
                    )}

                    {/* Settings Modal */}
                    <PlanningSettingsModal
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header with Date Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => handleDateChange(-1)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <Calendar className="text-slate-600" size={24} />
                        <h1 className="text-2xl font-bold text-slate-800">
                            {new Date(selectedDate).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </h1>
                    </div>
                    <button
                        onClick={() => handleDateChange(1)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* AI Reasoning */}
                {plan.aiReasoning && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Sparkles className="text-indigo-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-indigo-900 mb-1">AI Planning Insight</h3>
                                <p className="text-sm text-indigo-800">{plan.aiReasoning}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Time Blocks Timeline */}
                <div className="space-y-3">
                    {plan.blocks.map((block) => {
                        const isActive = timer.activeBlockId === block.id;
                        const canStart = block.status === 'pending' && !timer.isRunning;
                        const canPause = isActive && timer.isRunning;
                        const canResume = isActive && timer.isPaused;
                        const canComplete = isActive;
                        const canSkip = block.status === 'pending' || block.status === 'active';

                        return (
                            <div
                                key={block.id}
                                className={`rounded-xl p-4 border transition-all ${getBlockStatusColor(block)}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Time & Status Icon */}
                                    <div className="flex flex-col items-center gap-2 w-24 flex-shrink-0">
                                        <div className="text-sm font-medium text-slate-600">
                                            {block.startTime}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {block.estimatedMinutes}min
                                        </div>
                                        {getBlockStatusIcon(block)}
                                    </div>

                                    {/* Block Details */}
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900 mb-1">
                                            {block.title}
                                        </h3>
                                        {block.description && (
                                            <p className="text-sm text-slate-600 mb-2">
                                                {block.description}
                                            </p>
                                        )}

                                        {/* Timer Display (when active) */}
                                        {isActive && (
                                            <div className="bg-white rounded-lg px-3 py-2 inline-flex items-center gap-2 mb-2">
                                                <Clock className="text-indigo-600" size={16} />
                                                <span className="font-mono font-semibold text-slate-900">
                                                    {String(timer.elapsedMinutes).padStart(2, '0')}:
                                                    {String(timer.elapsedSeconds).padStart(2, '0')}
                                                </span>
                                                {timer.isPaused && (
                                                    <span className="text-xs text-amber-600 font-medium">PAUSED</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Actual Time (when completed) */}
                                        {block.status === 'completed' && block.actualMinutes && (
                                            <div className="text-sm text-green-700">
                                                ✓ Completed in {block.actualMinutes}min
                                                {block.actualMinutes !== block.estimatedMinutes && (
                                                    <span className="text-slate-600 ml-2">
                                                        ({block.actualMinutes > block.estimatedMinutes ? '+' : ''}
                                                        {block.actualMinutes - block.estimatedMinutes}min)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 flex-shrink-0">
                                        {canStart && (
                                            <button
                                                onClick={() => handleStartBlock(block)}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                            >
                                                <Play size={16} />
                                                Start
                                            </button>
                                        )}

                                        {canPause && (
                                            <button
                                                onClick={handlePauseBlock}
                                                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors flex items-center gap-2"
                                            >
                                                <Pause size={16} />
                                                Pause
                                            </button>
                                        )}

                                        {canResume && (
                                            <button
                                                onClick={handleResumeBlock}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                            >
                                                <Play size={16} />
                                                Resume
                                            </button>
                                        )}

                                        {canComplete && (
                                            <button
                                                onClick={() => handleCompleteBlock(block)}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                                            >
                                                <CheckCircle size={16} />
                                                Complete
                                            </button>
                                        )}

                                        {canSkip && (
                                            <button
                                                onClick={() => handleSkipBlock(block)}
                                                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                                                title="Skip this block"
                                            >
                                                <SkipForward size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Plan Summary */}
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-4">Plan Summary</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-2xl font-bold text-slate-900">
                                {plan.blocks.filter(b => b.status === 'completed').length}
                            </div>
                            <div className="text-sm text-slate-600">Completed</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">
                                {plan.blocks.filter(b => b.status === 'pending' || b.status === 'active').length}
                            </div>
                            <div className="text-sm text-slate-600">Remaining</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">
                                {plan.totalPlannedMinutes || 0}min
                            </div>
                            <div className="text-sm text-slate-600">Total Time</div>
                        </div>
                    </div>
                </div>

                {/* Skip Confirmation Dialog */}
                {blockToSkip && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <AlertCircle className="text-amber-600" size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 text-lg">
                                        Skip this task?
                                    </h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                        "{blockToSkip.title}" won't be completed today.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={cancelSkipBlock}
                                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSkipBlock}
                                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                                >
                                    Skip Task
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings Modal */}
                <PlanningSettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                />
            </div>
        </div>
    );
};

export default PlanPage;
