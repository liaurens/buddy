/**
 * Tests for the JSON Schema validator used by the agent loop.
 * Re-implemented inline (matches the project pattern for testing
 * Deno edge-function code from vitest).
 *
 * Source: supabase/functions/assistant/core/schema-validator.ts
 */
import { describe, it, expect } from 'vitest';

interface JsonSchema {
    type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    enum?: Array<string | number>;
    items?: JsonSchema;
    format?: string;
}

interface ValidateResult {
    ok: boolean;
    error?: string;
    field?: string;
}

function validate(value: unknown, schema: JsonSchema | undefined, path = ''): ValidateResult {
    if (!schema) return { ok: true };
    const t = schema.type;
    if (t === 'object') {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return { ok: false, error: `expected object at ${path || 'root'}`, field: path };
        }
        const obj = value as Record<string, unknown>;
        if (schema.required) {
            for (const key of schema.required) {
                if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
                    return {
                        ok: false,
                        error: `missing required field "${key}"${path ? ` at ${path}` : ''}`,
                        field: path ? `${path}.${key}` : key,
                    };
                }
            }
        }
        if (schema.properties) {
            for (const [k, sub] of Object.entries(schema.properties)) {
                if (obj[k] === undefined || obj[k] === null) continue;
                const r = validate(obj[k], sub, path ? `${path}.${k}` : k);
                if (!r.ok) return r;
            }
        }
        return { ok: true };
    }
    if (t === 'array') {
        if (!Array.isArray(value))
            return { ok: false, error: `expected array at ${path || 'root'}`, field: path };
        if (schema.items) {
            for (let i = 0; i < value.length; i++) {
                const r = validate(value[i], schema.items, `${path}[${i}]`);
                if (!r.ok) return r;
            }
        }
        return { ok: true };
    }
    if (t === 'string' && typeof value !== 'string') {
        return { ok: false, error: `expected string at ${path || 'root'}`, field: path };
    }
    if (t === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
        return { ok: false, error: `expected integer at ${path || 'root'}`, field: path };
    }
    if (t === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
        return { ok: false, error: `expected number at ${path || 'root'}`, field: path };
    }
    if (t === 'boolean' && typeof value !== 'boolean') {
        return { ok: false, error: `expected boolean at ${path || 'root'}`, field: path };
    }
    if (schema.enum && !schema.enum.includes(value as string | number)) {
        return {
            ok: false,
            error: `value at ${path || 'root'} must be one of ${schema.enum.join(', ')}`,
            field: path,
        };
    }
    return { ok: true };
}

const assignmentSchema: JsonSchema = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        deadline: { type: 'string', format: 'date-time' },
        class_id: { type: 'string' },
        class_name: { type: 'string' },
        reminder_days_before: { type: 'integer' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'submitted', 'graded'] },
    },
    required: ['title', 'deadline'],
};

describe('schema-validator', () => {
    it('accepts a valid school assignment payload', () => {
        const result = validate(
            {
                title: 'Calc problem set 3',
                deadline: '2026-05-12T17:00:00Z',
                class_name: 'Calculus',
                reminder_days_before: 7,
            },
            assignmentSchema,
        );
        expect(result.ok).toBe(true);
    });

    it('flags a missing required field', () => {
        const result = validate({ title: 'Essay' }, assignmentSchema);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/deadline/);
        expect(result.field).toBe('deadline');
    });

    it('rejects integer values that are floats', () => {
        const result = validate(
            { title: 'X', deadline: '2026-05-10T10:00:00Z', reminder_days_before: 1.5 },
            assignmentSchema,
        );
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/integer/);
    });

    it('enforces enum values', () => {
        const result = validate(
            { title: 'X', deadline: '2026-05-10T10:00:00Z', status: 'archived' },
            assignmentSchema,
        );
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/must be one of/);
    });

    it('treats null as missing for required fields', () => {
        const result = validate({ title: 'X', deadline: null }, assignmentSchema);
        expect(result.ok).toBe(false);
        expect(result.field).toBe('deadline');
    });

    it('passes when no schema is provided', () => {
        expect(validate({ anything: 'goes' }, undefined).ok).toBe(true);
    });

    it('reports nested validation errors with a path', () => {
        const nested: JsonSchema = {
            type: 'object',
            properties: {
                offsets: {
                    type: 'object',
                    properties: {
                        days: { type: 'integer' },
                    },
                    required: ['days'],
                },
            },
            required: ['offsets'],
        };
        const result = validate({ offsets: { days: 'not a number' } }, nested);
        expect(result.ok).toBe(false);
        expect(result.field).toBe('offsets.days');
    });
});
