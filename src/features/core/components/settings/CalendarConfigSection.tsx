import React, { useState, useEffect } from 'react';
import { Calendar, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { getSetting, setSetting } from '../../../../services/supabase';
import { fetchICalFeed, saveCalendarEventsToDatabase } from '../../../planning/services/calendar.service';

interface CalendarConfigSectionProps {
    userId?: string;
}

export const CalendarConfigSection: React.FC<CalendarConfigSectionProps> = ({ userId }) => {
    const [calendarUrl, setCalendarUrl] = useState('');
    const [calendarName, setCalendarName] = useState('');
    const [isSavingCalendar, setIsSavingCalendar] = useState(false);
    const [isTestingCalendar, setIsTestingCalendar] = useState(false);
    const [calendarTestResult, setCalendarTestResult] = useState<{ success: boolean; message: string; eventCount?: number } | null>(null);
    const [lastCalendarSync, setLastCalendarSync] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            Promise.all([
                getSetting(userId, 'calendar_url'),
                getSetting(userId, 'calendar_name'),
                getSetting(userId, 'calendar_last_sync'),
            ]).then(([url, name, lastSync]) => {
                if (url) setCalendarUrl(url);
                if (name) setCalendarName(name);
                if (lastSync) setLastCalendarSync(lastSync);
            });
        }
    }, [userId]);

    const handleSaveCalendarConfig = async () => {
        if (!userId || !calendarUrl.trim()) {
            alert('Please enter a calendar URL');
            return;
        }

        setIsSavingCalendar(true);
        setCalendarTestResult(null);

        try {
            await Promise.all([
                setSetting(userId, 'calendar_url', calendarUrl.trim()),
                setSetting(userId, 'calendar_name', calendarName.trim() || 'My Calendar'),
            ]);

            alert('Calendar configuration saved successfully!');
        } catch (error) {
            console.error('Failed to save calendar config:', error);
            alert('Failed to save calendar configuration');
        } finally {
            setIsSavingCalendar(false);
        }
    };

    const handleTestCalendarSync = async () => {
        if (!calendarUrl.trim()) {
            alert('Please enter a calendar URL first');
            return;
        }

        if (!userId) {
            alert('User not authenticated');
            return;
        }

        setIsTestingCalendar(true);
        setCalendarTestResult(null);

        try {
            const result = await fetchICalFeed(calendarUrl.trim());

            if (result.success) {
                const saveResult = await saveCalendarEventsToDatabase(
                    userId,
                    result.events,
                    'ical'
                );

                if (saveResult.success) {
                    await Promise.all([
                        setSetting(userId, 'calendar_last_sync', result.syncedAt),
                        setSetting(userId, 'calendar_url', calendarUrl.trim()),
                        setSetting(userId, 'calendar_name', calendarName.trim() || 'My Calendar'),
                    ]);
                    setLastCalendarSync(result.syncedAt);

                    setCalendarTestResult({
                        success: true,
                        message: `Successfully synced and saved ${saveResult.savedCount} event${saveResult.savedCount !== 1 ? 's' : ''} to database!`,
                        eventCount: saveResult.savedCount,
                    });
                } else {
                    setCalendarTestResult({
                        success: false,
                        message: `Fetched ${result.events.length} events but failed to save to database: ${saveResult.error}`,
                    });
                }
            } else {
                setCalendarTestResult({
                    success: false,
                    message: `Sync failed: ${result.error || 'Unknown error'}`,
                });
            }
        } catch (error: any) {
            setCalendarTestResult({
                success: false,
                message: `Sync failed: ${error.message || 'Unknown error'}`,
            });
        } finally {
            setIsTestingCalendar(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <Calendar className="text-purple-600" size={24} />
                <h2 className="text-xl font-semibold text-slate-800">Calendar Integration</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
                Connect your iPhone calendar or Google Calendar to automatically import events into your daily plan.
            </p>

            <div className="space-y-4">
                {/* Calendar Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Calendar Name
                        <span className="text-xs text-slate-500 ml-2">(Optional)</span>
                    </label>
                    <input
                        type="text"
                        value={calendarName}
                        onChange={(e) => setCalendarName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="My Calendar"
                    />
                </div>

                {/* iCal URL */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        iCal/Webcal URL
                        <span className="text-xs text-slate-500 ml-2">
                            (Get from iPhone Calendar → Settings → Accounts)
                        </span>
                    </label>
                    <input
                        type="url"
                        value={calendarUrl}
                        onChange={(e) => setCalendarUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                        placeholder="https://calendar.google.com/calendar/ical/..."
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Supports: Apple iCloud Calendar, Google Calendar public links
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveCalendarConfig}
                        disabled={isSavingCalendar || !calendarUrl.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isSavingCalendar ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Configuration
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleTestCalendarSync}
                        disabled={isTestingCalendar || !calendarUrl.trim()}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isTestingCalendar ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Testing...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={16} />
                                Test Sync
                            </>
                        )}
                    </button>
                </div>

                {/* Last Sync Info */}
                {lastCalendarSync && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-600">
                            <strong>Last synced:</strong> {new Date(lastCalendarSync).toLocaleString()}
                        </p>
                    </div>
                )}

                {/* Sync Test Result */}
                {calendarTestResult && (
                    <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                        calendarTestResult.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                    }`}>
                        <AlertCircle
                            size={16}
                            className={calendarTestResult.success ? 'text-green-600 mt-0.5' : 'text-red-600 mt-0.5'}
                        />
                        <div className="flex-1">
                            <p className={`text-sm ${
                                calendarTestResult.success ? 'text-green-800' : 'text-red-800'
                            }`}>
                                {calendarTestResult.message}
                            </p>
                            {calendarTestResult.success && calendarTestResult.eventCount !== undefined && (
                                <p className="text-xs text-green-700 mt-1">
                                    Events in the next 7 days: {calendarTestResult.eventCount}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
