# Dead Code Cleanup - Action Plan

**Date**: 2026-01-28
**Priority**: Phase 1 Safe Cleanup
**Risk Level**: LOW
**Estimated Time**: 10 minutes (dependencies) + 2-4 hours (code quality fixes)

---

## Quick Commands (Phase 1A - Dependencies)

### Step 1: Remove Unused Dependencies
```bash
cd "C:\Users\Z005775W\Dropbox\buddy-app"

# Remove unused type package (types come from uuid package directly)
npm uninstall @types/uuid

# Remove unused testing library (no component tests yet)
npm uninstall --save-dev @testing-library/react
```

**Expected Result**:
- package.json updated
- package-lock.json updated
- node_modules cleaned up
- ~75 KB saved in dependencies

---

### Step 2: Delete Empty Placeholder Files
```bash
# Delete empty focus feature files
rm src/features/focus/index.ts
rm src/features/focus/types.ts
```

**Note**: PomodoroTimer component will still work - it's imported directly from components folder

---

### Step 3: Verify Nothing Breaks
```bash
# Run type checking
npm run build

# Run tests
npm test

# Start dev server
npm run dev
```

**Expected**: All commands succeed with no errors

---

## Code Quality Fixes (Phase 1B)

### Priority 1: Fix `any` Types

#### File: src/App.tsx
**Current** (Lines 12, 20, 39, 47):
```typescript
const navigate = (page: any) => { ... }
const renderPage = (page: any) => { ... }
const filteredPages = pages.filter((p: any) => { ... })
```

**Fix**: Add proper type definition
```typescript
// Add at top of file
type PageName =
    | 'home'
    | 'tracker'
    | 'protocols'
    | 'experiments'
    | 'checkin'
    | 'plan'
    | 'calendar'
    | 'reflection'
    | 'todos'
    | 'notes'
    | 'toolbox'
    | 'settings';

interface PageDefinition {
    name: PageName;
    component: JSX.Element;
    showInNav: boolean;
    icon?: string;
    label?: string;
}

// Update functions
const navigate = (page: PageName) => { ... }
const renderPage = (page: PageName) => { ... }
const filteredPages = pages.filter((p: PageDefinition) => { ... })
```

---

#### File: src/features/core/pages/HomePage.tsx
**Current** (Lines 12, 20, 47):
```typescript
const dailyTrackers = trackers.filter((t: any) => t.checkinConfig?.inCheckin);
const sortedTrackers = [...dailyTrackers].sort((a: any, b: any) => { ... })
const tracker = trackers.find((t: any) => t.id === entry.trackerId);
```

**Fix**: Use TrackerDefinition type
```typescript
const dailyTrackers = trackers.filter((t: TrackerDefinition) => t.checkinConfig?.inCheckin);
const sortedTrackers = [...dailyTrackers].sort((a: TrackerDefinition, b: TrackerDefinition) => { ... })
const tracker = trackers.find((t: TrackerDefinition) => t.id === entry.trackerId);
```

---

#### File: src/features/core/pages/SettingsPage.tsx
**Current** (Lines 157, 243, 812):
```typescript
const handleDeleteTracker = async (e: any) => { ... }
const handleDeleteProtocol = async (e: any) => { ... }
setEditingProtocol({ ...protocol, expectedOutcomes: protocol.expectedOutcomes.filter((_: any, i: number) => i !== index) });
```

**Fix**: Use proper event and filter types
```typescript
const handleDeleteTracker = async (e: React.MouseEvent<HTMLButtonElement>) => { ... }
const handleDeleteProtocol = async (e: React.MouseEvent<HTMLButtonElement>) => { ... }
setEditingProtocol({ ...protocol, expectedOutcomes: protocol.expectedOutcomes.filter((_, i: number) => i !== index) });
```

---

#### File: src/features/focus/components/PomodoroTimer.tsx
**Current** (Line 10):
```typescript
const [mode, setMode] = useState<any>('work');
```

**Fix**: Use string literal union type
```typescript
type PomodoroMode = 'work' | 'break';
const [mode, setMode] = useState<PomodoroMode>('work');
```

---

#### File: src/features/health-tracking/components/experiments/ExperimentList.tsx
**Current** (Line 20):
```typescript
const expLogs = entries.filter((e: any) => e.metadata?.experimentId === exp.id);
```

**Fix**: Use Entry type
```typescript
const expLogs = entries.filter((e: Entry) => e.metadata?.experimentId === exp.id);
```

---

#### File: src/features/health-tracking/components/protocols/ProtocolForm.tsx
**Current** (Line 75):
```typescript
setProtocol({ ...protocol, expectedOutcomes: protocol.expectedOutcomes.filter((_: any, i: number) => i !== index) });
```

