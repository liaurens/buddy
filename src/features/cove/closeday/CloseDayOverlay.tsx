import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../../tasks/hooks/useTasks';
import { closeDay, getCloseStreak } from '../../planning/services/closeDay.service';
import { saveReflectionItems } from '../../planning/services/reflectionCapture';
import { markRoutineDone } from '../../day/services/routine-progress';
import { useToast } from '../../../components/ui/Toast';
import type { Task } from '../../tasks/types';
import { Whale, Confetti, MoodRow, EnergyRow, Fold } from '../components';
import type { EnergyIndex, MoodIndex } from '../components';
import { usePrefersReducedMotion } from '../hooks/useCelebration';
import { saveMoodEnergy } from '../services/moodEnergy.service';
import { energyToScale, moodToScale } from '../services/moodScale';
import {
    addResolution,
    buildLeftoverResolution,
    EMPTY_COUNTS,
    leftoverIntro,
    summarizeResolutions,
    type LeftoverAction,
} from './leftoverResolution';

type ClosePhase = 'leftovers' | 'reflect' | 'celebrate';

interface CloseDayOverlayProps {
    dateKey: string;
    /** Today's visible picks (survival slice applied by the caller). */
    picks: Task[];
    onClose: () => void;
}

const inputClass =
    'w-full rounded-[10px] border-0 bg-white/10 px-3 py-[11px] text-sm font-bold text-white outline-none placeholder:text-white/40';

const overlayLabel = 'mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-cove-soft';

/**
 * Full-screen close-day flow: leftover resolution (nothing carries over
 * silently) → light reflection → celebration with the streak.
 */
