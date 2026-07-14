/**
 * Offline outbox for Google Calendar writes.
 *
 * Google writes are inherently online. When the network is down (or a write fails
 * transiently) we queue the create/update/delete here and flush when connectivity
 * returns. Deterministic event ids on the server make replaying a stale op safe.
 */

import {
    type OutboxRecord,
    type OutboxStore,
    type DeliveryResult,
    defaultStore,
    createMemoryStore as createMemoryStoreGeneric,
} from './outboxDb';

export type { DeliveryResult } from './outboxDb';

export interface GoogleEventPayload {
    summary: string;
    description?: string;
    location?: string;
    start: string; // ISO datetime, or YYYY-MM-DD for all-day
    end: string;
    isAllDay: boolean;
    timeZone?: string;
}

export interface GoogleCalendarOutboxItem extends OutboxRecord {
    op: 'create' | 'update' | 'delete';
    todoId: string;
    googleEventId?: string;
    payload?: GoogleEventPayload;
}

export function createMemoryStore(): OutboxStore<GoogleCalendarOutboxItem> {
    return createMemoryStoreGeneric<GoogleCalendarOutboxItem>();
}

type CountListener = (count: number) => void;

export class GoogleCalendarOutbox {
    private readonly store: OutboxStore<GoogleCalendarOutboxItem>;
    private readonly listeners = new Set<CountListener>();
    private flushing = false;

    constructor(
        store: OutboxStore<GoogleCalendarOutboxItem> = defaultStore<GoogleCalendarOutboxItem>(
            'google_calendar_outbox',
        ),
    ) {
        this.store = store;
    }

    async enqueue(
        entry: Omit<GoogleCalendarOutboxItem, 'id' | 'createdAt' | 'attempts'>,
    ): Promise<GoogleCalendarOutboxItem> {
        // Coalesce: if there is already a queued op for this todo, the newest wins
        // (e.g. reschedule then complete while offline → only the latest matters for create/update;
        // a delete always supersedes a pending create/update for the same todo).
        const existing = (await this.store.list()).filter((i) => i.todoId === entry.todoId);
        for (const old of existing) {
            if (entry.op === 'delete' || old.op !== 'delete') {
                await this.store.remove(old.id);
            }
        }
        const item: GoogleCalendarOutboxItem = {
            ...entry,
            id: crypto.randomUUID(),
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

    async list(): Promise<GoogleCalendarOutboxItem[]> {
        return this.store.list();
    }

    /** Replay queued writes FIFO; stop at the first network failure to preserve order. */
    async flush(
        deliver: (item: GoogleCalendarOutboxItem) => Promise<DeliveryResult>,
    ): Promise<{ delivered: number; remaining: number }> {
        if (this.flushing) return { delivered: 0, remaining: await this.count() };
        this.flushing = true;
        let delivered = 0;
        try {
            const items = await this.store.list();
            for (const item of items) {
                const result = await deliver(item);
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

    subscribe(listener: CountListener): () => void {
        this.listeners.add(listener);
        this.count()
            .then(listener)
            .catch(() => listener(0));
        return () => {
            this.listeners.delete(listener);
        };
    }

    private async notify(): Promise<void> {
        if (this.listeners.size === 0) return;
        let count = 0;
        try {
            count = await this.count();
        } catch {
            /* report 0 */
        }
        for (const listener of this.listeners) listener(count);
    }
}

/** App-wide singleton. */
export const googleCalendarOutbox = new GoogleCalendarOutbox();
