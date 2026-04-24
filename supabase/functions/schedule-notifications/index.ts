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

interface NotificationSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
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

    // Process each user's notifications
    for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
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
        }
        failedCount += userNotifications.length;
        continue;
      }

      // Send each notification to all user's subscriptions
      for (const notification of userNotifications) {
        let notificationSent = false;

        for (const subscription of subscriptions) {
          const success = await sendNotification(
            supabaseUrl,
            supabaseKey,
            subscription.id,
            notification.title,
            notification.body,
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

        if (notificationSent) {
          sentCount++;
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
