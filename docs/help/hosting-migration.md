# Hosting / domain migration checklist

How to move the app to a new Netlify site (or any host) and what has to follow it.

> **Key fact:** the app's code is domain-agnostic. The OAuth redirect is built from
> `window.location.origin`, the service worker uses `self.location.origin`, and the PWA
> manifest uses only relative paths. So **no source change is needed to switch hosts** —
> everything below is dashboard config and one manual phone step.

---

## 1. Netlify (the new site)

1. New Netlify account/team (correct email) → **Add new site → Import from Git** → this repo, branch `main`.
2. Build settings are read from [`netlify.toml`](../../netlify.toml) automatically:
   - Build command: `npm run build`
   - Publish dir: `dist`
   - SPA redirect `/* → /index.html 200` (already in the toml — do **not** also add it in the UI).
3. **Environment variables** (Site configuration → Environment variables). All are `VITE_`
   (public, client-side) — none are server secrets. Copy from the real `.env`:

   | Key | Source |
   |---|---|
   | `VITE_SUPABASE_URL` | unchanged — Supabase project isn't moving |
   | `VITE_SUPABASE_ANON_KEY` | unchanged (publishable key) |
   | `VITE_AI_DEFAULT_PROVIDER` | e.g. `openai` |
   | `VITE_VAPID_PUBLIC_KEY` | unchanged — VAPID *private* key stays on Supabase |
   | `VITE_GOOGLE_OAUTH_CLIENT_ID` | unchanged — public client ID |

4. Trigger a deploy. Note the new URL (`https://<site>.netlify.app` or your custom domain).

---

## 2. Google Cloud Console — OAuth (REQUIRED, the #1 silent breaker)

Calendar connect breaks until the new origin is registered, because Google rejects any
redirect URI it doesn't recognise.

- APIs & Services → Credentials → your **OAuth 2.0 Web client** → **Authorized redirect URIs**:
  add `https://<new-domain>/oauth/google/callback`
- Keep `http://localhost:5173/oauth/google/callback` for dev.
- If you use a **custom domain**, register that domain's callback once and you never touch
  this again when switching hosts.

The client **secret** lives only on the Supabase edge functions
(`supabase secrets set GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=…`) — nothing to
change there for a host move.

---

## 3. Supabase — Auth URL config

Authentication → URL Configuration → add the new domain to **Site URL** / **Redirect URLs**
so any auth redirects resolve to the new origin.

(The Supabase **project itself does not change** — same URL, same anon key, same edge
functions, same secrets. Only the frontend host is moving.)

---

## 4. iPhone — two different "shortcuts", only one is affected

| Thing | Targets | Action on host move |
|---|---|---|
| **iOS Shortcuts app** automation (Back-Tap quick-capture — see [`iphone_shortcut_setup.md`](iphone_shortcut_setup.md)) | **Supabase** edge function URL | **None.** Supabase isn't moving. |
| **Home-screen PWA icon** ("Add to Home Screen") | the **frontend host** domain | **Re-add** from the new URL; delete the old icon. |

The home-screen icon is bound to whatever domain it was installed from, so after the domain
changes the old icon points at the dead/paid site. Open the new URL in Safari → Share →
**Add to Home Screen**, then delete the old icon.

---

## 5. Recommended: a custom domain (so step 4 + re-registration never happen again)

Everything that needs touching above is keyed to the `*.netlify.app` subdomain. Put a custom
domain in front (Netlify → Domain settings) and the app's identity stops being tied to the
host:

- Home-screen PWA icon never needs re-adding when you switch hosts.
- Google OAuth redirect URI is registered **once**.
- Supabase redirect URL is registered **once**.
- Future host switch = repoint DNS only. Nothing else changes.

---

## 6. Decommission the old site

Once the new site is verified (load app, log in, connect Calendar, receive a push), delete or
downgrade the old paid Netlify site so billing on the wrong email stops.

---

## Verify

- [ ] App loads on new URL, login works
- [ ] Calendar → Connect completes consent (proves step 2)
- [ ] Push notification received on new install (proves VAPID env var)
- [ ] iOS Shortcuts quick-capture still posts (should be unaffected)
- [ ] Old site deleted/downgraded
