-- ============================================================
-- 027_ts_stg_rows_to_json.sql
-- Convert ts_milk_rows and stg_rows to store variable/numeric data in row_json jsonb.
-- Drop static numeric columns and remove fixed check on stg_rows.product_block.
-- ============================================================

BEGIN;

-- 1. Backup ts_milk_rows and stg_rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ts_milk_rows') THEN
    CREATE TABLE IF NOT EXISTS public._bak_ts_milk_rows AS TABLE public.ts_milk_rows;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stg_rows') THEN
    CREATE TABLE IF NOT EXISTS public._bak_stg_rows AS TABLE public.stg_rows;
  END IF;
END $$;

-- 2. ts_milk_rows: Add row_json, backfill, and drop numeric columns
ALTER TABLE public.ts_milk_rows ADD COLUMN IF NOT EXISTS row_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ts_milk_rows' AND column_name = 'qty_lts') THEN
    UPDATE public.ts_milk_rows
    SET row_json = jsonb_strip_nulls(jsonb_build_object(
      'qty_lts', qty_lts,
      'qty_kg', qty_kg,
      'fat_pct', fat_pct,
      'snf_pct', snf_pct,
      'sp_gr', sp_gr,
      'kg_fat', kg_fat,
      'kg_snf', kg_snf,
      'remarks', remarks
    ))
    WHERE row_json = '{}'::jsonb;

    ALTER TABLE public.ts_milk_rows
      DROP COLUMN IF EXISTS qty_lts,
      DROP COLUMN IF EXISTS qty_kg,
      DROP COLUMN IF EXISTS fat_pct,
      DROP COLUMN IF EXISTS snf_pct,
      DROP COLUMN IF EXISTS sp_gr,
      DROP COLUMN IF EXISTS kg_fat,
      DROP COLUMN IF EXISTS kg_snf,
      DROP COLUMN IF EXISTS remarks;
  END IF;
END $$;

COMMENT ON TABLE public.ts_milk_rows IS 'Total Solids (TS) Statement rows storing operational metrics dynamically in row_json.';

-- 3. stg_rows: Add row_json, backfill, drop numeric columns, and drop product_block fixed CHECK
ALTER TABLE public.stg_rows ADD COLUMN IF NOT EXISTS row_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stg_rows' AND column_name = 'qty_lts') THEN
    UPDATE public.stg_rows
    SET row_json = jsonb_strip_nulls(jsonb_build_object(
      'qty_lts', qty_lts,
      'qty_kg', qty_kg,
      'fat_pct', fat_pct,
      'snf_pct', snf_pct,
      'sp_gr', sp_gr,
      'kg_fat', kg_fat,
      'kg_snf', kg_snf
    ))
    WHERE row_json = '{}'::jsonb;

    ALTER TABLE public.stg_rows
      DROP COLUMN IF EXISTS qty_lts,
      DROP COLUMN IF EXISTS qty_kg,
      DROP COLUMN IF EXISTS fat_pct,
      DROP COLUMN IF EXISTS snf_pct,
      DROP COLUMN IF EXISTS sp_gr,
      DROP COLUMN IF EXISTS kg_fat,
      DROP COLUMN IF EXISTS kg_snf;
  END IF;
END $$;

-- Drop fixed product_block CHECK on stg_rows to support user-defined blocks
ALTER TABLE public.stg_rows DROP CONSTRAINT IF EXISTS stg_rows_product_block_check;

COMMENT ON TABLE public.stg_rows IS 'Solid Balance Details (STG) statement lines storing dynamic numbers in row_json with flexible product_block keys.';

COMMIT;

