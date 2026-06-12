/**
 * Offline capture outbox.
 *
 * Captures submitted without connectivity are written here first and replayed
 * when the network returns. One lost capture teaches the brain not to trust
 * the inbox — so the queue is durable (IndexedDB), FIFO, and surfaces a
 * pending count for a "waiting to sync" badge.
 *
 * Scope: capture text only — not general offline CRUD.
 */

export interface OutboxItem {
    id: string;
    text: string;
    createdAt: string;
    attempts: number;
}

/** Result of attempting to deliver one queued capture. */
export type DeliveryResult =
    /** Server received it (even if it answered with a domain-level error) — remove from queue. */
    | 'delivered'
    /** Network-level failure — keep it queued and stop flushing. */
    | 'retry';

export interface OutboxStore {
    add(item: OutboxItem): Promise<void>;
    list(): Promise<OutboxItem[]>;
    update(item: OutboxItem): Promise<void>;
    remove(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const DB_NAME = 'buddy-offline';
const DB_VERSION = 1;
const STORE_NAME = 'capture_outbox';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
}

function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    return openDb().then(db => new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = run(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
    }));
}

function createIdbStore(): OutboxStore {
    return {
        add: item => withStore('readwrite', s => s.add(item)).then(() => undefined),
        list: () => withStore<OutboxItem[]>('readonly', s => s.getAll() as IDBRequest<OutboxItem[]>)
            .then(items => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
        update: item => withStore('readwrite', s => s.put(item)).then(() => undefined),
        remove: id => withStore('readwrite', s => s.delete(id)).then(() => undefined),
    };
}

/**
 * In-memory fallback for environments without IndexedDB (tests, private
 * browsing). Loses items on reload, but never throws on a capture path.
 */
export function createMemoryStore(): OutboxStore {
    let items: OutboxItem[] = [];
    return {
        add: async item => { items = [...items, item]; },
        list: async () => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        update: async item => { items = items.map(i => (i.id === item.id ? item : i)); },
        remove: async id => { items = items.filter(i => i.id !== id); },
    };
}

function defaultStore(): OutboxStore {
    return typeof indexedDB !== 'undefined' ? createIdbStore() : createMemoryStore();
}

// ---------------------------------------------------------------------------
// Outbox API
// ---------------------------------------------------------------------------

type CountListener = (count: number) => void;

export class CaptureOutbox {
    private readonly store: OutboxStore;
    private readonly listeners = new Set<CountListener>();
    private flushing = false;

    constructor(store: OutboxStore = defaultStore()) {
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
