import React from 'react';

/** Display order Monday-first; values follow JS Date.getDay() (0=Sun). */
const DAYS: Array<{ value: number; label: string }> = [
    { value: 1, label: 'M' },
    { value: 2, label: 'T' },
    { value: 3, label: 'W' },
    { value: 4, label: 'T' },
    { value: 5, label: 'F' },
    { value: 6, label: 'S' },
    { value: 0, label: 'S' },
];

const WEEKDAYS = [1, 2, 3, 4, 5];

interface Props {
    value: number[];
    onChange: (days: number[]) => void;
    disabled?: boolean;
}

export function describeDays(days: number[]): string {
    const set = new Set(days);
    if (set.size === 7) return 'Every day';
    if (set.size === 5 && WEEKDAYS.every(d => set.has(d))) return 'Weekdays';
    if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
    if (set.size === 0) return 'Never';
    return DAYS.filter(d => set.has(d.value)).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.value]).join(', ');
}

/** Pill row for picking which weekdays a reminder fires on. */
const DayOfWeekPicker: React.FC<Props> = ({ value, onChange, disabled = false }) => {
    const selected = new Set(value);

    const toggle = (day: number) => {
        const next = new Set(selected);
        if (next.has(day)) {
            next.delete(day);
        } else {
            next.add(day);
        }
        onChange([...next].sort((a, b) => a - b));
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex gap-1">
                {DAYS.map(({ value: day, label }, i) => (
                    <button
                        key={`${day}-${i}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(day)}
                        aria-pressed={selected.has(day)}
                        className={`h-7 w-7 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 ${
                            selected.has(day)
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <span className="text-xs text-slate-400">{describeDays(value)}</span>
        </div>
    );
};

export default DayOfWeekPicker;
