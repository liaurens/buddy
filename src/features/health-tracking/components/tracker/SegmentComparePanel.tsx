import React, { useMemo, useState } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { format, startOfDay, parseISO } from 'date-fns';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { welchTTest, cohensD, meanDiffCI, meanStd } from '../../utils/stats';

const MIN_N = 7;

const SegmentComparePanel: React.FC = () => {
    const { trackers, entries } = useTrackers();
    const { protocols, doses } = useProtocols();

    const numericTrackers = useMemo(
        () => trackers.filter((t) => t.type === 'number' || t.type === 'rating'),
        [trackers],
    );
    const predicateOptions = useMemo(() => {
        const fromTrackers = trackers.map((t) => ({
            id: `tracker:${t.id}`,
            label: `${t.emoji} ${t.name}`,
            kind: 'tracker' as const,
            refId: t.id,
        }));
        const fromProtocols = protocols.map((p) => ({
            id: `protocol:${p.id}`,
            label: `💊 ${p.name}`,
            kind: 'protocol' as const,
            refId: p.id,
        }));
        return [...fromTrackers, ...fromProtocols];
    }, [trackers, protocols]);

    const [outcomeId, setOutcomeId] = useState<string>(numericTrackers[0]?.id ?? '');
    const [predicateId, setPredicateId] = useState<string>(predicateOptions[0]?.id ?? '');

    const result = useMemo(() => {
        if (!outcomeId || !predicateId) return null;

        // Aggregate outcome by day
        const outcomeByDay = new Map<string, number>();
        entries
            .filter((e) => e.trackerId === outcomeId)
            .forEach((e) => {
                const day = format(startOfDay(parseISO(e.timestamp)), 'yyyy-MM-dd');
                outcomeByDay.set(day, (outcomeByDay.get(day) ?? 0) + e.value);
            });

        // Build predicate set of "matching days"
        const matchingDays = new Set<string>();
        const [kind, refId] = predicateId.split(':');
        if (kind === 'tracker') {
            entries
                .filter((e) => e.trackerId === refId && e.value > 0)
                .forEach((e) =>
                    matchingDays.add(format(startOfDay(parseISO(e.timestamp)), 'yyyy-MM-dd')),
                );
        } else if (kind === 'protocol' && doses) {
            doses
                .filter((d) => d.protocolId === refId && d.takenAt)
                .forEach((d) =>
                    matchingDays.add(format(startOfDay(parseISO(d.takenAt!)), 'yyyy-MM-dd')),
                );
        }

        const matched: number[] = [];
        const unmatched: number[] = [];
        outcomeByDay.forEach((v, day) => {
            if (matchingDays.has(day)) matched.push(v);
            else unmatched.push(v);
        });

        return { matched, unmatched };
    }, [entries, doses, outcomeId, predicateId]);

    if (numericTrackers.length === 0 || predicateOptions.length === 0) {
        return (
            <div className="bg-white rounded-xl p-4 shadow-cove border border-cove-border text-sm text-cove-soft">
                Need at least one numeric tracker and one predicate (tracker or protocol) to compare
                segments.
            </div>
        );
    }

    const m = result?.matched ?? [];
    const u = result?.unmatched ?? [];
    const mStats = meanStd(m);
    const uStats = meanStd(u);
    const sparse = mStats.n < MIN_N || uStats.n < MIN_N;
    const welch = !sparse ? welchTTest(u, m) : null;
    const d = !sparse ? cohensD(u, m) : null;
    const ci = !sparse ? meanDiffCI(u, m) : null;

    const predicateLabel = predicateOptions.find((p) => p.id === predicateId)?.label ?? '';
    const outcomeLabel = numericTrackers.find((t) => t.id === outcomeId);

    return (
        <div className="bg-white rounded-xl p-4 shadow-cove border border-cove-border space-y-4">
            <div className="flex items-center gap-2">
                <Layers size={18} className="text-cove-accent" />
                <h3 className="font-semibold text-cove-ink">Compare segments</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-cove-soft mb-1">Outcome</label>
                    <select
                        value={outcomeId}
                        onChange={(e) => setOutcomeId(e.target.value)}
                        className="w-full p-2 rounded-xl border border-cove-border text-sm focus:ring-2 focus:ring-cove-accent"
                    >
                        {numericTrackers.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.emoji} {t.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-cove-soft mb-1">
                        Segment by (days where…)
                    </label>
                    <select
                        value={predicateId}
                        onChange={(e) => setPredicateId(e.target.value)}
                        className="w-full p-2 rounded-xl border border-cove-border text-sm focus:ring-2 focus:ring-cove-accent"
                    >
                        {predicateOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.label} &gt; 0 / taken
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-cove-tint-green rounded-xl p-3 text-center">
                    <div className="text-xs text-cove-success-deep mb-1">
                        Matching ({predicateLabel})
                    </div>
                    <div className="text-2xl font-bold text-cove-ink">
                        {mStats.n > 0 ? mStats.mean.toFixed(1) : '—'}
                    </div>
                    <div className="text-xs text-cove-soft">
                        {mStats.n > 0 && `± ${mStats.std.toFixed(1)} · `}n={mStats.n}
                    </div>
                </div>
                <div className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-3 text-center">
                    <div className="text-xs text-cove-muted mb-1">Not matching</div>
                    <div className="text-2xl font-bold text-cove-ink">
                        {uStats.n > 0 ? uStats.mean.toFixed(1) : '—'}
                    </div>
                    <div className="text-xs text-cove-soft">
                        {uStats.n > 0 && `± ${uStats.std.toFixed(1)} · `}n={uStats.n}
                    </div>
                </div>
            </div>

            {sparse ? (
                <div className="flex items-start gap-2 text-xs text-cove-streak-text bg-cove-tint-amber border border-cove-streak rounded-xl px-3 py-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>
                        Need at least {MIN_N} days per segment for reliable stats (matching=
                        {mStats.n}, not matching={uStats.n}).
                    </span>
                </div>
            ) : welch && d && ci ? (
                <div className="text-sm text-cove-muted leading-relaxed bg-cove-tint-blue/60 rounded-xl px-3 py-2">
                    Δ = {ci.diff >= 0 ? '+' : ''}
                    {ci.diff.toFixed(2)}
                    {outcomeLabel?.unit && ` ${outcomeLabel.unit}`},{' '}
                    <span className="text-cove-soft">
                        95% CI [{ci.low.toFixed(2)}, {ci.high.toFixed(2)}]
                    </span>
                    ,{' '}
                    <span
                        className={
                            welch.pTwoSided < 0.05
                                ? 'text-cove-success-deep font-bold'
                                : 'text-cove-muted'
                        }
                    >
                        p = {welch.pTwoSided < 0.0001 ? '<0.0001' : welch.pTwoSided.toFixed(4)}
                    </span>
                    , Cohen's d = {d.d.toFixed(2)}{' '}
                    <span className="text-cove-soft">({d.interpretation})</span>
                </div>
            ) : (
                <p className="text-xs text-cove-soft italic">Not enough variance to compute.</p>
            )}
        </div>
    );
};

export default SegmentComparePanel;
