import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Task, TaskState } from '../types';

const TaskContext = createContext<TaskState | undefined>(undefined);

// Key for tracking migration from localStorage
const MIGRATION_KEY = 'buddy-tasks-migrated-to-dexie';
const OLD_STORAGE_KEY = 'buddy-app-tasks';

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false);

    // Migrate from localStorage to Dexie on first load
    useEffect(() => {
        const migrateFromLocalStorage = async () => {
            const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
            if (alreadyMigrated) {
                setIsInitialized(true);
                return;
            }

            const stored = localStorage.getItem(OLD_STORAGE_KEY);
            if (stored) {
                try {
                    const oldTasks: Task[] = JSON.parse(stored);
                    if (oldTasks.length > 0) {
                        // Migrate tasks to Dexie
                        await db.todos.bulkPut(oldTasks);
                        console.log(`Migrated ${oldTasks.length} tasks from localStorage to Dexie`);
                    }
                } catch (e) {
                    console.error('Failed to migrate tasks from localStorage:', e);
                }
            }

            // Mark as migrated
            localStorage.setItem(MIGRATION_KEY, 'true');
            setIsInitialized(true);
        };

        migrateFromLocalStorage();
    }, []);

    // Use Dexie live query for reactive updates
    const tasks = useLiveQuery(
        () => db.todos.orderBy('createdAt').reverse().toArray(),
        [],
        []
    ) as Task[];

    const addTask = useCallback(async (title: string, priority?: Task['priority'], estimatedTime?: number) => {
        const newTask: Task = {
            id: uuidv4(),
            title,
            completed: false,
            createdAt: new Date().toISOString(),
            priority: priority || 'medium',
            estimatedTime,
            subtasks: []
        };
        await db.todos.add(newTask);
    }, []);

    const toggleTask = useCallback(async (id: string) => {
        const task = await db.todos.get(id);
        if (task) {
            await db.todos.update(id, { completed: !task.completed });
        }
    }, []);

    const deleteTask = useCallback(async (id: string) => {
        await db.todos.delete(id);
    }, []);

    const updateTask = useCallback(async (updatedTask: Task) => {
        const { id, ...updates } = updatedTask;
        await db.todos.update(id, updates);
    }, []);

    // Show loading state while initializing
    if (!isInitialized) {
        return null;
    }

    return (
        <TaskContext.Provider value={{ tasks: tasks || [], addTask, toggleTask, deleteTask, updateTask }}>
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
