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
