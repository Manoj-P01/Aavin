-- ============================================================
-- 003_configurable_master_tables.sql
-- Configurable Mappings for Products, Particulars, Dairy Destinations & Audit Fields
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PRODUCTS MASTER (Configurable Products)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products_master (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key   text NOT NULL UNIQUE,
  product_name  text NOT NULL,
  short_name    text,
  category      text DEFAULT 'Liquid Milk',
  sort_order    int DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE products_master IS 'Configurable product definitions for stock entries and reports.';
CREATE TRIGGER trg_products_audit BEFORE INSERT OR UPDATE ON products_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 2. PARTICULARS MASTER (Configurable Receipts / Disposals Particulars)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS particulars_master (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_type          text NOT NULL CHECK (section_type IN ('RECEIPT', 'DISPOSAL', 'BALANCE')),
  particular_name       text NOT NULL,
  code                  text,
  is_dairy_destination  boolean NOT NULL DEFAULT false,
  feeds_receipts        boolean NOT NULL DEFAULT false,
  sort_order            int DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  created_by            text DEFAULT 'admin',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            text DEFAULT 'admin',
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_type, particular_name)
);

COMMENT ON TABLE particulars_master IS 'Configurable particulars rows for Receipts, Disposals, and Balance sections.';
CREATE TRIGGER trg_particulars_audit BEFORE INSERT OR UPDATE ON particulars_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 3. DAIRY DESTINATIONS MASTER (Configurable Preset Union Dairies)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dairy_destinations_master (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dairy_name   text NOT NULL UNIQUE,
  code         text,
  sort_order   int DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE dairy_destinations_master IS 'Configurable preset destination union dairies for SSM split entries.';
CREATE TRIGGER trg_dairy_destinations_audit BEFORE INSERT OR UPDATE ON dairy_destinations_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 4. RECEIPT PARTITION MAPPINGS (Configurable Rules)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_partition_mappings (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_disposal_particular  text NOT NULL,
  target_receipt_product_key  text NOT NULL,
  enabled                     boolean NOT NULL DEFAULT true,
  created_by                  text DEFAULT 'admin',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  text DEFAULT 'admin',
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE receipt_partition_mappings IS 'Configurable rules mapping disposal particulars to target receipt products.';
CREATE TRIGGER trg_partition_mappings_audit BEFORE INSERT OR UPDATE ON receipt_partition_mappings FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 5. ADD AUDIT COLUMNS TO EXISTING ENTRIES & ROWS TABLES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_by text DEFAULT 'admin';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_by text DEFAULT 'admin';

ALTER TABLE stock_rows ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE stock_rows ADD COLUMN IF NOT EXISTS created_by text DEFAULT 'admin';
ALTER TABLE stock_rows ADD COLUMN IF NOT EXISTS updated_by text DEFAULT 'admin';

ALTER TABLE ts_milk_rows ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ts_milk_rows ADD COLUMN IF NOT EXISTS created_by text DEFAULT 'admin';
ALTER TABLE ts_milk_rows ADD COLUMN IF NOT EXISTS updated_by text DEFAULT 'admin';

ALTER TABLE stg_rows ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE stg_rows ADD COLUMN IF NOT EXISTS created_by text DEFAULT 'admin';
ALTER TABLE stg_rows ADD COLUMN IF NOT EXISTS updated_by text DEFAULT 'admin';

-- Apply Audit Triggers to existing tables
DROP TRIGGER IF EXISTS trg_entries_audit ON entries;
CREATE TRIGGER trg_entries_audit BEFORE INSERT OR UPDATE ON entries FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

DROP TRIGGER IF EXISTS trg_stock_rows_audit ON stock_rows;
CREATE TRIGGER trg_stock_rows_audit BEFORE INSERT OR UPDATE ON stock_rows FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

DROP TRIGGER IF EXISTS trg_ts_milk_rows_audit ON ts_milk_rows;
CREATE TRIGGER trg_ts_milk_rows_audit BEFORE INSERT OR UPDATE ON ts_milk_rows FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

DROP TRIGGER IF EXISTS trg_stg_rows_audit ON stg_rows;
CREATE TRIGGER trg_stg_rows_audit BEFORE INSERT OR UPDATE ON stg_rows FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
