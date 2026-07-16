import React from 'react';

export const GATE_STEPS = ['Comms', 'Yesterday', 'Plan'] as const;
export type GateStep = 0 | 1 | 2;

interface StepChipsProps {
    step: GateStep;
    onStep: (step: GateStep) => void;
}

/** The three tappable step chips with connector lines. */
const StepChips: React.FC<StepChipsProps> = ({ step, onStep }) => (
    <div className="mt-[18px] flex items-center gap-1.5">
        {GATE_STEPS.map((label, i) => {
            const active = step === i;
            const done = step > i;
            return (
                <React.Fragment key={label}>
                    {i > 0 ? (
                        <div className="h-0.5 flex-1 rounded-sm bg-[#cfe4ef]" aria-hidden />
                    ) : null}
                    <button
                        type="button"
                        onClick={() => onStep(i as GateStep)}
                        aria-current={active ? 'step' : undefined}
                        className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-extrabold"
                        style={{
                            background: active
                                ? 'var(--cove-accent)'
                                : done
                                  ? '#d3ecdd'
                                  : '#d7e9f2',
                            color: active ? '#fff' : done ? '#3d8a63' : '#7fa6bb',
                        }}
                    >
                        {done ? '✓' : `${i + 1}.`} {label}
                    </button>
                </React.Fragment>
            );
        })}
    </div>
);

export default StepChips;
