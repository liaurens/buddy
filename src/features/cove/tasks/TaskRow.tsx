import React from 'react';
import type { Task } from '../../tasks/types';
import { TASK_FLAG_META, deriveTaskFlag } from '../../tasks/utils/taskFlags';
import { PickCircle, TagChip, taskTagFor } from '../components';
import { formatRowMeta } from './rowMeta';

interface TaskRowProps {
    task: Task;
    /** Tap the circle to complete. */
    onToggle: (task: Task) => void;
    /** Tap the title to open the detail sheet. */
    onOpen: (task: Task) => void;
    /** Show the flag chip — useful in Now, where rows come from mixed flags. */
    showFlag?: boolean;
    /** Muted styling for parked/backlog rows. */
    quiet?: boolean;
}

/**
 * One task, everywhere on the Tasks screen. The circle completes it; the rest
 * of the row opens it — two targets, no menus, both comfortably thumb-sized.
 */
const TaskRow: React.FC<TaskRowProps> = ({ task, onToggle, onOpen, showFlag, quiet }) => {
    const tag = taskTagFor(task);
    const meta = formatRowMeta(task, new Date());
    const flagMeta = TASK_FLAG_META[deriveTaskFlag(task)];

    return (
        <div
            className={`flex w-full items-center gap-3 rounded-card px-4 py-3.5 ${
                quiet ? 'bg-white/60' : 'bg-white shadow-cove'
            }`}
        >
            <button
                type="button"
                onClick={() => onToggle(task)}
                aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                // PickCircle is an inline <span> sized with width/height — it needs a
                // flex parent or it collapses to a hairline.
                className="flex shrink-0 items-center bg-transparent p-0"
            >
                <PickCircle done={task.completed} size={28} />
            </button>

            <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex min-w-0 flex-1 items-center gap-2 bg-transparent p-0 text-left"
            >
                <span
                    className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold leading-[1.3]"
                    style={{ color: task.completed ? '#9cb9c9' : quiet ? '#5b7f96' : '#1d3a4d' }}
                >
                    {task.title}
                </span>
                {showFlag ? (
                    <span className="shrink-0 text-[13px]" title={flagMeta.label}>
                        {flagMeta.emoji}
                    </span>
                ) : null}
                {tag && !quiet ? <TagChip tag={tag} /> : null}
                {meta ? (
                    <span
                        className={`shrink-0 text-[11.5px] font-bold ${
                            meta.tone === 'alert' ? 'text-[#a87a2e]' : 'text-cove-faint'
                        }`}
                    >
                        {meta.text}
                    </span>
                ) : null}
            </button>
        </div>
    );
};

export default TaskRow;
