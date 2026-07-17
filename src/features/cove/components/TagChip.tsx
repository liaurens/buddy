import React from 'react';
import type { Task } from '../../tasks/types';
import { SMALL_TASK_MINUTES, TINY_TASK_MINUTES } from '../../day/utils/morningPick';

export type ChipTone = 'amber' | 'blue' | 'green' | 'purple' | 'pink';

const TONES: Record<ChipTone, { bg: string; color: string }> = {
    amber: { bg: '#fdeeda', color: '#c07a1e' },
    blue: { bg: '#e3f0fa', color: '#3a7fb0' },
    green: { bg: '#e6f4ec', color: '#3d8a63' },
    purple: { bg: '#efe9f8', color: '#7a5fb0' },
    pink: { bg: '#fbe9ec', color: '#e8899a' },
};

export interface TagInfo {
    label: string;
    tone: ChipTone;
}

const isSchoolTask = (task: Task): boolean =>
    Boolean(task.assignmentId) || task.flag === 'school' || task.triageDestination === 'school';

/** Pick-card tag per the prototype: school (blue) > tiny (green) > quick win (amber). */
export function taskTagFor(task: Task): TagInfo | null {
    const est = task.estimatedTime;
    const time = est ? ` · ${est} min` : '';
    if (isSchoolTask(task)) return { label: `school${time}`, tone: 'blue' };
    if (est && est <= TINY_TASK_MINUTES) return { label: `tiny${time}`, tone: 'green' };
    if (est && est <= SMALL_TASK_MINUTES) return { label: `quick win${time}`, tone: 'amber' };
    if (task.flag === 'urgent') return { label: 'urgent', tone: 'amber' };
    return null;
}

/** Capture-list tag ("sorted by Buddy"): school / someday / reminder / today. */
export function captureTagFor(task: Task): TagInfo {
    if (isSchoolTask(task)) return { label: 'school', tone: 'blue' };
    if (task.flag === 'someday' && task.triagedAt) return { label: 'someday', tone: 'purple' };
    if (task.reminderEnabled || task.dueDate) return { label: 'reminder', tone: 'amber' };
    if (!task.triagedAt) return { label: 'sorting…', tone: 'blue' };
    return { label: 'today', tone: 'green' };
}

interface TagChipProps {
    tag: TagInfo;
    className?: string;
}

const TagChip: React.FC<TagChipProps> = ({ tag, className }) => (
    <span
        className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${className ?? ''}`}
        style={{ background: TONES[tag.tone].bg, color: TONES[tag.tone].color }}
    >
        {tag.label}
    </span>
);

export default TagChip;
