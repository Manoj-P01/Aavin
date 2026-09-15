-- ============================================================
-- 005_master_stored_procedures.sql
-- Stored Procedures (SPs) & Functions for products_master and dairy_destinations_master
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SP: Upsert Product in products_master
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_upsert_product_master(
  p_product_key   TEXT,
  p_product_name  TEXT,
  p_short_name    TEXT DEFAULT NULL,
  p_category      TEXT DEFAULT 'Liquid Milk',
  p_sort_order    INT DEFAULT 0,
  p_is_active     BOOLEAN DEFAULT true,
  p_actor         TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  id           UUID,
  product_key  TEXT,
  product_name TEXT,
  short_name   TEXT,
  category     TEXT,
  sort_order   INT,
  is_active    BOOLEAN,
  created_by   TEXT,
  created_at   TIMESTAMPTZ,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO products_master (
    product_key,
    product_name,
    short_name,
    category,
    sort_order,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    LOWER(TRIM(p_product_key)),
    TRIM(p_product_name),
    COALESCE(TRIM(p_short_name), UPPER(TRIM(p_product_key))),
    COALESCE(p_category, 'Liquid Milk'),
    COALESCE(p_sort_order, 0),
    COALESCE(p_is_active, true),
    COALESCE(p_actor, 'admin'),
    COALESCE(p_actor, 'admin')
  )
  ON CONFLICT (product_key) DO UPDATE
  SET product_name = EXCLUDED.product_name,
      short_name   = EXCLUDED.short_name,
      category     = EXCLUDED.category,
      sort_order   = EXCLUDED.sort_order,
      is_active    = EXCLUDED.is_active,
      updated_by   = EXCLUDED.updated_by,
      updated_at   = now()
  RETURNING
    products_master.id,
    products_master.product_key,
    products_master.product_name,
    products_master.short_name,
    products_master.category,
    products_master.sort_order,
    products_master.is_active,
    products_master.created_by,
    products_master.created_at,
    products_master.updated_by,
    products_master.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_upsert_product_master IS 'Stored Procedure to insert or update a product in products_master table with audit logging.';

-- ─────────────────────────────────────────────────────────────
-- 2. SP: Upsert Destination Dairy in dairy_destinations_master
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_upsert_dairy_destination(
  p_dairy_name TEXT,
  p_code       TEXT DEFAULT NULL,
  p_sort_order INT DEFAULT 0,
  p_is_active  BOOLEAN DEFAULT true,
  p_actor      TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  id         UUID,
  dairy_name TEXT,
  code       TEXT,
  sort_order INT,
  is_active  BOOLEAN,
  created_by TEXT,
  created_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO dairy_destinations_master (
    dairy_name,
    code,
    sort_order,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    TRIM(p_dairy_name),
    COALESCE(TRIM(p_code), UPPER(SUBSTRING(TRIM(p_dairy_name) FROM 1 FOR 4))),
    COALESCE(p_sort_order, 0),
    COALESCE(p_is_active, true),
    COALESCE(p_actor, 'admin'),
    COALESCE(p_actor, 'admin')
  )
  ON CONFLICT (dairy_name) DO UPDATE
  SET code       = EXCLUDED.code,
      sort_order = EXCLUDED.sort_order,
      is_active  = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING
    dairy_destinations_master.id,
    dairy_destinations_master.dairy_name,
    dairy_destinations_master.code,
    dairy_destinations_master.sort_order,
    dairy_destinations_master.is_active,
    dairy_destinations_master.created_by,
    dairy_destinations_master.created_at,
    dairy_destinations_master.updated_by,
    dairy_destinations_master.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_upsert_dairy_destination IS 'Stored Procedure to insert or update a destination dairy in dairy_destinations_master table with audit logging.';

-- ─────────────────────────────────────────────────────────────
-- 3. FUNCTION: Get Active Products Master
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
-- 4. FUNCTION: Get Active Destination Dairies Master
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
