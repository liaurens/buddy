import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Plus, Trash2, CheckCircle, Circle, Calendar as CalendarIcon } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

const TodoPage: React.FC = () => {
    // Queries - filter in memory since 'completed' is not indexed
    const allTodos = useLiveQuery(() => db.todos.orderBy('createdAt').reverse().toArray()) || [];
    const activeTodos = allTodos.filter(t => !t.completed);
    const completedTodos = allTodos.filter(t => t.completed).slice(0, 10);

    const [newTask, setNewTask] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [dueDate, setDueDate] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        await db.todos.add({
            id: window.crypto.randomUUID(),
            title: newTask,
            completed: false,
            priority: priority,
            dueDate: dueDate || undefined,
            createdAt: new Date().toISOString()
        });
        setNewTask('');
        setPriority('medium');
        setDueDate('');
    };

    const toggleComplete = async (todo: any) => {
        await db.todos.update(todo.id, { completed: !todo.completed });
    };

    const handleDelete = async (id: string) => {
        await db.todos.delete(id);
    };

    const getPriorityColor = (p?: string) => {
        if (p === 'high') return 'text-rose-500 bg-rose-50';
        if (p === 'low') return 'text-blue-500 bg-blue-50';
        return 'text-amber-500 bg-amber-50';
    };

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                        <CheckCircle size={24} />
                    </div>
                    Tasks
                </h1>
            </header>

            {/* Input */}
            <form onSubmit={handleAdd} className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-2">
                <input
                    className="flex-1 p-3 text-lg outline-none rounded-xl"
                    placeholder="Add a new task..."
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                />
                <div className="flex gap-2 p-1">
                    <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as any)}
                        className="bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Med</option>
                        <option value="high">High</option>
                    </select>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={!newTask.trim()} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        <Plus size={20} />
                    </button>
                </div>
            </form>

            <div className="space-y-4">
                {/* Active List */}
                <div className="space-y-2">
                    {activeTodos.map(todo => (
                        <div key={todo.id} className="group flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                            <button
                                onClick={() => toggleComplete(todo)}
                                className="mt-0.5 text-slate-300 hover:text-indigo-600 transition-colors"
                            >
                                <Circle size={24} />
                            </button>
                            <div className="flex-1">
                                <p className="font-medium text-slate-800 text-lg leading-tight">{todo.title}</p>
                                <div className="flex gap-3 mt-2 text-xs">
                                    {todo.priority && (
                                        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getPriorityColor(todo.priority)}`}>
                                            {todo.priority}
                                        </span>
                                    )}
                                    {todo.dueDate && (
                                        <span className={`flex items-center gap-1 font-medium ${isPast(new Date(todo.dueDate)) && !isToday(new Date(todo.dueDate)) ? 'text-rose-500' :
                                            isToday(new Date(todo.dueDate)) ? 'text-amber-600' : 'text-slate-400'
                                            }`}>
                                            <CalendarIcon size={12} />
                                            {format(new Date(todo.dueDate), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => handleDelete(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-opacity">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}

                    {activeTodos.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-slate-400">No active tasks. Enjoy your day!</p>
                        </div>
                    )}
                </div>

                {/* Completed */}
                {completedTodos.length > 0 && (
                    <div className="pt-8 opacity-60 hover:opacity-100 transition-opacity">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Completed recently</h3>
                        <div className="space-y-2">
                            {completedTodos.map(todo => (
                                <div key={todo.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <button onClick={() => toggleComplete(todo)} className="text-emerald-500">
                                        <CheckCircle size={20} />
                                    </button>
                                    <span className="text-slate-500 line-through decoration-slate-300 flex-1">{todo.title}</span>
                                    <button onClick={() => handleDelete(todo.id)} className="text-slate-300 hover:text-rose-500">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TodoPage;
