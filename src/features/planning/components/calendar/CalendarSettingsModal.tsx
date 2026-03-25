import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { supabase } from '../../../../services/supabase';
import {
  getCategorySettings,
  updateCategorySettings,
  resetCategorySettings,
  type CalendarSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FRONTEND_URL = window.location.origin;

// Google Calendar color palette (colorId 1–11)
const GOOGLE_COLORS = [
  { id: 1,  name: 'Lavender',  hex: '#7986cb' },
  { id: 2,  name: 'Sage',      hex: '#33b679' },
  { id: 3,  name: 'Grape',     hex: '#8e24aa' },
  { id: 4,  name: 'Flamingo',  hex: '#e67c73' },
  { id: 5,  name: 'Banana',    hex: '#f6c026' },
  { id: 6,  name: 'Tangerine', hex: '#f5511d' },
  { id: 7,  name: 'Peacock',   hex: '#039be5' },
  { id: 8,  name: 'Graphite',  hex: '#616161' },
  { id: 9,  name: 'Blueberry', hex: '#3f51b5' },
  { id: 10, name: 'Basil',     hex: '#0b8043' },
  { id: 11, name: 'Tomato',    hex: '#d50000' },
];

interface CalendarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  // Handle Google OAuth callback result in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalParam = params.get('google_calendar');
    if (gcalParam === 'connected') {
      // Clean URL and reload settings to show new connection
      window.history.replaceState({}, '', window.location.pathname);
      if (isOpen) loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getCategorySettings(user.id, 'calendar');

      // Sync googleConnected from DB (check if token exists)
      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('email')
        .eq('user_id', user.id)
        .maybeSingle();

      setSettings({
        ...data,
        googleConnected: !!tokenRow,
        googleEmail: tokenRow?.email ?? data.googleEmail,
      });
    } catch (error) {
      console.error('Failed to load calendar settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      await updateCategorySettings(user.id, 'calendar', settings);
      onClose();
    } catch (error) {
      console.error('Failed to save calendar settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Reset all calendar settings to defaults?')) return;
    setSaving(true);
    try {
      await resetCategorySettings(user.id, 'calendar');
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset calendar settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    if (!user) return;

    // Get session JWT to pass as state (edge function verifies it to identify user)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    if (!clientId) {
      alert('VITE_GOOGLE_CLIENT_ID is not configured.');
      return;
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;

    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email');
    oauthUrl.searchParams.set('access_type', 'offline');
    oauthUrl.searchParams.set('prompt', 'consent'); // ensures refresh_token is returned
    oauthUrl.searchParams.set('state', session.access_token);

    window.location.href = oauthUrl.toString();
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;
    if (!confirm('Disconnect Google Calendar? Existing tasks will not be deleted.')) return;
    setDisconnecting(true);
    try {
      await supabase
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', user.id);
      setSettings(s => s ? { ...s, googleConnected: false, googleEmail: null } : s);
    } catch (error) {
      console.error('Failed to disconnect Google Calendar:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  const updateSetting = <K extends keyof CalendarSettings>(
    key: K,
    value: CalendarSettings[K]
  ) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const footer = (
    <>
      <button
        onClick={handleReset}
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        disabled={saving}
      >
        Reset to Defaults
      </button>
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        disabled={saving}
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
        disabled={saving || loading}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </>
  );

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Calendar Settings">
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-500">Loading settings...</div>
        </div>
      </Modal>
    );
  }

  if (!settings) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calendar Settings"
      footer={footer}
      size="lg"
    >
      <div className="space-y-6">

        {/* ── Google Calendar ───────────────────────────────────── */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Google Calendar
          </h3>

          {settings.googleConnected ? (
            <div className="space-y-4">
              {/* Connected status */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Connected</p>
                    {settings.googleEmail && (
                      <p className="text-xs text-green-600">{settings.googleEmail}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={disconnecting}
                  className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>

              {/* Auto-create tasks toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Auto-create tasks from important events
                  </label>
                  <p className="text-xs text-slate-500">
                    Runs daily at 7 AM, creates tasks for the next 7 days
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCreateTasksFromCalendar}
                  onChange={(e) => updateSetting('autoCreateTasksFromCalendar', e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>

              {/* Color picker */}
              {settings.autoCreateTasksFromCalendar && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Which color means "important"?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GOOGLE_COLORS.map((color) => (
                      <button
                        key={color.id}
                        title={color.name}
                        onClick={() => updateSetting('importantColorId', color.id)}
                        className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                          settings.importantColorId === color.id
                            ? 'border-slate-900 scale-110'
                            : 'border-transparent hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {settings.importantColorId === color.id && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Selected:{' '}
                    <span className="font-medium">
                      {GOOGLE_COLORS.find(c => c.id === settings.importantColorId)?.name ?? 'Tomato'}
                    </span>
                    {' '}— events with this color will become tasks
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Connect Google Calendar to automatically turn color-flagged events into tasks.
              </p>
              <button
                onClick={handleConnectGoogle}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google Calendar
              </button>
            </div>
          )}
        </div>

        {/* ── iCal Feed (fallback) ──────────────────────────────── */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            iCal Feed (optional)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Calendar URL
              </label>
              <input
                type="text"
                value={settings.calendarUrl || ''}
                onChange={(e) =>
                  updateSetting('calendarUrl', e.target.value || null)
                }
                placeholder="e.g., https://calendar.google.com/..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                iCal/CalDAV feed URL for read-only display (no task sync)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Calendar Name
              </label>
              <input
                type="text"
                value={settings.calendarName}
                onChange={(e) => updateSetting('calendarName', e.target.value)}
                placeholder="e.g., Work Calendar"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* ── Display Settings ──────────────────────────────────── */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Show in Planning
                </label>
                <p className="text-xs text-slate-500">
                  Display calendar events in planning view
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.showInPlanning}
                onChange={(e) => updateSetting('showInPlanning', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Include All-Day Events
                </label>
                <p className="text-xs text-slate-500">
                  Show all-day events in calendar view
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.includeAllDayEvents}
                onChange={(e) => updateSetting('includeAllDayEvents', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Event Duration (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                step="5"
                value={settings.minEventDurationMinutes}
                onChange={(e) =>
                  updateSetting('minEventDurationMinutes', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Hide events shorter than this duration
              </p>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default CalendarSettingsModal;
