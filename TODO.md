# TODO

Open follow-ups. Excludes the in-progress Google Calendar write feature
(`google-calendar-auth` / `google-calendar-write` functions + `20260618000001` migration),
which is intentionally being worked on separately.

## Pending

- [ ] **Commit the assistant boot-crash fix**
  The 3 fixed files are deployed to prod but not yet committed:
  `supabase/functions/assistant/core/command-parser.ts`, `core/rule-engine.ts`, `core/ai-classifier.ts`.
  Suggested message: `fix: defer ALL_TOOLS reads to avoid edge-function boot crash`.

- [ ] **Fix misspelled `quik-note` edge function slug**
  The legacy notes function is deployed as `quik-note` (missing the `c`), so any iPhone
  shortcut pointing at `/functions/v1/quick-note` returns 404. Either redeploy under the
  correct `quick-note` slug (and delete the misspelled one), or confirm the shortcut now
  targets `/functions/v1/assistant` and update the docs. Verify the shortcut URL first.

- [ ] **Resolve stale VAPID public-key TODO in `push.service.ts`**
  `src/services/notifications/push.service.ts:11` has a leftover `// TODO: Replace with your
  actual VAPID public key` above `VITE_VAPID_PUBLIC_KEY || ''`. Push works in prod, so the env
  var is likely set — confirm it's configured (Netlify + local `.env`) and remove the
  misleading TODO. If it's not set, web-push subscription silently breaks.

## Done

- [x] **Fix assistant edge function boot crash** (2026-06-18)
  Circular-import temporal-dead-zone error (`Cannot access 'ALL_TOOLS' before initialization`)
  made the function return `500 WORKER_ERROR` on every request, breaking web Capture and the
  iPhone shortcut. Fixed by deferring `ALL_TOOLS` reads to first use; redeployed and verified
  (OPTIONS → 200, POST → clean JSON).
