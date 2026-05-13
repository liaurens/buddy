export interface DbClass {
    id: string;
    user_id: string;
    name: string;
    instructor: string | null;
    term: string | null;
    color: string;
    archived: boolean;
    created_at: string;
    updated_at: string;
}

export interface CheckpointItem {
    id: string;
    number: string;
    title: string;
    subitems: string[];
    notes: string;
    done: boolean;
}

export interface DbAssignment {
    id: string;
    user_id: string;
    class_id: string;
    title: string;
    description: string | null;
    deadline: string;
    status: 'pending' | 'in_progress' | 'submitted' | 'graded';
    estimated_minutes: number | null;
    checkpoints: CheckpointItem[] | null;
    created_at: string;
    updated_at: string;
}

export interface DbClassSession {
    id: string;
    user_id: string;
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    location: string | null;
    created_at: string;
    updated_at: string;
}
