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
import { format } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { generateDayReflection, detectPatterns } from '../services/reflection.service';
import {
    saveReflectionItems,
    loadReflectionForDate,
    saveReflectionFocus,
    loadReflectionFocus,
    type ReflectionFocusPick,
} from '../services/reflectionCapture';
import { useReflectionHistory } from '../hooks/useReflectionHistory';
import { getDayCapacity } from '../../day/services/dayCapacity';
import { useGoals } from '../../../features/core/hooks/useGoals';
import type { Goal } from '../../../features/core/hooks/useGoals';
import { useSkills } from '../../growth/hooks/useSkills';
import { useQuery } from '@tanstack/react-query';
import { supabase, saveJournalEntry } from '../../../services/supabase';
import ReflectionSettingsModal from '../components/reflection/ReflectionSettingsModal';
import MoodEnergySparkline from '../components/reflection/MoodEnergySparkline';
import CloseDayCard from '../components/reflection/CloseDayCard';
import JournalFeed from '../components/reflection/JournalFeed';
import SkillsLogCard from '../components/reflection/SkillsLogCard';
import StrategySpotlightCard from '../components/reflection/StrategySpotlightCard';
import type { DayReflection, LearningPattern } from '../services/reflection.service';
import {
    TrendingUp,
    TrendingDown,
    Target,
    Clock,
    CheckCircle,
    AlertCircle,
    Lightbulb,
    Settings,
    ChevronDown,
    ChevronRight,
    Sparkles,
    Compass,
    Heart,
    Mountain,
    Plus,
    Trash2,
    Rocket,
} from 'lucide-react';

interface ActiveProject {
    id: string;
    name: string;
}

