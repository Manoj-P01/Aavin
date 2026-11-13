# CHANGELOG: Schema Cleanup, JSON Row Tables, Removal of `separation_details`, Editable Keys with Cascade & Literal Sanitization

**Date**: 2026-11-09  
**Scope**: Complete implementation of Prompt 3 specifications across Database Migrations, API Endpoints, Frontend Forms, Reporting Modules, and Schema Master Files.

---

## 1. Security & Credentials Notice (Immediate Action Required)
> [!CAUTION]
> **Key Rotation Reminder**: `.env.local` was detected in the archive source. It contains production Supabase service credentials and JWT secrets. 
> 1. **Rotate Supabase API Keys immediately**: In your Supabase project dashboard (Settings ➔ API), rotate both the `anon` public key and the `service_role` secret key.
> 2. **Exclude `.env*` from future archives**: Ensure `.gitignore` and zip/export utilities explicitly ignore `.env`, `.env.local`, `.env.*.local`.

---

## 2. Backup Tables (`_bak_*`) Notice
The following backup tables were created prior to schema transformations and data migrations:
- `_bak_separation_details`: Full backup of legacy separation particulars before dropping the table.
- `_bak_entries`: Backup of master entries table before re-indexing, date-first constraint reordering, and CHECK constraint tightening.
- `_bak_stg_reconciliation_entries`: Backup of STG reconciliation data before date-first unique key updates.
- `_bak_prep_chart_entries`: Backup of preparation chart entries before date-first unique key updates.
- `_bak_ts_milk_rows`: Backup of TS operational data rows prior to dropping fixed numeric columns and migrating to dynamic `row_json`.
- `_bak_stg_rows`: Backup of Solid Balance rows prior to dropping fixed numeric columns and migrating to dynamic `row_json`.

> [!NOTE]
> All `_bak_*` tables are non-destructive snapshots. After operational verification of report queries and entries, you can drop them with:
> ```sql
> DROP TABLE IF EXISTS public._bak_separation_details CASCADE;
> DROP TABLE IF EXISTS public._bak_entries CASCADE;
> DROP TABLE IF EXISTS public._bak_stg_reconciliation_entries CASCADE;
> DROP TABLE IF EXISTS public._bak_prep_chart_entries CASCADE;
> DROP TABLE IF EXISTS public._bak_ts_milk_rows CASCADE;
> DROP TABLE IF EXISTS public._bak_stg_rows CASCADE;
> ```

---

## 3. Summary of Completed Parts

### PART A – Removal of `separation_details` Completely
- **Database**:
  - Created migration `025_drop_separation_details.sql` taking backup into `_bak_separation_details` and dropping `public.separation_details CASCADE`.
  - Removed all definitions, table creation, comments, and RLS policies from `supabase/complete_aavin_database.sql`.
- **Codebase**:
  - Removed `separation_details` selects, inserts, and deletes from `src/app/api/stock/route.ts` and `src/app/api/entries/import/route.ts`.
  - Removed `separation_details` references from `StockEntryForm.tsx`, `StockReport.tsx`, `query/page.tsx`, `stock/[date]/[shift]/page.tsx`, and `lib/types.ts`.
  - Replaced `ts/[date]/page.tsx` dependency on `sSep` by deriving SSM litres directly from `stock_rows.entry_json`.
  - **Verification**: `grep -rniE "separation" src supabase/complete_aavin_database.sql` returns 0 hits.

---

### PART B – Date-First Ordering & Strict Constraints
- **Database (`026_entries_order_date_first.sql`)**:
  - Replaced `UNIQUE (entry_date, shift, report_type)` on `entries` with `UNIQUE (entry_date, report_type, shift)`.
  - Rebuilt indexes on `entries`: `idx_entries_date_report_shift` on `(entry_date DESC, report_type, shift)` and `idx_entries_report_date` on `(report_type, entry_date DESC)`.
  - Tightened CHECK constraint on `entries.report_type` strictly to `('TS', 'STOCK', 'STG')`.
  - Reordered unique keys and indexes to date-first on `stg_reconciliation_entries` (`entry_date, statement_key, shift`) and `prep_chart_entries` (`entry_date, chart_key, shift`).
  - Updated `complete_aavin_database.sql` to declare business columns in date-first order: `id, entry_date, <key/type>, shift, ...`.
