// Backward compatibility wrapper - delegates to useTasks hook
import React, { createContext, useContext } from 'react';
import type { TaskState } from '../types';
import { useTasks as useTasksHook } from '../features/tasks/hooks/useTasks';

const TaskContext = createContext<TaskState | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const taskState = useTasksHook();
    return (
        <TaskContext.Provider value={taskState}>
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
