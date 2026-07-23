// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Core Calculations
// Mirrors exact Excel formulas from 01-06-2026-TS.xlsx and JUNE26.xlsx
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TSMilkRow, STGRow, StockRow,
  TSTotals, STGProductTotals, StockSummary,
  StockColumns, TSSection,
} from './types';
import { STOCK_PRODUCT_COLUMNS } from './types';
import { CALC_CONFIG } from './config';

// ─── Helper ───────────────────────────────────────────────────────────────────

export function round(val: number, decimals = 3): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

// ─── Per-row calculations ─────────────────────────────────────────────────────

/** Calculate Kg Fat and Kg SNF from Qty(Kg), Fat%, SNF% */
export function calcKgFatSnf(qty_kg: number, fat_pct: number, snf_pct: number, config = CALC_CONFIG) {
  return {
    kg_fat: round((qty_kg * fat_pct) / config.KG_FAT.DIVISOR, config.KG_FAT.TS_DECIMALS),
    kg_snf: round((qty_kg * snf_pct) / config.KG_SNF.DIVISOR, config.KG_SNF.TS_DECIMALS),
  };
}

/** Calculate Qty(Kg) from Qty(Lts) and Specific Gravity */
export function calcQtyKg(qty_lts: number, sp_gr: number, config = CALC_CONFIG): number {
  return round(qty_lts * sp_gr, config.TS_REPORT.QTY_KG_DECIMALS);
}

// ─── TS Report Totals ─────────────────────────────────────────────────────────

const ARRIVAL_SECTIONS: TSSection[] = ['OB', 'RECEIPT'];
const DISPOSAL_SECTIONS: TSSection[] = ['DISPOSAL_DESPATCH', 'LOCAL_SALE', 'OTHER_DISPOSAL', 'CB'];

export function getStatementShortName(stmt: { key: string; label: string }): string {
  if (stmt.key === 'WM') return 'WM';
  if (stmt.key === 'SSM') return 'SSM';
  if (stmt.key === 'CREAM') return 'CREAM';
  return stmt.label.toUpperCase();
}

export function generateDynamicBalanceRows(
  stgRows: any[],
  entryNotes: string | null,
  globalStatements: Array<{ key: string; label: string }> = []
) {
  let customStatements: Array<{ key: string; label: string }> = [];
  if (entryNotes) {
    const parts = entryNotes.split('\n');
    for (const part of parts) {
      if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
        const [, metaJson] = part.split('__METADATA__:');
        try {
          const meta = JSON.parse(metaJson);
          if (meta.custom_statements) {
            customStatements = meta.custom_statements;
          }
        } catch {}
      }
    }
  }

  const stmtMap = new Map<string, { key: string; label: string }>();
  globalStatements.forEach(s => stmtMap.set(s.key, s));
  customStatements.forEach(s => stmtMap.set(s.key, s));
  
  if (stmtMap.size === 0) {
    stmtMap.set('WM', { key: 'WM', label: 'TENTATIVE WHOLE MILK' });
    stmtMap.set('SSM', { key: 'SSM', label: 'SKIMMED MILK' });
    stmtMap.set('CREAM', { key: 'CREAM', label: 'CREAM' });
  }

  const statements = Array.from(stmtMap.values());
  const obRows: any[] = [];
  const cbRows: any[] = [];

  statements.forEach(stmt => {
    const shortName = getStatementShortName(stmt);
    const stgOb = stgRows.find(r => r.product_block === stmt.key && r.item_name === 'OB');
    const stgCb = stgRows.find(r => r.product_block === stmt.key && r.item_name === 'CB');

    obRows.push({
      id: stgOb?.id || `dynamic-ob-${stmt.key}`,
      section: 'OB',
      product: shortName,
      qty_lts: stgOb?.qty_lts ?? 0,
      qty_kg: stgOb?.qty_kg ?? 0,
      fat_pct: stgOb?.fat_pct ?? 0,
      snf_pct: stgOb?.snf_pct ?? 0,
      sp_gr: stgOb?.sp_gr ?? 0,
      kg_fat: stgOb?.kg_fat ?? 0,
      kg_snf: stgOb?.kg_snf ?? 0,
      remarks: '',
      sort_order: 0,
    });

    cbRows.push({
      id: stgCb?.id || `dynamic-cb-${stmt.key}`,
      section: 'CB',
      product: shortName,
      qty_lts: stgCb?.qty_lts ?? 0,
      qty_kg: stgCb?.qty_kg ?? 0,
      fat_pct: stgCb?.fat_pct ?? 0,
      snf_pct: stgCb?.snf_pct ?? 0,
      sp_gr: stgCb?.sp_gr ?? 0,
      kg_fat: stgCb?.kg_fat ?? 0,
      kg_snf: stgCb?.kg_snf ?? 0,
      remarks: '',
      sort_order: 0,
    });
  });

  return { obRows, cbRows };
}

