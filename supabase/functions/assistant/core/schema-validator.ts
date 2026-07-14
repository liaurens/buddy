/**
 * Minimal JSON Schema validator for tool inputs.
 *
 * Supports the subset we use in tool input_schema:
 * type (object/string/number/integer/boolean/array), properties, required, enum, items, format.
 *
 * Returns a friendly error string the agent loop can feed back to the model
 * so it can self-correct on the next turn.
 */

import type { JsonSchema } from '../types.ts';

export interface ValidateResult {
    ok: boolean;
    error?: string;
    field?: string;
}

export function validate(
    value: unknown,
    schema: JsonSchema | undefined,
    path = '',
): ValidateResult {
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
        if (!Array.isArray(value)) {
            return { ok: false, error: `expected array at ${path || 'root'}`, field: path };
        }
        if (schema.items) {
            for (let i = 0; i < value.length; i++) {
                const r = validate(value[i], schema.items, `${path}[${i}]`);
                if (!r.ok) return r;
            }
        }
        return { ok: true };
    }

    if (t === 'string') {
        if (typeof value !== 'string') {
            return { ok: false, error: `expected string at ${path || 'root'}`, field: path };
        }
    } else if (t === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            return { ok: false, error: `expected integer at ${path || 'root'}`, field: path };
        }
    } else if (t === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return { ok: false, error: `expected number at ${path || 'root'}`, field: path };
        }
    } else if (t === 'boolean') {
        if (typeof value !== 'boolean') {
            return { ok: false, error: `expected boolean at ${path || 'root'}`, field: path };
        }
    }

    if (schema.enum && !schema.enum.includes(value as string | number)) {
        return {
            ok: false,
            error: `value at ${path || 'root'} must be one of ${schema.enum.join(', ')}; got ${JSON.stringify(value)}`,
            field: path,
        };
    }

    return { ok: true };
}
