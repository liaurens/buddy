import React, { useMemo } from 'react';
import type { Task } from '../../tasks/types';
import { rankMorningCandidates, suggestMorningPicks } from '../../day/utils/morningPick';

/** How many candidates the sheet offers at once — enough choice, no backlog. */
const PICK_SHEET_SLOTS = 6;

interface PickSheetProps {
    tasks: Task[];
    /** Today, yyyy-MM-dd. */
    today: string;
    /** Plan this task for today. The list self-updates: a picked task leaves it. */
    onPick: (taskId: string) => void;
    onClose: () => void;
}

/**
 * "Pick something small" — the Now screen's way to fill (or top up) today.
 *
 * Candidates come from the same deterministic ranking as the morning gate
 * (small-task bias, school cap), each with its reason spelled out. Tapping a
 * row plans it for today; because candidates exclude tasks already planned
 * today, the picked row disappears and the next-best moves up — so picking
 * two or three in a row is just two or three taps.
 */
const PickSheet: React.FC<PickSheetProps> = ({ tasks, today, onPick, onClose }) => {
    const candidates = useMemo(
        () => suggestMorningPicks(rankMorningCandidates(tasks, { today }), PICK_SHEET_SLOTS),
        [tasks, today],
    );

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-cove-overlay/40"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="cove-fadeslide flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] bg-cove-bg shadow-cove-strong"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Pick a task for today"
            >
                <div className="flex items-center justify-between border-b border-cove-border/60 px-5 py-3.5">
                    <span className="text-[15px] font-black text-cove-ink">
                        Pick something small
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-transparent p-1 text-[13px] font-extrabold text-cove-muted"
                    >
                        Done
                    </button>
                </div>

                {/* Bottom padding clears the iOS home indicator — this sheet is
                    fixed to the viewport, outside MainLayout's safe-area gutters. */}
                <div
                    className="flex-1 overflow-y-auto px-5 pt-3"
                    style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
                >
                    {candidates.length === 0 ? (
                        <p className="pb-4 text-[13.5px] font-bold text-cove-muted">
                            Nothing to pick from right now — capture a thought or two first.
                        </p>
                    ) : (
                        <>
                            <p className="pb-2.5 text-[12.5px] font-semibold text-cove-muted">
                                Smallest wins first — tap one to add it to today.
                            </p>
                            <div className="flex flex-col gap-2 pb-2">
                                {candidates.map((c) => (
                                    <button
                                        key={c.task.id}
                                        type="button"
                                        onClick={() => onPick(c.task.id)}
                                        className="flex w-full flex-col gap-0.5 rounded-card bg-white px-4 py-3 text-left shadow-cove"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-cove-ink">
                                                {c.task.title}
                                            </span>
                                            {c.task.estimatedTime ? (
                                                <span className="shrink-0 text-[11.5px] font-bold text-cove-faint">
                                                    {c.task.estimatedTime} min
                                                </span>
                                            ) : null}
                                        </span>
                                        {c.reason ? (
                                            <span className="text-[12px] font-semibold leading-snug text-cove-muted">
                                                {c.reason.split(', ').join(' · ')}
                                            </span>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PickSheet;
