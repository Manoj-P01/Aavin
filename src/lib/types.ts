// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – TypeScript Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type ReportType = 'TS' | 'STOCK' | 'STG' | 'INTERNAL_STOCK_MAPPING' | 'STOCK_MAPPING';
export type Shift = 'D' | 'N' | 'F';

export type TSSection =
  | 'OB'
  | 'RECEIPT'
  | 'DISPOSAL_DESPATCH'
  | 'LOCAL_SALE'
  | 'OTHER_DISPOSAL'
  | 'CB';

export type STGProductBlock = string;
export type STGSide = 'RECEIPT' | 'DISPOSAL';

export type StockRowType = 'OB' | 'RECEIPT' | 'DISPOSAL';

// ─── Database Row Types ────────────────────────────────────────────────────────

export interface Entry {
  id: string;
  entry_date: string;    // ISO date: YYYY-MM-DD
  shift: Shift | null;
  report_type: ReportType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TSMilkRow {
  id: string;
  entry_id: string;
  section: TSSection;
  product: string;
  qty_lts: number;
  qty_kg: number;
  fat_pct: number;
  snf_pct: number;
  sp_gr: number;
  kg_fat: number;
  kg_snf: number;
  remarks?: string;
  sort_order: number;
}

export interface STGRow {
  id: string;
  entry_id: string;
  product_block: STGProductBlock;
  side: STGSide;
  item_name: string;
  qty_lts: number;
  qty_kg: number;
  fat_pct: number;
  snf_pct: number;
  sp_gr: number;
  kg_fat: number;
  kg_snf: number;
  sort_order: number;
}

export interface StockRow {
  id: string;
  entry_id: string;
  row_type: StockRowType;
  row_label: string;
  wh_milk: number;
  dlt_milk: number;
  fc_milk: number;
  std_milk: number;
  toned_curd: number;
  dtm: number;
  skim_milk: number;
  cream: number;
  butter_milk: number;
  r_con: number;
  smp: number;
  water: number;
  sort_order: number;
}

export interface SeparationDetails {
  id: string;
  entry_id: string;
  wm_fat_pct: number;
  wm_snf_pct: number;
  cream_lts: number;
  cream_fat_pct: number;
  cream_snf_pct: number;
  ssm_lts: number;
  ssm_fat_pct: number;
  ssm_snf_pct: number;
}

export type StockSummaryRowType = 'OB' | 'TOTAL_RECEIPT' | 'TOTAL_DISPOSAL' | 'CB';

export interface StockSummaryRow {
  id?: string;
  entry_id: string;
  summary_type: StockSummaryRowType;
  row_label: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// ─── Aggregated / Computed Types ────────────────────────────────────────────────

export interface TSTotals {
  grand_total_arrival_lts: number;
  grand_total_arrival_kg: number;
  grand_total_arrival_kg_fat: number;
  grand_total_arrival_kg_snf: number;
  grand_total_disposal_lts: number;
  grand_total_disposal_kg: number;
  grand_total_disposal_kg_fat: number;
  grand_total_disposal_kg_snf: number;
  loss_kg_fat: number;
  loss_kg_snf: number;
  loss_pct_fat: number;
  loss_pct_snf: number;
  cmpdd_norm_pct: number;  // always 0.5
}

export interface STGProductTotals {
  product: STGProductBlock;
  receipt_kg_fat: number;
  receipt_kg_snf: number;
  disposal_kg_fat: number;
  disposal_kg_snf: number;
  ob_kg_fat: number;
  ob_kg_snf: number;
  loss_gain_kg_fat: number;
  loss_gain_kg_snf: number;
  loss_gain_pct_fat: number;
  loss_gain_pct_snf: number;
}

export interface StockColumns {
  wh_milk: number;
  dlt_milk: number;
  fc_milk: number;
  std_milk: number;
  toned_curd: number;
  dtm: number;
  skim_milk: number;
  cream: number;
  butter_milk: number;
  r_con: number;
  smp: number;
  water: number;
}

export interface StockSummary {
  opening_balance: StockColumns;
  total_receipts: StockColumns;
  total_disposals: StockColumns;
  closing_balance: StockColumns;  // OB + Receipts - Disposals
}

// ─── Form Input Types ────────────────────────────────────────────────────────────

export interface TSMilkRowInput {
  product: string;
  qty_lts: number | string;
  qty_kg: number | string;
  fat_pct: number | string;
  snf_pct: number | string;
  sp_gr: number | string;
  kg_fat?: number | string;
  kg_snf?: number | string;
  remarks?: string;
}

export interface StockRowInput {
  row_label: string;
  wh_milk: number | string;
  dlt_milk: number | string;
  fc_milk: number | string;
  std_milk: number | string;
  toned_curd: number | string;
  dtm: number | string;
  skim_milk: number | string;
  cream: number | string;
  butter_milk: number | string;
  r_con: number | string;
  smp: number | string;
  water: number | string;
}

// ─── API Response Types ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface EntryWithData extends Entry {
  ts_milk_rows?: TSMilkRow[];
  stg_rows?: STGRow[];
  stock_rows?: StockRow[];
  stock_summary_rows?: StockSummaryRow[];
  separation_details?: SeparationDetails;
}

// ─── Dashboard Summary ─────────────────────────────────────────────────────────

export interface DashboardStats {
  total_ts_entries: number;
  total_stock_entries: number;
  latest_ts_date: string | null;
  latest_stock_date: string | null;
  current_month_ts_count: number;
  current_month_stock_count: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const CMPDD_NORM_PCT = 0.5;

export const TS_OB_PRODUCTS: string[] = [];
export const TS_RECEIPT_PRODUCTS: string[] = [];
export const TS_DESPATCH_PRODUCTS: string[] = [];
export const TS_LOCAL_SALE_PRODUCTS: string[] = [];
export const TS_OTHER_DISPOSAL_PRODUCTS: string[] = [];

export const STOCK_RECEIPT_LABELS: string[] = [];
export const STOCK_DISPOSAL_LABELS: string[] = [];

export const STOCK_PRODUCT_COLUMNS: { key: keyof StockColumns; label: string; full_name: string; short_name: string }[] = [];

