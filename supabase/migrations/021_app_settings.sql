-- ============================================================
-- 021_app_settings.sql
-- Table for dynamic application settings, calculation formulas and plant norms
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key             text PRIMARY KEY,
  value           jsonb NOT NULL,
  effective_from  date DEFAULT CURRENT_DATE,
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS 'Global system and calculation settings (e.g. calculation parameters, CMPDD norm %, decimal rounding).';

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all app_settings" ON public.app_settings;
CREATE POLICY "Allow all app_settings" 
  ON public.app_settings 
  FOR ALL USING (true) WITH CHECK (true);

