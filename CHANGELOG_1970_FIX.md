# Changelog: 1970-01-0x Placeholder-Date Hack Removal & Settings Migration to `app_settings`

## 1. Overview
Eliminated the legacy hack where system settings (Shift configuration, STG calculation configuration, and obsolete mapping queries) were stored as faux rows in the `entries` table under placeholder dates (`1970-01-01`, `1970-01-04`, `1970-01-02`, `1970-01-03`).

All settings are now centrally managed in the dedicated `app_settings` table, served through `/api/settings`, cached via `src/lib/settings.ts` (`unstable_cache` with tag `'settings'`), and consumed uniformly by client components through SWR hooks in `src/hooks/useSettings.ts`.

> [!NOTE]
> `__METADATA__:` markers inside `entries.notes` (used by `TSReport`, `STGReport`, `StockReport`, and `StockEntryForm`) remain untouched as they are out of scope for this task and follow a separate pattern for a future cleanup.

---

## 2. Bug Reproductions & Findings

### Bug 1: `api/entries/route.ts` remapped `1970-01-01` to today's date
- **Reproduced**: Previously, line 102 (`if (date === '1970-01-01') date = getTodayString()`) and line 173 (`if (entry_date === '1970-01-01') entry_date = getTodayString()`) actively rewrote the date.
- **Impact**: Checks like `e.entry_date === '1970-01-01'` in `ts/page.tsx:31`, `stock/page.tsx:35`, and `stock/periodical/page.tsx:204` could never match on database queries; they only functioned through fragile fallback notes parsing.
- **Resolution**: Removed all date remapping in `api/entries/route.ts`. Settings are no longer queried through `entries`.

### Bug 2: `ConfigPanel.tsx` lost saved shift configuration
- **Reproduced**: `ConfigPanel.tsx` was executing `POST /api/entries` without specifying `entry_date`. The backend assigned today's date, but readers explicitly queried `date=1970-01-01`.
- **Impact**: Readers silently discarded the stored shift configuration and fell back to default day/night shifts and `full_day` mode.
- **Resolution**: `ConfigPanel.tsx` now calls `PUT /api/settings` with key `'shift_config'`, which updates `app_settings` directly. SWR automatically invalidates and distributes the updated configuration to all listening pages in real time.

### Bug 3: Settings rows appeared in real periodical report data
- **Reproduced**: Because `ConfigPanel.tsx` saved entries with today's date and the GET API remapped dates, settings rows were treated as real `STOCK` entries.
- **Impact**: Filtering `entry_date !== '1970-01-01'` failed to exclude settings rows from production stock reports.
- **Resolution**: Migrated existing settings rows out of `entries` into `app_settings` and added the `entries_real_date_chk` check constraint preventing any date earlier than `2000-01-01`.

### Dead Code Removal: `1970-01-02` and `1970-01-03`
- `api/entries/route.ts` previously had handlers referencing `1970-01-02` (`INTERNAL_STOCK_MAPPING`) and `1970-01-03` (`STOCK_MAPPING`). These were verified as dead code because mapping queries are handled earlier in the pipeline by dedicated tables `receipt_partition_mappings` and `statement_mapping_rules`. These obsolete branches have been safely removed.

---

## 3. Database Migration (`024_migrate_1970_settings_to_app_settings.sql`)
1. **Target Table**: Verified `app_settings(key text PRIMARY KEY, value jsonb NOT NULL, updated_by text DEFAULT 'admin', updated_at timestamptz NOT NULL DEFAULT now())`.
2. **Backup Table**: Created `entries_settings_backup` containing exact copies of all migrated rows.
3. **Data Migration**:
   - `shift_config`: Extracted latest valid non-metadata JSON notes row with `report_type = 'STOCK'` and null shift.
   - `stg_calc_config`: Extracted latest valid row with `report_type = 'STG_CALC_CONFIG'`.
4. **Clean-up**: Deleted migrated configuration rows from `entries`.
5. **Constraint**: Added `ALTER TABLE entries ADD CONSTRAINT entries_real_date_chk CHECK (entry_date >= DATE '2000-01-01') NOT VALID;` to prevent legacy placeholder dates from ever being inserted again.
6. **Master Schema**: Appended migration 024 to `supabase/complete_aavin_database.sql`.

---

## 4. Files Created and Modified

### Created
- `supabase/migrations/024_migrate_1970_settings_to_app_settings.sql`: Database migration.
- `src/lib/settingsDefaults.ts`: Central default configurations for `shift_config` and `stg_calc_config`.
- `src/lib/settings.ts`: Server-side cached getter/setter functions using `unstable_cache`.
- `src/app/api/settings/route.ts`: Protected GET and PUT endpoints for `app_settings`.
- `src/hooks/useSettings.ts`: Shared SWR hooks (`useSettings`, `useShiftConfig`, `useStgCalcConfig`).
- `CHANGELOG_1970_FIX.md`: This documentation file.

### Modified
- `src/lib/types.ts`: Added TypeScript interfaces `ShiftScheduleItem`, `ProductScheduleItem`, `ShiftConfig`, and `StgCalcConfig`. Removed `STG_CALC_CONFIG` from `ReportType`.
- `src/components/layout/ConfigPanel.tsx`: Replaced `/api/entries` fetch and save with `useShiftConfig()`.
- `src/app/dashboard/ts/config/page.tsx`: Replaced `/api/entries` fetch and save with `useStgCalcConfig()`.
- `src/components/forms/StockEntryForm.tsx`: Replaced shift config fetch and notes parsing with `useShiftConfig()`.
- `src/components/forms/TSEntryForm.tsx`: Replaced shift config fetch with `useShiftConfig()`.
- `src/app/dashboard/ts/page.tsx`: Replaced shift config fetch and removed `1970-01-01` check.
- `src/app/dashboard/ts/[date]/page.tsx`: Replaced shift config fetch with `useShiftConfig()`.
- `src/app/dashboard/stock/page.tsx`: Replaced shift config fetch and removed `1970-01-01` check.
- `src/app/dashboard/stock/[date]/[shift]/page.tsx`: Replaced shift config fetch with `useShiftConfig()`.
- `src/app/dashboard/stock/preparation-charts/page.tsx`: Replaced shift config fetch with `useShiftConfig()`.
- `src/app/dashboard/stock/periodical/page.tsx`: Removed `1970-01-01` filtering and metadata lookup.
- `src/app/api/entries/route.ts`: Removed `1970-01-01` remapping and unreachable `1970-01-02/03` handlers.
- `supabase/complete_aavin_database.sql`: Synchronized table and constraint definitions.

---

## 5. Verification & Acceptance
- `npx tsc --noEmit`: Passed with 0 errors.
- `npm run build`: Passed cleanly, generating all 60 static and dynamic pages.
- `git grep -n "1970-01" src`: 0 occurrences.
- `git grep -n "STG_CALC_CONFIG" src`: 0 occurrences.
- All 8 reader pages now query `/api/settings?keys=shift_config,stg_calc_config,calc_config` once using a shared SWR cache key, eliminating redundant network calls.

