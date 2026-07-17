/**
 * In-App Reminder Banner
 *
 * Polls scheduled_notifications every 60s. When a pending row's scheduled_for
 * time is at or past now and belongs to the current user, surfaces a banner.
 * Dismissing or "Go" marks the row as sent so it doesn't re-fire.
 *
 * Fallback for users who haven't enabled push / are on a browser that doesn't
 * deliver push when the tab is foregrounded (iOS pre-PWA).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import type { AppRoute } from '../../constants/routes';

interface PendingNotification {
    id: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    scheduledFor: string;
}

const POLL_INTERVAL_MS = 60 * 1000;

interface Props {
    onNavigate?: (tab: AppRoute) => void;
}

const InAppReminderBanner: React.FC<Props> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [current, setCurrent] = useState<PendingNotification | null>(null);

    const markSent = useCallback(async (id: string) => {
        await supabase
            .from('scheduled_notifications')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', id);
    }, []);

    const poll = useCallback(async () => {
        if (!user?.id) return;
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
            .from('scheduled_notifications')
            .select('id, title, body, data, scheduled_for')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .lte('scheduled_for', nowIso)
            .order('scheduled_for', { ascending: false })
            .limit(1);

        if (error) {
            console.error('In-app banner poll failed:', error);
            return;
        }
        if (!data || data.length === 0) return;

        const row = data[0];
        setCurrent((prev) =>
            prev?.id === row.id
                ? prev
                : {
                      id: row.id,
                      title: row.title,
                      body: row.body,
                      data: row.data,
                      scheduledFor: row.scheduled_for,
                  },
        );
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        poll();
        const handle = window.setInterval(poll, POLL_INTERVAL_MS);
        return () => window.clearInterval(handle);
    }, [user?.id, poll]);

    if (!current) return null;

    const route = (current.data?.route as AppRoute | undefined) ?? null;

    const handleGo = async () => {
        await markSent(current.id);
        if (route && onNavigate) onNavigate(route);
        setCurrent(null);
    };

    const handleDismiss = async () => {
        await markSent(current.id);
        setCurrent(null);
    };

    return (
        <div className="fixed bottom-28 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:max-w-sm">
            <div className="flex items-start gap-3 rounded-card-lg bg-white p-4 shadow-cove-strong animate-in slide-in-from-bottom-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cove-tint-blue">
                    <Bell size={18} className="text-cove-accent" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-cove-ink">{current.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-cove-muted">{current.body}</p>
                    <div className="mt-2 flex gap-2">
                        {route && onNavigate && (
                            <button
                                onClick={handleGo}
                                className="flex items-center gap-1 rounded-lg bg-cove-accent px-3 py-1 text-xs font-extrabold text-white hover:bg-[#3a8dc7]"
                            >
                                Go <ArrowRight size={12} />
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1 text-xs font-bold text-cove-soft hover:text-cove-muted"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    aria-label="Close"
                    className="p-1 text-cove-faint hover:text-cove-muted"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default InAppReminderBanner;
