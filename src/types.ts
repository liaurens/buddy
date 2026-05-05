// Central types file - Re-exports from feature-specific type files
// This file maintains backward compatibility while types are migrated to feature folders

// Health Tracking Types
export type {
    TrackerType,
    TrackerCadence,
    ScaleDirection,
    TrackerScale,
    TrackerDefinition,
    Entry,
    TrackerState,
    Protocol,
    ExpectedOutcome,
    Cycle,
    Dose,
    Experiment,
    ExperimentLog,
    ExperimentMetric,
    ExperimentPhase,
    ExperimentStatus,
    ExperimentCheckinEntry,
    DailyJournalEntry,
    JournalPromptResponse,
    CorrelationResult,
    TLCCResult
} from './features/health-tracking/types';

// Tasks Types
export type {
    Task,
    Subtask,
    TaskState,
    Todo,
    SmartNote,
    NoteCategory,
    SmartNotesState
} from './features/tasks/types';

// Toolbox Types
export type {
    Strategy
} from './features/toolbox/types';

// Planning types are now in features/planning/types.ts
// Import from './types/planning' for planning-specific types
