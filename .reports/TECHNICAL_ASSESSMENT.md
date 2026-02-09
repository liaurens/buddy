# Life Tracker - Technical Assessment Report

**Date:** January 2026
**Version:** 1.0

---

## Overview

The codebase is **well-structured for its current scope** with good TypeScript usage and a clean provider pattern. However, it needs work in several areas before it can scale as a multi-tool platform.

---

## Current Architecture

```
src/
├── components/      # Shared UI (LoginScreen)
├── context/         # 4 React Contexts (state management)
├── features/        # Feature modules (tracker, protocols, focus, etc.)
├── pages/           # Full page views
├── services/        # Database + AI service
├── layouts/         # MainLayout with navigation
├── utils/           # Analysis utilities
└── types.ts         # All TypeScript interfaces
```

**Tech Stack**: React 19 + TypeScript + Vite + Dexie Cloud + Tailwind CSS + PWA

---

## Priority Issues

### IMMEDIATE (Fix Now)

| Issue | Location | Problem | Solution |
|-------|----------|---------|----------|
| **No Tests** | Entire codebase | 0% coverage, high regression risk | Add Vitest + testing-library |
| **API Keys Plaintext** | `aiService.ts:57-63` | Keys stored unencrypted in IndexedDB | Encrypt or use secure storage |
| **TaskContext Inconsistency** | `TaskContext.tsx:7` | Uses localStorage, not Dexie (no cloud sync) | Migrate to Dexie |
| **Hardcoded Config** | `db.ts:46` | Dexie Cloud URL hardcoded | Use environment variables |
| **Text Tracker Hack** | `CheckinModal.tsx:80` | Text stored in `notes` field, value=0 | Fix Entry schema |

### HIGH PRIORITY (Next Sprint)

| Issue | Location | Impact |
|-------|----------|--------|
| **Re-render Storm** | All Contexts | Any data change re-renders entire app |
| **Tight Coupling** | `Dashboard.tsx`, `CheckinModal.tsx` | Can't test features in isolation |
| **No Error Feedback** | `CheckinModal.tsx:118` | Users don't know why operations fail |
| **Magic Strings** | Multiple files | Hardcoded tracker IDs like 'sleep_hours' |

### QUALITY OF LIFE (Future)

- Pre-commit hooks (husky + lint-staged)
- Path aliases (`@/components` instead of `../../../components`)
- CI/CD pipeline (GitHub Actions)
- Component library documentation

---

## 1. MODULARITY ASSESSMENT

**Current State: 5/10**

### What's Good
- Features are in separate folders (`features/tracker/`, `features/protocols/`)
- Each context is self-contained with its own hooks
- Pages are simple wrappers that compose features

### What's Wrong

**Problem 1: Contexts are interdependent**
```typescript
// Dashboard.tsx - needs BOTH contexts to render
const { entries, trackers } = useTracker();
const { doses, protocols } = useProtocol();

// Merges data from both - can't render tracker-only view
```

**Problem 2: Hardcoded feature dependencies**
```typescript
// CheckinModal.tsx:87-106 - sleep_score calculation hardcoded
const sleepHours = ...find(t => t.id === 'sleep_hours');
const sleepQuality = ...find(t => t.id === 'sleep_quality');
// Breaks if these trackers don't exist
```

**Problem 3: No plugin/module system**
- Can't add a new tool without editing `App.tsx`, `MainLayout.tsx`
- No way to lazy-load features
- No feature flags

### Recommended Architecture

```
src/
├── core/                    # Shared kernel
│   ├── database/           # Dexie setup, base tables
│   ├── auth/               # Login, user state
│   └── ui/                 # Design system components
│
├── modules/                 # Standalone tools
│   ├── tracker/
│   │   ├── index.ts        # Public API export
│   │   ├── TrackerModule.tsx
│   │   ├── context/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── __tests__/
│   │
│   ├── protocols/
│   │   ├── index.ts
│   │   └── ...
│   │
│   └── experiments/
│       └── ...
│
├── app/                     # Shell that composes modules
│   ├── App.tsx
│   ├── router.tsx
│   └── ModuleRegistry.ts   # Dynamic module loading
```

**Key Changes:**
1. Each module exports a clean public API
2. Modules communicate via events/shared data layer, not direct imports
3. Module registry enables feature flags and lazy loading
4. Core provides shared infrastructure only

---

## 2. SCALABILITY ASSESSMENT

