import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
  getCategorySettings,
  updateCategorySettings,
  resetCategorySettings,
  type PlanningSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface PlannerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTIVITY_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: 'routine', label: 'Routine', emoji: '🔁' },
  { value: 'chore', label: 'Chore', emoji: '🧹' },
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'leisure', label: 'Leisure', emoji: '🎨' },
  { value: 'transit', label: 'Transit', emoji: '🚗' },
  { value: 'meal', label: 'Meal', emoji: '🍽️' },
  { value: 'other', label: 'Other', emoji: '•' },
];

const PlannerSettingsModal: React.FC<PlannerSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlanningSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getCategorySettings(user.id, 'planning');
      setSettings(data);
    } catch (error) {
      console.error('Failed to load planner settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) void loadSettings();
  }, [isOpen, user]);

  const toggleCategory = (value: string) => {
    if (!settings) return;
    const set = new Set(settings.activityCategories ?? ['health']);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    setSettings({ ...settings, activityCategories: Array.from(set) });
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    if (!settings.activityCategories || settings.activityCategories.length === 0) {
      alert('Pick at least one activity category.');
      return;
    }
    setSaving(true);
    try {
      await updateCategorySettings(user.id, 'planning', {
        activityCategories: settings.activityCategories,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save planner settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm('Reset planner settings to defaults?')) return;
    setSaving(true);
    try {
      await resetCategorySettings(user.id, 'planning');
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset planner settings:', error);
    } finally {
      setSaving(false);
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
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
        disabled={saving || loading}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </>
  );

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Planner Settings">
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-500">Loading settings...</div>
        </div>
      </Modal>
    );
  }

  if (!settings) return null;

  const selected = new Set(settings.activityCategories ?? ['health']);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Planner Settings" footer={footer} size="lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Activity categories</h3>
          <p className="text-xs text-slate-500 mt-1">
            Which activity templates should appear in Step 1 of planning. Pick at least one.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ACTIVITY_CATEGORIES.map((c) => {
            const checked = selected.has(c.value);
            return (
              <label
                key={c.value}
                className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                  checked ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCategory(c.value)}
                  className="rounded"
                />
                <span className="text-lg">{c.emoji}</span>
                <span className="text-sm font-medium text-slate-800">{c.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default PlannerSettingsModal;
