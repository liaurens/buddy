import React from 'react';
import { useProtocol } from '../../context/ProtocolContext';
import type { Protocol } from '../../types';
import { Edit2, Trash2, Pill, Activity } from 'lucide-react';

interface ProtocolListProps {
    onEdit: (protocol: Protocol) => void;
}

const ProtocolList: React.FC<ProtocolListProps> = ({ onEdit }) => {
    const { protocols, deleteProtocol, logDose } = useProtocol();

    if (protocols.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Pill size={48} className="mx-auto mb-3 text-slate-300" />
                <p>No protocols defined.</p>
                <p className="text-sm">Add supplements or medications you are taking.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map(protocol => (
                <div key={protocol.id} className={`p-4 rounded-xl border ${protocol.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-75'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Pill size={20} />
                            </span>
                            <div>
                                <h3 className="font-semibold text-slate-800">{protocol.name}</h3>
                                <p className="text-xs text-slate-500 capitalize">{protocol.category}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onEdit(protocol)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm('Delete this protocol? associated logs will remain.')) {
                                        deleteProtocol(protocol.id);
                                    }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-xs">Dose</span>
                            <span className="font-medium text-slate-700">{protocol.doseAmount} {protocol.doseUnit}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-slate-500 text-xs">Frequency</span>
                            <span className="font-medium text-slate-700 capitalize">{protocol.frequency}</span>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${protocol.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {protocol.active ? 'Active' : 'Inactive'}
                        </span>

                        {/* Future: Log Dose Button */}
                        <button
                            onClick={async () => {
                                await logDose(protocol.id);
                                // Optional: Add visual feedback toast here
                            }}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1 focus:outline-none active:text-indigo-900 transition-colors"
                        >
                            <Activity size={14} />
                            Log Dose Now
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProtocolList;
