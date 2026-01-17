import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskState } from '../types';

const TaskContext = createContext<TaskState | undefined>(undefined);

const STORAGE_KEY = 'buddy-app-tasks';

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setTasks(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse stored tasks', e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }, [tasks]);

    const addTask = (title: string, priority?: Task['priority'], estimatedTime?: number) => {
        const newTask: Task = {
            id: uuidv4(),
            title,
            completed: false,
            createdAt: new Date().toISOString(),
            priority: priority || 'medium',
            estimatedTime,
            subtasks: []
        };
        setTasks((prev) => [newTask, ...prev]);
    };

    const toggleTask = (id: string) => {
        setTasks((prev) => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTask = (id: string) => {
        setTasks((prev) => prev.filter(t => t.id !== id));
    };

    const updateTask = (updatedTask: Task) => {
        setTasks((prev) => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    };

    return (
        <TaskContext.Provider value={{ tasks, addTask, toggleTask, deleteTask, updateTask }}>
            {children}
        </TaskContext.Provider>
    );
};

export const useTasks = () => {
    const context = useContext(TaskContext);
    if (context === undefined) {
        throw new Error('useTasks must be used within a TaskProvider');
    }
    return context;
};
