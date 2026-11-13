// ─────────────────────────────────────────────────────────────
// src/lib/stockDefaults.ts
// Standard Master Stock Statement Structure
// All columns and rows are created dynamically by the user via UI
// ─────────────────────────────────────────────────────────────

export interface DefaultStockProduct {
  key: string;
  label: string;
  full_name: string;
  short_name: string;
  category: string;
  sort_order: number;
}

export const DEFAULT_STOCK_PRODUCTS: DefaultStockProduct[] = [];

export const DEFAULT_STOCK_RECEIPT_ROWS: string[] = [];

export const DEFAULT_STOCK_DISPOSAL_ROWS: string[] = [];

export const DEFAULT_STOCK_TEMPLATE = {
  rows: [],
  product_columns: [] as DefaultStockProduct[],
  summary_formulas: {
    total_receipts: {},
    total_available: {},
    total_disposals: {},
    closing_balance: {},
  },
};