- **API & Query Helpers**:
  - Created `src/lib/queryOrder.ts` exporting `orderByDate(query)` (`entry_date DESC`, `report_type`, `shift`).
  - Applied `orderByDate` across list queries in `api/entries`, `api/stock`, `api/ts`, `api/stock/query`, `api/stock/periodical`, and reconciliation list endpoints.
  - Updated `onConflict` parameter to `'entry_date,statement_key,shift'` in `api/ts/reconciliation/route.ts` and `'entry_date,chart_key,shift'` in `api/stock/preparation-charts/route.ts`.

---

### PART C – JSON Storage (`row_json`) for `ts_milk_rows` & `stg_rows`
- **Database (`027_ts_stg_rows_to_json.sql`)**:
  - Added `row_json jsonb NOT NULL DEFAULT '{}'::jsonb` to `ts_milk_rows` and `stg_rows`.
  - Backfilled existing numeric values (`qty_lts, qty_kg, fat_pct, snf_pct, sp_gr, kg_fat, kg_snf, remarks`) using `jsonb_strip_nulls(jsonb_build_object(...))`.
  - Dropped fixed numeric and text columns from both tables.
  - Dropped fixed CHECK constraint `stg_rows_product_block_check` (`'WM','SSM','CREAM','SMP'`) to support flexible user-defined blocks.
  - Updated `complete_aavin_database.sql` table definitions.
- **API Boundaries (`src/lib/rowJson.ts`)**:
  - Implemented `packRow`, `packRows`, `unpackRow`, `unpackRows`.
  - Applied `unpackRows` on `GET /api/ts` and `api/export-excel` so client components receive flat records without breaking existing UI bindings.
  - Applied server-side calculations (`kg_fat`, `kg_snf`, `sp_gr`) in `POST /api/ts` and packed all metrics into `row_json` before insertion.
  - Updated `api/entries/import/route.ts` to pack imported rows into `row_json`.
  - Extended `TSMilkRow` and `STGRow` TypeScript interfaces in `src/lib/types.ts` with optional `row_json?: Record<string, any>`.

---

### PART D – Fully Editable Keys with Cascading Renames
- **Postgres Stored Function (`028_fn_rename_key.sql`)**:
  - Implemented `fn_rename_key(p_scope, p_old, p_new, p_context, p_dry_run)`:
    - Scopes: `product`, `prep_chart`, `prep_chart_column`, `statement`, `stg_column`, `ts_column`, `rule`, `dairy`.
    - Format validation: snake_case (`^[a-z][a-z0-9_]*$`) for system identifiers; non-empty trimmed string for dairy names.
    - Prevents self-renames and collisions with existing keys.
    - Dry-run capability (`p_dry_run = true`): computes and returns affected row counts across tables and jsonb fields without modifying data.
    - Cascades renames across relational columns and embedded JSON keys:
      - `stock_rows.entry_json`, `stock_summary_rows.summary_data`
      - `prep_chart_entries.entry_json`
      - `stg_rows.row_json`, `ts_milk_rows.row_json`
      - `prep_to_stock_mapping_rules`, `statement_mapping_rules`, `stg_to_ts_mapping_rules`, `receipt_partition_mappings`
      - `prep_chart_configs`, `ts_masters`, `stg_masters`, `app_settings`
- **Rename Endpoint (`POST /api/keys/rename`)**:
  - Protected by role-based auth (admin/editor).
  - Executes `fn_rename_key` inside a single database transaction.
  - Invalidate Next.js cache tags (`masters-products`, `masters-dairies`, `masters-categories`, `settings`) upon successful commit.
