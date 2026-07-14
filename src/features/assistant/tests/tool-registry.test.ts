/**
 * Tests for the tool registration system and domain managers.
 *
 * Validates that the registry pattern works correctly:
 * - All tools have valid definitions
 * - Commands are unique
 * - Domain managers find their tools
 * - Actions resolve correctly
 */
import { describe, it, expect } from 'vitest';

// ─── Types (mirrors types.ts) ────────────────────────────────────────────────

type Domain =
    | 'planning'
    | 'health'
    | 'mental'
    | 'content'
    | 'improvement'
    | 'studying'
    | 'projects'
    | 'extra';

interface ActionDefinition {
    action: string;
    description: string;
    handler: (params: Record<string, unknown>, context: unknown) => Promise<unknown>;
}

interface CommandDefinition {
    command: string;
    action: string;
    description: string;
}

interface RuleDefinition {
    pattern: RegExp;
    action: string;
    extractParams?: (match: RegExpMatchArray, input: string) => Record<string, unknown>;
}

interface ToolDefinition {
    id: string;
    domain: Domain;
    description: string;
    actions: ActionDefinition[];
    commands: CommandDefinition[];
    rules: RuleDefinition[];
}

// ─── Mock tools (simulates what the registry contains) ───────────────────────

const mockTools: ToolDefinition[] = [
    {
        id: 'tasks',
        domain: 'planning',
        description: 'Create, list, and complete tasks',
        actions: [
            { action: 'task.create', description: 'Create', handler: async () => ({}) },
            { action: 'task.list', description: 'List', handler: async () => ({}) },
            { action: 'task.list.today', description: 'Today', handler: async () => ({}) },
            { action: 'task.complete', description: 'Complete', handler: async () => ({}) },
        ],
        commands: [
            { command: '/task', action: 'task.create', description: 'Create task' },
            { command: '/task.list', action: 'task.list', description: 'List tasks' },
            { command: '/today', action: 'task.list.today', description: 'Today tasks' },
            { command: '/done', action: 'task.complete', description: 'Complete task' },
        ],
        rules: [],
    },
    {
        id: 'notes',
        domain: 'content',
        description: 'Notes',
        actions: [
            { action: 'note.create', description: 'Create', handler: async () => ({}) },
            { action: 'note.query', description: 'Query', handler: async () => ({}) },
        ],
        commands: [
            { command: '/note', action: 'note.create', description: 'Create note' },
            { command: '/find', action: 'note.query', description: 'Find notes' },
        ],
        rules: [],
    },
    {
        id: 'tracker',
        domain: 'health',
        description: 'Health tracker',
        actions: [
            { action: 'tracker.checkin', description: 'Check in', handler: async () => ({}) },
        ],
        commands: [{ command: '/checkin', action: 'tracker.checkin', description: 'Check in' }],
        rules: [],
    },
];

// ─── Manager factory (mirrors base.manager.ts) ──────────────────────────────

function createDomainManager(domain: Domain, allTools: ToolDefinition[]) {
    const tools = allTools.filter((t) => t.domain === domain);
    const actionMap = new Map<string, ActionDefinition['handler']>();
    for (const tool of tools) {
        for (const action of tool.actions) {
            actionMap.set(action.action, action.handler);
        }
    }

    return {
        domain,
        tools,
        hasAction: (action: string) => actionMap.has(action),
        execute: async (action: string, params: Record<string, unknown>) => {
            const handler = actionMap.get(action);
            if (!handler) return { success: false };
            return handler(params, {});
        },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tool Registry', () => {
    it('all tools have unique IDs', () => {
        const ids = mockTools.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('all commands are unique across tools', () => {
        const commands = mockTools.flatMap((t) => t.commands.map((c) => c.command));
        expect(new Set(commands).size).toBe(commands.length);
    });

    it('all command actions reference valid actions in their tool', () => {
        for (const tool of mockTools) {
            const validActions = new Set(tool.actions.map((a) => a.action));
            for (const cmd of tool.commands) {
                expect(validActions.has(cmd.action)).toBe(true);
            }
        }
    });

    it('all tools have a valid domain', () => {
        const validDomains: Domain[] = [
            'planning',
            'health',
            'mental',
            'content',
            'improvement',
            'studying',
            'projects',
            'extra',
        ];
        for (const tool of mockTools) {
            expect(validDomains).toContain(tool.domain);
        }
    });

    it('all tools have at least one action', () => {
        for (const tool of mockTools) {
            expect(tool.actions.length).toBeGreaterThan(0);
        }
    });

    it('all tools have a description', () => {
        for (const tool of mockTools) {
            expect(tool.description.length).toBeGreaterThan(0);
        }
    });
});

describe('Domain Manager', () => {
    it('planning manager finds task actions', () => {
        const manager = createDomainManager('planning', mockTools);
        expect(manager.tools.length).toBe(1);
        expect(manager.tools[0].id).toBe('tasks');
        expect(manager.hasAction('task.create')).toBe(true);
        expect(manager.hasAction('task.list')).toBe(true);
        expect(manager.hasAction('task.complete')).toBe(true);
    });

    it('content manager finds note actions', () => {
        const manager = createDomainManager('content', mockTools);
        expect(manager.tools.length).toBe(1);
        expect(manager.hasAction('note.create')).toBe(true);
        expect(manager.hasAction('note.query')).toBe(true);
    });

    it('health manager finds tracker actions', () => {
        const manager = createDomainManager('health', mockTools);
        expect(manager.hasAction('tracker.checkin')).toBe(true);
    });

    it('manager does not have actions from other domains', () => {
        const planningManager = createDomainManager('planning', mockTools);
        expect(planningManager.hasAction('note.create')).toBe(false);
        expect(planningManager.hasAction('tracker.checkin')).toBe(false);
    });

    it('empty domain has no tools', () => {
        const manager = createDomainManager('mental', mockTools);
        expect(manager.tools.length).toBe(0);
        expect(manager.hasAction('anything')).toBe(false);
    });
});

describe('Command Map auto-build from registry', () => {
    it('builds a complete command map', () => {
        const commandMap = new Map<string, { domain: string; action: string }>();
        for (const tool of mockTools) {
            for (const cmd of tool.commands) {
                commandMap.set(cmd.command, { domain: tool.domain, action: cmd.action });
            }
        }

        expect(commandMap.get('/task')).toEqual({ domain: 'planning', action: 'task.create' });
        expect(commandMap.get('/note')).toEqual({ domain: 'content', action: 'note.create' });
        expect(commandMap.get('/checkin')).toEqual({ domain: 'health', action: 'tracker.checkin' });
        expect(commandMap.size).toBe(7); // total commands across all mock tools
    });
});
