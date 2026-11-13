-- ============================================================
-- 006_particulars_and_soft_delete_sp.sql
-- Stored Procedures for particulars_master and soft delete handling for products & particulars
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. FUNCTION: Fetch Active Particulars by Section Type
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_active_particulars_master(p_section_type TEXT DEFAULT NULL)
RETURNS SETOF particulars_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM particulars_master
  WHERE is_active = true
    AND (p_section_type IS NULL OR section_type = UPPER(TRIM(p_section_type)))
  ORDER BY sort_order ASC, particular_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 2. PROCEDURES: Soft Delete Product and Particular
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_soft_delete_product_master(p_id UUID, p_actor TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE products_master
  SET is_active = false,
      updated_by = p_actor,
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_soft_delete_particular_master(p_id UUID, p_actor TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE particulars_master
  SET is_active = false,
      updated_by = p_actor,
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
