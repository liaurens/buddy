// Tasks Feature Types

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
    createdAt: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    estimatedTime?: number; // in minutes
    subtasks?: Subtask[];

    // Time tracking for daily planning
    actualMinutes?: number;       // Actual time spent when completed
    startedAt?: string;            // ISO timestamp when task was started
    completedAt?: string;          // ISO timestamp when task was completed
    historicalMinutes?: number[];  // Previous durations for similar tasks (learning data)
}

export interface TaskState {
    tasks: Task[];
    addTask: (title: string, priority?: Task['priority'], estimatedTime?: number) => void;
    toggleTask: (id: string) => void;
    deleteTask: (id: string) => void;
    updateTask: (task: Task) => void;

    // Time tracking methods for daily planning
    startTask: (id: string) => void;
    completeTaskWithDuration: (id: string, actualMinutes: number) => void;
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

    addNote: (content: string) => Promise<void>;
    updateNote: (note: SmartNote) => Promise<void>;
    deleteNote: (id: string) => Promise<void>;
    moveToCategory: (noteId: string, categoryId: string | null) => Promise<void>;
    markProcessed: (noteId: string) => Promise<void>;

    addCategory: (category: Omit<NoteCategory, 'id' | 'createdAt'>) => Promise<void>;
    updateCategory: (category: NoteCategory) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
}
