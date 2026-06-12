# Frontend & GUI Polish Report

**Date:** 2026-06-10
**Scope:** App shell, navigation, home surface, shared UI primitives, page-level consistency.
**Verdict:** The visual language is good — soft shadows, indigo accent, generous radii, a real token layer in `src/index.css` (`app-*` classes). The clunky feel comes from three things: (1) the token layer isn't used consistently so cards drift, (2) several interactive elements are dead or broken no-ops, and (3) the PWA shell (safe areas, viewport, manifest) was never finished, which hurts exactly the mobile experience the layout is designed for.

---

## P0 — Feels broken (fix first)

### 1. Bottom nav safe-area class is a no-op
`src/layouts/MainLayout.tsx:114` uses `safe-area-inset-bottom`, but that class is defined nowhere (Tailwind config has no plugins or extensions). On an installed iPhone PWA the tab bar sits **under the home indicator**. Additionally, `index.html:7` lacks `viewport-fit=cover`, so `env(safe-area-inset-*)` would return 0 anyway — while `apple-mobile-web-app-status-bar-style: black-translucent` (`index.html:21`) makes the app draw under the iOS status bar with no top padding either.

**Fix:** add `viewport-fit=cover` to the viewport meta, then real padding: `pb-[env(safe-area-inset-bottom)]` on the bottom nav and `pt-[env(safe-area-inset-top)]` on the sticky mobile header.

### 2. Dead buttons
- **Example chips on the home prompt bar** (`src/features/assistant/components/AssistantPromptBar.tsx:68-76`): "Call mom tomorrow", "Read ch. 4", "Grocery list" render as buttons but have **no onClick**. Tapping them does nothing — on the single most prominent surface of the app. They should fill the capture input (and ideally focus it).
- **"Edit" button on Browse shortcuts** (`src/features/browse/pages/BrowsePage.tsx:59`): no handler. Either build shortcut editing or remove the button until it exists.

### 3. All toast/page animations silently don't exist
`src/components/ui/Toast.tsx:153` uses `animate-in fade-in slide-in-from-right` — these come from the `tailwindcss-animate` plugin, which is **not installed** (`tailwind.config.js` has `plugins: []`). Toasts pop in with no transition, and on close the 300 ms exit delay just shows a frozen toast before it vanishes. Same story for `animate-fadeIn` on `ChecklistsPage.tsx:41` and `ChecklistDetail.tsx:37` — undefined class.

**Fix:** install `tailwindcss-animate` (one line in config), or define the keyframes in `index.css`. Instant, app-wide polish win.

### 4. Chat/Toolbox heights use `100vh` instead of `100dvh`
`src/App.tsx:152` and `src/features/toolbox/pages/ToolboxPage.tsx:130` use `h-[calc(100vh-7rem)]`. On mobile Safari/Chrome, `100vh` includes the collapsed browser chrome, so the capture input at the bottom of the chat can sit **behind the tab bar / off-screen** until the URL bar hides. Use `dvh`, and consider deriving the offsets from one shared constant instead of magic `7rem`/`4rem` values that must mirror header + nav heights by hand.

### 5. PWA identity is stale "Correlate Tracker", not Buddy
- `index.html` has **two `<title>` tags** (`Life Tracker` line 8, `Correlate Tracker` line 24 — the second wins).
- `apple-mobile-web-app-title` is "Tracker" (`index.html:22`); `public/manifest.json` says name "Correlate Tracker", short_name "Tracker".
- Favicon is still **`/vite.svg`** (`index.html:6`).
- `theme_color #6366f1` matches neither the white header nor the brand primary `#25329b` (`--buddy-primary`), so the Android status bar is a random indigo.
- `background_color #0f172a` (dark slate) gives a **dark splash screen that flashes into a light app** (`--buddy-bg: #f7f8fb`).

The in-app UI says "Buddy" everywhere; the installed icon says "Tracker". Align manifest + meta + favicon with the Buddy brand and light theme.

---

## P1 — Consistency issues (the "clunky placement" feeling)

### 6. Double page titles on mobile
The mobile sticky header already shows the page name via the `mobileTitle` map (`MainLayout.tsx:21-41`). Only `TodoPage` and `BrowsePage` hide their in-page `<h1>` on mobile (`hidden lg:flex`). Everything else — Health Tracking, Protocols, Experiments, Notifications, Growth, Calendar, Notes, Checklists, Reflection, Today, Me — renders a second full-size title directly under the bar, so the user sees e.g. **"Health" in the top bar and "Health Tracking" as an h1 2 cm below it**. Pick one convention (recommend: hide page h1 below `lg`, like TodoPage/BrowsePage already do) and apply it everywhere.

### 7. Double greeting on Home
`HomePage.tsx:19` computes "Good morning." under the date, and `DailyRoutineCard` (top of the right column, directly visible on mobile) computes its own "Good morning" again with its own hour thresholds. One greeting is warm; two is template-y. Drop the one in DailyRoutineCard (its subtitle "Start your day right" carries the meaning) — and share the hour logic in one helper either way.

