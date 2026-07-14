import { describe, it, expect } from 'vitest';
import { CaptureOutbox, createMemoryStore, type DeliveryResult } from '../captureOutbox';

describe('CaptureOutbox', () => {
    it('enqueues captures and reports the pending count', async () => {
        const outbox = new CaptureOutbox(createMemoryStore());
        await outbox.enqueue('buy milk');
        await outbox.enqueue('read ch. 4');
        expect(await outbox.count()).toBe(2);
    });

    it('flushes delivered items in FIFO order', async () => {
        const outbox = new CaptureOutbox(createMemoryStore());
        await outbox.enqueue('first');
        await outbox.enqueue('second');

        const sent: string[] = [];
        const result = await outbox.flush(async (text) => {
            sent.push(text);
            return 'delivered';
        });

        expect(sent).toEqual(['first', 'second']);
        expect(result).toEqual({ delivered: 2, remaining: 0 });
    });

    it('stops flushing at the first network failure and keeps remaining items', async () => {
        const outbox = new CaptureOutbox(createMemoryStore());
        await outbox.enqueue('first');
        await outbox.enqueue('second');
        await outbox.enqueue('third');

        const responses: DeliveryResult[] = ['delivered', 'retry'];
        const sent: string[] = [];
        const result = await outbox.flush(async (text) => {
            sent.push(text);
            return responses.shift() ?? 'retry';
        });

        // Third item is never attempted once 'second' hits a network failure.
        expect(sent).toEqual(['first', 'second']);
        expect(result).toEqual({ delivered: 1, remaining: 2 });

        const remaining = await outbox.list();
        expect(remaining.map((i) => i.text)).toEqual(['second', 'third']);
        expect(remaining[0].attempts).toBe(1);
    });

    it('treats a domain-level failure response as delivered (no infinite retry)', async () => {
        const outbox = new CaptureOutbox(createMemoryStore());
        await outbox.enqueue('unparseable nonsense');

        const result = await outbox.flush(async () => 'delivered');
        expect(result).toEqual({ delivered: 1, remaining: 0 });
    });

    it('notifies subscribers when the count changes', async () => {
        const outbox = new CaptureOutbox(createMemoryStore());
        const counts: number[] = [];
        const unsubscribe = outbox.subscribe((c) => counts.push(c));
        // Initial subscription fires asynchronously with current count.
        await Promise.resolve();

        await outbox.enqueue('a');
        await outbox.flush(async () => 'delivered');
        unsubscribe();

        expect(counts).toContain(1);
        expect(counts[counts.length - 1]).toBe(0);
    });
});
