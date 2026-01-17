import Dexie, { type Table } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';
import type { TrackerDefinition, Entry, Protocol, Cycle, Dose, CorrelationResult, Experiment, Strategy, Todo } from '../types';

// Settings interface for app configuration
export interface AppSettings {
    id: string;
    key: string;
    value: string;
}

// Database class extending Dexie with Cloud addon
// Using a NEW database name to avoid migration issues with existing local data
export class TrackerDatabase extends Dexie {
    entries!: Table<Entry>;
    trackers!: Table<TrackerDefinition>;
    protocols!: Table<Protocol>;
    cycles!: Table<Cycle>;
    doses!: Table<Dose>;
    experiments!: Table<Experiment>;
    correlations!: Table<CorrelationResult>;
    settings!: Table<{ id: string, key: string, value: any }>;
    strategies!: Table<Strategy>;
    todos!: Table<Todo>;

    constructor() {
        // New database name for cloud-enabled version
        super('LifeTrackerCloud', { addons: [dexieCloud] });

        // Version 1 for the new cloud database
        this.version(1).stores({
            trackers: 'id, name, type, group',
            entries: 'id, trackerId, timestamp',
            protocols: 'id, name, active',
            cycles: 'id, protocolId, status, startDate',
            doses: 'id, protocolId, cycleId, takenAt',
            experiments: 'id, active, startDate',
            correlations: 'id, timestamp',
            settings: 'id, key',
            strategies: 'id, title, category, *tags',
            todos: 'id, title, isCompleted, dueDate'
        });

        // Configure Dexie Cloud - must be called before any DB operations
        this.cloud.configure({
            databaseUrl: 'https://z9f4qhswc.dexie.cloud',
            requireAuth: false // Allow anonymous users initially
        });
    }
}

// Singleton database instance
export const db = new TrackerDatabase();

// Reference to the old database for migration
class OldDatabase extends Dexie {
    entries!: Table<Entry>;
    trackers!: Table<TrackerDefinition>;
    protocols!: Table<Protocol>;
    cycles!: Table<Cycle>;
    doses!: Table<Dose>;
    experiments!: Table<Experiment>;
    correlations!: Table<CorrelationResult>;
    settings!: Table<{ id: string, key: string, value: any }>;
    strategies!: Table<Strategy>;
    todos!: Table<Todo>;

    constructor() {
        super('LifeTrackerDB');
        this.version(4).stores({
            trackers: 'id, name, type, group',
            entries: 'id, trackerId, timestamp',
            protocols: 'id, name, active',
            cycles: 'id, protocolId, status, startDate',
            doses: 'id, protocolId, cycleId, takenAt',
            experiments: '++id, active, startDate',
            correlations: '++id, timestamp',
            settings: 'id, key',
            strategies: 'id, title, category, *tags',
            todos: 'id, title, isCompleted, dueDate'
        });
    }
}

// Migrate data from old database to new cloud database
async function migrateFromOldDatabase(): Promise<boolean> {
    const oldDb = new OldDatabase();

    try {
        // Check if old database exists and has data
        const exists = await Dexie.exists('LifeTrackerDB');
        if (!exists) {
            console.log('No old database to migrate from');
            return false;
        }

        await oldDb.open();
        const oldTrackerCount = await oldDb.trackers.count();

        if (oldTrackerCount === 0) {
            console.log('Old database is empty, no migration needed');
            await oldDb.close();
            return false;
        }

        console.log(`📦 Migrating ${oldTrackerCount} trackers from old database...`);

        // Get all data from old database
        const [entries, trackers, protocols, cycles, doses, correlations, strategies, todos] = await Promise.all([
            oldDb.entries.toArray(),
            oldDb.trackers.toArray(),
            oldDb.protocols.toArray(),
            oldDb.cycles.toArray(),
            oldDb.doses.toArray(),
            oldDb.correlations.toArray(),
            oldDb.strategies.toArray(),
            oldDb.todos.toArray(),
        ]);

        // Import into new cloud database
        await db.transaction('rw', [db.entries, db.trackers, db.protocols, db.cycles, db.doses, db.correlations, db.strategies, db.todos], async () => {
            if (trackers.length > 0) await db.trackers.bulkPut(trackers);
            if (entries.length > 0) await db.entries.bulkPut(entries);
            if (protocols.length > 0) await db.protocols.bulkPut(protocols);
            if (cycles.length > 0) await db.cycles.bulkPut(cycles);
            if (doses.length > 0) await db.doses.bulkPut(doses);
            if (correlations.length > 0) await db.correlations.bulkPut(correlations);
            if (strategies.length > 0) await db.strategies.bulkPut(strategies);
            if (todos.length > 0) await db.todos.bulkPut(todos);
        });

        console.log('✅ Migration completed successfully!');

        // Close and optionally delete old database
        await oldDb.close();
        // Uncomment the next line to delete old database after successful migration:
        // await Dexie.delete('LifeTrackerDB');

        return true;
    } catch (error) {
        console.error('Migration failed:', error);
        await oldDb.close();
        return false;
    }
}

