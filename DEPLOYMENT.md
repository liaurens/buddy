# Deployment Guide

## 1. Cloud Sync Setup (Database)
Before deploying, you need to create your cloud database ID.

1.  Open your vscode terminal.
2.  Run: `npx dexie-cloud create`
3.  Follow the prompts (enter email, verify OTP).
4.  It will output a **Database URL** (e.g., `https://zyx123.dexie.cloud`).
5.  Open `src/services/db.ts` and paste this URL into the `databaseUrl` field.

```typescript
this.cloud.configure({
    databaseUrl: "https://your-new-url.dexie.cloud", 
    requireAuth: false
});
```

---

## 2. Hosting (Netlify) & Phone Access
We recommend Netlify for free, easy hosting.

### Option A: Drag & Drop (Easiest)
1.  Run `npm run build` in your terminal.
2.  Locate the `dist` folder in your project directory.
3.  Go to [app.netlify.com/drop](https://app.netlify.com/drop).
4.  Drag the `dist` folder onto the page.
5.  Your site is live! You can now open this URL on your phone.

### Option B: GitHub (Recommended for automatic updates)
1.  Push your code to a GitHub repository.
2.  Log in to Netlify and click "Add new site" -> "Import an existing project".
3.  Select your repo.
4.  Netlify will auto-detect the settings (Build command: `npm run build`, Publish directory: `dist`).
5.  Click **Deploy**.

## 3. Syncing Devices
1.  Open the app on your **PC**.
2.  Go to **Settings** -> **Cloud Sync** -> **Log In**.
3.  Enter your email and OTP code.
4.  Now open the app on your **Phone**.
5.  Log in with the same email.
6.  **Done!** Your strategies, logs, and trackers stay in sync instantly.
