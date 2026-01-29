# Code Deletion Log

## [2026-01-28] Dead Code Analysis - Refactoring Session

### Summary
Comprehensive dead code analysis using knip, depcheck, and ESLint. This report identifies unused code, dependencies, and potential removal candidates. All items categorized by risk level before any removal.

---

## SAFE TO REMOVE (Low Risk)

### Unused Dependencies
#### @types/uuid
- **Location**: package.json:20:6
- **Status**: SAFE - Type-only package, not imported anywhere
- **Reason**: Using `uuid` package directly (v4 as uuidv4), type definitions come from the main package
- **Size**: ~15 KB
- **Action**: Remove from dependencies

#### @testing-library/react
- **Location**: package.json:35:6 (devDependencies)
- **Status**: SAFE - No test files use this library
- **Reason**: Not imported in any test files
- **Size**: ~60 KB
- **Action**: Remove from devDependencies
- **Note**: May want to add back later when writing React component tests

### Unused Files - Focus Feature (Incomplete/Placeholder)
#### src/features/focus/index.ts
- **Status**: SAFE - Barrel export with only comments
- **Content**: Empty barrel export file with placeholder comments
- **References**: None (no imports from this path)
- **Action**: Remove (component is imported directly)

#### src/features/focus/types.ts
- **Status**: SAFE - Empty placeholder file
- **Content**: Only contains comment "// TypeScript types for focus feature"
- **References**: Exported via index.ts but nothing imported from it
- **Action**: Remove (no types defined)

**Note**: The PomodoroTimer component is directly imported in App.tsx, so these barrel exports are unnecessary.

---

## CAREFUL REVIEW NEEDED (Medium Risk)

### Unused Exports in supabase.ts
These conversion functions are defined but not currently used. They may be needed for future features or were created for database consistency.

#### Database Conversion Functions (Experiment/Correlation)
- `dbToExperimentLog` (line 484)
- `experimentLogToDb` (line 495)
- `dbToCorrelation` (line 507)

**Analysis**: Only used within supabase.ts file, not imported elsewhere. May be needed for future experiment logging features.
**Risk**: MEDIUM - Part of experiment feature that might be enhanced
**Recommendation**: Keep for now, review after experiment feature stabilizes

#### Database Conversion Functions (Planning)
- `dbToDailyPlan` (line 663)
- `dailyPlanToDb` (line 688)
- `dbToTimeBlock` (line 705)
- `timeBlockToDb` (line 726)
- `dbToActivityTemplate` (line 749)
- `activityTemplateToDb` (line 769)
- `calendarEventToDb` (line 808)

**Analysis**: Planning feature is active but these specific converters aren't called yet
**Risk**: MEDIUM - Planning feature may need these soon
**Recommendation**: Keep for now, planning feature is actively developed

### Unused Exports in Planning Services

#### ai.service.ts
- `getAIService` (line 323)
- `isAIConfigured` (line 330)

**Analysis**: Utility functions for AI service access, might be used for feature detection
**Risk**: MEDIUM - Could be useful for conditional AI feature rendering
**Recommendation**: Consider if AI service detection is needed in UI

#### calendar.service.ts
- `parseICalData` (line 129)
- `estimateTravelTime` (line 182)
- `addTravelTimeBuffers` (line 196)
- `filterEventsForDate` (line 204)
- `sortEventsByTime` (line 216)

**Analysis**: Advanced calendar features not yet implemented
**Risk**: MEDIUM - Calendar sync feature actively developed
**Recommendation**: Keep until calendar feature is complete

#### planning.service.ts
- `getRecentPlans` (line 412)
- `updateBlockStatus` (line 437)

**Analysis**: Historical plan viewing not yet implemented
**Risk**: MEDIUM - Needed for reflection feature
**Recommendation**: Keep for reflection/learning features

#### reflection.service.ts
- `getAverageTimeForSimilarTasks` (line 308)
- `applyLearningToEstimate` (line 376)

**Analysis**: Advanced learning features not yet active
**Risk**: MEDIUM - Part of AI learning system
**Recommendation**: Keep for historical learning features