// Default trackers to seed on first run
const DEFAULT_TRACKERS: TrackerDefinition[] = [
    { id: 'sleep_hours', name: 'Sleep Hours', emoji: '🌙', type: 'number', unit: 'hrs', group: 'Health', checkinConfig: { isRequired: true, inCheckin: true } },
    { id: 'sleep_quality', name: 'Sleep Quality', emoji: '💤', type: 'rating', group: 'Health', checkinConfig: { isRequired: true, inCheckin: true } },
    { id: 'caffeine', name: 'Caffeine', emoji: '☕', type: 'number', unit: 'mg', group: 'Diet', checkinConfig: { isRequired: false, inCheckin: true } },
    { id: 'movement', name: 'Movement', emoji: '🏃', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { id: 'mood', name: 'Mood', emoji: '😊', type: 'rating', group: 'Mental', checkinConfig: { isRequired: true, inCheckin: true } },
    { id: 'energy', name: 'Energy', emoji: '⚡', type: 'rating', group: 'Mental', checkinConfig: { isRequired: true, inCheckin: true } },
    { id: 'stress', name: 'Stress', emoji: '😰', type: 'rating', group: 'Mental', checkinConfig: { isRequired: false, inCheckin: true } },
    { id: 'journal_notes', name: 'Daily Notes', emoji: '📓', type: 'text', group: 'Journal', checkinConfig: { isRequired: false, inCheckin: true } },
];

// Initialize database with default data if empty
export async function initializeDatabase(): Promise<void> {
    console.log('🔧 Starting database initialization...');

    try {
        // Wait for database to be ready
        await db.open();
        console.log('✅ Database opened successfully');
    } catch (error) {
        console.error('❌ Failed to open database:', error);
        throw error;
    }

    const trackerCount = await db.trackers.count();

    if (trackerCount === 0) {
        // Try to migrate from old database first
        const migrated = await migrateFromOldDatabase();

        if (!migrated) {
            // Check for legacy localStorage data
            const legacyData = localStorage.getItem('life-tracker-data');

            if (legacyData) {
                try {
                    const parsed = JSON.parse(legacyData);
                    if (parsed.trackers && Array.isArray(parsed.trackers)) await db.trackers.bulkAdd(parsed.trackers);
                    if (parsed.entries && Array.isArray(parsed.entries)) {
                        const migratedEntries = parsed.entries.map((e: any) => ({ ...e, trackerId: e.trackerId || e.type }));
                        await db.entries.bulkAdd(migratedEntries);
                    }
                    console.log('Migrated legacy data from localStorage');
                } catch (e) {
                    console.error('Failed to migrate legacy data:', e);
                    await db.trackers.bulkAdd(DEFAULT_TRACKERS);
                }
            } else {
                await db.trackers.bulkAdd(DEFAULT_TRACKERS);
            }
        }
    } else {
        // Upgrade Check: Ensure new default trackers exist even if DB isn't empty
        const existingIds = new Set(await db.trackers.toCollection().primaryKeys());
        const missingDefaults = DEFAULT_TRACKERS.filter(dt => !existingIds.has(dt.id));

        if (missingDefaults.length > 0) {
            console.log('Seeding missing default trackers:', missingDefaults.map(t => t.id));
            await db.trackers.bulkAdd(missingDefaults);
        }
    }
}

// Export all data as JSON for backup
export async function exportAllData(): Promise<string> {
    const [entries, trackers, protocols, cycles, doses, correlations, strategies, todos] = await Promise.all([
        db.entries.toArray(),
        db.trackers.toArray(),
        db.protocols.toArray(),
        db.cycles.toArray(),
        db.doses.toArray(),
        db.correlations.toArray(),
        db.strategies.toArray(),
        db.todos.toArray(),
    ]);

    return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        entries,
        trackers,
        protocols,
        cycles,
        doses,
        correlations,
        strategies,
        todos,
    }, null, 2);
}

// Import data from JSON backup
export async function importAllData(jsonData: string): Promise<boolean> {
    try {
        const data = JSON.parse(jsonData);

        await db.transaction('rw',
            [db.entries, db.trackers, db.protocols, db.cycles, db.doses, db.correlations, db.strategies, db.todos],
            async () => {
                // Clear existing data
                await Promise.all([
                    db.entries.clear(),
                    db.trackers.clear(),
                    db.protocols.clear(),
                    db.cycles.clear(),
                    db.doses.clear(),
                    db.correlations.clear(),
                    db.strategies.clear(),
                    db.todos.clear(),
                ]);

                // Import new data
                if (data.entries) await db.entries.bulkAdd(data.entries);
                if (data.trackers) await db.trackers.bulkAdd(data.trackers);
                if (data.protocols) await db.protocols.bulkAdd(data.protocols);
                if (data.cycles) await db.cycles.bulkAdd(data.cycles);
                if (data.doses) await db.doses.bulkAdd(data.doses);
                if (data.correlations) await db.correlations.bulkAdd(data.correlations);
                if (data.strategies) await db.strategies.bulkAdd(data.strategies);
                if (data.todos) await db.todos.bulkAdd(data.todos);
            }
        );

        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}

// Get setting by key
export async function getSetting(key: string): Promise<string | undefined> {
    const setting = await db.settings.where('key').equals(key).first();
    return setting?.value;
}

// Set setting by key
export async function setSetting(key: string, value: string): Promise<void> {
    const existing = await db.settings.where('key').equals(key).first();
    if (existing) {
        await db.settings.update(existing.id, { value });
    } else {
        await db.settings.add({ id: crypto.randomUUID(), key, value });
    }
}
