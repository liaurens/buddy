import React from 'react';
import type { ChecklistItem as IChecklistItem } from '../types';

interface ChecklistItemProps {
    item: IChecklistItem;
    onToggle: () => void;
    onDelete: () => void;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onToggle, onDelete }) => {
    return (
        <div className="group flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
                className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                    ${item.isChecked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 hover:border-emerald-500'}
                `}
            >
                {item.isChecked && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                )}
            </button>

            <span className={`flex-1 text-slate-900 transition-all ${item.isChecked ? 'text-slate-400 line-through' : ''}`}>
                {item.text}
            </span>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="p-2 text-slate-400 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100"
                title="Delete Item"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
};
