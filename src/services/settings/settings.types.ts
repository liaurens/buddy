/**
 * Settings Types
 * Type definitions for all application settings organized by tool/feature
 */

// ============================================================================
// HEALTH TRACKING SETTINGS
// ============================================================================

export interface TrackerSettings {
    defaultReminderTime: string;
    enableReminders: boolean;
    showGoalProgress: boolean;
    chartDefaultDays: 7 | 14 | 30 | 90;
    chartType: 'line' | 'bar' | 'scatter';
    hideEmptyTrackers: boolean;
    trackingStreak: boolean;
}

export interface ProtocolSettings {
    defaultDoseTime: string;
    enableDoseReminders: boolean;
    reminderAdvanceMinutes: number;
    reminderSound: boolean;
    showUpcomingCount: number;
    skipWeekends: boolean;
}

export interface ExperimentSettings {
    defaultDurationDays: number;
    minDataPoints: number;
    showCorrelationThreshold: number;
    autoArchiveCompleted: boolean;
}

export interface CheckInSettings {
    dailyReminderTime: string;
    enableDailyReminder: boolean;
    requiredFields: string[]; // Array of tracker IDs
    showRecentCheckIns: number;
    completionCelebration: boolean;
}

// ============================================================================
// JOURNAL/NOTES SETTINGS
// ============================================================================

export interface NotesSettings {
    autoCategorizationEnabled: boolean;
    defaultCategoryId: string | null;
    sortOrder: 'newest' | 'oldest' | 'alpha';
    showCategoryBadges: boolean;
    enableSmartSuggestions: boolean;
    archiveAfterDays: number;
}

// ============================================================================
// CALENDAR SETTINGS
// ============================================================================

export interface CalendarSettings {
    calendarUrl: string | null;
    calendarName: string;
    autoSyncEnabled: boolean;
    syncIntervalMinutes: number;
    lastSyncTime: string | null;
    showInPlanning: boolean;
    includeAllDayEvents: boolean;
    minEventDurationMinutes: number;
}

// ============================================================================
// PLANNING SETTINGS
// ============================================================================

export interface PlanningSettings {
    workStartTime: string;
    workEndTime: string;
    lunchDuration: number;
    lunchStartTime: string;
    includeLunchBreak: boolean;
    shortBreakInterval: number;
    shortBreakDuration: number;
    bufferBetweenBlocks: number;
    activityCategories: string[];
}

export interface AISettings {
    aiProvider: 'openai' | 'anthropic' | 'gemini';
    aiApiKey: string | null;
    aiModel: string | null;
}

export interface ReflectionSettings {
    lookbackPeriodDays: 30 | 60 | 90;
    accuracyThreshold: number;
    minCompletedBlocks: number;
    showPatterns: boolean;
}

// ============================================================================
// TASK SETTINGS
// ============================================================================

export interface TaskSettings {
    defaultPriority: 'low' | 'medium' | 'high';
    defaultSortOrder: 'priority' | 'dueDate' | 'created' | 'label';
    showCompletedCount: number;
    enableNotifications: boolean;
    notificationTiming: 'atDue' | '15min' | '1hour' | '1day';
    autoArchiveAfterDays: number;
    customLabels: string[]; // Custom labels for tasks
    groupByLabel: boolean; // Group tasks by label
    keepHighPrioritySeparate: boolean; // Show high priority tasks separately
}

// ============================================================================
// FOCUS SETTINGS
// ============================================================================

export interface PomodoroSettings {
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    longBreakInterval: number;
    autoStartBreaks: boolean;
    autoStartPomodoros: boolean;
    soundEnabled: boolean;
}

// ============================================================================
// TOOLBOX SETTINGS
// ============================================================================

export interface ToolboxSettings {
    defaultSortOrder: 'effectiveness' | 'recent' | 'alpha';
    showEffectivenessScore: boolean;
    favoriteStrategies: string[]; // Array of strategy IDs
    archiveOldStrategies: boolean;
    minimumUsageForInsights: number;
}

// ============================================================================
// ACCOUNT SETTINGS
// ============================================================================

export interface AccountSettings {
    timezone: string;
    dateFormat: 'US' | 'EU' | 'ISO';
    profilePictureUrl: string | null;
    emailPreferences: {
        weeklyDigest: boolean;
        goalReminders: boolean;
        productUpdates: boolean;
    };
}

// ============================================================================
// COMMS SETTINGS
// ============================================================================

export interface CommsItem {
    id: string;
    label: string;
    daysOfWeek: number[] | null; // null = every day; 0=Sun 1=Mon … 6=Sat
}

export interface CommsSettings {
    items: CommsItem[];
}

// ============================================================================
// NOTIFICATIONS SETTINGS
// ============================================================================

export interface NotificationsSettings {
    pushEnabled: boolean;
    morningEnabled: boolean;
    morningTime: string; // HH:MM
    morningDays: number[]; // 0=Sun … 6=Sat; all 7 days = every day
    middayEnabled: boolean;
    middayTime: string; // HH:MM
    middayDays: number[];
    nightEnabled: boolean;
    nightTime: string; // HH:MM
    nightDays: number[];
    taskDueEnabled: boolean;
    taskDueAdvanceMinutes: number;
    /** Default escalation pattern for task reminders without a per-task override. */
    taskReminderCadence: 'single' | 'smart' | 'aggressive';
    calendarEventEnabled: boolean;
    calendarEventAdvanceMinutes: number;

    // Off-track escalation
    offTrackEnabled: boolean;
    offTrackOverdueTasks: boolean;
    offTrackMissedRoutines: boolean;
    offTrackSkippedCheckin: boolean;
    offTrackIdle: boolean;

    // Quiet hours (HH:MM); start > end means range crosses midnight.
    // When enabled, pushes inside the window are held until it ends.
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    maxRemindersPerHour: number;
}

// ============================================================================
// COMBINED SETTINGS TYPE
// ============================================================================

export interface AllSettings {
    tracker: TrackerSettings;
    protocol: ProtocolSettings;
    experiment: ExperimentSettings;
    checkIn: CheckInSettings;
    notes: NotesSettings;
    calendar: CalendarSettings;
    planning: PlanningSettings;
    ai: AISettings;
    reflection: ReflectionSettings;
    task: TaskSettings;
    pomodoro: PomodoroSettings;
    toolbox: ToolboxSettings;
    account: AccountSettings;
    comms: CommsSettings;
    notifications: NotificationsSettings;
}

export type SettingCategory = keyof AllSettings;
export type SettingKey<T extends SettingCategory> = keyof AllSettings[T];
