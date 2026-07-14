import { describe, it, expect } from 'vitest';
import { sanitizeOrganizeSuggestions } from './organizeSuggestions';

const tasks = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
const taskTypes = [{ id: 'email' }, { id: 'home' }];

describe('sanitizeOrganizeSuggestions', () => {
    it('accepts a well-formed object payload', () => {
        const raw = {
            suggestions: [
                {
                    id: 't1',
                    taskTypeId: 'email',
                    kind: 'urgent',
                    priority: 'high',
                    dueDate: '2026-07-01',
                    reason: 'time-sensitive',
                },
            ],
        };
        const out = sanitizeOrganizeSuggestions(raw, tasks, taskTypes);
        expect(out).toEqual([
            {
                id: 't1',
                taskTypeId: 'email',
                kind: 'urgent',
                priority: 'high',
                dueDate: '2026-07-01',
                reason: 'time-sensitive',
            },
        ]);
    });

    it('accepts a bare array payload', () => {
        const raw = [
            {
                id: 't2',
                taskTypeId: 'home',
                kind: 'standard',
                priority: 'medium',
                dueDate: null,
                reason: '',
            },
        ];
        const out = sanitizeOrganizeSuggestions(raw, tasks, taskTypes);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('t2');
    });

    it('drops suggestions for unknown task ids', () => {
        const raw = { suggestions: [{ id: 'ghost', kind: 'urgent', priority: 'high' }] };
        expect(sanitizeOrganizeSuggestions(raw, tasks, taskTypes)).toEqual([]);
    });

    it('clamps invalid kind and priority to safe defaults', () => {
        const raw = { suggestions: [{ id: 't1', kind: 'nonsense', priority: 'critical' }] };
        const [s] = sanitizeOrganizeSuggestions(raw, tasks, taskTypes);
        expect(s.kind).toBe('standard');
        expect(s.priority).toBe('medium');
    });

    it('nulls out unknown task types and malformed dates', () => {
        const raw = {
            suggestions: [
                {
                    id: 't1',
                    taskTypeId: 'does-not-exist',
                    kind: 'backlog',
                    priority: 'low',
                    dueDate: '07/01/2026',
                },
            ],
        };
        const [s] = sanitizeOrganizeSuggestions(raw, tasks, taskTypes);
        expect(s.taskTypeId).toBeNull();
        expect(s.dueDate).toBeNull();
    });

    it('keeps only the first suggestion per id', () => {
        const raw = {
            suggestions: [
                { id: 't1', kind: 'urgent', priority: 'high' },
                { id: 't1', kind: 'backlog', priority: 'low' },
            ],
        };
        const out = sanitizeOrganizeSuggestions(raw, tasks, taskTypes);
        expect(out).toHaveLength(1);
        expect(out[0].kind).toBe('urgent');
    });

    it('returns [] for non-array, non-object payloads', () => {
        expect(sanitizeOrganizeSuggestions(null, tasks, taskTypes)).toEqual([]);
        expect(sanitizeOrganizeSuggestions('oops', tasks, taskTypes)).toEqual([]);
        expect(sanitizeOrganizeSuggestions({ nope: true }, tasks, taskTypes)).toEqual([]);
    });
});
