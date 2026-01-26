import { useState } from 'react';
import ProtocolList from '../../../features/protocols/ProtocolList';
import ProtocolForm from '../../../features/protocols/ProtocolForm';
import type { Protocol } from '../../../types';
import { Plus } from 'lucide-react';

const ProtocolsPage = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);

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
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Add Protocol
                </button>
            </div>

            <ProtocolList onEdit={handleEdit} />

            {isFormOpen && (
                <ProtocolForm
                    onClose={handleClose}
                    editingProtocol={editingProtocol}
                />
            )}
        </div>
    );
};

export default ProtocolsPage;
