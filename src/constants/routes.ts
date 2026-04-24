/**
 * Application route definitions and hub groupings
 */

export type AppRoute =
    | 'home'
    | 'health'
    | 'protocols'
    | 'experiments'
    | 'planning'
    | 'calendar'
    | 'reflection'
    | 'tasks'
    | 'notes'
    | 'checklists'
    | 'toolbox'
    | 'focus'
    | 'account'
    | 'assistant'
    | 'growth'
    | 'planner'
    | 'browse'
    | 'me'
    | 'today'
    | 'goals'
    | 'notifications';

export const HEALTH_HUB_ROUTES: AppRoute[] = ['health', 'protocols', 'experiments'];
export const CALENDAR_HUB_ROUTES: AppRoute[] = ['calendar', 'planning', 'reflection'];
export const TASKS_HUB_ROUTES: AppRoute[] = ['tasks', 'checklists'];

/** Top-level tabs in the new IA. All other routes are reachable via Browse or deep-links. */
export const TOP_LEVEL_TABS: AppRoute[] = ['home', 'assistant', 'browse', 'me'];
