import type { DbClass, DbAssignment, DbClassSession } from '../types/school-types';

export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'graded';

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
    title: string;
    description: string | null;
    deadline: string;
    status: AssignmentStatus;
    estimatedMinutes: number | null;
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
        title: db.title,
        description: db.description,
        deadline: db.deadline,
        status: db.status,
        estimatedMinutes: db.estimated_minutes,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function assignmentToDb(a: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Omit<DbAssignment, 'id' | 'created_at' | 'updated_at'> {
    return {
        user_id: userId,
        class_id: a.classId,
        title: a.title,
        description: a.description,
        deadline: a.deadline,
        status: a.status,
        estimated_minutes: a.estimatedMinutes,
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
