import React, { useState } from 'react';
import { useProtocols } from '../../hooks/useProtocols';
import type { Protocol } from '../../../../types';
import { X, Save } from 'lucide-react';

interface ProtocolFormProps {
    onClose: () => void;
    editingProtocol?: Protocol | null;
}

const ProtocolForm: React.FC<ProtocolFormProps> = ({ onClose, editingProtocol }) => {
    const { addProtocol, updateProtocol } = useProtocols();

    const [name, setName] = useState(editingProtocol?.name || '');
    const [category, setCategory] = useState<Protocol['category']>(editingProtocol?.category || 'supplement');
    const [doseAmount, setDoseAmount] = useState(editingProtocol?.doseAmount?.toString() || '');
    const [doseUnit, setDoseUnit] = useState(editingProtocol?.doseUnit || 'mg');
    const [frequency, setFrequency] = useState(editingProtocol?.frequency || 'daily');
    const [effectTiming, setEffectTiming] = useState<Protocol['effectTiming']>(editingProtocol?.effectTiming);
    const [active, setActive] = useState(editingProtocol?.active ?? true);

    const isPractice = category === 'practice';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const protocolData = {
            name,
            category,
            doseAmount: isPractice ? undefined : parseFloat(doseAmount) || undefined,
            doseUnit: isPractice ? undefined : doseUnit || undefined,
            frequency,
            effectTiming,
            active,
        };

        if (editingProtocol) {
            await updateProtocol({ ...editingProtocol, ...protocolData });
        } else {
            await addProtocol(protocolData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800">
                        {editingProtocol ? 'Edit Protocol' : 'New Protocol'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Magnesium Glycinate"
                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value as any)}
                                className="w-full p-2 border border-slate-200 rounded-lg"
                            >
                                <option value="supplement">Supplement</option>
                                <option value="pharmaceutical">Pharmaceutical</option>
                                <option value="peptide">Peptide</option>
                                <option value="practice">Practice (Non-substance)</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg"
                            >
                                <option value="daily">Daily</option>
                                <option value="BID">Twice Daily</option>
                                <option value="EOD">Every Other Day</option>
                                <option value="weekly">Weekly</option>
                                <option value="as_needed">As Needed</option>
                            </select>
                        </div>
                    </div>

                    {!isPractice && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dose Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={doseAmount}
                                    onChange={e => setDoseAmount(e.target.value)}
                                    placeholder="200"
                                    className="w-full p-2 border border-slate-200 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                                <input
                                    type="text"
                                    value={doseUnit}
                                    onChange={e => setDoseUnit(e.target.value)}
                                    placeholder="mg"
                                    className="w-full p-2 border border-slate-200 rounded-lg"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Effect Timing</label>
                        <select
                            value={effectTiming || ''}
                            onChange={e => setEffectTiming(e.target.value as Protocol['effectTiming'] || undefined)}
                            className="w-full p-2 border border-slate-200 rounded-lg"
                        >
                            <option value="">Not specified</option>
                            <option value="immediate">Immediate (e.g., Adderall, caffeine)</option>
                            <option value="immediate_compounding">Immediate + Compounding (e.g., creatine)</option>
                            <option value="long_term">Long Term (e.g., Enclomiphene)</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={e => setActive(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <label className="text-sm text-slate-700">Active (Currently taking)</label>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        Save Protocol
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProtocolForm;
