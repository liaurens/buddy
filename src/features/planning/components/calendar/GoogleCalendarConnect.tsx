/**
 * Google Calendar connection card for the calendar settings modal.
 * Lets the user connect (OAuth) so scheduled urgent tasks are written to their
 * real Google Calendar, and disconnect (revoke) again.
 */

import React from 'react';
import { Calendar, Check, Loader2, AlertTriangle } from 'lucide-react';
import {
    useGoogleCalendarConnection,
    useConnectGoogleCalendar,
    useDisconnectGoogleCalendar,
    isGoogleCalendarConfigured,
} from '../../hooks/useGoogleCalendar';

const GoogleCalendarConnect: React.FC = () => {
    const { data, isLoading } = useGoogleCalendarConnection();
    const connect = useConnectGoogleCalendar();
    const disconnect = useDisconnectGoogleCalendar();

    if (!isGoogleCalendarConfigured) {
        return (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Google Calendar isn't configured yet (missing VITE_GOOGLE_OAUTH_CLIENT_ID).
            </div>
        );
    }

    const connected = !!data?.connected;

    return (
        <div className="rounded-md border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                        <Calendar size={18} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                            Write to Google Calendar
                        </p>
                        {isLoading ? (
                            <p className="text-xs text-slate-400">Checking connection…</p>
                        ) : connected ? (
                            <p className="text-xs text-emerald-700 flex items-center gap-1">
                                <Check size={12} /> Connected
                                {data?.googleEmail ? ` · ${data.googleEmail}` : ''}
                            </p>
                        ) : (
                            <p className="text-xs text-slate-500">
                                Scheduled urgent tasks will appear in your Google Calendar.
                            </p>
                        )}
                    </div>
                </div>

                {connected ? (
                    <button
                        type="button"
                        onClick={() => disconnect.mutate()}
                        disabled={disconnect.isPending}
                        className="flex-shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => connect.mutate()}
                        disabled={connect.isPending}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {connect.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                        Connect
                    </button>
                )}
            </div>
            {disconnect.isError && (
                <p className="mt-2 text-xs text-rose-600">Could not disconnect. Try again.</p>
            )}
        </div>
    );
};

export default GoogleCalendarConnect;
