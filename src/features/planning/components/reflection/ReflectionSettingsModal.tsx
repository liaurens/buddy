import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type ReflectionSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface ReflectionSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReflectionSettingsModal: React.FC<ReflectionSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<ReflectionSettings | null>(null);
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
            const data = await getCategorySettings(user.id, 'reflection');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load reflection settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'reflection', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save reflection settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all reflection settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'reflection');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset reflection settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof ReflectionSettings>(
        key: K,
        value: ReflectionSettings[K],
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
            <Modal isOpen={isOpen} onClose={onClose} title="Reflection Settings">
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
            title="Reflection Settings"
            footer={footer}
            size="lg"
        >
            <div className="space-y-6">
                {/* Analysis Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Analysis Period</h3>
                    <div className="space-y-4">
                        {/* Lookback Period */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Lookback Period (days)
                            </label>
                            <select
                                value={settings.lookbackPeriodDays}
                                onChange={(e) =>
                                    updateSetting(
                                        'lookbackPeriodDays',
                                        parseInt(e.target.value) as 30 | 60 | 90,
                                    )
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="30">30 days (1 month)</option>
                                <option value="60">60 days (2 months)</option>
                                <option value="90">90 days (3 months)</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                How far back to analyze patterns
                            </p>
                        </div>
                    </div>
                </div>

                {/* Accuracy Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Accuracy Threshold</h3>
                    <div className="space-y-4">
                        {/* Accuracy Threshold */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Threshold (%)
                            </label>
                            <input
                                type="number"
                                min="5"
                                max="50"
                                step="1"
                                value={settings.accuracyThreshold}
                                onChange={(e) =>
                                    updateSetting('accuracyThreshold', parseInt(e.target.value))
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Consider tasks accurate within this percentage of estimated time
                            </p>
                        </div>
                    </div>
                </div>

                {/* Minimum Data */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">
                        Minimum Data Requirements
                    </h3>
                    <div className="space-y-4">
                        {/* Min Completed Blocks */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Minimum Completed Blocks
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={settings.minCompletedBlocks}
                                onChange={(e) =>
                                    updateSetting('minCompletedBlocks', parseInt(e.target.value))
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Minimum completed blocks required to show patterns
                            </p>
                        </div>
                    </div>
                </div>

                {/* Display Options */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Display Options</h3>
                    <div className="space-y-4">
                        {/* Show Patterns */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Show Learning Patterns
                                </label>
                                <p className="text-xs text-slate-500">
                                    Display insights and recommendations based on your data
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.showPatterns}
                                onChange={(e) => updateSetting('showPatterns', e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ReflectionSettingsModal;
