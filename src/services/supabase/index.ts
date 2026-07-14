/**
 * Supabase Service - Main Entry Point
 */

// Client
export { supabase, isSupabaseConfigured } from './client';

// Database types
export type {
    DbTracker,
    DbEntry,
    DbProtocol,
    DbCycle,
    DbDose,
    DbExperiment,
    DbCorrelation,
    DbExperimentLog,
    DbExperimentCheckinEntry,
    DbDailyJournalEntry,
    DbExperimentAgentConversation,
    DbStrategy,
    DbTodo,
    DbTaskType,
    DbTaskRoutine,
    DbTaskRoutineItem,
    TaskEnergy,
    TaskContext,
    DbNoteCategory,
    DbSmartNote,
    DbActivityTemplate,
    DbCalendarEvent,
} from './types';

// Converters - Tracker
export { dbToTracker, trackerToDb, dbToEntry, entryToDb } from './converters/tracker';

// Converters - Protocol
export {
    dbToProtocol,
    protocolToDb,
    dbToCycle,
    cycleToDb,
    dbToDose,
    doseToDb,
} from './converters/protocol';

// Converters - Experiment
export {
    dbToExperiment,
    experimentToDb,
    dbToExperimentLog,
    experimentLogToDb,
    dbToCorrelation,
    dbToExperimentCheckinEntry,
    dbToDailyJournalEntry,
} from './converters/experiment';

// Converters - Strategy
export { dbToStrategy, strategyToDb } from './converters/strategy';

// Converters - Todo
export { dbToTodo, todoToDb } from './converters/todo';

// Converters - Task Types
export { dbToTaskType, taskTypeToDb } from './converters/taskTypes';

// Converters - Routines
export { dbToRoutine, routineToDb, dbToRoutineItem, routineItemToDb } from './converters/routines';

// Converters - Goal
export {
    dbToGoal,
    goalToDb,
    dbToGoalLog,
    type Goal,
    type GoalLog,
    type GoalType,
} from './converters/goal';

// Converters - School
export {
    dbToClass,
    classToDb,
    dbToAssignment,
    assignmentToDb,
    dbToClassSession,
    classSessionToDb,
    type SchoolClass,
    type Assignment,
    type ClassSession,
    type ClassDocument,
    type AssignmentStatus,
} from './converters/school';

// Converters - Notes
export { dbToNoteCategory, dbToSmartNote, smartNoteToDb } from './converters/notes';

// Converters - Planning
export {
    dbToActivityTemplate,
    activityTemplateToDb,
    dbToCalendarEvent,
    calendarEventToDb,
} from './converters/planning';

// Operations
export { getSetting, setSetting } from './operations/settings';
export { exportAllData, importAllData } from './operations/backup';
export { initializeUserData } from './operations/seed';

export { getExperimentLogs, addExperimentLog } from './operations/experiment-logs';
export {
    getExperimentCheckins,
    saveExperimentCheckin,
    deleteExperimentCheckin,
    deleteExperimentCheckinByDate,
} from './operations/experiment-checkins';
export { getJournalEntry, saveJournalEntry, getJournalEntries } from './operations/daily-journal';
export { saveFeedback, getFeedbackForPath } from './operations/site-feedback';
