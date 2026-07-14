// Tasks Feature Types

// Energy & Context
export type TaskEnergy = 'low' | 'medium' | 'high';
export type TaskContext = 'computer' | 'phone' | 'home' | 'out' | 'anywhere';

// Task Kind — behavioral classification that drives capture, scheduling, and surfacing.
// Hybrid model: when `kind` is unset it is derived from existing signals
// (priority/recurrence/dueDate/reminder) via deriveTaskKind(); an explicit value overrides.
// 'school' is DERIVED-ONLY (assignmentId / triage destination) — it is never
// written to the todos.kind column and kind pickers must not offer it.
export type TaskKind =
    | 'urgent'
    | 'backlog'
    | 'deadline'
    | 'routine'
    | 'standard'
    | 'waiting'
    | 'school';

// Hardness — can the planner move this task?
//   fixed    = tied to a real-world moment (appointment, exam, hard deadline); planner locks it.
//   flexible = has a target but can slide; planner may reschedule it.
export type Hardness = 'fixed' | 'flexible';

// Recurrence Types
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays';

export interface RecurrenceConfig {
    daysOfWeek?: number[]; // 0=Sunday … 6=Saturday; used for 'weekly'
    interval?: number; // reserved for "every N days/weeks/months"
}

// Task Types
export interface Subtask {
    id: string;
    title: string;
    completed: boolean;
}

export interface Task {
    id: string;
    title: string;
    completed: boolean;
    dueDate?: string;
    dueTime?: string; // HH:MM format for specific time
    location?: string; // Location for the task
    labels?: string[]; // Custom labels/tags for grouping
    createdAt: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    estimatedTime?: number; // in minutes
    subtasks?: Subtask[];

    // Time tracking for daily planning
    actualMinutes?: number; // Actual time spent when completed
    startedAt?: string; // ISO timestamp when task was started
    completedAt?: string; // ISO timestamp when task was completed
    historicalMinutes?: number[]; // Previous durations for similar tasks (learning data)

    // Recurrence
    recurrence?: RecurrencePattern;
    recurrenceConfig?: RecurrenceConfig;

    // Per-task reminders
    reminderEnabled?: boolean;
    reminderOffsetMinutes?: number; // minutes before due
    reminderAt?: string; // ISO datetime, absolute mode (takes precedence)
    reminderCadence?: ReminderCadence;
    lastRemindedAt?: string;

    // Categorization & batching
    taskTypeId?: string;
    assignmentId?: string;
    energy?: TaskEnergy;
    context?: TaskContext;
    routineId?: string;
    routineOrder?: number;

    // Behavioral kind (explicit override; usually derived via deriveTaskKind)
    kind?: TaskKind;

    // Urgent flow: prep tasks worked on earlier days roll up to a parent task
    parentTodoId?: string;
    // Free-form "important info" captured during the urgent scheduling flow
    notes?: string;

    // Triage: when the task was routed to a destination. Unset = still in the
    // capture inbox (the morning triage router sorts these).
    triagedAt?: string;

    // Hardness axis — drives planner locking + reminder escalation.
    hardness?: Hardness;
    // AI routed this without confirmation; shown in the "I sorted these" review, cleared on confirm/correct.
    autoTriaged?: boolean;
    // Destination triage routed the task to ('urgent'/'today'/'someday'/'school'/'routine').
    triageDestination?: string;

    // Google Calendar write sync (Phase 1)
    googleEventId?: string;
    googleCalendarId?: string;
    googleSyncedAt?: string;

    // Stuck signals — times pushed later while incomplete, and last user
    // interaction (edit/toggle/start/reschedule). Drive the "split this" chip.
    snoozeCount?: number;
    lastTouchedAt?: string;
    /** Person or organization that must respond before this task can continue. */
    waitingOn?: string;
    /** First day a deadline task should compete for attention (YYYY-MM-DD). */
    startDate?: string;
}

// Task Types (user-defined categories like Email, Home, Study)
export interface TaskType {
    id: string;
    name: string;
    emoji?: string;
    color?: string;
    sortOrder: number;
    isPreset: boolean;
    createdAt: string;
    /** Weekdays where this category naturally belongs (0=Sun ... 6=Sat). */
    homeDays?: number[];
}

// Routines (reusable batches of tasks)
export interface RoutineItem {
    id: string;
    routineId: string;
    title: string;
    taskTypeId?: string;
    energy?: TaskEnergy;
    estimatedTime?: number;
    sortOrder: number;
}

export interface Routine {
    id: string;
    name: string;
    emoji?: string;
    description?: string;
    createdAt: string;
    items: RoutineItem[];
}

export type ReminderCadence = 'single' | 'smart' | 'aggressive';

export interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    addTask: (
        title: string,
        priority?: Task['priority'],
        estimatedTime?: number,
        dueDate?: string,
        recurrence?: RecurrencePattern,
        recurrenceConfig?: RecurrenceConfig,
        dueTime?: string,
    ) => Promise<string>;
    addTaskFull: (partial: Partial<Task> & { title: string }) => Promise<string>;
    toggleTask: (id: string) => void;
    deleteTask: (id: string) => void;
    updateTask: (task: Task) => void;

    // Time tracking methods for daily planning
    startTask: (id: string) => void;
    completeTaskWithDuration: (id: string, actualMinutes: number) => void;

    // Bulk actions
    rescheduleMany: (ids: string[], isoDate: string) => Promise<void>;
    completeMany: (ids: string[]) => Promise<void>;
    deleteMany: (ids: string[]) => Promise<void>;
}

// Todo is an alias for Task - used by database for backward compatibility
export type Todo = Task;

// Smart Notes Types
export interface NoteCategory {
    id: string;
    name: string;
    flag: string;
    emoji?: string;
    color?: string;
    createdAt: string;
}

export interface SmartNote {
    id: string;
    content: string;
    categoryId?: string;
    flag?: string;
    processed: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface SmartNotesState {
    notes: SmartNote[];
    categories: NoteCategory[];
    isLoading: boolean;

    addNote: (content: string) => Promise<void>;
    convertNoteToTask: (note: SmartNote) => Promise<void>;
    updateNote: (note: SmartNote) => Promise<void>;
    deleteNote: (id: string) => Promise<void>;
    moveToCategory: (noteId: string, categoryId: string | null) => Promise<void>;
    markProcessed: (noteId: string) => Promise<void>;

    addCategory: (category: Omit<NoteCategory, 'id' | 'createdAt'>) => Promise<void>;
    updateCategory: (category: NoteCategory) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
}
