import React from 'react';
import type { Checklist } from '../types';

interface ChecklistCardProps {
    checklist: Checklist;
    onClick: () => void;
}

export const ChecklistCard: React.FC<ChecklistCardProps> = ({ checklist, onClick }) => {
    const totalItems = checklist.items.length;
    const checkedItems = checklist.items.filter((i) => i.isChecked).length;
    const percent = totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100);

    return (
        <div
            onClick={onClick}
            className="app-surface group relative cursor-pointer p-5 transition-all hover:-translate-y-0.5"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-4xl">{checklist.emoji || '📝'}</span>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                            {checklist.name}
                        </h3>
                        {checklist.description && (
                            <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                                {checklist.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-500">
                    <span>Progress</span>
                    <span>
                        {checkedItems}/{totalItems}
                    </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            {checklist.isPinned && (
                <div className="absolute top-4 right-4 text-yellow-500">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                    </svg>
                </div>
            )}
        </div>
    );
};
