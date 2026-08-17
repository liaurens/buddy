import React, { useState, useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    LineChart,
    Line,
} from 'recharts';
import { format, startOfDay, parseISO } from 'date-fns';
import {
    calculateCorrelation,
    interpretCorrelation,
    calculateTLCC,
    findOptimalLag,
    calculateCorrelationPValue as calculatePValue,
    calculateCorrelationCI as calculateConfidenceInterval,
    getDataQualityWarnings,
    interpretPValue,
    getCorrelationColor,
} from '../../utils/stats';
import { TrendingUp, AlertTriangle, Zap, Clock } from 'lucide-react';

interface AnalysisProps {
    initialX?: string;
    initialY?: string;
}

const Analysis: React.FC<AnalysisProps> = ({ initialX, initialY }) => {
    const { entries, trackers } = useTrackers();
    const { protocols, doses } = useProtocols(); // Get doses history directly

    // Default selection
    const [xTrackerId, setXTrackerId] = useState<string>(initialX || trackers[0]?.id || '');
    const [yTrackerId, setYTrackerId] = useState<string>(initialY || trackers[1]?.id || '');
    const [manualLag, setManualLag] = useState<number>(0);
    const [showOptimalLag, setShowOptimalLag] = useState<boolean>(true);

    const getVariable = (id: string) => {
        const t = trackers.find((x) => x.id === id);
        if (t) return { ...t, kind: 'tracker' as const };
        const p = protocols.find((x) => x.id === id);
        if (p) return { ...p, kind: 'protocol' as const, unit: p.doseUnit };
        return null; // Should handle unknown
    };

    const xVar = getVariable(xTrackerId);
    const yVar = getVariable(yTrackerId);

    // Group data by day and prepare time series
    const { data, xValues, yValues } = useMemo(() => {
        const days = new Map<string, Record<string, number>>();

        // 1. Process Tracker Entries
        entries.forEach((entry) => {
            const dayKey = format(startOfDay(parseISO(entry.timestamp)), 'yyyy-MM-dd');
            if (!days.has(dayKey)) days.set(dayKey, { date: new Date(dayKey).getTime() }); // store numeric date for charts? or stick to string key

            const day = days.get(dayKey)!;
            if (day[entry.trackerId] === undefined) day[entry.trackerId] = 0;
            day[entry.trackerId] += entry.value;
        });

        // 2. Process Protocol Doses (if x or y is a protocol)
        if (doses) {
            doses.forEach((dose) => {
                if (!dose.takenAt) return; // Skip if no taken time
                const dayKey = format(startOfDay(parseISO(dose.takenAt)), 'yyyy-MM-dd');
                if (!days.has(dayKey)) days.set(dayKey, { date: new Date(dayKey).getTime() });

                const day = days.get(dayKey)!;
                // Use protocolId as key
                if (day[dose.protocolId] === undefined) day[dose.protocolId] = 0;

                // Use actualAmount if available, or default to 1 (presence)
                // Ideally should look up protocol default dose if actual is missing, but for now 1 is decent fallback for "took it"
                day[dose.protocolId] += dose.actualAmount || 1;
            });
        }

        const sortedData = Array.from(days.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, vals]) => ({ date, ...vals }));

        // Extract aligned arrays for correlation
        const xVals: number[] = [];
        const yVals: number[] = [];

        sortedData.forEach((day) => {
            // Need to verify if xTrackerId / yTrackerId exists in this day object
            // Use 0 if missing? Or skip?
            // For correlation, usually we need PAIRS.
            // If it's a protocol (boolean-ish), 0 is valid (did not take).
            // If it's a tracker, 0 might be valid OR missing.
            // For now, let's treat undefined as 0 for Protocols, but strict for Trackers?
            // Actually, simplified: try to get value, default to 0 if we think safe.
            // Correlation usually ignores missing data pairs, but "not taking a pill" IS data (0).
            // "Not logging mood" is MISSING data.

            const d = day as Record<string, number | string | undefined>;
            let xVal = d[xTrackerId];
            let yVal = d[yTrackerId];

            const xIsProto = xVar?.kind === 'protocol';
            const yIsProto = yVar?.kind === 'protocol';

            if (xIsProto && xVal === undefined) xVal = 0;
            if (yIsProto && yVal === undefined) yVal = 0;

            if (typeof xVal === 'number' && typeof yVal === 'number') {
                xVals.push(xVal);
                yVals.push(yVal);
            }
        });

        return { data: sortedData, xValues: xVals, yValues: yVals };
    }, [entries, doses, xTrackerId, yTrackerId, xVar, yVar]);

    // TLCC calculation
    const tlccResults = useMemo(() => {
        if (xValues.length < 5) return [];
        return calculateTLCC(xValues, yValues, 7); // Max 7 day lag
    }, [xValues, yValues]);

    // Optimal lag
    const optimalLag = useMemo(() => {
        if (xValues.length < 5) return null;
        return findOptimalLag(xValues, yValues, 7);
    }, [xValues, yValues]);

    // Current correlation (based on selected lag)
    const currentCorrelation = useMemo(() => {
        const effectiveLag = showOptimalLag && optimalLag ? optimalLag.lag : manualLag;

        if (effectiveLag === 0) {
            return calculateCorrelation(xValues, yValues);
        }

        // Apply lag
        const xSlice = xValues.slice(0, xValues.length - effectiveLag);
        const ySlice = yValues.slice(effectiveLag);
        return calculateCorrelation(xSlice, ySlice);
    }, [xValues, yValues, manualLag, showOptimalLag, optimalLag]);

    // Statistical measures
    const sampleSize = xValues.length;
    const pValue =
        currentCorrelation !== null ? calculatePValue(currentCorrelation, sampleSize) : null;
    const confidenceInterval =
        currentCorrelation !== null
            ? calculateConfidenceInterval(currentCorrelation, sampleSize)
            : null;
    const pValueInterpretation = interpretPValue(pValue);
    const dataWarnings = getDataQualityWarnings(sampleSize);

    if (trackers.length < 2) {
        return (
            <div className="p-6 text-center text-cove-soft">
                Need at least 2 trackers for analysis.
            </div>
        );
    }

    const effectiveLag = showOptimalLag && optimalLag ? optimalLag.lag : manualLag;

    return (
        <div className="space-y-6">
            {/* Data Quality Warnings */}
            {dataWarnings.length > 0 && (
                <div className="bg-cove-tint-amber border border-cove-streak rounded-xl p-4">
                    {dataWarnings.map((warning, i) => (
                        <p
                            key={i}
                            className="text-cove-streak-text text-sm flex items-center gap-2"
                        >
                            <AlertTriangle size={16} />
                            {warning}
                        </p>
                    ))}
                </div>
            )}

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-cove border border-cove-border">
                <h2 className="font-semibold text-cove-ink mb-4 flex items-center gap-2">
                    <TrendingUp size={20} />
                    Correlation Analysis
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-cove-soft mb-1">
                            Input (Cause?) - X Axis
                        </label>
                        <select
                            value={xTrackerId}
                            onChange={(e) => setXTrackerId(e.target.value)}
                            className="w-full p-2 rounded-xl border border-cove-border text-sm focus:ring-2 focus:ring-cove-accent"
                        >
                            <optgroup label="Trackers">
                                {trackers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.emoji} {t.name}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Protocols">
                                {protocols.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        💊 {p.name}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-cove-soft mb-1">
                            Output (Effect?) - Y Axis
                        </label>
                        <select
                            value={yTrackerId}
                            onChange={(e) => setYTrackerId(e.target.value)}
                            className="w-full p-2 rounded-xl border border-cove-border text-sm focus:ring-2 focus:ring-cove-accent"
                        >
                            <optgroup label="Trackers">
                                {trackers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.emoji} {t.name}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Protocols">
                                {protocols.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        💊 {p.name}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                </div>

                {/* Time Lag Controls */}
                <div className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-cove-muted">
                            <Clock size={16} />
                            Time Lag (days)
                        </label>
                        {optimalLag && (
                            <button
                                onClick={() => setShowOptimalLag(!showOptimalLag)}
                                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                    showOptimalLag
                                        ? 'bg-cove-tint-blue text-cove-ink'
                                        : 'bg-cove-track text-cove-muted'
                                }`}
                            >
                                <Zap size={12} className="inline mr-1" />
                                {showOptimalLag ? 'Auto (Optimal)' : 'Use Optimal'}
                            </button>
                        )}
                    </div>

                    {!showOptimalLag && (
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="7"
                                value={manualLag}
                                onChange={(e) => setManualLag(parseInt(e.target.value))}
                                className="flex-1 h-2 bg-cove-track rounded-xl appearance-none cursor-pointer accent-cove-accent"
                            />
                            <span className="text-sm font-bold text-cove-muted w-16 text-right">
                                {manualLag} day{manualLag !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {showOptimalLag && optimalLag && (
                        <p className="text-sm text-cove-accent mt-2">
                            Optimal lag detected:{' '}
                            <strong>
                                {optimalLag.lag} day{optimalLag.lag !== 1 ? 's' : ''}
                            </strong>{' '}
                            (r = {optimalLag.correlation.toFixed(3)})
                        </p>
                    )}
                </div>
            </div>

            {/* Main Result Card */}
            {xVar && yVar && (
                <div className="bg-cove-tint-blue p-6 rounded-card-lg shadow-cove border-0">
                    <h2 className="text-lg font-semibold mb-4 text-cove-ink">Analysis Result</h2>

                    {currentCorrelation !== null ? (
                        <div className="grid grid-cols-1 gap-4">
                            {/* Correlation Score */}
                            <div className="text-center">
                                <p
                                    className="text-4xl font-bold mb-1"
                                    style={{ color: getCorrelationColor(currentCorrelation) }}
                                >
                                    {currentCorrelation.toFixed(3)}
                                </p>
                                <p className="text-sm font-bold text-cove-muted">
                                    {interpretCorrelation(currentCorrelation)}
                                </p>
                                <p className="text-xs text-cove-faint mt-1">
                                    {xVar.name} → {yVar.name}
                                    {effectiveLag > 0 && ` (${effectiveLag}d lag)`}
                                </p>
                            </div>

                            {/* Statistical Significance */}
                            <div className="text-center">
                                <p
                                    className={`text-lg font-semibold ${pValueInterpretation.significant ? 'text-cove-success-deep' : 'text-cove-soft'}`}
                                >
                                    {pValue !== null ? `p = ${pValue.toFixed(4)}` : 'N/A'}
                                </p>
                                <p className="text-sm text-cove-muted">
                                    {pValueInterpretation.text}
                                </p>
                                <p className="text-xs text-cove-faint mt-1">
                                    n = {sampleSize} days
                                </p>
                            </div>

                            {/* Confidence Interval */}
                            <div className="text-center">
                                {confidenceInterval ? (
                                    <>
                                        <p className="text-lg font-semibold text-cove-muted">
                                            [{confidenceInterval.low.toFixed(2)},{' '}
                                            {confidenceInterval.high.toFixed(2)}]
                                        </p>
                                        <p className="text-sm text-cove-muted">
                                            95% Confidence Interval
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-cove-soft">
                                        Insufficient data for CI
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-cove-soft text-center">
                            Not enough data to calculate correlation.
                        </p>
                    )}
                </div>
            )}

            {/* TLCC Chart - Correlation at Different Lags */}
            {tlccResults.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-cove border border-cove-border">
                    <h2 className="text-xl font-semibold mb-4 text-cove-ink">
                        Time-Lagged Correlation
                    </h2>
                    <p className="text-sm text-cove-soft mb-4">
                        How does the correlation change if {yVar?.name.toLowerCase()} is measured
                        1-7 days after {xVar?.name.toLowerCase()}?
                    </p>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={tlccResults}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="lag"
                                    label={{ value: 'Days Later', position: 'bottom', offset: -5 }}
                                />
                                <YAxis
                                    domain={[-1, 1]}
                                    label={{
                                        value: 'Correlation',
                                        angle: -90,
                                        position: 'insideLeft',
                                    }}
                                />
                                <Tooltip
                                    formatter={(value) => [
                                        typeof value === 'number'
                                            ? value.toFixed(3)
                                            : String(value ?? ''),
                                        'Correlation',
                                    ]}
                                    labelFormatter={(label) =>
                                        `${label} day${label !== 1 ? 's' : ''} later`
                                    }
                                />
                                <Line
                                    type="monotone"
                                    dataKey="correlation"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Trends Over Time */}
            {xVar && yVar && data.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-cove border border-cove-border">
                    <h2 className="text-xl font-semibold mb-4 text-cove-ink">Trends Over Time</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
                                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    yAxisId="left"
                                    dataKey={xTrackerId}
                                    name={xVar.name}
                                    fill="#6366f1"
                                />
                                <Bar
                                    yAxisId="right"
                                    dataKey={yTrackerId}
                                    name={yVar.name}
                                    fill="#f59e0b"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Scatter Plot */}
            {xVar && yVar && data.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-cove border border-cove-border">
                    <h2 className="text-xl font-semibold mb-4 text-cove-ink">
                        Correlation Scatter
                    </h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                                <CartesianGrid />
                                <XAxis
                                    type="number"
                                    dataKey={xTrackerId}
                                    name={xVar.name}
                                    unit={xVar.unit}
                                />
                                <YAxis
                                    type="number"
                                    dataKey={yTrackerId}
                                    name={yVar.name}
                                    unit={yVar.unit}
                                />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name="Days" data={data} fill="#8884d8" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Analysis;