**Current State: 4/10**

### Performance Issues

**Re-render Problem:**
```typescript
// TrackerContext.tsx - ALL components re-render when ANY entry changes
const entries = useLiveQuery(() => db.entries.orderBy('timestamp').reverse().toArray());
// Returns ~1000s of entries, triggers re-render cascade
```

**No Pagination:**
```typescript
// Dashboard shows ALL entries - will slow down with months of data
const historyItems = useMemo(() => {
    const entryItems = entries.map(e => ({ type: 'entry', ...e }));
    // No limit, no virtualization
}, [entries, doses, trackers, protocols]);
```

### Recommendations

1. **Add selectors to contexts:**
```typescript
// Instead of returning all entries
const useEntries = (filter?: { trackerId?: string; limit?: number }) => {
    return useLiveQuery(() => {
        let query = db.entries.orderBy('timestamp').reverse();
        if (filter?.trackerId) query = query.filter(e => e.trackerId === filter.trackerId);
        if (filter?.limit) query = query.limit(filter.limit);
        return query.toArray();
    }, [filter]);
};
```

2. **Virtualize long lists:**
```typescript
// Use react-window or tanstack-virtual for Dashboard
import { FixedSizeList } from 'react-window';
```

3. **Add database indexes:**
```typescript
// db.ts - add index for value queries
entries: 'id, trackerId, timestamp, value'
```

4. **Consider Zustand over Context:**
```typescript
// Zustand allows selective subscriptions
const useTrackerStore = create((set) => ({
    entries: [],
    addEntry: (entry) => set(state => ({ entries: [...state.entries, entry] }))
}));

// Component only re-renders when its slice changes
const entries = useTrackerStore(state => state.entries.filter(e => e.trackerId === id));
```

---

## 3. PRIVACY ASSESSMENT

**Current State: 3/10**

### Critical Issues

| Risk | Severity | Location |
|------|----------|----------|
| API keys in plaintext | HIGH | `aiService.ts` stores in IndexedDB |
| Health data to LLMs | HIGH | `aiService.ts:112-158` sends full tracking data |
| Anonymous cloud access | MEDIUM | `db.ts:47` - `requireAuth: false` |
| No data encryption | MEDIUM | All IndexedDB data is readable |

### AI Service Data Exposure

```typescript
// aiService.ts:135-150 - sends this to OpenAI/Anthropic
const prompt = `Recent tracking data:
${recentEntries.map(e => {
    const tracker = trackers.find(t => t.id === e.trackerId);
    return `- ${tracker?.name}: ${e.value} (${format(new Date(e.timestamp), 'MMM d')})`;
}).join('\n')}`;
// Full health metrics exposed to third party
```

### Recommendations

1. **Encrypt sensitive data:**
```typescript
import { encrypt, decrypt } from './crypto';

export async function saveAIConfig(config: AIConfig): Promise<void> {
    const encryptedKey = await encrypt(config.apiKey);
    await setSetting(CONFIG_KEY_API_KEY, encryptedKey);
}
```

2. **Anonymize AI prompts:**
```typescript
// Don't send: "Sleep: 7hrs, Mood: 8, took 200mg caffeine"
// Send: "Metric A: 7, Metric B: 8, Metric C: 200"
```

3. **Enable Dexie Cloud auth:**
```typescript
this.cloud.configure({
    databaseUrl: import.meta.env.VITE_DEXIE_CLOUD_URL,
    requireAuth: true  // Require login
});
```

4. **Add privacy settings page:**
   - Toggle AI features on/off
   - Choose what data to sync
   - Data export/deletion options

---

## 4. EASE OF USE ASSESSMENT

**Current State: 7/10**

### What's Good
- Clean, modern UI with Tailwind
- Mobile-friendly (PWA)
- Quick check-in modal on homepage
- Good visual feedback (icons, colors)

### What Needs Work

1. **Onboarding:**
   - No tutorial for new users
   - Default trackers may confuse users
   - No explanation of experiments/protocols

2. **Error Messages:**
   ```typescript
   // Current: Generic alert
   alert('Failed to import data. Invalid format.');

   // Better: Specific feedback
   toast.error('Import failed: Expected JSON file with "entries" array');
   ```

3. **Offline Indicator:**
   - No visual indicator when offline
   - Users don't know if data synced

4. **Accessibility:**
   - No ARIA labels on many buttons
   - Color-only indicators (correlation colors)
   - No keyboard navigation support

