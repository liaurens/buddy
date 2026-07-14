import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type ExperimentSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface ExperimentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ExperimentSettingsModal: React.FC<ExperimentSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<ExperimentSettings | null>(null);
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
            const data = await getCategorySettings(user.id, 'experiment');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load experiment settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'experiment', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save experiment settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all experiment settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'experiment');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset experiment settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof ExperimentSettings>(
        key: K,
        value: ExperimentSettings[K],
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
            <Modal isOpen={isOpen} onClose={onClose} title="Experiment Settings">
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
            title="Experiment Settings"
            footer={footer}
            size="lg"
        >
            <div className="space-y-6">
                {/* Experiment Configuration */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Configuration</h3>
                    <div className="space-y-4">
                        {/* Default Duration Days */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Default Duration (days)
                            </label>
                            <input
                                type="number"
                                value={settings.defaultDurationDays}
                                onChange={(e) =>
                                    updateSetting(
                                        'defaultDurationDays',
                                        parseInt(e.target.value) || 0,
                                    )
                                }
                                min="1"
                                max="365"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Default experiment duration in days
                            </p>
                        </div>

                        {/* Minimum Data Points */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Minimum Data Points
                            </label>
                            <input
                                type="number"
                                value={settings.minDataPoints}
                                onChange={(e) =>
                                    updateSetting('minDataPoints', parseInt(e.target.value) || 0)
                                }
                                min="2"
                                max="1000"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Minimum data points required for analysis
                            </p>
                        </div>

                        {/* Correlation Threshold */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Correlation Threshold
                            </label>
                            <input
                                type="number"
                                value={settings.showCorrelationThreshold}
                                onChange={(e) =>
                                    updateSetting(
                                        'showCorrelationThreshold',
                                        parseFloat(e.target.value) || 0,
                                    )
                                }
                                min="0"
                                max="1"
                                step="0.01"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Minimum correlation to display (0.0 - 1.0)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Behavior Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Behavior</h3>
                    <div className="space-y-4">
                        {/* Auto Archive Completed */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Auto-Archive Completed
                                </label>
                                <p className="text-xs text-slate-500">
                                    Automatically archive completed experiments
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.autoArchiveCompleted}
                                onChange={(e) =>
                                    updateSetting('autoArchiveCompleted', e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ExperimentSettingsModal;