#### ai-prompts.ts
- `generateReplanSystemPrompt` (line 183)
- `generateReplanUserPrompt` (line 200)
- `generateTaskBreakdownSystemPrompt` (line 236)
- `generateHistoricalInsightsPrompt` (line 258)

**Analysis**: Advanced AI prompts for features not yet implemented
**Risk**: MEDIUM - Part of planned AI functionality
**Recommendation**: Keep for upcoming replan feature

### Unused Exports in Core Features

#### hooks/useAuth.tsx
- `useAuthProvider` (line 17)

**Analysis**: Internal hook, `AuthProvider` is the public API
**Risk**: LOW - Can be removed, only export `AuthProvider`
**Recommendation**: Remove export (keep function internal)

#### features/core/index.ts
- `LoginScreen` (line 9)
- `ErrorBoundary` (line 10)

**Analysis**: Exported but never imported via barrel export
**Risk**: LOW - Components imported directly from their files
**Recommendation**: Remove from barrel exports OR update imports to use barrel

#### features/core/components/ErrorBoundary.tsx
- `default` class export (line 71)

**Analysis**: Class-based ErrorBoundary, exported both named and default
**Risk**: LOW - Duplicate export
**Recommendation**: Keep only one export style

#### features/planning/index.ts
- `PlanGenerator` (line 10)

**Analysis**: Exported but imported directly from component file
**Risk**: LOW - Barrel export not used
**Recommendation**: Remove from barrel export OR update imports

### Unused Type Exports

#### src/services/supabase.ts
- `DbCorrelation` (line 110)
- `DbDailyPlan` (line 193)
- `DbTimeBlock` (line 215)
- `DbActivityTemplate` (line 247)

**Analysis**: Database types for features not yet fully implemented
**Risk**: MEDIUM - Will be needed when features activate
**Recommendation**: Keep, planning feature in development

#### src/types.ts
- `ExpectedOutcome` (line 11)
- `ExperimentLog` (line 15)
- `Subtask` (line 23)
- `Todo` (line 25)

**Analysis**: Re-exported from feature files but not used
**Risk**: LOW - Backward compatibility exports
**Recommendation**: Can remove, import from feature files directly

#### features/health-tracking/types.ts
- `ExperimentLog` (line 117)

**Analysis**: Type defined but not used anywhere
**Risk**: LOW - Experiment feature incomplete
**Recommendation**: Remove if not planned

#### features/tasks/types.ts
- `Todo` (line 41)

**Analysis**: Type defined but not used
**Risk**: LOW - Duplicate of Task type?
**Recommendation**: Review if Todo vs Task distinction needed

#### features/planning/types.ts
- `TaskDurationHistory` (line 196)
- `DayRetrospective` (line 213)

**Analysis**: Types for learning features not yet implemented
**Risk**: MEDIUM - Needed for AI learning system
**Recommendation**: Keep for reflection features

#### features/planning/services/ai.service.ts
- `AIProvider` (line 19)

**Analysis**: Type for AI provider selection
**Risk**: LOW - Used internally but not exported
**Recommendation**: Keep internal, remove from exports if listed

#### features/planning/services/calendar.service.ts
- `CalendarConfig` (line 22)

**Analysis**: Configuration type for calendar sync
**Risk**: MEDIUM - Calendar feature in development
**Recommendation**: Keep for calendar configuration

---

## DO NOT REMOVE (Keep These)

### Dependencies Incorrectly Flagged by Depcheck

#### autoprefixer
- **Status**: KEEP - Used by PostCSS
- **Location**: postcss.config.js:4
- **Reason**: PostCSS plugin for CSS vendor prefixing

#### postcss
- **Status**: KEEP - Used by Vite/Tailwind
- **Location**: postcss.config.js
- **Reason**: CSS processor required by Tailwind

#### tailwindcss
- **Status**: KEEP - Actively used
- **Usage**: 1,155 className occurrences across 31 files
- **Reason**: Core styling framework

### Files in supabase/functions/

#### supabase/functions/calendar-proxy/index.ts
- **Status**: KEEP - Supabase Edge Function
- **Reason**: Deployed to Supabase, not bundled with src/
- **Purpose**: Calendar sync proxy function

