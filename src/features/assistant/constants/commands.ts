/**
 * Offline fallback for the slash-command hint dropdown. The runtime source of
 * truth is the backend `system.commands` action, exposed via
 * `useAssistantCommands()`. This list is only used when that request fails
 * (no auth, edge function down, etc.).
 */
export interface AssistantCommand {
    command: string;
    description: string;
    example?: string;
    /** Top-tier commands shown in the compact hint list before "Show all". */
    primary?: boolean;
}

export const COMMANDS: AssistantCommand[] = [
    { command: '/task', description: 'Create a task', example: '/task Fix bike tire by friday', primary: true },
    { command: '/note', description: 'Create a note', example: '/note Meeting notes from today', primary: true },
    { command: '/checkin', description: 'Log health', example: '/checkin mood 4 energy 3', primary: true },
    { command: '/remind', description: 'Set reminder', example: '/remind 14:00 call dentist', primary: true },
    { command: '/done', description: 'Complete a task', example: '/done fix bike' },
    { command: '/today', description: "Today's tasks", example: '/today' },
    { command: '/task.list', description: 'List all tasks', example: '/task.list' },
    { command: '/shop', description: 'Shopping list', example: '/shop Milk and cheese' },
    { command: '/find', description: 'Search notes', example: '/find machine learning' },
    { command: '/health', description: 'Health query', example: '/health how was my sleep?' },
    { command: '/agenda', description: "Today's events", example: '/agenda' },
    { command: '/help', description: 'Show all commands', example: '/help' },
];