export function calcTSTotals(rows: TSMilkRow[], config = CALC_CONFIG): TSTotals {
  const sum = (sections: TSSection[], field: keyof TSMilkRow) =>
    rows
      .filter(r => sections.includes(r.section))
      .reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

  const arrival_lts   = sum(ARRIVAL_SECTIONS, 'qty_lts');
  const arrival_kg    = sum(ARRIVAL_SECTIONS, 'qty_kg');
  const arrival_fat   = sum(ARRIVAL_SECTIONS, 'kg_fat');
  const arrival_snf   = sum(ARRIVAL_SECTIONS, 'kg_snf');

  const disposal_lts  = sum(DISPOSAL_SECTIONS, 'qty_lts');
  const disposal_kg   = sum(DISPOSAL_SECTIONS, 'qty_kg');
  const disposal_fat  = sum(DISPOSAL_SECTIONS, 'kg_fat');
  const disposal_snf  = sum(DISPOSAL_SECTIONS, 'kg_snf');

  const loss_fat  = round(arrival_fat - disposal_fat, config.KG_FAT.TS_DECIMALS);
  const loss_snf  = round(arrival_snf - disposal_snf, config.KG_SNF.TS_DECIMALS);

  return {
    grand_total_arrival_lts:     round(arrival_lts, config.TS_REPORT.QTY_LTS_DECIMALS),
    grand_total_arrival_kg:      round(arrival_kg, config.TS_REPORT.QTY_KG_DECIMALS),
    grand_total_arrival_kg_fat:  round(arrival_fat, config.KG_FAT.TS_DECIMALS),
    grand_total_arrival_kg_snf:  round(arrival_snf, config.KG_SNF.TS_DECIMALS),
    grand_total_disposal_lts:    round(disposal_lts, config.TS_REPORT.QTY_LTS_DECIMALS),
    grand_total_disposal_kg:     round(disposal_kg, config.TS_REPORT.QTY_KG_DECIMALS),
    grand_total_disposal_kg_fat: round(disposal_fat, config.KG_FAT.TS_DECIMALS),
    grand_total_disposal_kg_snf: round(disposal_snf, config.KG_SNF.TS_DECIMALS),
    loss_kg_fat:                 loss_fat,
    loss_kg_snf:                 loss_snf,
    loss_pct_fat:                round(safeDivide(loss_fat, arrival_fat) * 100, config.TS_REPORT.LOSS_PERCENTAGE_DECIMALS),
    loss_pct_snf:                round(safeDivide(loss_snf, arrival_snf) * 100, config.TS_REPORT.LOSS_PERCENTAGE_DECIMALS),
    cmpdd_norm_pct:              config.TS_REPORT.CMPDD_NORM_PCT,
  };
}

// ─── STG Report Totals per product ───────────────────────────────────────────

