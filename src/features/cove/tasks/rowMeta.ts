/**
 * rowMeta — the right-hand text on a task row.
 *
 * A row gets one short meta string, picked by usefulness: an overdue marker
 * beats a concrete time beats a due day beats an effort estimate. Dates that
 * matter get words ("due today"), dates further out get a weekday or a short
 * date. Tone marks the strings that deserve the amber "careful" treatment
 * (Cove has no red).
 *
 * "start slipped" sits just under overdue: a deadline you meant to begin days
 * ago and haven't touched is the one thing more worth saying than its due day,
 * because there is still time to act on it.
 */

import { format } from 'date-fns';
import type { Task } from '../../tasks/types';
import { daysUntilDue, parseDueDate } from '../../tasks/utils/dueDates';
import { isDeadlineStartSlipped } from '../../tasks/utils/taskContracts';

export interface RowMeta {
    text: string;
    /** 'alert' renders in the amber family; 'default' stays faint. */
    tone: 'default' | 'alert';
}

export function formatRowMeta(task: Task, today: Date): RowMeta | null {
    if (task.dueDate) {
        const days = daysUntilDue(task.dueDate, today);
        if (days < 0) {
            return { text: `overdue ${Math.abs(days)}d`, tone: 'alert' };
        }
        if (isDeadlineStartSlipped(task, today)) {
            return { text: 'start slipped', tone: 'alert' };
        }
        if (task.dueTime) return { text: task.dueTime, tone: 'default' };
        if (days === 0) return { text: 'due today', tone: 'default' };
        if (days === 1) return { text: 'due tomorrow', tone: 'default' };
        if (days <= 6) {
            return { text: `due ${format(parseDueDate(task.dueDate), 'EEE')}`, tone: 'default' };
        }
        return { text: `due ${format(parseDueDate(task.dueDate), 'd MMM')}`, tone: 'default' };
    }
    if (isDeadlineStartSlipped(task, today)) {
        return { text: 'start slipped', tone: 'alert' };
    }
    if (task.dueTime) return { text: task.dueTime, tone: 'default' };
    if (task.estimatedTime) return { text: `${task.estimatedTime} min`, tone: 'default' };
    return null;
}
