-- ─────────────────────────────────────────────────────────────
-- 013_prep_to_stock_mapping_rules_table.sql
-- Dedicated Table for Preparation Chart ➔ Stock Statement Entry Custom Mapping Rules
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prep_to_stock_mapping_rules (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_key            text UNIQUE,
  source_chart_key    text NOT NULL DEFAULT '*',
  source_variant      text NOT NULL,
  source_col_key      text NOT NULL DEFAULT 'qty_lit',
  target_row_type     text NOT NULL DEFAULT 'RECEIPT',
  target_row_label    text,
  target_product_key  text NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  description         text,
  sort_order          integer NOT NULL DEFAULT 0,
  created_by          text DEFAULT 'admin',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT 'admin',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE prep_to_stock_mapping_rules IS 'Dedicated table for customizable mapping rules from Stage 1 Preparation Charts to Stage 2 Stock Statement Entry.';

DROP TRIGGER IF EXISTS trg_prep_to_stock_mapping_rules_audit ON prep_to_stock_mapping_rules;
CREATE TRIGGER trg_prep_to_stock_mapping_rules_audit BEFORE INSERT OR UPDATE ON prep_to_stock_mapping_rules FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

ALTER TABLE prep_to_stock_mapping_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all prep to stock mapping rules" ON prep_to_stock_mapping_rules;
CREATE POLICY "Allow all prep to stock mapping rules" ON prep_to_stock_mapping_rules FOR ALL USING (true) WITH CHECK (true);
