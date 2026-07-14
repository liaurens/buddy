/**
 * Tests for the HR Agent analyzer functions.
 *
 * Tests pattern detection over mock log data.
 */
import { describe, it, expect } from 'vitest';

// ─── Analyzer functions (mirrors hr-agent/analyzer.ts) ───────────────────────

type LogEntry = Record<string, unknown>;

interface Finding {
    type: string;
    severity: string;
    data: Record<string, unknown>;
}

function analyzeUnmatchedPatterns(logs: LogEntry[]): Finding[] {
    const aiRouted = logs.filter(
        (l) =>
            l.detection_method === 'ai' ||
            (l.detection_method === 'rule' &&
                l.detected_intent === 'note.create' &&
                !(l.input as string)?.startsWith('/')),
    );
    if (aiRouted.length < 3) return [];

    const byIntent = new Map<string, string[]>();
    for (const log of aiRouted) {
        const intent = (log.detected_intent as string) || 'unknown';
        if (!byIntent.has(intent)) byIntent.set(intent, []);
        byIntent.get(intent)!.push(log.input as string);
    }

    const findings: Finding[] = [];
    for (const [intent, examples] of byIntent) {
        if (examples.length >= 3) {
            findings.push({
                type: 'unmatched_pattern',
                severity: examples.length >= 10 ? 'warning' : 'info',
                data: {
                    summary: `${examples.length} inputs routed via AI to "${intent}" — consider adding a rule`,
                    intent,
                    examples: examples.slice(0, 10),
                    count: examples.length,
                },
            });
        }
    }
    return findings;
}

