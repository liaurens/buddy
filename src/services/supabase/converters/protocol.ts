/**
 * Protocol, Cycle, and Dose Converters
 * Convert between DB types (snake_case) and App types (camelCase)
 */

import type { Protocol, Cycle, Dose } from '../../../features/health-tracking/types';
import type { DbProtocol, DbCycle, DbDose } from '../types';

export function dbToProtocol(db: DbProtocol): Protocol {
    return {
        id: db.id,
        name: db.name,
        category: (db.category as Protocol['category']) || 'other',
        doseAmount: db.dose_amount ?? undefined,
        doseUnit: db.dose_unit || undefined,
        frequency: db.frequency || '',
        route: db.route || undefined,
        timingNotes: db.timing_notes || undefined,
        halfLifeHours: db.half_life_hours || undefined,
        active: db.active,
        expectedOutcomes: db.expected_outcomes || undefined,
        linkedTrackerId: db.linked_tracker_id || undefined,
        defaultTrackerType: db.default_tracker_type as Protocol['defaultTrackerType'],
        effectTiming: db.effect_timing as Protocol['effectTiming'],
        createdAt: db.created_at,
    };
}

export function protocolToDb(
    protocol: Omit<Protocol, 'id' | 'createdAt'> & { id?: string },
    userId: string,
): Omit<DbProtocol, 'id' | 'created_at'> & { id?: string } {
    return {
        id: protocol.id,
        user_id: userId,
        name: protocol.name,
        category: protocol.category,
        dose_amount: protocol.doseAmount || null,
        dose_unit: protocol.doseUnit || null,
        frequency: protocol.frequency,
        route: protocol.route || null,
        timing_notes: protocol.timingNotes || null,
        half_life_hours: protocol.halfLifeHours || null,
        active: protocol.active,
        expected_outcomes: protocol.expectedOutcomes || null,
        linked_tracker_id: protocol.linkedTrackerId || null,
        default_tracker_type: protocol.defaultTrackerType || null,
        effect_timing: protocol.effectTiming || null,
    };
}

export function dbToCycle(db: DbCycle): Cycle {
    return {
        id: db.id,
        protocolId: db.protocol_id,
        cycleNumber: db.cycle_number ?? 1,
        startDate: db.start_date,
        plannedEndDate: db.planned_end_date || undefined,
        actualEndDate: db.actual_end_date || undefined,
        offCycleDays: db.off_cycle_days || undefined,
        status: (db.status as Cycle['status']) || 'active',
        notes: db.notes || undefined,
    };
}

export function cycleToDb(
    cycle: Omit<Cycle, 'id'> & { id?: string },
    userId: string,
): Omit<DbCycle, 'id'> & { id?: string } {
    return {
        id: cycle.id,
        user_id: userId,
        protocol_id: cycle.protocolId,
        cycle_number: cycle.cycleNumber,
        start_date: cycle.startDate,
        planned_end_date: cycle.plannedEndDate || null,
        actual_end_date: cycle.actualEndDate || null,
        off_cycle_days: cycle.offCycleDays || null,
        status: cycle.status,
        notes: cycle.notes || null,
    };
}

export function dbToDose(db: DbDose): Dose {
    return {
        id: db.id,
        protocolId: db.protocol_id,
        cycleId: db.cycle_id || undefined,
        scheduledAt: db.scheduled_at || undefined,
        takenAt: db.taken_at || undefined,
        actualAmount: db.actual_amount || undefined,
        skipped: db.skipped,
        skipReason: db.skip_reason || undefined,
    };
}

export function doseToDb(
    dose: Omit<Dose, 'id'> & { id?: string },
    userId: string,
): Omit<DbDose, 'id'> & { id?: string } {
    return {
        id: dose.id,
        user_id: userId,
        protocol_id: dose.protocolId,
        cycle_id: dose.cycleId || null,
        scheduled_at: dose.scheduledAt || null,
        taken_at: dose.takenAt || null,
        actual_amount: dose.actualAmount || null,
        skipped: dose.skipped,
        skip_reason: dose.skipReason || null,
    };
}
