import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
  getCategorySettings,
  updateCategorySettings,
  resetCategorySettings,
  type CheckInSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface CheckInSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CheckInSettingsModal: React.FC<CheckInSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CheckInSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getCategorySettings(user.id, 'checkIn');
      setSettings(data);
    } catch (error) {
      console.error('Failed to load check-in settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      await updateCategorySettings(user.id, 'checkIn', settings);
      onClose();
    } catch (error) {
      console.error('Failed to save check-in settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Reset all check-in settings to defaults?')) return;
    setSaving(true);
    try {
      await resetCategorySettings(user.id, 'checkIn');
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset check-in settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof CheckInSettings>(
    key: K,
    value: CheckInSettings[K]
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
      <Modal isOpen={isOpen} onClose={onClose} title="Check-In Settings">
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
      title="Check-In Settings"
      footer={footer}
      size="lg"
    >
      <div className="space-y-6">
        {/* Reminder Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Reminders</h3>
          <div className="space-y-4">
            {/* Daily Reminder Time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Daily Reminder Time
              </label>
              <input
                type="time"
                value={settings.dailyReminderTime}
                onChange={(e) =>
                  updateSetting('dailyReminderTime', e.target.value)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Enable Daily Reminder */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Enable Daily Reminder
                </label>
                <p className="text-xs text-slate-500">
                  Send daily notification for check-in
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableDailyReminder}
                onChange={(e) =>
                  updateSetting('enableDailyReminder', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
          <div className="space-y-4">
            {/* Show Recent Check-Ins */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Show Recent Check-Ins (count)
              </label>
              <input
                type="number"
                value={settings.showRecentCheckIns}
                onChange={(e) =>
                  updateSetting('showRecentCheckIns', parseInt(e.target.value) || 0)
                }
                min="1"
                max="30"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Number of recent check-ins to display
              </p>
            </div>

            {/* Completion Celebration */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Completion Celebration
                </label>
                <p className="text-xs text-slate-500">
                  Show celebration when check-in is complete
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.completionCelebration}
                onChange={(e) =>
                  updateSetting('completionCelebration', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Data Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Data</h3>
          <div className="space-y-4">
            {/* Required Fields */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Required Fields (Tracker IDs)
              </label>
              <textarea
                value={settings.requiredFields.join('\n')}
                onChange={(e) =>
                  updateSetting(
                    'requiredFields',
                    e.target.value.split('\n').filter(f => f.trim())
                  )
                }
                rows={3}
                placeholder="One tracker ID per line"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Tracker IDs that must have data for check-in to be complete
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CheckInSettingsModal;
