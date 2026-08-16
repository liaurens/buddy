import React, { useMemo, useState } from 'react';
import type { Task, RecurrencePattern } from '../../tasks/types';
import { TASK_FLAG_META } from '../../tasks/utils/taskFlags';
import {
    isDestinationReady,
    type TriageDestination,
    type TriageDetail,
} from '../../tasks/utils/triageRouting';
import type { TaskTriageSuggestion } from '../../assistant/services/ai-actions.service';
import { suggestionToDetail } from '../../tasks/utils/triageConfidence';

/** The three destinations that cover most captures — one tap, no detail needed. */
const QUICK: TriageDestination[] = ['today', 'someday', 'school'];
/** The rest, behind "more…" because each needs a decision or a detail. */
const MORE: TriageDestination[] = ['urgent', 'deadline', 'waiting', 'routine'];

const CADENCES: Array<{ value: RecurrencePattern; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

interface TriageCardProps {
    task: Task;
    remaining: number;
    suggestion?: TaskTriageSuggestion;
    /** True while the AI is still thinking about this batch. */
    thinking?: boolean;
    busy?: boolean;
    onRoute: (destination: TriageDestination, detail: TriageDetail) => void;
}

/**
 * The capture inbox, one task at a time.
 *
 * Three quick destinations apply on a single tap. The four that need a
 * decision — urgent, deadline, waiting, routine — live behind "more…" and
 * reveal exactly the one input they require, gated by `isDestinationReady`
 * so a half-configured destination can never be applied.
 */
const TriageCard: React.FC<TriageCardProps> = ({
    task,
    remaining,
    suggestion,
    thinking,
    busy,
    onRoute,
}) => {
    const [expanded, setExpanded] = useState<TriageDestination | null>(null);
    const [detail, setDetail] = useState<TriageDetail>({});
    const [showMore, setShowMore] = useState(false);

    // The AI's inferred profile (estimate, energy, type…) rides along with a
    // quick tap, so accepting its suggestion keeps everything it worked out.
    const aiDetail = useMemo(
        () => (suggestion ? suggestionToDetail(suggestion) : {}),
        [suggestion],
    );

    const quickRoute = (destination: TriageDestination) => {
        if (busy) return;
        const base = suggestion?.destination === destination ? aiDetail : {};
        onRoute(destination, base);
    };

    const openDetail = (destination: TriageDestination) => {
        const seed: TriageDetail = suggestion?.destination === destination ? { ...aiDetail } : {};
        if (destination === 'routine') seed.recurrence = seed.recurrence ?? 'daily';
        setDetail(seed);
        setExpanded(destination);
    };

    const confirmDetail = () => {
        if (!expanded || busy || !isDestinationReady(expanded, detail)) return;
        onRoute(expanded, detail);
        setExpanded(null);
        setDetail({});
        setShowMore(false);
    };

    const suggested = suggestion?.destination;

    return (
        <div className="mb-3.5 rounded-card-lg bg-cove-tint-amber p-4 shadow-[0_3px_12px_rgba(40,90,130,0.07)]">
            <div className="mb-2.5 text-sm font-extrabold text-cove-streak-text">
                {remaining} to sort — one at a time
                {thinking ? ' (Buddy is thinking…)' : ''}
            </div>

            <div className="rounded-[14px] bg-white p-3.5">
                <div className="text-[14.5px] font-extrabold leading-[1.35] text-cove-ink">
                    {task.title}
                </div>
                {suggestion?.reason ? (
                    <div className="mt-1.5 text-[12px] font-semibold italic text-cove-faint">
                        Buddy thinks {TASK_FLAG_META[suggested!].label.toLowerCase()} —{' '}
                        {suggestion.reason}
                    </div>
                ) : null}
            </div>

            {expanded ? (
                <div className="cove-fadeslide mt-2.5 rounded-[14px] bg-white p-3.5">
                    <div className="mb-2 text-[13px] font-extrabold text-cove-ink">
                        {TASK_FLAG_META[expanded].emoji} {TASK_FLAG_META[expanded].label} —{' '}
                        {TASK_FLAG_META[expanded].description}
                    </div>

                    {expanded === 'deadline' ? (
                        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-cove-muted">
                            When is it actually due?
                            <input
                                type="date"
                                value={detail.dueDate ?? ''}
                                onChange={(e) =>
                                    setDetail((d) => ({ ...d, dueDate: e.target.value }))
                                }
                                className="rounded-xl border border-cove-border bg-white px-3 py-2 text-[14px] font-bold text-cove-ink"
                            />
                        </label>
                    ) : null}

                    {expanded === 'waiting' ? (
                        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-cove-muted">
                            Who are you waiting on?
                            <input
                                type="text"
                                value={detail.waitingOn ?? ''}
                                placeholder="e.g. Alex, the insurer"
                                onChange={(e) =>
                                    setDetail((d) => ({ ...d, waitingOn: e.target.value }))
                                }
                                className="rounded-xl border border-cove-border bg-white px-3 py-2 text-[14px] font-bold text-cove-ink placeholder:text-cove-faint"
                            />
                        </label>
                    ) : null}

                    {expanded === 'routine' ? (
                        <div className="flex flex-wrap gap-1.5">
                            {CADENCES.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() =>
                                        setDetail((d) => ({ ...d, recurrence: c.value }))
                                    }
                                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold ${
                                        detail.recurrence === c.value
                                            ? 'bg-cove-ink text-white'
                                            : 'bg-cove-tint-blue text-cove-muted'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {expanded === 'urgent' ? (
                        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-cove-muted">
                            What day? (Buddy picks one if you leave it blank)
                            <input
                                type="date"
                                value={detail.plannedFor ?? ''}
                                onChange={(e) =>
                                    setDetail((d) => ({ ...d, plannedFor: e.target.value }))
                                }
                                className="rounded-xl border border-cove-border bg-white px-3 py-2 text-[14px] font-bold text-cove-ink"
                            />
                        </label>
                    ) : null}

                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            disabled={busy || !isDestinationReady(expanded, detail)}
                            onClick={confirmDetail}
                            className="flex-1 rounded-xl bg-cove-ink py-[11px] text-[13px] font-extrabold text-white disabled:opacity-40"
                        >
                            Sort it
                        </button>
                        <button
                            type="button"
                            onClick={() => setExpanded(null)}
                            className="rounded-xl bg-white px-4 py-[11px] text-[13px] font-extrabold text-cove-muted"
                        >
                            Back
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mt-2.5 flex gap-2">
                        {QUICK.map((d) => (
                            <button
                                key={d}
                                type="button"
                                disabled={busy}
                                onClick={() => quickRoute(d)}
                                className={`flex-1 rounded-xl py-[11px] text-[13px] font-extrabold disabled:opacity-60 ${
                                    suggested === d
                                        ? 'bg-cove-ink text-white'
                                        : 'bg-white text-cove-ink'
                                }`}
                            >
                                {d === 'someday' ? 'Later' : TASK_FLAG_META[d].label}
                            </button>
                        ))}
                    </div>

                    {suggested && MORE.includes(suggested) ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => openDetail(suggested)}
                            className="mt-2 w-full rounded-xl bg-cove-streak py-[11px] text-[13px] font-extrabold text-white disabled:opacity-60"
                        >
                            {TASK_FLAG_META[suggested].emoji} {TASK_FLAG_META[suggested].label} —{' '}
                            {TASK_FLAG_META[suggested].description.toLowerCase()}
                        </button>
                    ) : null}

                    {showMore ? (
                        <div className="cove-fadeslide mt-2 flex flex-wrap gap-1.5">
                            {MORE.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => openDetail(d)}
                                    className="rounded-full bg-white px-3 py-2 text-[12.5px] font-extrabold text-cove-muted disabled:opacity-60"
                                >
                                    {TASK_FLAG_META[d].emoji} {TASK_FLAG_META[d].label}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => setShowMore((v) => !v)}
                        className="mt-1.5 w-full bg-transparent p-1 text-[12.5px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted"
                    >
                        {showMore ? 'Fewer options ⌃' : 'More options ⌄'}
                    </button>
                </>
            )}
        </div>
    );
};

export default TriageCard;
