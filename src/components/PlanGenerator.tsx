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
import { useAuth } from '../hooks/useAuth';
import { buildPlanningContext, generateDailyPlan, savePlanToDatabase } from '../services/planning';
import type { PlanSuggestion } from '../types/planning';
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
}

const PlanGenerator: React.FC<PlanGeneratorProps> = ({ date, onPlanGenerated }) => {
    const { user } = useAuth();

    // User state
    const [mood, setMood] = useState<number>(7);
    const [energy, setEnergy] = useState<number>(7);
    const [sleepHours, setSleepHours] = useState<number>(7);

    // Preferences
    const [workStartTime, setWorkStartTime] = useState('09:00');
    const [workEndTime, setWorkEndTime] = useState('17:00');
    const [includeLunchBreak, setIncludeLunchBreak] = useState(true);
    const lunchDuration = 60;
    const [includeShortBreaks, setIncludeShortBreaks] = useState(true);
    const shortBreakInterval = 90;

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<PlanSuggestion | null>(null);

    const handleGeneratePlan = async () => {
        if (!user?.id) return;

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
                }
            );

            // Generate plan
            const plan = await generateDailyPlan(user.id, context);
            setSuggestion(plan);
        } catch (err: any) {
            setError(err.message || 'Failed to generate plan');
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
            onPlanGenerated();
        } catch (err: any) {
            setError(err.message || 'Failed to save plan');
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
                                    onChange={(e) => setWorkStartTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-2">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={workEndTime}
                                    onChange={(e) => setWorkEndTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                        </div>
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
