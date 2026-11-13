# Refactoring Changelog: Aavin Dashboard Cleanup & Enhancements

> **Important Security Reminder**: Rotate Supabase keys (they were shared in a zip).

---

## Phase 1: Security First
- [x] Confirmed `.env*` and `.env.local` are git-ignored in `.gitignore`.
- [x] Confirmed `/.next/` and `*.tsbuildinfo` are ignored in `.gitignore`.
- [x] Verified `SUPABASE_SERVICE_ROLE_KEY` is imported strictly in server code (`src/lib/supabase.ts`), zero client-side leaks.
- [x] Documented key rotation reminder.

---

## Phase 2: Master Data Refactoring & Dynamic DB Defaults
- [x] Created `src/lib/masters.ts` server-side caching layer with Next.js `unstable_cache` and cache tags (`masters-products`, `masters-dairies`, `masters-categories`).
- [x] Created `src/app/api/masters/bootstrap/route.ts` returning `{ products, dairies, categories, settings }` in one efficient call.
- [x] Created `src/hooks/useMasters.ts` client hook powered by SWR for cross-component shared state.
- [x] Removed hardcoded product arrays, blocks, and category fallbacks across `src/lib/calculations.ts`, `StockEntryForm.tsx`, `STGReport.tsx`, `StockReport.tsx`, and API routes.
- [x] Added `is_default` boolean column to `products_master` (Migration `020_products_master_is_default.sql`).
- [x] Created `app_settings` key-value table and calculation config helper (Migration `021_app_settings.sql`).
- [x] Replaced hardcoded organization name literals with `NEXT_PUBLIC_ORG_NAME` and `NEXT_PUBLIC_ORG_SHORT` in `Sidebar.tsx`, `login/page.tsx`, `layout.tsx`, and `dashboard/page.tsx`.
- [x] Moved seed arrays to idempotent `supabase/seed.sql` (`ON CONFLICT DO NOTHING`).
- [x] Removed every single `select('*')` call across `src/app/api/**` (55 occurrences replaced with explicit columns).
- [x] Added pagination (`limit`/`offset`) and date filtering (`from`/`to`) to `/api/entries` and `/api/stock/query`.
- [x] Created `monthly_totals` SQL view and `fn_get_monthly_totals` function (Migration `022_monthly_totals_view.sql`).
- [x] Modularized `api/export-excel/route.ts` (57 KB) into `src/lib/export/excelStock.ts`, `excelTS.ts`, `excelSTG.ts`, and `excelStyles.ts`.

---

## Phase 3: Button Audit Fixes & Conventions
- [x] Created standardized UI components `src/components/ui/PageActions.tsx` and `StickyActionBar.tsx`.
- [x] Removed duplicate Print/PDF and Export Excel buttons from bottom of `src/app/dashboard/ts/[date]/page.tsx`, keeping header pair.
- [x] Removed table-header "Save Template" duplicate in `stock/preparation-charts/defaults/page.tsx`.
- [x] Standardized toolbar vs sticky bar Save on `ts/columns`, `ts/ts-mappings`, `ts/defaults`, and `stock/mappings`: top Save retained, sticky bar dedicated to "Unsaved changes" + Discard.
- [x] Removed duplicate "Add Receipt Row" / "Add Disposal Row" in `stock/defaults/page.tsx`.
- [x] Removed duplicate master creation and reconciliation buttons in `ts/manage-statements/defaults/page.tsx`.
- [x] Deleted commented-out "Extract Daily Sheets Excel" block in `stock/periodical/page.tsx`.
- [x] Renamed ambiguous buttons in `STGEntryForm.tsx` ("⚡ Sync Receipts from Stock", "⚡ Sync Opening Balance from Stock", "➕ Add Recon Row", "➕ Add Recon Column").
- [x] Renamed plain Add buttons in `stock/products/page.tsx` ("➕ Add Product", "➕ Add Receipt Particular", "➕ Add Disposal Particular").

