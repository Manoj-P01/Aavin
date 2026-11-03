-- ─────────────────────────────────────────────────────────────
-- 015_clean_stock_rows_table.sql
-- Removes fixed product columns from stock_rows so all dynamic columns
-- are stored exclusively in entry_json jsonb, exactly like prep_chart_entries.
-- ─────────────────────────────────────────────────────────────

-- 1. Ensure entry_json jsonb column exists
ALTER TABLE public.stock_rows ADD COLUMN IF NOT EXISTS entry_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Drop legacy fixed numeric columns (no longer needed because all values are stored dynamically in entry_json)
ALTER TABLE public.stock_rows 
  DROP COLUMN IF EXISTS wh_milk,
  DROP COLUMN IF EXISTS dlt_milk,
  DROP COLUMN IF EXISTS fc_milk,
  DROP COLUMN IF EXISTS std_milk,
  DROP COLUMN IF EXISTS toned_milk,
  DROP COLUMN IF EXISTS toned_curd,
  DROP COLUMN IF EXISTS dtm,
  DROP COLUMN IF EXISTS skim_milk,
  DROP COLUMN IF EXISTS cream,
  DROP COLUMN IF EXISTS butter_milk,
  DROP COLUMN IF EXISTS r_con,
  DROP COLUMN IF EXISTS smp,
  DROP COLUMN IF EXISTS water;

COMMENT ON TABLE public.stock_rows IS 'Dynamic JSON store for Milk & Cream Stock Statement rows (OB, RECEIPT, DISPOSAL), holding all dynamic products and variants in entry_json.';

-- ─────────────────────────────────────────────────────────────
-- REFERENCE CLEAN TABLE SCHEMA (Like prep_chart_entries):
-- ─────────────────────────────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS public.stock_rows (
--   id           uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
--   entry_id     uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
--   row_type     text NOT NULL CHECK (row_type IN ('OB','RECEIPT','DISPOSAL','PHYSICAL')),
--   row_label    text NOT NULL,
--   entry_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
--   sort_order   integer NULL DEFAULT 0,
--   created_by   text NULL DEFAULT 'admin'::text,
--   created_at   timestamp with time zone NOT NULL DEFAULT now(),
--   updated_by   text NULL DEFAULT 'admin'::text,
--   updated_at   timestamp with time zone NOT NULL DEFAULT now(),
--   CONSTRAINT stock_rows_pkey PRIMARY KEY (id)
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_stock_rows_entry ON public.stock_rows USING btree (entry_id);
--
-- DROP TRIGGER IF EXISTS trg_stock_rows_audit ON public.stock_rows;
-- CREATE TRIGGER trg_stock_rows_audit BEFORE INSERT OR UPDATE ON public.stock_rows
-- FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

