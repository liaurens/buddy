import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  getCategorySettings,
  updateCategorySettings,
  resetCategorySettings,
  type ToolboxSettings,
} from '../../../services/settings';
import Modal from '../../../components/ui/Modal';

interface ToolboxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ToolboxSettingsModal: React.FC<ToolboxSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ToolboxSettings | null>(null);
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
      const data = await getCategorySettings(user.id, 'toolbox');
      setSettings(data);
    } catch (error) {
      console.error('Failed to load toolbox settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      await updateCategorySettings(user.id, 'toolbox', settings);
      onClose();
    } catch (error) {
      console.error('Failed to save toolbox settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Reset all toolbox settings to defaults?')) return;
    setSaving(true);
    try {
      await resetCategorySettings(user.id, 'toolbox');
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset toolbox settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ToolboxSettings>(
    key: K,
    value: ToolboxSettings[K]
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
      <Modal isOpen={isOpen} onClose={onClose} title="Toolbox Settings">
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
      title="Toolbox Settings"
      footer={footer}
      size="lg"
    >
      <div className="space-y-6">
        {/* Display Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
          <div className="space-y-4">
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
                    e.target.value as 'effectiveness' | 'recent' | 'alpha'
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="effectiveness">Effectiveness (Rating)</option>
                <option value="recent">Recently Used</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </div>

            {/* Show Effectiveness Score */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Show Effectiveness Score
                </label>
                <p className="text-xs text-slate-500">
                  Display average rating for each strategy
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.showEffectivenessScore}
                onChange={(e) =>
                  updateSetting('showEffectivenessScore', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Insights Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Insights</h3>
          <div className="space-y-4">
            {/* Minimum Usage for Insights */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Uses for Insights
              </label>
              <input
                type="number"
                value={settings.minimumUsageForInsights}
                onChange={(e) =>
                  updateSetting('minimumUsageForInsights', parseInt(e.target.value) || 1)
                }
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Minimum times a strategy must be used before showing effectiveness trends
              </p>
            </div>
          </div>
        </div>

        {/* Archive Settings */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Archive</h3>
          <div className="space-y-4">
            {/* Archive Old Strategies */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Auto-Archive Unused Strategies
                </label>
                <p className="text-xs text-slate-500">
                  Automatically hide strategies not used in 90 days
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.archiveOldStrategies}
                onChange={(e) =>
                  updateSetting('archiveOldStrategies', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Favorites Note */}
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Favorite strategies are managed directly from the strategy cards.
            Click the star icon on any strategy to add it to your favorites.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ToolboxSettingsModal;