**Fix**: Remove underscore parameter or type it
```typescript
setProtocol({ ...protocol, expectedOutcomes: protocol.expectedOutcomes.filter((_, i: number) => i !== index) });
```

---

#### File: src/features/health-tracking/components/tracker/Analysis.tsx
**Current** (Line 95):
```typescript
const freq = corrs.reduce((acc: any, c) => { ... })
```

**Fix**: Define accumulator type
```typescript
const freq = corrs.reduce((acc: Record<string, number>, c) => { ... })
```

---

### Priority 2: Fix setState-in-useEffect Anti-patterns

#### File: src/features/core/pages/HomePage.tsx
**Current** (Lines 26-29):
```typescript
useEffect(() => {
    const todaysEntries = entries.filter(e => isSameDay(new Date(e.timestamp), today));
    setTodayValues(todaysEntries);
}, [entries]);
```

**Fix**: Use useMemo instead
```typescript
// Remove the useEffect and state
// Replace with:
const todayValues = useMemo(() => {
    return entries.filter(e => isSameDay(new Date(e.timestamp), today));
}, [entries, today]);
```

---

#### File: src/features/focus/components/PomodoroTimer.tsx
**Current** (Lines 13-25):
```typescript
useEffect(() => {
    if (isActive && timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
        setIsActive(false);  // setState in effect
        // Play sound or notify?
        if (mode === 'work') {
            alert("Focus session complete! Take a break.");
        } else {
            alert("Break over! Back to work.");
        }
    }
}, [isActive, timeLeft, mode]);
```

**Fix**: Move setState to timer callback
```typescript
useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setTimeout(() => {
        setTimeLeft(prev => {
            const newValue = prev - 1;

            // Handle completion
            if (newValue === 0) {
                setIsActive(false);
                if (mode === 'work') {
                    alert("Focus session complete! Take a break.");
                } else {
                    alert("Break over! Back to work.");
                }
            }

            return newValue;
        });
    }, 1000);

    return () => clearTimeout(timer);
}, [isActive, timeLeft, mode]);
```

---

#### File: src/features/health-tracking/components/experiments/ExperimentWizard.tsx
**Current** (Lines 35-37):
```typescript
useEffect(() => {
    // ... logic to compute name
    if (t1s.length > 0 && t2) {
        setName(`Effect of ${t1s.join(' + ')} on ${t2.name}`);
    }
}, [independentIds, tracker2Id, trackers, protocols]);
```

**Fix**: Use useMemo to derive name
```typescript
const derivedName = useMemo(() => {
    const t1s = independentIds.map(id => {
        const t = trackers.find(tr => tr.id === id);
        if (t) return t.name;
        const p = protocols.find(pr => pr.id === id);
        return p?.name || '';
    }).filter(Boolean);

    const t2 = trackers.find(tr => tr.id === tracker2Id);

    if (t1s.length > 0 && t2) {
        return `Effect of ${t1s.join(' + ')} on ${t2.name}`;
    }
    return '';
}, [independentIds, tracker2Id, trackers, protocols]);

// Then in the input field, use derivedName as placeholder or default
// Only update name state when user explicitly edits it
```

---

### Priority 3: Remove Unused Variables

#### File: src/features/core/components/ErrorBoundary.tsx
**Current** (Line 24):
```typescript
componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // _error is defined but never used
}
```

**Fix**: Remove unused parameter or use it
```typescript
componentDidCatch(_error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', errorInfo);
}
```

---

#### File: src/features/health-tracking/components/experiments/ExperimentList.tsx
**Current** (Line 24):
```typescript
.sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    return bActive - aActive;
}).map((exp) => {
    const expLogs = entries.filter((e: Entry) => e.metadata?.experimentId === exp.id);
    // e is defined but never used
})
```

**Fix**: Variable `e` should be `e` in the filter callback - this looks correct. Verify actual line 24 issue.

---

### Priority 4: Fix React Fast Refresh Warnings

These are lower priority but improve developer experience.

**Pattern**: Split context providers and hooks into separate files

**Example: ExperimentContext.tsx**

**Current**:
```typescript
// ExperimentContext.tsx
export const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export function ExperimentProvider({ children }: { children: ReactNode }) {
    // Provider logic
}

export function useExperiments() {
    // Hook logic
}
```

**Fixed**:
```typescript
// ExperimentContext.tsx
export const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export function ExperimentProvider({ children }: { children: ReactNode }) {
    // Provider logic
}

// useExperiments.ts
import { useContext } from 'react';
import { ExperimentContext } from './ExperimentContext';

export function useExperiments() {
    const context = useContext(ExperimentContext);
    if (!context) {
        throw new Error('useExperiments must be used within ExperimentProvider');
    }
    return context;
}
```

