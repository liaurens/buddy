// Barrel exports for tasks feature.
//
// Keep this list to what other features actually consume. Re-exporting a
// component nobody renders makes it look alive to any "is it imported?" check —
// that is exactly how the 2026-08 audit's dead tree stayed hidden.
export * from './types';

// Pages
export { default as NotesPage } from './pages/NotesPage';

// Hooks
export { useTaskRecommendation } from './hooks/useTaskRecommendation';
export { useTaskTypes } from './hooks/useTaskTypes';
export { useRoutines } from './hooks/useRoutines';
export { useTaskTriage } from './hooks/useTaskTriage';

// Utils
export { getRecommendedTask, getRankedTasks } from './utils/taskRecommender';
