# iPhone Shortcut Setup for Quick Notes

This guide explains how to set up an iPhone Shortcut to quickly capture notes using the back-tap feature.

## Prerequisites

1. Deploy the Supabase Edge Function (see below)
2. Generate an API key in the app

## Step 1: Deploy the Edge Function

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy quick-note
```

## Step 2: Generate API Key (In-App)

1. Go to Settings in the app
2. Under "Quick Notes API", tap "Generate API Key"
3. Copy the key (you'll need it for the Shortcut)

## Step 3: Create the iPhone Shortcut

### Option A: Simple Shortcut (Manual Setup)

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Add these actions:

**Action 1: Ask for Input**
- Question: "Quick Note"
- Input Type: Text

**Action 2: Get Contents of URL**
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/quick-note`
- Method: POST
- Headers:
  - `Content-Type`: `application/json`
- Request Body: JSON
  ```json
  {
    "content": [Ask for Input result],
    "api_key": "YOUR_API_KEY"
  }
  ```

**Action 3: Show Notification** (Optional)
- Title: "Note Saved"
- Body: [Get Contents of URL result]

4. Name the shortcut "Quick Note"

### Option B: Import Shortcut

Download the pre-made shortcut (coming soon) and update the URL and API key.

## Step 4: Set Up Back Tap

1. Go to **Settings** > **Accessibility** > **Touch** > **Back Tap**
2. Choose **Double Tap** or **Triple Tap**
3. Select your "Quick Note" shortcut

## Usage

1. **Double-tap** (or triple-tap) the back of your iPhone
2. Type your note with optional flag: `Buy milk -boodschap`
3. Tap **Done**
4. The note is automatically sorted and saved!

## Flags Reference

Default flags (customizable in the app):
- `-boodschap` → Groceries
- `-todo` → Todo
- `-werk` → Work
- `-idee` → Ideas
- `-project` → Project

Notes without flags go to the **Inbox**.

## Troubleshooting

### "Authentication required" error
- Make sure your API key is correct
- Regenerate the API key in Settings if needed

### Note not appearing in app
- Pull to refresh in the Quick Notes page
- Check if the flag matches a category (case-insensitive)

### Shortcut not triggering
- Ensure Back Tap is enabled in Accessibility settings
- Try restarting your iPhone

## Security Notes

- Your API key is tied to your account only
- Never share your API key
- You can regenerate it anytime to invalidate old keys
- The API key is stored securely in your Supabase settings
