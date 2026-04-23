/**
 * Plan Generator Component - AI-powered daily plan creation
 *
 * Features:
 * - User state inputs (mood, energy, sleep)
 * - Work hours preferences
 * - Break preferences
 * - AI plan generation with loading state
 * - Display AI reasoning and suggestions
 * - Save plan to database
 */

import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { updateCategorySettings } from '../../../services/settings';
import { buildPlanningContext, generateDailyPlan, savePlanToDatabase } from '../services/planning.service';
import type { PlanSuggestion } from '../../../types/planning';
import { DEFAULT_LUNCH_DURATION_MINUTES, DEFAULT_BREAK_INTERVAL_MINUTES } from '../../../constants/config';
import {
    Sparkles,
    Brain,
    Coffee,
    Moon,
    Clock,
    AlertCircle,
    CheckCircle,
    Loader
} from 'lucide-react';

interface PlanGeneratorProps {
    date: string;
    onPlanGenerated: () => void;
    hasExistingPlan?: boolean;
    selectedTaskIds?: string[];
}

const PlanGenerator: React.FC<PlanGeneratorProps> = ({ date, onPlanGenerated, hasExistingPlan = false, selectedTaskIds }) => {
    const { user } = useAuth();

    // User state
    const [mood, setMood] = useState<number>(7);
    const [energy, setEnergy] = useState<number>(7);
    const [sleepHours, setSleepHours] = useState<number>(7);

    // Preferences
    const [workStartTime, setWorkStartTime] = useState('09:00');
    const [workEndTime, setWorkEndTime] = useState('17:00');
    const [includeLunchBreak, setIncludeLunchBreak] = useState(true);
    const lunchDuration = DEFAULT_LUNCH_DURATION_MINUTES;
    const [includeShortBreaks, setIncludeShortBreaks] = useState(true);
    const shortBreakInterval = DEFAULT_BREAK_INTERVAL_MINUTES;

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<PlanSuggestion | null>(null);
    const [workHoursError, setWorkHoursError] = useState<string | null>(null);
    const [saveAsDefaults, setSaveAsDefaults] = useState(true);

    const validateWorkHours = (start: string, end: string): boolean => {
        if (!start || !end) return true; // Allow empty values

        const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
        const endMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);

        if (endMinutes <= startMinutes) {
            setWorkHoursError('End time must be after start time');
            return false;
        }

        setWorkHoursError(null);
        return true;
    };

    const handleWorkStartChange = (value: string) => {
        setWorkStartTime(value);
        validateWorkHours(value, workEndTime);
    };

    const handleWorkEndChange = (value: string) => {
        setWorkEndTime(value);
        validateWorkHours(workStartTime, value);
    };

    const handleGeneratePlan = async () => {
        if (!user?.id) return;

        // Validate work hours before generating
        if (!validateWorkHours(workStartTime, workEndTime)) {
            setError('Please fix work hours before generating plan');
            return;
        }

        // Confirm if replacing existing plan
        if (hasExistingPlan) {
            const confirmed = window.confirm(
                'You already have a plan for today. Generating a new plan will replace it, but completed tasks will be preserved.\n\nAre you sure you want to continue?'
            );
            if (!confirmed) return;
        }

        setLoading(true);
        setError(null);
        setSuggestion(null);

        try {
            // Build context
            const context = await buildPlanningContext(
                user.id,
                date,
                { mood, energy, sleepHours },
                {
                    workStartTime,
                    workEndTime,
                    includeLunchBreak,
                    lunchDuration,
                    includeShortBreaks,
                    shortBreakInterval,
                },
                selectedTaskIds
            );

            // Generate plan
            const plan = await generateDailyPlan(user.id, context);
            setSuggestion(plan);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to generate plan');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlan = async () => {
        if (!user?.id || !suggestion) return;

        setLoading(true);
        setError(null);

        try {
            // Build context again for saving
            const context = await buildPlanningContext(
                user.id,
                date,
                { mood, energy, sleepHours },
                {
                    workStartTime,
                    workEndTime,
                    includeLunchBreak,
                    lunchDuration,
                    includeShortBreaks,
                    shortBreakInterval,
                }
            );

            await savePlanToDatabase(user.id, date, suggestion, context);

            // Save as default settings if checkbox is checked
            if (saveAsDefaults) {
                try {
                    await updateCategorySettings(user.id, 'planning', {
                        workStartTime,
                        workEndTime,
                        includeLunchBreak,
                        lunchDuration,
                        shortBreakInterval,
                        shortBreakDuration: 5,
                        bufferBetweenBlocks: 5,
                        lunchStartTime: '12:00',
                    });
                } catch (settingsErr) {
                    console.error('Failed to save default settings:', settingsErr);
                    // Don't fail the plan save if settings save fails
                }
            }

            onPlanGenerated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save plan');
        } finally {
            setLoading(false);
        }
    };

    const getEnergyLabel = (value: number): string => {
        if (value >= 8) return 'High';
        if (value >= 5) return 'Moderate';
        return 'Low';
    };

    const getMoodEmoji = (value: number): string => {
        if (value >= 8) return '😊';
        if (value >= 6) return '🙂';
        if (value >= 4) return '😐';
        return '😔';
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
                <Sparkles className="text-indigo-600" size={28} />
                <h2 className="text-2xl font-bold text-slate-900">
                    Generate Daily Plan
                </h2>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
                    <AlertCircle className="inline mr-2" size={20} />
                    {error}
                </div>
            )}

            {!suggestion ? (
                <div className="space-y-6">
                    {/* Welcome Message for New Users */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            <span className="font-semibold">👋 Let's create your AI-powered daily plan!</span>
                            <br />
                            Tell me how you're feeling and when you work. I'll analyze your tasks and calendar to create a realistic, balanced schedule.
                        </p>
                    </div>

                    {/* User State */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Brain size={20} className="text-indigo-600" />
                            How are you feeling today?
                        </h3>

                        {/* Mood */}
                        <div>
                            <label className="text-sm font-medium text-slate-700 flex items-center justify-between mb-2">
                                <span>Mood {getMoodEmoji(mood)}</span>
                                <span className="text-indigo-600">{mood}/10</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={mood}
                                onChange={(e) => setMood(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>

                        {/* Energy */}
                        <div>
                            <label className="text-sm font-medium text-slate-700 flex items-center justify-between mb-2">
                                <span className="flex items-center gap-2">
                                    <Coffee size={16} />
                                    Energy Level
                                </span>
                                <span className="text-indigo-600">{energy}/10 - {getEnergyLabel(energy)}</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={energy}
                                onChange={(e) => setEnergy(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>

                        {/* Sleep */}
                        <div>
                            <label className="text-sm font-medium text-slate-700 flex items-center justify-between mb-2">
                                <span className="flex items-center gap-2">
                                    <Moon size={16} />
                                    Sleep Last Night
                                </span>
                                <span className="text-indigo-600">{sleepHours}h</span>
                            </label>
                            <input
                                type="range"
                                min="3"
                                max="12"
                                step="0.5"
                                value={sleepHours}
                                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                    </div>

                    {/* Work Hours */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Clock size={20} className="text-indigo-600" />
                            Work Schedule
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-2">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={workStartTime}
                                    onChange={(e) => handleWorkStartChange(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                        workHoursError ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-2">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={workEndTime}
                                    onChange={(e) => handleWorkEndChange(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                        workHoursError ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                    }`}
                                />
                            </div>
                        </div>
                        {workHoursError && (
                            <div className="text-sm text-red-600 flex items-center gap-2">
                                <AlertCircle size={16} />
                                {workHoursError}
                            </div>
                        )}
                    </div>

                    {/* Break Preferences */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-900">Break Preferences</h3>

                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={includeLunchBreak}
                                onChange={(e) => setIncludeLunchBreak(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700">
                                Include lunch break ({lunchDuration} minutes)
                            </span>
                        </label>

                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={includeShortBreaks}
                                onChange={(e) => setIncludeShortBreaks(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700">
                                Include short breaks (every {shortBreakInterval} minutes)
                            </span>
                        </label>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGeneratePlan}
                        disabled={loading}
                        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin" size={20} />
                                Generating Plan...
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                Generate Plan with AI
                            </>
                        )}
                    </button>

                    {/* Loading Progress Indicator */}
                    {loading && (
                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <div className="flex flex-col items-center gap-3">
                                <Loader className="animate-spin text-indigo-600" size={32} />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-indigo-900">
                                        Analyzing your tasks and calendar...
                                    </p>
                                    <p className="text-xs text-indigo-700 mt-1">
                                        This usually takes 5-10 seconds
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* AI Reasoning */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <h3 className="font-semibold text-indigo-900 mb-2">AI Insight</h3>
                        <p className="text-sm text-indigo-800">{suggestion.reasoning}</p>
                    </div>

                    {/* Warnings */}
                    {suggestion.warnings && suggestion.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <h3 className="font-semibold text-amber-900 mb-2">Warnings</h3>
                            <ul className="space-y-1">
                                {suggestion.warnings.map((warning, idx) => (
                                    <li key={idx} className="text-sm text-amber-800">
                                        ⚠️ {warning}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-slate-900">
                                {suggestion.blocks.length}
                            </div>
                            <div className="text-sm text-slate-600">Time Blocks</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-slate-900">
                                {Math.round(suggestion.totalMinutes / 60)}h
                            </div>
                            <div className="text-sm text-slate-600">Total Time</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-slate-900">
                                {Math.round(suggestion.freeTimeMinutes / 60)}h
                            </div>
                            <div className="text-sm text-slate-600">Free Time</div>
                        </div>
                    </div>

                    {/* Preview Blocks */}
                    <div>
                        <h3 className="font-semibold text-slate-900 mb-3">Preview</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {suggestion.blocks.slice(0, 5).map((block, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-sm">
                                    <span className="text-slate-600 font-medium w-16">
                                        {block.startTime}
                                    </span>
                                    <span className="flex-1 text-slate-900">{block.title}</span>
                                    <span className="text-slate-500">{block.estimatedMinutes}min</span>
                                </div>
                            ))}
                            {suggestion.blocks.length > 5 && (
                                <div className="text-sm text-slate-500 italic">
                                    +{suggestion.blocks.length - 5} more blocks...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Save as Defaults Checkbox */}
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={saveAsDefaults}
                            onChange={(e) => setSaveAsDefaults(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">
                            Save these settings as my defaults
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setSuggestion(null)}
                            className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                        >
                            Regenerate
                        </button>
                        <button
                            onClick={handleSavePlan}
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    Save Plan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanGenerator;
