/**
 * Settings Schemas
 * Zod validation schemas for all settings with defaults
 */

import { z } from 'zod';

// ============================================================================
// HEALTH TRACKING SCHEMAS
// ============================================================================

export const trackerSettingsSchema = z.object({
  defaultReminderTime: z.string().default('20:00'),
  enableReminders: z.boolean().default(false),
  showGoalProgress: z.boolean().default(true),
  chartDefaultDays: z.enum(['7', '14', '30', '90']).transform(Number).default(7),
  chartType: z.enum(['line', 'bar', 'scatter']).default('line'),
  hideEmptyTrackers: z.boolean().default(false),
  trackingStreak: z.boolean().default(true),
});

export const protocolSettingsSchema = z.object({
  defaultDoseTime: z.string().default('08:00'),
  enableDoseReminders: z.boolean().default(true),
  reminderAdvanceMinutes: z.number().int().min(0).max(60).default(15),
  reminderSound: z.boolean().default(true),
  showUpcomingCount: z.number().int().min(1).max(10).default(3),
  skipWeekends: z.boolean().default(false),
});

export const experimentSettingsSchema = z.object({
  defaultDurationDays: z.number().int().min(7).max(365).default(30),
  minDataPoints: z.number().int().min(3).max(30).default(7),
  showCorrelationThreshold: z.number().min(0).max(1).default(0.3),
  autoArchiveCompleted: z.boolean().default(false),
});

export const checkInSettingsSchema = z.object({
  dailyReminderTime: z.string().default('21:00'),
  enableDailyReminder: z.boolean().default(false),
  requiredFields: z.array(z.string()).default([]),
  showRecentCheckIns: z.number().int().min(1).max(30).default(7),
  completionCelebration: z.boolean().default(true),
});

// ============================================================================
// JOURNAL/NOTES SCHEMAS
// ============================================================================

export const notesSettingsSchema = z.object({
  autoCategorizationEnabled: z.boolean().default(true),
  defaultCategoryId: z.string().nullable().default(null),
  sortOrder: z.enum(['newest', 'oldest', 'alpha']).default('newest'),
  showCategoryBadges: z.boolean().default(true),
  enableSmartSuggestions: z.boolean().default(true),
  archiveAfterDays: z.number().int().min(30).max(365).default(90),
});

// ============================================================================
// CALENDAR SCHEMAS
// ============================================================================

export const calendarSettingsSchema = z.object({
  calendarUrl: z.string().url().nullable().default(null),
  calendarName: z.string().default('My Calendar'),
  autoSyncEnabled: z.boolean().default(false),
  syncIntervalMinutes: z.number().int().min(15).max(1440).default(60),
  lastSyncTime: z.string().nullable().default(null),
  showInPlanning: z.boolean().default(true),
  includeAllDayEvents: z.boolean().default(true),
  minEventDurationMinutes: z.number().int().min(0).max(120).default(15),
});

// ============================================================================
// PLANNING SCHEMAS
// ============================================================================

export const planningSettingsSchema = z.object({
  workStartTime: z.string().default('09:00'),
  workEndTime: z.string().default('17:00'),
  lunchDuration: z.number().int().min(0).max(120).default(60),
  lunchStartTime: z.string().default('12:00'),
  includeLunchBreak: z.boolean().default(true),
  shortBreakInterval: z.number().int().min(30).max(180).default(90),
  shortBreakDuration: z.number().int().min(5).max(30).default(15),
  bufferBetweenBlocks: z.number().int().min(0).max(30).default(5),
});

export const aiSettingsSchema = z.object({
  aiProvider: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
  aiApiKey: z.string().nullable().default(null),
  aiModel: z.string().nullable().default(null),
});

export const reflectionSettingsSchema = z.object({
  lookbackPeriodDays: z.enum(['30', '60', '90']).transform(Number).default(30),
  accuracyThreshold: z.number().int().min(5).max(50).default(10),
  minCompletedBlocks: z.number().int().min(1).max(10).default(3),
  showPatterns: z.boolean().default(true),
});

// ============================================================================
// TASK SCHEMAS
// ============================================================================

export const taskSettingsSchema = z.object({
  defaultPriority: z.enum(['low', 'medium', 'high']).default('medium'),
  defaultSortOrder: z.enum(['priority', 'dueDate', 'created', 'label']).default('priority'),
  showCompletedCount: z.number().int().min(5).max(50).default(10),
  enableNotifications: z.boolean().default(false),
  notificationTiming: z.enum(['atDue', '15min', '1hour', '1day']).default('15min'),
  autoArchiveAfterDays: z.number().int().min(7).max(365).default(30),
  customLabels: z.array(z.string()).default(['Work', 'Personal', 'Shopping']),
  groupByLabel: z.boolean().default(false),
  keepHighPrioritySeparate: z.boolean().default(true),
});

// ============================================================================
// FOCUS SCHEMAS
// ============================================================================

export const pomodoroSettingsSchema = z.object({
  workDuration: z.number().int().min(10).max(60).default(25),
  shortBreakDuration: z.number().int().min(3).max(15).default(5),
  longBreakDuration: z.number().int().min(10).max(30).default(15),
  longBreakInterval: z.number().int().min(2).max(8).default(4),
  autoStartBreaks: z.boolean().default(false),
  autoStartPomodoros: z.boolean().default(false),
  soundEnabled: z.boolean().default(true),
});

// ============================================================================
// TOOLBOX SCHEMAS
// ============================================================================

export const toolboxSettingsSchema = z.object({
  defaultSortOrder: z.enum(['effectiveness', 'recent', 'alpha']).default('effectiveness'),
  showEffectivenessScore: z.boolean().default(true),
  favoriteStrategies: z.array(z.string()).default([]),
  archiveOldStrategies: z.boolean().default(false),
  minimumUsageForInsights: z.number().int().min(1).max(10).default(3),
});

// ============================================================================
// ACCOUNT SCHEMAS
// ============================================================================

export const accountSettingsSchema = z.object({
  timezone: z.string().default('America/New_York'),
  dateFormat: z.enum(['US', 'EU', 'ISO']).default('US'),
  profilePictureUrl: z.string().url().nullable().default(null),
  emailPreferences: z.object({
    weeklyDigest: z.boolean().default(true),
    goalReminders: z.boolean().default(true),
    productUpdates: z.boolean().default(false),
  }).default({
    weeklyDigest: true,
    goalReminders: true,
    productUpdates: false,
  }),
});

// ============================================================================
// SCHEMA MAPPING
// ============================================================================

export const settingsSchemas = {
  tracker: trackerSettingsSchema,
  protocol: protocolSettingsSchema,
  experiment: experimentSettingsSchema,
  checkIn: checkInSettingsSchema,
  notes: notesSettingsSchema,
  calendar: calendarSettingsSchema,
  planning: planningSettingsSchema,
  ai: aiSettingsSchema,
  reflection: reflectionSettingsSchema,
  task: taskSettingsSchema,
  pomodoro: pomodoroSettingsSchema,
  toolbox: toolboxSettingsSchema,
  account: accountSettingsSchema,
} as const;
