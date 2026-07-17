import { useState } from 'react';
import ProtocolList from '../components/protocols/ProtocolList';
import ProtocolForm from '../components/protocols/ProtocolForm';
import ProtocolSettingsModal from '../components/protocols/ProtocolSettingsModal';
import type { Protocol } from '../types';
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
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">
                        Protocols
                    </div>
                    <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                        Your supplements, meds, and routines in one place.
                    </div>
                </div>
                <div className="mt-1.5 flex shrink-0 items-center gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Protocol Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button onClick={() => setIsFormOpen(true)} className="app-primary-button">
                        <Plus size={20} />
                        Add Protocol
                    </button>
                </div>
            </div>

            <ProtocolList onEdit={handleEdit} />

            {isFormOpen && <ProtocolForm onClose={handleClose} editingProtocol={editingProtocol} />}

            {/* Settings Modal */}
            <ProtocolSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};

export default ProtocolsPage;
