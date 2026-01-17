import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Plus, Trash2, CheckCircle, Circle, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { Task, Subtask } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const TaskList: React.FC = () => {
    const { tasks, addTask, toggleTask, deleteTask, updateTask } = useTasks();
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
    const [newTime, setNewTime] = useState<string>('');

    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        addTask(newTaskTitle, newPriority, newTime ? parseInt(newTime) : undefined);
        setNewTaskTitle('');
        setNewTime('');
        setNewPriority('medium');
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedTasks(newExpanded);
    };

    const addSubtask = (taskId: string, title: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const newSubtask: Subtask = {
            id: uuidv4(),
            title,
            completed: false
        };

        updateTask({
            ...task,
            subtasks: [...(task.subtasks || []), newSubtask]
        });
    };

    const toggleSubtask = (taskId: string, subtaskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.subtasks) return;

        const updatedSubtasks = task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );

        updateTask({ ...task, subtasks: updatedSubtasks });
    };

    const deleteSubtask = (taskId: string, subtaskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.subtasks) return;

        const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
        updateTask({ ...task, subtasks: updatedSubtasks });
    };

    const getPriorityColor = (p?: string) => {
        switch (p) {
            case 'urgent': return 'text-rose-600 bg-rose-50 border-rose-200';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'medium': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'low': return 'text-slate-600 bg-slate-50 border-slate-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const activeTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-semibold mb-4 text-slate-800">My Tasks</h2>

                {/* Add Task Form */}
                <form onSubmit={handleSubmit} className="mb-6 space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="What needs to be done?"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    />
                    <div className="flex gap-2">
                        <select
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value as any)}
                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                        >
                            <option value="urgent">Urgent</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                        <input
                            type="number"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            placeholder="Min"
                            className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                        />
                        <button
                            type="submit"
                            disabled={!newTaskTitle.trim()}
                            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            Add Task
                        </button>
                    </div>
                </form>

                <div className="space-y-3">
                    {activeTasks.length === 0 && completedTasks.length === 0 && (
                        <p className="text-center text-slate-400 py-8">No tasks yet. Break it down!</p>
                    )}

                    {activeTasks.map(task => (
                        <div key={task.id} className="border border-slate-100 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 transition-colors">
                                <button
                                    onClick={() => toggleTask(task.id)}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    <Circle size={20} />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-700 truncate">{task.title}</span>
                                        {task.priority && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${getPriorityColor(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                        )}
                                    </div>
                                    {task.estimatedTime && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                                            <Clock size={12} />
                                            <span>{task.estimatedTime} min</span>
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => toggleExpand(task.id)} className="text-slate-400 hover:text-slate-600">
                                    {expandedTasks.has(task.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>

                                <button
                                    onClick={() => deleteTask(task.id)}
                                    className="text-slate-300 hover:text-rose-500"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Subtasks Section */}
                            {expandedTasks.has(task.id) && (
                                <div className="bg-slate-50 p-3 border-t border-slate-100 pl-10">
                                    <div className="space-y-2 mb-3">
                                        {task.subtasks?.map(subtask => (
                                            <div key={subtask.id} className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleSubtask(task.id, subtask.id)}
                                                    className={`text-sm ${subtask.completed ? 'text-emerald-500' : 'text-slate-400 hover:text-indigo-500'}`}
                                                >
                                                    {subtask.completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                                                </button>
                                                <span className={`text-sm flex-1 ${subtask.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                                    {subtask.title}
                                                </span>
                                                <button onClick={() => deleteSubtask(task.id, subtask.id)} className="text-slate-300 hover:text-rose-500">
                                                    <XIcon size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            const input = (e.target as any).elements.subtask;
                                            if (input.value.trim()) {
                                                addSubtask(task.id, input.value);
                                                input.value = '';
                                            }
                                        }}
                                        className="flex gap-2"
                                    >
                                        <input
                                            name="subtask"
                                            type="text"
                                            placeholder="Add step..."
                                            className="flex-1 px-2 py-1 text-sm rounded border border-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                        <button type="submit" className="bg-white border border-slate-200 p-1 rounded hover:bg-slate-100">
                                            <Plus size={16} className="text-slate-500" />
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ))}

                    {completedTasks.length > 0 && (
                        <div className="pt-4">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Completed</h3>
                            <div className="space-y-2 opacity-60">
                                {completedTasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                        <button
                                            onClick={() => toggleTask(task.id)}
                                            className="text-emerald-500"
                                        >
                                            <CheckCircle size={20} />
                                        </button>
                                        <span className="flex-1 text-slate-500 line-through">{task.title}</span>
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="text-slate-300 hover:text-rose-500"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const XIcon = ({ size }: { size: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default TaskList;
