import React from 'react';

interface PickCircleProps {
    done: boolean;
    /** 34 = Now pick cards, 28 = compact rows (tasks, comms), 24 = protocol rows. */
    size?: 34 | 28 | 24;
}

/** Circular checkbox with the checkpop animation on completion. */
const PickCircle: React.FC<PickCircleProps> = ({ done, size = 34 }) => {
    const fontSize = size === 34 ? 17 : size === 28 ? 14 : 12;
    if (done) {
        return (
            <span
                className="cove-checkpop flex flex-none items-center justify-center rounded-full bg-cove-success font-extrabold text-white"
                style={{ width: size, height: size, fontSize }}
                aria-hidden
            >
                ✓
            </span>
        );
    }
    return (
        <span
            className="box-border flex-none rounded-full border-[2.5px] border-cove-border-strong"
            style={{ width: size, height: size }}
            aria-hidden
        />
    );
};

export default PickCircle;
