import { useCallback, useState } from 'react';
import { useTaskTriage } from '../../tasks/hooks/useTaskTriage';
import { deriveTaskFlag, TASK_FLAG_META } from '../../tasks/utils/taskFlags';
import type { Task } from '../../tasks/types';
import type { TriageDestination } from '../../tasks/utils/triageRouting';
import { useToast } from '../../../components/ui/Toast';
import CorrectionSheet, { confidenceWord } from './CorrectionSheet';

/**
 * "Buddy sorted these — tap to fix."
 *
 * Shared by the Tasks page and the Capture page so a correction can be made
 * wherever the user notices the sort landed wrong. Both render the same rows
 * and the same CorrectionSheet; only the surrounding wrapper differs.
 */
export function useAutoSortReview() {
    const { autoSortedToday, applyRoutes } = useTaskTriage();
    const toast = useToast();
    const [correcting, setCorrecting] = useState<Task | null>(null);

    const correct = useCallback(
        async (task: Task, destination: TriageDestination, reason?: string) => {
            try {
                await applyRoutes([
                    {
                        taskId: task.id,
                        destination,
                        detail: {},
                        aiDestination: deriveTaskFlag(task),
                        wasAuto: true,
                        reason,
                    },
                ]);
                toast.success('Thanks — Buddy will remember that.');
            } catch (err) {
                console.error('Failed to correct sort:', err);
                toast.error('Could not change that — try again.');
            }
        },
        [applyRoutes, toast],
    );

    const rows = autoSortedToday.map((task) => {
        const meta = TASK_FLAG_META[deriveTaskFlag(task)];
        const word = confidenceWord(task.triageConfidence);
        return (
            <button
                key={task.id}
                type="button"
                onClick={() => setCorrecting(task)}
                className="flex w-full items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-left shadow-cove"
            >
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-extrabold text-cove-ink">
                        {task.title}
                    </span>
                    {task.triageReason || word ? (
                        <span className="block truncate pt-0.5 text-[11.5px] font-semibold text-cove-faint">
                            {/*
                             * Capitalised, so the row opens on a word rather than
                             * the sentence fragment "sure — Task has no specific…".
                             * The sheet gives the confidence word its subject
                             * ("Buddy was sure:"); the row has no space for that,
                             * so it at least has to start like a sentence.
                             */}
                            {word ? `${word.charAt(0).toUpperCase()}${word.slice(1)} — ` : ''}
                            {task.triageReason ?? 'sorted for you'}
                        </span>
                    ) : null}
                </span>
                <span className="shrink-0 rounded-[7px] bg-cove-tint-blue px-2 py-0.5 text-[10.5px] font-extrabold text-[#3a7fb0]">
                    {meta.emoji} {meta.label}
                </span>
            </button>
        );
    });

    const sheet = correcting ? (
        <CorrectionSheet
            task={correcting}
            onCorrect={(destination, reason) => correct(correcting, destination, reason)}
            onClose={() => setCorrecting(null)}
        />
    ) : null;

    return { count: autoSortedToday.length, rows, sheet };
}
