import { describe, it, expect } from 'vitest';
import { sanitizeTriageSuggestions } from './sanitizeTriageSuggestions';

const inbox = ['t1', 't2', 't3'];
const assignments = ['a1', 'a2'];

describe('sanitizeTriageSuggestions', () => {
    it('accepts a well-formed object payload', () => {
        const raw = {
            suggestions: [
                {
                    id: 't1',
                    destination: 'today',
                    confidence: 'high',
                    dueTime: '14:30',
                    reason: 'do it',
                },
            ],
        };
        const [s] = sanitizeTriageSuggestions(raw, inbox, assignments);
        expect(s.id).toBe('t1');
        expect(s.destination).toBe('today');
        expect(s.confidence).toBe(1);
        expect(s.dueTime).toBe('14:30');
        expect(s.reason).toBe('do it');
    });

    it('accepts a bare array payload', () => {
        const raw = [{ id: 't2', destination: 'someday', reason: '' }];
        const out = sanitizeTriageSuggestions(raw, inbox, assignments);
        expect(out).toHaveLength(1);
        expect(out[0].destination).toBe('someday');
    });

    it('drops suggestions for tasks not in the inbox', () => {
        const raw = { suggestions: [{ id: 'ghost', destination: 'urgent' }] };
        expect(sanitizeTriageSuggestions(raw, inbox, assignments)).toEqual([]);
    });

    it('clamps an invalid destination to today', () => {
        const [s] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'nonsense' }] },
            inbox,
            assignments,
        );
        expect(s.destination).toBe('today');
    });

    it('keeps school as a loose school task when the assignment is unknown', () => {
        const raw = { suggestions: [{ id: 't1', destination: 'school', assignmentId: 'ghost' }] };
        const [s] = sanitizeTriageSuggestions(raw, inbox, assignments);
        expect(s.destination).toBe('school');
        expect(s.assignmentId).toBeNull();
    });

    it('keeps school with a valid assignment id', () => {
        const raw = { suggestions: [{ id: 't1', destination: 'school', assignmentId: 'a2' }] };
        const [s] = sanitizeTriageSuggestions(raw, inbox, assignments);
        expect(s.destination).toBe('school');
        expect(s.assignmentId).toBe('a2');
    });

    it('keeps an incomplete routine in review until recurrence is confirmed', () => {
        const [s] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'routine', recurrence: 'fortnightly' }] },
            inbox,
            assignments,
        );
        expect(s.destination).toBe('routine');
        expect(s.recurrence).toBeNull();
        expect(s.confidence).toBeLessThan(0.8);
    });

    it('only keeps dueTime for the today destination and validates HH:MM', () => {
        const bad = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', dueTime: '25:99' }] },
            inbox,
            assignments,
        );
        expect(bad[0].dueTime).toBeNull();
        const someday = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't2', destination: 'someday', dueTime: '09:00' }] },
            inbox,
            assignments,
        );
        expect(someday[0].dueTime).toBeNull();
    });

    it('keeps only the first suggestion per id', () => {
        const raw = {
            suggestions: [
                { id: 't1', destination: 'urgent' },
                { id: 't1', destination: 'someday' },
            ],
        };
        const out = sanitizeTriageSuggestions(raw, inbox, assignments);
        expect(out).toHaveLength(1);
        expect(out[0].destination).toBe('urgent');
    });

    it('returns [] for non-array, non-object payloads', () => {
        expect(sanitizeTriageSuggestions(null, inbox, assignments)).toEqual([]);
        expect(sanitizeTriageSuggestions('oops', inbox, assignments)).toEqual([]);
        expect(sanitizeTriageSuggestions({ nope: true }, inbox, assignments)).toEqual([]);
    });

    it('defaults missing/invalid confidence to low', () => {
        const [a] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today' }] },
            inbox,
            assignments,
        );
        expect(a.confidence).toBe(0.5);
        const [b] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', confidence: 'HIGH' }] },
            inbox,
            assignments,
        );
        expect(b.confidence).toBe(0.5);
        const [c] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', confidence: 'high' }] },
            inbox,
            assignments,
        );
        expect(c.confidence).toBe(1);
    });

    it('clamps the metadata fields', () => {
        const raw = {
            suggestions: [
                {
                    id: 't1',
                    destination: 'today',
                    hardness: 'rigid',
                    context: 'spaceship',
                    energy: 'medium',
                    estimatedMinutes: -5,
                    location: '   Desk  ',
                },
            ],
        };
        const [s] = sanitizeTriageSuggestions(raw, inbox, assignments);
        expect(s.hardness).toBeNull(); // invalid enum dropped
        expect(s.context).toBeNull(); // invalid enum dropped
        expect(s.energy).toBe('medium'); // valid enum kept
        expect(s.estimatedMinutes).toBeNull(); // non-positive dropped
        expect(s.location).toBe('Desk'); // trimmed
    });

    it('keeps a sane estimatedMinutes and caps absurd ones', () => {
        const [s] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', estimatedMinutes: 90 }] },
            inbox,
            assignments,
        );
        expect(s.estimatedMinutes).toBe(90);
        const [big] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't2', destination: 'today', estimatedMinutes: 99999 }] },
            inbox,
            assignments,
        );
        expect(big.estimatedMinutes).toBe(1440); // capped at one day
    });
});

describe('taskTypeName resolution', () => {
    const types = [
        { id: 'type-study', name: 'Study' },
        { id: 'type-admin', name: 'Admin' },
    ];

    it('resolves a known name case-insensitively to its id', () => {
        const [s] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', taskTypeName: 'study' }] },
            inbox,
            assignments,
            types,
        );
        expect(s.taskTypeId).toBe('type-study');
    });

    it('drops unknown or missing names to null', () => {
        const [unknown] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', taskTypeName: 'Hobbies' }] },
            inbox,
            assignments,
            types,
        );
        expect(unknown.taskTypeId).toBeNull();
        const [missing] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't2', destination: 'today' }] },
            inbox,
            assignments,
            types,
        );
        expect(missing.taskTypeId).toBeNull();
    });

    it('is null when no task types are provided', () => {
        const [s] = sanitizeTriageSuggestions(
            { suggestions: [{ id: 't1', destination: 'today', taskTypeName: 'Study' }] },
            inbox,
            assignments,
        );
        expect(s.taskTypeId).toBeNull();
    });
});
