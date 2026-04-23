import React from 'react';
import { CheckSquare, StickyNote, Activity } from 'lucide-react';
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
        <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Recent</h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-sm">
                {items.map(item => {
                    const Icon = ICONS[item.kind];
                    return (
                        <button
                            key={`${item.kind}-${item.id}`}
                            onClick={() => onNavigate(KIND_TO_ROUTE[item.kind])}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                        >
                            <Icon size={14} className="text-slate-400 shrink-0" />
                            <span className="flex-1 text-sm text-slate-700 truncate">{item.label}</span>
                            <span className="text-xs text-slate-400 shrink-0">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: false })}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default RecentCaptures;
