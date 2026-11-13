-- ============================================================
-- 024_migrate_1970_settings_to_app_settings.sql
-- Move system settings out of entries table into app_settings.
-- Pure DDL only: creates app_settings table and real date constraint.
-- ============================================================

-- 1. Ensure app_settings exists
CREATE TABLE IF NOT EXISTS public.app_settings (
  key             text PRIMARY KEY,
  value           jsonb NOT NULL,
  effective_from  date DEFAULT CURRENT_DATE,
  updated_by      text DEFAULT 'admin',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS 'Global system, shift and calculation configuration.';

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all app_settings" ON public.app_settings;
CREATE POLICY "Allow all app_settings" 
  ON public.app_settings 
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Add constraint to prevent writing fake 1970 dates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entries_real_date_chk'
  ) THEN
    ALTER TABLE public.entries 
    ADD CONSTRAINT entries_real_date_chk CHECK (entry_date >= DATE '2000-01-01') NOT VALID;
  END IF;
END $$;