### 8. Card style drift — four shadow recipes, two radii
The token layer defines `app-surface` (rounded-**xl**, `0 12px 30px` shadow), but:
- Home cards (`NextUpCard`, `TodayCard`, `RecentCaptures`, `AssistantPromptBar`) hand-roll `rounded-lg … shadow-[0_16px_42px_rgba(15,23,42,0.045)]`
- Browse lists use `rounded-xl … shadow-[0_10px_26px_rgba(15,23,42,0.04)]`
- Browse shortcut tiles use `shadow-[0_8px_22px_rgba(15,23,42,0.03)]`

Side by side (Home → Browse) the corner radii visibly differ. Pick `app-surface` as the single card primitive (add an `app-surface-flat` variant if needed) and migrate; this kills most of the "almost-but-not-quite" feel in one sweep.

### 9. Two competing icon-button styles + title-size drift
- `app-icon-button` is 36 px (`h-9`), `home-icon-button` is 44 px (`h-11`) with a different shadow. Keep one — at 44 px, since these are primary touch targets.
- `app-title` is `1.65rem`, but HomePage's h1 is `text-[1.45rem] sm:text-3xl` (`HomePage.tsx:26`). Standardize.

### 10. Mobile top-bar buttons change meaning by route
`MainLayout.tsx:98-104`: the right button is **Search** everywhere but morphs into **Bell** on Browse. Same position, different action depending on context = users build no muscle memory, and Notifications is unreachable from most screens. Also, tapping the centered page title navigates home (`MainLayout.tsx:92-97`) — an invisible affordance that mostly fires by accident. Recommend: fixed Bell (with unread dot) on the right, Search lives inside Browse, title not tappable.

### 11. CaptureFAB interaction edges
`src/components/CaptureFAB.tsx`:
- Long-press cancel is bound to `onPointerLeave` only; **`onPointerCancel` is not handled**, so starting a scroll with a finger on the FAB can still fire voice capture 500 ms later. Bind the same cancel handler to `onPointerCancel`.
- Unsupported browsers get a native `alert()` — jarring against the app's styling; use the toast system you already have.
- Long-press voice is undiscoverable (only in the aria-label). A one-time tooltip/hint would help.

---

## P2 — Polish & accessibility

### 12. Modal (`src/components/ui/Modal.tsx`)
- No `role="dialog"`, no `aria-modal`, no focus trap, focus isn't returned on close.
- Close button is `p-1` (~28 px) — well under the 44 px touch minimum; it also lacks an `aria-label`.
- On phones a centered `mx-4` box with `max-h-[70vh]` body fights the keyboard on form-heavy modals. A bottom-sheet presentation below `sm` (slide-up, full-width, rounded top) would match the app's mobile-first feel much better.

### 13. Toasts placement & sizing
`Toast.tsx:86` pins toasts **top-right** with `min-w-[320px]`. On mobile that overlaps the sticky header and hugs the wrong edge; 320 px min-width is tight on ≤360 px screens. Mobile convention: bottom-center, above the tab bar (`bottom-[calc(4.5rem+1rem+env(safe-area-inset-bottom))]`), full-width minus margins.

### 14. Native `confirm()`/`alert()` dialogs
`AssistantChat.tsx:88` uses `window.confirm` for chat deletion (and CaptureFAB uses `alert`). These look like a different decade next to the rest of the UI. A small shared `ConfirmDialog` on top of `Modal` would cover all cases.

### 15. NextUpCard details
- The calendar-event variant renders an **empty decorative circle** (`NextUpCard.tsx:154` — a bordered 32 px circle with no icon), which reads as a rendering bug. Give it a calendar glyph or drop it.
- The done-checkbox aligns to the title via a magic `mt-8` (`NextUpCard.tsx:54`) — brittle; any meta-row change misaligns it. Align structurally (grid row) instead.
- Title uses `truncate` — a one-line clamp on the single most important text in the app. `line-clamp-2` is kinder to real task names.

### 16. Branded loading state
The boot screen is plain "Loading..." text on dark slate (`App.tsx:192`) — and it's **dark** while the app is light, doubling the splash flash from §5. A light background with the Buddy mark/spinner ties boot → app together.

### 17. Small a11y wins
- Bottom-nav active tab is color-only; add `aria-current="page"` (and the indigo pill background like the desktop sidebar uses — also visually anchors the active tab better than bare text color).
- Toast container could use `role="status"` / `aria-live="polite"` so captures' confirmations are announced.

---

## Suggested order of attack

| Step | Items | Effort |
|---|---|---|
| 1 | Install `tailwindcss-animate`; fix safe-area + `viewport-fit=cover`; `vh`→`dvh` | ~1 hour |
| 2 | Manifest/title/favicon/theme-color → Buddy branding | ~30 min |
| 3 | Wire example chips + remove/implement Browse "Edit" | ~30 min |
| 4 | One card primitive (`app-surface`), one icon button, one title size | ~2 hours, mostly mechanical |
| 5 | Hide in-page h1 on mobile everywhere; drop duplicate greeting; fixed top-bar Bell | ~1–2 hours |
| 6 | Modal a11y/bottom sheet, toast reposition, ConfirmDialog, FAB pointercancel | ~half day |

Steps 1–3 are nearly pure wins with no design decisions needed; steps 4–5 are what will make placements stop feeling clunky; step 6 is the deeper polish layer.
