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
  source_row_name       text NOT NULL,      -- Row name in STG (e.g. 'P.VELUR CC', 'AMBATTUR-SSM', 'CLOSING BALANCE', 'OB')
  source_field          text NOT NULL DEFAULT 'qty_lts', -- 'qty_lts', 'qty_kg', 'fat_pct', 'snf_pct', 'sp_gr', 'kg_fat', 'kg_snf'
  
  target_section        text NOT NULL,      -- 'OB', 'RECEIPT', 'DISPOSAL_DESPATCH', 'LOCAL_SALE', 'OTHER_DISPOSAL', 'CB'
  target_particular     text NOT NULL,      -- Row name in TS (e.g. 'WM', 'P.VELUR CC', 'AMBATTUR-SSM')
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


-- 3. Seed Default TS Columns & Formulations Matching 01-05-2026-TS.xlsx
INSERT INTO public.ts_masters (
  key,
  label,
  description,
  sort_order,
  columns,
  ob_rows,
  receipt_rows,
  despatch_rows,
  local_sale_rows,
  other_disposal_rows,
  cb_rows,
  reconciliation_rows
)
VALUES (
  'default_ts',
  'Total Solids (TS) Statement',
  'Default Total Solids Statement master template and formulations matching standard plant dairy operations.',
  1,
  '[
    {"key": "sno", "name": "S.no", "type": "number", "sort_order": 1, "is_active": true},
    {"key": "particular", "name": "Particular", "type": "text", "sort_order": 2, "is_active": true},
    {"key": "qty_lts", "name": "Milk (Lit)", "type": "number", "unit": "Lts", "decimals": 2, "sort_order": 3, "is_active": true},
    {"key": "qty_kg", "name": "Milk (Kg)", "type": "calculated", "formula": "qty_lts * sp_gr", "unit": "Kg", "decimals": 2, "sort_order": 4, "is_active": true},
    {"key": "fat_pct", "name": "Avg Fat %", "type": "number", "unit": "%", "decimals": 2, "sort_order": 5, "is_active": true},
    {"key": "snf_pct", "name": "Avg SNF %", "type": "number", "unit": "%", "decimals": 2, "sort_order": 6, "is_active": true},
    {"key": "sp_gr", "name": "Sp. Gr", "type": "calculated", "formula": "1 + (snf_pct - (0.2 * fat_pct) - 0.36) / 250", "decimals": 4, "sort_order": 7, "is_active": true},
    {"key": "kg_fat", "name": "Kg Fat", "type": "calculated", "formula": "qty_kg * fat_pct / 100", "unit": "Kg", "decimals": 2, "sort_order": 8, "is_active": true},
    {"key": "kg_snf", "name": "Kg SNF", "type": "calculated", "formula": "qty_kg * snf_pct / 100", "unit": "Kg", "decimals": 2, "sort_order": 9, "is_active": true}
  ]'::jsonb,
  '[
    {"variant": "WM", "fat_pct": 3.93, "snf_pct": 7.95, "sp_gr": 1.0272},
    {"variant": "SSM", "fat_pct": 0.05, "snf_pct": 8.14, "sp_gr": 1.0311},
    {"variant": "CREAM", "fat_pct": 39.21, "snf_pct": 5.53, "sp_gr": 0.9893},
    {"variant": "DLT MILK", "fat_pct": 3.5, "snf_pct": 8.5, "sp_gr": 1.0298},
    {"variant": "FC.MILK", "fat_pct": 6.0, "snf_pct": 9.0, "sp_gr": 1.0298},
    {"variant": "STD.Milk", "fat_pct": 4.5, "snf_pct": 8.5, "sp_gr": 1.0290},
    {"variant": "SMP", "fat_pct": 0.5, "snf_pct": 96.3, "sp_gr": 1.3834}
  ]'::jsonb,
  '[
    {"variant": "P.VELUR CC"},
    {"variant": "BMC''s"},
    {"variant": "LAB SAMPLE RTN"},
    {"variant": "WF"},
    {"variant": "SMP", "fat_pct": 0.5, "snf_pct": 96.3},
    {"variant": "RINSE MILK"},
    {"variant": "BUTTER MILK"},
    {"variant": "DLT SACHET RTN"},
    {"variant": "FCM SACHET RTN"},
    {"variant": "STD SACHET RTN"}
  ]'::jsonb,
  '[
    {"variant": "AMBATTUR-SSM"},
    {"variant": "SNR-SSM"},
    {"variant": "DCPP-SSM"},
    {"variant": "ERODE -SSM"},
    {"variant": "CBE-SSM"}
  ]'::jsonb,
  '[
    {"variant": "DLT MILK", "fat_pct": 3.5, "snf_pct": 8.5},
    {"variant": "FC.MILK", "fat_pct": 6.0, "snf_pct": 9.0},
    {"variant": "STD.Milk", "fat_pct": 4.5, "snf_pct": 8.5},
    {"variant": "OTHERS"}
  ]'::jsonb,
  '[
    {"variant": "SMP"},
    {"variant": "CURD/ BM"},
    {"variant": "TO KHOA"},
    {"variant": "LAB SAMPLE"},
    {"variant": "CREAM-CON"}
  ]'::jsonb,
  '[
    {"variant": "WM", "fat_pct": 3.93, "snf_pct": 7.95, "sp_gr": 1.0272},
    {"variant": "SSM", "fat_pct": 0.05, "snf_pct": 8.14, "sp_gr": 1.0311},
    {"variant": "CREAM", "fat_pct": 39.21, "snf_pct": 5.53, "sp_gr": 0.9893},
    {"variant": "DLT MILK", "fat_pct": 3.5, "snf_pct": 8.5, "sp_gr": 1.0298},
    {"variant": "FC.MILK", "fat_pct": 6.0, "snf_pct": 9.0, "sp_gr": 1.0298},
    {"variant": "STD.Milk", "fat_pct": 4.5, "snf_pct": 8.5, "sp_gr": 1.0290},
    {"variant": "SMP", "fat_pct": 0.5, "snf_pct": 96.3, "sp_gr": 1.3834}
  ]'::jsonb,
  '[
    {"id": "arrival_total", "label": "TOTAL ARRIVAL", "formula": "SUM(OB) + SUM(RECEIPT)", "is_formula": true},
    {"id": "disposal_total", "label": "TOTAL DISPOSAL", "formula": "SUM(DESPATCH) + SUM(LOCAL) + SUM(OTHER) + SUM(CB)", "is_formula": true},
    {"id": "loss", "label": "LOSS", "formula": "TOTAL_DISPOSAL - TOTAL_ARRIVAL", "is_formula": true},
    {"id": "loss_pct", "label": "LOSS %", "formula": "(LOSS / TOTAL_ARRIVAL) * 100", "is_formula": true},
    {"id": "cmpdd_loss_pct", "label": "CMPDD LOSS %", "values": {"kg_fat": 0.5, "kg_snf": 0.5}}
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  columns = EXCLUDED.columns,
  ob_rows = EXCLUDED.ob_rows,
  receipt_rows = EXCLUDED.receipt_rows,
  despatch_rows = EXCLUDED.despatch_rows,
  local_sale_rows = EXCLUDED.local_sale_rows,
  other_disposal_rows = EXCLUDED.other_disposal_rows,
  cb_rows = EXCLUDED.cb_rows,
  reconciliation_rows = EXCLUDED.reconciliation_rows;

