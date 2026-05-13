import React from 'react';
import type { Task, TaskType, TaskEnergy } from '../types';
import { getTypeColors } from '../utils/typeColors';

export interface FilterState {
    typeId: string | 'all';
    energy: TaskEnergy | 'all';
}

interface TaskFiltersProps {
    taskTypes: TaskType[];
    activeTasks: Task[];
    filter: FilterState;
    onChange: (next: FilterState) => void;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({ taskTypes, activeTasks, filter, onChange }) => {
    const totalActive = activeTasks.length;
    const countByType = new Map<string, number>();
    let untyped = 0;
    for (const t of activeTasks) {
        if (t.taskTypeId) countByType.set(t.taskTypeId, (countByType.get(t.taskTypeId) || 0) + 1);
        else untyped += 1;
    }

    return (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip
                label={`All ${totalActive}`}
                active={filter.typeId === 'all' && filter.energy === 'all'}
                onClick={() => onChange({ typeId: 'all', energy: 'all' })}
            />
            {taskTypes.map(type => {
                const n = countByType.get(type.id) || 0;
                if (n === 0) return null;
                const colors = getTypeColors(type.color);
                const active = filter.typeId === type.id;
                return (
                    <Chip
                        key={type.id}
                        label={`${type.emoji || ''} ${type.name} ${n}`}
                        active={active}
                        colorClass={active ? `${colors.chipBg} ${colors.chipText}` : ''}
                        onClick={() => onChange({ ...filter, typeId: active ? 'all' : type.id })}
                    />
                );
            })}
            {untyped > 0 && (
                <Chip
                    label={`Uncategorized ${untyped}`}
                    active={filter.typeId === ''}
                    onClick={() => onChange({ ...filter, typeId: filter.typeId === '' ? 'all' : '' })}
                />
            )}
            <span className="border-l border-slate-200 mx-1" />
            {(['low', 'medium', 'high'] as TaskEnergy[]).map(e => (
                <Chip
                    key={e}
                    label={e}
                    active={filter.energy === e}
                    onClick={() => onChange({ ...filter, energy: filter.energy === e ? 'all' : e })}
                    dotColor={e === 'low' ? 'bg-emerald-400' : e === 'medium' ? 'bg-amber-400' : 'bg-rose-500'}
                />
            ))}
        </div>
    );
};

const Chip: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
    colorClass?: string;
    dotColor?: string;
}> = ({ label, active, onClick, colorClass, dotColor }) => (
    <button
        onClick={onClick}
        className={`whitespace-nowrap flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
            active
                ? colorClass || 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        }`}
    >
        {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
        {label}
    </button>
);

export default TaskFilters;
