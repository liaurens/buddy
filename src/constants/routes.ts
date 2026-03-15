/**
 * Application route definitions and hub groupings
 */

export type AppRoute =
    | 'home'
    | 'health'
    | 'protocols'
    | 'experiments'
    | 'check-in'
    | 'planning'
    | 'calendar'
    | 'reflection'
    | 'tasks'
    | 'notes'
    | 'checklists'
    | 'toolbox'
    | 'focus'
    | 'account'
    | 'assistant';

export const HEALTH_HUB_ROUTES: AppRoute[] = ['health', 'protocols', 'experiments'];
export const CALENDAR_HUB_ROUTES: AppRoute[] = ['calendar', 'planning', 'reflection'];
export const TASKS_HUB_ROUTES: AppRoute[] = ['tasks', 'checklists'];
