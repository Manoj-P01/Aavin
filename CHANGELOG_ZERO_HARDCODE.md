# Zero-Hardcode & Pure DDL Architecture Migration Changelog

This document details the complete architectural refactoring of the Aavin Dashboard (Next.js 16 + Supabase) to achieve **ZERO hardcoded business data, ZERO hardcoded formulas, and ZERO pre-loaded records**, delivering a pure DDL schema where all statements, sections, particulars, column keys, mappings, calculation modes, and constants are 100% database-driven and managed via UI screens.

---

## 1. Summary of Removed Hardcoded Artifacts & Replacements

| Removed Hardcoded Entity / File / Value | Reason for Removal | Database / UI Screen Replacement |
| :--- | :--- | :--- |
| `supabase/seed.sql` | Contained pre-loaded business products, dairies, and statements | **DELETED**. System starts with empty tables. Configured via `/dashboard/setup`. |
| `src/app/api/master/seed/route.ts` (`SEED_PRODUCTS`, `SEED_DAIRIES`) | Seed API endpoint with hardcoded milk product names and union dairies | **DELETED**. Records are declared via `/dashboard/master/products` and `/dashboard/master/dairies`. |
| `INSERT INTO` & `ON CONFLICT` in `supabase/migrations/*` | Migration files embedded initial records (004, 005, 006, 007, 013, 019, 021, 024) | Rewritten to **Pure DDL Only** (`CREATE`, `ALTER`, `DROP`, `TRIGGER`, `FUNCTION`). 0 hits across `supabase/`. |
| Stored Procedure Upserts with `INSERT INTO` (`fn_upsert_product_master`, `fn_upsert_dairy_destination`, `fn_upsert_particular_master`, `fn_upsert_product_category`) | Legacy stored procedures embedded fallback inserts and `ON CONFLICT` statements | Replaced with direct Supabase JavaScript client table operations (`supabase.from(...).upsert(...)`). |
| Business Name Fallbacks (`P.VELUR CC`, `BMC's`, `LAB SAMPLE RTN`, `AMBATTUR-SSM`, `DESPATCH-SSM`, `SACHET FILLING`, `PLANT USAGE`, `DCPP`, `ERODE`, `CBE-SSM`, `Madurai`, `Tiruppur`, `Salem`) | Fallback arrays and hardcoded UI options when database tables were empty | All fallbacks removed. Empty state with link to configuration screen shown when table has 0 records. |
| Hardcoded STG Statements (17 statements bug) | Hardcoded synthetic statements (`SMP STATEMENT`, `FC.MILK STATEMENT`, `CREAM STATEMENT`, `WH.MILK STATEMENT`, etc.) injected alongside user's 9 statements | Derived strictly from `stg_masters` table. Only user-configured statement masters (9 statements) appear. |
| Redundant Hardcoded Columns (`Receipts Particular`, `Label`) | STG table headers contained hardcoded duplicate columns alongside configured column keys | Removed duplicate `<th>` tags. STG tables strictly render columns configured in `stg_statement_column_configs`. |
| Auto-Formulas on `Kg.Fat` / `Kg.Snf` | Evaluator forced hardcoded formulas onto columns even if formula was left blank | Calculations only run when `col.formula` is explicitly configured in Master Default Formulation Tables. |
| Unsafe `new Function(...)` Evaluator | JavaScript code execution in STG calculation | Replaced by safe, AST-based recursive descent formula evaluator (`src/lib/formulaEvaluator.ts`). |
| `DEFAULT_TS_MASTER` & `DEFAULT_STOCK_MASTER` | Fallback master objects when tables were empty | Removed. APIs return empty arrays `[]` and UI displays empty states prompting configuration. |
| `DEFAULT_SHIFT_CONFIG.shifts` | Pre-loaded Day/Night shifts (`D`, `N`) | Default changed to `shifts: []`. Shifts are configured via `/dashboard/ts/config` or `/dashboard/setup`. |
| `DEFAULT_STG_CALC_CONFIG` (`1.0275`, default modes) | Code-level defaults for density and calculation modes | Replaced with user configuration in `app_settings` via STG Calculation Settings screen. |
| `CALC_CONFIG` constants (`100`, `250`, `0.2`, `0.36`, `0.5`) | Hardcoded constants in mathematical formulas | Evaluator reads constants from `app_settings` row context. If required setting is missing, an explicit error is shown. |
| `getDefaultReconColumns` / `getDefaultDisposalColumns` | Hardcoded column helper signatures | Replaced with dynamic schema derivation from configured columns. |
| "Reset to Defaults" / "Seed" buttons in UI | Buttons that overwrote user data with hardcoded Excel templates | Removed across TS Defaults, STG Calculation Settings, and Master screens. |

