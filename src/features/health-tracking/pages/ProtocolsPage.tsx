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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Protocols</h1>
                    <p className="text-slate-500">Manage your supplements, medications, and routines.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        aria-label="Protocol Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
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
