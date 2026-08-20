import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Subtask, Task } from '../../tasks/types';
import {
    addSubtask,
    removeSubtask,
    subtaskProgress,
    toggleSubtask,
} from '../../tasks/utils/subtasks';
import AITaskSplitter from '../../tasks/components/AITaskSplitter';
import { PickCircle } from '../components';
import { inputClass } from './sheetStyles';

interface SheetStepsSectionProps {
    draft: Task;
    onChange: (subtasks: Subtask[]) => void;
    /** Open the splitter straight away — the "Feeling stuck? Split it" entry. */
    autoSplit?: boolean;
}

/**
 * "Steps" — the subtask list, plus the AI splitter for when a task is too big
 * to start. Steps live in the draft and persist with Save (the `subtasks`
 * column and its converter already round-trip), so nothing here writes.
 */
const SheetStepsSection: React.FC<SheetStepsSectionProps> = ({ draft, onChange, autoSplit }) => {
    const [newStep, setNewStep] = useState('');
    const [splitting, setSplitting] = useState(!!autoSplit);

    const steps = draft.subtasks ?? [];
    const progress = subtaskProgress(steps);

    const add = () => {
        if (!newStep.trim()) return;
        onChange(addSubtask(steps, newStep, uuidv4()));
        setNewStep('');
    };

    return (
        <>
            {progress ? (
                <div className="pb-2 text-[12px] font-semibold text-cove-muted">
                    {progress.done} of {progress.total} done
                </div>
            ) : (
                <div className="pb-2 text-[12px] font-semibold text-cove-muted">
                    Too big to start? Break it into steps you can actually finish.
                </div>
            )}

            {steps.length > 0 ? (
                <div className="flex flex-col gap-1.5 pb-2">
                    {steps.map((s) => (
                        <div
                            key={s.id}
                            className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2"
                        >
                            <button
                                type="button"
                                onClick={() => onChange(toggleSubtask(steps, s.id))}
                                aria-label={s.completed ? `Untick ${s.title}` : `Tick ${s.title}`}
                                className="flex shrink-0 items-center bg-transparent p-0"
                            >
                                <PickCircle done={s.completed} size={24} />
                            </button>
                            <span
                                className={`min-w-0 flex-1 text-[13.5px] font-bold leading-snug ${
                                    s.completed ? 'text-cove-faint line-through' : 'text-cove-ink'
                                }`}
                            >
                                {s.title}
                            </span>
                            <button
                                type="button"
                                onClick={() => onChange(removeSubtask(steps, s.id))}
                                aria-label={`Remove ${s.title}`}
                                className="shrink-0 bg-transparent px-1 text-[13px] font-extrabold text-cove-faint"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="flex gap-2">
                <input
                    value={newStep}
                    onChange={(e) => setNewStep(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="Add a step"
                    aria-label="Add a step"
                    className={inputClass}
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={!newStep.trim()}
                    className="shrink-0 rounded-xl bg-cove-tint-blue px-3.5 text-[13px] font-extrabold text-cove-muted disabled:opacity-40"
                >
                    Add
                </button>
            </div>

            <div className="pt-2.5">
                {splitting ? (
                    <AITaskSplitter
                        task={draft}
                        onSplit={(subtasks) => {
                            onChange([...steps, ...subtasks]);
                            setSplitting(false);
                        }}
                        onCancel={() => setSplitting(false)}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setSplitting(true)}
                        className="rounded-full bg-cove-tint-purple px-3.5 py-1.5 text-[12.5px] font-extrabold text-cove-muted"
                    >
                        ✨ Split it with Buddy
                    </button>
                )}
            </div>
        </>
    );
};

export default SheetStepsSection;
