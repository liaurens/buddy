# Notification System

Cross-platform push notification system for Buddy App supporting iOS, Android, Windows, and Mac.

## Architecture Overview

The notification system consists of:

1. **Database Layer** - Supabase tables for subscriptions, scheduled notifications, and logs
2. **Services Layer** - TypeScript services for managing notifications
3. **Frontend Components** - React hooks and UI components
4. **Service Worker** - Handles push notifications in the browser
5. **Edge Functions** - Serverless functions for sending notifications

## Database Schema

### Tables

**notification_subscriptions**
- Stores user push subscription details
- Tracks device type and user agent
- Manages subscription lifecycle (created, last_used, is_active)

**scheduled_notifications**
- Queue for notifications to be sent
- Supports tool-specific notifications
- Tracks status (pending, sent, failed, cancelled)

**notification_logs**
- Audit trail of all sent notifications
- Tracks delivery status and errors
- Links to subscriptions and scheduled notifications

## Services

### notification.service.ts
Core database operations:
- `saveNotificationSubscription()` - Save push subscription
- `scheduleNotification()` - Schedule a notification
- `getPendingNotifications()` - Get upcoming notifications
- `logNotification()` - Log notification delivery
- `cancelToolNotifications()` - Cancel tool notifications

### push.service.ts
Web Push API integration:
- `isPushSupported()` - Check browser support
- `subscribeToPush()` - Subscribe to push notifications
- `unsubscribeFromPush()` - Unsubscribe from notifications
- `requestNotificationPermission()` - Request browser permission
- `detectDeviceType()` - Detect iOS/Android/Windows/Mac

### scheduler.service.ts
Scheduling helpers for different tools:
- `scheduleNotificationAt()` - Schedule at specific time
- `scheduleDailyNotification()` - Recurring daily notification
- `scheduleNotificationIn()` - Schedule relative to now
- Tool-specific helpers:
  - `scheduleTrackerReminder()` - Daily tracker reminders
  - `scheduleProtocolDose()` - Protocol dose reminders
  - `scheduleCheckInReminder()` - Daily check-in reminders
  - `scheduleTaskDue()` - Task due notifications
  - `schedulePomodoroComplete()` - Pomodoro timer notifications
  - `scheduleCalendarEvent()` - Calendar event reminders

## React Integration

### useNotifications Hook

```typescript
const {
  permission,           // Current permission status
  isSupported,         // Browser support check
  isSubscribed,        // Subscription status
  pendingNotifications,// Upcoming notifications
  subscribe,           // Subscribe function
  unsubscribe,         // Unsubscribe function
  refreshPending,      // Refresh pending list
} = useNotifications(userId);
```

### NotificationPermissionPrompt Component

UI component for requesting notification permissions:

```typescript
<NotificationPermissionPrompt
  userId={userId}
  onClose={() => setShowPrompt(false)}
  showCloseButton={true}
/>
```

## Edge Functions

### send-notification
Sends individual push notifications using Web Push protocol.

**Endpoint**: `/functions/v1/send-notification`

**Payload**:
```json
{
  "subscriptionId": "uuid",
  "title": "Notification Title",
  "body": "Notification body text",
  "data": { "custom": "data" }
}
```

### schedule-notifications
Cron function that checks for pending notifications and sends them.

**Should run every**: 1-5 minutes (via pg_cron or external cron)

## Setup Instructions

### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### 2. Configure Environment Variables

Add to `.env`:

```env
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

Add to Supabase Edge Function secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key_here
supabase secrets set VAPID_PRIVATE_KEY=your_private_key_here
supabase secrets set VAPID_EMAIL=mailto:your-email@example.com
```

### 3. Apply Database Migration

```bash
supabase db push
```

Or apply manually via Supabase Dashboard using:
`supabase/migrations/20260129000000_create_notifications.sql`

### 4. Deploy Edge Functions

```bash
supabase functions deploy send-notification
supabase functions deploy schedule-notifications
```

### 5. Set Up Cron Job

Option A: Using pg_cron (Supabase)

```sql
SELECT cron.schedule(
  'send-pending-notifications',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/schedule-notifications',
    headers := '{"Authorization": "Bearer your-service-role-key"}'::jsonb
  );
  $$
);
```

