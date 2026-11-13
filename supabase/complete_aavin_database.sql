-- ============================================================
-- AAVIN DAIRY DASHBOARD - COMPLETE UNIFIED FINAL DATABASE SCHEMA
-- Namakkal District Co-operative Milk Producers' Union Ltd
--
-- ARCHITECTURAL SPECIFICATION:
-- 1. Pure DDL Only: Drops and creates all schema objects in dependency order.
-- 2. ZERO HARDCODED BUSINESS DATA: No fallback arrays, no business names.
-- 3. ZERO SEED DATA: All tables start empty with pure DDL only.
-- 4. ZERO HARDCODED FORMULAS / CONSTANTS: Managed via app_settings and UI masters.
-- 5. Full Relational Schema: Sections, Fields, Particulars, Masters, Aliases,
--    Dynamic Shift & Report Type Masters, RLS Policies, and Audit Triggers.
--
-- Direct Execution Target: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. DROP EXISTING VIEWS & TABLES (CLEAN SLATE IN DEPENDENCY ORDER)
-- ─────────────────────────────────────────────────────────────

-- Drop Views
DROP VIEW IF EXISTS public.prep_chart_report_summary CASCADE;
DROP VIEW IF EXISTS public.monthly_totals CASCADE;

-- Drop Mapping & Operational Tables
DROP TABLE IF EXISTS public.stg_to_ts_mapping_rules CASCADE;
DROP TABLE IF EXISTS public.statement_mapping_rules CASCADE;
DROP TABLE IF EXISTS public.prep_to_stock_mapping_rules CASCADE;
DROP TABLE IF EXISTS public.receipt_partition_mappings CASCADE;

DROP TABLE IF EXISTS public.stg_reconciliation_entries CASCADE;
DROP TABLE IF EXISTS public.stg_rows CASCADE;
DROP TABLE IF EXISTS public.stg_particular_master CASCADE;
DROP TABLE IF EXISTS public.stg_statement_column_configs CASCADE;
DROP TABLE IF EXISTS public.stg_masters CASCADE;
DROP TABLE IF EXISTS public.stg_recon_row_type_master CASCADE;
DROP TABLE IF EXISTS public.stg_field_master CASCADE;
DROP TABLE IF EXISTS public.stg_section_master CASCADE;

DROP TABLE IF EXISTS public.ts_milk_rows CASCADE;
DROP TABLE IF EXISTS public.ts_masters CASCADE;

DROP TABLE IF EXISTS public.stock_summary_rows CASCADE;
DROP TABLE IF EXISTS public.stock_rows CASCADE;

DROP TABLE IF EXISTS public.prep_chart_entries CASCADE;
DROP TABLE IF EXISTS public.prep_chart_configs CASCADE;

DROP TABLE IF EXISTS public.entries_settings_backup CASCADE;
DROP TABLE IF EXISTS public.entries CASCADE;

DROP TABLE IF EXISTS public.product_aliases CASCADE;
DROP TABLE IF EXISTS public.dairy_destinations_master CASCADE;
DROP TABLE IF EXISTS public.particulars_master CASCADE;
DROP TABLE IF EXISTS public.products_master CASCADE;
DROP TABLE IF EXISTS public.product_categories_master CASCADE;

DROP TABLE IF EXISTS public.shift_master CASCADE;
DROP TABLE IF EXISTS public.report_type_master CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 2. AUDIT TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := COALESCE(current_setting('app.current_user', true), 'admin');
  END IF;

  IF (TG_OP = 'INSERT') THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at = now();
    END IF;
    IF NEW.created_by IS NULL THEN
      NEW.created_by = COALESCE(current_setting('app.current_user', true), 'admin');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 3. CORE AUTH & SYSTEM SETTINGS TABLES
-- ─────────────────────────────────────────────────────────────

