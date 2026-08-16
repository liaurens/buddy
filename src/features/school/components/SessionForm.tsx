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

export const SessionForm: React.FC<SessionFormProps> = ({
    classes,
    defaultClassId,
    onClose,
    onSubmit,
}) => {
    const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? '');
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1]));
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:30');
    const [location, setLocation] = useState('');
    const [busy, setBusy] = useState(false);

    const toggleDay = (i: number) => {
        setSelectedDays((prev) => {
            const next = new Set(prev);
            if (next.has(i)) {
                if (next.size > 1) next.delete(i);
            } else next.add(i);
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
            <form
                onSubmit={submit}
                className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-cove-ink">New class time</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cove-faint hover:text-cove-muted"
                    >
                        <X size={20} />
                    </button>
                </div>

                <label className="block">
                    <span className="text-xs font-bold text-cove-muted">Class</span>
                    <select
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        required
                        className="app-input mt-1"
                    >
                        {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div>
                    <span className="text-xs font-bold text-cove-muted">Days</span>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                        {DAYS.map((d, i) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => toggleDay(i)}
                                className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                                    selectedDays.has(i)
                                        ? 'bg-cove-accent text-white'
                                        : 'bg-[color:var(--buddy-surface-soft)] text-cove-muted hover:bg-cove-track'
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">Start</span>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            required
                            className="app-input mt-1"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">End</span>
                        <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            required
                            className="app-input mt-1"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="text-xs font-bold text-cove-muted">Location</span>
                    <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Room 204"
                        className="app-input mt-1"
                    />
                </label>

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !classId}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-cove-accent text-white hover:bg-[#3a8dc7] disabled:opacity-50"
                    >
                        Add
                    </button>
                </div>
            </form>
        </div>
    );
};
