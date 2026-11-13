-- ============================================================
-- 029_zero_hardcode_stg.sql
-- Zero Hardcode Architecture for STG Statements & TS Mappings
-- Pure DDL only: Creates master tables for Sections, Fields, Particulars,
-- Recon Row Types, Product Aliases, Shift Master, and Report Type Master.
-- Drops legacy CHECK constraints and removes business column defaults.
-- ZERO seed data: all tables start completely empty.
-- ============================================================

-- 1. STG Section Master
CREATE TABLE IF NOT EXISTS public.stg_section_master (
  section_key   text PRIMARY KEY,
  label         text NOT NULL,
  row_side      text NOT NULL DEFAULT 'NEUTRAL',
  is_single_row boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stg_section_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all stg_section_master" ON public.stg_section_master;
CREATE POLICY "Allow all stg_section_master" ON public.stg_section_master FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_section_master_audit ON public.stg_section_master;
    CREATE TRIGGER trg_stg_section_master_audit
      BEFORE INSERT OR UPDATE ON public.stg_section_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 2. STG Field Master (Global column/field catalogue)
CREATE TABLE IF NOT EXISTS public.stg_field_master (
  field_key       text PRIMARY KEY,
  label           text NOT NULL,
  data_type       text NOT NULL CHECK (data_type IN ('number', 'text', 'calculated')),
  default_formula text DEFAULT '',
  decimals        int NOT NULL DEFAULT 3,
  unit            text DEFAULT '',
  is_identifier   boolean NOT NULL DEFAULT false,
  sort_order      int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      text DEFAULT 'admin',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stg_field_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all stg_field_master" ON public.stg_field_master;
CREATE POLICY "Allow all stg_field_master" ON public.stg_field_master FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_field_master_audit ON public.stg_field_master;
    CREATE TRIGGER trg_stg_field_master_audit
      BEFORE INSERT OR UPDATE ON public.stg_field_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 3. Recon Row Type Master
CREATE TABLE IF NOT EXISTS public.stg_recon_row_type_master (
  type_key    text PRIMARY KEY,
  label       text NOT NULL,
  color_hint  text DEFAULT '',
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  text DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT 'admin',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stg_recon_row_type_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all stg_recon_row_type_master" ON public.stg_recon_row_type_master;
CREATE POLICY "Allow all stg_recon_row_type_master" ON public.stg_recon_row_type_master FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_recon_row_type_master_audit ON public.stg_recon_row_type_master;
    CREATE TRIGGER trg_stg_recon_row_type_master_audit
      BEFORE INSERT OR UPDATE ON public.stg_recon_row_type_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 4. Product Aliases Master
CREATE TABLE IF NOT EXISTS public.product_aliases (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_key text NOT NULL REFERENCES public.products_master(product_key) ON UPDATE CASCADE ON DELETE CASCADE,
  alias       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  text DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT 'admin',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_aliases_product_alias UNIQUE (product_key, alias)
);

CREATE INDEX IF NOT EXISTS idx_product_aliases_key ON public.product_aliases(product_key);
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias ON public.product_aliases(alias);

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all product_aliases" ON public.product_aliases;
CREATE POLICY "Allow all product_aliases" ON public.product_aliases FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_product_aliases_audit ON public.product_aliases;
    CREATE TRIGGER trg_product_aliases_audit
      BEFORE INSERT OR UPDATE ON public.product_aliases
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 5. Shift Master (Dynamic shift definitions replacing hardcoded Shift enum)
CREATE TABLE IF NOT EXISTS public.shift_master (
  shift_key   text PRIMARY KEY,
  label       text NOT NULL,
  start_time  text DEFAULT '',
  end_time    text DEFAULT '',
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  text DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT 'admin',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all shift_master" ON public.shift_master;
CREATE POLICY "Allow all shift_master" ON public.shift_master FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_shift_master_audit ON public.shift_master;
    CREATE TRIGGER trg_shift_master_audit
      BEFORE INSERT OR UPDATE ON public.shift_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 6. Report Type Master (Dynamic report types replacing hardcoded report_type check)
CREATE TABLE IF NOT EXISTS public.report_type_master (
  report_type_key text PRIMARY KEY,
  label           text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      text DEFAULT 'admin',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_type_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all report_type_master" ON public.report_type_master;
CREATE POLICY "Allow all report_type_master" ON public.report_type_master FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_report_type_master_audit ON public.report_type_master;
    CREATE TRIGGER trg_report_type_master_audit
      BEFORE INSERT OR UPDATE ON public.report_type_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 7. Alter stg_masters (Add product_key FK, cmpdd_norm_pct, cb_columns, cb_rows)
ALTER TABLE public.stg_masters ADD COLUMN IF NOT EXISTS product_key text REFERENCES public.products_master(product_key) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.stg_masters ADD COLUMN IF NOT EXISTS cmpdd_norm_pct numeric;
ALTER TABLE public.stg_masters ADD COLUMN IF NOT EXISTS cb_columns jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.stg_masters ADD COLUMN IF NOT EXISTS cb_rows jsonb NOT NULL DEFAULT '[]'::jsonb;

-- STG Statement Column Configs
CREATE TABLE IF NOT EXISTS public.stg_statement_column_configs (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  statement_key text NOT NULL DEFAULT 'default_stg',
  section_key   text NOT NULL DEFAULT 'general',
  columns_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stg_statement_column_configs UNIQUE (statement_key, section_key)
);

ALTER TABLE public.stg_statement_column_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all stg_statement_column_configs" ON public.stg_statement_column_configs;
CREATE POLICY "Allow all stg_statement_column_configs" ON public.stg_statement_column_configs FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_statement_column_configs_audit ON public.stg_statement_column_configs;
    CREATE TRIGGER trg_stg_statement_column_configs_audit
      BEFORE INSERT OR UPDATE ON public.stg_statement_column_configs
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 8. STG Particular Master (Relational storage for statement rows per section)
CREATE TABLE IF NOT EXISTS public.stg_particular_master (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  statement_key   text NOT NULL REFERENCES public.stg_masters(key) ON UPDATE CASCADE ON DELETE CASCADE,
  section_key     text NOT NULL REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE CASCADE,
  particular_code text NOT NULL,
  particular_name text NOT NULL,
  default_values  jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order      int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      text DEFAULT 'admin',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stg_particular_stmt_sec_code UNIQUE (statement_key, section_key, particular_code)
);

CREATE INDEX IF NOT EXISTS idx_stg_particular_stmt_sec ON public.stg_particular_master (statement_key, section_key);
CREATE INDEX IF NOT EXISTS idx_stg_particular_sort ON public.stg_particular_master (sort_order ASC, created_at ASC);

ALTER TABLE public.stg_particular_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all stg_particular_master" ON public.stg_particular_master;
CREATE POLICY "Allow all stg_particular_master" ON public.stg_particular_master FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_particular_master_audit ON public.stg_particular_master;
    CREATE TRIGGER trg_stg_particular_master_audit
      BEFORE INSERT OR UPDATE ON public.stg_particular_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- 9. Alter stg_rows
ALTER TABLE public.stg_rows ADD COLUMN IF NOT EXISTS section_key text REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.stg_rows ADD COLUMN IF NOT EXISTS particular_id uuid REFERENCES public.stg_particular_master(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.stg_rows DROP CONSTRAINT IF EXISTS stg_rows_side_check;

-- 10. Drop CHECK constraints on entries table
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_shift_check;
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_report_type_check;

-- 11. Alter statement_mapping_rules
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS source_stage text DEFAULT 'stage2';
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS source_variant text;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS source_field text;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS statement_key text;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS section_key text REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS particular_id uuid REFERENCES public.stg_particular_master(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS target_field text REFERENCES public.stg_field_master(field_key) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;
ALTER TABLE public.statement_mapping_rules ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- 12. Alter stg_to_ts_mapping_rules
ALTER TABLE public.stg_to_ts_mapping_rules ADD COLUMN IF NOT EXISTS statement_key text;
ALTER TABLE public.stg_to_ts_mapping_rules ADD COLUMN IF NOT EXISTS section_key text REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.stg_to_ts_mapping_rules ADD COLUMN IF NOT EXISTS particular_id uuid REFERENCES public.stg_particular_master(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 13. Remove business default values from columns
ALTER TABLE public.products_master ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.stg_reconciliation_entries ALTER COLUMN shift DROP DEFAULT;
