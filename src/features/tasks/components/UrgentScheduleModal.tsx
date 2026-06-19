/**
 * Urgent scheduling flow.
 *
 * When an urgent task lands it has no "do date" yet. This modal forces the three
 * decisions that make an urgent task actionable: WHEN to do it, whether it needs
 * PREP on earlier days, and any important NOTES. On save the task is scheduled
 * (and written to Google Calendar via useTasks) and prep tasks are spawned.
 */

import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Plus, Trash2, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { useTasks } from '../hooks/useTasks';
import { useToast } from '../../../components/ui/Toast';
import type { Task } from '../types';

interface PrepDraft {
    id: string;
    title: string;
    daysBefore: number;
}

interface UrgentScheduleModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onScheduled?: () => void;
}

const UrgentScheduleModal: React.FC<UrgentScheduleModalProps> = ({ task, isOpen, onClose, onScheduled }) => {
    const { updateTask, addTaskFull } = useTasks();
    const toast = useToast();

    const [date, setDate] = useState(task.dueDate ?? '');
    const [time, setTime] = useState(task.dueTime ?? '');
    const [estimate, setEstimate] = useState(task.estimatedTime ? String(task.estimatedTime) : '');
    const [notes, setNotes] = useState(task.notes ?? '');
    const [preps, setPreps] = useState<PrepDraft[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addPrep = () => setPreps(prev => [...prev, { id: crypto.randomUUID(), title: '', daysBefore: 1 }]);
    const updatePrep = (id: string, patch: Partial<PrepDraft>) =>
        setPreps(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    const removePrep = (id: string) => setPreps(prev => prev.filter(p => p.id !== id));

    const handleSave = async () => {
        if (!date) { setError('Pick a day to do this.'); return; }
        setSaving(true);
        setError(null);
        try {
            // Schedule the urgent task itself.
            await updateTask({
                ...task,
                kind: 'urgent',
                dueDate: date,
                dueTime: time || undefined,
                estimatedTime: estimate ? Number(estimate) : task.estimatedTime,
                notes: notes.trim() || undefined,
            });

            // Spawn prep tasks on their earlier days, linked to this task.
            const validPreps = preps.filter(p => p.title.trim());
            await Promise.all(validPreps.map(p => {
                const prepDate = format(subDays(new Date(`${date}T00:00:00`), Math.max(0, p.daysBefore)), 'yyyy-MM-dd');
                return addTaskFull({
                    title: p.title.trim(),
                    dueDate: prepDate,
                    priority: 'high',
                    parentTodoId: task.id,
                });
            }));

            toast.success('Scheduled — added to your calendar.');
            onScheduled?.();
            onClose();
        } catch (e) {
            console.error('Failed to schedule urgent task:', e);
            setError('Could not schedule. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const footer = (
        <>
            <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                disabled={saving || !date}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors disabled:opacity-50"
            >
                {saving ? 'Scheduling…' : 'Schedule it'}
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Schedule urgent task" footer={footer} size="lg">
            <div className="space-y-5">
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="text-sm font-semibold text-rose-900">🔥 {task.title}</p>
                </div>

                {/* When */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">When will you do it?</label>
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                        />
                        <input
                            type="time"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                        />
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min={1}
                                value={estimate}
                                onChange={e => setEstimate(e.target.value)}
                                placeholder="min"
                                className="w-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                            />
                            <span className="text-xs text-slate-500">min</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">It'll appear in your day on this date and sync to Google Calendar.</p>
                </div>

                {/* Prep */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Prep to do on earlier days (optional)</label>
                    <ul className="space-y-2">
                        {preps.map(p => (
                            <li key={p.id} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={p.title}
                                    onChange={e => updatePrep(p.id, { title: e.target.value })}
                                    placeholder="e.g. Draft outline"
                                    className="flex-1 min-w-0 px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                />
                                <input
                                    type="number"
                                    min={0}
                                    value={p.daysBefore}
                                    onChange={e => updatePrep(p.id, { daysBefore: Number(e.target.value) })}
                                    className="w-16 px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                />
                                <span className="text-xs text-slate-500 whitespace-nowrap">days before</span>
                                <button onClick={() => removePrep(p.id)} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Remove prep">
                                    <Trash2 size={14} />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button
                        onClick={addPrep}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-rose-700 hover:underline"
                    >
                        <Plus size={14} /> Add prep step
                    </button>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Important info (optional)</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Anything you need to remember about this…"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                </div>

                {error && (
                    <p className="flex items-center gap-1 text-sm text-rose-600">
                        <X size={14} /> {error}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default UrgentScheduleModal;
