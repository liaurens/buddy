import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  getCategorySettings,
  updateCategorySettings,
  resetCategorySettings,
  type TaskSettings,
} from '../../../services/settings';
import Modal from '../../../components/ui/Modal';

interface TaskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TaskSettingsModal: React.FC<TaskSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TaskSettings | null>(null);
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
      const data = await getCategorySettings(user.id, 'task');
      setSettings(data);
    } catch (error) {
      console.error('Failed to load task settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      await updateCategorySettings(user.id, 'task', settings);
      onClose();
    } catch (error) {
      console.error('Failed to save task settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Reset all task settings to defaults?')) return;
    setSaving(true);
    try {
      await resetCategorySettings(user.id, 'task');
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset task settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof TaskSettings>(
    key: K,
    value: TaskSettings[K]
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
      <Modal isOpen={isOpen} onClose={onClose} title="Task Settings">
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
      title="Task Settings"
      footer={footer}
      size="lg"
    >
      <div className="space-y-6">
        {/* Default Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Defaults</h3>
          <div className="space-y-4">
            {/* Default Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Default Priority
              </label>
              <select
                value={settings.defaultPriority}
                onChange={(e) =>
                  updateSetting(
                    'defaultPriority',
                    e.target.value as 'low' | 'medium' | 'high'
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Default Sort Order */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Default Sort Order
              </label>
              <select
                value={settings.defaultSortOrder}
                onChange={(e) =>
                  updateSetting(
                    'defaultSortOrder',
                    e.target.value as 'priority' | 'dueDate' | 'created'
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
                <option value="created">Created Date</option>
              </select>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
          <div className="space-y-4">
            {/* Show Completed Count */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Show Completed Count
              </label>
              <input
                type="number"
                value={settings.showCompletedCount}
                onChange={(e) =>
                  updateSetting('showCompletedCount', parseInt(e.target.value) || 5)
                }
                min="5"
                max="50"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Number of completed tasks to show in list
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Notifications
          </h3>
          <div className="space-y-4">
            {/* Enable Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Enable Task Notifications
                </label>
                <p className="text-xs text-slate-500">
                  Send reminders for upcoming due dates
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) =>
                  updateSetting('enableNotifications', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>

            {/* Notification Timing */}
            {settings.enableNotifications && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notification Timing
                </label>
                <select
                  value={settings.notificationTiming}
                  onChange={(e) =>
                    updateSetting(
                      'notificationTiming',
                      e.target.value as 'atDue' | '15min' | '1hour' | '1day'
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="atDue">At due time</option>
                  <option value="15min">15 minutes before</option>
                  <option value="1hour">1 hour before</option>
                  <option value="1day">1 day before</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Archive Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Archive</h3>
          <div className="space-y-4">
            {/* Auto Archive After Days */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Auto-Archive Completed Tasks
              </label>
              <input
                type="number"
                value={settings.autoArchiveAfterDays}
                onChange={(e) =>
                  updateSetting('autoArchiveAfterDays', parseInt(e.target.value) || 7)
                }
                min="7"
                max="365"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Days after completion before auto-archiving
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TaskSettingsModal;
