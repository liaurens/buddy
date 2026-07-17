import React from 'react';

export const ENERGY_LABELS = ['Low', 'Medium', 'High'] as const;

/** 0=Low, 1=Medium, 2=High */
export type EnergyIndex = 0 | 1 | 2;

interface EnergyRowProps {
    value: EnergyIndex | null;
    onChange: (value: EnergyIndex) => void;
    /** light = white cards (gate); dark = the #1d3a4d close-day overlay. */
    variant?: 'light' | 'dark';
}

/** Low / Medium / High energy buttons shared by the gate and the close-day overlay. */
const EnergyRow: React.FC<EnergyRowProps> = ({ value, onChange, variant = 'light' }) => (
    <div className="flex gap-2">
        {ENERGY_LABELS.map((label, i) => {
            const selected = value === i;
            const bg =
                variant === 'dark'
                    ? selected
                        ? '#fff'
                        : 'rgba(255,255,255,.12)'
                    : selected
                      ? '#1d3a4d'
                      : '#eef6fa';
            const color =
                variant === 'dark'
                    ? selected
                        ? '#1d3a4d'
                        : '#d5e7f1'
                    : selected
                      ? '#fff'
                      : '#5c86a0';
            return (
                <button
                    key={label}
                    type="button"
                    onClick={() => onChange(i as EnergyIndex)}
                    aria-pressed={selected}
                    className="flex-1 cursor-pointer rounded-xl border-0 px-2 py-[11px] text-[13px] font-extrabold"
                    style={{ background: bg, color }}
                >
                    {label}
                </button>
            );
        })}
    </div>
);

export default EnergyRow;
