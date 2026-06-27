/**
 * Schedule Notifications Edge Function
 * Runs periodically to check and send pending notifications
 * Should be triggered via cron or pg_cron
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ScheduledNotification {
  id: string;
  user_id: string;
  tool_category: string;
  notification_type: string;
  scheduled_for: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  status: string;
}

/** User-level delivery preferences read from the settings table. */
interface DeliveryPrefs {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxRemindersPerHour: number;
  timezone: string;
}

const DEFAULT_TIMEZONE = 'Europe/Amsterdam';
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseHHMM(s: string | undefined, fallback: [number, number]): [number, number] {
  if (!s) return fallback;
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return fallback;
  return [h, m];
}

/** Minutes since local midnight in the given IANA timezone. */
function localMinutesNow(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    if (isNaN(h) || isNaN(m)) throw new Error('parse failed');
    return (h % 24) * 60 + m;
  } catch {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

/** Day of week (0=Sun … 6=Sat) of `d` in the given IANA timezone. */
function weekdayInTz(d: Date, timezone: string): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(d);
    const idx = WEEKDAY_NAMES.indexOf(name);
    return idx >= 0 ? idx : d.getDay();
  } catch {
    return d.getDay();
  }
}

/** True if local minutes fall within [start, end), wrapping across midnight. */
function inQuietHours(localMinutes: number, start: string, end: string): boolean {
  const [sh, sm] = parseHHMM(start, [22, 0]);
  const [eh, em] = parseHHMM(end, [7, 0]);
  const sMin = sh * 60 + sm;
  const eMin = eh * 60 + em;
  if (sMin === eMin) return false;
  if (sMin < eMin) return localMinutes >= sMin && localMinutes < eMin;
  return localMinutes >= sMin || localMinutes < eMin;
}

/** Minutes from the given local time until quiet hours end. */
function minutesUntilQuietEnd(localMinutes: number, end: string): number {
  const [eh, em] = parseHHMM(end, [7, 0]);
  const eMin = eh * 60 + em;
  const delta = eMin - localMinutes;
  return delta > 0 ? delta : delta + 24 * 60;
}

/** Load the user's quiet hours / rate-limit prefs (defaults when unset). */
async function loadDeliveryPrefs(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<DeliveryPrefs> {
  const prefs: DeliveryPrefs = {
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    maxRemindersPerHour: 3,
    timezone: DEFAULT_TIMEZONE,
  };
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', [
        'notifications_quietHoursEnabled',
        'notifications_quietHoursStart',
        'notifications_quietHoursEnd',
        'notifications_maxRemindersPerHour',
        'account_timezone',
      ]);
    for (const row of data || []) {
      let value: unknown = row.value;
      try { value = JSON.parse(row.value as string); } catch { /* keep raw string */ }
      switch (row.key) {
        case 'notifications_quietHoursEnabled': prefs.quietHoursEnabled = value !== false; break;
        case 'notifications_quietHoursStart': prefs.quietHoursStart = String(value); break;
        case 'notifications_quietHoursEnd': prefs.quietHoursEnd = String(value); break;
        case 'notifications_maxRemindersPerHour': {
          const n = Number(value);
          if (Number.isFinite(n) && n >= 1) prefs.maxRemindersPerHour = n;
          break;
        }
        case 'account_timezone': if (typeof value === 'string' && value) prefs.timezone = value; break;
      }
    }
  } catch (error) {
    console.error('Failed to load delivery prefs, using defaults:', error);
  }
  return prefs;
}

