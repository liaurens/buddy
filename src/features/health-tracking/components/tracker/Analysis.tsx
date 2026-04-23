import React, { useState, useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, LineChart, Line } from 'recharts';
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
    getCorrelationColor
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
        const t = trackers.find(x => x.id === id);
        if (t) return { ...t, kind: 'tracker' as const };
        const p = protocols.find(x => x.id === id);
        if (p) return { ...p, kind: 'protocol' as const, unit: p.doseUnit };
        return null; // Should handle unknown
    };

    const xVar = getVariable(xTrackerId);
    const yVar = getVariable(yTrackerId);

    // Group data by day and prepare time series
    const { data, xValues, yValues } = useMemo(() => {
        const days = new Map<string, Record<string, number>>();

        // 1. Process Tracker Entries
        entries.forEach(entry => {
            const dayKey = format(startOfDay(parseISO(entry.timestamp)), 'yyyy-MM-dd');
            if (!days.has(dayKey)) days.set(dayKey, { date: new Date(dayKey).getTime() }); // store numeric date for charts? or stick to string key

            const day = days.get(dayKey)!;
            if (day[entry.trackerId] === undefined) day[entry.trackerId] = 0;
            day[entry.trackerId] += entry.value;
        });

        // 2. Process Protocol Doses (if x or y is a protocol)
        if (doses) {
            doses.forEach(dose => {
                if (!dose.takenAt) return; // Skip if no taken time
                const dayKey = format(startOfDay(parseISO(dose.takenAt)), 'yyyy-MM-dd');
                if (!days.has(dayKey)) days.set(dayKey, { date: new Date(dayKey).getTime() });

                const day = days.get(dayKey)!;
                // Use protocolId as key
                if (day[dose.protocolId] === undefined) day[dose.protocolId] = 0;

                // Use actualAmount if available, or default to 1 (presence)
                // Ideally should look up protocol default dose if actual is missing, but for now 1 is decent fallback for "took it"
                day[dose.protocolId] += (dose.actualAmount || 1);
            });
        }

        const sortedData = Array.from(days.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, vals]) => ({ date, ...vals }));

        // Extract aligned arrays for correlation
        const xVals: number[] = [];
        const yVals: number[] = [];

        sortedData.forEach(day => {
            // Need to verify if xTrackerId / yTrackerId exists in this day object
            // Use 0 if missing? Or skip?
            // For correlation, usually we need PAIRS.
            // If it's a protocol (boolean-ish), 0 is valid (did not take).
            // If it's a tracker, 0 might be valid OR missing.
            // For now, let's treat undefined as 0 for Protocols, but strict for Trackers?
            // Actually, simplified: try to get value, default to 0 if we think safe.
            // Correlation usually ignores missing data pairs, but "not taking a pill" IS data (0).
            // "Not logging mood" is MISSING data.

            const d = day as any;
            let xVal = d[xTrackerId];
            let yVal = d[yTrackerId];

            const xIsProto = xVar?.kind === 'protocol';
            const yIsProto = yVar?.kind === 'protocol';

            if (xIsProto && xVal === undefined) xVal = 0;
            if (yIsProto && yVal === undefined) yVal = 0;

            if (xVal !== undefined && yVal !== undefined) {
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
    const pValue = currentCorrelation !== null ? calculatePValue(currentCorrelation, sampleSize) : null;
    const confidenceInterval = currentCorrelation !== null ? calculateConfidenceInterval(currentCorrelation, sampleSize) : null;
    const pValueInterpretation = interpretPValue(pValue);
    const dataWarnings = getDataQualityWarnings(sampleSize);

    if (trackers.length < 2) {
        return <div className="p-6 text-center text-slate-500">Need at least 2 trackers for analysis.</div>;
    }

    const effectiveLag = showOptimalLag && optimalLag ? optimalLag.lag : manualLag;

    return (
        <div className="space-y-6">
            {/* Data Quality Warnings */}
            {dataWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    {dataWarnings.map((warning, i) => (
                        <p key={i} className="text-amber-800 text-sm flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {warning}
                        </p>
                    ))}
                </div>
            )}

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} />
                    Correlation Analysis
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            Input (Cause?) - X Axis
                        </label>
                        <select
                            value={xTrackerId}
                            onChange={(e) => setXTrackerId(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <optgroup label="Trackers">
                                {trackers.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
                            </optgroup>
                            <optgroup label="Protocols">
                                {protocols.map(p => <option key={p.id} value={p.id}>💊 {p.name}</option>)}
                            </optgroup>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            Output (Effect?) - Y Axis
                        </label>
                        <select
                            value={yTrackerId}
                            onChange={(e) => setYTrackerId(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <optgroup label="Trackers">
                                {trackers.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
                            </optgroup>
                            <optgroup label="Protocols">
                                {protocols.map(p => <option key={p.id} value={p.id}>💊 {p.name}</option>)}
                            </optgroup>
                        </select>
                    </div>
                </div>

                {/* Time Lag Controls */}
                <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Clock size={16} />
                            Time Lag (days)
                        </label>
                        {optimalLag && (
                            <button
                                onClick={() => setShowOptimalLag(!showOptimalLag)}
                                className={`text-xs px-3 py-1 rounded-full transition-colors ${showOptimalLag
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-200 text-slate-600'
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
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <span className="text-sm font-medium text-slate-700 w-16 text-right">
                                {manualLag} day{manualLag !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {showOptimalLag && optimalLag && (
                        <p className="text-sm text-indigo-600 mt-2">
                            Optimal lag detected: <strong>{optimalLag.lag} day{optimalLag.lag !== 1 ? 's' : ''}</strong>
                            {' '}(r = {optimalLag.correlation.toFixed(3)})
                        </p>
                    )}
                </div>
            </div>

            {/* Main Result Card */}
            {xVar && yVar && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl shadow-sm border border-indigo-100">
                    <h2 className="text-lg font-semibold mb-4 text-slate-800">Analysis Result</h2>

                    {currentCorrelation !== null ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Correlation Score */}
                            <div className="text-center">
                                <p
                                    className="text-4xl font-bold mb-1"
                                    style={{ color: getCorrelationColor(currentCorrelation) }}
                                >
                                    {currentCorrelation.toFixed(3)}
                                </p>
                                <p className="text-sm font-medium text-slate-600">
                                    {interpretCorrelation(currentCorrelation)}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {xVar.name} → {yVar.name}
                                    {effectiveLag > 0 && ` (${effectiveLag}d lag)`}
                                </p>
                            </div>

                            {/* Statistical Significance */}
                            <div className="text-center">
                                <p className={`text-lg font-semibold ${pValueInterpretation.significant ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {pValue !== null ? `p = ${pValue.toFixed(4)}` : 'N/A'}
                                </p>
                                <p className="text-sm text-slate-600">{pValueInterpretation.text}</p>
                                <p className="text-xs text-slate-400 mt-1">n = {sampleSize} days</p>
                            </div>

                            {/* Confidence Interval */}
                            <div className="text-center">
                                {confidenceInterval ? (
                                    <>
                                        <p className="text-lg font-semibold text-slate-700">
                                            [{confidenceInterval.low.toFixed(2)}, {confidenceInterval.high.toFixed(2)}]
                                        </p>
                                        <p className="text-sm text-slate-600">95% Confidence Interval</p>
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">Insufficient data for CI</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center">Not enough data to calculate correlation.</p>
                    )}
                </div>
            )}

            {/* TLCC Chart - Correlation at Different Lags */}
            {tlccResults.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800">
                        Time-Lagged Correlation
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">
                        How does the correlation change if {yVar?.name.toLowerCase()} is measured 1-7 days after {xVar?.name.toLowerCase()}?
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
                                    label={{ value: 'Correlation', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip
                                    formatter={(value: number) => [value.toFixed(3), 'Correlation']}
                                    labelFormatter={(label) => `${label} day${label !== 1 ? 's' : ''} later`}
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
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800">Trends Over Time</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
                                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
                                <Tooltip />
                                <Legend />
                                <Bar yAxisId="left" dataKey={xTrackerId} name={xVar.name} fill="#6366f1" />
                                <Bar yAxisId="right" dataKey={yTrackerId} name={yVar.name} fill="#f59e0b" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Scatter Plot */}
            {xVar && yVar && data.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800">Correlation Scatter</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                                <CartesianGrid />
                                <XAxis type="number" dataKey={xTrackerId} name={xVar.name} unit={xVar.unit} />
                                <YAxis type="number" dataKey={yTrackerId} name={yVar.name} unit={yVar.unit} />
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