-- Users Table
CREATE TABLE public.users (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username         text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  full_name        text NOT NULL,
  role             text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
  is_active        boolean NOT NULL DEFAULT true,
  last_activity_at timestamptz DEFAULT now(),
  created_by       text DEFAULT 'admin',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text DEFAULT 'admin',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'User accounts with role-based permissions and activity tracking.';
CREATE INDEX idx_users_username ON public.users(username);

CREATE TRIGGER trg_users_audit
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- User Sessions Table
CREATE TABLE public.user_sessions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  last_used_at   timestamptz NOT NULL DEFAULT now(),
  is_revoked     boolean NOT NULL DEFAULT false,
  ip_address     text,
  user_agent     text,
  created_by     text DEFAULT 'system',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text DEFAULT 'system',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_sessions IS 'Active refresh token sessions tracking last_used_at for idle session handling.';
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(token_hash);

CREATE TRIGGER trg_user_sessions_audit
  BEFORE INSERT OR UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- App Settings Table (Dynamic calculation parameters, shift modes, and constants)
CREATE TABLE public.app_settings (
  key             text PRIMARY KEY,
  value           jsonb NOT NULL,
  effective_from  date DEFAULT CURRENT_DATE,
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS 'Global system parameters, shift modes, laboratory densities, and calculation configuration.';

-- Shift Master (Dynamic shift definitions replacing hardcoded Shift enum)
CREATE TABLE public.shift_master (
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

COMMENT ON TABLE public.shift_master IS 'Configurable working shifts defined dynamically by user.';
CREATE TRIGGER trg_shift_master_audit
  BEFORE INSERT OR UPDATE ON public.shift_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Report Type Master (Dynamic report types)
CREATE TABLE public.report_type_master (
  report_type_key text PRIMARY KEY,
  label           text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      text DEFAULT 'admin',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.report_type_master IS 'Configurable report type categories.';
CREATE TRIGGER trg_report_type_master_audit
  BEFORE INSERT OR UPDATE ON public.report_type_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 4. CONFIGURABLE MASTER TABLES
-- ─────────────────────────────────────────────────────────────

-- Product Categories Master
CREATE TABLE public.product_categories_master (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name text NOT NULL UNIQUE,
  code          text,
  sort_order    int DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_categories_master IS 'Configurable product categories master table.';
CREATE TRIGGER trg_product_categories_audit
  BEFORE INSERT OR UPDATE ON public.product_categories_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Products Master (Zero business defaults)
CREATE TABLE public.products_master (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key   text NOT NULL UNIQUE,
  product_name  text NOT NULL,
  short_name    text,
  category      text,
  sort_order    int DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  is_default    boolean DEFAULT false,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products_master IS 'Configurable product definitions for stock entries and reports.';
CREATE TRIGGER trg_products_audit
  BEFORE INSERT OR UPDATE ON public.products_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Product Aliases Master (Relational product mapping aliases)
CREATE TABLE public.product_aliases (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key text NOT NULL REFERENCES public.products_master(product_key) ON UPDATE CASCADE ON DELETE CASCADE,
  alias       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  text DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT 'admin',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_aliases_product_alias UNIQUE (product_key, alias)
);

CREATE INDEX idx_product_aliases_key ON public.product_aliases(product_key);
CREATE INDEX idx_product_aliases_alias ON public.product_aliases(alias);

CREATE TRIGGER trg_product_aliases_audit
  BEFORE INSERT OR UPDATE ON public.product_aliases
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Particulars Master (Receipts, Disposals, and Balance Line Items)
CREATE TABLE public.particulars_master (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_type          text NOT NULL CHECK (section_type IN ('RECEIPT', 'DISPOSAL', 'BALANCE')),
  particular_name       text NOT NULL,
  code                  text,
  is_dairy_destination  boolean NOT NULL DEFAULT false,
  feeds_receipts        boolean NOT NULL DEFAULT false,
  sort_order            int DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  created_by            text DEFAULT 'admin',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            text DEFAULT 'admin',
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_type, particular_name)
);

COMMENT ON TABLE public.particulars_master IS 'Configurable particulars rows for Receipts, Disposals, and Balance sections.';
CREATE TRIGGER trg_particulars_audit
  BEFORE INSERT OR UPDATE ON public.particulars_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Dairy Destinations Master
CREATE TABLE public.dairy_destinations_master (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dairy_name   text NOT NULL UNIQUE,
  code         text,
  sort_order   int DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dairy_destinations_master IS 'Configurable destination union dairies for split entries.';
CREATE TRIGGER trg_dairy_destinations_audit
  BEFORE INSERT OR UPDATE ON public.dairy_destinations_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Receipt Partition Mappings
CREATE TABLE public.receipt_partition_mappings (
  id                           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_disposal_particular   text NOT NULL,
  target_receipt_product_key   text,
  target_receipt_product_label text,
  partitions                   jsonb,
  enabled                      boolean NOT NULL DEFAULT true,
  created_by                   text DEFAULT 'admin',
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   text DEFAULT 'admin',
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.receipt_partition_mappings IS 'Configurable rules mapping disposal particulars to target receipt products.';
CREATE TRIGGER trg_partition_mappings_audit
  BEFORE INSERT OR UPDATE ON public.receipt_partition_mappings
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 5. ZERO-HARDCODE STG SECTION & FIELD CATALOG MASTERS
-- ─────────────────────────────────────────────────────────────

-- STG Section Master
CREATE TABLE public.stg_section_master (
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

COMMENT ON TABLE public.stg_section_master IS 'Configurable STG sections (e.g. OB, Receipts, Disposals, Stock Balance).';
CREATE TRIGGER trg_stg_section_master_audit
  BEFORE INSERT OR UPDATE ON public.stg_section_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Field Master (Global column/field catalogue)
CREATE TABLE public.stg_field_master (
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

COMMENT ON TABLE public.stg_field_master IS 'Configurable field definitions, calculation formulas, and canonical row identifiers.';
CREATE TRIGGER trg_stg_field_master_audit
  BEFORE INSERT OR UPDATE ON public.stg_field_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Recon Row Type Master
CREATE TABLE public.stg_recon_row_type_master (
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

COMMENT ON TABLE public.stg_recon_row_type_master IS 'Configurable reconciliation row types.';
CREATE TRIGGER trg_stg_recon_row_type_master_audit
  BEFORE INSERT OR UPDATE ON public.stg_recon_row_type_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 6. STATEMENT MASTERS & FORMULATION TABLES
-- ─────────────────────────────────────────────────────────────

-- STG Statement Masters
CREATE TABLE public.stg_masters (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key                 text UNIQUE NOT NULL,
  label               text NOT NULL,
  variant             text NOT NULL,
  product_key         text REFERENCES public.products_master(product_key) ON UPDATE CASCADE ON DELETE SET NULL,
  cmpdd_norm_pct      numeric,
  description         text DEFAULT '',
  sort_order          int DEFAULT 0,
  is_active           boolean DEFAULT true,

  -- Configured Columns per section (JSONB arrays managed from UI)
  ob_columns          jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_columns     jsonb NOT NULL DEFAULT '[]'::jsonb,
  disposal_columns    jsonb NOT NULL DEFAULT '[]'::jsonb,
  cb_columns          jsonb NOT NULL DEFAULT '[]'::jsonb,
  recon_columns       jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Configured Rows & Formulas per section (JSONB arrays managed from UI)
  ob_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_rows        jsonb NOT NULL DEFAULT '[]'::jsonb,
  disposal_rows       jsonb NOT NULL DEFAULT '[]'::jsonb,
  cb_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  reconciliation_rows jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stg_masters IS 'Statement master templates and default formulations managed strictly from UI.';
CREATE INDEX idx_stg_masters_key ON public.stg_masters (key);
CREATE INDEX idx_stg_masters_sort ON public.stg_masters (sort_order ASC, created_at ASC);

CREATE TRIGGER trg_stg_masters_audit
  BEFORE INSERT OR UPDATE ON public.stg_masters
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Particular Master (Relational statement row particulars)
CREATE TABLE public.stg_particular_master (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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

COMMENT ON TABLE public.stg_particular_master IS 'Relational storage for statement particulars per section.';
CREATE INDEX idx_stg_particular_stmt_sec ON public.stg_particular_master (statement_key, section_key);
CREATE INDEX idx_stg_particular_sort ON public.stg_particular_master (sort_order ASC, created_at ASC);

CREATE TRIGGER trg_stg_particular_master_audit
  BEFORE INSERT OR UPDATE ON public.stg_particular_master
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Statement Column Configs
CREATE TABLE public.stg_statement_column_configs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_key text NOT NULL DEFAULT 'default_stg',
  section_key   text NOT NULL DEFAULT 'general',
  columns_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stg_statement_column_configs UNIQUE (statement_key, section_key)
);

COMMENT ON TABLE public.stg_statement_column_configs IS 'Configured columns and formula parameters per statement and section.';
CREATE TRIGGER trg_stg_statement_column_configs_audit
  BEFORE INSERT OR UPDATE ON public.stg_statement_column_configs
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- TS Statement Masters (Total Solids Statements configured via UI)
CREATE TABLE public.ts_masters (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key                 text UNIQUE NOT NULL,
  label               text NOT NULL,
  description         text DEFAULT '',
  sort_order          int DEFAULT 0,
  is_active           boolean DEFAULT true,

  columns             jsonb NOT NULL DEFAULT '[]'::jsonb,
  ob_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_rows        jsonb NOT NULL DEFAULT '[]'::jsonb,
  despatch_rows       jsonb NOT NULL DEFAULT '[]'::jsonb,
  local_sale_rows     jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_disposal_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  cb_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  reconciliation_rows jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ts_masters IS 'Total Solids (TS) Statement master template managed strictly from UI.';
CREATE INDEX idx_ts_masters_key ON public.ts_masters (key);
CREATE INDEX idx_ts_masters_sort ON public.ts_masters (sort_order ASC, created_at ASC);

CREATE TRIGGER trg_ts_masters_audit
  BEFORE INSERT OR UPDATE ON public.ts_masters
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Prep Chart Configs (Store custom chart masters & dynamic columns)
CREATE TABLE public.prep_chart_configs (
  config_key   text PRIMARY KEY,
  config_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prep_chart_configs IS 'JSON store for Preparation Chart Masters and Column configurations.';
CREATE TRIGGER trg_prep_chart_configs_audit
  BEFORE INSERT OR UPDATE ON public.prep_chart_configs
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 7. OPERATIONAL REPORT & DAILY ENTRIES TABLES
-- ─────────────────────────────────────────────────────────────

-- Entries Master (One header row per date + report_type + shift)
CREATE TABLE public.entries (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date    date NOT NULL,
  report_type   text NOT NULL,
  shift         text,
  status        text DEFAULT NULL,
  notes         text,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entries_real_date_chk CHECK (entry_date >= DATE '2000-01-01'),
  UNIQUE (entry_date, report_type, shift)
);

COMMENT ON TABLE public.entries IS 'Master entry header per date + dynamic report_type + dynamic shift.';
CREATE INDEX idx_entries_date_report_shift ON public.entries (entry_date DESC, report_type, shift);
CREATE INDEX idx_entries_report_date ON public.entries (report_type, entry_date DESC);

CREATE TRIGGER trg_entries_audit
  BEFORE INSERT OR UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Stock Rows (Milk & Cream Stock Statement Dynamic Store)
CREATE TABLE public.stock_rows (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id     uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  row_type     text NOT NULL CHECK (row_type IN ('OB','RECEIPT','DISPOSAL','PHYSICAL')),
  row_label    text NOT NULL,
  entry_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order   int DEFAULT 0,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_rows IS 'Dynamic JSON store for Milk & Cream Stock Statement rows.';
CREATE INDEX idx_stock_rows_entry ON public.stock_rows(entry_id);
CREATE INDEX idx_stock_rows_entry_sort ON public.stock_rows (entry_id, sort_order ASC);

CREATE TRIGGER trg_stock_rows_audit
  BEFORE INSERT OR UPDATE ON public.stock_rows
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Stock Summary Rows Table (Live Computed Summary Rows)
CREATE TABLE public.stock_summary_rows (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id     uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  summary_type text NOT NULL CHECK (summary_type IN ('OB','TOTAL_RECEIPT','TOTAL_DISPOSAL','CB')),
  row_label    text NOT NULL,
  summary_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order   int DEFAULT 0,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_summary_rows IS 'Live calculated summary rows (OB, Total Receipts, Total Disposals, Closing Balance).';
CREATE INDEX idx_stock_summary_rows_entry ON public.stock_summary_rows(entry_id);
CREATE INDEX idx_stock_summary_rows_entry_sort ON public.stock_summary_rows (entry_id, sort_order ASC);

CREATE TRIGGER trg_stock_summary_rows_audit
  BEFORE INSERT OR UPDATE ON public.stock_summary_rows
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- TS Milk Rows (Total Solids Report Operational Rows)
CREATE TABLE public.ts_milk_rows (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  section     text NOT NULL,
  product     text NOT NULL,
  row_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order  int DEFAULT 0,
  created_by  text DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT 'admin',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ts_milk_rows IS 'Total Solids (TS) Statement daily operational rows.';
CREATE INDEX idx_ts_milk_rows_entry ON public.ts_milk_rows(entry_id);

CREATE TRIGGER trg_ts_milk_rows_audit
  BEFORE INSERT OR UPDATE ON public.ts_milk_rows
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Rows (Solid Balance Details Operational Rows)
CREATE TABLE public.stg_rows (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id      uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  product_block text NOT NULL,
  side          text NOT NULL,
  section_key   text REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE SET NULL,
  particular_id uuid REFERENCES public.stg_particular_master(id) ON UPDATE CASCADE ON DELETE SET NULL,
  item_name     text NOT NULL,
  row_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order    int DEFAULT 0,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stg_rows IS 'Solid Balance Details (STG) operational statement line rows.';
CREATE INDEX idx_stg_rows_entry ON public.stg_rows(entry_id);
CREATE INDEX idx_stg_rows_section ON public.stg_rows(section_key);
CREATE INDEX idx_stg_rows_particular ON public.stg_rows(particular_id);

CREATE TRIGGER trg_stg_rows_audit
  BEFORE INSERT OR UPDATE ON public.stg_rows
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Reconciliation Entries (Reconciliation Summary store)
CREATE TABLE public.stg_reconciliation_entries (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date    date NOT NULL,
  statement_key text NOT NULL,
  shift         text NOT NULL,
  entry_id      uuid REFERENCES public.entries(id) ON DELETE CASCADE,
  summary_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stg_reconciliation_entries_date_stmt_shift_key UNIQUE (entry_date, statement_key, shift)
);

COMMENT ON TABLE public.stg_reconciliation_entries IS 'Reconciliation summaries and metrics for STG statements.';
CREATE INDEX idx_stg_reconciliation_entries_lookup ON public.stg_reconciliation_entries (entry_date DESC, statement_key, shift);

CREATE TRIGGER trg_stg_reconciliation_entries_audit
  BEFORE INSERT OR UPDATE ON public.stg_reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Prep Chart Entries (Daily formulation entries per chart, date & shift)
CREATE TABLE public.prep_chart_entries (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date   date NOT NULL,
  chart_key    text NOT NULL,
  shift        text NOT NULL,
  entry_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prep_chart_entries_date_chart_shift_key UNIQUE (entry_date, chart_key, shift)
);

COMMENT ON TABLE public.prep_chart_entries IS 'Daily Preparation Chart formulation batches.';
CREATE INDEX idx_prep_chart_entries_lookup ON public.prep_chart_entries (entry_date DESC, chart_key, shift);
CREATE INDEX idx_prep_chart_entries_date_shift ON public.prep_chart_entries (entry_date DESC, shift);

CREATE TRIGGER trg_prep_chart_entries_audit
  BEFORE INSERT OR UPDATE ON public.prep_chart_entries
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 8. CROSS-STAGE MAPPING RULES TABLES
-- ─────────────────────────────────────────────────────────────

-- Preparation Chart ➔ Stock Statement Mapping Rules (Stage 1 ➔ Stage 2)
CREATE TABLE public.prep_to_stock_mapping_rules (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_key            text UNIQUE,
  source_chart_key    text NOT NULL DEFAULT '*',
  source_variant      text NOT NULL,
  source_col_key      text NOT NULL DEFAULT 'qty_lit',
  target_row_type     text NOT NULL DEFAULT 'RECEIPT',
  target_row_label    text,
  target_product_key  text NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  description         text,
  sort_order          integer NOT NULL DEFAULT 0,
  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prep_to_stock_mapping_rules IS 'Mapping rules from Stage 1 Preparation Charts to Stage 2 Stock Statement Entry.';
CREATE INDEX idx_prep_to_stock_rules_lookup ON public.prep_to_stock_mapping_rules (source_chart_key, enabled);

CREATE TRIGGER trg_prep_to_stock_mapping_rules_audit
  BEFORE INSERT OR UPDATE ON public.prep_to_stock_mapping_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Stock Statement ➔ STG Report Mapping Rules (Stage 2 ➔ Stage 3)
CREATE TABLE public.statement_mapping_rules (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_key            text UNIQUE,
  source_stage        text NOT NULL DEFAULT 'STAGE_2',
  source_variant      text,
  source_field        text,
  stock_product_key   text NOT NULL,
  stock_product_label text,
  stock_section       text NOT NULL,
  stock_particular    text NOT NULL,
  statement_key       text,
  stg_block_key       text NOT NULL,
  stg_block_label     text,
  section_key         text REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE SET NULL,
  stg_section         text NOT NULL,
  particular_id       uuid REFERENCES public.stg_particular_master(id) ON UPDATE CASCADE ON DELETE SET NULL,
  particular_name     text,
  stg_item_name       text NOT NULL,
  target_field        text REFERENCES public.stg_field_master(field_key) ON UPDATE CASCADE ON DELETE SET NULL,
  stg_target_field    text NOT NULL DEFAULT 'qty_lts',
  enabled             boolean NOT NULL DEFAULT true,
  sort_order          int NOT NULL DEFAULT 0,
  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.statement_mapping_rules IS 'Cross-statement mapping rules between Stock Statement and STG Report.';
CREATE TRIGGER trg_statement_mapping_rules_audit
  BEFORE INSERT OR UPDATE ON public.statement_mapping_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG ➔ TS Statement Mapping Rules (Stage 3 ➔ Stage 4)
CREATE TABLE public.stg_to_ts_mapping_rules (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_key              text UNIQUE,
  statement_key         text,
  source_statement_key  text NOT NULL,
  section_key           text REFERENCES public.stg_section_master(section_key) ON UPDATE CASCADE ON DELETE SET NULL,
  source_section        text NOT NULL,
  particular_id         uuid REFERENCES public.stg_particular_master(id) ON UPDATE CASCADE ON DELETE SET NULL,
  source_row_name       text NOT NULL,
  source_field          text NOT NULL DEFAULT 'qty_lts',
  target_section        text NOT NULL,
  target_particular     text NOT NULL,
  target_field          text NOT NULL DEFAULT 'qty_lts',
  enabled               boolean NOT NULL DEFAULT true,
  description           text DEFAULT '',
  sort_order            int DEFAULT 0,
  created_by            text DEFAULT 'admin',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            text DEFAULT 'admin',
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stg_to_ts_mapping_rules IS 'Mapping rules from Stage 3 Solid Balance STG statement cells into Stage 4 Total Solids (TS) Statement cells.';
CREATE INDEX idx_stg_to_ts_mapping_src ON public.stg_to_ts_mapping_rules (source_statement_key, source_section);
CREATE INDEX idx_stg_to_ts_mapping_tgt ON public.stg_to_ts_mapping_rules (target_section, target_particular);

CREATE TRIGGER trg_stg_to_ts_mapping_rules_audit
  BEFORE INSERT OR UPDATE ON public.stg_to_ts_mapping_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 9. REPORTING VIEWS & RPC FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- Monthly Totals View
CREATE OR REPLACE VIEW public.monthly_totals AS
SELECT
  to_char(entry_date, 'YYYY-MM') AS month_key,
  report_type,
  COUNT(*)::int AS entry_count
FROM public.entries
GROUP BY to_char(entry_date, 'YYYY-MM'), report_type
ORDER BY month_key ASC;

-- Helper RPC for parameterized monthly query
CREATE OR REPLACE FUNCTION public.fn_get_monthly_totals(p_report_type text DEFAULT NULL)
RETURNS TABLE (
  month text,
  count int
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    replace(month_key, '-', '/') AS month,
    entry_count AS count
  FROM public.monthly_totals
  WHERE (p_report_type IS NULL OR report_type = p_report_type)
  ORDER BY month_key DESC
  LIMIT 12;
$$;

-- Prep Chart Report Summary View
CREATE OR REPLACE VIEW public.prep_chart_report_summary AS
SELECT
  id,
  chart_key,
  entry_date,
  shift,
  created_at,
  updated_at
FROM public.prep_chart_entries
ORDER BY entry_date DESC, shift ASC;

-- ─────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.users                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_master                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_type_master            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories_master     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_master                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_aliases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.particulars_master             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dairy_destinations_master      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_partition_mappings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_section_master            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_field_master              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_recon_row_type_master     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_masters                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_particular_master         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_statement_column_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_masters                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_chart_configs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_rows                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_summary_rows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_milk_rows                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_rows                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_reconciliation_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_chart_entries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_to_stock_mapping_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_mapping_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_to_ts_mapping_rules        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users"                         ON public.users                        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all user_sessions"                 ON public.user_sessions               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all app_settings"                  ON public.app_settings                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all shift_master"                  ON public.shift_master                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all report_type_master"            ON public.report_type_master          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all product_categories"            ON public.product_categories_master   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all products_master"               ON public.products_master              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all product_aliases"               ON public.product_aliases              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all particulars_master"            ON public.particulars_master           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all dairy_destinations"            ON public.dairy_destinations_master    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all receipt_partition_mappings"    ON public.receipt_partition_mappings   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_section_master"            ON public.stg_section_master          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_field_master"              ON public.stg_field_master            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_recon_row_type_master"       ON public.stg_recon_row_type_master   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_masters"                   ON public.stg_masters                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_particular_master"           ON public.stg_particular_master       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_statement_column_configs"  ON public.stg_statement_column_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ts_masters"                    ON public.ts_masters                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all prep_chart_configs"            ON public.prep_chart_configs           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all entries"                       ON public.entries                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stock_rows"                    ON public.stock_rows                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stock_summary_rows"            ON public.stock_summary_rows           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ts_milk_rows"                  ON public.ts_milk_rows                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_rows"                      ON public.stg_rows                     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_reconciliation_entries"    ON public.stg_reconciliation_entries   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all prep_chart_entries"            ON public.prep_chart_entries           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all prep_to_stock_mapping_rules"   ON public.prep_to_stock_mapping_rules  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all statement_mapping_rules"       ON public.statement_mapping_rules      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_to_ts_mapping_rules"       ON public.stg_to_ts_mapping_rules      FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 11. STORED PROCEDURES & UTILITY FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- 10-Minute Idle Session Cancellation
CREATE OR REPLACE FUNCTION fn_invalidate_idle_sessions(p_max_idle_minutes INT DEFAULT 10)
RETURNS INT AS $$
DECLARE
  v_revoked_count INT;
BEGIN
  UPDATE user_sessions
  SET is_revoked = true,
      updated_at = now(),
      updated_by = 'system'
  WHERE is_revoked = false
    AND last_used_at < (now() - (p_max_idle_minutes || ' minutes')::INTERVAL);

  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
  RETURN v_revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Touch User Session
CREATE OR REPLACE FUNCTION fn_touch_user_session(p_session_id UUID, p_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_session_valid BOOLEAN := false;
BEGIN
  PERFORM fn_invalidate_idle_sessions(10);

  UPDATE user_sessions
  SET last_used_at = now(),
      updated_by = p_username,
      updated_at = now()
  WHERE id = p_session_id
    AND is_revoked = false
    AND expires_at > now()
    AND last_used_at >= (now() - INTERVAL '10 minutes');

  IF FOUND THEN
    v_session_valid := true;

    UPDATE users
    SET last_activity_at = now(),
        updated_by = p_username,
        updated_at = now()
    WHERE username = p_username;
  END IF;

  RETURN v_session_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft Delete Procedures
CREATE OR REPLACE FUNCTION fn_soft_delete_product_master(p_id UUID, p_actor TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE products_master
  SET is_active = false,
      updated_by = p_actor,
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_soft_delete_particular_master(p_id UUID, p_actor TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE particulars_master
  SET is_active = false,
      updated_by = p_actor,
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_soft_delete_product_category(p_id UUID, p_actor TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE product_categories_master
  SET is_active = false,
      updated_by = COALESCE(p_actor, 'admin'),
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_soft_delete_dairy_destination(p_id UUID, p_actor TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE dairy_destinations_master
  SET is_active = false,
      updated_by = COALESCE(p_actor, 'admin'),
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Active Masters Query Helpers
CREATE OR REPLACE FUNCTION fn_get_active_products_master()
RETURNS SETOF products_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products_master
  WHERE is_active = true
  ORDER BY sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_get_active_dairy_destinations()
RETURNS SETOF dairy_destinations_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM dairy_destinations_master
  WHERE is_active = true
  ORDER BY sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_get_active_particulars_master(p_section_type TEXT DEFAULT NULL)
RETURNS SETOF particulars_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM particulars_master
  WHERE is_active = true
    AND (p_section_type IS NULL OR section_type = UPPER(TRIM(p_section_type)))
  ORDER BY sort_order ASC, particular_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: fn_rename_key – Cascading key renames across schema & JSON rows
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_rename_key(
  p_scope text,
  p_old text,
  p_new text,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old text := trim(p_old);
  v_new text := trim(p_new);
  v_counts jsonb := '{}'::jsonb;
  v_c integer := 0;
  v_chart_key text := p_context->>'chart_key';
BEGIN
  IF v_old IS NULL OR v_old = '' THEN
    RAISE EXCEPTION 'Current/old key cannot be empty.';
  END IF;

  IF v_new IS NULL OR v_new = '' THEN
    RAISE EXCEPTION 'New key cannot be empty.';
  END IF;

  IF v_old = v_new THEN
    RAISE EXCEPTION 'Old key and new key cannot be identical ("%").', v_old;
  END IF;

  CASE p_scope
    WHEN 'product' THEN
      SELECT count(*) INTO v_c FROM public.products_master WHERE product_key = v_old;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'Product key "%" not found in products_master.', v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.products_master WHERE product_key = v_new;
      IF v_c > 0 THEN
        RAISE EXCEPTION 'Product key "%" already exists in products_master.', v_new;
      END IF;

      v_counts := jsonb_set(v_counts, '{products_master}', '1'::jsonb);
      IF NOT p_dry_run THEN
        UPDATE public.products_master SET product_key = v_new WHERE product_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stock_rows WHERE entry_json ? v_old;
      v_counts := jsonb_set(v_counts, '{stock_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stock_rows
        SET entry_json = (entry_json - v_old) || jsonb_build_object(v_new, entry_json -> v_old)
        WHERE entry_json ? v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE target_product_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET target_product_key = v_new WHERE target_product_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE stock_product_key = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET stock_product_key = v_new WHERE stock_product_key = v_old;
      END IF;

    WHEN 'prep_chart' THEN
      SELECT count(*) INTO v_c FROM public.prep_chart_configs WHERE config_key = 'chart_master_' || v_old;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'Chart master "chart_master_%" not found.', v_old;
      END IF;

      v_counts := jsonb_set(v_counts, '{prep_chart_configs}', '1'::jsonb);
      IF NOT p_dry_run THEN
        UPDATE public.prep_chart_configs SET config_key = 'chart_master_' || v_new WHERE config_key = 'chart_master_' || v_old;
        UPDATE public.prep_chart_configs SET config_key = 'prep_chart_columns_' || v_new WHERE config_key = 'prep_chart_columns_' || v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.prep_chart_entries WHERE chart_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_chart_entries}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_chart_entries SET chart_key = v_new WHERE chart_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE source_chart_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET source_chart_key = v_new WHERE source_chart_key = v_old;
      END IF;

    WHEN 'prep_chart_column' THEN
      IF v_chart_key IS NULL OR v_chart_key = '' THEN
        RAISE EXCEPTION 'p_context must include "chart_key" when renaming a prep_chart_column.';
      END IF;

      SELECT count(*) INTO v_c
      FROM public.prep_chart_entries
      WHERE chart_key = v_chart_key AND entry_json::text LIKE '%"' || v_old || '"%';
      v_counts := jsonb_set(v_counts, '{prep_chart_entries}', to_jsonb(v_c));

      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules
      WHERE (source_chart_key = v_chart_key OR source_chart_key = '*') AND source_col_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET source_col_key = v_new
        WHERE (source_chart_key = v_chart_key OR source_chart_key = '*') AND source_col_key = v_old;
      END IF;

    WHEN 'statement' THEN
      SELECT count(*) INTO v_c FROM public.stg_masters WHERE key = v_old;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'STG Statement master key "%" not found.', v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stg_masters WHERE key = v_new;
      IF v_c > 0 THEN
        RAISE EXCEPTION 'STG Statement master key "%" already exists.', v_new;
      END IF;

      v_counts := jsonb_set(v_counts, '{stg_masters}', '1'::jsonb);
      IF NOT p_dry_run THEN
        UPDATE public.stg_masters SET key = v_new WHERE key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stg_rows WHERE product_block = v_old;
      v_counts := jsonb_set(v_counts, '{stg_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_rows SET product_block = v_new WHERE product_block = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stg_reconciliation_entries WHERE statement_key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_reconciliation_entries}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_reconciliation_entries SET statement_key = v_new WHERE statement_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE stg_block_key = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET stg_block_key = v_new WHERE stg_block_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE source_statement_key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules SET source_statement_key = v_new WHERE source_statement_key = v_old;
      END IF;

    WHEN 'stg_column' THEN
      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE stg_target_field = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET stg_target_field = v_new WHERE stg_target_field = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE source_field = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules SET source_field = v_new WHERE source_field = v_old;
      END IF;

    WHEN 'ts_column' THEN
      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE target_field = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules SET target_field = v_new WHERE target_field = v_old;
      END IF;

    WHEN 'rule' THEN
      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE rule_key = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET rule_key = v_new WHERE rule_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE rule_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET rule_key = v_new WHERE rule_key = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE rule_key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules SET rule_key = v_new WHERE rule_key = v_old;
      END IF;

    WHEN 'dairy' THEN
      SELECT count(*) INTO v_c FROM public.dairy_destinations_master WHERE dairy_name = v_old;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'Dairy destination "%" not found in dairy_destinations_master.', v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.dairy_destinations_master WHERE dairy_name = v_new;
      IF v_c > 0 THEN
        RAISE EXCEPTION 'Dairy destination "%" already exists in dairy_destinations_master.', v_new;
      END IF;

      v_counts := jsonb_set(v_counts, '{dairy_destinations_master}', '1'::jsonb);
      IF NOT p_dry_run THEN
        UPDATE public.dairy_destinations_master SET dairy_name = v_new WHERE dairy_name = v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.receipt_partition_mappings WHERE partitions::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{receipt_partition_mappings}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.receipt_partition_mappings
        SET partitions = replace(partitions::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb
        WHERE partitions::text LIKE '%' || v_old || '%';
      END IF;

      SELECT count(*) INTO v_c FROM public.stock_rows WHERE entry_json ? v_old;
      v_counts := jsonb_set(v_counts, '{stock_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stock_rows
        SET entry_json = (entry_json - v_old) || jsonb_build_object(v_new, entry_json -> v_old)
        WHERE entry_json ? v_old;
      END IF;

    ELSE
      RAISE EXCEPTION 'Unknown key rename scope "%". Valid scopes: product, prep_chart, prep_chart_column, statement, stg_column, ts_column, rule, dairy.', p_scope;
  END CASE;

  RETURN v_counts;
END;
$$;

-- ============================================================
-- END OF COMPLETE UNIFIED SCHEMA DDL
-- ZERO INSERT STATEMENTS. All master data, statements, particulars,
-- sections, fields, columns, mappings, formulas, settings, and entries
-- are configured and declared strictly via the Web UI.
-- ============================================================
