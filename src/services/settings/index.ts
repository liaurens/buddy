/**
 * Settings Service - Main Entry Point
 *
 * Provides type-safe, cached access to all application settings.
 * Each tool/feature has its own settings category with validation.
 */

// Export types
export type {
  AllSettings,
  SettingCategory,
  SettingKey,
  TrackerSettings,
  ProtocolSettings,
  ExperimentSettings,
  CheckInSettings,
  NotesSettings,
  CalendarSettings,
  PlanningSettings,
  AISettings,
  ReflectionSettings,
  TaskSettings,
  PomodoroSettings,
  ToolboxSettings,
  AccountSettings,
  CommsItem,
  CommsSettings,
} from './settings.types';

// Export schemas
export {
  settingsSchemas,
  trackerSettingsSchema,
  protocolSettingsSchema,
  experimentSettingsSchema,
  checkInSettingsSchema,
  notesSettingsSchema,
  calendarSettingsSchema,
  planningSettingsSchema,
  aiSettingsSchema,
  reflectionSettingsSchema,
  taskSettingsSchema,
  pomodoroSettingsSchema,
  toolboxSettingsSchema,
  accountSettingsSchema,
} from './settings.schemas';

// Export service functions
export {
  getCategorySettings,
  updateCategorySettings,
  getSingleSetting,
  updateSingleSetting,
  resetCategorySettings,
  clearSettingsCache,
  getDefaultSettings,
} from './settings.service';