#### supabase/functions/quick-note/index.ts
- **Status**: KEEP - Supabase Edge Function
- **Reason**: Deployed to Supabase, not bundled with src/
- **Purpose**: Quick note processing function

### Active Dependencies

#### recharts
- **Status**: KEEP - Actively used
- **Usage**: Analysis.tsx for data visualization
- **Components**: BarChart, ScatterChart, LineChart

#### workbox-window
- **Status**: KEEP - PWA functionality
- **Usage**: vite-plugin-pwa uses workbox for service worker
- **Purpose**: Progressive Web App offline support

---

## Code Quality Issues (ESLint Findings)

### High Priority Fixes Needed

#### Avoid any Type (10 instances)
Files with `any` type usage:
- App.tsx (3 instances)
- HomePage.tsx (3 instances)
- SettingsPage.tsx (3 instances)
- PomodoroTimer.tsx (1 instance)
- ExperimentList.tsx (1 instance)
- ProtocolForm.tsx (1 instance)
- Analysis.tsx (1 instance)

**Recommendation**: Replace with proper TypeScript types

#### setState in useEffect Anti-pattern (3 instances)
Files with synchronous setState in effects:
- HomePage.tsx:28 - setTodayValues
- PomodoroTimer.tsx:17 - setIsActive
- ExperimentWizard.tsx:36 - setName
- CheckinModal.tsx:48 - (truncated output)

**Recommendation**: Use useMemo or derived state instead

#### Unused Variables
- ErrorBoundary.tsx:24 - `_error` parameter
- ExperimentList.tsx:24 - `e` variable

**Recommendation**: Remove or prefix with underscore

#### Context Export Issues (5 instances)
Files exporting non-components alongside context:
- ExperimentContext.tsx
- ProtocolContext.tsx
- SmartNotesContext.tsx
- TaskContext.tsx
- TrackerContext.tsx

**Recommendation**: Split context and hooks into separate files

---

## Statistics

### Current State
- Total TypeScript/JavaScript files: 62
- Files with unused exports: 8 major files
- Unused exports identified: 30 functions
- Unused type exports: 14 types
- ESLint errors: 20+
- ESLint warnings: 1+

### Potential Impact (If Safe Removals Made)
- Dependencies to remove: 2 (@types/uuid, @testing-library/react)
- Files to remove: 2 (focus index.ts, focus types.ts)
- Bundle size reduction: ~75 KB
- No functional impact (all safe removals)

---

## Recommendations

### Phase 1: Safe Cleanup (Immediate)
1. Remove unused dependencies (@types/uuid, @testing-library/react)
2. Remove empty focus feature files (index.ts, types.ts)
3. Fix ESLint errors (any types, unused variables)
4. Fix setState-in-effect anti-patterns

### Phase 2: Review After Feature Stabilization
1. Review planning service exports after feature completion
2. Review experiment conversion functions after feature completion
3. Consolidate barrel exports (use consistently or remove)

### Phase 3: Type System Improvements
1. Replace all `any` types with proper types
2. Remove duplicate type exports
3. Consolidate type definitions

### Phase 4: Context Refactoring
1. Split context providers and hooks into separate files
2. Fix React Fast Refresh warnings

---

## Testing Requirements

Before removing any code:
- [ ] Run full test suite: `npm test`
- [ ] Run type checking: `npm run build` (includes tsc -b)
- [ ] Check for runtime errors in dev mode
- [ ] Verify no console errors
- [ ] Test all major features manually

After removal:
- [ ] Verify build succeeds
- [ ] Verify tests pass
- [ ] No new TypeScript errors
- [ ] No runtime errors
- [ ] Git commit with detailed message

---

## Notes

- All analysis performed using knip v5.82.1 and depcheck v1.4.7
- Supabase Edge Functions correctly excluded from src/ bundle analysis
- PWA functionality (workbox-window) correctly identified as in use
- Tailwind CSS actively used throughout application
- Planning and experiment features are in active development
- Many "unused" exports are likely for upcoming features

**CRITICAL**: Do not remove any planning, experiment, or calendar-related code without consulting feature roadmap. These features are actively being developed.
