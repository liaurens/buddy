import React from 'react';
import { useProtocols } from '../../hooks/useProtocols';
import type { Protocol } from '../../types';
import { Edit2, Trash2, Pill, Activity } from 'lucide-react';

interface ProtocolListProps {
    onEdit: (protocol: Protocol) => void;
}

const ProtocolList: React.FC<ProtocolListProps> = ({ onEdit }) => {
    const { protocols, deleteProtocol, logDose } = useProtocols();

    if (protocols.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-cove-tint-blue rounded-full flex items-center justify-center mx-auto mb-4">
                    <Pill size={32} className="text-cove-accent" />
                </div>
                <h3 className="text-lg font-bold text-cove-ink mb-2">No protocols yet</h3>
                <p className="text-cove-soft mb-6">
                    Track supplements, medications, or daily routines
                </p>
                <button
                    onClick={() => onEdit({} as Protocol)}
                    className="bg-cove-accent text-white px-6 py-3 rounded-xl font-bold hover:bg-[#3a8dc7] transition-colors inline-flex items-center gap-2"
                >
                    <Pill size={20} />
                    Create Your First Protocol
                </button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((protocol) => (
                <div
                    key={protocol.id}
                    className={`p-4 rounded-xl border ${protocol.active ? 'bg-white border-cove-border shadow-cove' : 'bg-[color:var(--buddy-surface-soft)] border-cove-border opacity-75'}`}
                >
                    <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="p-2 bg-cove-tint-blue text-cove-accent rounded-xl shrink-0">
                                <Pill size={20} />
                            </span>
                            <div className="min-w-0">
                                <h3
                                    className="font-semibold text-cove-ink truncate"
                                    title={protocol.name}
                                >
                                    {protocol.name}
                                </h3>
                                <p className="text-xs text-cove-soft capitalize">
                                    {protocol.category}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button
                                onClick={() => onEdit(protocol)}
                                className="p-1.5 text-cove-faint hover:text-cove-accent hover:bg-cove-tint-blue rounded transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            'Delete this protocol? associated logs will remain.',
                                        )
                                    ) {
                                        deleteProtocol(protocol.id);
                                    }
                                }}
                                className="p-1.5 text-cove-faint hover:text-cove-danger-deep hover:bg-cove-tint-danger rounded transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                        {protocol.category === 'practice' ? (
                            <div className="flex flex-col">
                                <span className="text-cove-soft text-xs">Type</span>
                                <span className="font-bold text-cove-muted">Practice</span>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                <span className="text-cove-soft text-xs">Dose</span>
                                <span className="font-bold text-cove-muted">
                                    {protocol.doseAmount} {protocol.doseUnit}
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col text-right">
                            <span className="text-cove-soft text-xs">Frequency</span>
                            <span className="font-bold text-cove-muted capitalize">
                                {protocol.frequency?.replace('_', ' ')}
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-cove-border flex flex-wrap items-center gap-2">
                        <span
                            className={`text-xs px-2 py-1 rounded-full ${protocol.active ? 'bg-cove-tint-green text-cove-success-deep' : 'bg-cove-track text-cove-muted'}`}
                        >
                            {protocol.active ? 'Active' : 'Inactive'}
                        </span>
                        {protocol.effectTiming && (
                            <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                    protocol.effectTiming === 'immediate'
                                        ? 'bg-cove-tint-amber text-cove-streak-text'
                                        : protocol.effectTiming === 'immediate_compounding'
                                          ? 'bg-cove-tint-blue text-cove-ink'
                                          : 'bg-cove-tint-purple text-cove-purple'
                                }`}
                            >
                                {protocol.effectTiming === 'immediate'
                                    ? 'Immediate'
                                    : protocol.effectTiming === 'immediate_compounding'
                                      ? 'Compounding'
                                      : 'Long Term'}
                            </span>
                        )}
                        <button
                            onClick={async () => {
                                await logDose(protocol.id);
                            }}
                            className="ml-auto text-xs text-cove-accent font-bold hover:text-cove-ink flex items-center gap-1 focus:outline-none active:text-cove-ink transition-colors"
                        >
                            <Activity size={14} />
                            {protocol.category === 'practice' ? 'Log Now' : 'Log Dose Now'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProtocolList;
