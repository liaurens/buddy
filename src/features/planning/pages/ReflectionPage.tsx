/**
 * Daily Reflection Page - Learning from actual vs estimated time
 *
 * Shows:
 * - Completion rate
 * - Time accuracy
 * - Tasks that took longer/shorter
 * - Patterns and insights
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { generateDayReflection, detectPatterns } from '../../../services/reflection';
import type { DayReflection, LearningPattern } from '../../../services/reflection';
import { TrendingUp, TrendingDown, Target, Clock, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react';

const ReflectionPage: React.FC = () => {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reflection, setReflection] = useState<DayReflection | null>(null);
    const [patterns, setPatterns] = useState<LearningPattern[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.id) {
            loadReflection();
            loadPatterns();
        }
    }, [user?.id, selectedDate]);

    const loadReflection = async () => {
        if (!user?.id) return;

        setLoading(true);
        setError(null);

        try {
            const data = await generateDayReflection(user.id, selectedDate);
            setReflection(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load reflection');
            setReflection(null);
        } finally {
            setLoading(false);
        }
    };

    const loadPatterns = async () => {
        if (!user?.id) return;

        try {
            const data = await detectPatterns(user.id, 30);
            setPatterns(data);
        } catch (err) {
            console.error('Failed to load patterns:', err);
        }
    };

    const formatVariance = (variance: number): string => {
        const sign = variance > 0 ? '+' : '';
        return `${sign}${variance}min`;
    };

    const formatPercent = (percent: number): string => {
        const sign = percent > 0 ? '+' : '';
        return `${sign}${Math.round(percent)}%`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-600">Loading reflection...</div>
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

    if (!reflection) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="max-w-4xl mx-auto text-center">
                    <Clock className="mx-auto text-slate-400 mb-4" size={48} />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">No data yet</h2>
                    <p className="text-slate-600">Complete some time blocks to see your reflection.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Daily Reflection</h1>
                        <p className="text-slate-600">Learn from today to plan better tomorrow</p>
                    </div>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                {/* Completion Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Completion Rate */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-3">
                            <CheckCircle className="text-green-600" size={24} />
                            <h3 className="font-semibold text-slate-800">Completion</h3>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-2">
                            {Math.round(reflection.completionRate)}%
                        </div>
                        <div className="text-sm text-slate-600">
                            {reflection.completedBlocks} of {reflection.totalBlocks} blocks
                        </div>
                        <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-600 transition-all"
                                style={{ width: `${reflection.completionRate}%` }}
                            />
                        </div>
                    </div>

                    {/* Time Accuracy */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-3">
                            <Target className={`${Math.abs(reflection.avgVariancePercent) <= 10 ? 'text-green-600' : 'text-amber-600'}`} size={24} />
                            <h3 className="font-semibold text-slate-800">Accuracy</h3>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-2">
                            {formatPercent(reflection.avgVariancePercent)}
                        </div>
                        <div className="text-sm text-slate-600">
                            {reflection.avgVariancePercent > 0 ? 'Underestimated' : 'Overestimated'}
                        </div>
                    </div>

                    {/* Total Time */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-3">
                            <Clock className="text-indigo-600" size={24} />
                            <h3 className="font-semibold text-slate-800">Time Variance</h3>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-2">
                            {formatVariance(reflection.totalVariance)}
                        </div>
                        <div className="text-sm text-slate-600">
                            Planned: {reflection.totalEstimatedMinutes}min
                        </div>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Underestimated */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="text-red-600" size={20} />
                            <h3 className="font-semibold text-slate-800">Took Longer</h3>
                        </div>
                        {reflection.underestimated.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">None</p>
                        ) : (
                            <div className="space-y-2">
                                {reflection.underestimated.slice(0, 3).map((item) => (
                                    <div key={item.blockId} className="text-sm">
                                        <div className="font-medium text-slate-800">{item.activityName}</div>
                                        <div className="text-xs text-slate-600">
                                            Est: {item.estimatedMinutes}min → Actual: {item.actualMinutes}min
                                            <span className="text-red-600 ml-1">({formatPercent(item.variancePercent)})</span>
                                        </div>
                                    </div>
                                ))}
                                {reflection.underestimated.length > 3 && (
                                    <div className="text-xs text-slate-500">+{reflection.underestimated.length - 3} more</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Accurate */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="text-green-600" size={20} />
                            <h3 className="font-semibold text-slate-800">Accurate (±10%)</h3>
                        </div>
                        {reflection.accurate.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">None</p>
                        ) : (
                            <div className="space-y-2">
                                {reflection.accurate.slice(0, 3).map((item) => (
                                    <div key={item.blockId} className="text-sm">
                                        <div className="font-medium text-slate-800">{item.activityName}</div>
                                        <div className="text-xs text-slate-600">
                                            Est: {item.estimatedMinutes}min → Actual: {item.actualMinutes}min
                                            <span className="text-green-600 ml-1">✓</span>
                                        </div>
                                    </div>
                                ))}
                                {reflection.accurate.length > 3 && (
                                    <div className="text-xs text-slate-500">+{reflection.accurate.length - 3} more</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Overestimated */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingDown className="text-blue-600" size={20} />
                            <h3 className="font-semibold text-slate-800">Took Less Time</h3>
                        </div>
                        {reflection.overestimated.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">None</p>
                        ) : (
                            <div className="space-y-2">
                                {reflection.overestimated.slice(0, 3).map((item) => (
                                    <div key={item.blockId} className="text-sm">
                                        <div className="font-medium text-slate-800">{item.activityName}</div>
                                        <div className="text-xs text-slate-600">
                                            Est: {item.estimatedMinutes}min → Actual: {item.actualMinutes}min
                                            <span className="text-blue-600 ml-1">({formatPercent(item.variancePercent)})</span>
                                        </div>
                                    </div>
                                ))}
                                {reflection.overestimated.length > 3 && (
                                    <div className="text-xs text-slate-500">+{reflection.overestimated.length - 3} more</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Learning Patterns */}
                {patterns.length > 0 && (
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <Lightbulb className="text-amber-600" size={24} />
                            <h3 className="text-xl font-semibold text-slate-800">Insights & Patterns</h3>
                        </div>
                        <div className="space-y-4">
                            {patterns.map((pattern, idx) => (
                                <div key={idx} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <Lightbulb className="text-amber-600 mt-1 flex-shrink-0" size={20} />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-800 mb-1">{pattern.pattern}</div>
                                            <div className="text-sm text-slate-600 mb-2">
                                                Based on {pattern.sampleSize} task{pattern.sampleSize !== 1 ? 's' : ''}
                                            </div>
                                            <div className="text-sm text-amber-900 bg-amber-100 px-3 py-2 rounded">
                                                💡 <strong>Recommendation:</strong> {pattern.recommendation}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReflectionPage;
