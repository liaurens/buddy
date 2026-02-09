# Pre-Refactoring Cleanup Plan

This document is the result of a full codebase audit. Complete everything here **before** starting the major refactor. Each phase is ordered by priority and dependency — do them in sequence.

---

## Phase 0: Delete Dead Weight (30 min)

Quick wins. Remove things that are clearly dead, duplicated, or abandoned.

### Files to delete

| File | Reason |
|---|---|
| `src/types/planning.ts.backup` | Backup leftover, identical to `planning.ts` |
| `docs/ux-improvements.md` | Superseded by `ux-improvements-comprehensive.md` |
| `docs/NOTIFICATION_SETUP_TODO.md` | Content duplicated in `NOTIFICATION_SYSTEM.md` |

### Dead exports to remove

| File | Line | What | Why |
|---|---|---|---|
| `src/features/core/index.ts` | 9 | `export { ErrorBoundary }` | Never imported anywhere — `main.tsx` has its own inline ErrorBoundary |
| `src/features/core/index.ts` | 2 | `export * from './types'` | `core/types.ts` is an empty file with only comments |
| `src/features/core/types.ts` | — | Entire file | Empty, exports nothing |

### Debug console.logs to remove

| File | Lines | Statement |
|---|---|---|
| `src/App.tsx` | 45 | `console.log('Settings clicked, current tab:', activeTab)` |
| `src/App.tsx` | 50-52 | `useEffect` that logs `showSettings` changes |

---

## Phase 1: Fix the Broken Supabase Migration (1-2 hrs)

The codebase is in a dangerous half-migrated state. Types and converters exist in **two places**: the 1,046-line monolith `src/services/supabase.ts` AND the modular `src/services/supabase/` directory. Only tracker and protocol converters were actually moved. Nobody imports from the new directory yet.

**Choose one path and finish it.**

### Option A: Complete the migration (recommended)

1. **Fix `supabase/types/task-types.ts`** — it's missing 3 fields that exist in the monolith:
   - `due_time: string | null`
   - `location: string | null`
   - `labels: string[] | null`
   - **This is a data-loss risk if anyone switches imports.**

2. **Create missing converter files** in `src/services/supabase/converters/`:
   - `experiment.ts` — move `dbToExperiment`, `experimentToDb`, `dbToExperimentLog`, `experimentLogToDb`, `dbToCorrelation`
   - `strategy.ts` — move `dbToStrategy`, `strategyToDb`
   - `todo.ts` — move `dbToTodo`, `todoToDb`
   - `notes.ts` — move `dbToNoteCategory`, `dbToSmartNote`, `smartNoteToDb`
   - `planning.ts` — move `dbToDailyPlan`, `dailyPlanToDb`, `dbToTimeBlock`, `timeBlockToDb`, `dbToActivityTemplate`, `activityTemplateToDb`, `dbToCalendarEvent`, `calendarEventToDb`

3. **Move operations** out of supabase.ts:
   - `getExperimentLogs`, `addExperimentLog` → `src/services/supabase/operations/experiment-logs.ts`
   - `initializeUserData`, `DEFAULT_TRACKERS` → `src/services/supabase/operations/seed.ts`
   - `exportAllData`, `importAllData` → `src/services/supabase/operations/backup.ts`
   - `getSetting`, `setSetting` → already covered by `src/services/settings/`

4. **Delete the monolith** — `src/services/supabase.ts` becomes empty or a re-export barrel.

5. **Update all import paths** — every file that imports from `../services/supabase` must be updated.

### Option B: Revert the migration

Delete the entire `src/services/supabase/` directory and keep the monolith. Simpler but means the 1,046-line file stays.

### Delete unused planning converters

These 7 converter functions are exported but **never called anywhere**:

| Function | Why unused |
|---|---|
| `dbToTimeBlock()` | Planning feature doesn't use converters yet |
| `timeBlockToDb()` | Same |
| `dbToActivityTemplate()` | Same |
| `activityTemplateToDb()` | Same |
| `dbToCalendarEvent()` | Same |
| `calendarEventToDb()` | Same |
| `dailyPlanToDb()` | Same |

Either delete them now or keep them only if the planning feature will use them during the refactor.

---

