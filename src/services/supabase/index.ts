/**
 * Supabase Service - Main Entry Point
 */

// Client
export { supabase, isSupabaseConfigured } from './client';

// Database types
export type {
    DbTracker, DbEntry,
    DbProtocol, DbCycle, DbDose,
    DbExperiment, DbCorrelation, DbExperimentLog, DbExperimentCheckinEntry, DbDailyJournalEntry, DbExperimentAgentConversation,
    DbStrategy,
    DbTodo,
    DbNoteCategory, DbSmartNote,
    DbDailyPlan, DbTimeBlock, DbActivityTemplate, DbCalendarEvent,
} from './types';

// Converters - Tracker
export { dbToTracker, trackerToDb, dbToEntry, entryToDb } from './converters/tracker';

// Converters - Protocol
export { dbToProtocol, protocolToDb, dbToCycle, cycleToDb, dbToDose, doseToDb } from './converters/protocol';

// Converters - Experiment
export { dbToExperiment, experimentToDb, dbToExperimentLog, experimentLogToDb, dbToCorrelation, dbToExperimentCheckinEntry, dbToDailyJournalEntry } from './converters/experiment';

// Converters - Strategy
export { dbToStrategy, strategyToDb } from './converters/strategy';

// Converters - Todo
export { dbToTodo, todoToDb } from './converters/todo';

// Converters - Notes
export { dbToNoteCategory, dbToSmartNote, smartNoteToDb } from './converters/notes';

// Converters - Planning
export {
    dbToDailyPlan, dailyPlanToDb,
    dbToTimeBlock, timeBlockToDb,
    dbToActivityTemplate, activityTemplateToDb,
    dbToCalendarEvent, calendarEventToDb,
} from './converters/planning';

// Operations
export { getSetting, setSetting } from './operations/settings';
export { exportAllData, importAllData } from './operations/backup';
export { initializeUserData } from './operations/seed';
export { getExperimentLogs, addExperimentLog } from './operations/experiment-logs';
export { getExperimentCheckins, saveExperimentCheckin, deleteExperimentCheckin } from './operations/experiment-checkins';
export { getJournalEntry, saveJournalEntry, getJournalEntries } from './operations/daily-journal';
export { saveFeedback, getFeedbackForPath } from './operations/site-feedback';
