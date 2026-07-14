import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';

export interface RecentCapture {
    id: string;
    kind: 'task' | 'note' | 'entry';
    label: string;
    createdAt: string;
}

/** Recent captures across todos / smart_notes / entries, newest first. */
export function useRecentCaptures(limit = 5): { items: RecentCapture[]; isLoading: boolean } {
    const { user } = useAuth();
    const [items, setItems] = useState<RecentCapture[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            const [todos, notes, entries] = await Promise.all([
                supabase
                    .from('todos')
                    .select('id, title, created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(limit),
                supabase
                    .from('smart_notes')
                    .select('id, content, created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(limit),
                supabase
                    .from('entries')
                    .select('id, notes, value, timestamp')
                    .eq('user_id', user.id)
                    .order('timestamp', { ascending: false })
                    .limit(limit),
            ]);

            if (cancelled) return;

            const merged: RecentCapture[] = [
                ...(todos.data ?? []).map(
                    (t: { id: string; title: string; created_at: string }) => ({
                        id: t.id,
                        kind: 'task' as const,
                        label: t.title,
                        createdAt: t.created_at,
                    }),
                ),
                ...(notes.data ?? []).map(
                    (n: { id: string; content: string; created_at: string }) => ({
                        id: n.id,
                        kind: 'note' as const,
                        label: n.content.slice(0, 80),
                        createdAt: n.created_at,
                    }),
                ),
                ...(entries.data ?? []).map(
                    (e: {
                        id: string;
                        notes: string | null;
                        value: unknown;
                        timestamp: string;
                    }) => ({
                        id: e.id,
                        kind: 'entry' as const,
                        label: e.notes || `Logged ${String(e.value)}`,
                        createdAt: e.timestamp,
                    }),
                ),
            ]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, limit);

            setItems(merged);
            setIsLoading(false);
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [user?.id, limit]);

    return { items, isLoading };
}
