// ─────────────────────────────────────────────────────────────
// src/hooks/useSettings.ts
// Shared SWR Client Hook for System and Shift Configuration
// ─────────────────────────────────────────────────────────────

'use client';

import useSWR from 'swr';
import { DEFAULT_SHIFT_CONFIG, DEFAULT_STG_CALC_CONFIG } from '@/lib/settingsDefaults';
import type { ShiftConfig, StgCalcConfig } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed to load settings');
  return r.json();
});

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<{ data: Record<string, any> }>(
    '/api/settings?keys=shift_config,stg_calc_config,calc_config',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );

  const saveSetting = async (key: string, value: any) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to save setting ${key}`);
    }
    const json = await res.json();
    await mutate(
      prev => ({
        data: {
          ...(prev?.data || {}),
          [key]: value,
        },
      }),
      { revalidate: true }
    );
    return json.data;
  };

  return {
    settings: data?.data || {},
    isLoading,
    error,
    saveSetting,
    refresh: mutate,
  };
}

export function useShiftConfig() {
  const { settings, isLoading, error, saveSetting, refresh } = useSettings();
  const dbConfig = settings['shift_config'] as Partial<ShiftConfig> | undefined;

  const shiftConfig: ShiftConfig = dbConfig
    ? {
        ...DEFAULT_SHIFT_CONFIG,
        ...dbConfig,
        shifts: Array.isArray(dbConfig.shifts) && dbConfig.shifts.length > 0
          ? dbConfig.shifts
          : DEFAULT_SHIFT_CONFIG.shifts,
      }
    : DEFAULT_SHIFT_CONFIG;

  const saveShiftConfig = async (newConfig: ShiftConfig) => {
    return saveSetting('shift_config', newConfig);
  };

  return {
    shiftConfig,
    isLoading,
    error,
    saveShiftConfig,
    refresh,
  };
}

export function useStgCalcConfig() {
  const { settings, isLoading, error, saveSetting, refresh } = useSettings();
  const dbConfig = settings['stg_calc_config'] as Partial<StgCalcConfig> | undefined;

  const calcConfig: StgCalcConfig = dbConfig
    ? { ...DEFAULT_STG_CALC_CONFIG, ...dbConfig }
    : DEFAULT_STG_CALC_CONFIG;

  const saveStgCalcConfig = async (newConfig: StgCalcConfig) => {
    return saveSetting('stg_calc_config', newConfig);
  };

  return {
    calcConfig,
    isLoading,
    error,
    saveStgCalcConfig,
    refresh,
  };
}

