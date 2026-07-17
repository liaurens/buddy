import React from 'react';

export const MOOD_DEFS = [
    { label: 'rough', color: '#e8899a' },
    { label: 'meh', color: '#f2a541' },
    { label: 'okay', color: '#7cc3e8' },
    { label: 'good', color: '#5cb586' },
    { label: 'great', color: '#3d8a63' },
] as const;

/** 0=rough … 4=great */
export type MoodIndex = 0 | 1 | 2 | 3 | 4;

interface MoodRowProps {
    value: MoodIndex | null;
    onChange: (value: MoodIndex) => void;
    /** light = white cards (gate); dark = the #1d3a4d close-day overlay. */
    variant?: 'light' | 'dark';
}

/** Five mood dots (rough → great) shared by the gate and the close-day overlay. */
const MoodRow: React.FC<MoodRowProps> = ({ value, onChange, variant = 'light' }) => (
    <div className="flex gap-2">
        {MOOD_DEFS.map((m, i) => {
            const selected = value === i;
            const bg = selected
                ? variant === 'dark'
                    ? 'rgba(255,255,255,.14)'
                    : '#eef6fa'
                : 'transparent';
            const labelColor = variant === 'dark' ? '#d5e7f1' : selected ? '#1d3a4d' : '#9cb9c9';
            return (
                <button
                    key={m.label}
                    type="button"
                    onClick={() => onChange(i as MoodIndex)}
                    aria-pressed={selected}
                    className="flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border-0 px-0.5 py-1.5"
                    style={{ background: bg }}
                >
                    <span
                        className="box-border rounded-full"
                        style={{
                            width: variant === 'dark' ? 22 : 26,
                            height: variant === 'dark' ? 22 : 26,
                            background: m.color,
                            border: `3px solid ${selected ? '#1d3a4d' : 'transparent'}`,
                        }}
                    />
                    <span
                        className="font-extrabold"
                        style={{ fontSize: variant === 'dark' ? 10 : 10.5, color: labelColor }}
                    >
                        {m.label}
                    </span>
                </button>
            );
        })}
    </div>
);

export default MoodRow;
