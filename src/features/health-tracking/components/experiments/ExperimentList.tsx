import React, { useState } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useExperiments } from '../../hooks/useExperiments';
import { useProtocols } from '../../hooks/useProtocols';
import type { Experiment, ExperimentStatus } from '../../types';
import { FlaskConical, ArrowRight, TrendingUp, Trash2, CheckSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ExperimentListProps {
    onRunAnalysis: (experiment: Experiment) => void;
    onViewDetails: (experiment: Experiment) => void;
    onCreateNew?: () => void;
}

const STATUS_PILLS: Record<ExperimentStatus, { label: string; pill: string; strip: string }> = {
    active: {
        label: 'Active',
        pill: 'bg-cove-tint-green text-cove-success-deep border-cove-success',
        strip: 'bg-cove-accent',
    },
    paused: {
        label: 'Paused',
        pill: 'bg-cove-tint-amber text-cove-streak-text border-cove-streak',
        strip: 'bg-cove-streak',
    },
    completed: {
        label: 'Completed',
        pill: 'bg-cove-tint-blue text-cove-ink border-cove-accent-pale',
        strip: 'bg-cove-accent-pale',
    },
    archived: {
        label: 'Archived',
        pill: 'bg-[color:var(--buddy-surface-soft)] text-cove-muted border-cove-border',
        strip: 'bg-cove-track',
    },
};

const ExperimentList: React.FC<ExperimentListProps> = ({
    onRunAnalysis,
    onViewDetails,
    onCreateNew,
}) => {
    const { trackers } = useTrackers();
    const { experiments, deleteExperiment } = useExperiments();
    const { protocols } = useProtocols();

    const [filter, setFilter] = useState<ExperimentStatus | 'all'>('active');

    const filtered =
        filter === 'all' ? experiments : experiments.filter((e) => e.status === filter);

    const getVariableInfo = (id: string) => {
        const t = trackers.find((x) => x.id === id);
        if (t) return { name: t.name, emoji: t.emoji, type: 'Tracker' };
        const p = protocols.find((x) => x.id === id);
        if (p) return { name: p.name, emoji: '💊', type: 'Protocol' };
        return { name: 'Unknown', emoji: '❓', type: 'Unknown' };
    };

    if (experiments.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-cove-tint-blue rounded-full flex items-center justify-center mx-auto mb-4">
                    <FlaskConical size={32} className="text-cove-accent" />
                </div>
                <h3 className="text-lg font-bold text-cove-ink mb-2">No experiments yet</h3>
                <p className="text-cove-soft mb-6">
                    Test hypotheses and discover what affects your health and performance
                </p>
                {onCreateNew && (
                    <button
                        onClick={onCreateNew}
                        className="bg-cove-accent text-white px-6 py-3 rounded-xl font-bold hover:bg-[#3a8dc7] transition-colors inline-flex items-center gap-2"
                    >
                        <FlaskConical size={20} />
                        Start Your First Experiment
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Status filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(['all', 'active', 'paused', 'completed', 'archived'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                            filter === s
                                ? 'bg-cove-accent text-white'
                                : 'bg-[color:var(--buddy-surface-soft)] text-cove-muted hover:bg-cove-track'
                        }`}
                    >
                        {s === 'all' ? 'All' : STATUS_PILLS[s].label}
                        <span className="ml-1.5 opacity-75">
                            {s === 'all'
                                ? experiments.length
                                : experiments.filter((e) => e.status === s).length}
                        </span>
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-8 text-cove-faint text-sm">
                    No experiments in this category.
                </div>
            ) : (
                filtered.map((ex) => {
                    const independentIds =
                        ex.independentIds || (ex.tracker1Id ? [ex.tracker1Id] : []);
                    const independentVars = independentIds.map((id) => getVariableInfo(id));
                    const dependentVar = ex.tracker2Id ? getVariableInfo(ex.tracker2Id) : null;

                    const startDate = new Date(ex.startDate);
                    const daysActive = Math.floor(
                        (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    const statusInfo = STATUS_PILLS[ex.status] || STATUS_PILLS.active;
                    const hasVariables = independentVars.length > 0 && dependentVar;

                    return (
                        <div
                            key={ex.id}
                            className="bg-white p-5 rounded-xl border border-cove-border shadow-cove hover:shadow-cove transition-shadow relative overflow-hidden"
                        >
                            <div
                                className={`absolute top-0 left-0 w-1 h-full ${statusInfo.strip}`}
                            ></div>

                            <div className="flex justify-between items-start mb-3 pl-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg text-cove-ink flex items-center gap-2">
                                        <FlaskConical size={20} className="text-cove-accent" />
                                        <span className="truncate">{ex.name}</span>
                                    </h3>
                                    {ex.hypothesis && (
                                        <p className="text-sm text-cove-muted mt-0.5 line-clamp-1">
                                            {ex.hypothesis}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-cove-soft mt-1.5 flex-wrap">
                                        <span
                                            className={`px-2 py-0.5 rounded-full border ${statusInfo.pill}`}
                                        >
                                            {statusInfo.label}
                                        </span>
                                        <span>Day {daysActive}</span>
                                        <span>·</span>
                                        <span>
                                            Started{' '}
                                            {formatDistanceToNow(startDate, { addSuffix: true })}
                                        </span>
                                        {ex.customMetrics.length > 0 && (
                                            <>
                                                <span>·</span>
                                                <span>{ex.customMetrics.length} metrics</span>
                                            </>
                                        )}
                                        {ex.phases.length > 0 && (
                                            <>
                                                <span>·</span>
                                                <span>{ex.phases.length} phases</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                'Delete this experiment? Check-in data will be preserved but the experiment definition will be removed.',
                                            )
                                        ) {
                                            deleteExperiment(ex.id);
                                        }
                                    }}
                                    className="text-cove-faint hover:text-cove-danger p-2 transition-colors"
                                    title="Delete experiment"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Tags */}
                            {ex.tags.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap pl-2 mb-3">
                                    {ex.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="text-xs px-2 py-0.5 bg-[color:var(--buddy-surface-soft)] text-cove-muted rounded-full"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Variables flow (if linked) */}
                            {hasVariables && (
                                <div
                                    className="flex items-center gap-3 mb-4 px-2 cursor-pointer"
                                    onClick={() => onViewDetails(ex)}
                                >
                                    <div className="flex-1 bg-[color:var(--buddy-surface-soft)] p-2.5 rounded-xl text-center border border-cove-border flex flex-col items-center justify-center gap-1">
                                        {independentVars.slice(0, 3).map((v, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-1.5 w-full justify-center"
                                            >
                                                <span className="text-base">{v.emoji}</span>
                                                <span className="text-xs font-bold text-cove-muted truncate max-w-[100px]">
                                                    {v.name}
                                                </span>
                                                {i < independentVars.length - 1 && i < 2 && (
                                                    <span className="text-cove-faint">+</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <ArrowRight size={18} className="text-cove-faint shrink-0" />
                                    <div className="flex-1 bg-[color:var(--buddy-surface-soft)] p-2.5 rounded-xl text-center border border-cove-border">
                                        <span className="text-base block">
                                            {dependentVar.emoji}
                                        </span>
                                        <span className="text-xs font-bold text-cove-muted truncate block">
                                            {dependentVar.name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-3 border-t border-cove-border pl-2">
                                <button
                                    onClick={() => onViewDetails(ex)}
                                    className="flex items-center gap-1.5 text-sm font-bold text-white bg-cove-accent px-4 py-2 rounded-xl hover:bg-[#3a8dc7] transition-all"
                                >
                                    <CheckSquare size={16} />
                                    Check in
                                </button>
                                {hasVariables && (
                                    <button
                                        onClick={() => onRunAnalysis(ex)}
                                        className="flex items-center gap-1.5 text-sm font-bold text-cove-muted px-4 py-2 rounded-xl hover:bg-[color:var(--buddy-surface-soft)] transition-all border border-cove-border"
                                    >
                                        <TrendingUp size={16} />
                                        Analyze
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default ExperimentList;
