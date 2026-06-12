import React, { useState, useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { format } from 'date-fns';
import { Trash2, Edit2, X, Check, Trophy, Pill } from 'lucide-react';
import type { Entry, Dose, TrackerDefinition } from '../../types';
import TrackerTrends from './TrackerTrends';

interface DashboardProps {
    onEditTracker?: (tracker: TrackerDefinition) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onEditTracker }) => {
    const { entries, deleteEntry, updateEntry, trackers } = useTrackers();
    const { doses, protocols, deleteDose } = useProtocols();

    // Edit state only for Entries (Trackers) for now
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [editNotes, setEditNotes] = useState<string>('');

    const startEditing = (entry: Entry) => {
        setEditingId(entry.id);
        setEditValue(entry.value.toString());
        setEditNotes(entry.notes || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditValue('');
        setEditNotes('');
    };

    const saveEdit = async (entry: Entry) => {
        await updateEntry({
            ...entry,
            value: parseFloat(editValue),
            notes: editNotes,
        });
        setEditingId(null);
    };

    // Unified History Item Type
    type HistoryItem =
        | { type: 'entry'; data: Entry; timestamp: Date }
        | { type: 'dose'; data: Dose; timestamp: Date; protocolName: string; doseInfo: string };

    const historyItems: HistoryItem[] = useMemo(() => {
        const items: HistoryItem[] = [];

        // 1. Process Attributes
        entries.forEach(e => {
            const t = trackers.find(tr => tr.id === e.trackerId);
            if (t) {
                items.push({
                    type: 'entry',
                    data: e,
                    timestamp: new Date(e.timestamp)
                });
            }
        });

        // 2. Process Doses
        if (doses) {
            doses.forEach(d => {
                if (!d.takenAt && !d.skipped) return; // Only show taken or explicitly skipped? For now taken.
                if (!d.takenAt) return;

                const p = protocols.find(pr => pr.id === d.protocolId);
                const name = p ? p.name : 'Unknown Protocol';
                const unit = p ? p.doseUnit : '';
                const amount = d.actualAmount !== undefined ? d.actualAmount : (p?.doseAmount || 0);

                items.push({
                    type: 'dose',
                    data: d,
                    timestamp: new Date(d.takenAt),
                    protocolName: name,
                    doseInfo: `${amount} ${unit}`
                });
            });
        }

        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [entries, doses, trackers, protocols]);

    // Group by Date
    const groupedItems = useMemo(() => {
        return historyItems.reduce((acc, item) => {
            const dateKey = format(item.timestamp, 'yyyy-MM-dd');
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(item);
            return acc;
        }, {} as Record<string, HistoryItem[]>);
    }, [historyItems]);


    const checkGoal = (value: number, goal: { target: number; condition: 'gt' | 'lt' | 'eq' }) => {
        if (goal.condition === 'gt') return value >= goal.target;
        if (goal.condition === 'lt') return value <= goal.target;
        return value === goal.target;
    };

    return (
        <div className="space-y-6">
            <TrackerTrends onEditTracker={onEditTracker} />

            <h2 className="text-xl font-bold text-slate-800 px-1">History & Trends</h2>

            {historyItems.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-100 border-dashed">
                    <p className="text-slate-500 mb-2">No data recorded yet.</p>
                    <p className="text-sm text-slate-400">Use the Daily Check-in to start tracking!</p>
                </div>
            ) : (
                Object.entries(groupedItems).sort((a, b) => b[0].localeCompare(a[0])).map(([date, dayItems]) => {
                    const isToday = date === format(new Date(), 'yyyy-MM-dd');
                    const isYesterday = date === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
                    const displayDate = isToday ? 'Today' : isYesterday ? 'Yesterday' : format(new Date(date), 'MMMM d, yyyy');

                    return (
                        <div key={date} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 sticky top-0 bg-slate-50/80 backdrop-blur-sm py-2 z-10 w-fit rounded-lg">
                                {displayDate}
                            </h3>
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                                {dayItems.map((item) => {

                                    // ------------------ TRACKER ENTRY ------------------
                                    if (item.type === 'entry') {
                                        const entry = item.data;
                                        const tracker = trackers.find(t => t.id === entry.trackerId);
                                        if (!tracker) return null;

                                        const isEditing = editingId === entry.id;
                                        const goalMet = tracker.goal ? checkGoal(entry.value, tracker.goal) : null;

                                        return (
                                            <div key={entry.id} className="group p-4 hover:bg-slate-50 transition-all relative">
                                                <div className="flex items-start gap-4">
                                                    <div className="text-2xl mt-0.5">{tracker.emoji}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-semibold text-slate-700 truncate">{tracker.name}</span>
                                                            {goalMet !== null && (
                                                                <span title={goalMet ? "Goal Met!" : "Goal Missed"} className={goalMet ? "text-amber-500" : "text-slate-300"}>
                                                                    <Trophy size={14} />
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-300 font-mono ml-auto">
                                                                {format(new Date(entry.timestamp), 'h:mm a')}
                                                            </span>
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="flex gap-2 items-center mt-2 animate-in zoom-in-95 origin-left">
                                                                <input
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                    autoFocus
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={editNotes}
                                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                                    className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                    placeholder="Add notes..."
                                                                />
                                                                <div className="flex gap-1 ml-2">
                                                                    <button onClick={() => saveEdit(entry)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors">
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button onClick={cancelEditing} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-between items-end">
                                                                <div>
                                                                    <p className="text-base font-medium text-slate-800">
                                                                        {tracker.type === 'boolean'
                                                                            ? (entry.value === 1 ? 'Yes' : 'No')
                                                                            : <>{entry.value} <span className="text-xs text-slate-400 font-normal">{tracker.unit}</span></>
                                                                        }
                                                                    </p>
                                                                    {entry.notes && (
                                                                        <p className="text-xs text-slate-500 mt-1 italic">"{entry.notes}"</p>
                                                                    )}
                                                                </div>

                                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/50 backdrop-blur-sm rounded-lg p-1">
                                                                    <button
                                                                        onClick={() => startEditing(entry)}
                                                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => await deleteEntry(entry.id)}
                                                                        className="text-slate-400 hover:text-rose-500 transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // ------------------ PROTOCOL DOSE ------------------
                                    else {
                                        const dose = item.data;
                                        return (
                                            <div key={dose.id} className="group p-4 hover:bg-slate-50 transition-all relative">
                                                <div className="flex items-start gap-4">
                                                    <div className="text-2xl mt-0.5 text-indigo-500"><Pill size={24} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-semibold text-slate-700 truncate">{item.protocolName}</span>
                                                            <span className="text-[10px] text-indigo-200 bg-indigo-50 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Protocol</span>
                                                            <span className="text-[10px] text-slate-300 font-mono ml-auto">
                                                                {format(item.timestamp, 'h:mm a')}
                                                            </span>
                                                        </div>

                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <p className="text-base font-medium text-slate-800">
                                                                    {item.doseInfo}
                                                                </p>
                                                                {/* Notes for doses not widely used yet, can add later */}
                                                            </div>

                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/50 backdrop-blur-sm rounded-lg p-1">
                                                                <button
                                                                    onClick={async () => {
                                                                        if (window.confirm('Remove this dose entry?')) {
                                                                            await deleteDose(dose.id);
                                                                        }
                                                                    }}
                                                                    className="text-slate-400 hover:text-rose-500 transition-colors"
                                                                    title="Delete Dose"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default Dashboard;
