import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';

interface ChecklistSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChecklistSettingsModal: React.FC<ChecklistSettingsModalProps> = ({
    isOpen,
    onClose,
}) => {
    const [saving, setSaving] = useState(false);

    // MOCK Settings for now, would be hooked up to a settings service later
    const [settings, setSettings] = useState({
        defaultEmoji: '📝',
        hideCompleted: false,
        confirmReset: true,
    });

    const handleSave = () => {
        setSaving(true);
        // Simulate save
        setTimeout(() => {
            setSaving(false);
            onClose();
        }, 500);
    };

    const footer = (
        <>
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
                disabled={saving}
            >
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Checklist Settings"
            footer={footer}
        >
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">General</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Confirm Reset
                                </label>
                                <p className="text-xs text-slate-500">
                                    Ask for confirmation before resetting a checklist
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.confirmReset}
                                onChange={(e) => setSettings({ ...settings, confirmReset: e.target.checked })}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Hide Completed Items
                                </label>
                                <p className="text-xs text-slate-500">
                                    Automatically hide items when checked
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.hideCompleted}
                                onChange={(e) => setSettings({ ...settings, hideCompleted: e.target.checked })}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Data</h3>
                    <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <h4 className="text-sm font-medium text-red-800 mb-1">Danger Zone</h4>
                        <p className="text-xs text-red-600 mb-3">
                            These actions cannot be undone.
                        </p>
                        <button
                            className="text-xs bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 font-medium transition-colors"
                        >
                            Delete All Checklists
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ChecklistSettingsModal;
