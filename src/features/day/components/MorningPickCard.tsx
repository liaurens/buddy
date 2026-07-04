import React, { useMemo, useState, useEffect } from 'react';
import { Check, Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useToast } from '../../../components/ui/Toast';
import {
    rankMorningCandidates,
    suggestMorningPicks,
    type MorningCandidate,
} from '../utils/morningPick';
import type { Task } from '../../tasks/types';

interface Props {
    /** yyyy-MM-dd — the day picks are scheduled onto. */
    dateKey: string;
    accent: 'amber' | 'indigo';
    /** How many suggestions to offer (3 normal, 1 survival). */
    slots?: number;
    /** Whether the full "Add from your tasks" picker below is expanded. */
    fullPickerOpen?: boolean;
    /** Toggle the full picker (the soft-cap escape hatch). */
    onToggleFullPicker?: () => void;
}

const ACCENTS = {
    amber: {
        add: 'bg-amber-500 hover:bg-amber-600',
        ring: 'focus:ring-amber-300',
        chip: 'bg-amber-50 text-amber-700',
    },
    indigo: {
        add: 'bg-indigo-500 hover:bg-indigo-600',
        ring: 'focus:ring-indigo-300',
        chip: 'bg-indigo-50 text-indigo-700',
    },
} as const;

function readIds(key: string): string[] {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

/**
 * Deterministic morning pick — offers a few small, concrete tasks for today.
 * No AI involved: candidates come from the pure morningPick scorer, so this
 * card always works. Accepted and swapped-away suggestions are remembered per
 * day (sessionStorage) so the slots don't refill endlessly.
 */
const MorningPickCard: React.FC<Props> = ({
    dateKey,
    accent,
    slots = 3,
    fullPickerOpen,
    onToggleFullPicker,
}) => {
    const { tasks, rescheduleMany } = useTasks();
    const toast = useToast();
    const colors = ACCENTS[accent];

    const acceptedKey = `morning_pick_accepted_${dateKey}`;
    const swappedKey = `morning_pick_swapped_${dateKey}`;

    const [acceptedIds, setAcceptedIds] = useState<string[]>(() => readIds(acceptedKey));
    const [swappedIds, setSwappedIds] = useState<string[]>(() => readIds(swappedKey));
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        try { sessionStorage.setItem(acceptedKey, JSON.stringify(acceptedIds)); } catch { /* ignore */ }
    }, [acceptedIds, acceptedKey]);
    useEffect(() => {
        try { sessionStorage.setItem(swappedKey, JSON.stringify(swappedIds)); } catch { /* ignore */ }
    }, [swappedIds, swappedKey]);

    const ranked = useMemo(
        () => rankMorningCandidates(tasks, { today: dateKey }),
        [tasks, dateKey],
    );

    // Accepted tasks keep their slot (shown checked); remaining slots are filled
    // by the best candidates not already shown or dismissed.
    const acceptedTasks = useMemo(
        () =>
            acceptedIds
                .map((id) => tasks.find((t) => t.id === id))
                .filter((t): t is Task => !!t && !t.completed),
        [acceptedIds, tasks],
    );

    const suggestions = useMemo(() => {
        const used = new Set([...acceptedIds, ...swappedIds]);
        const openSlots = Math.max(0, slots - acceptedTasks.length);
        return suggestMorningPicks(
            ranked.filter((c) => !used.has(c.task.id)),
            openSlots,
        );
    }, [ranked, acceptedIds, swappedIds, acceptedTasks.length, slots]);

    const handleAccept = async (candidate: MorningCandidate) => {
        if (busyId) return;
        setBusyId(candidate.task.id);
        try {
            await rescheduleMany([candidate.task.id], dateKey);
            setAcceptedIds((prev) => [...prev, candidate.task.id]);
        } catch (err) {
            console.error('Failed to accept morning pick:', err);
            toast.error('Could not add to today.');
        } finally {
            setBusyId(null);
        }
    };

    const handleSwap = (candidate: MorningCandidate) => {
        setSwappedIds((prev) => [...prev, candidate.task.id]);
    };

    const nothingLeft = acceptedTasks.length === 0 && suggestions.length === 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <div>
                <h3 className="font-semibold text-slate-900">Pick what today gets</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                    {slots === 1
                        ? 'One small thing is enough today.'
                        : `A few small things — ${slots} is plenty.`}
                </p>
            </div>

            {nothingLeft ? (
                <p className="text-sm text-slate-400">
                    Nothing to suggest right now — your open tasks are already on today.
                </p>
            ) : (
                <ul className="space-y-2">
                    {acceptedTasks.map((task) => (
                        <li
                            key={task.id}
                            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                        >
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                <Check size={12} className="text-white" />
                            </div>
                            <span className="text-sm font-medium text-emerald-900 flex-1 truncate">
                                {task.title}
                            </span>
                            {task.estimatedTime && (
                                <span className="text-xs text-emerald-700 flex-shrink-0">
                                    {task.estimatedTime}m
                                </span>
                            )}
                        </li>
                    ))}
                    {suggestions.map((candidate) => (
                        <li
                            key={candidate.task.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                    {candidate.task.title}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{candidate.reason}</p>
                            </div>
                            {candidate.task.estimatedTime && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ${colors.chip}`}>
                                    {candidate.task.estimatedTime}m
                                </span>
                            )}
                            <button
                                onClick={() => handleSwap(candidate)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                                aria-label={`Swap out ${candidate.task.title}`}
                                title="Show a different task"
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                onClick={() => handleAccept(candidate)}
                                disabled={busyId === candidate.task.id}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ${colors.add}`}
                            >
                                <Plus size={13} /> Add
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {onToggleFullPicker && (
                <button
                    onClick={onToggleFullPicker}
                    className="w-full flex items-center justify-center gap-1 pt-2 border-t border-slate-100 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                    {fullPickerOpen ? (
                        <>Hide full list <ChevronUp size={13} /></>
                    ) : (
                        <>Add more from your full list <ChevronDown size={13} /></>
                    )}
                </button>
            )}
        </div>
    );
};

export default MorningPickCard;
