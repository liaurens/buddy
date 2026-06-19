/**
 * Shared IndexedDB plumbing for durable offline outboxes.
 *
 * One `buddy-offline` database holds several FIFO stores (capture text, Google
 * Calendar writes, …). Centralizing the open + upgrade here keeps every outbox on
 * the same DB version so concurrent opens never throw VersionError.
 */

export const DB_NAME = 'buddy-offline';
export const DB_VERSION = 2;

/** All object stores in the offline DB. Add new stores here and bump DB_VERSION. */
export const STORE_NAMES = ['capture_outbox', 'google_calendar_outbox'] as const;
export type StoreName = typeof STORE_NAMES[number];

/** Base shape every outbox record shares. */
export interface OutboxRecord {
    id: string;
    createdAt: string;
    attempts: number;
}

/** Result of attempting to deliver one queued item. */
export type DeliveryResult =
    /** Server received it (even if it answered with a domain-level error) — remove from queue. */
    | 'delivered'
    /** Network-level failure — keep it queued and stop flushing. */
    | 'retry';

export interface OutboxStore<T extends OutboxRecord> {
    add(item: T): Promise<void>;
    list(): Promise<T[]>;
    update(item: T): Promise<void>;
    remove(id: string): Promise<void>;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const name of STORE_NAMES) {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: 'id' });
                }
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
}

function withStore<T>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    return openDb().then(db => new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = run(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
    }));
}

export function createIdbStore<T extends OutboxRecord>(storeName: StoreName): OutboxStore<T> {
    return {
        add: item => withStore(storeName, 'readwrite', s => s.add(item)).then(() => undefined),
        list: () => withStore<T[]>(storeName, 'readonly', s => s.getAll() as IDBRequest<T[]>)
            .then(items => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
        update: item => withStore(storeName, 'readwrite', s => s.put(item)).then(() => undefined),
        remove: id => withStore(storeName, 'readwrite', s => s.delete(id)).then(() => undefined),
    };
}

/**
 * In-memory fallback for environments without IndexedDB (tests, private
 * browsing). Loses items on reload, but never throws on a capture path.
 */
export function createMemoryStore<T extends OutboxRecord>(): OutboxStore<T> {
    let items: T[] = [];
    return {
        add: async item => { items = [...items, item]; },
        list: async () => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        update: async item => { items = items.map(i => (i.id === item.id ? item : i)); },
        remove: async id => { items = items.filter(i => i.id !== id); },
    };
}

export function defaultStore<T extends OutboxRecord>(storeName: StoreName): OutboxStore<T> {
    return typeof indexedDB !== 'undefined' ? createIdbStore<T>(storeName) : createMemoryStore<T>();
}
