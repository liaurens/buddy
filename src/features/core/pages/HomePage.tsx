import React from 'react';
import { format } from 'date-fns';
import type { AppRoute } from '../../../constants/routes';
import AssistantPromptBar from '../../assistant/components/AssistantPromptBar';
import DailyRoutineCard from '../components/DailyRoutineCard';
import NextUpCard from '../components/NextUpCard';
import TodayCard from '../components/TodayCard';
import InsightCard from '../components/InsightCard';
import RecentCaptures from '../components/RecentCaptures';

interface HomePageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    const today = new Date();

    return (
        <div className="max-w-xl mx-auto pb-24 space-y-5">
            <header className="pt-2">
                <p className="text-slate-500 text-sm font-medium">{format(today, 'EEEE, MMMM do')}</p>
            </header>

            <DailyRoutineCard onNavigate={onNavigate} />

            <AssistantPromptBar onNavigate={onNavigate} />

            <NextUpCard onNavigate={onNavigate} />

            <TodayCard onNavigate={onNavigate} />

            <InsightCard />

            <RecentCaptures onNavigate={onNavigate} />
        </div>
    );
};

export default HomePage;
