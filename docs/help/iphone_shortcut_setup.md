# iPhone Shortcut Setup (quick capture)

Capture anything into Buddy from Siri or a back-tap. Free text is routed by AI; a leading
flag (`-task`, `-note`, …) skips AI and routes deterministically.

> **This is independent of the web host.** The Shortcut talks to **Supabase**, not to
> Netlify. Moving the app to a new Netlify account/site changes nothing here — see
> [`hosting-migration.md`](hosting-migration.md).

## What it targets

| | |
|---|---|
| Endpoint | `https://<project-ref>.supabase.co/functions/v1/assistant` (POST) |
| Auth (gateway) | `Authorization: Bearer <publishable anon key>` — **required** |
| Auth (Buddy) | `api_key` in the JSON body — your capture token |

The old `quick-note` function was removed — everything goes through `assistant` now.

## Prerequisites

1. The `assistant` edge function is deployed:
   `supabase functions deploy assistant`
2. The `capture_tokens` table exists — migration `20260714000002_secure_capture_tokens.sql`.
   Tokens are stored as a SHA-256 hash; the plaintext is shown **once**, at rotation.
3. A capture token has been generated in the app.

## Step 1 — get your token and header

In the app: **Me → Account & advanced → Quick Capture API (iPhone Shortcut)**.

- Tap **Generate / Rotate Key**. Copy the `qn_…` token immediately — it is never shown again.
- The same panel shows the exact **Endpoint** and **Authorization** header value, each with a
  copy button.

## Step 2 — build the Shortcut

1. **Shortcuts** app → **+**.
2. **Ask for Input** — Question: `Capture`, Input Type: Text.
3. **Get Contents of URL**
   - URL: the endpoint from Step 1
   - Method: **POST**
   - Headers:
     - `Content-Type`: `application/json`
     - `Authorization`: `Bearer sb_publishable_…` ← the value from Step 1
   - Request Body: **JSON**
     ```json
     {
       "input": "<Ask for Input result>",
       "api_key": "<your qn_… token>",
       "source": "iphone"
     }
     ```
4. **Get Dictionary Value** — key `action_taken` from the previous result.
5. **Show Notification** — body: the dictionary value. Confirms what Buddy did.
6. Name it **Capture**.

## Step 3 — trigger it

- **Back Tap:** Settings → Accessibility → Touch → Back Tap → Double/Triple Tap → *Capture*.
- **Siri:** "Hey Siri, Capture".

## Flags (skip AI)

| Flag | Example |
|---|---|
| `-task` / `-todo` | `-task fix bike by friday` |
| `-done` | `-done fix bike` |
| `-note` | `-note idea for the chapter intro` |
| `-find` | `-find machine learning` |
| `-shop` / `-boodschap` | `-shop milk, eggs` |
| `-remind` | `-remind 14:00 call dentist` *(needs a time)* |
| `-mood` | `-mood 4 feeling good` |
| `-checkin` | `-checkin sleep 7 energy 3` |
| `-journal` | `-journal today I learned…` |
| `-goal` | `-goal read 20 books this year` |
| `-study` | `-study linear algebra 2h` |
| `-agenda` | *(today's calendar)* |
| `-habits` | *(streaks & open tasks)* |

No flag → AI routes it. The slash form (`/task …`) works too.

## Troubleshooting

Read the response body — the two 401s look identical on the phone but mean opposite things.

| Response | Cause | Fix |
|---|---|---|
| `{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}` | Gateway rejected it. The `Authorization` header is missing or misspelled. The request never reached Buddy. | Add the header from Step 1. |
| `{"success":false,"error":"Authentication failed"}` | Reached Buddy; the `api_key` in the body is wrong, or no capture token exists for your account. | Rotate the key in the app and paste the new one. |
| `{"success":false,"error":"Direct actions require account authentication"}` | Body contains `action` + `domain`. Those are website-only. | Send `input` instead. |
| `{"error":"input is required"}` | Empty text. | — |

Check the function logs with `supabase functions logs assistant` (or the Supabase dashboard)
if the response is a 500.

## Security

- The capture token is stored as a one-way SHA-256 hash in `capture_tokens` — the server
  cannot recover it, so rotation is the only recovery path.
- One token per account. Rotating invalidates the previous one immediately.
- The `Authorization` bearer value is the **publishable** anon key, already public in the web
  bundle. It is not a secret; the capture token is.