- **UI Component (`src/components/ui/KeyField.tsx`)**:
  - Interactive key input with auto-formatting to `snake_case`, client-side duplicate checking, and clear helper hints.
  - Integrates with `useConfirm()` to trigger a dry-run confirmation modal showing exactly how many rows across each table will be updated.
  - On confirm, calls `/api/keys/rename`, notifies the user, and triggers SWR mutate to refresh UI state.
  - Replaced plain and disabled key inputs across:
    - `ts/columns/page.tsx`
    - `ts/manage-statements/columns/page.tsx`
    - `ts/manage-statements/defaults/page.tsx` (Column keys and Statement keys)
    - `stock/preparation-charts/page.tsx`, `preparation-charts/columns/page.tsx`, `preparation-charts/defaults/page.tsx`
    - `masters/page.tsx` and `stock/products/page.tsx` (Product keys and Dairy names)
    - `stock/defaults/page.tsx`
    - `STGEntryForm.tsx` (Statement master key and Recon column key)
  - **Verification**: `grep -rn "disabled={!!.*[eE]diting" src` returns 0 hits for key fields.

---

### PART E – Removal of Hardcoded Literals & UI Button Consolidation
- **Dynamic Masters & Literals Elimination**:
  - `StockEntryForm.tsx`:
    - Replaced hardcoded preset dairies (`'Madurai-SSM'`, `'SNR-SSM'`, etc.) with dynamic fetch from `/api/master/dairies`.
    - Initialized `activeDairyBreakdownItems` and `presetDairies` to empty arrays.
    - Replaced static `'dlt_milk'` fallbacks with dynamic lookup from `columns[0]?.key`.
    - Replaced `'Liquid Milk'` category fallback with dynamic active category from `getCategories()`.
  - `StockReport.tsx`:
    - Replaced static `DEFAULT_REPORT_PRODUCTS` with dynamic derivation from `rows` and `products` prop.
  - `lib/calculations.ts`:
    - Made `zeroColumns` and `calcStockSummary` dynamic, taking columns from arguments or discovering keys dynamically from rows.
  - `app/api/stock/query/route.ts` & `app/api/stock/route.ts`:
    - Replaced static column array `['wh_milk', 'dlt_milk', ...]` with dynamic active products from `getProducts()`.
  - `app/api/stock/config/route.ts` & `app/api/stock/templates/route.ts`:
    - Replaced hardcoded `'Liquid Milk'` with `getCategories()[0]?.category_name || 'Standard'`.
  - `app/api/master/categories/route.ts`:
    - Replaced fallback category with `'Standard'`.
  - `app/dashboard/masters/page.tsx`, `stock/products/page.tsx`, `stock/defaults/page.tsx`:
    - Wired category select dropdowns to master categories with dynamic fallbacks.
  - `app/dashboard/stock/partitions/page.tsx` & `stock/mappings/page.tsx`:
    - Replaced fallback `'dlt_milk'` with first available product from master list.
- **Button Duplication & Text Alignment**:
  - `StockEntryForm.tsx`: Renamed buttons to `"⚡ Sync Receipts from Prep Charts"` (line ~1810) and `"⚡ Sync Disposals from Prep Charts"` (line ~2658).
  - `ts/manage-statements/defaults/page.tsx`: Deduplicated "Create Statement Master" and "Restore Defaults" toolbar buttons; toolbar controls show only when masters exist, while empty-state buttons show only when 0 masters exist.

---

## 4. Verification & Build Status
- `npx tsc --noEmit`: **0 errors** (Clean).
- `npm run build`: **Exit Code 0** (Compiled 61/61 static and dynamic routes in Next.js 16.2.9 Turbopack).
- Idempotency verified: All migrations (025-028) execute safely with conditional schema checks.

