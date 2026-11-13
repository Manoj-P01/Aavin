-- ============================================================
-- 026_entries_order_date_first.sql
-- Reorder unique constraints and indexes to entry_date first across entries,
-- stg_reconciliation_entries, and prep_chart_entries.
-- Tighten entries report_type to ('TS', 'STOCK', 'STG').
-- ============================================================

BEGIN;

-- 1. Backup entries before changes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entries') THEN
    CREATE TABLE IF NOT EXISTS public._bak_entries AS TABLE public.entries;
  END IF;
END $$;

-- 2. Remove any legacy mapping rows if present in entries
DELETE FROM public.entries WHERE report_type IN ('INTERNAL_STOCK_MAPPING', 'STOCK_MAPPING');

-- 3. Update UNIQUE constraint on entries: (entry_date, report_type, shift)
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_entry_date_shift_report_type_key;
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_entry_date_report_type_shift_key;
ALTER TABLE public.entries ADD CONSTRAINT entries_entry_date_report_type_shift_key UNIQUE (entry_date, report_type, shift);

-- 4. Rebuild indexes on entries
DROP INDEX IF EXISTS public.idx_entries_report_date_shift;
DROP INDEX IF EXISTS public.idx_entries_report_date;
DROP INDEX IF EXISTS public.idx_entries_month_lookup;

CREATE INDEX IF NOT EXISTS idx_entries_date_report_shift ON public.entries (entry_date DESC, report_type, shift);
CREATE INDEX IF NOT EXISTS idx_entries_report_date ON public.entries (report_type, entry_date DESC);

-- 5. Tighten report_type CHECK constraint on entries
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_report_type_check;
ALTER TABLE public.entries ADD CONSTRAINT entries_report_type_check CHECK (report_type IN ('TS', 'STOCK', 'STG'));

-- 6. Update stg_reconciliation_entries unique constraint and index
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stg_reconciliation_entries') THEN
    CREATE TABLE IF NOT EXISTS public._bak_stg_reconciliation_entries AS TABLE public.stg_reconciliation_entries;
  END IF;
END $$;

ALTER TABLE public.stg_reconciliation_entries DROP CONSTRAINT IF EXISTS stg_reconciliation_entries_stmt_date_shift_key;
ALTER TABLE public.stg_reconciliation_entries DROP CONSTRAINT IF EXISTS stg_reconciliation_entries_date_stmt_shift_key;
ALTER TABLE public.stg_reconciliation_entries ADD CONSTRAINT stg_reconciliation_entries_date_stmt_shift_key UNIQUE (entry_date, statement_key, shift);

DROP INDEX IF EXISTS public.idx_stg_reconciliation_entries_lookup;
CREATE INDEX IF NOT EXISTS idx_stg_reconciliation_entries_lookup ON public.stg_reconciliation_entries (entry_date DESC, statement_key, shift);

-- 7. Update prep_chart_entries unique constraint and indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prep_chart_entries') THEN
    CREATE TABLE IF NOT EXISTS public._bak_prep_chart_entries AS TABLE public.prep_chart_entries;
  END IF;
END $$;

ALTER TABLE public.prep_chart_entries DROP CONSTRAINT IF EXISTS prep_chart_entries_chart_key_entry_date_shift_key;
ALTER TABLE public.prep_chart_entries DROP CONSTRAINT IF EXISTS prep_chart_entries_date_chart_shift_key;
ALTER TABLE public.prep_chart_entries ADD CONSTRAINT prep_chart_entries_date_chart_shift_key UNIQUE (entry_date, chart_key, shift);

DROP INDEX IF EXISTS public.idx_prep_chart_entries_lookup;
DROP INDEX IF EXISTS public.idx_prep_chart_entries_date_shift;
CREATE INDEX IF NOT EXISTS idx_prep_chart_entries_lookup ON public.prep_chart_entries (entry_date DESC, chart_key, shift);
CREATE INDEX IF NOT EXISTS idx_prep_chart_entries_date_shift ON public.prep_chart_entries (entry_date DESC, shift);

COMMIT;

