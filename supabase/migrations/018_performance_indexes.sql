-- ============================================================
-- 018_performance_indexes.sql
-- High-Performance Composite Indexes for Aavin Dashboard Database
-- Drastically accelerates queries on entries, stock rows, formulations & mappings
-- ============================================================

-- 1. Entries Table Composite Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_entries_report_date_shift 
  ON public.entries (report_type, entry_date, shift);

CREATE INDEX IF NOT EXISTS idx_entries_report_date 
  ON public.entries (report_type, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_entries_month_lookup 
  ON public.entries (report_type, entry_date);

-- 2. Stock Rows Child Tables
CREATE INDEX IF NOT EXISTS idx_stock_rows_entry_sort 
  ON public.stock_rows (entry_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_stock_summary_rows_entry_sort 
  ON public.stock_summary_rows (entry_id, sort_order ASC);

-- 3. Preparation Chart Formulations
CREATE INDEX IF NOT EXISTS idx_prep_chart_entries_lookup 
  ON public.prep_chart_entries (chart_key, entry_date, shift);

CREATE INDEX IF NOT EXISTS idx_prep_chart_entries_date_shift 
  ON public.prep_chart_entries (entry_date, shift);

-- 4. Mapping Tables Lookups
CREATE INDEX IF NOT EXISTS idx_statement_mapping_rules_block 
  ON public.statement_mapping_rules (stg_block_key, stg_section);

CREATE INDEX IF NOT EXISTS idx_prep_to_stock_rules_lookup 
  ON public.prep_to_stock_mapping_rules (source_chart_key, enabled);

