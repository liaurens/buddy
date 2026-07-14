import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { fetchMoodEnergyHistory, type MoodEnergyPoint } from '../services/moodHistory';

export function useReflectionHistory(days = 14) {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<MoodEnergyPoint[]>({
        queryKey: ['reflection-history', userId, days],
        queryFn: () => fetchMoodEnergyHistory(userId!, days),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}
