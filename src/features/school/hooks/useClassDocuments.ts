import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import type {
    ClassDocument,
    ClassDocumentKind,
} from '../../../services/supabase/converters/school';
import {
    deleteCourseDocument,
    listClassDocuments,
    uploadCourseDocument,
    updateCourseDocument,
} from '../services/school-import.service';

const EMPTY: ClassDocument[] = [];

export function useClassDocuments(classId?: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const queryKey = useMemo(() => ['classDocuments', userId, classId ?? null], [userId, classId]);

    const { data: documents = EMPTY, isLoading } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!classId || !userId) return [];
            return listClassDocuments(classId);
        },
        enabled: !!classId && !!userId,
    });

    const uploadDocument = useCallback(
        async (
            file: File,
            kind: ClassDocumentKind,
            metadata?: { folder?: string; tags?: string[]; notes?: string | null },
        ) => {
            if (!classId) throw new Error('Missing class');
            const document = await uploadCourseDocument(classId, file, kind, metadata);
            queryClient.invalidateQueries({ queryKey });
            return document;
        },
        [classId, queryClient, queryKey],
    );

    const updateDocument = useCallback(
        async (
            document: Pick<ClassDocument, 'id'>,
            patch: Partial<Pick<ClassDocument, 'name' | 'kind' | 'folder' | 'tags' | 'notes'>>,
        ) => {
            await updateCourseDocument(document, patch);
            queryClient.invalidateQueries({ queryKey });
        },
        [queryClient, queryKey],
    );

    const deleteDocument = useCallback(
        async (document: ClassDocument) => {
            await deleteCourseDocument(document);
            queryClient.invalidateQueries({ queryKey });
        },
        [queryClient, queryKey],
    );

    const refreshDocuments = useCallback(() => {
        queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
        documents,
        isLoading,
        uploadDocument,
        updateDocument,
        deleteDocument,
        refreshDocuments,
    };
}
