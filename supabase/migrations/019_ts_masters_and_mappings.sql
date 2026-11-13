-- ============================================================
-- 019_ts_masters_and_mappings.sql
-- Dedicated Master & Mapping Tables for Total Solids (TS) Statement
-- Stores user-configured TS Statement Formulations, Column Layouts with Excel Formulas,
-- and Stage 3 (Solid Balance STG) ➔ Stage 4 (Total Solids TS) Mapping Rules.
-- ============================================================

-- 1. Dedicated TS Statement Masters Table
CREATE TABLE IF NOT EXISTS public.ts_masters (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  key                 text UNIQUE NOT NULL,
  label               text NOT NULL,
  description         text DEFAULT '',
  sort_order          int DEFAULT 0,
  is_active           boolean DEFAULT true,

  -- Configured Columns Layout (JSONB array with key, name, type, formula, sort_order)
  columns             jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Configured Rows & Calculation Formulas per section (JSONB arrays managed from UI)
  ob_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_rows        jsonb NOT NULL DEFAULT '[]'::jsonb,
  despatch_rows       jsonb NOT NULL DEFAULT '[]'::jsonb,
  local_sale_rows     jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_disposal_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  cb_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  reconciliation_rows jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Audit Fields
  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ts_masters_key ON public.ts_masters (key);
CREATE INDEX IF NOT EXISTS idx_ts_masters_sort ON public.ts_masters (sort_order ASC, created_at ASC);

COMMENT ON TABLE public.ts_masters IS 'Dedicated master table for Total Solids (TS) Statement formulations, row templates, and column layouts managed strictly from UI.';

ALTER TABLE public.ts_masters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all ts_masters" ON public.ts_masters;
CREATE POLICY "Allow all ts_masters" 
  ON public.ts_masters 
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_ts_masters_audit ON public.ts_masters;
    CREATE TRIGGER trg_ts_masters_audit 
      BEFORE INSERT OR UPDATE ON public.ts_masters 
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;


-- 2. Dedicated STG ➔ TS Statement Mapping Rules Table
CREATE TABLE IF NOT EXISTS public.stg_to_ts_mapping_rules (
  id                    uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  rule_key              text UNIQUE,
  source_statement_key  text NOT NULL,      -- STG statement key (e.g. 'wm', 'ssm', 'cream', etc.)
  source_section        text NOT NULL,      -- 'OB', 'RECEIPT', 'DISPOSAL', 'CB', 'RECON'
  source_row_name       text NOT NULL,
  source_field          text NOT NULL DEFAULT 'qty_lts',
  
  target_section        text NOT NULL,
  target_particular     text NOT NULL,
  target_field          text NOT NULL DEFAULT 'qty_lts', -- 'qty_lts', 'qty_kg', 'fat_pct', 'snf_pct', 'sp_gr', 'kg_fat', 'kg_snf'
  
  enabled               boolean NOT NULL DEFAULT true,
  description           text DEFAULT '',
  sort_order            int DEFAULT 0,
  
  created_by            text DEFAULT 'admin',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            text DEFAULT 'admin',
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stg_to_ts_mapping_src ON public.stg_to_ts_mapping_rules (source_statement_key, source_section);
CREATE INDEX IF NOT EXISTS idx_stg_to_ts_mapping_tgt ON public.stg_to_ts_mapping_rules (target_section, target_particular);

COMMENT ON TABLE public.stg_to_ts_mapping_rules IS 'Dedicated mapping rules from Stage 3 Solid Balance STG statement cells into Stage 4 Total Solids (TS) Statement cells.';

ALTER TABLE public.stg_to_ts_mapping_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all stg_to_ts_mapping_rules" ON public.stg_to_ts_mapping_rules;
CREATE POLICY "Allow all stg_to_ts_mapping_rules" 
  ON public.stg_to_ts_mapping_rules 
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_to_ts_mapping_rules_audit ON public.stg_to_ts_mapping_rules;
    CREATE TRIGGER trg_stg_to_ts_mapping_rules_audit 
      BEFORE INSERT OR UPDATE ON public.stg_to_ts_mapping_rules 
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

