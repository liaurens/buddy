import React from 'react';
import { useTracker } from '../../context/TrackerContext';
import { useExperiment } from '../../context/ExperimentContext';
import { useProtocol } from '../../context/ProtocolContext';
import type { Experiment } from '../../types';
import { FlaskConical, ArrowRight, TrendingUp, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ExperimentListProps {
    onRunAnalysis: (experiment: Experiment) => void;
    onViewDetails: (experiment: Experiment) => void;
}

const ExperimentList: React.FC<ExperimentListProps> = ({ onRunAnalysis, onViewDetails }) => {
    const { trackers } = useTracker();
    const { experiments, deleteExperiment } = useExperiment();

    // Safely attempt to get protocols, defaulting to empty if context is missing/error
    let protocols: any[] = [];
    try {
        const protocolCtx = useProtocol();
        protocols = protocolCtx.protocols;
    } catch (e) {
        // useProtocol might throw if used outside provider
    }

    const getVariableInfo = (id: string) => {
        const t = trackers.find(x => x.id === id);
        if (t) return { name: t.name, emoji: t.emoji, type: 'Tracker' };

        const p = protocols.find(x => x.id === id);
        if (p) return { name: p.name, emoji: '💊', type: 'Protocol' };

        return { name: 'Unknown', emoji: '❓', type: 'Unknown' };
    };

    if (experiments.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FlaskConical size={48} className="mx-auto mb-3 text-slate-300" />
                <p>No active experiments.</p>
                <p className="text-sm">Start a new experiment to test a hypothesis!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {experiments.map(ex => {
                const independentIds = ex.independentIds || (ex.tracker1Id ? [ex.tracker1Id] : []);
                const independentVars = independentIds.map(id => getVariableInfo(id));
                const dependentVar = getVariableInfo(ex.tracker2Id);

                const startDate = new Date(ex.startDate);
                const daysActive = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                    <div key={ex.id} className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        {/* Active Status Strip */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                        <div className="flex justify-between items-start mb-4 pl-2">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <FlaskConical size={20} className="text-indigo-600" />
                                    {ex.name}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        Active
                                    </span>
                                    <span>Started {formatDistanceToNow(startDate, { addSuffix: true })}</span>
                                    <span>•</span>
                                    <span>{daysActive} days data</span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this experiment? Data will be preserved but the experiment definition will be removed.')) {
                                        deleteExperiment(ex.id);
                                    }
                                }}
                                className="text-slate-300 hover:text-rose-500 p-2 transition-colors"
                                title="Delete Experiment"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        {/* Visual Flow: Input -> Output */}
                        <div className="flex items-center gap-3 mb-5 px-2 cursor-pointer" onClick={() => onViewDetails(ex)}>
                            <div className="flex-1 bg-slate-50 p-3 rounded-lg text-center border border-slate-100 flex flex-col items-center justify-center gap-2">
                                {independentVars.map((v, i) => (
                                    <div key={i} className="flex items-center gap-2 w-full justify-center">
                                        <span className="text-xl">{v.emoji}</span>
                                        <span className="text-sm font-medium text-slate-700 truncate max-w-[100px]">{v.name}</span>
                                        {i < independentVars.length - 1 && <span className="text-slate-300 mx-1">+</span>}
                                    </div>
                                ))}
                                <span className="text-xs text-slate-400 mt-1">Independent Variables</span>
                            </div>

                            <ArrowRight size={20} className="text-slate-300 shrink-0" />

                            <div className="flex-1 bg-slate-50 p-3 rounded-lg text-center border border-slate-100 flex flex-col items-center justify-center h-full">
                                <span className="text-xl block mb-1">{dependentVar.emoji}</span>
                                <span className="text-sm font-medium text-slate-700 block truncate">{dependentVar.name}</span>
                                <span className="text-xs text-slate-400">Outcome</span>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-50">
                            <button
                                onClick={() => onRunAnalysis(ex)}
                                className="flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 active:scale-95"
                            >
                                <TrendingUp size={16} />
                                Analyze Results
                            </button>
                            <button
                                onClick={() => onViewDetails(ex)}
                                className="ml-2 flex items-center gap-2 text-sm font-medium text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
                            >
                                Details & Notes
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ExperimentList;
