/**
 * TriggeredChecklistsCard — event-triggered checklists in the day view.
 *
 * A checklist with a trigger keyword (e.g. "work") pops up here whenever one
 * of today's calendar events matches it, so the right checklist appears on
 * the right day without the user opening the Checklists page.
 */
import React, { useMemo, useState } from 'react';
import { ListChecks, RotateCcw } from 'lucide-react';
import { useChecklists } from '../../checklists/hooks/useChecklists';
import { useTodayItems } from '../hooks/useTodayItems';
import { useToast } from '../../../components/ui/Toast';
import type { Checklist } from '../../checklists/types';
import type { CalendarEvent } from '../../planning/types';

interface TriggeredChecklist {
    checklist: Checklist;
    triggeredBy: CalendarEvent;
}

const TriggeredChecklistsCard: React.FC = () => {
    const { checklists, toggleItem, resetChecklist } = useChecklists();
    const { events } = useTodayItems();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const triggered = useMemo<TriggeredChecklist[]>(() => {
        return checklists.flatMap((checklist) => {
            const keyword = checklist.triggerKeyword?.trim().toLowerCase();
            if (!keyword) return [];
            const match = events.find((ev) => ev.title.toLowerCase().includes(keyword));
            return match ? [{ checklist, triggeredBy: match }] : [];
        });
    }, [checklists, events]);

    if (triggered.length === 0) return null;

    const handleToggle = async (checklist: Checklist, itemId: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await toggleItem(checklist, itemId);
        } catch (err) {
            console.error('Failed to toggle checklist item:', err);
            toast.error('Could not update checklist.');
        } finally {
            setBusy(false);
        }
    };

    const handleReset = async (checklist: Checklist) => {
        if (busy) return;
        setBusy(true);
        try {
            await resetChecklist(checklist);
        } catch (err) {
            console.error('Failed to reset checklist:', err);
            toast.error('Could not reset checklist.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3">
            {triggered.map(({ checklist, triggeredBy }) => {
                const done = checklist.items.filter((i) => i.isChecked).length;
                return (
                    <div
                        key={checklist.id}
                        className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-3"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <ListChecks size={16} className="text-indigo-600" />
                                    {checklist.emoji} {checklist.name}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    On today's calendar: “{triggeredBy.title}” · {done}/
                                    {checklist.items.length} done
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleReset(checklist)}
                                disabled={busy}
                                aria-label={`Reset ${checklist.name}`}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RotateCcw size={15} />
                            </button>
                        </div>
                        <ul className="space-y-1.5">
                            {checklist.items.map((item) => (
                                <li key={item.id}>
                                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={item.isChecked}
                                            onChange={() => void handleToggle(checklist, item.id)}
                                            disabled={busy}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                                        />
                                        <span
                                            className={`text-sm ${item.isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                        >
                                            {item.text}
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
};

export default TriggeredChecklistsCard;