**Files to Split**:
- context/ExperimentContext.tsx → useExperiments.ts
- context/ProtocolContext.tsx → useProtocols.ts
- context/SmartNotesContext.tsx → useSmartNotes.ts
- context/TaskContext.tsx → useTasks.ts (different from features/tasks/hooks/useTasks.ts)
- context/TrackerContext.tsx → useTrackerContext.ts

---

## Testing Checklist

After each fix:
- [ ] File saved
- [ ] No TypeScript errors in editor
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Feature still works in browser

After all fixes:
- [ ] Full build succeeds: `npm run build`
- [ ] All tests pass: `npm run test:run`
- [ ] No ESLint errors: `npm run lint`
- [ ] Manual testing of all features
- [ ] No console errors in browser
- [ ] Git commit with detailed message

---

## Git Commit Strategy

### Commit 1: Remove Dependencies
```bash
git add package.json package-lock.json
git commit -m "chore: remove unused dependencies

- Remove @types/uuid (types included in uuid package)
- Remove @testing-library/react (no component tests yet)

Reduces bundle size by ~75 KB with zero functional impact.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Commit 2: Remove Empty Files
```bash
git add src/features/focus/
git commit -m "chore: remove empty focus feature barrel exports

- Delete src/features/focus/index.ts (empty barrel export)
- Delete src/features/focus/types.ts (empty types file)

PomodoroTimer component imported directly, these files unused.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Commit 3: Fix any Types
```bash
git add src/App.tsx src/features/core/pages/HomePage.tsx src/features/core/pages/SettingsPage.tsx src/features/focus/components/PomodoroTimer.tsx src/features/health-tracking/components/
git commit -m "fix: replace any types with proper TypeScript types

- Define PageName and PageDefinition types in App.tsx
- Use TrackerDefinition type in HomePage.tsx
- Use proper React event types in SettingsPage.tsx
- Add PomodoroMode type in PomodoroTimer.tsx
- Use Entry type in ExperimentList.tsx
- Use proper accumulator types in Analysis.tsx

Improves type safety and catches potential runtime errors.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Commit 4: Fix setState Anti-patterns
```bash
git add src/features/core/pages/HomePage.tsx src/features/focus/components/PomodoroTimer.tsx src/features/health-tracking/components/experiments/ExperimentWizard.tsx
git commit -m "fix: replace setState-in-effect with useMemo

- Replace useEffect + setState with useMemo in HomePage.tsx
- Move setState to timer callback in PomodoroTimer.tsx
- Derive name from props in ExperimentWizard.tsx

Prevents cascading renders and improves performance.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Commit 5: Remove Unused Variables
```bash
git add src/features/core/components/ErrorBoundary.tsx src/features/health-tracking/components/experiments/ExperimentList.tsx
git commit -m "fix: remove unused variables

- Use errorInfo in ErrorBoundary.tsx
- Fix unused variable in ExperimentList.tsx

Resolves ESLint warnings.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Commit 6: Split Context and Hooks (Optional)
```bash
git add context/
git commit -m "refactor: split context providers and hooks

- Split context providers into separate files
- Fixes React Fast Refresh warnings
- Improves developer experience

Files split:
- ExperimentContext.tsx → useExperiments.ts
- ProtocolContext.tsx → useProtocols.ts
- SmartNotesContext.tsx → useSmartNotes.ts
- TaskContext.tsx → useTaskContext.ts
- TrackerContext.tsx → useTrackerContext.ts

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Rollback Plan

If anything breaks:
```bash
# Rollback last commit
git revert HEAD

# Or rollback to specific commit
git log --oneline
git revert <commit-hash>

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Test
npm test
```

---

## Success Criteria

Phase 1 complete when:
- ✅ 2 dependencies removed
- ✅ 2 files deleted
- ✅ 0 `any` types in modified files
- ✅ 0 setState-in-effect patterns
- ✅ 0 unused variables warnings
- ✅ All tests passing
- ✅ Build succeeds
- ✅ No console errors
- ✅ All features work correctly
- ✅ Git commits with detailed messages

---

## Time Estimate

- **Step 1** (Dependencies): 5 minutes
- **Step 2** (Delete files): 2 minutes
- **Step 3** (Verify): 3 minutes
- **Priority 1** (any types): 45-60 minutes
- **Priority 2** (setState): 30-45 minutes
- **Priority 3** (unused vars): 10 minutes
- **Priority 4** (Fast Refresh): 30-45 minutes

**Total**: 2-3 hours for complete Phase 1 cleanup

---

## Notes

- All changes are backward compatible
- No API changes
- No database schema changes
- No functionality removed
- Only improves code quality and type safety
- Can be done incrementally (commit after each priority)
