import React, { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTodayItems } from '../../day/hooks/useTodayItems';
import { useDayCapacity } from '../../day/hooks/useDayCapacity';
import { useAssignments } from '../../school/hooks/useAssignments';
import { rankMorningCandidates, suggestMorningPicks } from '../../day/utils/morningPick';
import { useToast } from '../../../components/ui/Toast';
import { Whale, type EnergyIndex, type MoodIndex } from '../components';
import { saveMoodEnergy } from '../services/moodEnergy.service';
import { energyToScale, moodToScale } from '../services/moodScale';
import { gateGreeting, gateSubline } from './gateState';
import { useCheckinStatus } from './useCheckinStatus';
import StepChips, { type GateStep } from './StepChips';
import CommsStep from './CommsStep';
import YesterdayStep from './YesterdayStep';
import PlanStep from './PlanStep';

const UPCOMING_DEADLINES_SHOWN = 4;

interface CheckInGateProps {
    dateKey: string;
}

/**
 * The morning check-in gate — rendered instead of every route until today's
 * check-in is done or explicitly skipped (per the Cove spec, the whole app
 * waits behind it).
 */
const CheckInGate: React.FC<CheckInGateProps> = ({ dateKey }) => {
    const { user } = useAuth();
    const toast = useToast();
    const hour = new Date().getHours();
    const yesterdayKey = format(subDays(new Date(`${dateKey}T12:00:00`), 1), 'yyyy-MM-dd');

    const { markDone, markSkipped, isSaving } = useCheckinStatus(dateKey);
    const { capacity, setCapacity } = useDayCapacity(dateKey);
    const { tasks, rescheduleMany } = useTasks();
    const { picks } = useTodayItems(dateKey);
    const { assignments } = useAssignments({ activeOnly: true });

    const survival = capacity === 'survival';
    const slots = survival ? 1 : 3;

    const [step, setStep] = useState<GateStep>(() => {
        try {
            const saved = sessionStorage.getItem(`cove_gate_step_${dateKey}`);
            return saved !== null ? (Math.min(2, Math.max(0, Number(saved))) as GateStep) : 0;
        } catch {
            return 0;
        }
    });
    useEffect(() => {
        try {
            sessionStorage.setItem(`cove_gate_step_${dateKey}`, String(step));
        } catch {
            /* ignore */
        }
    }, [step, dateKey]);

    const [mood, setMood] = useState<MoodIndex | null>(null);
    const [energy, setEnergy] = useState<EnergyIndex | null>(null);
    const [intention, setIntention] = useState<string>(() => {
        try {
            return sessionStorage.getItem(`cove_intention_${dateKey}`) ?? '';
        } catch {
            return '';
        }
    });
    useEffect(() => {
        try {
            sessionStorage.setItem(`cove_intention_${dateKey}`, intention);
        } catch {
            /* ignore */
        }
    }, [intention, dateKey]);

    const handleMood = (value: MoodIndex) => {
        setMood(value);
        if (user?.id) {
            saveMoodEnergy(user.id, yesterdayKey, { mood: moodToScale(value) }).catch((err) =>
                console.error('Failed to save mood:', err),
            );
        }
    };
    const handleEnergy = (value: EnergyIndex) => {
        setEnergy(value);
        if (user?.id) {
            saveMoodEnergy(user.id, yesterdayKey, { energy: energyToScale(value) }).catch((err) =>
                console.error('Failed to save energy:', err),
            );
        }
    };

    // Today's plan = picks already planned for today plus deterministic
    // suggestions to fill the remaining slots (smallest wins first).
    const existingPicks = useMemo(() => picks.filter((p) => !p.completed), [picks]);
    const suggestions = useMemo(() => {
        const remaining = slots - existingPicks.length;
        if (remaining <= 0) return [];
        const plannedIds = new Set(existingPicks.map((p) => p.id));
        const ranked = rankMorningCandidates(tasks, { today: dateKey }).filter(
            (c) => !plannedIds.has(c.task.id),
        );
        return suggestMorningPicks(ranked, remaining);
    }, [tasks, existingPicks, slots, dateKey]);

    const planPicks = useMemo(
        () => [
            ...existingPicks.slice(0, slots).map((task) => ({ task, suggested: false })),
            ...suggestions.map((c) => ({ task: c.task, suggested: true })),
        ],
        [existingPicks, suggestions, slots],
    );

    const upcomingDeadlines = useMemo(
        () => assignments.slice(0, UPCOMING_DEADLINES_SHOWN),
        [assignments],
    );

    const finishDay = async () => {
        if (isSaving) return;
        try {
            const suggestedIds = suggestions.map((c) => c.task.id);
            if (suggestedIds.length > 0) {
                await rescheduleMany(suggestedIds, dateKey);
            }
            await markDone({ intention });
        } catch (err) {
            console.error('Failed to finish check-in:', err);
            toast.error('Could not save the check-in. Try again.');
        }
    };

    const skip = async () => {
        if (isSaving) return;
        try {
            await markSkipped();
        } catch (err) {
            console.error('Failed to skip check-in:', err);
            toast.error('Could not skip the check-in. Try again.');
        }
    };

    return (
        <div className="cove-fadeslide flex min-h-full flex-1 flex-col">
            <div className="flex items-center gap-3.5 pb-1 pt-2">
                <Whale size="gate" />
                <div>
                    <div className="text-[21px] font-black leading-[1.2] text-cove-ink">
                        {gateGreeting(hour)}
                    </div>
                    <div className="text-[13.5px] font-semibold leading-snug text-cove-muted">
                        {gateSubline(hour)}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex gap-1.5 rounded-[14px] bg-[#d7e9f2] p-[5px]">
                <button
                    type="button"
                    onClick={() => void setCapacity('normal')}
                    className="flex-1 rounded-[10px] py-2.5 text-[13px] font-extrabold"
                    style={{
                        background: !survival ? '#fff' : 'transparent',
                        color: !survival ? '#1d3a4d' : '#7fa6bb',
                        boxShadow: !survival ? '0 2px 8px rgba(40,90,130,.12)' : 'none',
                    }}
                >
                    Normal day
                </button>
                <button
                    type="button"
                    onClick={() => void setCapacity('survival')}
                    className="flex-1 rounded-[10px] py-2.5 text-[13px] font-extrabold"
                    style={{
                        background: survival ? '#fff' : 'transparent',
                        color: survival ? '#2e6e50' : '#7fa6bb',
                        boxShadow: survival ? '0 2px 8px rgba(40,90,130,.12)' : 'none',
                    }}
                >
                    Survival day
                </button>
            </div>
            {survival ? (
                <div className="cove-fadeslide mt-2.5 rounded-[14px] bg-[#dff2ea] px-3.5 py-[11px] text-[12.5px] font-bold leading-normal text-[#2e6e50]">
                    Survival mode: one task is enough today. Only anchor reminders will reach you.
                </div>
            ) : null}

            <StepChips step={step} onStep={setStep} />

            {step === 0 ? <CommsStep dateKey={dateKey} /> : null}
            {step === 1 ? (
                <YesterdayStep
                    mood={mood}
                    energy={energy}
                    onMood={handleMood}
                    onEnergy={handleEnergy}
                />
            ) : null}
            {step === 2 ? (
                <PlanStep
                    survival={survival}
                    intention={intention}
                    onIntention={setIntention}
                    picks={planPicks}
                    deadlines={upcomingDeadlines}
                />
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-5">
                {step < 2 ? (
                    <button
                        type="button"
                        onClick={() => setStep((s) => Math.min(2, s + 1) as GateStep)}
                        className="rounded-2xl bg-cove-accent p-4 text-[15px] font-extrabold text-white shadow-cove-strong"
                    >
                        Next →
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void finishDay()}
                        disabled={isSaving}
                        className="rounded-2xl bg-cove-success p-4 text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(61,138,99,0.25)] disabled:opacity-60"
                    >
                        Start my day →
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => void skip()}
                    disabled={isSaving}
                    className="p-[7px] text-[13px] font-bold text-cove-soft transition-colors hover:text-[#3a7fb0]"
                >
                    Skip the check-in today
                </button>
            </div>
        </div>
    );
};

export default CheckInGate;