## Phase 2: Kill the Context Wrappers (1 hr)

All 5 context providers in `src/context/` are thin pass-throughs. They import a feature hook, call it, and expose the result via React Context. The actual state management is in the hooks via React Query.

### The wrappers

| Context File | Wraps Hook | Used By (component count) |
|---|---|---|
| `TrackerContext.tsx` | `useTrackers` | ~12 components |
| `ProtocolContext.tsx` | `useProtocols` | ~9 components |
| `ExperimentContext.tsx` | `useExperiments` | ~3 components |
| `TaskContext.tsx` | `useTasks` | ~2 components |
| `SmartNotesContext.tsx` | `useNotes` | ~4 components |

### What to do

1. Find every `import { useTracker } from '../../context/TrackerContext'` (and similar for the other 4).
2. Replace with direct hook import: `import { useTrackers } from '../hooks/useTrackers'`.
3. Remove the 5 context files.
4. Remove the 5 `<Provider>` wrappers from `App.tsx` (lines 148-192).

This removes an entire architectural layer and simplifies the provider tree to:

```
<QueryClientProvider>
  <AuthProvider>
    <ToastProvider>
      <MainLayout>
```

---

## Phase 3: Fix Navigation Type Safety (1 hr)

`AppRoute` is defined as a string union type **twice** (in `App.tsx` line 36 and `MainLayout.tsx` line 4) and used as raw string literals in 40+ places.

### What to do

1. **Create `src/constants/routes.ts`**:
   ```typescript
   export const APP_ROUTES = {
     home: 'home',
     health: 'health',
     protocols: 'protocols',
     // ... all 14 routes
   } as const;

   export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];
   ```

2. **Define hub groupings** in the same file:
   ```typescript
   export const ROUTE_HUBS = {
     health: ['health', 'protocols', 'experiments'],
     calendar: ['calendar', 'planning', 'reflection'],
     tasks: ['tasks', 'checklists'],
     notebook: ['notes'],
   } as const;
   ```

3. **Replace all string literals** in `App.tsx` and `MainLayout.tsx` with constants.

4. **Delete the duplicate type** from `MainLayout.tsx`.

---

## Phase 4: Refactor Settings Modal Rendering (1 hr)

`App.tsx` lines 162-191 have **13 conditional settings modal renders**, each checking `showSettings && activeTab === 'someString'`. This is fragile and doesn't scale.

### What to do

1. **Create a settings modal registry** (`src/constants/settings-modals.ts` or in routes.ts):
   ```typescript
   export const SETTINGS_MODALS: Record<AppRoute, React.ComponentType<{isOpen: boolean; onClose: () => void}> | null> = {
     health: TrackerSettingsModal,
     protocols: ProtocolSettingsModal,
     // ...
     home: null, // uses AccountPage overlay
   };
   ```

2. **Replace 13 conditionals** with a single dynamic render:
   ```tsx
   {showSettings && SETTINGS_MODALS[activeTab] && (
     <SettingsModal component={SETTINGS_MODALS[activeTab]} onClose={() => setShowSettings(false)} />
   )}
   ```

3. Handle the `home`/`account` special case separately (AccountPage modal overlay).

---

## Phase 5: Fix Silent Failures (2 hrs)

**40+ places** where hooks silently return on missing `userId` instead of throwing or showing user feedback. This means operations can fail without the user knowing.

### Pattern found across all hooks

```typescript
// CURRENT (broken)
const addEntry = useCallback(async (entry) => {
  if (!userId) return;  // ← caller thinks it succeeded
  // ...
}, [userId]);
```

### What to do

1. **Throw on missing userId** in all mutation callbacks:
   ```typescript
   if (!userId) throw new Error('Not authenticated');
   ```

2. **Add `onError` handlers** to `useMutation` calls that show a toast:
   ```typescript
   useMutation({
     mutationFn: addEntry,
     onError: (error) => toast.error(error.message),
   });
   ```

3. **Files to fix** (all hooks with `if (!userId) return`):
   - `src/features/health-tracking/hooks/useTrackers.ts`
   - `src/features/health-tracking/hooks/useProtocols.ts`
   - `src/features/health-tracking/hooks/useExperiments.ts`
   - `src/features/tasks/hooks/useTasks.ts`
   - `src/features/tasks/hooks/useNotes.ts`
   - `src/features/checklists/hooks/useChecklists.ts`

