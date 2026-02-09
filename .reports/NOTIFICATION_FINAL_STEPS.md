# Notification System - Final Steps

## ✅ Completed

1. ✅ Database migration created and applied
2. ✅ VAPID keys generated and configured
3. ✅ Supabase secrets set (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL)
4. ✅ Edge Functions deployed (send-notification, schedule-notifications)
5. ✅ NotificationPermissionPrompt integrated into AccountPage
6. ✅ All services and hooks created

## 🔧 Remaining Steps

### 1. Set Up Cron Job (REQUIRED)

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule notification checker to run every 5 minutes
SELECT cron.schedule(
  'send-pending-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kdwgznfszbrysepsltua.supabase.co/functions/v1/schedule-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

### 2. Add Notification Icons (REQUIRED)

Create these 3 icon files in `public/` directory:

- **`public/icon-192.png`** - 192x192 pixels PNG (main notification icon)
- **`public/icon-512.png`** - 512x512 pixels PNG (large icon)
- **`public/icon-badge.png`** - 96x96 pixels PNG, monochrome (badge icon)

**How to create:**
- Use Figma, Canva, or AI image generator
- Simple circular logo with "B" or your app icon
- Export as PNG at specified sizes

**Quick option**: Use placeholder until you design proper icons:
- Take any existing logo/icon
- Resize to 192x192, 512x512, 96x96
- Save as PNG files

### 3. Test the System

Once icons are added, test notifications:

1. **Open your app** in a browser (must be HTTPS or localhost)
2. **Navigate to Account page** (Settings → Account)
3. **Click "Enable Notifications"**
4. **Grant permission** in browser prompt
5. **Test immediate notification**:

```typescript
// In browser console:
import { showLocalNotification } from './services/notifications';
await showLocalNotification('Test', 'This is a test!');
```

6. **Schedule a test notification** (1 minute from now):

Go to any tool settings (e.g., Tracker) and set a reminder time to 1 minute from now.

### 4. Integrate into Tool Settings (OPTIONAL)

Add notification scheduling to each tool's settings modal:

**Example for TrackerSettingsModal:**

```typescript
import { scheduleTrackerReminder, cancelNotifications } from '../../services/notifications';

// Add to settings:
const [enableReminders, setEnableReminders] = useState(false);
const [reminderTime, setReminderTime] = useState('20:00');

// In save handler:
if (enableReminders && reminderTime) {
  await scheduleTrackerReminder(userId, reminderTime, ['Mood', 'Sleep']);
} else {
  await cancelNotifications(userId, 'tracker');
}
```

## 🎯 Current Status

**What works NOW:**
- ✅ User can enable/disable notifications in Account page
- ✅ Subscription saved to database
- ✅ Device type detected (iOS/Windows/Android/Mac)
- ✅ Edge Functions ready to send notifications
- ✅ Database tables created with RLS

**What needs testing AFTER adding icons + cron:**
- ⏳ Scheduled notifications sending automatically
- ⏳ Notifications appearing on device
- ⏳ Clicking notification opens correct page
- ⏳ Tool-specific reminder scheduling

## 📱 Next Features to Add

After basic system works, enhance with:

1. **Tool-specific notification settings** in each settings modal
2. **Notification history** view in AccountPage
3. **Quiet hours** (don't notify between 10 PM - 8 AM)
4. **Notification preferences** (frequency, sound, vibration)
5. **Batch notifications** (group multiple reminders)

## 🐛 Troubleshooting

**"Enable Notifications" button doesn't appear:**
- Check browser console for errors
- Verify `user?.id` exists in AccountPage
- Check NotificationPermissionPrompt import

**Permission prompt appears but nothing happens:**
- Check browser supports notifications (all modern browsers do)
- Verify on HTTPS (localhost is OK)
- Check service worker is registered (DevTools → Application → Service Workers)

**Notifications don't send:**
- Verify cron job is set up (check with `SELECT * FROM cron.job;`)
- Check Edge Function logs in Supabase Dashboard
- Verify user has active subscription in database

## 🚀 You're Almost Done!

Just add the 3 icon files and run the cron SQL, then you'll have a fully functional cross-platform notification system!
