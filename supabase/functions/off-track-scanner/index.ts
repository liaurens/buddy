/**
 * Off-Track Scanner Edge Function
 *
 * Runs on cron (every 15 minutes). For each user with off-track nudges enabled:
 * - Detects high-priority overdue tasks → enqueues reminder
 * - Detects missed morning/midday/night routine → enqueues reminder
 * - Detects skipped tracker check-in (after 18:00 local) → enqueues reminder
 * - Detects idleness (no app open for hours during the day) → enqueues reminder
 *
 * Each enqueue uses a deterministic dedup_key to avoid duplicates, respects the
 * user's quiet hours, and rate-limits to maxRemindersPerHour. Rows land in
 * `scheduled_notifications` and get flushed by the existing schedule-notifications
 * cron job.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

interface NotificationsSettings {
    pushEnabled?: boolean;
    morningEnabled?: boolean;
    morningTime?: string;
    middayEnabled?: boolean;
    middayTime?: string;
    nightEnabled?: boolean;
    nightTime?: string;
    offTrackEnabled?: boolean;
    offTrackOverdueTasks?: boolean;
    offTrackMissedRoutines?: boolean;
    offTrackSkippedCheckin?: boolean;
    offTrackIdle?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    maxRemindersPerHour?: number;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseHHMM(s: string | undefined, fallback: [number, number]): [number, number] {
    if (!s) return fallback;
    const [h, m] = s.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return fallback;
    return [h, m];
}

/** Returns true if the given local hour:minute falls within [start, end), with wrap. */
function inQuietHours(now: Date, start: string | undefined, end: string | undefined): boolean {
    const [sh, sm] = parseHHMM(start, [22, 0]);
    const [eh, em] = parseHHMM(end, [7, 0]);
    const minsNow = now.getHours() * 60 + now.getMinutes();
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    if (sMin === eMin) return false;
    if (sMin < eMin) return minsNow >= sMin && minsNow < eMin;
    // wrap across midnight
    return minsNow >= sMin || minsNow < eMin;
}

function todayDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface EnqueueArgs {
    userId: string;
    toolCategory: string;
    notificationType: string;
    scheduledFor: Date;
    title: string;
    body: string;
    data: Record<string, unknown>;
    sourceType: string;
    sourceId?: string | null;
    dedupKey: string;
}

async function tryEnqueue(supabase: SupabaseClient, args: EnqueueArgs): Promise<boolean> {
    // Insert; rely on UNIQUE(user_id, dedup_key) partial index to prevent dups.
    const { error } = await supabase.from('scheduled_notifications').insert({
        user_id: args.userId,
        tool_category: args.toolCategory,
        notification_type: args.notificationType,
        scheduled_for: args.scheduledFor.toISOString(),
        title: args.title,
        body: args.body,
        data: args.data,
        status: 'pending',
        source_type: args.sourceType,
        source_id: args.sourceId ?? null,
        dedup_key: args.dedupKey,
    });
    // 23505 = unique_violation → silently skip (already enqueued).
    if (error && (error as { code?: string }).code !== '23505') {
        console.error('Enqueue failed:', error.message);
        return false;
    }
    return !error;
}

async function loadSettings(
    supabase: SupabaseClient,
    userId: string,
): Promise<NotificationsSettings> {
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .eq('user_id', userId)
        .like('key', 'notifications_%');
    const out: Record<string, unknown> = {};
    for (const row of data || []) {
        const key = (row.key as string).replace('notifications_', '');
        out[key] = row.value;
    }
    return out as NotificationsSettings;
}

