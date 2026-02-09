# Notification System - Setup Checklist

## ✅ Completed

### Phase 1: Database & Types (DONE)
- ✅ Created database migration (`supabase/migrations/20260129000000_create_notifications.sql`)
  - notification_subscriptions table
  - scheduled_notifications table
  - notification_logs table
  - Row Level Security policies
  - Indexes for performance
- ✅ Created TypeScript types (`src/services/notifications/notification.types.ts`)
- ✅ Created notification service (`src/services/notifications/notification.service.ts`)

### Phase 2: Web Push Services (DONE)
- ✅ Created push service (`src/services/notifications/push.service.ts`)
  - Browser Push API integration
  - Device detection (iOS/Android/Windows/Mac)
  - Permission management
- ✅ Created scheduler service (`src/services/notifications/scheduler.service.ts`)
  - Tool-specific scheduling helpers
  - Daily/one-time notification scheduling
- ✅ Created service exports (`src/services/notifications/index.ts`)

### Phase 3: Frontend Integration (DONE)
- ✅ Created React hook (`src/hooks/useNotifications.ts`)
- ✅ Created permission prompt component (`src/components/notifications/NotificationPermissionPrompt.tsx`)
- ✅ Created service worker (`public/sw.js`)
  - Push event handling
  - Notification click handling
  - Offline caching

### Phase 4: Edge Functions (DONE)
- ✅ Created send-notification function (`supabase/functions/send-notification/index.ts`)
- ✅ Created schedule-notifications function (`supabase/functions/schedule-notifications/index.ts`)

### Documentation (DONE)
- ✅ Created comprehensive documentation (`docs/NOTIFICATION_SYSTEM.md`)
- ✅ Updated environment files with VAPID key placeholders

## 🔧 Remaining Setup Steps

### 1. Generate VAPID Keys

**Run this command:**
```bash
npx web-push generate-vapid-keys
```

**You'll get output like:**
```
Public Key: BOa1bF...
Private Key: abcdef123...
```

### 2. Configure Environment Variables

**In `.env` file:**
```env
VITE_VAPID_PUBLIC_KEY=BOa1bF...your-public-key...
```

**In Supabase (Dashboard > Project Settings > Edge Functions > Secrets):**
```
VAPID_PUBLIC_KEY=BOa1bF...your-public-key...
VAPID_PRIVATE_KEY=abcdef123...your-private-key...
VAPID_EMAIL=mailto:your-email@example.com
```

### 3. Apply Database Migration

**Option A: Via Supabase CLI**
```bash
supabase db push
```

**Option B: Via Supabase Dashboard**
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/migrations/20260129000000_create_notifications.sql`
3. Paste and run

### 4. Deploy Edge Functions

```bash
# Deploy send-notification function
supabase functions deploy send-notification

# Deploy schedule-notifications function
supabase functions deploy schedule-notifications
```

### 5. Set Up Cron Job for Scheduled Notifications

**Option A: Using pg_cron (Recommended for Supabase)**

Run this SQL in Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'send-pending-notifications',
  '* * * * *', -- Every minute (adjust as needed)
  $$
  SELECT net.http_post(
    url := 'https://kdwgznfszbrysepsltua.supabase.co/functions/v1/schedule-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

**Option B: Using External Cron (GitHub Actions)**

Create `.github/workflows/notifications-cron.yml`:

```yaml
name: Send Scheduled Notifications

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  send-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notification scheduler
        run: |
          curl -X POST \
            https://kdwgznfszbrysepsltua.supabase.co/functions/v1/schedule-notifications \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

### 6. Add Notification Icons

Create these icon files in `public/` directory:
- `icon-192.png` (192x192 pixels) - Main notification icon
- `icon-512.png` (512x512 pixels) - Large icon
- `icon-badge.png` (96x96 pixels, monochrome) - Badge icon

You can use a tool like Figma, Canva, or an AI image generator to create these.

### 7. Integrate Permission Prompt into App

Add the NotificationPermissionPrompt component to your app (e.g., on HomePage or Settings):

```typescript
import { NotificationPermissionPrompt } from './components/notifications';
import { useAuth } from './hooks/useAuth';

function HomePage() {
  const { user } = useAuth();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);

  return (
    <div>
      {showNotificationPrompt && user && (
        <NotificationPermissionPrompt
          userId={user.id}
          onClose={() => setShowNotificationPrompt(false)}
        />
      )}
      {/* Rest of your page */}
    </div>
  );
}
```

