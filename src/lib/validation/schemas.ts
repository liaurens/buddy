/**
 * Validation schemas using Zod
 * Provides type-safe input validation across the application
 */

import { z } from 'zod';

/**
 * Generic URL Validation with SSRF Protection
 */
export const safeUrlSchema = z
    .string()
    .url('Please enter a valid URL')
    .refine(
        (url) => {
            try {
                const urlObj = new URL(url);
                // Block private IP ranges
                const hostname = urlObj.hostname;

                // Block localhost
                if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
                    return false;
                }

                // Block private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
                const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
                const match = hostname.match(ipv4Regex);
                if (match) {
                    const [, a, b] = match.map(Number);
                    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
                        return false;
                    }
                }

                return true;
            } catch {
                return false;
            }
        },
        {
            message: 'URL cannot point to private or internal networks',
        },
    );

/**
 * Calendar Configuration Validation
 */
export const calendarConfigSchema = z.object({
    calendarUrl: safeUrlSchema.refine(
        (url) => {
            // Whitelist for common calendar providers
            const allowedDomains = [
                'calendar.google.com',
                'outlook.office365.com',
                'outlook.live.com',
                'p-cdn.icloud.com',
                'p.icloud.com',
                'caldav.icloud.com',
            ];

            try {
                const urlObj = new URL(url);
                return allowedDomains.some((domain) => urlObj.hostname.includes(domain));
            } catch {
                return false;
            }
        },
        {
            message:
                'URL must be from a supported calendar provider (Google Calendar, Outlook, or iCloud)',
        },
    ),
    calendarName: z
        .string()
        .min(1, 'Calendar name is required')
        .max(100, 'Calendar name must be less than 100 characters')
        .optional()
        .default('My Calendar'),
});

/**
 * Tracker Definition Validation
 */
export const trackerDefinitionSchema = z.object({
    name: z
        .string()
        .min(1, 'Tracker name is required')
        .max(50, 'Tracker name must be less than 50 characters')
        .trim(),
    emoji: z.string().max(10, 'Emoji must be less than 10 characters').optional(),
    type: z.enum(['number', 'rating', 'boolean', 'text']),
    unit: z.string().max(20, 'Unit must be less than 20 characters').optional(),
    group: z.string().max(50, 'Group must be less than 50 characters').default('Custom'),
    goal: z
        .object({
            target: z.number().min(0, 'Goal target must be a positive number'),
            condition: z.enum(['gt', 'lt', 'eq']),
        })
        .optional(),
});

/**
 * AI Configuration Validation
 */
export const aiConfigSchema = z
    .object({
        provider: z.enum(['openai', 'anthropic', 'gemini']),
        apiKey: z
            .string()
            .min(1, 'API key is required')
            .min(10, 'API key is too short')
            .max(500, 'API key is too long')
            .trim(),
        model: z.string().max(100, 'Model name is too long').optional(),
    })
    .refine(
        (data) => {
            // Provider-specific API key validation
            if (data.provider === 'openai') {
                return data.apiKey.startsWith('sk-');
            }
            if (data.provider === 'anthropic') {
                return data.apiKey.startsWith('sk-ant-');
            }
            // Gemini keys start with 'AI' typically
            if (data.provider === 'gemini') {
                return data.apiKey.startsWith('AI') || data.apiKey.length > 20;
            }
            return true;
        },
        {
            message: 'Invalid API key format for the selected provider',
            path: ['apiKey'],
        },
    );

/**
 * Data Import Validation
 * Validates the structure of imported JSON data
 */
export const dataImportSchema = z
    .object({
        trackers: z.array(z.any()).optional(),
        entries: z.array(z.any()).optional(),
        protocols: z.array(z.any()).optional(),
        strategies: z.array(z.any()).optional(),
        todos: z.array(z.any()).optional(),
        settings: z.record(z.string(), z.any()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message:
            'Import data must contain at least one of: trackers, entries, protocols, strategies, todos, or settings',
    });

/**
 * Quick Note API Key Validation
 */
export const apiKeySchema = z.string().regex(/^qn_[a-f0-9]{32}$/, 'Invalid API key format');
