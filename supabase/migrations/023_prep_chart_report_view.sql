-- ============================================================
-- 023_prep_chart_report_view.sql
-- Server-side view/RPC for Preparation Chart Report range queries
-- ============================================================

CREATE OR REPLACE VIEW public.prep_chart_report_summary AS
SELECT
  id,
  chart_key,
  entry_date,
  shift,
  created_at,
  updated_at
FROM public.prep_chart_entries
ORDER BY entry_date DESC, shift ASC;

