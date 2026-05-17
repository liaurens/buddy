import { useState } from 'react';
import ProtocolList from '../components/protocols/ProtocolList';
import ProtocolForm from '../components/protocols/ProtocolForm';
import ProtocolSettingsModal from '../components/protocols/ProtocolSettingsModal';
import type { Protocol } from '../../../types';
import { Plus, Settings } from 'lucide-react';

const ProtocolsPage = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const handleEdit = (protocol: Protocol) => {
        setEditingProtocol(protocol);
        setIsFormOpen(true);
    };

    const handleClose = () => {
        setIsFormOpen(false);
        setEditingProtocol(null);
    };

    return (
        <div className="app-page">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="app-title">Protocols</h1>
                    <p className="app-subtitle">Manage your supplements, medications, and routines.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Protocol Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="app-primary-button"
                    >
                        <Plus size={20} />
                        Add Protocol
                    </button>
                </div>
            </div>

            <ProtocolList onEdit={handleEdit} />

            {isFormOpen && (
                <ProtocolForm
                    onClose={handleClose}
                    editingProtocol={editingProtocol}
                />
            )}

            {/* Settings Modal */}
            <ProtocolSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
};

export default ProtocolsPage;
