import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Save } from 'lucide-react';
import { format } from 'date-fns';
import type { Experiment } from '../../../../types';
import { getExperimentLogs, addExperimentLog } from '../../../../services/supabase';
import { useTracker } from '../../../../context/TrackerContext';
import { useProtocol } from '../../../../context/ProtocolContext';

interface ExperimentDetailsProps {
    experiment: Experiment;
    onBack: () => void;
}

const ExperimentDetails: React.FC<ExperimentDetailsProps> = ({ experiment, onBack }) => {
    const queryClient = useQueryClient();
    const { trackers } = useTracker();
    const { protocols } = useProtocol();

    // Notes Form State
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [noteDate, setNoteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [noteContent, setNoteContent] = useState('');
    const [moodRating, setMoodRating] = useState<number | undefined>(undefined);

    // Fetch Logs
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['experiment_logs', experiment.id],
        queryFn: () => getExperimentLogs(experiment.id),
    });

    // Add Log Mutation
    const addLogMutation = useMutation({
        mutationFn: async () => {
            return await addExperimentLog({
                experimentId: experiment.id,
                date: noteDate,
                content: noteContent,
                moodRating,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment_logs', experiment.id] });
            setIsAddingNote(false);
            setNoteContent('');
            setMoodRating(undefined);
            setNoteDate(format(new Date(), 'yyyy-MM-dd'));
        },
    });

    const getVariableName = (id: string) => {
        const t = trackers.find(t => t.id === id);
        if (t) return t.name;
        const p = protocols.find(p => p.id === id);
        if (p) return p.name;
        return 'Unknown';
    };

    const independentNames = (experiment.independentIds || (experiment.tracker1Id ? [experiment.tracker1Id] : []))
        .map(getVariableName)
        .join(' + ');

    const dependentName = getVariableName(experiment.tracker2Id);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{experiment.name}</h2>
                    <p className="text-slate-500">
                        Testing effect of <span className="font-medium text-indigo-600">{independentNames}</span> on <span className="font-medium text-indigo-600">{dependentName}</span>
                    </p>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Content (Charts/Stats Placeholder + Logs) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Placeholder for Analysis/Chart */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-lg mb-4 text-slate-800">Quick Stats</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-2xl font-bold text-slate-700">{logs.length}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Logs</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-2xl font-bold text-slate-700">
                                    {Math.floor((new Date().getTime() - new Date(experiment.startDate).getTime()) / (1000 * 60 * 60 * 24))}
                                </div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Days Active</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-2xl font-bold text-slate-700">N/A</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Pearson R</div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Notes Section */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <CalendarIcon size={18} className="text-indigo-600" />
                                Daily Logs
                            </h3>
                            <button
                                onClick={() => setIsAddingNote(true)}
                                className="text-sm bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                                <Plus size={16} /> Add Note
                            </button>
                        </div>

                        {isAddingNote && (
                            <div className="p-4 border-b border-slate-100 bg-indigo-50/50">
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <input
                                            type="date"
                                            value={noteDate}
                                            onChange={e => setNoteDate(e.target.value)}
                                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                        />
                                        <select
                                            value={moodRating || ''}
                                            onChange={e => setMoodRating(e.target.value ? Number(e.target.value) : undefined)}
                                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                        >
                                            <option value="">Mood Rating (Optional)</option>
                                            {[1, 2, 3, 4, 5].map(r => (
                                                <option key={r} value={r}>{r} - {['Awful', 'Bad', 'Okay', 'Good', 'Great'][r - 1]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <textarea
                                        value={noteContent}
                                        onChange={e => setNoteContent(e.target.value)}
                                        placeholder="What did you notice today? Any side effects? improvements?"
                                        className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={3}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setIsAddingNote(false)}
                                            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => addLogMutation.mutate()}
                                            disabled={!noteContent.trim() || addLogMutation.isPending}
                                            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {addLogMutation.isPending ? 'Saving...' : <><Save size={14} /> Save Log</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-400">Loading logs...</div>
                            ) : logs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic">
                                    No logs yet. Record your daily observations!
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                {format(new Date(log.date), 'EEE, MMM d')}
                                            </span>
                                            {log.moodRating && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${log.moodRating >= 4 ? 'bg-green-100 text-green-700' :
                                                    log.moodRating <= 2 ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    Mood: {log.moodRating}/5
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-700 whitespace-pre-wrap text-sm">{log.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar (Details) */}
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider mb-4">Configuration</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Independent Variables</label>
                                <div className="flex flex-wrap gap-2">
                                    {(experiment.independentIds || (experiment.tracker1Id ? [experiment.tracker1Id] : [])).map(id => (
                                        <span key={id} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-sm border border-indigo-100">
                                            {getVariableName(id)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Dependent Variable</label>
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-sm border border-emerald-100">
                                    {dependentName}
                                </span>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                                <span className="text-slate-700 text-sm">{format(new Date(experiment.startDate), 'MMMM d, yyyy')}</span>
                            </div>

                            {experiment.description && (
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Description</label>
                                    <p className="text-slate-600 text-sm bg-slate-50 p-2 rounded-lg">{experiment.description}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExperimentDetails;
