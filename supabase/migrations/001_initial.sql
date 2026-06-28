-- ============================================================
-- Aavin Dairy Dashboard – Initial Database Migration
-- Namakkal District Co-operative Milk Producers' Union Ltd
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. ENTRIES (master record per date/shift/report_type)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entries (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date    date NOT NULL,
  shift         char(1) CHECK (shift IN ('D', 'N')),  -- D=Day, N=Night, NULL=TS report
  report_type   text NOT NULL CHECK (report_type IN ('TS', 'STOCK')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_date, shift, report_type)
);

COMMENT ON TABLE entries IS 'Master entry per date+shift+report_type. TS reports have shift=NULL.';

-- ─────────────────────────────────────────────────────────────
-- 2. TS_MILK_ROWS (Total Solids report – TS sheet)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ts_milk_rows (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  section     text NOT NULL CHECK (section IN (
                'OB',                  -- Opening Balance
                'RECEIPT',             -- Receipts (BMC, SMP, etc.)
                'DISPOSAL_DESPATCH',   -- Despatch/Sale (SSM transfers)
                'LOCAL_SALE',          -- Local sales (DLT, FC, STD)
                'OTHER_DISPOSAL',      -- SMP, Curd, Khoa, Lab, Cream
                'CB'                   -- Closing Balance
              )),
  product     text NOT NULL,  -- WM, SSM, CREAM, DLT MILK, FC.MILK, STD.Milk, SMP, BMC's etc.
  qty_lts     numeric(12,3) DEFAULT 0,
  qty_kg      numeric(12,3) DEFAULT 0,
  fat_pct     numeric(6,4) DEFAULT 0,
  snf_pct     numeric(6,4) DEFAULT 0,
  sp_gr       numeric(6,4) DEFAULT 0,
  kg_fat      numeric(12,4) DEFAULT 0,
  kg_snf      numeric(12,4) DEFAULT 0,
  remarks     text,
  sort_order  int DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ts_milk_rows IS 'Total Solids (TS sheet) rows: OB, Receipts, Disposals, CB per product.';
CREATE INDEX idx_ts_milk_rows_entry ON ts_milk_rows(entry_id);

-- ─────────────────────────────────────────────────────────────
-- 3. STG_ROWS (Solid Balance Details – STG sheet)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stg_rows (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  product_block text NOT NULL CHECK (product_block IN ('WM','SSM','CREAM','SMP')),
  side        text NOT NULL CHECK (side IN ('RECEIPT','DISPOSAL')),
  item_name   text NOT NULL,  -- e.g. 'P.VELUR CC', 'BMC''s', 'SEPERATION', etc.
  qty_lts     numeric(12,3) DEFAULT 0,
  qty_kg      numeric(12,3) DEFAULT 0,
  fat_pct     numeric(6,4) DEFAULT 0,
  snf_pct     numeric(6,4) DEFAULT 0,
  sp_gr       numeric(6,4) DEFAULT 0,
  kg_fat      numeric(12,4) DEFAULT 0,
  kg_snf      numeric(12,4) DEFAULT 0,
  sort_order  int DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stg_rows IS 'STG sheet rows: solid balance per product (WM, SSM, CREAM, SMP) - Receipt & Disposal sides.';
CREATE INDEX idx_stg_rows_entry ON stg_rows(entry_id);

-- ─────────────────────────────────────────────────────────────
-- 4. STOCK_ROWS (Milk & Cream Stock Statement)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_rows (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id     uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  row_type     text NOT NULL CHECK (row_type IN (
                 'OB',          -- Opening Balance
                 'RECEIPT',     -- Receipt line items
                 'DISPOSAL',    -- Disposal line items
                 'PHYSICAL'     -- Physical count
               )),
  row_label    text NOT NULL,   -- e.g. 'Receipts:', 'To DLT Milk', 'Re-Processing', etc.
  -- 12 product columns (in litres)
  wh_milk      numeric(12,3) DEFAULT 0,
  dlt_milk     numeric(12,3) DEFAULT 0,
  fc_milk      numeric(12,3) DEFAULT 0,
  std_milk     numeric(12,3) DEFAULT 0,
  toned_curd   numeric(12,3) DEFAULT 0,
  dtm          numeric(12,3) DEFAULT 0,
  skim_milk    numeric(12,3) DEFAULT 0,
  cream        numeric(12,3) DEFAULT 0,
  butter_milk  numeric(12,3) DEFAULT 0,
  r_con        numeric(12,3) DEFAULT 0,
  smp          numeric(12,3) DEFAULT 0,
  water        numeric(12,3) DEFAULT 0,
  sort_order   int DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stock_rows IS 'NKL Milk & Cream Stock Statement rows per shift.';
CREATE INDEX idx_stock_rows_entry ON stock_rows(entry_id);

-- ─────────────────────────────────────────────────────────────
-- 5. SEPARATION_DETAILS (Separation panel in Stock sheet)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS separation_details (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id      uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  -- Whole Milk going to separation
  wm_fat_pct    numeric(6,4) DEFAULT 0,
  wm_snf_pct    numeric(6,4) DEFAULT 0,
  -- Cream output
  cream_lts     numeric(12,3) DEFAULT 0,
  cream_fat_pct numeric(6,4) DEFAULT 0,
  cream_snf_pct numeric(6,4) DEFAULT 0,
  -- SSM output
  ssm_lts       numeric(12,3) DEFAULT 0,
  ssm_fat_pct   numeric(6,4) DEFAULT 0,
  ssm_snf_pct   numeric(6,4) DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entry_id)
);

COMMENT ON TABLE separation_details IS 'Separation details panel per stock sheet entry.';

-- ─────────────────────────────────────────────────────────────
-- 6. Auto-update updated_at trigger
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7. Row Level Security (future-ready, currently open)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_milk_rows      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg_rows          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_rows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE separation_details ENABLE ROW LEVEL SECURITY;

-- Currently allow all operations (no auth enforced yet)
-- When auth is enabled, replace these with user-scoped policies
CREATE POLICY "Allow all" ON entries            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ts_milk_rows       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stg_rows           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stock_rows         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON separation_details FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 8. Useful Views
-- ─────────────────────────────────────────────────────────────

-- View: Monthly TS summary (for trend charts)
CREATE OR REPLACE VIEW v_monthly_ts_summary AS
SELECT
  date_trunc('month', e.entry_date)::date AS month,
  COUNT(DISTINCT e.id) AS entry_count,
  SUM(CASE WHEN t.section = 'OB' THEN t.kg_fat ELSE 0 END)      AS total_arrival_kg_fat,
  SUM(CASE WHEN t.section IN ('DISPOSAL_DESPATCH','LOCAL_SALE','OTHER_DISPOSAL')
           THEN t.kg_fat ELSE 0 END)                              AS total_disposal_kg_fat,
  SUM(CASE WHEN t.section = 'OB' THEN t.kg_snf ELSE 0 END)      AS total_arrival_kg_snf,
  SUM(CASE WHEN t.section IN ('DISPOSAL_DESPATCH','LOCAL_SALE','OTHER_DISPOSAL')
           THEN t.kg_snf ELSE 0 END)                              AS total_disposal_kg_snf
FROM entries e
JOIN ts_milk_rows t ON t.entry_id = e.id
WHERE e.report_type = 'TS'
GROUP BY 1
ORDER BY 1;

-- View: Daily stock closing balances
CREATE OR REPLACE VIEW v_stock_closing_balance AS
SELECT
  e.entry_date,
  e.shift,
  r.wh_milk, r.dlt_milk, r.fc_milk, r.std_milk,
  r.skim_milk, r.cream, r.smp
FROM entries e
JOIN stock_rows r ON r.entry_id = e.id AND r.row_type = 'PHYSICAL'
WHERE e.report_type = 'STOCK'
ORDER BY e.entry_date, e.shift;
