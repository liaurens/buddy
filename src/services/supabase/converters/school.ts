import type {
    DbClass,
    DbAssignment,
    DbClassDocument,
    DbClassSession,
    CheckpointItem,
    ClassDocumentKind,
} from '../types/school-types';

export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'graded';
export type { CheckpointItem, ClassDocumentKind };

export interface SchoolClass {
    id: string;
    userId: string;
    name: string;
    instructor: string | null;
    term: string | null;
    color: string;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Assignment {
    id: string;
    userId: string;
    classId: string;
    sourceDocumentId?: string | null;
    title: string;
    description: string | null;
    deadline: string;
    status: AssignmentStatus;
    estimatedMinutes: number | null;
    checkpoints: CheckpointItem[] | null;
    createdAt: string;
    updatedAt: string;
}

export interface ClassDocument {
    id: string;
    userId: string;
    classId: string;
    name: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
    kind: ClassDocumentKind;
    folder: string;
    tags: string[];
    notes: string | null;
    extractedSummary: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
}

export interface ClassSession {
    id: string;
    userId: string;
    classId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string | null;
    createdAt: string;
    updatedAt: string;
}

export function dbToClass(db: DbClass): SchoolClass {
    return {
        id: db.id,
        userId: db.user_id,
        name: db.name,
        instructor: db.instructor,
        term: db.term,
        color: db.color,
        archived: db.archived,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function classToDb(c: Omit<SchoolClass, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Omit<DbClass, 'id' | 'created_at' | 'updated_at'> {
    return {
        user_id: userId,
        name: c.name,
        instructor: c.instructor,
        term: c.term,
        color: c.color,
        archived: c.archived,
    };
}

export function dbToAssignment(db: DbAssignment): Assignment {
    return {
        id: db.id,
        userId: db.user_id,
        classId: db.class_id,
        sourceDocumentId: db.source_document_id,
        title: db.title,
        description: db.description,
        deadline: db.deadline,
        status: db.status,
        estimatedMinutes: db.estimated_minutes,
        checkpoints: db.checkpoints ?? null,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function assignmentToDb(a: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Omit<DbAssignment, 'id' | 'created_at' | 'updated_at'> {
    return {
        user_id: userId,
        class_id: a.classId,
        source_document_id: a.sourceDocumentId ?? null,
        title: a.title,
        description: a.description,
        deadline: a.deadline,
        status: a.status,
        estimated_minutes: a.estimatedMinutes,
        checkpoints: a.checkpoints,
    };
}

export function dbToClassDocument(db: DbClassDocument): ClassDocument {
    return {
        id: db.id,
        userId: db.user_id,
        classId: db.class_id,
        name: db.name,
        storagePath: db.storage_path,
        mimeType: db.mime_type,
        sizeBytes: db.size_bytes,
        kind: db.kind,
        folder: db.folder || 'General',
        tags: db.tags ?? [],
        notes: db.notes,
        extractedSummary: db.extracted_summary,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function dbToClassSession(db: DbClassSession): ClassSession {
    return {
        id: db.id,
        userId: db.user_id,
        classId: db.class_id,
        dayOfWeek: db.day_of_week,
        startTime: db.start_time,
        endTime: db.end_time,
        location: db.location,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function classSessionToDb(s: Omit<ClassSession, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Omit<DbClassSession, 'id' | 'created_at' | 'updated_at'> {
    return {
        user_id: userId,
        class_id: s.classId,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        location: s.location,
    };
}
