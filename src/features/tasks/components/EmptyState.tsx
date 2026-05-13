import React from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
    title?: string;
    hint?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    title = 'No tasks yet',
    hint = "Use the quick-capture above. Try 'email mom tomorrow 2pm' or 'clean room high energy'.",
}) => (
    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
        <Sparkles size={24} className="mx-auto text-slate-300 mb-2" />
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{hint}</p>
    </div>
);

export default EmptyState;
