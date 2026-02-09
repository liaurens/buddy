/**
 * Planning Converters (DailyPlan, TimeBlock, ActivityTemplate, CalendarEvent)
 */

import type { DailyPlan, TimeBlock, ActivityTemplate, CalendarEvent } from '../../../types/planning';
import type { DbDailyPlan, DbTimeBlock, DbActivityTemplate, DbCalendarEvent } from '../types';

export function dbToDailyPlan(db: DbDailyPlan, blocks: TimeBlock[] = []): DailyPlan {
    return {
        id: db.id,
        userId: db.user_id,
        date: db.date,
        blocks,
        moodAtPlanTime: db.mood_at_plan_time || undefined,
        energyAtPlanTime: db.energy_at_plan_time || undefined,
        sleepHoursAtPlanTime: db.sleep_hours_at_plan_time || undefined,
        aiPromptUsed: db.ai_prompt_used || undefined,
        aiModelUsed: db.ai_model_used || undefined,
        aiReasoning: db.ai_reasoning || undefined,
        aiWarnings: db.ai_warnings || undefined,
        createdAt: db.created_at,
        updatedAt: db.updated_at || undefined,
        status: db.status as DailyPlan['status'],
        totalPlannedMinutes: blocks.reduce((sum, b) => sum + b.estimatedMinutes, 0) || undefined,
        totalActualMinutes: blocks.reduce((sum, b) => sum + (b.actualMinutes || 0), 0) || undefined,
        completionRate: blocks.length > 0
            ? (blocks.filter(b => b.status === 'completed').length / blocks.length) * 100
            : undefined,
    };
}

export function dailyPlanToDb(plan: Omit<DailyPlan, 'blocks'> & { id?: string }, userId: string): Omit<DbDailyPlan, 'id' | 'created_at'> & { id?: string } {
    return {
        id: plan.id,
        user_id: userId,
        date: plan.date,
        mood_at_plan_time: plan.moodAtPlanTime || null,
        energy_at_plan_time: plan.energyAtPlanTime || null,
        sleep_hours_at_plan_time: plan.sleepHoursAtPlanTime || null,
        ai_prompt_used: plan.aiPromptUsed || null,
        ai_model_used: plan.aiModelUsed || null,
        ai_reasoning: plan.aiReasoning || null,
        ai_warnings: plan.aiWarnings || null,
        status: plan.status,
        updated_at: plan.updatedAt || null,
    };
}

export function dbToTimeBlock(db: DbTimeBlock): TimeBlock {
    return {
        id: db.id,
        planId: db.plan_id,
        taskId: db.task_id || undefined,
        activityTemplateId: db.activity_template_id || undefined,
        calendarEventId: db.calendar_event_id || undefined,
        title: db.title,
        description: db.description || undefined,
        startTime: db.start_time,
        endTime: db.end_time,
        estimatedMinutes: db.estimated_minutes,
        actualMinutes: db.actual_minutes || undefined,
        status: db.status as TimeBlock['status'],
        startedAt: db.started_at || undefined,
        completedAt: db.completed_at || undefined,
        notes: db.notes || undefined,
        sortOrder: db.sort_order,
    };
}

export function timeBlockToDb(block: Omit<TimeBlock, 'id'> & { id?: string }, userId: string, planId: string): Omit<DbTimeBlock, 'id' | 'created_at'> & { id?: string } {
    return {
        id: block.id,
        user_id: userId,
        plan_id: planId,
        task_id: block.taskId || null,
        activity_template_id: block.activityTemplateId || null,
        calendar_event_id: block.calendarEventId || null,
        title: block.title,
        description: block.description || null,
        start_time: block.startTime,
        end_time: block.endTime,
        estimated_minutes: block.estimatedMinutes,
        actual_minutes: block.actualMinutes || null,
        status: block.status,
        started_at: block.startedAt || null,
        completed_at: block.completedAt || null,
        notes: block.notes || null,
        sort_order: block.sortOrder,
        updated_at: null,
    };
}

export function dbToActivityTemplate(db: DbActivityTemplate): ActivityTemplate {
    return {
        id: db.id,
        userId: db.user_id,
        name: db.name,
        emoji: db.emoji || undefined,
        description: db.description || undefined,
        category: db.category as ActivityTemplate['category'],
        defaultMinutes: db.default_minutes,
        historicalMinutes: db.historical_minutes || undefined,
        averageMinutes: db.average_minutes || undefined,
        frequency: db.frequency as ActivityTemplate['frequency'] || undefined,
        preferredTimeSlot: db.preferred_time_slot as ActivityTemplate['preferredTimeSlot'] || undefined,
        preferredStartTime: db.preferred_start_time || undefined,
        isActive: db.is_active,
        createdAt: db.created_at,
        updatedAt: db.updated_at || undefined,
    };
}

export function activityTemplateToDb(template: Omit<ActivityTemplate, 'id' | 'createdAt'> & { id?: string }, userId: string): Omit<DbActivityTemplate, 'id' | 'created_at'> & { id?: string } {
    return {
        id: template.id,
        user_id: userId,
        name: template.name,
        emoji: template.emoji || null,
        description: template.description || null,
        category: template.category,
        default_minutes: template.defaultMinutes,
        historical_minutes: template.historicalMinutes || null,
        average_minutes: template.averageMinutes || null,
        frequency: template.frequency || null,
        preferred_time_slot: template.preferredTimeSlot || null,
        preferred_start_time: template.preferredStartTime || null,
        is_active: template.isActive,
        updated_at: template.updatedAt || null,
    };
}

export function dbToCalendarEvent(db: DbCalendarEvent): CalendarEvent {
    return {
        id: db.id,
        userId: db.user_id,
        title: db.title,
        description: db.description || undefined,
        location: db.location || undefined,
        startTime: db.start_time,
        endTime: db.end_time,
        isAllDay: db.is_all_day,
        travelTimeMinutes: db.travel_time_minutes || undefined,
        travelFromLocation: db.travel_from_location || undefined,
        source: db.source as CalendarEvent['source'],
        externalId: db.external_id || undefined,
        calendarName: db.calendar_name || undefined,
        createdAt: db.created_at,
        syncedAt: db.synced_at || undefined,
    };
}

export function calendarEventToDb(event: Omit<CalendarEvent, 'id' | 'createdAt'> & { id?: string }, userId: string): Omit<DbCalendarEvent, 'id' | 'created_at'> & { id?: string } {
    return {
        id: event.id,
        user_id: userId,
        title: event.title,
        description: event.description || null,
        location: event.location || null,
        start_time: event.startTime,
        end_time: event.endTime,
        is_all_day: event.isAllDay,
        travel_time_minutes: event.travelTimeMinutes || null,
        travel_from_location: event.travelFromLocation || null,
        source: event.source,
        external_id: event.externalId || null,
        calendar_name: event.calendarName || null,
        synced_at: event.syncedAt || null,
    };
}