function analyzeErrorClusters(logs: LogEntry[]): Finding[] {
    const errors = logs.filter((l) => {
        const resp = l.response as Record<string, unknown> | undefined;
        return resp && (resp.success === false || resp.error);
    });
    if (errors.length < 3) return [];

    const byKey = new Map<string, LogEntry[]>();
    for (const log of errors) {
        const key = `${log.domain || 'unknown'}:${log.tool_id || 'unknown'}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(log);
    }

    const findings: Finding[] = [];
    for (const [key, errorLogs] of byKey) {
        if (errorLogs.length >= 3) {
            const [domain, toolId] = key.split(':');
            findings.push({
                type: 'error_cluster',
                severity: errorLogs.length >= 10 ? 'critical' : 'warning',
                data: {
                    summary: `${errorLogs.length} errors in ${domain}/${toolId}`,
                    domain,
                    tool_id: toolId,
                    error_count: errorLogs.length,
                },
            });
        }
    }
    return findings;
}

function analyzeSlowRoutes(logs: LogEntry[]): Finding[] {
    const withLatency = logs.filter((l) => (l.latency_ms as number) > 0);
    if (withLatency.length < 5) return [];

    const avgLatency =
        withLatency.reduce((sum, l) => sum + (l.latency_ms as number), 0) / withLatency.length;
    const threshold = Math.max(avgLatency * 3, 2000);

    const slow = withLatency.filter((l) => (l.latency_ms as number) > threshold);
    if (slow.length < 3) return [];

    return [
        {
            type: 'slow_route',
            severity: slow.some((l) => (l.latency_ms as number) > 5000) ? 'warning' : 'info',
            data: {
                slow_count: slow.length,
                avg_latency_ms: Math.round(avgLatency),
                threshold_ms: Math.round(threshold),
            },
        },
    ];
}

function analyzeAICost(logs: LogEntry[]): Finding[] {
    const aiLogs = logs.filter((l) => (l.tokens_used as number) > 0);
    if (aiLogs.length === 0) return [];

    const totalTokens = aiLogs.reduce((sum, l) => sum + (l.tokens_used as number), 0);
    return [
        {
            type: 'ai_cost',
            severity: totalTokens > 50000 ? 'warning' : 'info',
            data: {
                total_tokens: totalTokens,
                total_calls: aiLogs.length,
            },
        },
    ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeUnmatchedPatterns', () => {
    it('returns empty for fewer than 3 AI-routed logs', () => {
        const logs = [
            { detection_method: 'ai', detected_intent: 'note.create', input: 'test1' },
            { detection_method: 'ai', detected_intent: 'note.create', input: 'test2' },
        ];
        expect(analyzeUnmatchedPatterns(logs)).toEqual([]);
    });

    it('finds patterns when 3+ inputs route to same AI intent', () => {
        const logs = [
            { detection_method: 'ai', detected_intent: 'task.create', input: 'make a new task' },
            { detection_method: 'ai', detected_intent: 'task.create', input: 'add a task please' },
            {
                detection_method: 'ai',
                detected_intent: 'task.create',
                input: 'create new task for me',
            },
        ];
        const findings = analyzeUnmatchedPatterns(logs);
        expect(findings.length).toBe(1);
        expect(findings[0].type).toBe('unmatched_pattern');
        expect(findings[0].data.intent).toBe('task.create');
        expect(findings[0].data.count).toBe(3);
    });

    it('detects default note.create fallbacks as unmatched', () => {
        const logs = [
            { detection_method: 'rule', detected_intent: 'note.create', input: 'some random text' },
            {
                detection_method: 'rule',
                detected_intent: 'note.create',
                input: 'another random text',
            },
            {
                detection_method: 'rule',
                detected_intent: 'note.create',
                input: 'third random text',
            },
        ];
        const findings = analyzeUnmatchedPatterns(logs);
        expect(findings.length).toBe(1);
    });

    it('ignores note.create from /note commands', () => {
        const logs = [
            { detection_method: 'rule', detected_intent: 'note.create', input: '/note something' },
            { detection_method: 'rule', detected_intent: 'note.create', input: '/note else' },
            { detection_method: 'rule', detected_intent: 'note.create', input: '/note third' },
        ];
        const findings = analyzeUnmatchedPatterns(logs);
        expect(findings.length).toBe(0);
    });

    it('severity is warning when 10+ examples', () => {
        const logs = Array.from({ length: 12 }, (_, i) => ({
            detection_method: 'ai',
            detected_intent: 'tracker.checkin',
            input: `checkin attempt ${i}`,
        }));
        const findings = analyzeUnmatchedPatterns(logs);
        expect(findings[0].severity).toBe('warning');
    });
});

describe('analyzeErrorClusters', () => {
    it('returns empty for fewer than 3 errors', () => {
        const logs = [
            { domain: 'planning', tool_id: 'tasks', response: { success: false } },
            { domain: 'planning', tool_id: 'tasks', response: { success: false } },
        ];
        expect(analyzeErrorClusters(logs)).toEqual([]);
    });

    it('finds error clusters by domain/tool', () => {
        const logs = Array.from({ length: 5 }, () => ({
            domain: 'health',
            tool_id: 'tracker',
            response: { success: false, error: 'No trackers configured' },
        }));
        const findings = analyzeErrorClusters(logs);
        expect(findings.length).toBe(1);
        expect(findings[0].type).toBe('error_cluster');
        expect(findings[0].data.domain).toBe('health');
        expect(findings[0].data.tool_id).toBe('tracker');
        expect(findings[0].data.error_count).toBe(5);
    });

    it('severity is critical when 10+ errors', () => {
        const logs = Array.from({ length: 15 }, () => ({
            domain: 'planning',
            tool_id: 'tasks',
            response: { success: false },
        }));
        const findings = analyzeErrorClusters(logs);
        expect(findings[0].severity).toBe('critical');
    });

    it('groups errors by domain+tool separately', () => {
        const logs = [
            ...Array.from({ length: 3 }, () => ({
                domain: 'planning',
                tool_id: 'tasks',
                response: { success: false },
            })),
            ...Array.from({ length: 4 }, () => ({
                domain: 'health',
                tool_id: 'tracker',
                response: { success: false },
            })),
        ];
        const findings = analyzeErrorClusters(logs);
        expect(findings.length).toBe(2);
    });
});

describe('analyzeSlowRoutes', () => {
    it('returns empty for fewer than 5 logs with latency', () => {
        const logs = [{ latency_ms: 100 }, { latency_ms: 200 }];
        expect(analyzeSlowRoutes(logs)).toEqual([]);
    });

    it('detects slow routes above threshold', () => {
        // Need many fast requests to keep avg low, so slow ones exceed 3*avg
        // 20 fast at 100ms + 3 slow at 10000ms → avg ≈ 1391, threshold ≈ 4174
        // 10000 > 4174 ✓
        const logs = [
            ...Array.from({ length: 20 }, (_, i) => ({ latency_ms: 100, input: `fast${i}` })),
            { latency_ms: 10000, input: 'slow1' },
            { latency_ms: 10000, input: 'slow2' },
            { latency_ms: 10000, input: 'slow3' },
        ];
        const findings = analyzeSlowRoutes(logs);
        expect(findings.length).toBe(1);
        expect(findings[0].type).toBe('slow_route');
        expect(findings[0].data.slow_count as number).toBeGreaterThanOrEqual(3);
    });

    it('returns empty when no requests exceed threshold', () => {
        const logs = Array.from({ length: 10 }, () => ({ latency_ms: 100 }));
        expect(analyzeSlowRoutes(logs)).toEqual([]);
    });
});

describe('analyzeAICost', () => {
    it('returns empty when no AI calls', () => {
        const logs = [{ tokens_used: 0 }, { tokens_used: 0 }];
        expect(analyzeAICost(logs)).toEqual([]);
    });

    it('tracks AI token usage', () => {
        const logs = [{ tokens_used: 100 }, { tokens_used: 200 }, { tokens_used: 150 }];
        const findings = analyzeAICost(logs);
        expect(findings.length).toBe(1);
        expect(findings[0].type).toBe('ai_cost');
        expect(findings[0].data.total_tokens).toBe(450);
        expect(findings[0].data.total_calls).toBe(3);
    });

    it('severity is warning above 50k tokens', () => {
        const logs = [{ tokens_used: 60000 }];
        const findings = analyzeAICost(logs);
        expect(findings[0].severity).toBe('warning');
    });
});
