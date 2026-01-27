# Calendar and Planning Bug Fixes

## Date: 2026-01-27

### Critical Bugs Fixed

## 1. Calendar Integration Not Persisting Events ✅ FIXED

**Problem**:
- User imports calendar via Settings → Calendar Integration
- Calendar events are fetched and parsed successfully
- BUT events were NEVER saved to the database
- When generating a plan, no calendar events appeared because `calendar_events` table was empty

**Root Cause**:
- `calendar.service.ts` only had fetch/parse functions
- `SettingsPage` `handleTestCalendarSync` displayed event count but didn't save to DB
- `planning.service.ts` `getCalendarEventsForDate` queried empty table

**Fix Applied**:
1. Added `saveCalendarEventsToDatabase()` function to `calendar.service.ts`
2. Modified `handleTestCalendarSync()` in `SettingsPage.tsx` to:
   - Fetch events from iCal URL
   - Save events to `calendar_events` table
   - Delete old events from same source (avoid duplicates)
   - Save sync timestamp and configuration

**Files Changed**:
- `src/features/planning/services/calendar.service.ts` (+62 lines)
- `src/features/core/pages/SettingsPage.tsx` (modified handleTestCalendarSync)

---

## 2. Plan Persistence Failures ✅ FIXED

**Problem**:
- User generates daily plan successfully
- Navigates away and comes back
- Plan is missing or incomplete
- Orphaned daily_plans records without time_blocks

**Root Cause**:
- No transaction handling in `savePlanToDatabase()`
- If `daily_plans` insert succeeded but `time_blocks` insert failed:
  - Orphaned plan record left in database
  - No rollback mechanism
- Using `insert` instead of `upsert` caused conflicts when re-planning same day

**Fix Applied**:
1. Changed `insert` to `upsert` for `daily_plans` with `onConflict: 'user_id,date'`
2. Delete existing `time_blocks` before inserting new ones (handles re-planning)
3. Added manual rollback:
   - Track `planId` after daily_plans creation
   - If time_blocks insert fails, delete the daily_plans record
   - Wrap entire operation in try-catch with cleanup
4. Better error messages with specific failure points

**Files Changed**:
- `src/features/planning/services/planning.service.ts` (savePlanToDatabase function)

---

## 3. webcal:// URL Protocol Not Supported ✅ FIXED

**Problem**:
- User enters iCloud calendar URL starting with `webcal://`
- Browser Fetch API error: "URL scheme 'webcal' is not supported"
- Calendar sync fails immediately

**Root Cause**:
- `webcal://` is not a real protocol - it's just `https://` with a hint that it's a calendar
- Browser Fetch API doesn't recognize `webcal://` scheme
- URL needs to be normalized before fetching

**Fix Applied**:
- Added `normalizeCalendarUrl()` function
- Converts `webcal://` to `https://` before fetching
- Also converts `http://` to `https://` for security

**Files Changed**:
- `src/features/planning/services/calendar.service.ts` (added normalizeCalendarUrl)

---

## Remaining Issues (Not Fixed)

### Timer State Not Persisted
**Issue**: Timer elapsed time lost on page refresh
**Impact**: Medium - users lose progress if browser closes
**Recommendation**: Add auto-save of timer state every 30 seconds

### Client-Side API Keys
**Issue**: AI API keys stored client-side with `dangerouslyAllowBrowser: true`
**Impact**: High Security Risk - keys exposed in browser dev tools
**Recommendation**: Move AI calls to backend proxy/edge function

### No Migration Verification
**Issue**: App crashes if planning tables don't exist
**Impact**: High - poor first-run experience
**Recommendation**: Add startup migration check with clear user guidance

### Cross-Tab Sync
**Issue**: Multiple open tabs don't sync state
**Impact**: Low - causes confusion for power users
**Recommendation**: Use BroadcastChannel API or Supabase realtime

---

## Testing Checklist

- [x] Calendar sync saves events to database
- [x] Calendar events appear in daily plan generation
- [x] Re-planning same day replaces old plan (not duplicates)
- [x] Time blocks insert failure rolls back daily_plans
- [ ] Timer state persists across page refresh (NOT FIXED)
- [ ] Migration missing shows helpful error (NOT FIXED)
- [ ] Multiple calendar sources don't conflict (NEEDS TESTING)

---

## Deployment Notes

**Database Changes**: None required (all tables already exist in migration)

**Breaking Changes**: None

**Rollback**: Safe - changes are backwards compatible

**Monitoring**: Watch for:
- Calendar sync errors in console
- Orphaned daily_plans records (should be zero after fix)
- Time_blocks insert failures

---

## User Impact

**Before**:
- Calendar integration appeared to work but events never showed in plans
- Plans randomly disappeared after navigation
- Re-planning same day caused errors

**After**:
- Calendar events properly sync and persist to database
- Plans reliably save and reload
- Re-planning same day works correctly
- Better error messages guide users to issues
