// Barrel exports for tasks feature
export * from './types';

// Pages
export { default as TodoPage } from './pages/TodoPage';
export { default as NotesPage } from './pages/NotesPage';

// Components
export { default as AITaskSplitter } from './components/AITaskSplitter';
export { default as AIOrganizeModal } from './components/AIOrganizeModal';
export { default as UrgentScheduleModal } from './components/UrgentScheduleModal';
export { default as TriageInbox } from './components/TriageInbox';

// Utils — task kind classification
export { deriveTaskKind, TASK_KIND_META, TASK_KIND_ORDER } from './utils/taskKind';

// Utils — triage routing
export { TRIAGE_DESTINATION_META, TRIAGE_DESTINATION_ORDER } from './utils/triageRouting';

// Hooks
export { useTaskRecommendation } from './hooks/useTaskRecommendation';
export { useTaskTypes } from './hooks/useTaskTypes';
export { useRoutines } from './hooks/useRoutines';
export { useTaskTriage } from './hooks/useTaskTriage';

// Utils
export { getRecommendedTask, getRankedTasks } from './utils/taskRecommender';
