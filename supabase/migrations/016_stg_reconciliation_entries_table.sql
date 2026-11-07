-- ============================================================
-- 016_stg_reconciliation_entries_table.sql
-- Dedicated JSON Table for STG Stock Balance & Reconciliation Summary Entries
-- Allows user-configured rows, columns, and custom formulas to persist
-- strictly per statement master, entry date, and shift.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stg_reconciliation_entries (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  entry_id      uuid REFERENCES public.entries(id) ON DELETE CASCADE,
  statement_key text NOT NULL,
  entry_date    date NOT NULL,
  shift         text NOT NULL DEFAULT 'F',
  summary_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stg_reconciliation_entries_stmt_date_shift_key UNIQUE (statement_key, entry_date, shift)
);

CREATE INDEX IF NOT EXISTS idx_stg_reconciliation_entries_lookup 
  ON public.stg_reconciliation_entries (entry_date, shift, statement_key);

COMMENT ON TABLE public.stg_reconciliation_entries IS 'Dynamic JSON store for user-configured STG Stock Balance & Reconciliation summaries with formulas.';

-- Row Level Security
ALTER TABLE public.stg_reconciliation_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all stg_reconciliation_entries" ON public.stg_reconciliation_entries;
CREATE POLICY "Allow all stg_reconciliation_entries" 
  ON public.stg_reconciliation_entries 
  FOR ALL USING (true) WITH CHECK (true);

-- Audit Trigger
DROP TRIGGER IF EXISTS trg_stg_reconciliation_entries_audit ON public.stg_reconciliation_entries;
CREATE TRIGGER trg_stg_reconciliation_entries_audit 
  BEFORE INSERT OR UPDATE ON public.stg_reconciliation_entries 
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

