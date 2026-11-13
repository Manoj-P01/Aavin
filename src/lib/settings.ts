// ─────────────────────────────────────────────────────────────
// src/lib/settings.ts
// Server-side Cached App Settings Layer (app_settings table)
// ─────────────────────────────────────────────────────────────

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_SHIFT_CONFIG, DEFAULT_STG_CALC_CONFIG } from './settingsDefaults';
import type { ShiftConfig, StgCalcConfig } from './types';

export function invalidateSettingsTag() {
  try {
    (revalidateTag as any)('settings', 'default');
  } catch {}
}

/** Fetch multiple settings by keys from app_settings */
export const getSettings = unstable_cache(
  async (keys: string[]): Promise<Record<string, any>> => {
    try {
      const supabase = getSupabaseServiceClient();
      let query = supabase.from('app_settings').select('key, value');
      if (keys && keys.length > 0) {
        query = query.in('key', keys);
      }
      const { data, error } = await query;
      if (error || !data) return {};

      const map: Record<string, any> = {};
      data.forEach((row: { key: string; value: any }) => {
        map[row.key] = row.value;
      });
      return map;
    } catch (err) {
      console.error('Failed to load settings from app_settings:', err);
      return {};
    }
  },
  ['app-settings-multi'],
  { tags: ['settings'], revalidate: 3600 }
);

/** Fetch single setting by key */
export async function getSetting<T = any>(key: string): Promise<T | null> {
  const map = await getSettings([key]);
  return (map[key] as T) || null;
}

/** Convenience helper for shift config with fallback */
export async function getShiftConfig(): Promise<ShiftConfig> {
  const cfg = await getSetting<ShiftConfig>('shift_config');
  return cfg ? { ...DEFAULT_SHIFT_CONFIG, ...cfg } : DEFAULT_SHIFT_CONFIG;
}

/** Convenience helper for STG calculation config with fallback */
export async function getStgCalcConfig(): Promise<StgCalcConfig> {
  const cfg = await getSetting<StgCalcConfig>('stg_calc_config');
  return cfg ? { ...DEFAULT_STG_CALC_CONFIG, ...cfg } : DEFAULT_STG_CALC_CONFIG;
}

/** Persist setting row into app_settings and invalidate cache */
export async function setSetting(key: string, value: any, updatedBy: string = 'admin'): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from('app_settings').upsert({
    key,
    value,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  if (error) {
    throw new Error(`Failed to save setting ${key}: ${error.message}`);
  }

  invalidateSettingsTag();
}

