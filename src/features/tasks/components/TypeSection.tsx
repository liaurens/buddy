import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Task, TaskType } from '../types';
import { getTypeColors } from '../utils/typeColors';
import TaskCard from './TaskCard';

interface TypeSectionProps {
    taskType: TaskType | null; // null = "No type" bucket
    tasks: Task[];
    allTaskTypes?: TaskType[];
    selectedIds: Set<string>;
    topPickId?: string | null;
    onToggleSelect: (id: string) => void;
    onToggleComplete: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (task: Task) => void;
    defaultCollapsed?: boolean;
}

const TypeSection: React.FC<TypeSectionProps> = ({
    taskType,
    tasks,
    allTaskTypes,
    selectedIds,
    topPickId,
    onToggleSelect,
    onToggleComplete,
    onDelete,
    onUpdate,
    defaultCollapsed = false,
}) => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const colors = getTypeColors(taskType?.color);

    if (tasks.length === 0) return null;

    return (
        <section className={`rounded-2xl border-l-4 ${colors.border} bg-white border border-slate-100 shadow-sm`}>
            <button
                type="button"
                onClick={() => setCollapsed(c => !c)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors"
            >
                {collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                {taskType?.emoji && <span className="text-base">{taskType.emoji}</span>}
                <span className={`text-sm font-bold uppercase tracking-wider ${colors.text}`}>
                    {taskType?.name || 'Uncategorized'}
                </span>
                <span className="text-xs text-slate-400 font-medium">({tasks.length})</span>
            </button>
            {!collapsed && (
                <div className="px-3 pb-3 space-y-1.5">
                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            taskType={taskType || undefined}
                            allTaskTypes={allTaskTypes}
                            isSelected={selectedIds.has(task.id)}
                            isTopPick={task.id === topPickId && selectedIds.size === 0}
                            onToggleSelect={onToggleSelect}
                            onToggleComplete={onToggleComplete}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            showTypeBadge={false}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

export default TypeSection;
