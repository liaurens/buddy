/**
 * Offline capture outbox.
 *
 * Captures submitted without connectivity are written here first and replayed
 * when the network returns. One lost capture teaches the brain not to trust
 * the inbox — so the queue is durable (IndexedDB), FIFO, and surfaces a
 * pending count for a "waiting to sync" badge.
 *
 * Scope: capture text only — not general offline CRUD. Shared IndexedDB plumbing
 * lives in ./outboxDb.
 */

import {
    type OutboxRecord, type OutboxStore, type DeliveryResult, defaultStore,
    createMemoryStore as createMemoryStoreGeneric,
} from './outboxDb';

export type { DeliveryResult } from './outboxDb';

export interface OutboxItem extends OutboxRecord {
    text: string;
}

/** Memory-backed capture store (tests / no-IndexedDB environments). */
export function createMemoryStore(): OutboxStore<OutboxItem> {
    return createMemoryStoreGeneric<OutboxItem>();
}

// ---------------------------------------------------------------------------
// Outbox API
// ---------------------------------------------------------------------------

type CountListener = (count: number) => void;

export class CaptureOutbox {
    private readonly store: OutboxStore<OutboxItem>;
    private readonly listeners = new Set<CountListener>();
    private flushing = false;

    constructor(store: OutboxStore<OutboxItem> = defaultStore<OutboxItem>('capture_outbox')) {
        this.store = store;
    }

    async enqueue(text: string): Promise<OutboxItem> {
        const item: OutboxItem = {
            id: crypto.randomUUID(),
            text,
            createdAt: new Date().toISOString(),
            attempts: 0,
        };
        await this.store.add(item);
        await this.notify();
        return item;
    }

    async count(): Promise<number> {
        return (await this.store.list()).length;
    }

    async list(): Promise<OutboxItem[]> {
        return this.store.list();
    }

    /**
     * Replay queued captures in FIFO order. Stops at the first network-level
     * failure so ordering is preserved across retries. Concurrent calls are
     * coalesced — a flush already in progress wins.
     */
    async flush(deliver: (text: string) => Promise<DeliveryResult>): Promise<{ delivered: number; remaining: number }> {
        if (this.flushing) {
            return { delivered: 0, remaining: await this.count() };
        }
        this.flushing = true;
        let delivered = 0;
        try {
            const items = await this.store.list();
            for (const item of items) {
                const result = await deliver(item.text);
                if (result === 'delivered') {
                    await this.store.remove(item.id);
                    delivered += 1;
                } else {
                    await this.store.update({ ...item, attempts: item.attempts + 1 });
                    break;
                }
            }
        } finally {
            this.flushing = false;
            await this.notify();
        }
        return { delivered, remaining: await this.count() };
    }

    /** Subscribe to pending-count changes. Fires immediately with the current count. */
    subscribe(listener: CountListener): () => void {
        this.listeners.add(listener);
        this.count().then(listener).catch(() => listener(0));
        return () => { this.listeners.delete(listener); };
    }

    private async notify(): Promise<void> {
        if (this.listeners.size === 0) return;
        let count = 0;
        try {
            count = await this.count();
        } catch {
            // Count failures shouldn't break notification; report 0.
        }
        for (const listener of this.listeners) {
            listener(count);
        }
    }
}

/** App-wide singleton outbox. */
export const captureOutbox = new CaptureOutbox();
