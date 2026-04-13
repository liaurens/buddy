import React, { useMemo } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import type { ExperimentMetric, ExperimentCheckinEntry, ExperimentPhase } from '../../types';
import { format, parseISO } from 'date-fns';

interface ExperimentAnalysisPanelProps {
    metrics: ExperimentMetric[];
    checkins: ExperimentCheckinEntry[];
    phases: ExperimentPhase[];
    onRunFullAnalysis?: () => void;
}

const ExperimentAnalysisPanel: React.FC<ExperimentAnalysisPanelProps> = ({
    metrics, checkins, phases, onRunFullAnalysis,
}) => {
    // Group checkins by date for summary stats
    const stats = useMemo(() => {
        const byDate = new Map<string, ExperimentCheckinEntry[]>();
        checkins.forEach(c => {
            const entries = byDate.get(c.date) || [];
            entries.push(c);
            byDate.set(c.date, entries);
        });

        const totalDays = byDate.size;
        const numericMetrics = metrics.filter(m => m.type === 'rating' || m.type === 'number');

        const metricStats = numericMetrics.map(metric => {
            const metricEntries = checkins.filter(c => c.metricId === metric.id && c.value !== undefined);
            const values = metricEntries.map(c => c.value!);
            if (values.length === 0) return { metric, avg: 0, min: 0, max: 0, count: 0, trend: [] as { date: string; value: number }[] };

            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            // Build trend (last 14 entries)
            const sorted = metricEntries.sort((a, b) => a.date.localeCompare(b.date));
            const trend = sorted.slice(-14).map(e => ({ date: e.date, value: e.value! }));

            return { metric, avg, min, max, count: values.length, trend };
        });

        // Phase comparison
        const phaseComparison = phases.length > 1 ? numericMetrics.map(metric => {
            const phaseAvgs = phases.map(phase => {
                const phaseEntries = checkins.filter(c =>
                    c.metricId === metric.id && c.phaseId === phase.id && c.value !== undefined
                );
                const values = phaseEntries.map(c => c.value!);
                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
                return { phase, avg, count: values.length };
            });
            return { metric, phaseAvgs };
        }) : [];

        return { totalDays, metricStats, phaseComparison };
    }, [metrics, checkins, phases]);

    if (checkins.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">No data yet</p>
                <p className="text-sm mt-1">Start checking in to see analysis</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-slate-800">{stats.totalDays}</div>
                    <div className="text-xs text-slate-500">Days Tracked</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-slate-800">{checkins.length}</div>
                    <div className="text-xs text-slate-500">Data Points</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-slate-800">{phases.length || 1}</div>
                    <div className="text-xs text-slate-500">Phases</div>
                </div>
            </div>

            {/* Metric Averages */}
            {stats.metricStats.filter(s => s.count > 0).map(({ metric, avg, min, max, count, trend }) => (
                <div key={metric.id} className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">
                            {metric.emoji} {metric.name}
                        </span>
                        <span className="text-xs text-slate-400">{count} entries</span>
                    </div>
                    <div className="flex items-baseline gap-4">
                        <div className="text-2xl font-bold text-indigo-600">{avg.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">
                            min {min} · max {max}
                            {metric.unit && ` ${metric.unit}`}
                        </div>
                    </div>

                    {/* Mini sparkline */}
                    {trend.length > 1 && (
                        <div className="flex items-end gap-0.5 h-8 mt-1">
                            {trend.map((point, i) => {
                                const range = max - min || 1;
                                const height = ((point.value - min) / range) * 100;
                                return (
                                    <div
                                        key={i}
                                        className="flex-1 bg-indigo-400 rounded-t opacity-70"
                                        style={{ height: `${Math.max(height, 8)}%` }}
                                        title={`${format(parseISO(point.date), 'MMM d')}: ${point.value}`}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}

            {/* Phase Comparison */}
            {stats.phaseComparison.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">Phase Comparison</h4>
                    {stats.phaseComparison.map(({ metric, phaseAvgs }) => (
                        <div key={metric.id} className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
                            <span className="text-sm font-medium text-slate-700">
                                {metric.emoji} {metric.name}
                            </span>
                            <div className="space-y-1.5">
                                {phaseAvgs.map(({ phase, avg }) => (
                                    <div key={phase.id} className="flex items-center gap-3">
                                        <span className="text-xs text-slate-500 w-24 truncate">{phase.name}</span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                                            {avg !== null && (
                                                <div
                                                    className="bg-indigo-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${((avg - (metric.min || 0)) / ((metric.max || 10) - (metric.min || 0))) * 100}%` }}
                                                />
                                            )}
                                        </div>
                                        <span className="text-xs font-medium text-slate-700 w-12 text-right">
                                            {avg !== null ? avg.toFixed(1) : 'N/A'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Full Analysis Link */}
            {onRunFullAnalysis && (
                <button
                    onClick={onRunFullAnalysis}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                    <ExternalLink size={16} /> Run Full Correlation Analysis
                </button>
            )}
        </div>
    );
};

export default ExperimentAnalysisPanel;
