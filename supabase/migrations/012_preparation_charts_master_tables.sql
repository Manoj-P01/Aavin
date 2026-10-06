-- ============================================================
-- 012_preparation_charts_master_tables.sql
-- Flexible JSON Storage for Preparation Chart Masters, Columns & Formulation Entries
-- ============================================================

-- 1. PREP CHART CONFIGS (Flexible JSON storage for Masters and Columns)
CREATE TABLE IF NOT EXISTS prep_chart_configs (
  config_key   text PRIMARY KEY, -- 'masters' | 'columns'
  config_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE prep_chart_configs IS 'Dynamic JSON store for Preparation Chart Masters and Column definitions.';

-- 2. PREP CHART ENTRIES (Flexible JSON storage for date & shift entries)
CREATE TABLE IF NOT EXISTS prep_chart_entries (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chart_key    text NOT NULL,
  entry_date   date NOT NULL,
  shift        text NOT NULL DEFAULT 'D',
  entry_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chart_key, entry_date, shift)
);

COMMENT ON TABLE prep_chart_entries IS 'Dynamic JSON store for daily Preparation Chart formulation entries.';
