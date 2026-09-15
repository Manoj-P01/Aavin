-- ============================================================
-- 006_particulars_and_soft_delete_sp.sql
-- Stored Procedures for particulars_master and soft delete handling for products & particulars
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SP: Upsert Product with Case-Insensitive Re-open & Position Ordering
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
DECLARE
  v_clean_key   TEXT := LOWER(TRIM(p_product_key));
  v_clean_name  TEXT := TRIM(p_product_name);
  v_clean_short TEXT := COALESCE(TRIM(p_short_name), UPPER(TRIM(p_product_key)));
  v_existing_id UUID;
BEGIN
  -- Search case-insensitively for existing product by product_key OR product_name OR short_name
  SELECT pm.id INTO v_existing_id
  FROM products_master pm
  WHERE LOWER(pm.product_key) = v_clean_key
     OR LOWER(pm.product_name) = LOWER(v_clean_name)
     OR LOWER(pm.short_name)   = LOWER(v_clean_short)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing record (re-opens if soft-deleted)
    RETURN QUERY
    UPDATE products_master
    SET product_name = v_clean_name,
        short_name   = v_clean_short,
        category     = COALESCE(p_category, category),
        sort_order   = COALESCE(p_sort_order, sort_order),
        is_active    = COALESCE(p_is_active, true),
        updated_by   = COALESCE(p_actor, 'admin'),
        updated_at   = now()
    WHERE products_master.id = v_existing_id
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
  ELSE
    -- Insert new product
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
      v_clean_key,
      v_clean_name,
      v_clean_short,
      COALESCE(p_category, 'Liquid Milk'),
      COALESCE(p_sort_order, 0),
      COALESCE(p_is_active, true),
      COALESCE(p_actor, 'admin'),
      COALESCE(p_actor, 'admin')
    )
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 2. SP: Upsert Particular in particulars_master (Receipt / Disposal Rows)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_upsert_particular_master(
  p_section_type     TEXT,
  p_particular_name  TEXT,
  p_code             TEXT DEFAULT NULL,
  p_sort_order       INT DEFAULT 0,
  p_is_active        BOOLEAN DEFAULT true,
  p_actor            TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  id                    UUID,
  section_type          TEXT,
  particular_name       TEXT,
  code                  TEXT,
  is_dairy_destination  BOOLEAN,
  feeds_receipts        BOOLEAN,
  sort_order            INT,
  is_active             BOOLEAN,
  created_by            TEXT,
  created_at            TIMESTAMPTZ,
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ
) AS $$
DECLARE
  v_clean_section TEXT := UPPER(TRIM(p_section_type));
  v_clean_name    TEXT := TRIM(p_particular_name);
  v_clean_code    TEXT := COALESCE(TRIM(p_code), v_clean_name);
  v_existing_id   UUID;
BEGIN
  -- Find existing record case-insensitively for the given section_type
  SELECT pm.id INTO v_existing_id
  FROM particulars_master pm
  WHERE pm.section_type = v_clean_section
    AND (LOWER(pm.particular_name) = LOWER(v_clean_name) OR LOWER(COALESCE(pm.code, '')) = LOWER(v_clean_code))
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing record (re-enables soft-deleted item)
    RETURN QUERY
    UPDATE particulars_master
    SET particular_name = v_clean_name,
        code            = v_clean_code,
        sort_order      = COALESCE(p_sort_order, sort_order),
        is_active       = COALESCE(p_is_active, true),
        updated_by      = COALESCE(p_actor, 'admin'),
        updated_at      = now()
    WHERE particulars_master.id = v_existing_id
    RETURNING
      particulars_master.id,
      particulars_master.section_type,
      particulars_master.particular_name,
      particulars_master.code,
      particulars_master.is_dairy_destination,
      particulars_master.feeds_receipts,
      particulars_master.sort_order,
      particulars_master.is_active,
      particulars_master.created_by,
      particulars_master.created_at,
      particulars_master.updated_by,
      particulars_master.updated_at;
  ELSE
    -- Insert new particular
    RETURN QUERY
    INSERT INTO particulars_master (
      section_type,
      particular_name,
      code,
      sort_order,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      v_clean_section,
      v_clean_name,
      v_clean_code,
      COALESCE(p_sort_order, 0),
      COALESCE(p_is_active, true),
      COALESCE(p_actor, 'admin'),
      COALESCE(p_actor, 'admin')
    )
    RETURNING
      particulars_master.id,
      particulars_master.section_type,
      particulars_master.particular_name,
      particulars_master.code,
      particulars_master.is_dairy_destination,
      particulars_master.feeds_receipts,
      particulars_master.sort_order,
      particulars_master.is_active,
      particulars_master.created_by,
      particulars_master.created_at,
      particulars_master.updated_by,
      particulars_master.updated_at;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 3. FUNCTION: Fetch Active Particulars by Section Type
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
-- 4. PROCEDURES: Soft Delete Product and Particular
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