Option B: External cron (GitHub Actions, Render Cron, etc.)

```yaml
# .github/workflows/notifications-cron.yml
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  send-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notification scheduler
        run: |
          curl -X POST https://your-project.supabase.co/functions/v1/schedule-notifications \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}"
```

### 6. Add Icons

Ensure these files exist in `public/`:
- `icon-192.png` - Main notification icon (192x192)
- `icon-512.png` - Large icon (512x512)
- `icon-badge.png` - Badge icon (96x96, monochrome)

## Usage Examples

### Subscribe to Notifications

```typescript
import { useNotifications } from './hooks/useNotifications';

function MyComponent() {
  const { subscribe, isSubscribed } = useNotifications(userId);

  const handleEnable = async () => {
    await subscribe();
  };

  return (
    <button onClick={handleEnable} disabled={isSubscribed}>
      Enable Notifications
    </button>
  );
}
```

### Schedule a Tracker Reminder

```typescript
import { scheduleTrackerReminder } from './services/notifications';

async function setupTrackerNotification(userId: string) {
  await scheduleTrackerReminder(
    userId,
    '20:00', // 8 PM daily
    ['Mood', 'Sleep', 'Exercise']
  );
}
```

### Schedule a Protocol Dose

```typescript
import { scheduleProtocolDose } from './services/notifications';

async function setupProtocolNotification(userId: string) {
  await scheduleProtocolDose(
    userId,
    'Vitamin D',
    '09:00', // 9 AM
    15 // Notify 15 minutes early
  );
}
```

### Cancel All Notifications for a Tool

```typescript
import { cancelNotifications } from './services/notifications';

async function disableTrackerNotifications(userId: string) {
  await cancelNotifications(userId, 'tracker');
}
```

## Platform Support

### iOS (Safari)
- Requires HTTPS
- Must add to Home Screen for push support
- Works like native app notifications

### Android (Chrome, Firefox)
- Full push notification support
- Works in browser and installed PWA

### Windows (Chrome, Edge)
- Full push notification support
- Notifications appear in Windows Action Center

### macOS (Safari, Chrome)
- Full push notification support
- Appears in macOS Notification Center

## Security

### Row Level Security (RLS)
All tables have RLS policies ensuring users can only:
- Read their own subscriptions
- Create their own subscriptions
- Update/delete their own subscriptions
- Schedule notifications for themselves
- View their own notification logs

### VAPID Keys
- Private key stored securely in Supabase secrets
- Public key embedded in frontend (safe to expose)
- Keys ensure notifications come from authorized source

## Testing

### Test Local Notification

```typescript
import { showLocalNotification } from './services/notifications';

await showLocalNotification(
  'Test Notification',
  'This is a test notification',
  { testData: 'value' }
);
```

### Test Scheduled Notification

```typescript
import { scheduleNotificationIn } from './services/notifications';

// Schedule notification 1 minute from now
await scheduleNotificationIn(
  userId,
  'tracker',
  'tracker_reminder',
  1, // 1 minute
  'Test Title',
  'Test Body'
);
```

## Troubleshooting

### Notifications Not Appearing

1. Check browser permission: `Notification.permission` should be `"granted"`
2. Verify service worker is registered: Check DevTools > Application > Service Workers
3. Check subscription exists: Use `isSubscribed()` function
4. Verify VAPID keys are configured correctly
5. Check browser console for errors

### Subscription Fails

1. Ensure HTTPS (required for push notifications)
2. Check VAPID public key is set in `.env`
3. Verify service worker is registered
4. Check browser supports Push API

### Scheduled Notifications Not Sent

1. Verify cron job is running
2. Check Edge Function logs in Supabase Dashboard
3. Ensure user has active subscriptions
4. Verify scheduled_for time is in the past

## Future Enhancements

- [ ] Batch notification sending for better performance
- [ ] Notification grouping and stacking
- [ ] Rich notifications with images
- [ ] Action buttons in notifications
- [ ] Notification preferences (quiet hours, frequency)
- [ ] Analytics and delivery tracking
- [ ] A/B testing for notification content
- [ ] Smart scheduling based on user behavior