async function recentSentCount(
    supabase: SupabaseClient,
    userId: string,
    sinceMinutes: number,
): Promise<number> {
    const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
    const { count } = await supabase
        .from('scheduled_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'sent')
        .gte('sent_at', since);
    return count || 0;
}

async function scanUser(supabase: SupabaseClient, userId: string): Promise<number> {
    const settings = await loadSettings(supabase, userId);
    if (!settings.pushEnabled || !settings.offTrackEnabled) return 0;

    const now = new Date();
    if (inQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd)) return 0;

    // Rate limit: count pings sent in the last 60 minutes.
    const cap = settings.maxRemindersPerHour ?? 3;
    const recent = await recentSentCount(supabase, userId, 60);
    if (recent >= cap) return 0;

    const today = todayDateStr(now);
    const fireAt = new Date(now.getTime() + 30_000); // ~30s out so the next cron flush picks it up
    let enqueued = 0;

    // 1) Overdue high-priority tasks
    if (settings.offTrackOverdueTasks) {
        const { data: overdue } = await supabase
            .from('todos')
            .select('id, title, due_date, due_time, priority')
            .eq('user_id', userId)
            .eq('completed', false)
            .in('priority', ['urgent', 'high'])
            .lt('due_date', today)
            .limit(5);

        for (const t of overdue || []) {
            const hourBucket = Math.floor(now.getTime() / (4 * 60 * 60_000)); // 4-hour bucket
            const dedup = `overdue:${t.id}:${hourBucket}`;
            const ok = await tryEnqueue(supabase, {
                userId,
                toolCategory: 'off_track',
                notificationType: 'task_overdue',
                scheduledFor: fireAt,
                title: 'Overdue task',
                body: `"${t.title}" is overdue. Knock it out?`,
                data: { taskId: t.id, route: 'tasks', sourceType: 'overdue' },
                sourceType: 'overdue',
                sourceId: t.id,
                dedupKey: dedup,
            });
            if (ok) enqueued++;
        }
    }

    // 2) Missed routines (only check after each routine's grace window)
    if (settings.offTrackMissedRoutines) {
        const routines: Array<{
            key: 'morning' | 'midday' | 'night';
            enabled?: boolean;
            time?: string;
            label: string;
            route: string;
        }> = [
            {
                key: 'morning',
                enabled: settings.morningEnabled,
                time: settings.morningTime,
                label: 'morning routine',
                route: 'today',
            },
            {
                key: 'midday',
                enabled: settings.middayEnabled,
                time: settings.middayTime,
                label: 'midday replan',
                route: 'today',
            },
            {
                key: 'night',
                enabled: settings.nightEnabled,
                time: settings.nightTime,
                label: 'night reflection',
                route: 'reflection',
            },
        ];

        for (const r of routines) {
            if (!r.enabled || !r.time) continue;
            const [rh, rm] = parseHHMM(r.time, [0, 0]);
            const routineMs = new Date(now);
            routineMs.setHours(rh, rm, 0, 0);
            const cutoffMs = routineMs.getTime() + 2 * 60 * 60_000; // 2h grace
            if (now.getTime() < cutoffMs) continue; // grace not elapsed

            // Heuristic: if any daily_plans / entries / smart_notes row was written by this user today at/after routine time, consider it done.
            const { count: activityCount } = await supabase
                .from('entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', routineMs.toISOString());

            if ((activityCount || 0) > 0) continue;

            const dedup = `missed_${r.key}:${today}`;
            const ok = await tryEnqueue(supabase, {
                userId,
                toolCategory: 'off_track',
                notificationType: 'off_track_routine',
                scheduledFor: fireAt,
                title: `Missed ${r.label}`,
                body: `Quick reset — even 2 minutes counts.`,
                data: { route: r.route, routine: r.key, sourceType: 'missed_routine' },
                sourceType: 'missed_routine',
                sourceId: null,
                dedupKey: dedup,
            });
            if (ok) enqueued++;
        }
    }

    // 3) Skipped check-in (after 18:00 local)
    if (settings.offTrackSkippedCheckin && now.getHours() >= 18) {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const { count } = await supabase
            .from('entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', startOfDay.toISOString());

        if ((count || 0) === 0) {
            const dedup = `skipped_checkin:${today}`;
            const ok = await tryEnqueue(supabase, {
                userId,
                toolCategory: 'off_track',
                notificationType: 'off_track_checkin',
                scheduledFor: fireAt,
                title: 'No check-in today',
                body: "Take 30 seconds to log how you're doing.",
                data: { route: 'checkin', sourceType: 'skipped_checkin' },
                sourceType: 'skipped_checkin',
                sourceId: null,
                dedupKey: dedup,
            });
            if (ok) enqueued++;
        }
    }

    // 4) Idle (9am–9pm window)
    if (settings.offTrackIdle && now.getHours() >= 9 && now.getHours() <= 21) {
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60_000).toISOString();
        // Use any user-write table as a heartbeat. We pick smart_notes + todos + entries as "did the user do anything?".
        const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
            supabase
                .from('todos')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', sixHoursAgo),
            supabase
                .from('entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', sixHoursAgo),
            supabase
                .from('smart_notes')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', sixHoursAgo),
        ]);
        const totalRecent = (c1 || 0) + (c2 || 0) + (c3 || 0);

        if (totalRecent === 0) {
            const dedup = `idle:${today}`;
            const ok = await tryEnqueue(supabase, {
                userId,
                toolCategory: 'off_track',
                notificationType: 'off_track_idle',
                scheduledFor: fireAt,
                title: 'Quick check-in?',
                body: "It's been a while. One small step now beats none.",
                data: { route: 'home', sourceType: 'idle' },
                sourceType: 'idle',
                sourceId: null,
                dedupKey: dedup,
            });
            if (ok) enqueued++;
        }
    }

    return enqueued;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Find candidate users: anyone with at least one push subscription.
        const { data: subs, error } = await supabase
            .from('notification_subscriptions')
            .select('user_id');

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const uniqueUsers = Array.from(
            new Set((subs || []).map((s: { user_id: string }) => s.user_id)),
        );
        let totalEnqueued = 0;
        for (const userId of uniqueUsers) {
            try {
                totalEnqueued += await scanUser(supabase, userId);
            } catch (e) {
                console.error(`scanUser ${userId} failed:`, e);
            }
        }

        return new Response(
            JSON.stringify({
                users: uniqueUsers.length,
                enqueued: totalEnqueued,
                timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (e) {
        return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