---

## 2. New Database Architecture (Pure DDL Migration `029_zero_hardcode_stg.sql`)

### Empty Schema Tables Created:
1. **`stg_section_master`**:
   - `section_key` (PK, text), `label` (text), `row_side` (text), `is_single_row` (boolean), `sort_order` (int), `is_active` (boolean).
   - RLS enabled with `trg_stg_section_master_audit` audit trigger.
2. **`stg_field_master`**:
   - `field_key` (PK, text), `label` (text), `data_type` ('number' | 'text' | 'calculated'), `default_formula` (text), `decimals` (int), `unit` (text), `is_identifier` (boolean), `sort_order` (int), `is_active` (boolean).
   - RLS enabled with `trg_stg_field_master_audit` audit trigger.
3. **`stg_particular_master`**:
   - `id` (PK, uuid), `statement_key` (FK to `stg_masters.key`), `section_key` (FK to `stg_section_master.section_key`), `particular_code` (text), `particular_name` (text), `default_values` (jsonb), `sort_order` (int), `is_active` (boolean).
   - `UNIQUE(statement_key, section_key, particular_code)`.
4. **`stg_recon_row_type_master`**:
   - `type_key` (PK, text), `label` (text), `color_hint` (text), `sort_order` (int), `is_active` (boolean).
5. **`product_aliases`**:
   - `id` (PK, uuid), `product_key` (FK to `products_master.product_key`), `alias` (text), `is_active` (boolean).
6. **`shift_master` & `report_type_master`**:
   - Fully dynamic shifts and report types without hardcoded CHECK constraints.

### Schema Constraints Dropped:
- `entries_shift_check` dropped (allows any user-configured shift key).
- `entries_report_type_check` dropped.
- `stg_rows_side_check` dropped.
- Business column defaults removed (`products_master.category DEFAULT 'Liquid Milk'` -> `NULL`, `stg_reconciliation_entries.shift DEFAULT 'F'` -> `NULL`).

---

## 3. New UI Setup Checklist Page (`/dashboard/setup`)

A new system readiness dashboard has been built at `/dashboard/setup` (also linked in the main sidebar and in STG Entry):
- **Live Readiness Meter**: Shows `N/8 Configured` with real-time percentage progress bar.
- **Dependency-Ordered Setup Sequence**:
  1. **Settings** (`app_settings`) -> `/dashboard/ts/config`
  2. **Sections** (`stg_section_master`) -> `/dashboard/ts/sections`
  3. **Fields** (`stg_field_master`) -> `/dashboard/ts/fields`
  4. **Products & Aliases** (`products_master`, `product_aliases`) -> `/dashboard/master/products`
  5. **Statements** (`stg_masters`) -> `/dashboard/ts/statement-master-names`
  6. **Particulars** (`stg_particular_master`) -> `/dashboard/master/particulars`
  7. **Columns** (`stg_statement_column_configs`) -> `/dashboard/ts/column-config`
  8. **Formula & Sync Mappings** (`statement_mapping_rules`, `stg_to_ts_mapping_rules`) -> `/dashboard/ts/mappings`
- Each item displays the exact database table, live record count, status indicator, and direct action link.

---

## 4. Solid Balance STG Mapping Modal (`/dashboard/ts/mappings`)

- **STG Item / Particular Dropdown**:
  - Replaced text input in "Edit STG Mapping Rule" modal with a dynamic `<select>` dropdown.
  - Automatically extracts all particulars from the selected statement master and section (including `OB`, `Opening Balance`, and custom receipts/disposals defined in Master Default Formulation Tables).
  - Includes a fallback switch to type custom labels if needed.

---

## 5. Verification Results

- `Get-ChildItem -Path "aavin-dashboard/supabase" -Recurse | Select-String -Pattern "INSERT INTO|ON CONFLICT"`: **0 hits**
- `Get-ChildItem -Path "aavin-dashboard/src","aavin-dashboard/supabase" -Recurse | Select-String -Pattern "P\.VELUR|BMC's|AMBATTUR|SACHET FILLING|PLANT USAGE|DCPP|ERODE|CBE-SSM|Madurai|Tiruppur|Salem"`: **0 hits**
- `Get-ChildItem -Path "aavin-dashboard/src" -Recurse | Select-String -Pattern "NUMERIC_COLS|PROHIBITED_NAMES|DEFAULT_STG_TO_TS_RULES|DEFAULT_TS_MASTER|SEED_|getDefaultReconColumns|isHardcodedCalc"`: **0 hits**
- `npx tsc --noEmit`: **0 errors**
- `npm run build`: **Compiled successfully (all 62 routes static/dynamic built cleanly)**