### 8. Add Notification Settings to Tool Pages

For each tool that needs notifications (Tracker, Protocol, CheckIn, etc.), add notification scheduling in their settings modals.

**Example for TrackerSettingsModal:**

```typescript
import { scheduleTrackerReminder, cancelNotifications } from '../../services/notifications';

// Inside your settings save handler:
const handleSave = async () => {
  // ... existing save logic ...

  // Handle notifications
  if (settings.enableReminders && settings.reminderTime) {
    await scheduleTrackerReminder(
      userId,
      settings.reminderTime,
      ['Mood', 'Sleep', 'Exercise']  // Your tracker names
    );
  } else {
    await cancelNotifications(userId, 'tracker');
  }
};
```

## 📋 Testing Checklist

Once setup is complete, test the following:

### Browser Permissions
- [ ] Can request notification permission
- [ ] Permission prompt appears correctly
- [ ] Can grant permission
- [ ] Can deny permission

### Subscription
- [ ] Can subscribe to push notifications
- [ ] Subscription saved to database
- [ ] Device type detected correctly
- [ ] Can unsubscribe

### Local Notifications (Testing)
- [ ] Can show local test notification
- [ ] Notification appears with correct title/body
- [ ] Clicking notification opens app

### Scheduled Notifications
- [ ] Can schedule a notification 1 minute in future
- [ ] Notification appears at scheduled time
- [ ] Notification saved to database as "sent"
- [ ] Clicking notification navigates to correct page

### Tool-Specific Notifications
- [ ] Tracker daily reminder works
- [ ] Protocol dose reminder works
- [ ] Check-in reminder works
- [ ] Task due reminder works
- [ ] Pomodoro completion works
- [ ] Calendar event reminder works

### Edge Cases
- [ ] Handles multiple subscriptions for same user
- [ ] Handles subscription expiration gracefully
- [ ] Failed notifications logged correctly
- [ ] Cancelled notifications don't send

## 🚀 Quick Start Guide for Users

After setup, users can enable notifications:

1. **Click the Settings button** in bottom navigation
2. **Enable notifications** when prompted (or in Account settings)
3. **Configure tool-specific reminders** in each tool's settings:
   - Health Tracker: Set daily reminder time
   - Protocols: Set dose reminder times
   - Check-In: Set daily check-in reminder
   - Tasks: Enable task due reminders
   - Pomodoro: Enable completion notifications
   - Calendar: Enable event reminders

## 📱 Platform-Specific Notes

### iOS (Safari)
- User must "Add to Home Screen" for push notifications to work
- Once added, notifications work like native app
- Test on actual iOS device (simulator doesn't support push)

### Android (Chrome/Firefox)
- Works in browser and as installed PWA
- Full notification support out of the box

### Windows (Chrome/Edge)
- Notifications appear in Windows Action Center
- Full support in browser and PWA

### macOS (Safari/Chrome)
- Notifications appear in macOS Notification Center
- Full support in all modern browsers

## 🐛 Common Issues & Solutions

### "Push notifications not supported"
- Ensure you're on HTTPS (localhost is OK for testing)
- Check browser supports Push API (all modern browsers do)
- Service worker must be registered

### "Subscription failed"
- Check VAPID_PUBLIC_KEY is set in .env
- Ensure service worker is registered and active
- Check browser console for detailed errors

### "Notifications not appearing"
- Verify permission is "granted" (not "denied" or "default")
- Check subscription exists in database
- Verify cron job is running
- Check Edge Function logs in Supabase Dashboard

### "TypeError: schema._def.shape is not a function"
- This was already fixed in settings.service.ts
- If you see it elsewhere, remove () parentheses (it's a property, not a function)

## Next Steps After Setup

Once the notification system is working:

1. **Add notification preferences** to AccountPage settings
   - Enable/disable notifications globally
   - Set quiet hours (e.g., 10 PM - 8 AM)
   - Configure notification frequency

2. **Add notification history** view
   - Show recent notifications
   - Allow users to see what they missed

3. **Implement notification batching**
   - Group similar notifications
   - Reduce notification spam

4. **Add analytics**
   - Track notification delivery rates
   - Measure click-through rates
   - A/B test notification content
