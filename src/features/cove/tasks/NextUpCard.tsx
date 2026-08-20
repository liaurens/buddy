import React from 'react';
import type { Task } from '../../tasks/types';
import type { TaskRecommendation } from '../../tasks/utils/taskRecommender';
import { TASK_FLAG_META, deriveTaskFlag } from '../../tasks/utils/taskFlags';
import { isStale } from '../../tasks/utils/staleness';
import { PickCircle, TagChip, taskTagFor } from '../components';
import { formatRowMeta } from './rowMeta';

interface NextUpCardProps {
    rec: TaskRecommendation;
    onToggle: (task: Task) => void;
    onOpen: (task: Task) => void;
    /** Open the sheet on its Steps section, splitter expanded. */
    onSplit: (task: Task) => void;
}

/**
 * The top of "Needs you now" — the recommender's #1 pick, with its reasons
 * spelled out. The reason line is the whole point: scoreTask has always known
 * *why* a task ranks first ("overdue by 3 days, keeps slipping") and this is
 * where that finally reaches the user. Same two targets as TaskRow: the
 * circle completes, the rest opens the sheet.
 *
 * When the pick is stale - pushed twice, or sitting untouched past its day -
 * it offers a split instead of a third guilt pass. That is the moment a
 * breakdown is worth anything: at the point of avoidance, not at planning time.
 */
const NextUpCard: React.FC<NextUpCardProps> = ({ rec, onToggle, onOpen, onSplit }) => {
    const { task, subtask } = rec;
    const tag = taskTagFor(task);
    const now = new Date();
    const meta = formatRowMeta(task, now);
    const stuck = isStale(task, now);
    const flagMeta = TASK_FLAG_META[deriveTaskFlag(task)];
    const reason = rec.reason ? rec.reason.split(', ').join(' · ') : '';

    return (
        <div className="flex w-full items-start gap-3 rounded-card-lg bg-white px-4 py-4 shadow-cove">
            <button
                type="button"
                onClick={() => onToggle(task)}
                aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                // PickCircle is an inline <span> sized with width/height — it needs a
                // flex parent or it collapses to a hairline.
                className="mt-0.5 flex shrink-0 items-center bg-transparent p-0"
            >
                <PickCircle done={task.completed} size={34} />
            </button>

            <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex min-w-0 flex-1 flex-col gap-1 bg-transparent p-0 text-left"
            >
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-cove-faint">
                    Next up
                </span>
                <span className="flex min-w-0 items-center gap-2">
                    <span
                        className="min-w-0 flex-1 text-[16px] font-extrabold leading-[1.25]"
                        style={{ color: task.completed ? '#9cb9c9' : '#1d3a4d' }}
                    >
                        {task.title}
                    </span>
                    <span className="shrink-0 text-[13.5px]" title={flagMeta.label}>
                        {flagMeta.emoji}
                    </span>
                    {tag ? <TagChip tag={tag} /> : null}
                    {meta ? (
                        <span
                            className={`shrink-0 text-[11.5px] font-bold ${
                                meta.tone === 'alert' ? 'text-[#a87a2e]' : 'text-cove-faint'
                            }`}
                        >
                            {meta.text}
                        </span>
                    ) : null}
                </span>
                {reason ? (
                    <span className="text-[12px] font-semibold leading-snug text-cove-muted">
                        {reason}
                    </span>
                ) : null}
                {subtask ? (
                    <span className="truncate text-[12px] font-bold text-[#3a7fb0]">
                        next: {subtask.title}
                    </span>
                ) : null}
            </button>

            {/* Sits outside the open-the-sheet button - nesting buttons is
                invalid HTML and the inner click never fires. */}
            {stuck && !subtask ? (
                <button
                    type="button"
                    onClick={() => onSplit(task)}
                    className="mt-6 shrink-0 self-start rounded-full bg-cove-tint-purple px-3 py-1.5 text-[11.5px] font-extrabold text-cove-muted"
                >
                    Feeling stuck? Split it &rarr;
                </button>
            ) : null}
        </div>
    );
};

export default NextUpCard;
