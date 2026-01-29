import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
  getCategorySettings,
  updateCategorySettings,
  resetCategorySettings,
  type PlanningSettings,
  type AISettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface PlanningSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CombinedSettings {
  planning: PlanningSettings;
  ai: AISettings;
}

const PlanningSettingsModal: React.FC<PlanningSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CombinedSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [planningData, aiData] = await Promise.all([
        getCategorySettings(user.id, 'planning'),
        getCategorySettings(user.id, 'ai'),
      ]);
      setSettings({
        planning: planningData,
        ai: aiData,
      });
    } catch (error) {
      console.error('Failed to load planning settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      await Promise.all([
        updateCategorySettings(user.id, 'planning', settings.planning),
        updateCategorySettings(user.id, 'ai', settings.ai),
      ]);
      onClose();
    } catch (error) {
      console.error('Failed to save planning settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Reset all planning and AI settings to defaults?')) return;
    setSaving(true);
    try {
      await Promise.all([
        resetCategorySettings(user.id, 'planning'),
        resetCategorySettings(user.id, 'ai'),
      ]);
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset planning settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updatePlaningSetting = <K extends keyof PlanningSettings>(
    key: K,
    value: PlanningSettings[K]
  ) => {
    if (settings) {
      setSettings({
        ...settings,
        planning: { ...settings.planning, [key]: value },
      });
    }
  };

  const updateAISetting = <K extends keyof AISettings>(
    key: K,
    value: AISettings[K]
  ) => {
    if (settings) {
      setSettings({
        ...settings,
        ai: { ...settings.ai, [key]: value },
      });
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
      <Modal isOpen={isOpen} onClose={onClose} title="Planning Settings">
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
      title="Planning Settings"
      footer={footer}
      size="lg"
    >
      <div className="space-y-6">
        {/* Planning Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Work Schedule
          </h3>
          <div className="space-y-4">
            {/* Work Start Time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Work Start Time
              </label>
              <input
                type="time"
                value={settings.planning.workStartTime}
                onChange={(e) =>
                  updatePlaningSetting('workStartTime', e.target.value)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Work End Time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Work End Time
              </label>
              <input
                type="time"
                value={settings.planning.workEndTime}
                onChange={(e) =>
                  updatePlaningSetting('workEndTime', e.target.value)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Break Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Break Preferences
          </h3>
          <div className="space-y-4">
            {/* Include Lunch Break */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Include Lunch Break
                </label>
                <p className="text-xs text-slate-500">
                  Add a lunch break to your daily plan
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.planning.includeLunchBreak}
                onChange={(e) =>
                  updatePlaningSetting('includeLunchBreak', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>

            {/* Lunch Duration */}
            {settings.planning.includeLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lunch Duration (minutes)
                </label>
                <input
                  type="number"
                  min="15"
                  max="180"
                  step="5"
                  value={settings.planning.lunchDuration}
                  onChange={(e) =>
                    updatePlaningSetting('lunchDuration', parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Lunch Start Time */}
            {settings.planning.includeLunchBreak && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lunch Start Time
                </label>
                <input
                  type="time"
                  value={settings.planning.lunchStartTime}
                  onChange={(e) =>
                    updatePlaningSetting('lunchStartTime', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Short Break Interval */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Short Break Interval (minutes)
              </label>
              <input
                type="number"
                min="30"
                max="180"
                step="5"
                value={settings.planning.shortBreakInterval}
                onChange={(e) =>
                  updatePlaningSetting(
                    'shortBreakInterval',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Short Break Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Short Break Duration (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="30"
                step="1"
                value={settings.planning.shortBreakDuration}
                onChange={(e) =>
                  updatePlaningSetting(
                    'shortBreakDuration',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Buffer Between Blocks */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Buffer Between Blocks (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                step="5"
                value={settings.planning.bufferBetweenBlocks}
                onChange={(e) =>
                  updatePlaningSetting(
                    'bufferBetweenBlocks',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* AI Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            AI Provider
          </h3>
          <div className="space-y-4">
            {/* AI Provider */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Provider
              </label>
              <select
                value={settings.ai.aiProvider}
                onChange={(e) =>
                  updateAISetting(
                    'aiProvider',
                    e.target.value as 'openai' | 'anthropic' | 'gemini'
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            {/* AI API Key */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                placeholder="Enter your API key"
                value={settings.ai.aiApiKey || ''}
                onChange={(e) =>
                  updateAISetting(
                    'aiApiKey',
                    e.target.value || null
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Your API key is stored securely
              </p>
            </div>

            {/* AI Model */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Model
              </label>
              <input
                type="text"
                placeholder="e.g., gpt-4, claude-3-sonnet, gemini-pro"
                value={settings.ai.aiModel || ''}
                onChange={(e) =>
                  updateAISetting('aiModel', e.target.value || null)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PlanningSettingsModal;
