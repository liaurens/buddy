/**
 * Findings Writer — persists HR analysis results to the database.
 */

import type { Finding } from './analyzer.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function writeFindings(
    userId: string,
    findings: Finding[],
    supabase: SupabaseClient,
): Promise<void> {
    if (findings.length === 0) return;

    // User-facing types surface on the Now screen's Insight card.
    // Dev-facing diagnostics (unmatched_pattern / error_cluster / slow_route / usage_trend / ai_cost)
    // stay hidden and are viewed via the Dev Panel in the Me tab.
    const USER_VISIBLE_TYPES = new Set<string>(['habit_trend', 'overdue_cluster']);

    const rows = findings.map((f) => ({
        user_id: userId,
        type: f.type,
        severity: f.severity,
        data: f.data,
        status: 'new',
        user_visible: USER_VISIBLE_TYPES.has(f.type),
    }));

    const { error } = await supabase.from('assistant_findings').insert(rows);

    if (error) {
        console.error('Failed to write findings:', error.message);
    }
}
