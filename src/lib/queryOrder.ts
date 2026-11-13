// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Standard Date-First Query Ordering Helper
// Ensures all list queries on entries, reconciliation entries, and preparation charts
// consistently sort by entry_date DESC, report_type / statement_key ASC, and shift ASC.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard date-first ordering for Supabase PostgREST query builders.
 * Sorts primarily by entry_date DESC, then secondary key, then shift ASC.
 */
export function orderByDate<T extends { order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => any }>(
  query: T,
  secondaryKey: string = 'report_type'
): T {
  return query
    .order('entry_date', { ascending: false })
    .order(secondaryKey, { ascending: true })
    .order('shift', { ascending: true });
}

/**
 * Standard date-first ordering specifically for entries queries.
 */
export function orderEntriesByDate<T extends { order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => any }>(
  query: T
): T {
  return query
    .order('entry_date', { ascending: false })
    .order('report_type', { ascending: true })
    .order('shift', { ascending: true });
}

/**
 * Standard date-first ordering specifically for preparation charts entries.
 */
export function orderPrepChartsByDate<T extends { order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => any }>(
  query: T
): T {
  return query
    .order('entry_date', { ascending: false })
    .order('chart_key', { ascending: true })
    .order('shift', { ascending: true });
}

/**
 * Standard date-first ordering specifically for STG reconciliation entries.
 */
export function orderReconByDate<T extends { order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => any }>(
  query: T
): T {
  return query
    .order('entry_date', { ascending: false })
    .order('statement_key', { ascending: true })
    .order('shift', { ascending: true });
}

