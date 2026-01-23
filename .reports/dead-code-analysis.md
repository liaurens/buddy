# Dead Code Analysis Report

**Generated:** 2026-01-23
**Tools Used:** knip, depcheck, ts-prune

---

## Executive Summary

- **Total Unused Files:** 14
- **Unused Dependencies:** 1
- **Unused DevDependencies:** 4
- **Unused Exports:** 6
- **Unused Types:** 3

---

## 1. SAFE TO REMOVE

### Build Artifacts (SAFE - Auto-generated)
These files are generated during build and should not be in source control:

```
dist/registerSW.js
dist/sw.js
dist/workbox-66610c77.js
dist/assets/index-d3HjUcPE.css
dist/assets/index-D9uP1P6K.js
```

**Action:** Ensure `dist/` is in `.gitignore` and remove from git if committed.

---

### Unused CSS File (SAFE)

```
src/App.css
```

**Status:** Not imported anywhere in the codebase.
**Action:** Safe to delete if truly unused.

---

### Unused Exports (SAFE - Internal utilities)

```typescript
// src/hooks/useAuth.tsx:17:17
useAuthProvider (function)

// src/context/TrackerContext.tsx:211:10 & :25
exportAllData
importAllData

// src/services/supabase.ts
dbToExperimentLog (function) - line 366:17
experimentLogToDb (function) - line 377:17
dbToCorrelation (function) - line 389:17
```

**Action:** Review if these are planned for future use. If not, safe to remove.

---

### Unused Types (SAFE)

```typescript
// src/services/supabase.ts:109:18
DbCorrelation (interface)

// src/types.ts:15:18
ExperimentLog (interface)

// src/types.ts:187:13
Todo (type)
```

**Action:** Safe to remove if associated functions are removed.

---

### Unused DevDependencies (SAFE)

```json
{
  "@testing-library/react": "package.json:31:6",
  "autoprefixer": "detected by depcheck",
  "postcss": "detected by depcheck",
  "tailwindcss": "detected by depcheck"
}
```

**Note:**
- `@testing-library/react` may be needed for future tests
- `autoprefixer`, `postcss`, `tailwindcss` are likely used by build tools indirectly
- Recommend keeping these unless certain they're not needed

---

## 2. CAUTION - Review Before Removing

### Unused Feature Components

```
src/pages/Home.tsx
src/pages/ResourcesPage.tsx
src/features/resources/Journal.tsx
src/features/resources/Toolbox.tsx
src/features/tasks/TaskList.tsx
```

**Analysis:**
- These appear to be feature pages/components
- May be referenced via routing or lazy loading
- Could be work-in-progress features

**Action:**
1. Check routing configuration
2. Verify if these are planned features
3. Search for dynamic imports
4. Only remove if confirmed unused

---

### Unused Service

```
src/services/aiService.ts
```

**Analysis:**
- AI service integration
- May be planned for future use
- Could be imported dynamically

**Action:** Verify if this is needed for future features.

---

### Unused Index File

```
src/features/smartnotes/index.ts
```

**Analysis:**
- Barrel export file
- May be used for cleaner imports
- Check if smartnotes features are used elsewhere

**Action:** Review if barrel exports are needed.

---

## 3. DANGER - DO NOT REMOVE

### Backend Function

```
supabase/functions/quick-note/index.ts
```

**Analysis:**
- Supabase Edge Function
- May be deployed independently
- Used by external integrations (iPhone Shortcut mentioned in commits)

**Action:** **DO NOT REMOVE** - This is a backend API endpoint.

---

### Dependency in Use

```
@types/uuid (package.json:18:6)
```

**Analysis:**
- Knip flagged as unused dependency
- However, depcheck shows it IS used in:
  - src/pages/Settings.tsx
  - src/features/tasks/TaskList.tsx
  - Multiple context files

**Action:** **DO NOT REMOVE** - False positive, actively used.

---

## Recommended Cleanup Plan

### Phase 1: Safe Cleanup (No Tests Required)

1. **Verify dist/ in .gitignore**
   ```bash
   grep -q "dist/" .gitignore || echo "dist/" >> .gitignore
   git rm -r --cached dist/ 2>/dev/null || true
   ```

2. **Remove App.css if unused**
   - Check if imported anywhere
   - Delete if confirmed unused

### Phase 2: Test-Verified Cleanup

For each item below, follow this process:
1. Run full test suite (baseline)
2. Remove item
3. Re-run tests
4. Rollback if tests fail

#### Items to Remove (with test verification):

1. **Unused utility functions:**
   - `useAuthProvider` in src/hooks/useAuth.tsx
   - `exportAllData`, `importAllData` in TrackerContext
   - `dbToExperimentLog`, `experimentLogToDb`, `dbToCorrelation` in supabase.ts

2. **Unused types:**
   - `DbCorrelation` in supabase.ts
   - `ExperimentLog` in types.ts
   - `Todo` type in types.ts

### Phase 3: Manual Review Required

These require deeper investigation:

1. **Unused pages/components:**
   - src/pages/Home.tsx (check routing)
   - src/pages/ResourcesPage.tsx (check routing)
   - src/features/resources/Journal.tsx
   - src/features/resources/Toolbox.tsx
   - src/features/tasks/TaskList.tsx

2. **Unused services:**
   - src/services/aiService.ts

3. **Unused barrel exports:**
   - src/features/smartnotes/index.ts

---

## Notes

- **@types/uuid:** Keep (false positive - actively used)
- **supabase/functions/quick-note/index.ts:** Keep (backend API)
- **DevDependencies:** Review individually, likely needed by build tools
- **Test first:** Always run tests before and after removing code

---

## Next Steps

1. Review routing configuration to verify unused pages
2. Search codebase for dynamic imports
3. Run test suite to establish baseline
4. Begin Phase 1 safe cleanup
5. Proceed to Phase 2 with test verification
6. Manual review for Phase 3 items
