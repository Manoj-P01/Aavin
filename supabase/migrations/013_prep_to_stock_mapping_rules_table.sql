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

-- Seed Default Preparation Chart to Stock Statement Mapping Rules
INSERT INTO prep_to_stock_mapping_rules (rule_key, source_chart_key, source_variant, source_col_key, target_row_type, target_product_key, enabled, description, sort_order)
VALUES
  ('rule_delite', '*', 'DELITE', 'qty_lit', 'RECEIPT', 'dlt_milk', true, 'DELITE Preparation Chart Qty(Lit) ➔ DLT.Milk (Receipts)', 1),
  ('rule_fcm', '*', 'FCM', 'qty_lit', 'RECEIPT', 'fcm', true, 'FCM Preparation Chart Qty(Lit) ➔ FCM (Receipts)', 2),
  ('rule_std', '*', 'STD MILK', 'qty_lit', 'RECEIPT', 'std_milk', true, 'STD Preparation Chart Qty(Lit) ➔ STD.Milk (Receipts)', 3),
  ('rule_skim', '*', 'SKIM MILK', 'qty_lit', 'RECEIPT', 'skim_milk', true, 'Skim Milk Preparation Chart Qty(Lit) ➔ SKIM MILK (Receipts)', 4)
ON CONFLICT (rule_key) DO NOTHING;
