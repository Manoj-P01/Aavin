-- ─────────────────────────────────────────────────────────────
-- 014_stock_rows_entry_json.sql
-- Flexible JSON Storage for Stock Statement Rows (OB, RECEIPT, DISPOSAL)
-- ─────────────────────────────────────────────────────────────

-- Add entry_json jsonb column to stock_rows table if it doesn't already exist
ALTER TABLE stock_rows ADD COLUMN IF NOT EXISTS entry_json jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN stock_rows.entry_json IS 'Flexible JSON store containing all particular rows and product values for OB, RECEIPT, or DISPOSAL sections.';

