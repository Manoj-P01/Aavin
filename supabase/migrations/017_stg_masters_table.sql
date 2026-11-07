-- ============================================================
-- 017_stg_masters_table.sql
-- Dedicated Master Table for Solid Balance Details (STG) Statements
-- Stores user-configured Statement Masters, Row Formulations & Column Layouts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stg_masters (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  key                 text UNIQUE NOT NULL,
  label               text NOT NULL,
  variant             text NOT NULL,
  description         text DEFAULT '',
  sort_order          int DEFAULT 0,
  is_active           boolean DEFAULT true,

  -- Configured Columns per section (JSONB arrays)
  ob_columns          jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_columns     jsonb NOT NULL DEFAULT '[]'::jsonb,
  disposal_columns    jsonb NOT NULL DEFAULT '[]'::jsonb,
  recon_columns       jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Configured Rows & Calculation Formulas per section (JSONB arrays)
  ob_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_rows        jsonb NOT NULL DEFAULT '[]'::jsonb,
  disposal_rows       jsonb NOT NULL DEFAULT '[]'::jsonb,
  reconciliation_rows jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- CMPDD Norm (Loss/Gain threshold percentage)
  cmpdd_norm          text DEFAULT '0.5',

  -- Audit Fields
  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Ensure description and cmpdd_norm columns exist if table was created previously
ALTER TABLE public.stg_masters ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.stg_masters ADD COLUMN IF NOT EXISTS cmpdd_norm text DEFAULT '0.5';

CREATE INDEX IF NOT EXISTS idx_stg_masters_key ON public.stg_masters (key);
CREATE INDEX IF NOT EXISTS idx_stg_masters_sort ON public.stg_masters (sort_order ASC, created_at ASC);

COMMENT ON TABLE public.stg_masters IS 'Dedicated master table for STG statement formulations, column configurations, and reconciliation formulas.';

-- Row Level Security
ALTER TABLE public.stg_masters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all stg_masters" ON public.stg_masters;
CREATE POLICY "Allow all stg_masters" 
  ON public.stg_masters 
  FOR ALL USING (true) WITH CHECK (true);

-- Audit Trigger (if fn_set_audit_fields exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_audit_fields') THEN
    DROP TRIGGER IF EXISTS trg_stg_masters_audit ON public.stg_masters;
    CREATE TRIGGER trg_stg_masters_audit 
      BEFORE INSERT OR UPDATE ON public.stg_masters 
      FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Seed Initial Statement Masters & Default Formulation Tables
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_default_cols jsonb := '[
    {"key": "variant", "name": "VARIANT", "type": "text", "sort_order": 1},
    {"key": "qty_lts", "name": "Qty (Lts)", "type": "number", "decimals": 0, "sort_order": 2},
    {"key": "qty_kg", "name": "Qty (Kg)", "type": "calculated", "formula": "qty_lts * sp_gr", "decimals": 2, "sort_order": 3},
    {"key": "fat_pct", "name": "Fat%", "type": "number", "decimals": 2, "sort_order": 4},
    {"key": "snf_pct", "name": "Snf%", "type": "number", "decimals": 2, "sort_order": 5},
    {"key": "sp_gr", "name": "SP.G", "type": "number", "decimals": 4, "sort_order": 6},
    {"key": "kg_fat", "name": "Kg.Fat", "type": "calculated", "formula": "qty_kg * fat_pct / 100", "decimals": 3, "sort_order": 7},
    {"key": "kg_snf", "name": "Kg.Snf", "type": "calculated", "formula": "qty_kg * snf_pct / 100", "decimals": 3, "sort_order": 8}
  ]'::jsonb;
  v_default_ob jsonb := '[{"variant": "Opening Balance", "row_type": "OB", "side": "RECEIPT", "values": {"variant": "Opening Balance"}}]'::jsonb;
BEGIN

  -- 1. Tentative Whole Milk
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'wh_milk',
    'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    'WHOLE MILK',
    'Whole Milk statement formulation and reconciliation',
    1,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "P.VELUR CC", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "P.VELUR CC"}},
      {"variant": "BMC''s", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "BMC''s"}},
      {"variant": "LAB SAMPLE RTN", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "LAB SAMPLE RTN"}},
      {"variant": "WF", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WF"}},
      {"variant": "SMP", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP"}},
      {"variant": "RINSE MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "RINSE MILK"}},
      {"variant": "BUTTER MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "BUTTER MILK"}},
      {"variant": "DLT SACHET RTN", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "DLT SACHET RTN"}},
      {"variant": "FCM SACHET RTN", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "FCM SACHET RTN"}},
      {"variant": "STD SACHET RTN", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "STD SACHET RTN"}}
    ]'::jsonb,
    '[
      {"variant": "SEPERATION", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SEPERATION"}},
      {"variant": "DLT MILK", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "DLT MILK"}},
      {"variant": "FC.MILK", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "FC.MILK"}},
      {"variant": "STD.Milk", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "STD.Milk"}},
      {"variant": "TM MILK(CURD)", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "TM MILK(CURD)"}},
      {"variant": "CUP CURD", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "CUP CURD"}},
      {"variant": "KHOA", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "KHOA"}},
      {"variant": "LAB SAMPLE", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "LAB SAMPLE"}},
      {"variant": "TO METRO", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "TO METRO"}},
      {"variant": "WF", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "WF"}},
      {"variant": "SMP", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SMP"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 2. Skimmed Milk
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'skim_milk',
    'SKIMMED MILK - RECEIPT AND DISPOSAL STATEMENT',
    'SKIM MILK',
    'Skimmed Milk statement formulation and reconciliation',
    2,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "SKIMMILK RECEIPT", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SKIMMILK RECEIPT"}},
      {"variant": "SMP", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP"}},
      {"variant": "WATER FLUSH", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WATER FLUSH"}},
      {"variant": "BUTTER MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "BUTTER MILK"}}
    ]'::jsonb,
    '[
      {"variant": "TM DELITE 3.5/8.5", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "TM DELITE 3.5/8.5"}},
      {"variant": "TM MILK(CURD)", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "TM MILK(CURD)"}},
      {"variant": "AMBATTUR-SSM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "AMBATTUR-SSM"}},
      {"variant": "SNR-SSM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SNR-SSM"}},
      {"variant": "DCPP-SSM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "DCPP-SSM"}},
      {"variant": "ERODE -SSM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "ERODE -SSM"}},
      {"variant": "CBE-SSM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "CBE-SSM"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 3. Cream
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'cream',
    'CREAM - RECEIPT AND DISPOSAL STATEMENT',
    'CREAM',
    'Cream statement formulation and reconciliation',
    3,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "CREAM", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "CREAM"}}
    ]'::jsonb,
    '[
      {"variant": "FCM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "FCM"}},
      {"variant": "STD", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "STD"}},
      {"variant": "CHURNING", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "CHURNING"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 4. Separation
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'separation',
    'SEPARATION - RECEIPT AND DISPOSAL STATEMENT',
    'SEPARATION',
    'Separation statement formulation and reconciliation',
    4,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "WHOLE MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WHOLE MILK"}}
    ]'::jsonb,
    '[
      {"variant": "SKIMMILK", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SKIMMILK"}},
      {"variant": "CREAM", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "CREAM"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 5. Delite
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'delite',
    'DELITE - RECEIPT AND DISPOSAL STATEMENT',
    'DELITE',
    'Delite Milk statement formulation and reconciliation',
    5,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "WHOLE MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WHOLE MILK"}},
      {"variant": "SKIMMED MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SKIMMED MILK"}},
      {"variant": "SMP", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP"}},
      {"variant": "WATER", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WATER"}}
    ]'::jsonb,
    '[
      {"variant": "SACHET FILLING", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SACHET FILLING"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 6. Full Cream Milk (FCM)
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'fcm',
    'FCM - RECEIPT AND DISPOSAL STATEMENT',
    'FCM',
    'Full Cream Milk statement formulation and reconciliation',
    6,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "WHOLE MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WHOLE MILK"}},
      {"variant": "CREAM", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "CREAM"}},
      {"variant": "SMP", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP"}},
      {"variant": "WATER", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WATER"}}
    ]'::jsonb,
    '[
      {"variant": "SACHET FILLING", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SACHET FILLING"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 7. Standardised Milk (STD)
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'std',
    'STD - RECEIPT AND DISPOSAL STATEMENT',
    'STD',
    'Standardised Milk statement formulation and reconciliation',
    7,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "WHOLE MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WHOLE MILK"}},
      {"variant": "SKIMMED MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SKIMMED MILK"}},
      {"variant": "CREAM", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "CREAM"}},
      {"variant": "SMP", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP"}},
      {"variant": "WATER", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WATER"}}
    ]'::jsonb,
    '[
      {"variant": "SACHET FILLING", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SACHET FILLING"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 8. Curd
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'curd',
    'CURD - RECEIPT AND DISPOSAL STATEMENT',
    'CURD',
    'Curd statement formulation and reconciliation',
    8,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "WHOLE MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "WHOLE MILK"}},
      {"variant": "SKIMMED MILK", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SKIMMED MILK"}},
      {"variant": "SMP", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP"}}
    ]'::jsonb,
    '[
      {"variant": "SACHET FILLING", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "SACHET FILLING"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 9. SMP For RSM
  INSERT INTO public.stg_masters (key, label, variant, description, sort_order, is_active, ob_columns, receipt_columns, disposal_columns, recon_columns, ob_rows, receipt_rows, disposal_rows, cmpdd_norm)
  VALUES (
    'smp_for_rsm',
    'SMP FOR RSM - RECEIPT AND DISPOSAL STATEMENT',
    'SMP FOR RSM',
    'SMP for RSM SNF boosting formulation and reconciliation',
    9,
    true,
    v_default_cols, v_default_cols, v_default_cols, '[]'::jsonb,
    v_default_ob,
    '[
      {"variant": "SMP FOR SNF BOOSTING", "row_type": "RECEIPT", "side": "RECEIPT", "values": {"variant": "SMP FOR SNF BOOSTING"}}
    ]'::jsonb,
    '[
      {"variant": "DLT MILK", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "DLT MILK"}},
      {"variant": "FC.MILK", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "FC.MILK"}},
      {"variant": "STD.Milk", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "STD.Milk"}},
      {"variant": "TM MILK(CURD)", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "TM MILK(CURD)"}},
      {"variant": "CUP CURD", "row_type": "DISPOSAL", "side": "DISPOSAL", "values": {"variant": "CUP CURD"}}
    ]'::jsonb,
    '0.5'
  )
  ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

END $$;