---

## 5. EASE OF SETUP ASSESSMENT

**Current State: 6/10**

### Current Setup Process
```bash
git clone https://github.com/liaurens/buddy.git
cd buddy
npm install
# Need to manually set up Dexie Cloud
npx dexie-cloud create
# Need to whitelist domains manually
npx dexie-cloud whitelist http://localhost:5173
npm run dev
```

### Issues
- Dexie Cloud URL hardcoded (can't use different instances)
- No setup script
- No documentation for new developers
- No `.env.example` file

### Recommended Setup

Create `.env.example`:
```env
VITE_DEXIE_CLOUD_URL=https://your-db.dexie.cloud
VITE_AI_DEFAULT_PROVIDER=openai
```

Create `scripts/setup.js`:
```javascript
#!/usr/bin/env node
console.log('Setting up Life Tracker...');
// Check node version
// Copy .env.example to .env
// Run dexie-cloud create if needed
// Install dependencies
```

Update `package.json`:
```json
{
  "scripts": {
    "setup": "node scripts/setup.js",
    "dev": "vite",
    "build": "tsc -b && vite build"
  }
}
```

---

## 6. EASE OF CODEBASE UNDERSTANDING

**Current State: 7/10**

### What's Good
- Consistent file naming (PascalCase components)
- TypeScript provides self-documentation
- Logical folder structure
- Single `types.ts` file for all interfaces

### What's Missing

1. **No README in src folders:**
```
src/features/tracker/README.md  # Explain what tracker does
src/services/README.md          # Explain database schema
```

2. **No JSDoc comments:**
```typescript
// Current
export function calculateTLCC(x: number[], y: number[], maxLag: number) {

// Better
/**
 * Calculate Time-Lagged Cross-Correlation between two time series.
 * Used to find optimal delay between cause and effect (e.g., caffeine -> sleep)
 * @param x - Input series (cause)
 * @param y - Output series (effect)
 * @param maxLag - Maximum hours to check for correlation
 * @returns Array of {lag, correlation} objects
 */
export function calculateTLCC(x: number[], y: number[], maxLag: number) {
```

3. **No architecture decision records (ADRs):**
   - Why Dexie over other databases?
   - Why Context over Redux/Zustand?
   - Why PWA approach?

4. **Complex logic undocumented:**
   - `analysis.ts` has statistical functions with no explanation
   - Protocol linking logic in `ProtocolContext.tsx:106-156` is complex

---

## Summary Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Files in src/** | 32 .tsx/.ts files | Good |
| **Code Coverage** | 0% (no tests) | Critical |
| **TypeScript Coverage** | ~95% (strict mode) | Excellent |
| **Contexts/Providers** | 4 major | Manageable but coupled |
| **Database Tables** | 10 tables | Good schema |
| **Unused Dependencies** | 1 (dexie-export-import) | Minor |
| **API Key Exposure** | Plaintext in IndexedDB | Critical |
| **Component Coupling** | Medium | Acceptable |
| **Error Handling** | Partial | Needs work |
| **Performance** | Re-render storms possible | Watch for scale |

---

## Action Plan

### Week 1: Critical Fixes
- [ ] Add Vitest and first 10 unit tests for `analysis.ts`
- [ ] Create `.env` system for configuration
- [ ] Migrate TaskContext to Dexie
- [ ] Fix text tracker storage

### Week 2: Security
- [ ] Encrypt API keys in storage
- [ ] Enable Dexie Cloud authentication
- [ ] Anonymize AI prompts
- [ ] Add privacy settings page

### Week 3: Modularity
- [ ] Create module structure (`src/modules/`)
- [ ] Extract tracker as standalone module
- [ ] Add module registry for dynamic loading
- [ ] Document module API contracts

### Week 4: Quality
- [ ] Add pre-commit hooks
- [ ] Set up GitHub Actions CI
- [ ] Add component documentation
- [ ] Performance audit with React DevTools

---

## Conclusion

This codebase shows **good architecture fundamentals** with a clean provider pattern, strong TypeScript, and thoughtful data modeling. However, it needs **security hardening**, **test coverage**, and **performance optimization** before production deployment. The feature set is ambitious (experiments, protocols, AI insights, PWA) but well-organized.

The most critical path forward is:
1. Add tests to prevent regressions
2. Fix security issues (API keys, data exposure)
3. Refactor for modularity to support future tools
