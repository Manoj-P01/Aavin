// ─────────────────────────────────────────────────────────────
// src/lib/export/excelStock.ts
// Excel builder for Milk & Cream Stock Statement (single & periodical)
// ─────────────────────────────────────────────────────────────

import XLSX from 'xlsx-js-style';
import { getSupabaseServiceClient } from '@/lib/supabase';
import type { StockRow } from '@/lib/types';
import { cell, val } from './excelStyles';

export interface MasterStockConfig {
  products: Array<{ key: string; label: string }>;
  receiptRows: Array<{ label: string; sort_order: number }>;
  disposalRows: Array<{ label: string; sort_order: number }>;
}

export async function fetchMasterStockConfig(): Promise<MasterStockConfig> {
  let products: Array<{ key: string; label: string }> = [];
  let receiptRows: Array<{ label: string; sort_order: number }> = [];
  let disposalRows: Array<{ label: string; sort_order: number }> = [];

  try {
    const supabase = getSupabaseServiceClient();
    const [prodRes, recRes, dispRes] = await Promise.all([
      supabase.from('products_master').select('id, product_key, product_name, short_name, sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('particulars_master').select('id, section_type, particular_name, code, sort_order').eq('section_type', 'RECEIPT').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('particulars_master').select('id, section_type, particular_name, code, sort_order').eq('section_type', 'DISPOSAL').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);

    if (prodRes.data && prodRes.data.length > 0) {
      products = prodRes.data.map((p: any) => ({
        key: p.product_key,
        label: p.short_name || p.product_name || p.product_key,
      }));
    }
    if (recRes.data && recRes.data.length > 0) {
      receiptRows = recRes.data.map((r: any) => ({
        label: r.particular_name || r.code || '',
        sort_order: r.sort_order ?? 0,
      }));
    }
    if (dispRes.data && dispRes.data.length > 0) {
      disposalRows = dispRes.data.map((d: any) => ({
        label: d.particular_name || d.code || '',
        sort_order: d.sort_order ?? 0,
      }));
    }
  } catch (e) {
    console.error('Error fetching DB master stock config:', e);
  }

  return { products, receiptRows, disposalRows };
}

export function buildStockStatementSheet(
  stockRowsData: StockRow[],
  dateStr: string,
  entryNotes?: string,
  masterConfig?: MasterStockConfig
) {
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[\._\s]/g, '');

  const stockCols: Array<{ key: string; label: string }> = [];
  const seenNormKeys = new Set<string>();

  // Load product columns dynamically strictly from DB master config
  if (masterConfig && Array.isArray(masterConfig.products) && masterConfig.products.length > 0) {
    masterConfig.products.forEach(p => {
      const nKey = normalizeKey(p.key);
      if (!seenNormKeys.has(nKey)) {
        seenNormKeys.add(nKey);
        stockCols.push({ key: p.key, label: p.label });
      }
    });
  }

  const customValues: Record<string, Record<string, number>> = {};
  const summaryByType: Record<string, Record<string, number>> = {};

  if (entryNotes) {
    const parts = entryNotes.split('\n');
    parts.forEach(part => {
      if (part.includes('__METADATA__:')) {
        try {
          const meta = JSON.parse(part.split('__METADATA__:')[1]);
          if (meta.custom_columns) {
            meta.custom_columns.forEach((cc: any) => {
              const nKey = normalizeKey(cc.key);
              if (!seenNormKeys.has(nKey)) {
                seenNormKeys.add(nKey);
                stockCols.push({ key: cc.key, label: cc.short_name || cc.label || cc.key });
              }
            });
          }
          if (meta.custom_values) {
            Object.entries(meta.custom_values).forEach(([rLabel, cVals]: any) => {
              const normRLabel = normalizeKey(rLabel);
              if (!customValues[normRLabel]) customValues[normRLabel] = {};
              Object.entries(cVals).forEach(([cKey, v]: any) => {
                customValues[normRLabel][normalizeKey(cKey)] = parseFloat(v) || 0;
              });
            });
          }
        } catch {}
      }
      if (part.includes('__STOCK_SUMMARY__:')) {
        try {
          const summaries = JSON.parse(part.split('__STOCK_SUMMARY__:')[1]);
          if (Array.isArray(summaries)) {
            summaries.forEach((s: any) => {
              const sType = s.summary_type;
              if (!summaryByType[sType]) summaryByType[sType] = {};
              if (s.summary_data && typeof s.summary_data === 'object') {
                Object.entries(s.summary_data).forEach(([k, v]: any) => {
                  summaryByType[sType][normalizeKey(k)] = Number(v) || 0;
                });
              }
            });
          }
        } catch {}
      }
    });
  }

  // Include any extra columns present in the entry's stockRowsData from DB only as a fallback
  if (stockCols.length === 0) {
    stockRowsData.forEach((r: any) => {
      Object.keys(r).forEach(k => {
        if (!['id', 'entry_id', 'row_type', 'row_label', 'sort_order', 'created_by', 'updated_by', 'created_at', 'updated_at'].includes(k)) {
          const nKey = normalizeKey(k);
          if (!seenNormKeys.has(nKey)) {
            seenNormKeys.add(nKey);
            stockCols.push({ key: k, label: k.toUpperCase().replace(/_/g, '.') });
          }
        }
      });
    });
  }

  const getCellVal = (r: StockRow, colKey: string): number => {
    const targetNorm = normalizeKey(colKey);

    // 1. Check direct key
    if (colKey in r || (r as any)[colKey] !== undefined) {
      const v = Number((r as any)[colKey]);
      if (!isNaN(v) && v !== 0) return v;
    }

    // 2. Check underscores / dots
    const normKey = colKey.replace(/\./g, '_');
    const dotKey = colKey.replace(/_/g, '.');
    if (normKey in r) {
      const v = Number((r as any)[normKey]);
      if (!isNaN(v) && v !== 0) return v;
    }
    if (dotKey in r) {
      const v = Number((r as any)[dotKey]);
      if (!isNaN(v) && v !== 0) return v;
    }

    // 3. Normalized case-insensitive lookup across row object keys
    for (const k of Object.keys(r)) {
      if (normalizeKey(k) === targetNorm) {
        const v = Number((r as any)[k]);
        if (!isNaN(v) && v !== 0) return v;
      }
    }

    // 4. Custom values metadata fallback
    const rLabelNorm = normalizeKey(r.row_label || '');
    if (customValues[rLabelNorm] && customValues[rLabelNorm][targetNorm] !== undefined) {
      return customValues[rLabelNorm][targetNorm];
    }
    for (const [savedLabel, vals] of Object.entries(customValues)) {
      if (savedLabel === rLabelNorm) {
        if (vals[targetNorm] !== undefined) return vals[targetNorm];
      }
    }

    // 5. Fallback from summaryByType for OB or single receipt row
    if (r.row_type === 'OB' && summaryByType['OB'] && summaryByType['OB'][targetNorm] !== undefined) {
      return summaryByType['OB'][targetNorm];
    }
    if (r.row_type === 'RECEIPT' && (rLabelNorm === 'receipts' || stockRowsData.filter(x => x.row_type === 'RECEIPT').length === 1)) {
      if (summaryByType['TOTAL_RECEIPT'] && summaryByType['TOTAL_RECEIPT'][targetNorm] !== undefined) {
        return summaryByType['TOTAL_RECEIPT'][targetNorm];
      }
    }

    return 0;
  };

  const getSum = (rowType: 'OB' | 'RECEIPT' | 'DISPOSAL', colKey: string): number => {
    const targetNorm = normalizeKey(colKey);
    const sum = stockRowsData
      .filter(r => r.row_type === rowType)
      .reduce((acc, r) => acc + getCellVal(r, colKey), 0);

    if (sum !== 0) return sum;

    if (rowType === 'OB' && summaryByType['OB'] && summaryByType['OB'][targetNorm] !== undefined) {
      return summaryByType['OB'][targetNorm];
    }
    if (rowType === 'RECEIPT' && summaryByType['TOTAL_RECEIPT'] && summaryByType['TOTAL_RECEIPT'][targetNorm] !== undefined) {
      return summaryByType['TOTAL_RECEIPT'][targetNorm];
    }
    if (rowType === 'DISPOSAL' && summaryByType['TOTAL_DISPOSAL'] && summaryByType['TOTAL_DISPOSAL'][targetNorm] !== undefined) {
      return summaryByType['TOTAL_DISPOSAL'][targetNorm];
    }

    return 0;
  };

  let dateDisplay = dateStr;
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) dateDisplay = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const sheetData: any[][] = [];
  const merges: XLSX.Range[] = [];

  // Row 1 Title
  sheetData.push([
    cell('NKL-MILK AND CREAM STOCK STATEMENT', { isBold: true, noBorder: true }),
    ...new Array(Math.max(0, stockCols.length - 1)).fill(cell('', { noBorder: true })),
    cell(`DATE: ${dateDisplay}`, { isBold: true, noBorder: true, alignment: 'right' })
  ]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: stockCols.length - 1 } });

  // Row 2 Headers
  sheetData.push([
    cell('Particulars', { isHeader: true }),
    ...stockCols.map(c => cell(c.label, { isHeader: true }))
  ]);

  // Row 3 Opening Balance
  const obVals = stockCols.map(c => getSum('OB', c.key));
  sheetData.push([
    cell('OPENING BALANCE', { isBold: true }),
    ...obVals.map(v => cell(val(v), { isBold: true, isNum: true }))
  ]);

  // Receipts
  const recHeaderIdx = sheetData.length;
  sheetData.push([
    cell('Receipts:', { isBold: true }),
    ...new Array(stockCols.length).fill(cell('', { noBorder: true }))
  ]);
  merges.push({ s: { r: recHeaderIdx, c: 0 }, e: { r: recHeaderIdx, c: stockCols.length } });

  const entryReceipts = [...stockRowsData]
    .filter(r => r.row_type === 'RECEIPT')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  entryReceipts.forEach(r => {
    const rVals = stockCols.map(c => getCellVal(r, c.key));
    sheetData.push([
      cell(r.row_label),
      ...rVals.map(v => cell(val(v), { isNum: true }))
    ]);
  });

  const recTotalVals = stockCols.map((c, i) => obVals[i] + getSum('RECEIPT', c.key));
  sheetData.push([
    cell('TOTAL', { isBold: true }),
    ...recTotalVals.map(v => cell(val(v), { isBold: true, isNum: true }))
  ]);

  // Disposals
  const dispHeaderIdx = sheetData.length;
  sheetData.push([
    cell('Disposals:', { isBold: true }),
    ...new Array(stockCols.length).fill(cell('', { noBorder: true }))
  ]);
  merges.push({ s: { r: dispHeaderIdx, c: 0 }, e: { r: dispHeaderIdx, c: stockCols.length } });

  const entryDisposals = [...stockRowsData]
    .filter(r => r.row_type === 'DISPOSAL')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  entryDisposals.forEach(r => {
    const rVals = stockCols.map(c => getCellVal(r, c.key));
    sheetData.push([
      cell(r.row_label),
      ...rVals.map(v => cell(val(v), { isNum: true }))
    ]);
  });

  const dispTotalVals = stockCols.map(c => getSum('DISPOSAL', c.key));
  sheetData.push([
    cell('TOTAL', { isBold: true }),
    ...dispTotalVals.map(v => cell(val(v), { isBold: true, isNum: true }))
  ]);

  // Closing Balance (Receipts Total - Disposals Total)
  const cbVals = stockCols.map((c, i) => {
    const calc = recTotalVals[i] - dispTotalVals[i];
    if (calc !== 0) return calc;
    const targetNorm = normalizeKey(c.key);
    if (summaryByType['CB'] && summaryByType['CB'][targetNorm] !== undefined) {
      return summaryByType['CB'][targetNorm];
    }
    return 0;
  });
  sheetData.push([
    cell('Closing Balance', { isBold: true }),
    ...cbVals.map(v => cell(val(v), { isBold: true, isNum: true }))
  ]);

  // Physical & Difference if available
  const physicalRow = stockRowsData.find(r => (r as any).row_type === 'PHYSICAL' || r.row_label?.toLowerCase() === 'physical');
  if (physicalRow) {
    const physVals = stockCols.map(c => getCellVal(physicalRow, c.key));
    sheetData.push([
      cell('physical'),
      ...physVals.map(v => cell(val(v), { isNum: true }))
    ]);

    const diffVals = stockCols.map((c, i) => physVals[i] - cbVals[i]);
    sheetData.push([
      cell('difference', { isBold: true }),
      ...diffVals.map(v => cell(val(v), { isBold: true, isNum: true }))
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [{ wch: 24 }, ...new Array(stockCols.length).fill({ wch: 12 })];
  ws['!merges'] = merges;

  return ws;
}

export async function getStockEntriesForPeriod(startDate: string, endDate: string) {
  const supabase = getSupabaseServiceClient();
  const { data: entries, error } = await supabase
    .from('entries')
    .select('id, report_type, entry_date, shift, notes, status')
    .eq('report_type', 'STOCK')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true });

  if (error || !entries) return [];

  const entryIds = entries.map((e: any) => e.id);
  if (entryIds.length === 0) return [];

  const { data: allRows } = await supabase
    .from('stock_rows')
    .select('id, entry_id, row_type, row_label, entry_json, sort_order')
    .in('entry_id', entryIds)
    .order('sort_order', { ascending: true });

  const rowsByEntryId: Record<string, StockRow[]> = {};
  (allRows || []).forEach((r: any) => {
    if (!rowsByEntryId[r.entry_id]) rowsByEntryId[r.entry_id] = [];
    const entryJson = typeof r.entry_json === 'string' ? JSON.parse(r.entry_json) : (r.entry_json || {});
    if (Array.isArray(entryJson.rows) && entryJson.rows.length > 0) {
      entryJson.rows.forEach((inner: any, iIdx: number) => {
        rowsByEntryId[r.entry_id].push({
          id: `${r.id}_${iIdx}`,
          entry_id: r.entry_id,
          row_type: inner.row_type || r.row_type,
          row_label: inner.row_label || r.row_label,
          values: inner.values || {},
          sort_order: inner.sort_order ?? (r.sort_order * 100 + iIdx),
          ...(inner.values || {}),
        } as any);
      });
    } else {
      rowsByEntryId[r.entry_id].push(r);
    }
  });

  return entries.map((entry: any) => ({
    entry,
    stockRows: rowsByEntryId[entry.id] || [],
  }));
}