const CloseDayOverlay: React.FC<CloseDayOverlayProps> = ({ dateKey, picks, onClose }) => {
    const { user } = useAuth();
    const toast = useToast();
    const queryClient = useQueryClient();
    const reducedMotion = usePrefersReducedMotion();
    const { rescheduleMany, updateTask, toggleTask, deleteTask, addTask } = useTasks();

    const tomorrowKey = format(addDays(new Date(`${dateKey}T12:00:00`), 1), 'yyyy-MM-dd');
    const doneCount = picks.filter((p) => p.completed).length;
    const leftovers = useMemo(() => picks.filter((p) => !p.completed), [picks]);

    const [phase, setPhase] = useState<ClosePhase>(() =>
        leftovers.length > 0 ? 'leftovers' : 'reflect',
    );
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [editing, setEditing] = useState<{
        taskId: string;
        mode: 'rename' | 'followUp';
        value: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);

    const [mood, setMood] = useState<MoodIndex | null>(null);
    const [energy, setEnergy] = useState<EnergyIndex | null>(null);
    const [journalLine, setJournalLine] = useState('');
    const [workedLine, setWorkedLine] = useState('');
    const [hardLine, setHardLine] = useState('');
    const [easierLine, setEasierLine] = useState('');
    const [streakAfterClose, setStreakAfterClose] = useState<number | null>(null);

    // Leftovers resolve one by one; when the list drains, move on to reflection.
    useEffect(() => {
        if (phase === 'leftovers' && leftovers.length === 0) {
            setPhase('reflect');
        }
    }, [phase, leftovers.length]);

    const resolve = async (task: Task, action: LeftoverAction, text?: string) => {
        const resolution = buildLeftoverResolution(task.id, action, text);
        if (!resolution || busy) return;
        setBusy(true);
        try {
            if (resolution.action === 'tomorrow') {
                await rescheduleMany([task.id], tomorrowKey);
            } else if (resolution.action === 'rename') {
                await updateTask({ ...task, title: resolution.text!, plannedFor: tomorrowKey });
            } else if (resolution.action === 'followUp') {
                await toggleTask(task.id);
                await addTask(resolution.text!);
            } else {
                await deleteTask(task.id);
            }
            setCounts((c) => addResolution(c, resolution.action));
            setEditing(null);
        } catch (err) {
            console.error('Failed to resolve leftover:', err);
            toast.error('Could not save that — try again.');
        } finally {
            setBusy(false);
        }
    };

    const handleMood = (value: MoodIndex) => {
        setMood(value);
        if (user?.id) {
            saveMoodEnergy(user.id, dateKey, { mood: moodToScale(value) }).catch((err) =>
                console.error('Failed to save mood:', err),
            );
        }
    };
    const handleEnergy = (value: EnergyIndex) => {
        setEnergy(value);
        if (user?.id) {
            saveMoodEnergy(user.id, dateKey, { energy: energyToScale(value) }).catch((err) =>
                console.error('Failed to save energy:', err),
            );
        }
    };

    const finishClose = async () => {
        if (!user?.id || busy) return;
        setBusy(true);
        try {
            await saveReflectionItems(user.id, dateKey, [
                { subtype: 'reflection_memory', text: journalLine },
                { subtype: 'reflection_win', text: workedLine },
                { subtype: 'reflection_challenge', text: hardLine },
                { subtype: 'reflection_priority', text: easierLine },
            ]);
            await closeDay(user.id, dateKey);
            markRoutineDone('night', dateKey);
            const streak = await getCloseStreak(user.id);
            setStreakAfterClose(streak);
            void queryClient.invalidateQueries({ queryKey: ['closeStreak', user.id] });
            void queryClient.invalidateQueries({ queryKey: ['closedDatesThisWeek', user.id] });
            setPhase('celebrate');
        } catch (err) {
            console.error('Failed to close the day:', err);
            toast.error('Could not close the day — try again.');
        } finally {
            setBusy(false);
        }
    };

    const closeSummary =
        picks.length === 0
            ? 'Everything sorted · routine kept'
            : `${doneCount} of ${picks.length} picks done · routine kept`;
    const celebrateSummary =
        picks.length === 0
            ? 'Everything sorted for today'
            : `${doneCount} of ${picks.length} picks done`;
    const closedNote = summarizeResolutions(counts);

    return (
        <div className="cove-overlayin fixed inset-0 z-50 flex justify-center bg-cove-overlay/60">
            <div
                className="flex min-h-full w-full max-w-[520px] flex-col items-center gap-3.5 overflow-y-auto bg-cove-overlay px-7 pb-8 pt-10 text-center text-white"
                style={{ justifyContent: 'safe center' }}
                role="dialog"
                aria-modal="true"
                aria-label="Close the day"
            >
                {phase === 'celebrate' && !reducedMotion ? (
                    <Confetti variant="big" className="left-1/2 top-1/3" />
                ) : null}

                <Whale size="overlay" color="#7cc3e8" />

                {phase === 'leftovers' ? (
                    <>
                        <div className="text-[22px] font-black leading-tight">Before we close…</div>
                        <div className="max-w-[300px] text-[13.5px] font-bold leading-normal text-cove-overlay-muted">
                            {leftoverIntro(leftovers.length)} Nothing carries over silently — decide
                            for each one.
                        </div>
                        <div className="flex w-full max-w-[340px] flex-col gap-2.5">
                            {leftovers.map((task) => {
                                const isEditing = editing?.taskId === task.id;
                                return (
                                    <div
                                        key={task.id}
                                        className="rounded-card bg-white/[.08] p-3.5 text-left"
                                    >
                                        {!isEditing ? (
                                            <>
                                                <div className="text-[14.5px] font-extrabold leading-[1.35] text-white">
                                                    {task.title}
                                                </div>
                                                <div className="mt-[11px] grid grid-cols-2 gap-[7px]">
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void resolve(task, 'tomorrow')
                                                        }
                                                        className="rounded-[11px] bg-white p-2.5 text-[12.5px] font-extrabold text-cove-ink"
                                                    >
                                                        → Tomorrow
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setEditing({
                                                                taskId: task.id,
                                                                mode: 'followUp',
                                                                value: '',
                                                            })
                                                        }
                                                        className="rounded-[11px] bg-white/[.16] p-2.5 text-[12.5px] font-extrabold text-white"
                                                    >
                                                        Done, but…
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setEditing({
                                                                taskId: task.id,
                                                                mode: 'rename',
                                                                value: task.title,
                                                            })
                                                        }
                                                        className="rounded-[11px] bg-white/[.16] p-2.5 text-[12.5px] font-extrabold text-white"
                                                    >
                                                        Rename
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => void resolve(task, 'letGo')}
                                                        className="rounded-[11px] bg-white/[.16] p-2.5 text-[12.5px] font-extrabold text-cove-pink-accent"
                                                    >
                                                        Let it go
                                                    </button>
                                                </div>
                                            </>
                                        ) : editing.mode === 'rename' ? (
                                            <>
                                                <div className="mb-2 text-xs font-extrabold text-cove-overlay-muted">
                                                    Rename &amp; move to tomorrow
                                                </div>
                                                <input
                                                    value={editing.value}
                                                    onChange={(e) =>
                                                        setEditing({
                                                            ...editing,
                                                            value: e.target.value,
                                                        })
                                                    }
                                                    className={inputClass}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={busy || !editing.value.trim()}
                                                    onClick={() =>
                                                        void resolve(task, 'rename', editing.value)
                                                    }
                                                    className="mt-[9px] rounded-[11px] bg-white px-[18px] py-2.5 text-[12.5px] font-extrabold text-cove-ink disabled:opacity-50"
                                                >
                                                    Save → tomorrow
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-2 text-xs font-extrabold text-cove-overlay-muted">
                                                    Count it as done — what’s the follow-up task?
                                                </div>
                                                <input
                                                    value={editing.value}
                                                    onChange={(e) =>
                                                        setEditing({
                                                            ...editing,
                                                            value: e.target.value,
                                                        })
                                                    }
                                                    placeholder="e.g. ‘send the attachment’"
                                                    className={inputClass}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={busy || !editing.value.trim()}
                                                    onClick={() =>
                                                        void resolve(
                                                            task,
                                                            'followUp',
                                                            editing.value,
                                                        )
                                                    }
                                                    className="mt-[9px] rounded-[11px] bg-cove-success px-[18px] py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-50"
                                                >
                                                    Done ✓ + follow-up
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 text-[13px] font-bold text-cove-soft"
                        >
                            Not yet
                        </button>
                    </>
                ) : null}

                {phase === 'reflect' ? (
                    <>
                        <div className="text-2xl font-black leading-tight">Closing the day</div>
                        <div className="text-sm font-bold leading-normal text-cove-overlay-muted">
                            {closeSummary}
                        </div>

                        <div className="w-full max-w-[320px] rounded-card bg-white/[.08] p-4 text-left">
                            <div className={overlayLabel}>How was today?</div>
                            <MoodRow value={mood} onChange={handleMood} variant="dark" />
                            <div className={`${overlayLabel} mt-3.5`}>Energy</div>
                            <EnergyRow value={energy} onChange={handleEnergy} variant="dark" />
                            <div className={`${overlayLabel} mt-3.5`}>
                                One line about today{' '}
                                <span className="font-bold normal-case text-cove-muted">
                                    (optional)
                                </span>
                            </div>
                            <input
                                value={journalLine}
                                onChange={(e) => setJournalLine(e.target.value)}
                                placeholder="what stuck with you…"
                                className={inputClass}
                            />
                            <Fold
                                label="More reflection — the full questions"
                                openLabel="Less reflection"
                                className="mt-1"
                            >
                                <div className="mt-1.5 flex flex-col gap-2.5">
                                    <div>
                                        <div className={overlayLabel}>What went well?</div>
                                        <input
                                            value={workedLine}
                                            onChange={(e) => setWorkedLine(e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <div className={overlayLabel}>What was hard?</div>
                                        <input
                                            value={hardLine}
                                            onChange={(e) => setHardLine(e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <div className={overlayLabel}>
                                            What would make tomorrow easier?
                                        </div>
                                        <input
                                            value={easierLine}
                                            onChange={(e) => setEasierLine(e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </Fold>
                        </div>

                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void finishClose()}
                            className="mt-1 rounded-2xl bg-white px-[34px] py-[15px] text-[15px] font-extrabold text-cove-ink disabled:opacity-60"
                        >
                            Close the day ✓
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 text-[13px] font-bold text-cove-soft"
                        >
                            Not yet
                        </button>
                    </>
                ) : null}

                {phase === 'celebrate' ? (
                    <>
                        <div className="cove-fadeslide text-[26px] font-black leading-tight">
                            Day closed. You did it.
                        </div>
                        <div className="cove-fadeslide max-w-[280px] text-[15px] font-bold leading-relaxed text-cove-overlay-muted">
                            {celebrateSummary}
                            {streakAfterClose && streakAfterClose > 0 ? (
                                <>
                                    {' '}
                                    · streak is now{' '}
                                    <span className="text-cove-streak">
                                        {streakAfterClose} {streakAfterClose === 1 ? 'day' : 'days'}
                                    </span>
                                </>
                            ) : null}
                        </div>
                        {closedNote ? (
                            <div className="cove-fadeslide text-[13px] font-bold leading-normal text-cove-soft">
                                {closedNote}
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3.5 rounded-2xl bg-white px-[34px] py-[15px] text-[15px] font-extrabold text-cove-ink"
                        >
                            Good night, Buddy 🌙
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default CloseDayOverlay;
