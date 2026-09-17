-- ─────────────────────────────────────────────────────────────
-- 009_DEDICATED_MAPPING_TABLES.SQL
-- Dedicated Tables for Disposals ➔ Receipts and STG Statement Mappings
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receipt_partition_mappings (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_disposal_particular  text NOT NULL,
  target_receipt_product_key  text,
  target_receipt_product_label text,
  partitions                  jsonb,
  enabled                     boolean NOT NULL DEFAULT true,
  created_by                  text DEFAULT 'admin',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  text DEFAULT 'admin',
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE receipt_partition_mappings IS 'Configurable rules mapping disposal particulars to target receipt products.';
DROP TRIGGER IF EXISTS trg_partition_mappings_audit ON receipt_partition_mappings;
CREATE TRIGGER trg_partition_mappings_audit BEFORE INSERT OR UPDATE ON receipt_partition_mappings FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

CREATE TABLE IF NOT EXISTS statement_mapping_rules (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_product_key           text NOT NULL,
  stock_product_label         text,
  stock_section               text NOT NULL,
  stock_particular            text NOT NULL,
  stg_block_key               text NOT NULL,
  stg_block_label             text,
  stg_section                 text NOT NULL,
  stg_item_name               text NOT NULL,
  stg_target_field            text NOT NULL DEFAULT 'qty_lts',
  created_by                  text DEFAULT 'admin',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  text DEFAULT 'admin',
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE statement_mapping_rules IS 'Configurable cross-statement mapping rules between Stock Statement and STG Report.';
DROP TRIGGER IF EXISTS trg_statement_mapping_rules_audit ON statement_mapping_rules;
CREATE TRIGGER trg_statement_mapping_rules_audit BEFORE INSERT OR UPDATE ON statement_mapping_rules FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

ALTER TABLE receipt_partition_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_mapping_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all partition mappings" ON receipt_partition_mappings;
CREATE POLICY "Allow all partition mappings" ON receipt_partition_mappings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all statement mapping rules" ON statement_mapping_rules;
CREATE POLICY "Allow all statement mapping rules" ON statement_mapping_rules FOR ALL USING (true) WITH CHECK (true);