---

## Phase 6: Extract Constants (30 min)

Magic numbers scattered across the codebase.

### Create `src/constants/config.ts`

```typescript
// Timing
export const LOADING_TIMEOUT_MS = 5000;
export const MODAL_CLOSE_DELAY_MS = 1000;
export const AUTOSTART_DELAY_MS = 1000;

// Pomodoro defaults
export const DEFAULT_WORK_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

// Planning defaults
export const DEFAULT_LUNCH_DURATION_MINUTES = 60;
export const DEFAULT_BREAK_INTERVAL_MINUTES = 90;

// UI limits
export const MAX_COMPLETED_TODOS_SHOWN = 10;
export const CHECKIN_HISTORY_DAYS = 5;
export const RATING_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Cache
export const QUERY_STALE_TIME_MS = 60_000;
```

### Files to update

| File | Hardcoded Value | Replace With |
|---|---|---|
| `src/App.tsx:63` | `5000` | `LOADING_TIMEOUT_MS` |
| `src/main.tsx:17` | `1000 * 60` | `QUERY_STALE_TIME_MS` |
| `src/features/focus/components/PomodoroTimer.tsx:13` | `25 * 60` | `DEFAULT_WORK_MINUTES * 60` |
| `src/features/focus/components/PomodoroTimer.tsx:45,55` | `5` | `DEFAULT_BREAK_MINUTES` |
| `src/features/planning/components/PlanGenerator.tsx:47` | `60` | `DEFAULT_LUNCH_DURATION_MINUTES` |
| `src/features/planning/components/PlanGenerator.tsx:49` | `90` | `DEFAULT_BREAK_INTERVAL_MINUTES` |

---

## Phase 7: Clean Up `any` Types (30 min)

| File | Line | Current | Fix |
|---|---|---|---|
| `src/App.tsx` | 40 | `useState<any>(null)` | Define a `NavParams` type or use `Record<string, unknown> \| null` |
| `src/App.tsx` | 67 | `params?: any` | Same `NavParams` type |
| `src/features/focus/components/PomodoroTimer.tsx` | 30 | `let interval: any` | `ReturnType<typeof setInterval> \| null` |
| `src/features/planning/components/PlanGenerator.tsx` | 123, 174 | `catch (err: any)` | `catch (err: unknown)` with type narrowing |
| `src/hooks/useAuth.tsx` | 51 | `catch (err: any)` | `catch (err: unknown)` |

---

## Phase 8: Documentation Consolidation (1 hr)

The `docs/` folder has **33 files totaling 6,807 lines** with massive overlap. Reduce to ~18 active files.

### Delete (2 files)

| File | Reason |
|---|---|
| `docs/ux-improvements.md` | Superseded by `ux-improvements-comprehensive.md` |
| `docs/NOTIFICATION_SETUP_TODO.md` | Duplicated in `NOTIFICATION_SYSTEM.md` |

### Archive to `.reports/` (8 files)

Move these historical work logs out of active docs:

| File | Reason |
|---|---|
| `docs/BUGFIXES-calendar-planning.md` | Historical bug fix log |
| `docs/E2E-BUGS-FIXED.md` | Historical test results |
| `docs/CLEANUP_ACTION_PLAN.md` | Historical cleanup tasks |
| `docs/DELETION_LOG.md` | Historical deletion record |
| `docs/NOTIFICATION_FINAL_STEPS.md` | Merged into `NOTIFICATION_SYSTEM.md` |
| `docs/smart_notes.md` | Brainstorm doc in Dutch, feature now implemented differently |
| `.reports/dead-code-analysis.md` | Superseded by `DEAD_CODE_ANALYSIS.md` |
| `.reports/cleanup-summary.md` | Superseded by newer analysis |

### Update (3 files)

