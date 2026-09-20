-- ─────────────────────────────────────────────────────────────
-- 011_STOCK_SUMMARY_ROWS_TABLE.SQL
-- Dedicated Database Table for Live Stock Statement Summaries (JSONB payload)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_summary_rows (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id     uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  summary_type text NOT NULL CHECK (summary_type IN (
                 'OB',               -- Opening Balance
                 'TOTAL_RECEIPT',    -- Total Receipts (+)
                 'TOTAL_DISPOSAL',   -- Total Disposals (-)
                 'CB'                -- Closing Balance (=)
               )),
  row_label    text NOT NULL,
  summary_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order   int DEFAULT 0,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stock_summary_rows IS 'Stock Statement Live Summary Rows (OB, Total Receipts, Total Disposals, CB) stored as JSONB data per entry.';
CREATE INDEX IF NOT EXISTS idx_stock_summary_rows_entry ON stock_summary_rows(entry_id);

-- Automatic Audit Fields Trigger (created_at, updated_at, etc.)
DROP TRIGGER IF EXISTS trg_stock_summary_rows_audit ON stock_summary_rows;
CREATE TRIGGER trg_stock_summary_rows_audit 
  BEFORE INSERT OR UPDATE ON stock_summary_rows 
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Row Level Security (RLS)
ALTER TABLE stock_summary_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all stock summary rows" ON stock_summary_rows;
CREATE POLICY "Allow all stock summary rows" ON stock_summary_rows FOR ALL USING (true) WITH CHECK (true);
