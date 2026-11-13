-- ============================================================
-- 022_monthly_totals_view.sql
-- Aggregated monthly totals view and RPC for efficient dashboard reporting
-- ============================================================

CREATE OR REPLACE VIEW public.monthly_totals AS
SELECT
  to_char(entry_date, 'YYYY-MM') AS month_key,
  report_type,
  COUNT(*)::int AS entry_count
FROM public.entries
GROUP BY to_char(entry_date, 'YYYY-MM'), report_type
ORDER BY month_key ASC;

-- Helper RPC for parameterized monthly query
CREATE OR REPLACE FUNCTION public.fn_get_monthly_totals(p_report_type text DEFAULT NULL)
RETURNS TABLE (
  month text,
  count int
) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    replace(month_key, '-', '/') AS month,
    entry_count AS count
  FROM public.monthly_totals
  WHERE (p_report_type IS NULL OR report_type = p_report_type)
  ORDER BY month_key DESC
  LIMIT 12;
$$;

