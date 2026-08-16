import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';

interface ChecklistSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChecklistSettingsModal: React.FC<ChecklistSettingsModalProps> = ({ isOpen, onClose }) => {
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
                className="px-4 py-2 text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors"
                disabled={saving}
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-bold text-white bg-cove-accent hover:bg-[#3a8dc7] rounded-xl transition-colors disabled:opacity-50"
                disabled={saving}
            >
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Checklist Settings" footer={footer}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">General</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-cove-muted">
                                    Confirm Reset
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Ask for confirmation before resetting a checklist
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.confirmReset}
                                onChange={(e) =>
                                    setSettings({ ...settings, confirmReset: e.target.checked })
                                }
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-cove-muted">
                                    Hide Completed Items
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Automatically hide items when checked
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.hideCompleted}
                                onChange={(e) =>
                                    setSettings({ ...settings, hideCompleted: e.target.checked })
                                }
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-cove-border">
                    <h3 className="text-lg font-bold text-cove-ink mb-4">Data</h3>
                    <div className="p-4 bg-cove-tint-danger rounded-xl border border-cove-danger">
                        <h4 className="text-sm font-bold text-cove-danger-deep mb-1">
                            Danger Zone
                        </h4>
                        <p className="text-xs text-cove-danger-deep mb-3">
                            These actions cannot be undone.
                        </p>
                        <button className="text-xs bg-white border border-cove-danger text-cove-danger-deep px-3 py-2 rounded-xl hover:bg-cove-tint-danger font-bold transition-colors">
                            Delete All Checklists
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ChecklistSettingsModal;
