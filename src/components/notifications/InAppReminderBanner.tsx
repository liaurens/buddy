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
        setCurrent(prev => prev?.id === row.id ? prev : {
            id: row.id,
            title: row.title,
            body: row.body,
            data: row.data,
            scheduledFor: row.scheduled_for,
        });
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
        <div className="fixed bottom-20 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:max-w-sm">
            <div className="bg-white border border-indigo-200 rounded-2xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Bell size={18} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{current.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{current.body}</p>
                    <div className="flex gap-2 mt-2">
                        {route && onNavigate && (
                            <button
                                onClick={handleGo}
                                className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                            >
                                Go <ArrowRight size={12} />
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
                <button onClick={handleDismiss} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default InAppReminderBanner;
