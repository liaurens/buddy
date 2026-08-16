import React, { useState } from 'react';
import type { Task } from '../../tasks/types';
import { TASK_FLAG_META, TASK_FLAG_ORDER, deriveTaskFlag } from '../../tasks/utils/taskFlags';
import type { TriageDestination } from '../../tasks/utils/triageRouting';

/**
 * One-tap reasons, phrased as the user would say them.
 *
 * Chips rather than free text because they are one tap on a phone and they
 * produce consistent wording — the learnings doc is fed straight back into the
 * next triage prompt, and "not urgent" repeated ten times teaches more than ten
 * different phrasings of the same thing. The note field catches the rest.
 */
export const CORRECTION_REASONS = [
    'not urgent',
    'wrong day',
    "that's school",
    'too big for today',
    "I'll never do this",
    'needs a real deadline',
    "I'm waiting on someone",
] as const;

interface CorrectionSheetProps {
    task: Task;
    onCorrect: (destination: TriageDestination, reason?: string) => void | Promise<void>;
    onClose: () => void;
}

/** Plain-language confidence, so a shaky call invites a correction instead of hiding. */
export function confidenceWord(confidence?: number): string | null {
    if (confidence == null) return null;
    if (confidence >= 0.95) return 'sure';
    if (confidence >= 0.85) return 'pretty sure';
    return 'fairly sure';
}

const CorrectionSheet: React.FC<CorrectionSheetProps> = ({ task, onCorrect, onClose }) => {
    const current = deriveTaskFlag(task);
    const [destination, setDestination] = useState<TriageDestination>(current);
    const [reason, setReason] = useState<string>('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const changed = destination !== current;
    const finalReason = note.trim() || reason;

    const submit = async () => {
        if (saving || !changed) return;
        setSaving(true);
        try {
            await onCorrect(destination, finalReason || undefined);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-cove-overlay/40"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="cove-fadeslide w-full max-w-lg rounded-t-[22px] bg-cove-bg px-5 pt-4"
                style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Fix where Buddy put this"
            >
                <div className="text-[15px] font-black text-cove-ink">Where should this go?</div>
                <div className="pt-1 text-[13.5px] font-bold text-cove-muted">{task.title}</div>
                {task.triageReason ? (
                    <div className="pt-1.5 text-[12px] font-semibold italic text-cove-faint">
                        Buddy was {confidenceWord(task.triageConfidence) ?? 'fairly sure'}:{' '}
                        {task.triageReason}
                    </div>
                ) : null}

                <div className="flex flex-wrap gap-1.5 pt-3.5">
                    {TASK_FLAG_ORDER.map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setDestination(f)}
                            className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition-colors ${
                                destination === f
                                    ? 'bg-cove-ink text-white'
                                    : 'bg-cove-tint-blue text-cove-muted'
                            }`}
                        >
                            {TASK_FLAG_META[f].emoji} {TASK_FLAG_META[f].label}
                        </button>
                    ))}
                </div>

                {changed ? (
                    <div className="cove-fadeslide">
                        <div className="pb-1.5 pt-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-cove-faint">
                            Why? (optional — it teaches Buddy)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {CORRECTION_REASONS.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setReason(reason === r ? '' : r)}
                                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                                        reason === r
                                            ? 'bg-cove-accent text-white'
                                            : 'bg-white text-cove-muted'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="or say it in your own words"
                            className="mt-2.5 w-full rounded-xl border border-cove-border bg-white px-3 py-2.5 text-[14px] font-bold text-cove-ink outline-none placeholder:text-cove-faint focus:border-cove-accent"
                        />
                    </div>
                ) : null}

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        disabled={!changed || saving}
                        onClick={() => void submit()}
                        className="flex-1 rounded-xl bg-cove-accent py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
                    >
                        {changed ? 'Fix it' : 'Pick a different one'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-white px-4 py-3 text-[13px] font-extrabold text-cove-muted"
                    >
                        {changed ? 'Cancel' : 'It was right'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CorrectionSheet;
