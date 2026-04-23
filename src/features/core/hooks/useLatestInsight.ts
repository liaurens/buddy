import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';

export interface Finding {
    id: string;
    summary: string;
    type: string;
    severity: 'info' | 'nudge' | 'urgent';
    created_at: string;
}

const ALLOWED_SEVERITIES: Finding['severity'][] = ['info', 'nudge', 'urgent'];

function normalizeSeverity(raw: unknown): Finding['severity'] {
    if (typeof raw === 'string' && (ALLOWED_SEVERITIES as string[]).includes(raw)) {
        return raw as Finding['severity'];
    }
    // Map dev-facing severities to user-facing tiers.
    if (raw === 'warning') return 'nudge';
    if (raw === 'critical') return 'urgent';
    return 'info';
}

/**
 * Latest unseen, user-visible finding from `assistant_findings`.
 * Falls back gracefully before the Phase 4 migration adds `user_visible` / `seen_at` columns.
 */
export function useLatestInsight(): { finding: Finding | null; dismiss: () => Promise<void>; refresh: () => void } {
    const { user } = useAuth();
    const [finding, setFinding] = useState<Finding | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        const load = async () => {
            const res = await supabase
                .from('assistant_findings')
                .select('id, type, severity, data, created_at')
                .eq('user_id', user.id)
                .eq('user_visible', true)
                .is('seen_at', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (res.error && /column .* does not exist/i.test(res.error.message)) {
                // Pre-migration: don't surface anything by default.
                if (!cancelled) setFinding(null);
                return;
            }

            if (cancelled || res.error || !res.data) {
                setFinding(null);
                return;
            }

            const row = res.data as { id: string; type: string; severity: string; data: { summary?: string }; created_at: string };
            const summary = row.data?.summary;
            if (!summary) {
                setFinding(null);
                return;
            }
            setFinding({
                id: row.id,
                summary,
                type: row.type,
                severity: normalizeSeverity(row.severity),
                created_at: row.created_at,
            });
        };

        load();
        return () => { cancelled = true; };
    }, [user?.id, tick]);

    const dismiss = useCallback(async () => {
        if (!finding || !user?.id) return;
        await supabase
            .from('assistant_findings')
            .update({ seen_at: new Date().toISOString() })
            .eq('id', finding.id);
        setFinding(null);
    }, [finding, user?.id]);

    const refresh = useCallback(() => setTick(t => t + 1), []);

    return { finding, dismiss, refresh };
}
