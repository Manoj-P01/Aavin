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

  -- Audit Fields
  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stg_masters_key ON public.stg_masters (key);
CREATE INDEX IF NOT EXISTS idx_stg_masters_sort ON public.stg_masters (sort_order ASC, created_at ASC);

COMMENT ON TABLE public.stg_masters IS 'Dedicated master table for STG statement formulations, column configurations, and reconciliation formulas.';

-- Row Level Security
ALTER TABLE public.stg_masters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all stg_masters" ON public.stg_masters;
CREATE POLICY "Allow all stg_masters" 
  ON public.stg_masters 
  FOR ALL USING (true) WITH CHECK (true);

-- Audit Trigger
DROP TRIGGER IF EXISTS trg_stg_masters_audit ON public.stg_masters;
CREATE TRIGGER trg_stg_masters_audit 
  BEFORE INSERT OR UPDATE ON public.stg_masters 
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Migration / Seed from existing prep_chart_configs if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.prep_chart_configs WHERE config_key = 'stg_masters') THEN
    INSERT INTO public.stg_masters (
      key, label, variant, sort_order, is_active,
      ob_columns, receipt_columns, disposal_columns, recon_columns,
      ob_rows, receipt_rows, disposal_rows, reconciliation_rows
    )
    SELECT 
      m->>'key',
      COALESCE(m->>'label', m->>'variant', 'Untitled Statement'),
      COALESCE(m->>'variant', m->>'key', 'Statement'),
      COALESCE((m->>'sort_order')::int, 0),
      COALESCE((m->>'is_active')::boolean, true),
      COALESCE(m->'ob_columns', '[]'::jsonb),
      COALESCE(m->'receipt_columns', '[]'::jsonb),
      COALESCE(m->'disposal_columns', '[]'::jsonb),
      COALESCE(m->'recon_columns', '[]'::jsonb),
      COALESCE(m->'ob_rows', '[]'::jsonb),
      COALESCE(m->'receipt_rows', '[]'::jsonb),
      COALESCE(m->'disposal_rows', '[]'::jsonb),
      COALESCE(m->'reconciliation_rows', '[]'::jsonb)
    FROM public.prep_chart_configs p,
         jsonb_array_elements(p.config_json) AS m
    ON CONFLICT (key) DO UPDATE SET
      label = EXCLUDED.label,
      variant = EXCLUDED.variant,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active,
      ob_columns = EXCLUDED.ob_columns,
      receipt_columns = EXCLUDED.receipt_columns,
      disposal_columns = EXCLUDED.disposal_columns,
      recon_columns = EXCLUDED.recon_columns,
      ob_rows = EXCLUDED.ob_rows,
      receipt_rows = EXCLUDED.receipt_rows,
      disposal_rows = EXCLUDED.disposal_rows,
      reconciliation_rows = EXCLUDED.reconciliation_rows,
      updated_at = now();
  END IF;
END $$;
