import React from 'react';
import { addDays, addWeeks, format } from 'date-fns';
import type { Task, TaskFlag } from '../../tasks/types';
import { parseDueDate } from '../../tasks/utils/dueDates';
import { suggestedDeadlineStart } from '../../tasks/utils/taskContracts';
import { chipClass, inputClass, labelClass } from './sheetStyles';

interface SheetWhenSectionProps {
    draft: Task;
    flag: TaskFlag;
    patch: (p: Partial<Task>) => void;
}

/**
 * "When" — the whole time story of a task in one section: the day you mean to
 * do it, the moment it's actually due, and (for deadlines) the day you have to
 * start if the due date is going to survive contact with the week.
 */
const SheetWhenSection: React.FC<SheetWhenSectionProps> = ({ draft, flag, patch }) => {
    const suggestedStart = draft.dueDate ? suggestedDeadlineStart(draft.dueDate, new Date()) : null;

    return (
        <>
            <div className={labelClass}>Do it on</div>
            {/* One tap beats the OS date picker for the three answers
                people actually give. The inputs below stay for the rest. */}
            <div className="flex flex-wrap gap-1.5 pb-2">
                {[
                    { label: 'Today', value: format(new Date(), 'yyyy-MM-dd') },
                    {
                        label: 'Tomorrow',
                        value: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
                    },
                    {
                        label: 'Next week',
                        value: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
                    },
                ].map((d) => (
                    <button
                        key={d.label}
                        type="button"
                        onClick={() => patch({ plannedFor: d.value })}
                        className={chipClass(draft.plannedFor === d.value)}
                    >
                        {d.label}
                    </button>
                ))}
                {draft.plannedFor ? (
                    <button
                        type="button"
                        onClick={() => patch({ plannedFor: undefined })}
                        className={chipClass(false)}
                    >
                        Clear
                    </button>
                ) : null}
            </div>
            <div className="flex gap-2">
                <input
                    type="date"
                    value={draft.plannedFor ?? ''}
                    onChange={(e) => patch({ plannedFor: e.target.value || undefined })}
                    className={inputClass}
                    aria-label="Do it on"
                />
                <input
                    type="time"
                    value={draft.dueTime ?? ''}
                    onChange={(e) => patch({ dueTime: e.target.value || undefined })}
                    className={`${inputClass} max-w-[8rem]`}
                    aria-label="Time"
                />
            </div>

            <div className={labelClass}>
                Actually due {flag === 'deadline' ? '(required)' : '(optional)'}
            </div>
            <input
                type="date"
                value={draft.dueDate ?? ''}
                onChange={(e) => patch({ dueDate: e.target.value || undefined })}
                className={inputClass}
                aria-label="Actually due"
            />

            {flag === 'deadline' ? (
                <>
                    <div className={labelClass}>Start by</div>
                    <div className="pb-2 text-[12px] font-semibold text-cove-muted">
                        The day this stops being future-you&rsquo;s problem. Before it, the task
                        stays parked.
                    </div>
                    {suggestedStart ? (
                        <div className="flex flex-wrap gap-1.5 pb-2">
                            <button
                                type="button"
                                onClick={() => patch({ startDate: suggestedStart })}
                                className={chipClass(draft.startDate === suggestedStart)}
                            >
                                {format(parseDueDate(suggestedStart), 'EEE d MMM')}
                            </button>
                            {draft.startDate ? (
                                <button
                                    type="button"
                                    onClick={() => patch({ startDate: undefined })}
                                    className={chipClass(false)}
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <input
                        type="date"
                        value={draft.startDate ?? ''}
                        onChange={(e) => patch({ startDate: e.target.value || undefined })}
                        className={inputClass}
                        aria-label="Start by"
                    />
                </>
            ) : null}
        </>
    );
};

export default SheetWhenSection;
