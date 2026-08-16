import React, { useMemo } from 'react';
import { BarChart3, ExternalLink, AlertTriangle } from 'lucide-react';
import type { ExperimentMetric, ExperimentCheckinEntry, ExperimentPhase } from '../../types';
import { format, parseISO } from 'date-fns';
import { welchTTest, cohensD, meanDiffCI, meanStd } from '../../utils/stats';

interface ExperimentAnalysisPanelProps {
    metrics: ExperimentMetric[];
    checkins: ExperimentCheckinEntry[];
    phases: ExperimentPhase[];
    onRunFullAnalysis?: () => void;
}

const MIN_N = 7;

const ExperimentAnalysisPanel: React.FC<ExperimentAnalysisPanelProps> = ({
    metrics,
    checkins,
    phases,
    onRunFullAnalysis,
}) => {
    const numericMetrics = useMemo(
        () => metrics.filter((m) => m.type === 'rating' || m.type === 'number'),
        [metrics],
    );

    const baselinePhase = useMemo(
        () => phases.find((p) => p.isBaseline) ?? (phases.length > 0 ? phases[0] : null),
        [phases],
    );
    const comparisonPhases = useMemo(
        () => phases.filter((p) => p.id !== baselinePhase?.id),
        [phases, baselinePhase],
    );

    const valuesFor = (metricId: string, phaseId: string): number[] =>
        checkins
            .filter(
                (c) => c.metricId === metricId && c.phaseId === phaseId && c.value !== undefined,
            )
            .map((c) => c.value!);

    const totalDays = useMemo(() => new Set(checkins.map((c) => c.date)).size, [checkins]);

    const overallStats = useMemo(() => {
        return numericMetrics.map((metric) => {
            const metricEntries = checkins
                .filter((c) => c.metricId === metric.id && c.value !== undefined)
                .sort((a, b) => a.date.localeCompare(b.date));
            const values = metricEntries.map((c) => c.value!);
            const { mean, std, n } = meanStd(values);
            const min = values.length > 0 ? Math.min(...values) : 0;
            const max = values.length > 0 ? Math.max(...values) : 0;
            const trend = metricEntries.slice(-14).map((e) => ({ date: e.date, value: e.value! }));
            return { metric, mean, std, n, min, max, trend };
        });
    }, [numericMetrics, checkins]);

    if (checkins.length === 0) {
        return (
            <div className="text-center py-12 text-cove-faint">
                <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
                <p className="font-bold">No data yet</p>
                <p className="text-sm mt-1">Start checking in to see analysis</p>
            </div>
        );
    }

    const canCompare = baselinePhase && comparisonPhases.length > 0;

    return (
        <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-cove-ink">{totalDays}</div>
                    <div className="text-xs text-cove-soft">Days Tracked</div>
                </div>
                <div className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-cove-ink">{checkins.length}</div>
                    <div className="text-xs text-cove-soft">Data Points</div>
                </div>
                <div className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-cove-ink">{phases.length || 1}</div>
                    <div className="text-xs text-cove-soft">Phases</div>
                </div>
            </div>

            {/* Per-metric averages + trend */}
            {overallStats
                .filter((s) => s.n > 0)
                .map(({ metric, mean, std, n, min, max, trend }) => (
                    <div
                        key={metric.id}
                        className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-4 space-y-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-cove-muted">
                                {metric.emoji} {metric.name}
                            </span>
                            <span className="text-xs text-cove-faint">{n} entries</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <div className="text-2xl font-bold text-cove-accent">
                                {mean.toFixed(1)}
                            </div>
                            <div className="text-xs text-cove-soft">
                                ± {std.toFixed(1)} · min {min} · max {max}
                                {metric.unit && ` ${metric.unit}`}
                            </div>
                        </div>

                        {trend.length > 1 && (
                            <div className="flex items-end gap-0.5 h-8 mt-1">
                                {trend.map((point, i) => {
                                    const range = max - min || 1;
                                    const height = ((point.value - min) / range) * 100;
                                    return (
                                        <div
                                            key={i}
                                            className="flex-1 bg-cove-accent rounded-t opacity-70"
                                            style={{ height: `${Math.max(height, 8)}%` }}
                                            title={`${format(parseISO(point.date), 'MMM d')}: ${point.value}`}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}

            {/* Baseline vs Intervention — statistical comparison */}
            {canCompare && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-cove-muted">
                        Baseline vs Intervention
                    </h4>
                    <p className="text-xs text-cove-soft">
                        Baseline: <span className="font-bold">{baselinePhase!.name}</span>. Welch's
                        t-test with 95% CI and Cohen's d.
                    </p>
                    {numericMetrics.map((metric) => {
                        const baseVals = valuesFor(metric.id, baselinePhase!.id);
                        const baseStats = meanStd(baseVals);
                        return (
                            <div
                                key={metric.id}
                                className="bg-white border border-cove-border rounded-xl p-4 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-cove-muted">
                                        {metric.emoji} {metric.name}
                                    </span>
                                    <span className="text-xs text-cove-faint">
                                        baseline {baseStats.mean.toFixed(1)} ±{' '}
                                        {baseStats.std.toFixed(1)} (n={baseStats.n})
                                    </span>
                                </div>

                                {comparisonPhases.map((phase) => {
                                    const intVals = valuesFor(metric.id, phase.id);
                                    const intStats = meanStd(intVals);
                                    const sparse = baseStats.n < MIN_N || intStats.n < MIN_N;
                                    const welch = welchTTest(baseVals, intVals);
                                    const d = cohensD(baseVals, intVals);
                                    const ci = meanDiffCI(baseVals, intVals);

                                    return (
                                        <div
                                            key={phase.id}
                                            className="border-t border-cove-border pt-3 space-y-1.5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-cove-muted">
                                                    vs {phase.name}
                                                </span>
                                                <span className="text-xs text-cove-faint">
                                                    {intStats.mean.toFixed(1)} ±{' '}
                                                    {intStats.std.toFixed(1)} (n={intStats.n})
                                                </span>
                                            </div>

                                            {sparse ? (
                                                <div className="flex items-start gap-2 text-xs text-cove-streak-text bg-cove-tint-amber border border-cove-streak rounded-xl px-2.5 py-1.5">
                                                    <AlertTriangle
                                                        size={14}
                                                        className="mt-0.5 flex-shrink-0"
                                                    />
                                                    <span>
                                                        Need at least {MIN_N} entries per phase for
                                                        reliable stats (baseline={baseStats.n},
                                                        intervention={intStats.n}).
                                                    </span>
                                                </div>
                                            ) : welch && d && ci ? (
                                                <div className="text-sm text-cove-muted leading-relaxed">
                                                    Δ = {ci.diff >= 0 ? '+' : ''}
                                                    {ci.diff.toFixed(2)}
                                                    {metric.unit && ` ${metric.unit}`},{' '}
                                                    <span className="text-cove-soft">
                                                        95% CI [{ci.low.toFixed(2)},{' '}
                                                        {ci.high.toFixed(2)}]
                                                    </span>
                                                    ,{' '}
                                                    <span
                                                        className={
                                                            welch.pTwoSided < 0.05
                                                                ? 'text-cove-success-deep font-bold'
                                                                : 'text-cove-muted'
                                                        }
                                                    >
                                                        p ={' '}
                                                        {welch.pTwoSided < 0.0001
                                                            ? '<0.0001'
                                                            : welch.pTwoSided.toFixed(4)}
                                                    </span>
                                                    , Cohen's d = {d.d.toFixed(2)}{' '}
                                                    <span className="text-cove-soft">
                                                        ({d.interpretation})
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-cove-soft italic">
                                                    Not enough variance to compute.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fallback: show phase averages when no baseline is defined */}
            {!canCompare && phases.length > 1 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-cove-muted">Phase Comparison</h4>
                    <p className="text-xs text-cove-soft">
                        Mark one phase as baseline in the wizard to unlock Welch's t, CI, and effect
                        size.
                    </p>
                    {numericMetrics.map((metric) => (
                        <div
                            key={metric.id}
                            className="bg-white border border-cove-border rounded-xl p-3 space-y-2"
                        >
                            <span className="text-sm font-bold text-cove-muted">
                                {metric.emoji} {metric.name}
                            </span>
                            <div className="space-y-1.5">
                                {phases.map((phase) => {
                                    const v = valuesFor(metric.id, phase.id);
                                    const { mean, n } = meanStd(v);
                                    return (
                                        <div key={phase.id} className="flex items-center gap-3">
                                            <span className="text-xs text-cove-soft w-24 truncate">
                                                {phase.name}
                                            </span>
                                            <div className="flex-1 bg-[color:var(--buddy-surface-soft)] rounded-full h-2">
                                                {n > 0 && (
                                                    <div
                                                        className="bg-cove-accent h-2 rounded-full transition-all"
                                                        style={{
                                                            width: `${((mean - (metric.min || 0)) / ((metric.max || 10) - (metric.min || 0))) * 100}%`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-xs font-bold text-cove-muted w-12 text-right">
                                                {n > 0 ? mean.toFixed(1) : 'N/A'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {onRunFullAnalysis && (
                <button
                    onClick={onRunFullAnalysis}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-cove-accent bg-cove-tint-blue rounded-xl hover:bg-cove-accent-pale transition-colors"
                >
                    <ExternalLink size={16} /> Run Full Correlation Analysis
                </button>
            )}
        </div>
    );
};

export default ExperimentAnalysisPanel;
