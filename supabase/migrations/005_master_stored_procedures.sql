-- ============================================================
-- 005_master_stored_procedures.sql
-- Stored Procedures (SPs) & Functions for products_master and dairy_destinations_master
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. FUNCTION: Get Active Products Master
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_active_products_master()
RETURNS SETOF products_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products_master
  WHERE is_active = true
  ORDER BY sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 2. FUNCTION: Get Active Destination Dairies Master
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_active_dairy_destinations()
RETURNS SETOF dairy_destinations_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM dairy_destinations_master
  WHERE is_active = true
  ORDER BY sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
