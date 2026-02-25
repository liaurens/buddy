// Barrel exports for tasks feature
export * from './types';

// Pages
export { default as TodoPage } from './pages/TodoPage';
export { default as NotesPage } from './pages/NotesPage';

// Components
export { default as HabitDashboard } from './components/HabitDashboard';
export { default as StreakCalendar } from './components/StreakCalendar';
export { default as AITaskSplitter } from './components/AITaskSplitter';

// Hooks
export { useStreak } from './hooks/useStreak';
export { useTaskRecommendation } from './hooks/useTaskRecommendation';

// Utils
export { calculateStreak, getCompletionCalendar } from './utils/streakCalculator';
export { getRecommendedTask, getRankedTasks } from './utils/taskRecommender';
