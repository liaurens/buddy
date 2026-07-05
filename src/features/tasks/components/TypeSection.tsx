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
    topPickReason?: string;
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
    topPickReason,
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
        <section className="space-y-2">
            <button
                type="button"
                onClick={() => setCollapsed(c => !c)}
                className="flex w-full items-center gap-2 px-1 py-1 text-left transition-colors"
            >
                {collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                {taskType?.emoji && <span className="text-base">{taskType.emoji}</span>}
                <span className={`text-sm font-semibold ${colors.text}`}>
                    {taskType?.name || 'Uncategorized'}
                </span>
                <span className="text-xs font-medium text-slate-400">{tasks.length}</span>
            </button>
            {!collapsed && (
                <div className={`app-surface overflow-hidden border-l-2 ${colors.border}`}>
                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            taskType={taskType || undefined}
                            allTaskTypes={allTaskTypes}
                            isSelected={selectedIds.has(task.id)}
                            isTopPick={task.id === topPickId && selectedIds.size === 0}
                            topPickReason={topPickReason}
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
