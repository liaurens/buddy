import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { SchoolClass } from '../../../services/supabase/converters/school';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SessionFormProps {
    classes: SchoolClass[];
    defaultClassId?: string;
    onClose: () => void;
    onSubmit: (params: {
        classId: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        location?: string;
    }) => Promise<void>;
}

export const SessionForm: React.FC<SessionFormProps> = ({ classes, defaultClassId, onClose, onSubmit }) => {
    const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? '');
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1]));
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:30');
    const [location, setLocation] = useState('');
    const [busy, setBusy] = useState(false);

    const toggleDay = (i: number) => {
        setSelectedDays(prev => {
            const next = new Set(prev);
            if (next.has(i)) { if (next.size > 1) next.delete(i); }
            else next.add(i);
            return next;
        });
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classId || selectedDays.size === 0) return;
        setBusy(true);
        try {
            for (const day of Array.from(selectedDays).sort()) {
                await onSubmit({
                    classId,
                    dayOfWeek: day,
                    startTime,
                    endTime,
                    location: location.trim() || undefined,
                });
            }
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">New class time</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Class</span>
                    <select value={classId} onChange={e => setClassId(e.target.value)} required
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </label>

                <div>
                    <span className="text-xs font-medium text-slate-600">Days</span>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                        {DAYS.map((d, i) => (
                            <button key={d} type="button" onClick={() => toggleDay(i)}
                                className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                                    selectedDays.has(i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Start</span>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">End</span>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </label>
                </div>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Location</span>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room 204"
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </label>

                <div className="flex gap-2 pt-2">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy || !classId}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                        Add
                    </button>
                </div>
            </form>
        </div>
    );
};