export function calcSTGProductTotals(
  rows: STGRow[],
  product: STGRow['product_block'],
  config = CALC_CONFIG
): STGProductTotals {
  const productRows = rows.filter(r => r.product_block === product);
  const receipts    = productRows.filter(r => r.side === 'RECEIPT');
  const disposals   = productRows.filter(r => r.side === 'DISPOSAL');

  const sum = (arr: STGRow[], field: keyof STGRow) =>
    arr.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

  const r_fat = sum(receipts, 'kg_fat');
  const r_snf = sum(receipts, 'kg_snf');
  const d_fat = sum(disposals, 'kg_fat');
  const d_snf = sum(disposals, 'kg_snf');

  // OB is a special receipt row labelled 'OB'
  const ob_fat = receipts.find(r => r.item_name === 'OB')?.kg_fat ?? 0;
  const ob_snf = receipts.find(r => r.item_name === 'OB')?.kg_snf ?? 0;

  const grand_arrival_fat = r_fat;
  const grand_arrival_snf = r_snf;

  const lg_fat = round(grand_arrival_fat - d_fat, config.KG_FAT.TS_DECIMALS);
  const lg_snf = round(grand_arrival_snf - d_snf, config.KG_SNF.TS_DECIMALS);

  return {
    product,
    receipt_kg_fat:    round(r_fat, config.KG_FAT.TS_DECIMALS),
    receipt_kg_snf:    round(r_snf, config.KG_SNF.TS_DECIMALS),
    disposal_kg_fat:   round(d_fat, config.KG_FAT.TS_DECIMALS),
    disposal_kg_snf:   round(d_snf, config.KG_SNF.TS_DECIMALS),
    ob_kg_fat:         round(ob_fat, config.KG_FAT.TS_DECIMALS),
    ob_kg_snf:         round(ob_snf, config.KG_SNF.TS_DECIMALS),
    loss_gain_kg_fat:  lg_fat,
    loss_gain_kg_snf:  lg_snf,
    loss_gain_pct_fat: round(safeDivide(lg_fat, grand_arrival_fat) * 100, config.TS_REPORT.LOSS_PERCENTAGE_DECIMALS),
    loss_gain_pct_snf: round(safeDivide(lg_snf, grand_arrival_snf) * 100, config.TS_REPORT.LOSS_PERCENTAGE_DECIMALS),
  };
}

// ─── Stock Statement Summary ──────────────────────────────────────────────────

function zeroColumns(): StockColumns {
  return {
    wh_milk: 0, dlt_milk: 0, fc_milk: 0, std_milk: 0,
    toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0,
    butter_milk: 0, r_con: 0, smp: 0, water: 0,
  };
}

function addColumns(a: StockColumns, b: Partial<StockColumns>): StockColumns {
  const result = { ...a } as any;
  const bAny = b as any;
  const keys = new Set([...Object.keys(result), ...Object.keys(bAny)]);
  for (const key of keys) {
    result[key] = (Number(result[key]) || 0) + (Number(bAny[key]) || 0);
  }
  return result;
}

function subtractColumns(a: StockColumns, b: StockColumns): StockColumns {
  const result = { ...a } as any;
  const bAny = b as any;
  const keys = new Set([...Object.keys(result), ...Object.keys(bAny)]);
  for (const key of keys) {
    result[key] = (Number(result[key]) || 0) - (Number(bAny[key]) || 0);
  }
  return result;
}

export function calcStockSummary(rows: StockRow[]): StockSummary {
  const obRows       = rows.filter(r => r.row_type === 'OB');
  const receiptRows  = rows.filter(r => r.row_type === 'RECEIPT');
  const disposalRows = rows.filter(r => r.row_type === 'DISPOSAL');

  const sumRows = (arr: StockRow[]) =>
    arr.reduce((acc, r) => addColumns(acc, r as unknown as Partial<StockColumns>), zeroColumns());

  const ob       = sumRows(obRows);
  const receipts = sumRows(receiptRows);
  const disposals = sumRows(disposalRows);

  // Closing Balance = OB + Total Receipts - Total Disposals
  const closing = subtractColumns(addColumns(ob, receipts), disposals);

  return {
    opening_balance: ob,
    total_receipts:  receipts,
    total_disposals: disposals,
    closing_balance: closing,
  };
}

// ─── Stock: Combine two shifts into whole-day ────────────────────────────────

export function combineShiftSummaries(day: StockSummary, night: StockSummary): StockSummary {
  return {
    opening_balance: day.opening_balance,  // Day shift OB is start of day
    total_receipts:  addColumns(day.total_receipts, night.total_receipts),
    total_disposals: addColumns(day.total_disposals, night.total_disposals),
    closing_balance: night.closing_balance, // Night shift CB is end of day
  };
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export function fmtNum(val: number | null | undefined, decimals = 3): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  // If the number is an integer, do not display decimals
  if (val % 1 === 0) {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  // Otherwise format with decimals up to the specified maximum limit
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(val: number | null | undefined, decimals = 4): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return val.toFixed(decimals) + '%';
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