/** Count notifications actually sent to the user in the last hour. */
async function sentInLastHour(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<number> {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from('scheduled_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'sent')
    .gte('sent_at', since);
  return count || 0;
}

/** Push a pending row's fire time into the future without sending it. */
async function deferNotification(
  supabase: ReturnType<typeof createClient>,
  notificationId: string,
  newTime: Date
): Promise<void> {
  const { error } = await supabase
    .from('scheduled_notifications')
    .update({ scheduled_for: newTime.toISOString() })
    .eq('id', notificationId);
  if (error) {
    console.error('Failed to defer notification:', error);
  }
}

/**
 * Routine reminders are the app's daily anchor triggers. Each row fires once,
 * so after processing one we enqueue the next day's occurrence here — making
 * the anchors self-sustaining instead of dying after the first fire.
 * Respects an optional `data.daysOfWeek` allow-list (0=Sun … 6=Sat).
 */
async function rescheduleRoutineForTomorrow(
  supabase: ReturnType<typeof createClient>,
  notification: ScheduledNotification,
  timezone: string
): Promise<void> {
  const rawDays = notification.data?.daysOfWeek;
  const days = Array.isArray(rawDays)
    ? rawDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : null;
  // An explicit empty allow-list means "never" — don't re-enqueue.
  if (days && days.length === 0) return;

  // Next occurrence at the same time of day, always in the future (a backlog
  // row from days ago must not produce another already-due row).
  const next = new Date(notification.scheduled_for);
  while (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  if (days && days.length < 7) {
    const allowed = new Set(days);
    for (let i = 0; i < 7 && !allowed.has(weekdayInTz(next, timezone)); i++) {
      next.setDate(next.getDate() + 1);
    }
  }

  // Guard against doubles: skip if a pending row for this routine already exists.
  const { data: existing } = await supabase
    .from('scheduled_notifications')
    .select('id')
    .eq('user_id', notification.user_id)
    .eq('tool_category', notification.tool_category)
    .eq('status', 'pending')
    .limit(1);
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from('scheduled_notifications').insert({
    user_id: notification.user_id,
    tool_category: notification.tool_category,
    notification_type: notification.notification_type,
    scheduled_for: next.toISOString(),
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    status: 'pending',
  });
  if (error) {
    console.error('Failed to reschedule routine reminder:', error);
  }
}

/**
 * Live counts for the morning anchor so the nudge says what actually matters
 * ("2 due · 1 overdue · 3 school deadlines") instead of a generic line.
 * Falls back to the stored body on any error.
 */
async function buildAnchorBody(
  supabase: ReturnType<typeof createClient>,
  notification: ScheduledNotification
): Promise<string> {
  if (notification.tool_category !== 'routine_morning') {
    return notification.body;
  }

  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const horizon = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

    const [dueRes, overdueRes, assignmentsRes] = await Promise.all([
      supabase
        .from('todos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', notification.user_id)
        .eq('completed', false)
        .gte('due_date', todayStart.toISOString())
        .lte('due_date', todayEnd.toISOString()),
      supabase
        .from('todos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', notification.user_id)
        .eq('completed', false)
        .lt('due_date', todayStart.toISOString()),
      supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', notification.user_id)
        .in('status', ['pending', 'in_progress'])
        .lt('deadline', horizon.toISOString()),
    ]);

    const due = dueRes.count ?? 0;
    const overdue = overdueRes.count ?? 0;
    const school = assignmentsRes.count ?? 0;

    if (due === 0 && overdue === 0 && school === 0) {
      return 'Plan today — nothing due yet. Capture what matters.';
    }

    const parts: string[] = [];
    if (due > 0) parts.push(`${due} due today`);
    if (overdue > 0) parts.push(`${overdue} overdue`);
    if (school > 0) parts.push(`${school} school deadline${school === 1 ? '' : 's'} this week`);
    return `Plan today — ${parts.join(' · ')}.`;
  } catch (error) {
    console.error('Failed to build anchor body, using stored body:', error);
    return notification.body;
  }
}

/**
 * Send notification via Edge Function
 */
async function sendNotification(
  supabaseUrl: string,
  supabaseKey: string,
  subscriptionId: string,
  title: string,
  body: string,
  data: Record<string, any> | null
): Promise<boolean> {
  try {
    // Pull action buttons out of data so the SW can render them on iOS lock screen.
    const actions = Array.isArray(data?.actions) ? data!.actions : undefined;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        subscriptionId,
        title,
        body,
        data,
        actions,
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time with 1-minute buffer (to catch notifications scheduled in the past minute)
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 60 * 1000); // 1 minute in future

    // Fetch pending notifications that should be sent now
    const { data: notifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', bufferTime.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(100); // Process up to 100 notifications at a time

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notifications' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({
          processed: 0,
          message: 'No pending notifications to send',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group notifications by user
    const notificationsByUser = notifications.reduce((acc, notification) => {
      if (!acc[notification.user_id]) {
        acc[notification.user_id] = [];
      }
      acc[notification.user_id].push(notification);
      return acc;
    }, {} as Record<string, ScheduledNotification[]>);

    let sentCount = 0;
    let failedCount = 0;

    let deferredCount = 0;

    // Process each user's notifications
    for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
      const prefs = await loadDeliveryPrefs(supabase, userId);

      // Quiet hours: hold everything until the window ends instead of waking
      // the user. Routine anchors keep their original scheduled_for (their
      // self-reschedule derives tomorrow's time from it, so changing it would
      // drift the anchor); they simply stay pending and fire at quiet end.
      const localMins = localMinutesNow(prefs.timezone);
      if (prefs.quietHoursEnabled && inQuietHours(localMins, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        const quietEnd = new Date(
          Date.now() + minutesUntilQuietEnd(localMins, prefs.quietHoursEnd) * 60_000
        );
        for (const notification of userNotifications) {
          if (notification.notification_type !== 'routine_reminder') {
            await deferNotification(supabase, notification.id, quietEnd);
          }
        }
        deferredCount += userNotifications.length;
        continue;
      }

      // Get subscriptions for this user (all rows are active; invalid ones get deleted)
      const { data: subscriptions } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (!subscriptions || subscriptions.length === 0) {
        // Mark notifications as failed (no active subscriptions)
        for (const notification of userNotifications) {
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'failed',
              sent_at: new Date().toISOString(),
              error_message: 'No active subscriptions',
            })
            .eq('id', notification.id);

          // Keep daily anchors alive even while no device is subscribed,
          // so they start firing the moment the user re-enables push.
          if (notification.notification_type === 'routine_reminder') {
            await rescheduleRoutineForTomorrow(supabase, notification, prefs.timezone);
          }
        }
        failedCount += userNotifications.length;
        continue;
      }

      // Rate limit: never push more than maxRemindersPerHour in any rolling hour.
      let sentThisHour = await sentInLastHour(supabase, userId);

      // Send each notification to all user's subscriptions
      for (const notification of userNotifications) {
        // Routine anchors are exempt from the cap (max 3/day) — it exists to
        // stop task/off-track floods, not the daily rhythm.
        const isAnchor = notification.notification_type === 'routine_reminder';
        if (!isAnchor && sentThisHour >= prefs.maxRemindersPerHour) {
          // Over the cap — push the rest 30 minutes out and try again then.
          await deferNotification(supabase, notification.id, new Date(Date.now() + 30 * 60_000));
          deferredCount++;
          continue;
        }

        let notificationSent = false;
        const body = await buildAnchorBody(supabase, notification);

        for (const subscription of subscriptions) {
          const success = await sendNotification(
            supabaseUrl,
            supabaseKey,
            subscription.id,
            notification.title,
            body,
            notification.data
          );

          if (success) {
            notificationSent = true;
          }
        }

        // Update notification status
        await supabase
          .from('scheduled_notifications')
          .update({
            status: notificationSent ? 'sent' : 'failed',
            sent_at: new Date().toISOString(),
            error_message: notificationSent ? null : 'Failed to send to any subscription',
          })
          .eq('id', notification.id);

        // Daily anchors re-enqueue themselves for tomorrow.
        if (notification.notification_type === 'routine_reminder') {
          await rescheduleRoutineForTomorrow(supabase, notification, prefs.timezone);
        }

        if (notificationSent) {
          sentCount++;
          sentThisHour++;
        } else {
          failedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        processed: notifications.length,
        sent: sentCount,
        failed: failedCount,
        deferred: deferredCount,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
