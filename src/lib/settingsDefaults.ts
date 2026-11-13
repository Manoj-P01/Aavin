// ─────────────────────────────────────────────────────────────
// src/lib/settingsDefaults.ts
// Central Application Settings Defaults
// Pure empty structures - zero pre-loaded business data
// ─────────────────────────────────────────────────────────────

import type { ShiftConfig, StgCalcConfig } from './types';

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  mode: 'full_day',
  shifts: [],
  products: [],
};

export const DEFAULT_STG_CALC_CONFIG: StgCalcConfig = {
  fatCalcMode: 'FROM_PCT',
  snfCalcMode: 'FROM_PCT',
  densityFactor: 0,
};
