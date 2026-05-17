import { supabase } from '../../../services/supabase';
import {
    dbToClassDocument,
    type ClassDocument,
    type ClassDocumentKind,
} from '../../../services/supabase/converters/school';
import type { DbClassDocument } from '../../../services/supabase/types/school-types';

export interface CourseImportCheckpoint {
    number: number | string;
    title: string;
    subitems?: string[];
    notes?: string;
}

export interface CourseImportAssignment {
    title: string;
    description?: string;
    deadline: string;
    estimatedMinutes?: number;
    checkpoints?: CourseImportCheckpoint[];
    include?: boolean;
}

export interface CourseImportSession {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location?: string;
    include?: boolean;
}

export interface CourseImportPayload {
    summary: string;
    sourceDocumentId?: string;
    assignments: CourseImportAssignment[];
    sessions: CourseImportSession[];
}

export interface CourseImportCounts {
    assignments: number;
    sessions: number;
}

export async function listClassDocuments(classId: string): Promise<ClassDocument[]> {
    const { data, error } = await supabase
        .from('class_documents')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as DbClassDocument[]).map(dbToClassDocument);
}

export async function uploadCourseDocument(
    classId: string,
    file: File,
    kind: ClassDocumentKind,
    metadata?: { folder?: string; tags?: string[]; notes?: string | null }
): Promise<ClassDocument> {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Only PDF files are supported.');
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const storagePath = `${userId}/${classId}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from('class-documents')
        .upload(storagePath, file, {
            contentType: 'application/pdf',
            upsert: false,
        });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
        .from('class_documents')
        .insert({
            user_id: userId,
            class_id: classId,
            name: file.name,
            storage_path: storagePath,
            mime_type: 'application/pdf',
            size_bytes: file.size,
            kind,
            folder: metadata?.folder?.trim() || 'General',
            tags: metadata?.tags ?? [],
            notes: metadata?.notes?.trim() || null,
            extracted_summary: null,
        })
        .select('*')
        .single();

    if (error) {
        await supabase.storage.from('class-documents').remove([storagePath]);
        throw error;
    }

    return dbToClassDocument(data as DbClassDocument);
}

export async function updateCourseDocument(
    document: Pick<ClassDocument, 'id'>,
    patch: Partial<Pick<ClassDocument, 'name' | 'kind' | 'folder' | 'tags' | 'notes'>>
): Promise<void> {
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) dbPatch.name = patch.name.trim();
    if (patch.kind !== undefined) dbPatch.kind = patch.kind;
    if (patch.folder !== undefined) dbPatch.folder = patch.folder.trim() || 'General';
    if (patch.tags !== undefined) dbPatch.tags = patch.tags;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes?.trim() || null;

    const { error } = await supabase
        .from('class_documents')
        .update(dbPatch)
        .eq('id', document.id);
    if (error) throw error;
}

export async function deleteCourseDocument(document: ClassDocument): Promise<void> {
    const { error } = await supabase
        .from('class_documents')
        .delete()
        .eq('id', document.id);
    if (error) throw error;

    await supabase.storage.from('class-documents').remove([document.storagePath]);
}

export async function getDocumentDownloadUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from('class-documents')
        .createSignedUrl(storagePath, 60 * 10);
    if (error) throw error;
    return data.signedUrl;
}

export async function extractFromDocuments(
    classId: string,
    documentIds: string[],
    extraInstructions?: string
): Promise<CourseImportPayload> {
    const { data, error } = await supabase.functions.invoke('school-import', {
        body: {
            action: 'extract',
            classId,
            documentIds,
            extraInstructions,
        },
    });

    if (error) throw new Error(error.message || 'Analyze failed');
    if (!data?.success) throw new Error(data?.error || 'Analyze failed');
    return data.payload as CourseImportPayload;
}

export async function commitImport(
    classId: string,
    payload: CourseImportPayload
): Promise<CourseImportCounts> {
    const { data, error } = await supabase.functions.invoke('school-import', {
        body: {
            action: 'commit',
            classId,
            payload,
        },
    });

    if (error) throw new Error(error.message || 'Import failed');
    if (!data?.success) throw new Error(data?.error || 'Import failed');
    return data.counts as CourseImportCounts;
}
