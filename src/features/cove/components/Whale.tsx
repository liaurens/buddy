import React from 'react';

export type WhaleSize = 'gate' | 'hero' | 'overlay';

const SIZES: Record<WhaleSize, { width: number; height: number }> = {
    gate: { width: 76, height: 62 },
    hero: { width: 86, height: 70 },
    overlay: { width: 110, height: 90 },
};

interface WhaleProps {
    size?: WhaleSize;
    /** Body color. The close-day overlay uses the light accent. */
    color?: string;
    /** Wrap in the gentle bob animation (disabled under prefers-reduced-motion via CSS). */
    bob?: boolean;
    className?: string;
}

/** The Buddy whale mascot — inline SVG from the Buddy Cove prototype. */
const Whale: React.FC<WhaleProps> = ({
    size = 'hero',
    color = 'var(--cove-accent)',
    bob = true,
    className,
}) => {
    const { width, height } = SIZES[size];
    const svg = (
        <svg width={width} height={height} viewBox="0 0 64 52" aria-hidden focusable="false">
            <circle cx="30" cy="7" r="2.4" fill="#7cc3e8" className="cove-spout" />
            <circle
                cx="25"
                cy="12"
                r="1.8"
                fill="#7cc3e8"
                className="cove-spout"
                style={{ animationDelay: '0.25s' }}
            />
            <circle
                cx="35"
                cy="11"
                r="1.4"
                fill="#7cc3e8"
                className="cove-spout"
                style={{ animationDelay: '0.5s' }}
            />
            <ellipse cx="30" cy="32" rx="23" ry="15" fill={color} />
            <ellipse cx="30" cy="40" rx="19" ry="7.5" fill="#bfe2f5" />
            <ellipse cx="55" cy="25" rx="7.5" ry="4.5" fill={color} transform="rotate(38 55 25)" />
            <circle cx="17" cy="27" r="2.6" fill="#173042" />
            <circle cx="13" cy="33" r="2.6" fill="#f7b8c2" opacity="0.7" />
        </svg>
    );

    if (!bob) return <div className={className}>{svg}</div>;
    return <div className={`cove-bob flex-none ${className ?? ''}`}>{svg}</div>;
};

export default Whale;
