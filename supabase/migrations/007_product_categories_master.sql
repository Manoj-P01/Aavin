-- ============================================================
-- 007_product_categories_master.sql
-- Product Categories Master Table & Stored Procedures
-- ============================================================

CREATE TABLE IF NOT EXISTS product_categories_master (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name text NOT NULL UNIQUE,
  code          text,
  sort_order    int DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE product_categories_master IS 'Configurable product categories master table.';

DROP TRIGGER IF EXISTS trg_product_categories_audit ON product_categories_master;
CREATE TRIGGER trg_product_categories_audit BEFORE INSERT OR UPDATE ON product_categories_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Insert Default Seed Categories
INSERT INTO product_categories_master (category_name, code, sort_order)
VALUES 
  ('Liquid Milk', 'MILK', 1),
  ('Products', 'PROD', 2),
  ('By-Products', 'BYPROD', 3),
  ('Others', 'OTHR', 4)
ON CONFLICT (category_name) DO NOTHING;

-- SP: Upsert Product Category
CREATE OR REPLACE FUNCTION fn_upsert_product_category(
  p_category_name TEXT,
  p_code          TEXT DEFAULT NULL,
  p_sort_order    INT DEFAULT 0,
  p_is_active     BOOLEAN DEFAULT true,
  p_actor         TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  id            UUID,
  category_name TEXT,
  code          TEXT,
  sort_order    INT,
  is_active     BOOLEAN,
  created_by    TEXT,
  created_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_at    TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO product_categories_master (
    category_name,
    code,
    sort_order,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    TRIM(p_category_name),
    COALESCE(TRIM(p_code), UPPER(SUBSTRING(TRIM(p_category_name) FROM 1 FOR 4))),
    COALESCE(p_sort_order, 0),
    COALESCE(p_is_active, true),
    COALESCE(p_actor, 'admin'),
    COALESCE(p_actor, 'admin')
  )
  ON CONFLICT (category_name) DO UPDATE
  SET code       = EXCLUDED.code,
      sort_order = EXCLUDED.sort_order,
      is_active  = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING
    product_categories_master.id,
    product_categories_master.category_name,
    product_categories_master.code,
    product_categories_master.sort_order,
    product_categories_master.is_active,
    product_categories_master.created_by,
    product_categories_master.created_at,
    product_categories_master.updated_by,
    product_categories_master.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SP: Soft Delete Product Category
CREATE OR REPLACE FUNCTION fn_soft_delete_product_category(
  p_id    UUID,
  p_actor TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE product_categories_master
  SET is_active = false,
      updated_by = COALESCE(p_actor, 'admin'),
      updated_at = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
