/**
 * Daily Reflection Page
 *
 * Top of page: a 90-second ritual — 14-day mood/energy trend, three wins,
 * one blocker, and tomorrow's one thing. The wins/blocker/priority are stored
 * as `assistant_learnings` rows and read back by the planner next morning.
 *
 * Below: the historical "Day metrics" (completion %, variance, patterns), collapsed.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { generateDayReflection, detectPatterns } from '../services/reflection.service';
import { saveReflectionItems, loadReflectionForDate } from '../services/reflectionCapture';
import { useReflectionHistory } from '../hooks/useReflectionHistory';
import { useGoals } from '../../../features/core/hooks/useGoals';
import type { Goal } from '../../../features/core/hooks/useGoals';
import ReflectionSettingsModal from '../components/reflection/ReflectionSettingsModal';
import MoodEnergySparkline from '../components/reflection/MoodEnergySparkline';
import type { DayReflection, LearningPattern } from '../services/reflection.service';
import {
    TrendingUp, TrendingDown, Target, Clock, CheckCircle, AlertCircle,
    Lightbulb, Settings, ChevronDown, ChevronRight, Sparkles, Flag, Compass,
} from 'lucide-react';

const ReflectionPage: React.FC = () => {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reflection, setReflection] = useState<DayReflection | null>(null);
    const [patterns, setPatterns] = useState<LearningPattern[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [metricsOpen, setMetricsOpen] = useState(false);

    // Reflection capture state
    const [wins, setWins] = useState<string[]>(['', '', '']);
    const [blocker, setBlocker] = useState('');
    const [priority, setPriority] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);

    const { data: historyPoints = [] } = useReflectionHistory(14);
    const { goals, todayLogs, logGoalToday } = useGoals('active');
    type GoalEntry = { completed?: boolean; minutesSpent?: number; progressDelta?: number };
    const [goalEntries, setGoalEntries] = useState<Record<string, GoalEntry>>({});

    useEffect(() => {
        const initial: Record<string, GoalEntry> = {};
        todayLogs.forEach(log => {
            initial[log.goalId] = {
                completed: log.completed,
                minutesSpent: log.minutesSpent ?? undefined,
                progressDelta: log.progressDelta ?? undefined,
            };
        });
        setGoalEntries(initial);
    }, [todayLogs]);

    const loadReflection = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);
        try {
            const data = await generateDayReflection(user.id, selectedDate);
            setReflection(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load reflection');
            setReflection(null);
        } finally {
            setLoading(false);
        }
    }, [user?.id, selectedDate]);

    const loadPatterns = useCallback(async () => {
        if (!user?.id) return;
        try {
            const data = await detectPatterns(user.id, 30);
            setPatterns(data);
        } catch (err) {
            console.error('Failed to load patterns:', err);
        }
    }, [user?.id]);

    const loadCapture = useCallback(async () => {
        if (!user?.id) return;
        const existing = await loadReflectionForDate(user.id, selectedDate);
        const paddedWins = [...existing.wins.slice(0, 3)];
        while (paddedWins.length < 3) paddedWins.push('');
        setWins(paddedWins);
        setBlocker(existing.blocker);
        setPriority(existing.priority);
        setSavedAt(existing.wins.length + (existing.blocker ? 1 : 0) + (existing.priority ? 1 : 0) > 0 ? 'loaded' : null);
    }, [user?.id, selectedDate]);

    useEffect(() => {
        if (user?.id) {
            loadReflection();
            loadPatterns();
            loadCapture();
        }
    }, [user?.id, selectedDate, loadReflection, loadPatterns, loadCapture]);

    const handleSaveReflection = async () => {
        if (!user?.id || saving) return;
        setSaving(true);
        setCaptureError(null);
        try {
            await saveReflectionItems(user.id, selectedDate, [
                ...wins.map(text => ({ subtype: 'reflection_win' as const, text })),
                { subtype: 'reflection_blocker' as const, text: blocker },
                { subtype: 'reflection_priority' as const, text: priority },
            ]);
            // Persist goal check-ins for today
            await Promise.all(
                goals
                    .filter(g => goalEntries[g.id] !== undefined)
                    .map(g => logGoalToday(g.id, goalEntries[g.id]))
            );
            setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            setCaptureError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
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

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Daily Reflection</h1>
                        <p className="text-slate-600">90 seconds — wins, blocker, tomorrow's one thing.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            aria-label="Reflection Settings"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Sparkline */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Last 14 days</h2>
                    </div>
                    <MoodEnergySparkline points={historyPoints} />
                </div>

                {/* Capture form */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-500" /> Three good things today
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Anything that went well — a kind moment, a finished task, a meal you enjoyed.
                        </p>
                        <div className="mt-3 space-y-2">
                            {[0, 1, 2].map(i => (
                                <textarea
                                    key={i}
                                    value={wins[i] ?? ''}
                                    onChange={e => setWins(prev => prev.map((w, idx) => idx === i ? e.target.value : w))}
                                    rows={1}
                                    placeholder={`Win ${i + 1}…`}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y"
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Flag size={18} className="text-rose-500" /> One blocker
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">What got in the way today? (leave blank if nothing stood out)</p>
                        <textarea
                            value={blocker}
                            onChange={e => setBlocker(e.target.value)}
                            rows={2}
                            placeholder="Something that slowed you down…"
                            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-rose-400 focus:border-transparent resize-y"
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Compass size={18} className="text-indigo-500" /> Tomorrow's one thing
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            If you only do one thing tomorrow, what is it? (planner reads this next morning)
                        </p>
                        <textarea
                            value={priority}
                            onChange={e => setPriority(e.target.value)}
                            rows={2}
                            placeholder="The one thing that would make tomorrow a win…"
                            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                            {captureError && <span className="text-rose-600">{captureError}</span>}
                            {!captureError && savedAt && savedAt !== 'loaded' && <span>Saved at {savedAt}.</span>}
                        </div>
                        <button
                            onClick={handleSaveReflection}
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {saving ? 'Saving…' : 'Save reflection'}
                        </button>
                    </div>
                </div>

                {/* Goals check-in */}
                {goals.length > 0 && (
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Target size={18} className="text-emerald-500" /> Today's goals
                        </h2>
                        <p className="text-xs text-slate-500 -mt-2">Log how your goals went today.</p>
                        <ul className="space-y-4">
                            {goals.map((goal: Goal) => {
                                const entry = goalEntries[goal.id] ?? {};
                                const update = (patch: GoalEntry) =>
                                    setGoalEntries(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], ...patch } }));
                                return (
                                    <li key={goal.id} className="space-y-2">
                                        <p className="text-sm font-medium text-slate-800">{goal.title}</p>
                                        {goal.goalType === 'action' && (
                                            <div className="flex gap-2">
                                                {(['Done', 'Not done'] as const).map(label => (
                                                    <button key={label} type="button"
                                                        onClick={() => update({ completed: label === 'Done' })}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                            (label === 'Done' ? entry.completed : entry.completed === false)
                                                                ? label === 'Done' ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        }`}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {goal.goalType === 'habit' && (
                                            <div className="flex gap-2">
                                                {(['Yes', 'No'] as const).map(label => (
                                                    <button key={label} type="button"
                                                        onClick={() => update({ completed: label === 'Yes' })}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                            (label === 'Yes' ? entry.completed : entry.completed === false)
                                                                ? label === 'Yes' ? 'bg-orange-500 text-white' : 'bg-slate-500 text-white'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        }`}>
                                                        {label === 'Yes' ? '🔥 Did it' : 'Skipped'}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {goal.goalType === 'time' && (
                                            <div className="flex items-center gap-2">
                                                <input type="number" min={0} placeholder="0"
                                                    value={entry.minutesSpent ?? ''}
                                                    onChange={e => update({ minutesSpent: Number(e.target.value) })}
                                                    className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                                                <span className="text-xs text-slate-500">
                                                    min spent{goal.targetMinutes ? ` / ${goal.targetMinutes} target` : ''}
                                                </span>
                                            </div>
                                        )}
                                        {goal.goalType === 'progress' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Progress added:</span>
                                                <input type="number" min={0} max={100} placeholder="0"
                                                    value={entry.progressDelta ?? ''}
                                                    onChange={e => update({ progressDelta: Number(e.target.value) })}
                                                    className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                                                <span className="text-xs text-slate-500">%</span>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* Collapsible day metrics */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100">
                    <button
                        type="button"
                        onClick={() => setMetricsOpen(o => !o)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors rounded-xl"
                    >
                        <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Day metrics</span>
                        {metricsOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    </button>

                    {metricsOpen && (
                        <div className="p-5 pt-0 space-y-6">
                            {loading ? (
                                <div className="text-slate-500 text-sm">Loading metrics…</div>
                            ) : error ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                                    <AlertCircle className="inline mr-2" size={16} /> {error}
                                </div>
                            ) : !reflection ? (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    <Clock className="mx-auto text-slate-400 mb-3" size={32} />
                                    No blocks logged for this date yet.
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                </div>
                                            )}
                                        </div>

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
                                                </div>
                                            )}
                                        </div>

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
                                                </div>
                                            )}
                                        </div>
                                    </div>

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
                                </>
                            )}
                        </div>
                    )}
                </div>

                <ReflectionSettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                />
            </div>
        </div>
    );
};

export default ReflectionPage;