| File | What's Wrong |
|---|---|
| `README.md` | References `docs/project_vision.md` (doesn't exist) — fix to `docs/PROJECT.md`. Lists Dexie in tech stack — update to Supabase. |
| `docs/QUICKSTART.md` | Directory paths may be stale, env setup instructions incomplete |
| `docs/TECHNICAL_ASSESSMENT.md` | References Dexie Cloud (pre-Supabase). Add deprecation note: "Historical — superseded by PROJECT.md" |

### Consolidate notification docs (3 → 1)

Merge setup steps from `NOTIFICATION_SETUP_TODO.md` and `NOTIFICATION_FINAL_STEPS.md` into `NOTIFICATION_SYSTEM.md` as appendix sections, then archive the originals.

### Final docs structure

```
docs/
├── PROJECT.md                           ← Master reference
├── ARCHITECTURE.md                      ← Design patterns
├── ROADMAP.md                           ← Future plans
├── REFACTORING_PLAN.md                  ← This file
│
├── User Guides/
│   ├── USER_MANUAL.md
│   ├── QUICKSTART.md
│   ├── TESTING_GUIDE.md
│   └── iphone_shortcut_setup.md
│
├── Technical/
│   ├── NOTIFICATION_SYSTEM.md           ← Consolidated
│   ├── tracker_logic.md
│   └── learning-system.md
│
├── Improvements/
│   ├── ux-improvements-comprehensive.md
│   └── DEAD_CODE_ANALYSIS.md
│
.reports/                                ← Historical archive
    ├── TECHNICAL_ASSESSMENT.md
    ├── BUGFIXES-calendar-planning.md
    ├── E2E-BUGS-FIXED.md
    ├── CLEANUP_ACTION_PLAN.md
    ├── DELETION_LOG.md
    ├── NOTIFICATION_FINAL_STEPS.md
    ├── smart_notes.md
    ├── dead-code-analysis.md
    └── cleanup-summary.md
```

---

## Phase 9: Complete the Focus Feature Structure (30 min)

The Focus feature has components (`PomodoroTimer`, `PomodoroSettingsModal`) but is missing the standard feature scaffolding that every other feature has:

- Missing `pages/FocusPage.tsx` — `PomodoroTimer` is imported directly as a component in `App.tsx`
- Missing `hooks/useFocusSession.ts`
- Missing `services/focus.service.ts`
- Missing `types.ts`
- Missing `index.ts` barrel

Either scaffold it properly to match the other 6 features, or accept it as a simple standalone component that doesn't need the full pattern.

---

## Phase 10: Service Layer Consistency (30 min)

Services are split between two locations with no clear rule:

- `src/services/` — Supabase client, notifications, settings (shared infrastructure)
- `src/features/*/services/` — Feature-specific business logic

### What to do

Establish the rule and enforce it:

- **`src/services/`** = Infrastructure only (database client, auth, notifications, settings)
- **`src/features/*/services/`** = All feature business logic

Currently `checklists.service.ts` and `planning/*.service.ts` follow this correctly. The experiment log operations in `supabase.ts` violate it — they should move to `src/features/health-tracking/services/`.

---

## Deprecated Settings Functions

In `src/services/settings/settings.service.ts` (lines 150-167):

```typescript
getRawSetting()  // @deprecated
setRawSetting()  // @deprecated
```

Check if anything still imports these. If not, delete them. If so, migrate callers to the category-based API.

---

## Summary Checklist

| Phase | Time | What | Blocks Refactor? |
|---|---|---|---|
| **0** | 30 min | Delete dead files, exports, debug logs | Yes |
| **1** | 1-2 hrs | Fix or revert Supabase migration | Yes |
| **2** | 1 hr | Remove context wrappers, use hooks directly | Yes |
| **3** | 1 hr | Shared AppRoute type + constants | Yes |
| **4** | 1 hr | Settings modal registry | No |
| **5** | 2 hrs | Fix silent failures in hooks | No |
| **6** | 30 min | Extract magic numbers to constants | No |
| **7** | 30 min | Remove `any` types | No |
| **8** | 1 hr | Documentation consolidation | No |
| **9** | 30 min | Focus feature scaffolding | No |
| **10** | 30 min | Service layer rule enforcement | No |
| **Total** | **~9 hrs** | | |

**Phases 0-3 are blockers** — they clean up the structural issues that will make the major refactor painful if left in place. Phases 4-10 are improvements that can happen during or after the refactor.
