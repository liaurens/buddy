/**
 * Supabase Service - Main Entry Point
 *
 * This file maintains backward compatibility during the refactoring process.
 * Gradually migrating from monolithic supabase.ts to modular structure.
 *
 * Migration Status:
 * ✅ Client (exported from ./client.ts)
 * ✅ Types (exported from ./types/)
 * ✅ Tracker converters (exported from ./converters/tracker.ts)
 * ✅ Protocol converters (exported from ./converters/protocol.ts)
 * ⏳ Remaining converters (still in ../supabase.ts)
 * ⏳ Operations (still in ../supabase.ts)
 */

// Re-export client
export { supabase, isSupabaseConfigured } from './client';

// Re-export all database types
export type {
    DbTracker,
    DbEntry,
    DbProtocol,
    DbCycle,
    DbDose,
    DbExperiment,
    DbCorrelation,
    DbExperimentLog,
    DbStrategy,
    DbTodo,
    DbNoteCategory,
    DbSmartNote,
    DbDailyPlan,
    DbTimeBlock,
    DbActivityTemplate,
    DbCalendarEvent,
} from './types';

// Re-export migrated converters
export {
    dbToTracker,
    trackerToDb,
    dbToEntry,
    entryToDb,
} from './converters/tracker';

export {
    dbToProtocol,
    protocolToDb,
    dbToCycle,
    cycleToDb,
    dbToDose,
    doseToDb,
} from './converters/protocol';

// Re-export remaining items from old file (temporary during migration)
export {
    dbToExperiment,
    experimentToDb,
    dbToExperimentLog,
    experimentLogToDb,
    dbToCorrelation,
    dbToStrategy,
    strategyToDb,
    dbToTodo,
    todoToDb,
    dbToNoteCategory,
    dbToSmartNote,
    smartNoteToDb,
    dbToDailyPlan,
    dailyPlanToDb,
    dbToTimeBlock,
    timeBlockToDb,
    dbToActivityTemplate,
    activityTemplateToDb,
    dbToCalendarEvent,
    calendarEventToDb,
    getSetting,
    setSetting,
    exportAllData,
    importAllData,
    initializeUserData,
} from '../supabase';