---

## Phase 4: UI System & Sidebar Reorganization
- [x] Added global CSS tokens for spacing (`--space-1` to `--space-10`), radius, shadow, font sizes, dark theme `[data-theme="dark"]`, mobile `@media (max-width: 768px)`, and print `@media print` in `src/app/globals.css`.
- [x] Created shared UI component library in `src/components/ui/`:
  - `PageHeader.tsx`
  - `Field.tsx`
  - `DataTable.tsx`
  - `StatCard.tsx`
  - `EmptyState.tsx`
  - `Modal.tsx`
  - `Tabs.tsx`
- [x] Reorganized Sidebar (`src/components/layout/Sidebar.tsx`) into functional categories (as confirmed by user):
  - **Entry**: Preparation Charts, New Stock Statement Entry, New STG Entry, New TS Entry
  - **Reports**: Dashboard, Periodical Summary Report, Stock Register, Total Solids Register, Prep Chart Report
  - **Masters & Settings**: Chart Masters, Default Formulations, Columns Config, Stock Defaults, Products List, TS Masters, Statement Columns, Rule Mappings, Shift Settings
- [x] Added desktop sidebar collapse toggle and mobile drawer support.
- [x] Enhanced Dashboard (`DashboardClient.tsx`) with KPI `StatCard`s, date range filter, `monthly_totals` trend charts, and pending entries list.

---

## Phase 5: Preparation Chart Report Page
- [x] Created `src/lib/export/prepChartExport.ts`: modularized Excel (`xlsx-js-style`), CSV, and print-ready PDF export functions.
- [x] Created range query API `GET /api/stock/preparation-charts/report?from=&to=&shift=&charts=` in `src/app/api/stock/preparation-charts/report/route.ts`.
- [x] Created dedicated report page `src/app/dashboard/stock/preparation-charts/report/page.tsx`:
  - PageHeader with breadcrumbs and actions: `🖨 Print / PDF`, `📥 Export Excel`, `📄 Export CSV`, `← Back to Preparation Charts`.
  - Sticky Filter bar with Single Day / Date Range / Month modes, Shift filter, and Chart multi-select.
  - KPI strip (`StatCard`s for charts included, days covered, total batches, total quantity, peak day).
  - Tabs: `Summary` (per-chart aggregation with totals), `Detailed` (expandable formulation rows), `Compare` (delta comparison).
  - Row actions: `👁 View`, `✏️ Edit` linking back to entry screen with parameters.
  - Sticky footer with entry count, timestamp, and Back to Top.
- [x] Linked from Sidebar under Reports (icon 🧾) and from prep chart entry page (`🧾 Open Report`).
- [x] Regenerated `supabase/complete_aavin_database.sql` to include migrations 020 to 023.

---

## Phase 6: Acceptance & Verification
- [x] `npx tsc --noEmit`: Passed with 0 errors.
- [x] `npm run build`: Passed with 0 errors (all 59 pages statically generated/compiled).
- [x] Strictly adhered to git constraints: NO git push, NO git commits. All modifications preserved in uncommitted working tree.
- [x] Zero tokens for calculations: all report aggregations and metrics are computed strictly via pure JavaScript / SQL math.

---

## Remaining UI Style Modernization: `TODO(ui)`
While repeated layout styles and export buttons have been consolidated into CSS and shared components, the following files contain inline styles that can be progressively migrated to CSS classes in future iterations:
- `STGEntryForm.tsx`: ~360 inline style occurrences
- `stock/defaults/page.tsx`: ~230 inline style occurrences
- `ts/manage-statements/defaults/page.tsx`: ~225 inline style occurrences
- `stock/periodical/page.tsx`: ~195 inline style occurrences
- `masters/page.tsx`: ~160 inline style occurrences
- `stock/preparation-charts/page.tsx`: ~140 inline style occurrences
