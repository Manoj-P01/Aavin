-- ============================================================
-- 025_drop_separation_details.sql
-- Remove separation_details table and backup existing data
-- ============================================================

BEGIN;

-- 1. Backup existing table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'separation_details') THEN
    CREATE TABLE IF NOT EXISTS public._bak_separation_details AS TABLE public.separation_details;
  END IF;
END $$;

-- 2. Drop the table and any dependent objects
DROP TABLE IF EXISTS public.separation_details CASCADE;

COMMIT;

