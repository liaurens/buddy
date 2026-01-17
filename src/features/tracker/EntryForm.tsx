import React, { useState, useMemo } from 'react';
import { useTracker } from '../../context/TrackerContext';
import { Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const EntryForm: React.FC = () => {
    const { addEntry, trackers } = useTracker();
    const [selectedTrackerId, setSelectedTrackerId] = useState<string>(trackers[0]?.id || '');
    const [value, setValue] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

    // Group trackers
    const groupedTrackers = useMemo(() => {
        const groups: Record<string, typeof trackers> = {};
        trackers.forEach(t => {
            const group = t.group || 'Other';
            if (!groups[group]) groups[group] = [];
            groups[group].push(t);
        });
        return groups;
    }, [trackers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value || !selectedTracker) return;

        // Combine date with current time for timestamp
        const now = new Date();
        const timestamp = new Date(`${date}T${format(now, 'HH:mm:ss')}`).toISOString();

        await addEntry({
            trackerId: selectedTracker.id,
            value: parseFloat(value),
            notes,
            timestamp,
        });

        setValue('');
        setNotes('');
        // Keep date as is or reset? Usually keep for batch entry.
    };

    if (trackers.length === 0) {
        return <div className="p-6 text-center text-slate-500">No trackers defined. Go to Settings to create one.</div>;
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">Add Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Date Selection */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>
                </div>

                {/* Tracker Selection */}
                <div className="space-y-3">
                    {Object.entries(groupedTrackers).map(([group, groupTrackers]) => (
                        <div key={group}>
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group}</h3>
                            <div className="flex flex-wrap gap-2">
                                {groupTrackers.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTrackerId(t.id);
                                            setValue(''); // Reset value on switch
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${selectedTrackerId === t.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span>{t.emoji}</span>
                                        <span className="text-sm font-medium">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {selectedTracker && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {selectedTracker.name} ({selectedTracker.unit || 'Value'})
                            </label>

                            {selectedTracker.type === 'rating' ? (
                                <div className="flex justify-between gap-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => setValue(num.toString())}
                                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${value === num.toString()
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            ) : selectedTracker.type === 'boolean' ? (
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setValue('1')}
                                        className={`flex-1 py-2 rounded-md font-medium ${value === '1' ? 'bg-emerald-500 text-white' : 'bg-slate-100'}`}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setValue('0')}
                                        className={`flex-1 py-2 rounded-md font-medium ${value === '0' ? 'bg-rose-500 text-white' : 'bg-slate-100'}`}
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="number"
                                    step="0.1"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                    placeholder={`Enter ${selectedTracker.name.toLowerCase()}...`}
                                    required
                                    autoFocus
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Notes (Optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                placeholder="Any details..."
                                rows={2}
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full mt-4 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Add Entry
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default EntryForm;
