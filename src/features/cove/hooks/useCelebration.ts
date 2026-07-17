import { useCallback, useEffect, useRef, useState } from 'react';

export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return reduced;
}

/**
 * Tracks which item is currently bursting confetti. `celebrate(id)` arms the
 * burst for ~1s; under prefers-reduced-motion it never arms, so no confetti
 * is rendered at all (per the design spec).
 */
export function useCelebration(timeoutMs = 1000) {
    const [burstId, setBurstId] = useState<string | null>(null);
    const reduced = usePrefersReducedMotion();
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const celebrate = useCallback(
        (id: string) => {
            if (reduced) return;
            setBurstId(id);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setBurstId(null), timeoutMs);
        },
        [reduced, timeoutMs],
    );

    return { burstId, celebrate };
}
