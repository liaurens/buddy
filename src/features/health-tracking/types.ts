// Health Tracking Feature Types

// Tracker Types
export type TrackerType = 'number' | 'rating' | 'boolean' | 'text';

export interface TrackerDefinition {
    id: string;
    name: string;
    emoji: string;
    type: TrackerType;
    unit?: string;
    group?: string;
    goal?: {
        target: number;
        condition: 'gt' | 'lt' | 'eq';
    };
    checkinConfig?: {
        isRequired: boolean;
        inCheckin: boolean;
        showInDailyReport?: boolean;
    };
}

export interface Entry {
    id: string;
    trackerId: string;
    value: number;
    textValue?: string; // For text type trackers
    timestamp: string;
    notes?: string;
    metadata?: Record<string, any>;
}

export interface TrackerState {
    entries: Entry[];
    trackers: TrackerDefinition[];

    // Entries
    addEntry: (entry: Omit<Entry, 'id'>) => Promise<void>;
    updateEntry: (entry: Entry) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;

    // Trackers
    addTracker: (tracker: TrackerDefinition) => Promise<void>;
    updateTracker: (tracker: TrackerDefinition) => Promise<void>;
    deleteTracker: (id: string) => Promise<void>;

    exportData: () => Promise<string>;
    importData: (jsonData: string) => Promise<boolean>;
}

// Protocol Types
export interface ExpectedOutcome {
    id: string;
    outcomeType: 'primary' | 'secondary';
    description: string;
    targetMetric?: string;
    targetValue?: number;
    expectedOnset?: string;
}

export interface Protocol {
    id: string;
    name: string;
    category: 'peptide' | 'pharmaceutical' | 'supplement' | 'practice' | 'other';
    doseAmount?: number; // Optional for practice-type protocols
    doseUnit?: string;   // Optional for practice-type protocols
    frequency: string;
    route?: string;
    timingNotes?: string;
    halfLifeHours?: number;
    active: boolean;
    expectedOutcomes?: ExpectedOutcome[];
    linkedTrackerId?: string; // ID of a tracker that automatically logs this protocol's dose
    defaultTrackerType?: 'boolean' | 'number'; // If auto-creating, what type?
    effectTiming?: 'immediate' | 'immediate_compounding' | 'long_term'; // Effect timing tag
    createdAt: string;
}

export interface Cycle {
    id: string;
    protocolId: string;
    cycleNumber: number;
    startDate: string;
    plannedEndDate?: string;
    actualEndDate?: string;
    offCycleDays?: number;
    status: 'active' | 'completed' | 'aborted';
    notes?: string;
}

export interface Dose {
    id: string;
    protocolId: string;
    cycleId?: string;
    scheduledAt?: string;
    takenAt?: string;
    actualAmount?: number;
    skipped: boolean;
    skipReason?: string;
}

// Experiment Types
export interface Experiment {
    id: string;
    name: string;
    description?: string;
    tracker1Id: string;
    independentIds?: string[]; // Array of tracker/protocol IDs being tested (Causes)
    tracker2Id: string; // The dependent variable (Effect)
    startDate: string;
    endDate?: string;
    active: boolean;
    frequency?: 'daily' | 'weekly'; // Reminder frequency
}

export interface ExperimentLog {
    id: string;
    experimentId: string;
    date: string;
    content: string;
    moodRating?: number;
    createdAt: string;
}

// Analytics Types
export interface CorrelationResult {
    id: string;
    inputTrackerId: string;
    outputTrackerId: string;
    correlation: number;
    pValue?: number;
    optimalLagHours: number;
    sampleSize: number;
    confidenceLow?: number;
    confidenceHigh?: number;
    calculatedAt: string;
}

export interface TLCCResult {
    lag: number;
    correlation: number;
}
