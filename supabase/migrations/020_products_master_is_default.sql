-- ============================================================
-- 020_products_master_is_default.sql
-- Add is_default flag to products_master table
-- ============================================================

ALTER TABLE public.products_master 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Set default product (e.g. dlt_milk)
UPDATE public.products_master 
SET is_default = true 
WHERE product_key = 'dlt_milk' AND NOT EXISTS (
  SELECT 1 FROM public.products_master WHERE is_default = true
);

