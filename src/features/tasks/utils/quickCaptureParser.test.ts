import { describe, it, expect } from 'vitest';
import { parseQuickCapture } from './quickCaptureParser';
import type { TaskType } from '../types';

const TYPES: TaskType[] = [
    {
        id: 'email-id',
        name: 'Email',
        emoji: '📧',
        color: 'indigo',
        sortOrder: 0,
        isPreset: true,
        createdAt: '',
    },
    {
        id: 'home-id',
        name: 'Home',
        emoji: '🧹',
        color: 'emerald',
        sortOrder: 1,
        isPreset: true,
        createdAt: '',
    },
    {
        id: 'study-id',
        name: 'Study',
        emoji: '📚',
        color: 'violet',
        sortOrder: 2,
        isPreset: true,
        createdAt: '',
    },
    {
        id: 'errands-id',
        name: 'Errands',
        emoji: '🛒',
        color: 'amber',
        sortOrder: 3,
        isPreset: true,
        createdAt: '',
    },
    {
        id: 'health-id',
        name: 'Health',
        emoji: '💪',
        color: 'rose',
        sortOrder: 5,
        isPreset: true,
        createdAt: '',
    },
];

// 2026-05-12 = Tuesday
const NOW = new Date('2026-05-12T10:00:00');

describe('parseQuickCapture', () => {
    it('returns an empty title for empty input', () => {
        expect(parseQuickCapture('', TYPES, NOW)).toEqual({ title: '' });
    });

    it('detects Email type', () => {
        const r = parseQuickCapture('email mom about lease', TYPES, NOW);
        expect(r.taskTypeId).toBe('email-id');
        expect(r.title).toBe('email mom about lease');
    });

    it('detects Home type (clean room)', () => {
        const r = parseQuickCapture('clean room', TYPES, NOW);
        expect(r.taskTypeId).toBe('home-id');
    });

    it('detects Errands type (pharmacy pickup)', () => {
        const r = parseQuickCapture('pharmacy pickup', TYPES, NOW);
        expect(r.taskTypeId).toBe('errands-id');
    });

    it('parses "tomorrow"', () => {
        const r = parseQuickCapture('email boss tomorrow', TYPES, NOW);
        expect(r.dueDate).toBe('2026-05-13');
    });

    it('parses "tonight" with default 20:00', () => {
        const r = parseQuickCapture('clean room tonight', TYPES, NOW);
        expect(r.dueDate).toBe('2026-05-12');
        expect(r.dueTime).toBe('20:00');
    });

    it('parses 12h time "2pm"', () => {
        const r = parseQuickCapture('email mom tomorrow 2pm', TYPES, NOW);
        expect(r.dueTime).toBe('14:00');
        expect(r.dueDate).toBe('2026-05-13');
        expect(r.title.toLowerCase()).toContain('email mom');
    });

    it('parses 24h time "at 14:00"', () => {
        const r = parseQuickCapture('clean kitchen at 14:00', TYPES, NOW);
        expect(r.dueTime).toBe('14:00');
    });

    it('parses next weekday name', () => {
        // NOW is Tue 2026-05-12, "friday" should give the next Friday = 2026-05-15
        const r = parseQuickCapture('study chapter 4 friday', TYPES, NOW);
        expect(r.dueDate).toBe('2026-05-15');
    });

    it('parses "in 3 days"', () => {
        const r = parseQuickCapture('review essay in 3 days', TYPES, NOW);
        expect(r.dueDate).toBe('2026-05-15');
    });

    it('parses "next week"', () => {
        const r = parseQuickCapture('meeting next week', TYPES, NOW);
        expect(r.dueDate).toBe('2026-05-19');
    });

    it('parses priority "!!" → urgent', () => {
        const r = parseQuickCapture('!! reply to professor', TYPES, NOW);
        expect(r.priority).toBe('urgent');
        expect(r.title).toBe('reply to professor');
    });

    it('parses priority "!" → high', () => {
        const r = parseQuickCapture('! clean room', TYPES, NOW);
        expect(r.priority).toBe('high');
    });

    it('parses energy prefix', () => {
        const r = parseQuickCapture('low energy: read chapter 4', TYPES, NOW);
        expect(r.energy).toBe('low');
        expect(r.title.toLowerCase()).toContain('read chapter 4');
    });

    it('parses high energy mid-sentence', () => {
        const r = parseQuickCapture('clean room high energy', TYPES, NOW);
        expect(r.energy).toBe('high');
        expect(r.taskTypeId).toBe('home-id');
    });

    it('combines all signals', () => {
        const r = parseQuickCapture('!! email professor tomorrow 9am', TYPES, NOW);
        expect(r.priority).toBe('urgent');
        expect(r.taskTypeId).toBe('email-id');
        expect(r.dueDate).toBe('2026-05-13');
        expect(r.dueTime).toBe('09:00');
    });

    it('returns no taskTypeId when no keyword matches', () => {
        const r = parseQuickCapture('random thing to do', TYPES, NOW);
        expect(r.taskTypeId).toBeUndefined();
    });

    it('parses "!!!" → urgent priority and urgent kind', () => {
        const r = parseQuickCapture('!!! call the dentist', TYPES, NOW);
        expect(r.priority).toBe('urgent');
        expect(r.kind).toBe('urgent');
        expect(r.title).toBe('call the dentist');
    });

    it('does not set a kind for plain "!!"', () => {
        const r = parseQuickCapture('!! reply to professor', TYPES, NOW);
        expect(r.priority).toBe('urgent');
        expect(r.kind).toBeUndefined();
    });

    it('parses "someday" → backlog kind and strips the keyword', () => {
        const r = parseQuickCapture('learn guitar someday', TYPES, NOW);
        expect(r.kind).toBe('backlog');
        expect(r.title.toLowerCase()).toContain('learn guitar');
        expect(r.title.toLowerCase()).not.toContain('someday');
    });
});