const ReflectionPage: React.FC = () => {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [reflection, setReflection] = useState<DayReflection | null>(null);
    const [patterns, setPatterns] = useState<LearningPattern[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [metricsOpen, setMetricsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'reflect' | 'journal'>('reflect');

    // Reflection capture state
    const [memory, setMemory] = useState('');
    const [gratitude, setGratitude] = useState('');
    const [challenge, setChallenge] = useState('');
    const [priority, setPriority] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [hasExistingData, setHasExistingData] = useState(false);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [survivalDay, setSurvivalDay] = useState(false);

    const { data: historyPoints = [] } = useReflectionHistory(14);
    const { goals, todayLogs, logGoalToday } = useGoals('active', selectedDate);
    type GoalEntry = { completed?: boolean; minutesSpent?: number; progressDelta?: number };
    const [goalEntries, setGoalEntries] = useState<Record<string, GoalEntry>>({});

    const { data: activeProjects = [] as ActiveProject[] } = useQuery({
        queryKey: ['projects', user?.id, 'active'],
        queryFn: async () => {
            if (!user?.id) return [] as ActiveProject[];
            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data ?? []) as ActiveProject[];
        },
        enabled: !!user?.id,
    });

    const { skills } = useSkills();

    const [focusPicks, setFocusPicks] = useState<ReflectionFocusPick[]>([]);

    useEffect(() => {
        const initial: Record<string, GoalEntry> = {};
        todayLogs.forEach((log) => {
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
        const [existing, picks, capacity] = await Promise.all([
            loadReflectionForDate(user.id, selectedDate),
            loadReflectionFocus(user.id, selectedDate),
            getDayCapacity(user.id, selectedDate).catch(() => 'normal' as const),
        ]);
        const survival = capacity === 'survival';
        setSurvivalDay(survival);
        // Survival days pre-fill the win: showing up was the assignment.
        setMemory(
            existing.memory || existing.wins[0] || (survival ? 'Showed up on a survival day.' : ''),
        );
        setGratitude(existing.gratitude || existing.wins[1] || '');
        setChallenge(existing.challenge || existing.blocker || '');
        setPriority(existing.priority || '');
        setFocusPicks(picks);
        setHasExistingData(
            !!(
                existing.memory ||
                existing.gratitude ||
                existing.challenge ||
                existing.priority ||
                existing.wins.length > 0 ||
                existing.blocker ||
                picks.length > 0
            ),
        );
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
                { subtype: 'reflection_memory' as const, text: memory },
                { subtype: 'reflection_gratitude' as const, text: gratitude },
                { subtype: 'reflection_challenge' as const, text: challenge },
                { subtype: 'reflection_priority' as const, text: priority },
            ]);
            // Compose the day's answers into a durable journal entry as well —
            // the Journal tab reads these back as the diary feed.
            const journalPrompts = [
                { promptId: 'core_memory', question: "Today's core memory", answer: memory.trim() },
                { promptId: 'gratitude', question: 'Gratitude', answer: gratitude.trim() },
                { promptId: 'challenge', question: 'Challenge & growth', answer: challenge.trim() },
            ].filter((p) => p.answer);
            if (journalPrompts.length > 0) {
                await saveJournalEntry({ date: selectedDate, prompts: journalPrompts, wins: [] });
            }
            await saveReflectionFocus(user.id, selectedDate, focusPicks);
            // Persist goal check-ins for today
            await Promise.all(
                goals
                    .filter((g) => goalEntries[g.id] !== undefined)
                    .map((g) => logGoalToday(g.id, goalEntries[g.id])),
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
        <div className="app-page">
            {/* Header */}
            <div className="flex items-end justify-between gap-3">
                <div>
                    <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">
                        Daily Reflection
                    </div>
                    <div className="px-1 text-[13.5px] font-semibold text-cove-muted">
                        90 seconds: wins, blocker, tomorrow's one thing.
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="rounded-[12px] border border-cove-border px-4 py-2 font-semibold text-cove-ink focus:ring-2 focus:ring-cove-accent-pale"
                    />
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Reflection Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Reflect / Journal tab bar */}
            <div className="flex gap-1 rounded-full bg-[#eef6fa] p-1">
                {(
                    [
                        { key: 'reflect', label: 'Reflect' },
                        { key: 'journal', label: 'Journal' },
                    ] as const
                ).map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 rounded-full py-2 text-sm font-extrabold transition-colors ${
                            activeTab === tab.key
                                ? 'bg-white text-cove-ink shadow-cove'
                                : 'text-cove-muted hover:text-cove-ink'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'journal' ? <JournalFeed /> : null}

            {activeTab === 'reflect' && (
                <>
                    {survivalDay && (
                        <div className="rounded-[16px] bg-cove-tint-green px-4 py-3 text-sm font-semibold text-cove-success-deep">
                            Survival day — closing it counts double. One line is plenty; everything
                            below is optional.
                        </div>
                    )}

                    {/* Sparkline */}
                    <div className="app-surface p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="app-label">Last 14 days</h2>
                        </div>
                        <MoodEnergySparkline points={historyPoints} />
                    </div>

                    {/* Capture form */}
                    <div className="app-surface p-6 space-y-6">
                        <div>
                            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                                <Sparkles size={18} className="text-cove-streak" /> Today's Core
                                Memory
                            </h2>
                            <p className="text-xs font-semibold text-cove-muted mt-1">
                                A single cool memory, funny moment, or highlight you want to
                                remember.
                            </p>
                            <textarea
                                value={memory}
                                onChange={(e) => setMemory(e.target.value)}
                                rows={1}
                                placeholder="What was one cool memory from today?"
                                className="mt-3 w-full px-3 py-2 rounded-[12px] border border-cove-border text-sm font-semibold text-cove-ink placeholder:text-cove-faint focus:ring-2 focus:ring-cove-accent-pale focus:border-transparent resize-y"
                            />
                        </div>

                        <div>
                            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                                <Heart size={18} className="text-cove-pink" /> Gratitude
                            </h2>
                            <p className="text-xs font-semibold text-cove-muted mt-1">
                                What is one thing you are truly grateful for today?
                            </p>
                            <textarea
                                value={gratitude}
                                onChange={(e) => setGratitude(e.target.value)}
                                rows={1}
                                placeholder="Something big or small..."
                                className="mt-3 w-full px-3 py-2 rounded-[12px] border border-cove-border text-sm font-semibold text-cove-ink placeholder:text-cove-faint focus:ring-2 focus:ring-cove-accent-pale focus:border-transparent resize-y"
                            />
                        </div>

                        <div>
                            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                                <Mountain size={18} className="text-cove-success" /> Challenge &
                                Growth
                            </h2>
                            <p className="text-xs font-semibold text-cove-muted mt-1">
                                What challenged you today, and how did you handle it?
                            </p>
                            <textarea
                                value={challenge}
                                onChange={(e) => setChallenge(e.target.value)}
                                rows={2}
                                placeholder="A difficult moment and what I learned..."
                                className="mt-3 w-full px-3 py-2 rounded-[12px] border border-cove-border text-sm font-semibold text-cove-ink placeholder:text-cove-faint focus:ring-2 focus:ring-cove-accent-pale focus:border-transparent resize-y"
                            />
                        </div>

                        <div>
                            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                                <Compass size={18} className="text-cove-accent" /> Tomorrow's Focus
                            </h2>
                            <p className="text-xs font-semibold text-cove-muted mt-1">
                                If you only do one thing tomorrow, what is it? (planner reads this
                                next morning)
                            </p>
                            <textarea
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                rows={2}
                                placeholder="The one thing that would make tomorrow a win…"
                                className="mt-3 w-full px-3 py-2 rounded-[12px] border border-cove-border text-sm font-semibold text-cove-ink placeholder:text-cove-faint focus:ring-2 focus:ring-cove-accent-pale focus:border-transparent resize-y"
                            />
                        </div>

                        {/* Goals & Projects to push tomorrow */}
                        <div>
                            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                                <Rocket size={18} className="text-cove-purple" /> Push goals or
                                projects tomorrow
                            </h2>
                            <p className="text-xs font-semibold text-cove-muted mt-1">
                                Pick a goal or project and write the concrete thing you'll do to
                                move it forward.
                            </p>

                            <ul className="mt-3 space-y-3">
                                {focusPicks.map((pick, idx) => {
                                    const update = (patch: Partial<ReflectionFocusPick>) =>
                                        setFocusPicks((prev) =>
                                            prev.map((p, i) =>
                                                i === idx ? { ...p, ...patch } : p,
                                            ),
                                        );
                                    const remove = () =>
                                        setFocusPicks((prev) => prev.filter((_, i) => i !== idx));
                                    const selectValue = pick.refId
                                        ? `${pick.kind}:${pick.refId}`
                                        : '';
                                    return (
                                        <li
                                            key={idx}
                                            className="rounded-[14px] p-3 space-y-2 bg-[#eef6fa]"
                                        >
                                            <div className="flex items-start gap-2">
                                                <select
                                                    value={selectValue}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (!v) {
                                                            update({ refId: '', refTitle: '' });
                                                            return;
                                                        }
                                                        const [kind, id] = v.split(':') as [
                                                            'goal' | 'project' | 'skill',
                                                            string,
                                                        ];
                                                        const title =
                                                            kind === 'goal'
                                                                ? (goals.find((g) => g.id === id)
                                                                      ?.title ?? '')
                                                                : kind === 'project'
                                                                  ? (activeProjects.find(
                                                                        (p) => p.id === id,
                                                                    )?.name ?? '')
                                                                  : (skills.find((s) => s.id === id)
                                                                        ?.name ?? '');
                                                        update({
                                                            kind,
                                                            refId: id,
                                                            refTitle: title,
                                                        });
                                                    }}
                                                    className="flex-1 px-3 py-2 rounded-[12px] border border-cove-border text-sm font-semibold text-cove-ink bg-white focus:ring-2 focus:ring-cove-accent-pale focus:border-transparent"
                                                >
                                                    <option value="">
                                                        Select a goal or project…
                                                    </option>
                                                    {goals.length > 0 && (
                                                        <optgroup label="Goals">
                                                            {goals.map((g) => (
                                                                <option
                                                                    key={`goal-${g.id}`}
                                                                    value={`goal:${g.id}`}
                                                                >
                                                                    {g.title}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {activeProjects.length > 0 && (
                                                        <optgroup label="Projects">
                                                            {activeProjects.map((p) => (
                                                                <option
                                                                    key={`project-${p.id}`}
                                                                    value={`project:${p.id}`}
                                                                >
                                                                    {p.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {skills.length > 0 && (
                                                        <optgroup label="Skills">
                                                            {skills.map((s) => (
                                                                <option
                                                                    key={`skill-${s.id}`}
                                                                    value={`skill:${s.id}`}
                                                                >
                                                                    {s.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={remove}
                                                    aria-label="Remove pick"
                                                    className="p-2 text-cove-soft hover:text-cove-pink hover:bg-white rounded-[10px] transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <textarea
                                                value={pick.plan}
                                                onChange={(e) => update({ plan: e.target.value })}
                                                rows={2}
                                                placeholder="What will you do tomorrow to move this forward?"
                                                className="w-full px-3 py-2 rounded-[12px] border border-cove-border text-sm font-semibold text-cove-ink bg-white placeholder:text-cove-faint focus:ring-2 focus:ring-cove-accent-pale focus:border-transparent resize-y"
                                            />
                                        </li>
                                    );
                                })}
                            </ul>

                            {goals.length === 0 &&
                            activeProjects.length === 0 &&
                            skills.length === 0 ? (
                                <p className="mt-3 text-xs font-semibold text-cove-soft italic">
                                    No active goals, projects, or skills yet. Add one and it will
                                    show up here.
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFocusPicks((prev) => [
                                            ...prev,
                                            { kind: 'goal', refId: '', refTitle: '', plan: '' },
                                        ])
                                    }
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-cove-purple bg-cove-tint-purple hover:bg-cove-tint-purple/70 rounded-full transition-colors"
                                >
                                    <Plus size={14} /> Add another
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-cove-muted">
                                {captureError && (
                                    <span className="text-cove-pink">{captureError}</span>
                                )}
                                {!captureError && savedAt && <span>Saved at {savedAt}.</span>}
                                {!captureError && !savedAt && hasExistingData && (
                                    <span className="text-cove-soft">Previously saved.</span>
                                )}
                            </div>
                            <button
                                onClick={handleSaveReflection}
                                disabled={saving}
                                className="app-primary-button"
                            >
                                {saving ? 'Saving…' : 'Save reflection'}
                            </button>
                        </div>
                    </div>

                    {/* Close the day — explicit end state of the loop */}
                    <CloseDayCard date={selectedDate} tomorrowPriority={priority} />

                    {/* Skills practiced today (Growth Hub lives here now) */}
                    <SkillsLogCard />

                    {/* Goals check-in */}
                    {goals.length > 0 && (
                        <div className="app-surface p-6 space-y-4">
                            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                                <Target size={18} className="text-cove-success" /> Today's goals
                            </h2>
                            <p className="text-xs font-semibold text-cove-muted -mt-2">
                                Log how your goals went today.
                            </p>
                            <ul className="space-y-4">
                                {goals.map((goal: Goal) => {
                                    const entry = goalEntries[goal.id] ?? {};
                                    const update = (patch: GoalEntry) =>
                                        setGoalEntries((prev) => ({
                                            ...prev,
                                            [goal.id]: { ...prev[goal.id], ...patch },
                                        }));
                                    return (
                                        <li key={goal.id} className="space-y-2">
                                            <p className="text-sm font-bold text-cove-ink">
                                                {goal.title}
                                            </p>
                                            {goal.goalType === 'action' && (
                                                <div className="flex gap-2">
                                                    {(['Done', 'Not done'] as const).map(
                                                        (label) => (
                                                            <button
                                                                key={label}
                                                                type="button"
                                                                onClick={() =>
                                                                    update({
                                                                        completed: label === 'Done',
                                                                    })
                                                                }
                                                                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                                                                    (
                                                                        label === 'Done'
                                                                            ? entry.completed
                                                                            : entry.completed ===
                                                                              false
                                                                    )
                                                                        ? label === 'Done'
                                                                            ? 'bg-cove-success text-white'
                                                                            : 'bg-cove-muted text-white'
                                                                        : 'bg-[#eef6fa] text-cove-muted hover:bg-cove-track'
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                            {goal.goalType === 'habit' && (
                                                <div className="flex gap-2">
                                                    {(['Yes', 'No'] as const).map((label) => (
                                                        <button
                                                            key={label}
                                                            type="button"
                                                            onClick={() =>
                                                                update({
                                                                    completed: label === 'Yes',
                                                                })
                                                            }
                                                            className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                                                                (
                                                                    label === 'Yes'
                                                                        ? entry.completed
                                                                        : entry.completed === false
                                                                )
                                                                    ? label === 'Yes'
                                                                        ? 'bg-cove-streak text-white'
                                                                        : 'bg-cove-muted text-white'
                                                                    : 'bg-[#eef6fa] text-cove-muted hover:bg-cove-track'
                                                            }`}
                                                        >
                                                            {label === 'Yes'
                                                                ? '🔥 Did it'
                                                                : 'Skipped'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {goal.goalType === 'time' && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        placeholder="0"
                                                        value={entry.minutesSpent ?? ''}
                                                        onChange={(e) =>
                                                            update({
                                                                minutesSpent: Number(
                                                                    e.target.value,
                                                                ),
                                                            })
                                                        }
                                                        className="w-20 px-2 py-1.5 text-sm font-semibold text-cove-ink border border-cove-border rounded-[10px] focus:outline-none focus:ring-1 focus:ring-cove-accent-pale"
                                                    />
                                                    <span className="text-xs font-semibold text-cove-muted">
                                                        min spent
                                                        {goal.targetMinutes
                                                            ? ` / ${goal.targetMinutes} target`
                                                            : ''}
                                                    </span>
                                                </div>
                                            )}
                                            {goal.goalType === 'progress' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-cove-muted">
                                                        Progress added:
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        placeholder="0"
                                                        value={entry.progressDelta ?? ''}
                                                        onChange={(e) =>
                                                            update({
                                                                progressDelta: Number(
                                                                    e.target.value,
                                                                ),
                                                            })
                                                        }
                                                        className="w-16 px-2 py-1.5 text-sm font-semibold text-cove-ink border border-cove-border rounded-[10px] focus:outline-none focus:ring-1 focus:ring-cove-accent-pale"
                                                    />
                                                    <span className="text-xs font-semibold text-cove-muted">
                                                        %
                                                    </span>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Toolbox strategies, resurfaced at reflection time */}
                    <StrategySpotlightCard />

                    {/* Collapsible day metrics */}
                    <div className="app-surface">
                        <button
                            type="button"
                            onClick={() => setMetricsOpen((o) => !o)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#eef6fa] transition-colors rounded-[18px]"
                        >
                            <span className="app-label">Day metrics</span>
                            {metricsOpen ? (
                                <ChevronDown size={18} className="text-cove-soft" />
                            ) : (
                                <ChevronRight size={18} className="text-cove-soft" />
                            )}
                        </button>

                        {metricsOpen && (
                            <div className="p-5 pt-0 space-y-6">
                                {loading ? (
                                    <div className="text-cove-muted font-semibold text-sm">
                                        Loading metrics…
                                    </div>
                                ) : error ? (
                                    <div className="bg-cove-tint-pink rounded-[12px] p-4 text-cove-pink font-semibold text-sm">
                                        <AlertCircle className="inline mr-2" size={16} /> {error}
                                    </div>
                                ) : !reflection ? (
                                    <div className="text-center py-8 text-cove-muted font-semibold text-sm">
                                        <Clock className="mx-auto text-cove-soft mb-3" size={32} />
                                        No blocks logged for this date yet.
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <CheckCircle
                                                        className="text-cove-success-deep"
                                                        size={24}
                                                    />
                                                    <h3 className="text-[14.5px] font-extrabold text-cove-ink">
                                                        Completion
                                                    </h3>
                                                </div>
                                                <div className="text-3xl font-black text-cove-ink mb-2">
                                                    {Math.round(reflection.completionRate)}%
                                                </div>
                                                <div className="text-sm font-semibold text-cove-muted">
                                                    {reflection.completedBlocks} of{' '}
                                                    {reflection.totalBlocks} blocks
                                                </div>
                                                <div className="mt-3 h-2 bg-cove-track rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-cove-success transition-all"
                                                        style={{
                                                            width: `${reflection.completionRate}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Target
                                                        className={`${Math.abs(reflection.avgVariancePercent) <= 10 ? 'text-cove-success-deep' : 'text-[#c07a1e]'}`}
                                                        size={24}
                                                    />
                                                    <h3 className="text-[14.5px] font-extrabold text-cove-ink">
                                                        Accuracy
                                                    </h3>
                                                </div>
                                                <div className="text-3xl font-black text-cove-ink mb-2">
                                                    {formatPercent(reflection.avgVariancePercent)}
                                                </div>
                                                <div className="text-sm font-semibold text-cove-muted">
                                                    {reflection.avgVariancePercent > 0
                                                        ? 'Underestimated'
                                                        : 'Overestimated'}
                                                </div>
                                            </div>

                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Clock className="text-cove-accent" size={24} />
                                                    <h3 className="text-[14.5px] font-extrabold text-cove-ink">
                                                        Time Variance
                                                    </h3>
                                                </div>
                                                <div className="text-3xl font-black text-cove-ink mb-2">
                                                    {formatVariance(reflection.totalVariance)}
                                                </div>
                                                <div className="text-sm font-semibold text-cove-muted">
                                                    Planned: {reflection.totalEstimatedMinutes}min
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <TrendingUp
                                                        className="text-cove-pink"
                                                        size={20}
                                                    />
                                                    <h3 className="text-[14.5px] font-extrabold text-cove-ink">
                                                        Took Longer
                                                    </h3>
                                                </div>
                                                {reflection.underestimated.length === 0 ? (
                                                    <p className="text-sm font-semibold text-cove-soft italic">
                                                        None
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {reflection.underestimated
                                                            .slice(0, 3)
                                                            .map((item) => (
                                                                <div
                                                                    key={item.blockId}
                                                                    className="text-sm"
                                                                >
                                                                    <div className="font-bold text-cove-ink">
                                                                        {item.activityName}
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-cove-muted">
                                                                        Est: {item.estimatedMinutes}
                                                                        min → Actual:{' '}
                                                                        {item.actualMinutes}min
                                                                        <span className="text-cove-pink ml-1">
                                                                            (
                                                                            {formatPercent(
                                                                                item.variancePercent,
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Target
                                                        className="text-cove-success-deep"
                                                        size={20}
                                                    />
                                                    <h3 className="text-[14.5px] font-extrabold text-cove-ink">
                                                        Accurate (±10%)
                                                    </h3>
                                                </div>
                                                {reflection.accurate.length === 0 ? (
                                                    <p className="text-sm font-semibold text-cove-soft italic">
                                                        None
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {reflection.accurate
                                                            .slice(0, 3)
                                                            .map((item) => (
                                                                <div
                                                                    key={item.blockId}
                                                                    className="text-sm"
                                                                >
                                                                    <div className="font-bold text-cove-ink">
                                                                        {item.activityName}
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-cove-muted">
                                                                        Est: {item.estimatedMinutes}
                                                                        min → Actual:{' '}
                                                                        {item.actualMinutes}min
                                                                        <span className="text-cove-success-deep ml-1">
                                                                            ✓
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <TrendingDown
                                                        className="text-cove-accent"
                                                        size={20}
                                                    />
                                                    <h3 className="text-[14.5px] font-extrabold text-cove-ink">
                                                        Took Less Time
                                                    </h3>
                                                </div>
                                                {reflection.overestimated.length === 0 ? (
                                                    <p className="text-sm font-semibold text-cove-soft italic">
                                                        None
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {reflection.overestimated
                                                            .slice(0, 3)
                                                            .map((item) => (
                                                                <div
                                                                    key={item.blockId}
                                                                    className="text-sm"
                                                                >
                                                                    <div className="font-bold text-cove-ink">
                                                                        {item.activityName}
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-cove-muted">
                                                                        Est: {item.estimatedMinutes}
                                                                        min → Actual:{' '}
                                                                        {item.actualMinutes}min
                                                                        <span className="text-cove-accent ml-1">
                                                                            (
                                                                            {formatPercent(
                                                                                item.variancePercent,
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {patterns.length > 0 && (
                                            <div className="rounded-[16px] bg-[#eef6fa] p-5">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <Lightbulb
                                                        className="text-cove-streak"
                                                        size={24}
                                                    />
                                                    <h3 className="text-[15px] font-extrabold text-cove-ink">
                                                        Insights & Patterns
                                                    </h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {patterns.map((pattern, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="p-4 bg-cove-tint-amber rounded-[12px]"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <Lightbulb
                                                                    className="text-cove-streak-deep mt-1 flex-shrink-0"
                                                                    size={20}
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="font-bold text-cove-ink mb-1">
                                                                        {pattern.pattern}
                                                                    </div>
                                                                    <div className="text-sm font-semibold text-cove-muted mb-2">
                                                                        Based on{' '}
                                                                        {pattern.sampleSize} task
                                                                        {pattern.sampleSize !== 1
                                                                            ? 's'
                                                                            : ''}
                                                                    </div>
                                                                    <div className="text-sm font-semibold text-cove-streak-text bg-white/70 px-3 py-2 rounded-[10px]">
                                                                        💡{' '}
                                                                        <strong>
                                                                            Recommendation:
                                                                        </strong>{' '}
                                                                        {pattern.recommendation}
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
                </>
            )}

            <ReflectionSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};

export default ReflectionPage;
