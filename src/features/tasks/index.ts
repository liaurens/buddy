// Barrel exports for tasks feature
export * from './types';

// Pages
export { default as TodoPage } from './pages/TodoPage';
export { default as NotesPage } from './pages/NotesPage';

// Components
export { default as AITaskSplitter } from './components/AITaskSplitter';

// Hooks
export { useTaskRecommendation } from './hooks/useTaskRecommendation';
export { useTaskTypes } from './hooks/useTaskTypes';
export { useRoutines } from './hooks/useRoutines';

// Utils
export { getRecommendedTask, getRankedTasks } from './utils/taskRecommender';
