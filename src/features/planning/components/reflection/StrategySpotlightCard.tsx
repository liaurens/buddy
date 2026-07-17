/**
 * StrategySpotlightCard — surfaces toolbox strategies during reflection.
 *
 * Reflection is when you think about what worked and what didn't, so this is
 * the natural moment to resurface your own strategies. Favorites first, then
 * the most recently added. Renders nothing while the toolbox is empty.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { supabase, dbToStrategy, type DbStrategy } from '../../../../services/supabase';

const SPOTLIGHT_COUNT = 3;

const StrategySpotlightCard: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id;

    const { data: strategies = [] } = useQuery({
        queryKey: ['strategies', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('strategies')
                .select('*')
                .eq('user_id', userId);
            if (error) throw error;
            return (data as DbStrategy[]).map(dbToStrategy);
        },
        enabled: !!userId,
        staleTime: 60_000,
    });

    if (strategies.length === 0) return null;

    const spotlight = [...strategies]
        .sort((a, b) => Number(b.isFavorite ?? false) - Number(a.isFavorite ?? false))
        .slice(0, SPOTLIGHT_COUNT);

    return (
        <div className="bg-white rounded-[18px] p-6 shadow-cove space-y-3">
            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                <Wrench size={18} className="text-cove-accent" /> From your toolbox
            </h2>
            <p className="text-xs font-semibold text-cove-muted -mt-2">
                Strategies you wrote down — did one of these apply today?
            </p>
            <ul className="space-y-2">
                {spotlight.map((s) => (
                    <li key={s.id} className="rounded-[12px] bg-[#eef6fa] p-3">
                        <p className="text-sm font-bold text-cove-ink">
                            {s.isFavorite ? '⭐ ' : ''}
                            {s.title}
                        </p>
                        {s.description && (
                            <p className="text-xs font-semibold text-cove-muted mt-0.5 line-clamp-2">
                                {s.description}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default StrategySpotlightCard;
