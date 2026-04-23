import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { supabase } from '../../../../services/supabase';
import { useTrackers } from '../../hooks/useTrackers';
import { getCorrelationColor, interpretCorrelation } from '../../utils/stats';
import { format, parseISO } from 'date-fns';

interface CorrelationRow {
    id: string;
    input_tracker_id: string;
    output_tracker_id: string;
    correlation: number;
    p_value: number;
    sample_size: number;
    calculated_at: string;
}

interface Props {
    onOpenPair?: (xId: string, yId: string) => void;
}

const TopCorrelationsCard: React.FC<Props> = ({ onOpenPair }) => {
    const { user } = useAuth();
    const { trackers } = useTrackers();
    const userId = user?.id;

    const { data = [], isLoading } = useQuery({
        queryKey: ['top-correlations', userId],
        queryFn: async (): Promise<CorrelationRow[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('correlations')
                .select('id, input_tracker_id, output_tracker_id, correlation, p_value, sample_size, calculated_at')
                .eq('user_id', userId)
                .gte('sample_size', 10)
                .lte('p_value', 0.05);
            if (error) throw error;
            return (data || []) as CorrelationRow[];
        },
        enabled: !!userId,
        staleTime: 60_000,
    });

    const nameFor = (id: string) => trackers.find(t => t.id === id);

    const top = [...data]
        .filter(r => nameFor(r.input_tracker_id) && nameFor(r.output_tracker_id))
        .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
        .slice(0, 5);

    const lastComputed = data.length > 0
        ? data.reduce((m, r) => r.calculated_at > m ? r.calculated_at : m, data[0].calculated_at)
        : null;

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-500" />
                    <h3 className="font-semibold text-slate-800">Top correlations</h3>
                </div>
                {lastComputed && (
                    <span className="text-xs text-slate-400">
                        {format(parseISO(lastComputed), 'MMM d')}
                    </span>
                )}
            </div>

            {isLoading ? (
                <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
            ) : top.length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">
                    <TrendingUp size={24} className="mx-auto mb-2 opacity-50" />
                    <p>No significant correlations yet.</p>
                    <p className="text-xs mt-1">Recompute from the AI Debug Panel after logging ≥10 days.</p>
                </div>
            ) : (
                <ul className="divide-y divide-slate-50">
                    {top.map(r => {
                        const x = nameFor(r.input_tracker_id)!;
                        const y = nameFor(r.output_tracker_id)!;
                        return (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenPair?.(r.input_tracker_id, r.output_tracker_id)}
                                    className="w-full py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                                >
                                    <span
                                        className="text-sm font-bold w-12 text-right"
                                        style={{ color: getCorrelationColor(r.correlation) }}
                                    >
                                        {r.correlation >= 0 ? '+' : ''}{r.correlation.toFixed(2)}
                                    </span>
                                    <div className="flex-1 text-sm text-slate-700 truncate">
                                        <span>{x.emoji} {x.name}</span>
                                        <ArrowRight size={12} className="inline mx-1.5 text-slate-400" />
                                        <span>{y.emoji} {y.name}</span>
                                    </div>
                                    <span className="text-xs text-slate-400 whitespace-nowrap">
                                        {interpretCorrelation(r.correlation)} · n={r.sample_size}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default TopCorrelationsCard;
