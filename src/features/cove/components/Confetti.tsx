import React from 'react';

interface Particle {
    size: number;
    color: string;
    round: boolean;
    cx: number;
    cy: number;
    duration: number;
    delay?: number;
}

/** Particle sets copied from the Buddy Cove prototype (small = checkbox burst, big = celebration). */
const SMALL: Particle[] = [
    { size: 9, color: '#f2a541', round: false, cx: -42, cy: -58, duration: 0.8 },
    { size: 7, color: '#5cb586', round: true, cx: 38, cy: -64, duration: 0.85 },
    { size: 8, color: '#4d9fd6', round: false, cx: -58, cy: -18, duration: 0.75 },
    { size: 6, color: '#f7b8c2', round: true, cx: 52, cy: -24, duration: 0.9 },
    { size: 8, color: '#f2a541', round: true, cx: -24, cy: -76, duration: 0.95 },
    { size: 7, color: '#4d9fd6', round: false, cx: 20, cy: -80, duration: 0.8, delay: 0.05 },
];

const BIG: Particle[] = [
    { size: 11, color: '#f2a541', round: false, cx: -110, cy: -140, duration: 1.3 },
    { size: 9, color: '#5cb586', round: true, cx: 120, cy: -150, duration: 1.4 },
    { size: 10, color: '#7cc3e8', round: false, cx: -150, cy: -40, duration: 1.2 },
    { size: 8, color: '#f7b8c2', round: true, cx: 150, cy: -60, duration: 1.5 },
    { size: 10, color: '#f2a541', round: true, cx: -60, cy: -180, duration: 1.45, delay: 0.1 },
    { size: 9, color: '#7cc3e8', round: false, cx: 70, cy: -190, duration: 1.35, delay: 0.1 },
    { size: 8, color: '#5cb586', round: false, cx: -170, cy: -110, duration: 1.5, delay: 0.15 },
    { size: 9, color: '#f7b8c2', round: true, cx: 170, cy: -120, duration: 1.3, delay: 0.15 },
];

interface ConfettiProps {
    variant?: 'small' | 'big';
    className?: string;
}

/**
 * A one-shot confetti burst. Render it only while celebrating (the parent
 * mounts/unmounts it); don't render it at all under reduced motion — see
 * useCelebration, which never triggers in that case.
 */
const Confetti: React.FC<ConfettiProps> = ({ variant = 'small', className }) => {
    const particles = variant === 'small' ? SMALL : BIG;
    const animation = variant === 'small' ? 'cove-confetti' : 'cove-bigconfetti';
    return (
        <div
            className={`pointer-events-none absolute z-[5] h-0 w-0 ${className ?? ''}`}
            aria-hidden
        >
            {particles.map((p, i) => (
                <span
                    key={i}
                    className="absolute"
                    style={{
                        width: p.size,
                        height: p.size,
                        background: p.color,
                        borderRadius: p.round ? '50%' : 2,
                        ['--cx' as string]: `${p.cx}px`,
                        ['--cy' as string]: `${p.cy}px`,
                        animation: `${animation} ${p.duration}s ${p.delay ?? 0}s ease-out forwards`,
                    }}
                />
            ))}
        </div>
    );
};

export default Confetti;
