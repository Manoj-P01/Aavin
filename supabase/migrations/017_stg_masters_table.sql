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
