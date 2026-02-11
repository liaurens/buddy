/**
 * Settings Service
 * Type-safe settings access with caching and backward compatibility
 */

import { getSetting, setSetting } from '../supabase';
import { settingsSchemas } from './settings.schemas';
import type { AllSettings, SettingCategory } from './settings.types';

// In-memory cache for settings
const settingsCache = new Map<string, unknown>();

/**
 * Get a complete category of settings with defaults
 */
export async function getCategorySettings<T extends SettingCategory>(
  userId: string,
  category: T
): Promise<AllSettings[T]> {
  const cacheKey = `${userId}:${category}`;

  // Check cache first
  if (settingsCache.has(cacheKey)) {
    return settingsCache.get(cacheKey) as AllSettings[T];
  }

  const schema = settingsSchemas[category] as any;
  const rawSettings: Record<string, string> = {};

  // Get all settings for this category from database
  const schemaShape = schema._def.shape as Record<string, any>;
  const keys = Object.keys(schemaShape);

  await Promise.all(
    keys.map(async (key) => {
      const dbKey = `${category}_${key}`;
      const value = await getSetting(userId, dbKey);
      if (value !== undefined) {
        // Parse JSON strings back to proper types
        try {
          rawSettings[key] = JSON.parse(value);
        } catch {
          // If not valid JSON, keep as string
          rawSettings[key] = value;
        }
      }
    })
  );

  // Parse and validate with schema (applies defaults for missing values)
  const settings = schema.parse(rawSettings);

  // Cache the result
  settingsCache.set(cacheKey, settings);

  return settings as AllSettings[T];
}

/**
 * Update one or more settings in a category
 */
export async function updateCategorySettings<T extends SettingCategory>(
  userId: string,
  category: T,
  updates: Partial<AllSettings[T]>
): Promise<void> {
  const schema = settingsSchemas[category] as any;

  // Validate the updates
  const validated = schema.partial().parse(updates) as Record<string, any>;

  // Save each setting to database
  await Promise.all(
    Object.entries(validated).map(async ([key, value]) => {
      const dbKey = `${category}_${key}`;
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await setSetting(userId, dbKey, stringValue);
    })
  );

  // Invalidate cache
  const cacheKey = `${userId}:${category}`;
  settingsCache.delete(cacheKey);
}

/**
 * Get a single setting value from a category
 */
export async function getSingleSetting<
  T extends SettingCategory,
  K extends keyof AllSettings[T]
>(
  userId: string,
  category: T,
  key: K
): Promise<AllSettings[T][K]> {
  const settings = await getCategorySettings(userId, category);
  return settings[key];
}

/**
 * Update a single setting value in a category
 */
export async function updateSingleSetting<
  T extends SettingCategory,
  K extends keyof AllSettings[T]
>(
  userId: string,
  category: T,
  key: K,
  value: AllSettings[T][K]
): Promise<void> {
  await updateCategorySettings(userId, category, { [key]: value } as any);
}

/**
 * Reset a category to default values
 */
export async function resetCategorySettings<T extends SettingCategory>(
  userId: string,
  category: T
): Promise<void> {
  const schema = settingsSchemas[category] as any;
  const defaults = schema.parse({}) as AllSettings[T];

  await updateCategorySettings(userId, category, defaults);
}

/**
 * Clear the settings cache (useful after logout or profile switch)
 */
export function clearSettingsCache(): void {
  settingsCache.clear();
}

/**
 * Get default values for a category without hitting the database
 */
export function getDefaultSettings<T extends SettingCategory>(
  category: T
): AllSettings[T] {
  const schema = settingsSchemas[category] as any;
  return schema.parse({}) as AllSettings[T];
}
