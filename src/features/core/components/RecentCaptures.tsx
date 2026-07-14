import React from 'react';
import { Activity, CheckSquare, ChevronRight, StickyNote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRecentCaptures } from '../hooks/useRecentCaptures';
import type { AppRoute } from '../../../constants/routes';

interface Props {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const ICONS = {
    task: CheckSquare,
    note: StickyNote,
    entry: Activity,
};

const KIND_TO_ROUTE: Record<'task' | 'note' | 'entry', AppRoute> = {
    task: 'tasks',
    note: 'notes',
    entry: 'health',
};

const RecentCaptures: React.FC<Props> = ({ onNavigate }) => {
    const { items, isLoading } = useRecentCaptures();

    if (isLoading || items.length === 0) return null;

    return (
        <section className="app-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">Recent captures</h2>
            </div>
            <div className="divide-y divide-slate-100">
                {items.map((item) => {
                    const Icon = ICONS[item.kind];
                    return (
                        <button
                            key={`${item.kind}-${item.id}`}
                            onClick={() => onNavigate(KIND_TO_ROUTE[item.kind])}
                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                        >
                            <Icon size={17} className="shrink-0 text-slate-500" />
                            <span className="flex-1 truncate text-sm text-slate-700">
                                {item.label}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">
                                {formatDistanceToNow(new Date(item.createdAt), {
                                    addSuffix: false,
                                })}
                            </span>
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={() => onNavigate('browse')}
                className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-medium text-indigo-900 transition-colors hover:bg-slate-50"
            >
                View all captures
                <ChevronRight size={16} className="text-slate-400" />
            </button>
        </section>
    );
};

export default RecentCaptures;
