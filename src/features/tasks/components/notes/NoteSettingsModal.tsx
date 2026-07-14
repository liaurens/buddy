import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type NotesSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface NoteSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const NoteSettingsModal: React.FC<NoteSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<NotesSettings | null>(null);
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
            const data = await getCategorySettings(user.id, 'notes');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load notes settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'notes', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save notes settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all notes settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'notes');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset notes settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof NotesSettings>(key: K, value: NotesSettings[K]) => {
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
            <Modal isOpen={isOpen} onClose={onClose} title="Notes Settings">
                <div className="flex items-center justify-center py-8">
                    <div className="text-slate-500">Loading settings...</div>
                </div>
            </Modal>
        );
    }

    if (!settings) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Notes Settings" footer={footer} size="lg">
            <div className="space-y-6">
                {/* Organization Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Organization</h3>
                    <div className="space-y-4">
                        {/* Auto-Categorization */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Auto-Categorization
                                </label>
                                <p className="text-xs text-slate-500">
                                    Automatically categorize notes based on content
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.autoCategorizationEnabled}
                                onChange={(e) =>
                                    updateSetting('autoCategorizationEnabled', e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>

                        {/* Default Category */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Default Category
                            </label>
                            <input
                                type="text"
                                value={settings.defaultCategoryId || ''}
                                onChange={(e) =>
                                    updateSetting('defaultCategoryId', e.target.value || null)
                                }
                                placeholder="Leave empty for uncategorized"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">Category ID for new notes</p>
                        </div>

                        {/* Sort Order */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Sort Order
                            </label>
                            <select
                                value={settings.sortOrder}
                                onChange={(e) =>
                                    updateSetting(
                                        'sortOrder',
                                        e.target.value as 'newest' | 'oldest' | 'alpha',
                                    )
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="alpha">Alphabetical</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Display Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
                    <div className="space-y-4">
                        {/* Show Category Badges */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Show Category Badges
                                </label>
                                <p className="text-xs text-slate-500">
                                    Display category badges on note cards
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.showCategoryBadges}
                                onChange={(e) =>
                                    updateSetting('showCategoryBadges', e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Intelligence Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Intelligence</h3>
                    <div className="space-y-4">
                        {/* Smart Suggestions */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Enable Smart Suggestions
                                </label>
                                <p className="text-xs text-slate-500">
                                    Get AI-powered suggestions for note organization
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enableSmartSuggestions}
                                onChange={(e) =>
                                    updateSetting('enableSmartSuggestions', e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Maintenance Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Maintenance</h3>
                    <div className="space-y-4">
                        {/* Archive After Days */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Auto-Archive After (Days)
                            </label>
                            <input
                                type="number"
                                min="7"
                                max="365"
                                step="1"
                                value={settings.archiveAfterDays}
                                onChange={(e) =>
                                    updateSetting('archiveAfterDays', parseInt(e.target.value))
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Automatically archive old notes (0 to disable)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default NoteSettingsModal;
