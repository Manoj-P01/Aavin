import { NextRequest, NextResponse } from 'next/server';
import XLSX from 'xlsx-js-style';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { generateDynamicBalanceRows, calcTSTotals } from '@/lib/calculations';
import type { Shift, TSMilkRow, STGRow, StockRow } from '@/lib/types';

// Helper to create styled cell objects
function cell(value: any, opts?: { isHeader?: boolean; isBold?: boolean; isNum?: boolean; isTitle?: boolean; alignment?: string; noBorder?: boolean; noColor?: boolean }) {
  const isHeader = opts?.isHeader ?? false;
  const isBold = opts?.isBold ?? false;
  const isNum = opts?.isNum ?? false;
  const isTitle = opts?.isTitle ?? false;
  const noBorder = opts?.noBorder ?? false;
  const noColor = opts?.noColor ?? false;

  let type = 's';
  if (typeof value === 'number') {
    type = 'n';
  } else if (typeof value === 'boolean') {
    type = 'b';
  }

  const style: any = {
    font: {
      name: 'Calibri',
      sz: isTitle ? 11 : 10,
      bold: isHeader || isBold || isTitle,
    },
    alignment: {
      vertical: 'center',
      horizontal: opts?.alignment || (isNum ? 'right' : (isHeader || isTitle ? 'center' : 'left')),
    }
  };

  if (!noBorder) {
    style.border = {
      top: { style: 'thin', color: { rgb: 'A0A0A0' } },
      bottom: { style: 'thin', color: { rgb: 'A0A0A0' } },
      left: { style: 'thin', color: { rgb: 'A0A0A0' } },
      right: { style: 'thin', color: { rgb: 'A0A0A0' } }
    };
  }

  if (!noColor) {
    if (isTitle) {
      style.fill = { fgColor: { rgb: 'F1F5F9' } };
    } else if (isHeader) {
      style.fill = { fgColor: { rgb: 'E2E8F0' } };
    }
  }

  return { v: value === null || value === undefined ? '' : value, t: type, s: style };
}

const val = (v: number | null | undefined, decimals = 3) => {
  if (v === null || v === undefined || isNaN(v)) return 0;
  return Number(v.toFixed(decimals));
};

async function fetchMasterStockConfig() {
  let products: Array<{ key: string; label: string }> = [];
  let receiptRows: Array<{ label: string; sort_order: number }> = [];
  let disposalRows: Array<{ label: string; sort_order: number }> = [];

  try {
    const supabase = getSupabaseServiceClient();
    const [prodRes, recRes, dispRes] = await Promise.all([
      supabase.from('products_master').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('particulars_master').select('*').eq('section_type', 'RECEIPT').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('particulars_master').select('*').eq('section_type', 'DISPOSAL').eq('is_active', true).order('sort_order', { ascending: true }),
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

function buildStockStatementSheet(
  stockRowsData: StockRow[],
  dateStr: string,
  entryNotes?: string,
  masterConfig?: {
    products: Array<{ key: string; label: string }>;
    receiptRows: Array<{ label: string; sort_order: number }>;
    disposalRows: Array<{ label: string; sort_order: number }>;
  }
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

  // Include any extra columns present in the entry's stockRowsData from DB only as a fallback if no master config or metadata columns exist
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

  // Dynamically collect Receipt rows from entry data sorted by sort_order
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

  // Dynamically collect Disposal rows from entry data sorted by sort_order
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

  // Closing Balance (Receipts Total which is OB + Receipts, minus Disposals Total)
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

async function getStockEntriesForPeriod(startDate: string, endDate: string) {
  const supabase = getSupabaseServiceClient();
  const { data: entries, error } = await supabase
    .from('entries')
    .select('*')
    .eq('report_type', 'STOCK')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true });

  if (error || !entries) return [];

  const entryIds = entries.map((e: any) => e.id);
  if (entryIds.length === 0) return [];

  const { data: allRows } = await supabase
    .from('stock_rows')
    .select('*')
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate') || searchParams.get('from');
    const endDate = searchParams.get('endDate') || searchParams.get('to');
    const multiSheet = searchParams.get('multi_sheet') === 'true' || searchParams.get('periodical') === 'true';

    const masterConfig = await fetchMasterStockConfig();

    // Handle Periodical Multi-Sheet Stock Statement Export for date ranges
    if ((startDate && endDate) || (multiSheet && (startDate || date))) {
      const sDate = startDate || date || '';
      const eDate = endDate || startDate || date || '';
      const entriesWithRows = await getStockEntriesForPeriod(sDate, eDate);

      if (!entriesWithRows || entriesWithRows.length === 0) {
        return NextResponse.json({ error: 'No stock statement entries found for the selected period' }, { status: 404 });
      }

      const wb = XLSX.utils.book_new();
      entriesWithRows.forEach((item, idx) => {
        const sheetName = String(idx + 1); // Sheets '1', '2', '3'... matching JULY-26STMT-1.xlsx
        const ws = buildStockStatementSheet(item.stockRows, item.entry.entry_date, item.entry.notes, masterConfig);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      const sParts = sDate.split('-');
      const eParts = eDate.split('-');
      const formattedS = sParts.length === 3 ? `${sParts[2]}-${sParts[1]}-${sParts[0]}` : sDate;
      const formattedE = eParts.length === 3 ? `${eParts[2]}-${eParts[1]}-${eParts[0]}` : eDate;
      const fileName = `Stock-Statements-${formattedS}_to_${formattedE}.xlsx`;

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

    const rawShift = searchParams.get('shift');
    const shift = (rawShift === 'null' || !rawShift) ? null : rawShift as Shift;
    const includeStg = searchParams.get('stg') === 'true';
    const includeTs = searchParams.get('ts') === 'true';
    const includeStock = searchParams.get('stock') === 'true';

    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    let entryNotes = '';
    let stockEntryNotes = '';
    let stgRowsData: STGRow[] = [];
    let tsRowsData: TSMilkRow[] = [];
    let stockRowsData: StockRow[] = [];

    // 1. Fetch data from DB
    const supabase = getSupabaseServiceClient();

    // Fetch TS/STG entry data if requested
    if (includeTs || includeStg) {
      let query = supabase
        .from('entries')
        .select('id, notes')
        .eq('entry_date', date)
        .eq('report_type', 'TS');

      if (shift && shift !== 'F') {
        query = query.eq('shift', shift);
      }

      let { data: entries, error: entryErr } = await query;

      if ((entryErr || !entries || entries.length === 0) && shift && shift !== 'F') {
        const fallbackQuery = supabase
          .from('entries')
          .select('id, notes')
          .eq('entry_date', date)
          .eq('report_type', 'TS');
        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          entries = fallbackRes.data;
        }
      }

      if (entries && entries.length > 0) {
        const entryIds = entries.map((e: any) => e.id);
        entryNotes = entries.map((e: any) => e.notes).filter(Boolean).join('\n') || '';

        const [tsRows, stgRows] = await Promise.all([
          supabase
            .from('ts_milk_rows')
            .select('*')
            .in('entry_id', entryIds)
            .order('sort_order', { ascending: true }),
          supabase
            .from('stg_rows')
            .select('*')
            .in('entry_id', entryIds)
            .order('sort_order', { ascending: true }),
        ]);

        if (!tsRows.error) tsRowsData = tsRows.data as TSMilkRow[];
        if (!stgRows.error) stgRowsData = stgRows.data as STGRow[];
      }
    }

    // Fetch Stock entry data if requested or by default
    if (includeStock || (!includeTs && !includeStg)) {
      let stockQuery = supabase
        .from('entries')
        .select('id, notes')
        .eq('entry_date', date)
        .eq('report_type', 'STOCK');

      if (shift && shift !== 'F') {
        stockQuery = stockQuery.eq('shift', shift);
      }

      let { data: stockEntries } = await stockQuery;

      if ((!stockEntries || stockEntries.length === 0) && shift && shift !== 'F') {
        const fallbackQuery = supabase
          .from('entries')
          .select('id, notes')
          .eq('entry_date', date)
          .eq('report_type', 'STOCK');
        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          stockEntries = fallbackRes.data;
        }
      }

      if (stockEntries && stockEntries.length > 0) {
        const stockEntryIds = stockEntries.map((e: any) => e.id);
        stockEntryNotes = stockEntries.map((e: any) => e.notes).filter(Boolean).join('\n') || '';
        if (!entryNotes) entryNotes = stockEntryNotes;
        const stockRes = await supabase
          .from('stock_rows')
          .select('*')
          .in('entry_id', stockEntryIds)
          .order('sort_order', { ascending: true });
        if (stockRes.data) {
          const unpacked: any[] = [];
          stockRes.data.forEach((r: any) => {
            const entryJson = typeof r.entry_json === 'string' ? JSON.parse(r.entry_json) : (r.entry_json || {});
            if (Array.isArray(entryJson.rows) && entryJson.rows.length > 0) {
              entryJson.rows.forEach((inner: any, iIdx: number) => {
                unpacked.push({
                  id: `${r.id}_${iIdx}`,
                  entry_id: r.entry_id,
                  row_type: inner.row_type || r.row_type,
                  row_label: inner.row_label || r.row_label,
                  values: inner.values || {},
                  sort_order: inner.sort_order ?? (r.sort_order * 100 + iIdx),
                  ...(inner.values || {}),
                });
              });
            } else {
              unpacked.push(r);
            }
          });
          stockRowsData = unpacked as StockRow[];
        }
      }
    }

    if (tsRowsData.length === 0 && stgRowsData.length === 0 && stockRowsData.length === 0) {
      const formattedDateDisplay = date.split('-').reverse().join('-');
      return NextResponse.json({ error: `No saved stock statement or report data found for ${formattedDateDisplay}. Please save the entry first before exporting.` }, { status: 404 });
    }

    // Determine shift text
    const shiftText = shift ? (shift === 'D' ? 'Day Shift' : 'Night Shift') : 'Full Day';

    // 2. Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Set common column widths
    const colWidths = [
      { wch: 6 },  // S.No
      { wch: 24 }, // Name
      { wch: 14 }, // Lit
      { wch: 14 }, // Kg
      { wch: 11 }, // Fat
      { wch: 11 }, // SNF
      { wch: 11 }, // SpGr
      { wch: 13 }, // Kg Fat
      { wch: 13 }, // Kg SNF
      { wch: 6 },  // S.No
      { wch: 24 }, // Name
      { wch: 14 }, // Lit
      { wch: 14 }, // Kg
      { wch: 11 }, // Fat
      { wch: 11 }, // SNF
      { wch: 11 }, // SpGr
      { wch: 13 }, // Kg Fat
      { wch: 13 }  // Kg SNF
    ];

    // Format helper to format values as numbers/strings
    const val = (v: number | null | undefined, decimals = 3) => {
      if (v === null || v === undefined || isNaN(v)) return 0;
      return Number(v.toFixed(decimals));
    };

    // 3. Build TS Report Sheet
    if (includeTs && tsRowsData.length > 0) {
      // Get global statements config
      let gStmts: any[] = [];
      const supabase = getSupabaseServiceClient();
      const { data } = await supabase.from('entries').select('notes').eq('report_type', 'TS').order('entry_date', { ascending: false });
      if (data && data.length > 0) {
        const configRow = data.find((e: any) => {
          if (!e.notes || e.notes.includes('__METADATA__:')) return false;
          try {
            const parsed = JSON.parse(e.notes);
            return Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.key !== undefined);
          } catch { return false; }
        });
        if (configRow && configRow.notes) {
          try { gStmts = JSON.parse(configRow.notes) || []; } catch {}
        }
      }

      const { obRows, cbRows } = generateDynamicBalanceRows(tsRowsData, entryNotes, gStmts);
      const otherTsRows = tsRowsData.filter(r => r.section !== 'OB' && r.section !== 'CB');
      const rows = [...obRows, ...otherTsRows, ...cbRows];
      const totals = calcTSTotals(rows);

      // Group rows by section
      const rowsBySection: Record<string, TSMilkRow[]> = {
        OB: rows.filter(r => r.section === 'OB'),
        RECEIPT: rows.filter(r => r.section === 'RECEIPT'),
        DISPOSAL_DESPATCH: rows.filter(r => r.section === 'DISPOSAL_DESPATCH'),
        LOCAL_SALE: rows.filter(r => r.section === 'LOCAL_SALE'),
        OTHER_DISPOSAL: rows.filter(r => r.section === 'OTHER_DISPOSAL'),
        CB: rows.filter(r => r.section === 'CB'),
      };

      const getSectionTotal = (sRows: TSMilkRow[]) => ({
        qty_lts: sRows.reduce((a, r) => a + (r.qty_lts || 0), 0),
        qty_kg: sRows.reduce((a, r) => a + (r.qty_kg || 0), 0),
        kg_fat: sRows.reduce((a, r) => a + (r.kg_fat || 0), 0),
        kg_snf: sRows.reduce((a, r) => a + (r.kg_snf || 0), 0),
      });

      // Align columns side-by-side
      type AlignedRow = {
        left: { type: 'header'; label: string } | { type: 'total'; label: string; qty_lts: number; qty_kg: number; kg_fat: number; kg_snf: number } | { type: 'item'; index: number; data: TSMilkRow } | { type: 'empty' };
        right: { type: 'header'; label: string } | { type: 'total'; label: string; qty_lts: number; qty_kg: number; kg_fat: number; kg_snf: number } | { type: 'item'; index: number; data: TSMilkRow } | { type: 'empty' };
      };

      const leftList: AlignedRow['left'][] = [];
      const rightList: AlignedRow['right'][] = [];

      // Pop left
      if (rowsBySection.OB.length > 0) {
        leftList.push({ type: 'header', label: 'O/B' });
        rowsBySection.OB.forEach((r, i) => leftList.push({ type: 'item', index: i + 1, data: r }));
        leftList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.OB) });
      }
      if (rowsBySection.RECEIPT.length > 0) {
        leftList.push({ type: 'header', label: 'RECEIPTS' });
        rowsBySection.RECEIPT.forEach((r, i) => leftList.push({ type: 'item', index: i + 1, data: r }));
        leftList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.RECEIPT) });
      }

      // Pop right
      if (rowsBySection.DISPOSAL_DESPATCH.length > 0) {
        rightList.push({ type: 'header', label: 'DESPATCH/SALE' });
        rowsBySection.DISPOSAL_DESPATCH.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.DISPOSAL_DESPATCH) });
      }
      if (rowsBySection.LOCAL_SALE.length > 0) {
        rightList.push({ type: 'header', label: 'LOCAL SALES' });
        rowsBySection.LOCAL_SALE.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.LOCAL_SALE) });
      }
      if (rowsBySection.OTHER_DISPOSAL.length > 0) {
        rightList.push({ type: 'header', label: 'OTHER DISPOSAL' });
        rowsBySection.OTHER_DISPOSAL.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.OTHER_DISPOSAL) });
      }
      if (rowsBySection.CB.length > 0) {
        rightList.push({ type: 'header', label: 'C/B' });
        rowsBySection.CB.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.CB) });
      }

      const alignedRows: AlignedRow[] = [];
      const maxLen = Math.max(leftList.length, rightList.length);
      for (let i = 0; i < maxLen; i++) {
        alignedRows.push({
          left: leftList[i] || { type: 'empty' },
          right: rightList[i] || { type: 'empty' },
        });
      }

      // Build Sheet Data
      const tsData: any[][] = [
        [
          cell('NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS\' UNION LTD', { isBold: true, noBorder: true })
        ],
        [
          cell('                         TOTAL SOLIDS DETAILS ', { isBold: true, noBorder: true }),
          ...new Array(16).fill(cell('', { noBorder: true })),
          cell(new Date(date).toLocaleDateString('en-IN'), { isBold: true, noBorder: true, alignment: 'right' })
        ],
        [
          cell('S.no', { isHeader: true }), cell('Arrival', { isHeader: true }), cell('Milk (Lit)', { isHeader: true }), cell('Milk (Kg)', { isHeader: true }), cell('Avg Fat %', { isHeader: true }), cell('Avg SNF %', { isHeader: true }), cell('Sp. Gr', { isHeader: true }), cell('Kg Fat', { isHeader: true }), cell('Kg SNF', { isHeader: true }),
          cell('S.no', { isHeader: true }), cell('Disposal', { isHeader: true }), cell('Milk (Lit)', { isHeader: true }), cell('Milk (Kg)', { isHeader: true }), cell('Avg Fat %', { isHeader: true }), cell('Avg SNF %', { isHeader: true }), cell('Sp. Gr', { isHeader: true }), cell('Kg Fat', { isHeader: true }), cell('Kg SNF', { isHeader: true })
        ]
      ];

      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
      ];

      alignedRows.forEach((row, i) => {
        const rIndex = 3 + i;
        const rowVal: any[] = new Array(18).fill('');

        // Left side
        if (row.left.type === 'header') {
          // Label goes to column index 1 because the merge is from 1 to 8
          rowVal[0] = cell('');
          rowVal[1] = cell(row.left.label, { isBold: true });
          for (let c = 2; c < 9; c++) rowVal[c] = cell('');
          merges.push({ s: { r: rIndex, c: 1 }, e: { r: rIndex, c: 8 } });
        } else if (row.left.type === 'total') {
          // Merge is from 0 to 1, so the label MUST go into column index 0!
          rowVal[0] = cell(row.left.label, { isBold: true });
          rowVal[1] = cell('');
          rowVal[2] = cell(val(row.left.qty_lts), { isBold: true, isNum: true });
          rowVal[3] = cell(val(row.left.qty_kg), { isBold: true, isNum: true });
          rowVal[4] = cell('');
          rowVal[5] = cell('');
          rowVal[6] = cell('');
          rowVal[7] = cell(val(row.left.kg_fat, 4), { isBold: true, isNum: true });
          rowVal[8] = cell(val(row.left.kg_snf, 4), { isBold: true, isNum: true });
          merges.push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 1 } });
        } else if (row.left.type === 'item') {
          const item = row.left.data;
          rowVal[0] = cell(row.left.index);
          rowVal[1] = cell(item.product);
          rowVal[2] = cell(val(item.qty_lts), { isNum: true });
          rowVal[3] = cell(val(item.qty_kg), { isNum: true });
          rowVal[4] = cell(val(item.fat_pct, 4), { isNum: true });
          rowVal[5] = cell(val(item.snf_pct, 4), { isNum: true });
          rowVal[6] = cell(val(item.sp_gr, 4), { isNum: true });
          rowVal[7] = cell(val(item.kg_fat, 4), { isNum: true });
          rowVal[8] = cell(val(item.kg_snf, 4), { isNum: true });
        } else {
          for (let c = 0; c < 9; c++) rowVal[c] = cell('');
        }

        // Right side
        if (row.right.type === 'header') {
          // Label goes to column index 10 because the merge is from 10 to 17
          rowVal[9] = cell('');
          rowVal[10] = cell(row.right.label, { isBold: true });
          for (let c = 11; c < 18; c++) rowVal[c] = cell('');
          merges.push({ s: { r: rIndex, c: 10 }, e: { r: rIndex, c: 17 } });
        } else if (row.right.type === 'total') {
          // Merge is from 9 to 10, so the label MUST go into column index 9!
          rowVal[9] = cell(row.right.label, { isBold: true });
          rowVal[10] = cell('');
          rowVal[11] = cell(val(row.right.qty_lts), { isBold: true, isNum: true });
          rowVal[12] = cell(val(row.right.qty_kg), { isBold: true, isNum: true });
          rowVal[13] = cell('');
          rowVal[14] = cell('');
          rowVal[15] = cell('');
          rowVal[16] = cell(val(row.right.kg_fat, 4), { isBold: true, isNum: true });
          rowVal[17] = cell(val(row.right.kg_snf, 4), { isBold: true, isNum: true });
          merges.push({ s: { r: rIndex, c: 9 }, e: { r: rIndex, c: 10 } });
        } else if (row.right.type === 'item') {
          const item = row.right.data;
          rowVal[9] = cell(row.right.index);
          rowVal[10] = cell(item.product);
          rowVal[11] = cell(val(item.qty_lts), { isNum: true });
          rowVal[12] = cell(val(item.qty_kg), { isNum: true });
          rowVal[13] = cell(val(item.fat_pct, 4), { isNum: true });
          rowVal[14] = cell(val(item.snf_pct, 4), { isNum: true });
          rowVal[15] = cell(val(item.sp_gr, 4), { isNum: true });
          rowVal[16] = cell(val(item.kg_fat, 4), { isNum: true });
          rowVal[17] = cell(val(item.kg_snf, 4), { isNum: true });
        } else {
          for (let c = 9; c < 18; c++) rowVal[c] = cell('');
        }

        tsData.push(rowVal);
      });

      // Add Grand Totals
      // Merge is from 0 to 1, and 9 to 10. Labels go to index 0 and 9 respectively!
      const gtRowIdx = tsData.length;
      tsData.push([
        cell('G.TOTAL', { isBold: true }), cell(''), cell(val(totals.grand_total_arrival_lts), { isBold: true, isNum: true }), cell(val(totals.grand_total_arrival_kg), { isBold: true, isNum: true }), cell('-'), cell('-'), cell('-'), cell(val(totals.grand_total_arrival_kg_fat, 4), { isBold: true, isNum: true }), cell(val(totals.grand_total_arrival_kg_snf, 4), { isBold: true, isNum: true }),
        cell('G.TOTAL', { isBold: true }), cell(''), cell(val(totals.grand_total_disposal_lts), { isBold: true, isNum: true }), cell(val(totals.grand_total_disposal_kg), { isBold: true, isNum: true }), cell('-'), cell('-'), cell('-'), cell(val(totals.grand_total_disposal_kg_fat, 4), { isBold: true, isNum: true }), cell(val(totals.grand_total_disposal_kg_snf, 4), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: gtRowIdx, c: 0 }, e: { r: gtRowIdx, c: 1 } });
      merges.push({ s: { r: gtRowIdx, c: 9 }, e: { r: gtRowIdx, c: 10 } });

      // Add Loss/Gain
      // Merge is from 10 to 15. Label goes to index 10!
      const lgRowIdx = tsData.length;
      tsData.push([
        cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
        cell(''), cell('LOSS', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(Math.abs(totals.loss_kg_fat), 4), { isBold: true, isNum: true }), cell(val(Math.abs(totals.loss_kg_snf), 4), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: lgRowIdx, c: 10 }, e: { r: lgRowIdx, c: 15 } });

      // Add Loss %
      // Merge is from 10 to 15. Label goes to index 10!
      const lpRowIdx = tsData.length;
      tsData.push([
        cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
        cell(''), cell('LOSS%', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(totals.loss_pct_fat, 4), { isBold: true, isNum: true }), cell(val(totals.loss_pct_snf, 4), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: lpRowIdx, c: 10 }, e: { r: lpRowIdx, c: 15 } });

      let globalCmpddNorm = 0.5;
      if (entryNotes) {
        const parts = entryNotes.split('\n');
        parts.forEach(part => {
          if (part.includes('__METADATA__:')) {
            try {
              const meta = JSON.parse(part.split('__METADATA__:')[1]);
              if (meta.cmpdd_norms && meta.cmpdd_norms.WM) globalCmpddNorm = parseFloat(meta.cmpdd_norms.WM) || 0.5;
              else if (meta.cmpdd_norm) globalCmpddNorm = parseFloat(meta.cmpdd_norm) || 0.5;
            } catch {}
          }
        });
      }

      // Add Norm
      // Merge is from 10 to 15. Label goes to index 10!
      const normRowIdx = tsData.length;
      tsData.push([
        cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
        cell(''), cell(`CMPDD LOSS % (${globalCmpddNorm}%)`, { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(globalCmpddNorm, 2), { isBold: true, isNum: true }), cell(val(globalCmpddNorm, 2), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: normRowIdx, c: 10 }, e: { r: normRowIdx, c: 15 } });

      const tsWs = XLSX.utils.aoa_to_sheet(tsData);
      tsWs['!cols'] = colWidths;
      tsWs['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, tsWs, 'TS');
    }

        // 4. Build STG Report Sheet (All blocks inside a single sheet named 'STG', plain uncolored style matching 01-05-2026-TS.xlsx)
    if (includeStg) {
      const stgCell = (value: any, opts?: Parameters<typeof cell>[1]) => cell(value, { ...opts, noColor: true });

      let customStatements: Array<{ key: string; label: string }> = [];
      let customBlocks: Record<string, any> = {};
      let cmpddNorms: Record<string, string> = {};

      if (entryNotes) {
        const notesParts = entryNotes.split('\n');
        notesParts.forEach(part => {
          if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
            const [, metaJson] = part.split('__METADATA__:');
            try {
              const meta = JSON.parse(metaJson);
              if (meta.custom_statements) customStatements = meta.custom_statements;
              if (meta.custom_blocks) customBlocks = meta.custom_blocks;
              if (meta.cmpdd_norms) cmpddNorms = meta.cmpdd_norms;
            } catch {}
          }
        });
      }

      // Fetch statement masters dynamically from database if not embedded in notes
      if (customStatements.length === 0) {
        try {
          // 1. Try dedicated stg_masters table
          const { data: stgTableRows, error: stgTableErr } = await supabase
            .from('stg_masters')
            .select('key, label, variant')
            .order('sort_order', { ascending: true });

          if (!stgTableErr && Array.isArray(stgTableRows) && stgTableRows.length > 0) {
            customStatements = stgTableRows.map((m: any) => ({
              key: m.key,
              label: m.label || m.variant || m.key,
            }));
          } else {
            // 2. Fallback to prep_chart_configs
            const { data: dbMasters } = await supabase
              .from('prep_chart_configs')
              .select('config_json')
              .eq('config_key', 'stg_masters')
              .maybeSingle();
            if (dbMasters && Array.isArray(dbMasters.config_json)) {
              customStatements = dbMasters.config_json.map((m: any) => ({
                key: m.key,
                label: m.label || m.name || m.key,
              }));
            }
          }
        } catch (e) {}
      }

      const blockMap = new Map<string, { key: string; label: string }>();
      if (customStatements && customStatements.length > 0) {
        customStatements.forEach(s => { if (s && s.key) blockMap.set(s.key, s); });
      }
      stgRowsData.forEach((r: any) => {
        if (r.product_block && !blockMap.has(r.product_block)) {
          const cleanKey = r.product_block.toUpperCase();
          blockMap.set(r.product_block, { key: r.product_block, label: `${cleanKey} – RECEIPT AND DISPOSAL STATEMENT` });
        }
      });
      const allBlocks = Array.from(blockMap.values());

      if (allBlocks.length > 0 || stgRowsData.length > 0) {
        // Master array for single STG sheet data (uncolored, plain matching 01-05-2026-TS.xlsx)
        const stgSheetData: any[][] = [
          [
            stgCell('NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCER\'S UNION LTD., NAMAKKAL', { isBold: true, noBorder: true })
          ],
          [
            stgCell('NAMAKKAL UNION- SOLID BALANCE DETAILS', { isBold: true, noBorder: true }),
            ...new Array(16).fill(stgCell('', { noBorder: true })),
            stgCell('DATE', { isBold: true, noBorder: true, alignment: 'right' })
          ]
        ];

        const stgMerges: XLSX.Range[] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }
        ];

        allBlocks.forEach((blockInfo, blockIndex) => {
          const block = blockInfo.key;
          let blockRows = stgRowsData.filter(r => r.product_block === block);

          if (customBlocks[block]) {
            const bState = customBlocks[block];
            const makeRowFromState = (itemName: string, side: 'RECEIPT' | 'DISPOSAL', itemState: any): STGRow => ({
              id: '',
              entry_id: '',
              product_block: block,
              side,
              item_name: itemName,
              qty_lts: parseFloat(itemState?.qty_lts) || 0,
              qty_kg: parseFloat(itemState?.qty_kg) || 0,
              fat_pct: parseFloat(itemState?.fat_pct) || 0,
              snf_pct: parseFloat(itemState?.snf_pct) || 0,
              sp_gr: parseFloat(itemState?.sp_gr) || 0,
              kg_fat: parseFloat(itemState?.kg_fat) || 0,
              kg_snf: parseFloat(itemState?.kg_snf) || 0,
              sort_order: 0,
            });

            const constructedRows: STGRow[] = [];
            if (bState.opening_balance) {
              constructedRows.push(makeRowFromState('OB', 'RECEIPT', bState.opening_balance));
            }

            if (Array.isArray(bState.rows) && bState.rows.length > 0) {
              bState.rows.forEach((r: any) => {
                const varName = r.variant || r.values?.variant || '';
                const side = (r.side || r.row_type || 'RECEIPT') as 'RECEIPT' | 'DISPOSAL';
                constructedRows.push(makeRowFromState(varName, side, r.values || r));
              });
            } else {
              if (Array.isArray(bState.receipts)) {
                bState.receipts.forEach((r: any) => constructedRows.push(makeRowFromState(r.item_name || r.variant, 'RECEIPT', r)));
              }
              if (Array.isArray(bState.disposals)) {
                bState.disposals.forEach((d: any) => constructedRows.push(makeRowFromState(d.item_name || d.variant, 'DISPOSAL', d)));
              }
            }

            if (bState.physical_count) {
              constructedRows.push(makeRowFromState('CB', 'DISPOSAL', bState.physical_count));
            }

            if (constructedRows.length > 0) {
              blockRows = constructedRows;
            }
          }

          if (blockRows.length === 0) return;

          const obRow = blockRows.find(r => r.item_name === 'OB');
          const cbRow = blockRows.find(r => r.item_name === 'CB');
          const receipts = blockRows.filter(r => r.side === 'RECEIPT' && r.item_name !== 'OB');
          const disposals = blockRows.filter(r => r.side === 'DISPOSAL' && r.item_name !== 'CB');

          const maxLen = Math.max(receipts.length, disposals.length);
          const alignedRows: { r?: STGRow; d?: STGRow }[] = [];
          for (let i = 0; i < maxLen; i++) {
            alignedRows.push({ r: receipts[i], d: disposals[i] });
          }

          const totRec = {
            lts: receipts.reduce((a, r) => a + r.qty_lts, 0),
            kg: receipts.reduce((a, r) => a + r.qty_kg, 0),
            fat: receipts.reduce((a, r) => a + r.kg_fat, 0),
            snf: receipts.reduce((a, r) => a + r.kg_snf, 0),
          };
          const totDisp = {
            lts: disposals.reduce((a, r) => a + r.qty_lts, 0),
            kg: disposals.reduce((a, r) => a + r.qty_kg, 0),
            fat: disposals.reduce((a, r) => a + r.kg_fat, 0),
            snf: disposals.reduce((a, r) => a + r.kg_snf, 0),
          };

          const obVal = {
            lts: obRow ? obRow.qty_lts : 0,
            kg: obRow ? obRow.qty_kg : 0,
            fat_pct: obRow ? obRow.fat_pct : 0,
            snf_pct: obRow ? obRow.snf_pct : 0,
            sp_gr: obRow ? obRow.sp_gr : 0,
            fat: obRow ? obRow.kg_fat : 0,
            snf: obRow ? obRow.kg_snf : 0,
          };

          const physicalCB = {
            lts: cbRow ? cbRow.qty_lts : 0,
            kg: cbRow ? cbRow.qty_kg : 0,
            fat_pct: cbRow ? cbRow.fat_pct : 0,
            snf_pct: cbRow ? cbRow.snf_pct : 0,
            sp_gr: cbRow ? cbRow.sp_gr : 0,
            fat: cbRow ? cbRow.kg_fat : 0,
            snf: cbRow ? cbRow.kg_snf : 0,
          };

          const grandRec = {
            lts: obVal.lts + totRec.lts,
            kg: obVal.kg + totRec.kg,
            fat: obVal.fat + totRec.fat,
            snf: obVal.snf + totRec.snf,
          };

          const cbCalculated = {
            lts: grandRec.lts - totDisp.lts,
            kg: grandRec.kg - totDisp.kg,
            fat: grandRec.fat - totDisp.fat,
            snf: grandRec.snf - totDisp.snf,
          };

          const grandDisp = {
            lts: totDisp.lts + physicalCB.lts,
            kg: totDisp.kg + physicalCB.kg,
            fat: totDisp.fat + physicalCB.fat,
            snf: totDisp.snf + physicalCB.snf,
          };

          const lossGain = {
            lts: physicalCB.lts - cbCalculated.lts,
            kg: physicalCB.kg - cbCalculated.kg,
            fat: physicalCB.fat - cbCalculated.fat,
            snf: physicalCB.snf - cbCalculated.snf,
          };

          const lossGainPct = {
            lts: cbCalculated.lts !== 0 ? (lossGain.lts / cbCalculated.lts) * 100 : 0,
            kg: cbCalculated.kg !== 0 ? (lossGain.kg / cbCalculated.kg) * 100 : 0,
            fat: cbCalculated.fat !== 0 ? (lossGain.fat / cbCalculated.fat) * 100 : 0,
            snf: cbCalculated.snf !== 0 ? (lossGain.snf / cbCalculated.snf) * 100 : 0,
          };

          // Spacer row between blocks
          if (blockIndex > 0) {
            stgSheetData.push(new Array(18).fill(stgCell('', { noBorder: true })));
          }

          // Block Title Header (Col A to Q, Col R has date)
          const startRowIdx = stgSheetData.length;
          const rawLabel = (blockInfo.label || (customStatements.find(s => s.key === block)?.label) || '').trim();
          let blockLabel = rawLabel ? (rawLabel.toUpperCase().includes('STATEMENT') ? rawLabel.toUpperCase() : `${rawLabel.toUpperCase()} - RECEIPT AND DISPOSAL STATEMENT`) : `${block.toUpperCase()} - RECEIPT AND DISPOSAL STATEMENT`;
          stgSheetData.push([
            stgCell(blockLabel, { isBold: true, noBorder: true }),
            ...new Array(16).fill(stgCell('', { noBorder: true })),
            stgCell(new Date(date).toLocaleDateString('en-IN'), { isBold: true, noBorder: true, alignment: 'right' })
          ]);
          stgMerges.push({ s: { r: startRowIdx, c: 0 }, e: { r: startRowIdx, c: 16 } });

          // Headers row (Side-by-side Receipts and Disposals)
          stgSheetData.push([
            stgCell('S.No.', { isHeader: true }), stgCell('Receipt', { isHeader: true }), stgCell('Qty (Lts)', { isHeader: true }), stgCell('Qty (Kg)', { isHeader: true }), stgCell('Fat%', { isHeader: true }), stgCell('Snf%', { isHeader: true }), stgCell('SP.G', { isHeader: true }), stgCell('Kg.Fat', { isHeader: true }), stgCell('Kg.Snf', { isHeader: true }),
            stgCell('S.No.', { isHeader: true }), stgCell('Disposal', { isHeader: true }), stgCell('Qty (Lts)', { isHeader: true }), stgCell('Qty (Kg)', { isHeader: true }), stgCell('Fat%', { isHeader: true }), stgCell('Snf%', { isHeader: true }), stgCell('SP.G', { isHeader: true }), stgCell('Kg.Fat', { isHeader: true }), stgCell('Kg.Snf', { isHeader: true })
          ]);

          // Aligned rows
          alignedRows.forEach((row, i) => {
            const rowVal: any[] = new Array(18).fill('');

            // Left: Receipt
            if (row.r) {
              rowVal[0] = stgCell(i + 1, { alignment: 'center' });
              rowVal[1] = stgCell(row.r.item_name);
              rowVal[2] = stgCell(val(row.r.qty_lts, 0), { isNum: true });
              rowVal[3] = stgCell(val(row.r.qty_kg, 2), { isNum: true });
              rowVal[4] = stgCell(val(row.r.fat_pct, 4), { isNum: true });
              rowVal[5] = stgCell(val(row.r.snf_pct, 4), { isNum: true });
              rowVal[6] = stgCell(val(row.r.sp_gr, 4), { isNum: true });
              rowVal[7] = stgCell(val(row.r.kg_fat, 3), { isNum: true });
              rowVal[8] = stgCell(val(row.r.kg_snf, 3), { isNum: true });
            } else {
              for (let c = 0; c < 9; c++) rowVal[c] = stgCell('');
            }

            // Right: Disposal
            if (row.d) {
              rowVal[9] = stgCell(i + 1, { alignment: 'center' });
              rowVal[10] = stgCell(row.d.item_name);
              rowVal[11] = stgCell(val(row.d.qty_lts, 0), { isNum: true });
              rowVal[12] = stgCell(val(row.d.qty_kg, 2), { isNum: true });
              rowVal[13] = stgCell(val(row.d.fat_pct, 4), { isNum: true });
              rowVal[14] = stgCell(val(row.d.snf_pct, 4), { isNum: true });
              rowVal[15] = stgCell(val(row.d.sp_gr, 4), { isNum: true });
              rowVal[16] = stgCell(val(row.d.kg_fat, 3), { isNum: true });
              rowVal[17] = stgCell(val(row.d.kg_snf, 3), { isNum: true });
            } else {
              for (let c = 9; c < 18; c++) rowVal[c] = stgCell('');
            }

            stgSheetData.push(rowVal);
          });

          // Summary Rows
          // Row D1: Disposal Total row (on the right)
          const d1Idx = stgSheetData.length;
          stgSheetData.push([
            stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }),
            stgCell('Total', { isBold: true }), stgCell(''), stgCell(val(totDisp.lts, 0), { isBold: true, isNum: true }), stgCell(val(totDisp.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(totDisp.fat, 3), { isBold: true, isNum: true }), stgCell(val(totDisp.snf, 3), { isBold: true, isNum: true })
          ]);
          stgMerges.push({ s: { r: d1Idx, c: 9 }, e: { r: d1Idx, c: 10 } });

          // Row D2: CB row (on the right)
          const d2Idx = stgSheetData.length;
          stgSheetData.push([
            stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }),
            stgCell('CB', { isBold: true }), stgCell(''), stgCell(val(physicalCB.lts, 0), { isBold: true, isNum: true }), stgCell(val(physicalCB.kg, 2), { isBold: true, isNum: true }), stgCell(val(physicalCB.fat_pct, 4), { isBold: true, isNum: true }), stgCell(val(physicalCB.snf_pct, 4), { isBold: true, isNum: true }), stgCell(val(physicalCB.sp_gr, 4), { isBold: true, isNum: true }), stgCell(val(physicalCB.fat, 3), { isBold: true, isNum: true }), stgCell(val(physicalCB.snf, 3), { isBold: true, isNum: true })
          ]);
          stgMerges.push({ s: { r: d2Idx, c: 9 }, e: { r: d2Idx, c: 10 } });

          // Row D3: Grand Total row (on the right)
          const d3Idx = stgSheetData.length;
          stgSheetData.push([
            stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }),
            stgCell('Grand Total', { isBold: true }), stgCell(''), stgCell(val(grandDisp.lts, 0), { isBold: true, isNum: true }), stgCell(val(grandDisp.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(grandDisp.fat, 3), { isBold: true, isNum: true }), stgCell(val(grandDisp.snf, 3), { isBold: true, isNum: true })
          ]);
          stgMerges.push({ s: { r: d3Idx, c: 9 }, e: { r: d3Idx, c: 10 } });

          // Row R1: Receipt Total (left) / Loss/Gain (right)
          const r1Idx = stgSheetData.length;
          stgSheetData.push([
            stgCell('Total', { isBold: true }), stgCell(''), stgCell(val(totRec.lts, 0), { isBold: true, isNum: true }), stgCell(val(totRec.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(totRec.fat, 3), { isBold: true, isNum: true }), stgCell(val(totRec.snf, 3), { isBold: true, isNum: true }),
            stgCell('Loss/Gain', { isBold: true }), stgCell(''), stgCell(val(lossGain.lts, 0), { isBold: true, isNum: true }), stgCell(val(lossGain.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(lossGain.fat, 3), { isBold: true, isNum: true }), stgCell(val(lossGain.snf, 3), { isBold: true, isNum: true })
          ]);
          stgMerges.push({ s: { r: r1Idx, c: 0 }, e: { r: r1Idx, c: 1 } });
          stgMerges.push({ s: { r: r1Idx, c: 9 }, e: { r: r1Idx, c: 10 } });

          // Row R2: OB (left) / Loss/Gain % (right)
          const r2Idx = stgSheetData.length;
          stgSheetData.push([
            stgCell('OB', { isBold: true }), stgCell(''), stgCell(val(obVal.lts, 0), { isBold: true, isNum: true }), stgCell(val(obVal.kg, 2), { isBold: true, isNum: true }), stgCell(val(obVal.fat_pct, 4), { isBold: true, isNum: true }), stgCell(val(obVal.snf_pct, 4), { isBold: true, isNum: true }), stgCell(val(obVal.sp_gr, 4), { isBold: true, isNum: true }), stgCell(val(obVal.fat, 3), { isBold: true, isNum: true }), stgCell(val(obVal.snf, 3), { isBold: true, isNum: true }),
            stgCell('Loss/Gain %', { isBold: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(`${val(lossGainPct.fat, 4)}%`, { isBold: true, alignment: 'right' }), stgCell(`${val(lossGainPct.snf, 4)}%`, { isBold: true, alignment: 'right' })
          ]);
          stgMerges.push({ s: { r: r2Idx, c: 0 }, e: { r: r2Idx, c: 1 } });
          stgMerges.push({ s: { r: r2Idx, c: 9 }, e: { r: r2Idx, c: 10 } });

          // Row R3: Grand Total (left) / CMPDD Norms (right)
          const bCmpddNormStr = (customBlocks[block] && customBlocks[block].cmpdd_norm)
            ? customBlocks[block].cmpdd_norm
            : (cmpddNorms[block] || '0.5');
          const bCmpddNorm = parseFloat(bCmpddNormStr) || 0.5;

          const r3Idx = stgSheetData.length;
          stgSheetData.push([
            stgCell('Grand Total', { isBold: true }), stgCell(''), stgCell(val(grandRec.lts, 0), { isBold: true, isNum: true }), stgCell(val(grandRec.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(grandRec.fat, 3), { isBold: true, isNum: true }), stgCell(val(grandRec.snf, 3), { isBold: true, isNum: true }),
            stgCell(`CMPDD Norms (${bCmpddNorm}%)`, { isBold: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(`${bCmpddNorm}%`, { isBold: true, alignment: 'right' }), stgCell(`${bCmpddNorm}%`, { isBold: true, alignment: 'right' })
          ]);
          stgMerges.push({ s: { r: r3Idx, c: 0 }, e: { r: r3Idx, c: 1 } });
          stgMerges.push({ s: { r: r3Idx, c: 9 }, e: { r: r3Idx, c: 10 } });
        });

        const stgWs = XLSX.utils.aoa_to_sheet(stgSheetData);
        stgWs['!cols'] = colWidths;
        stgWs['!merges'] = stgMerges;
        XLSX.utils.book_append_sheet(wb, stgWs, 'STG');
      }
    }

    // 5. Build Stock Statement Sheet
    if (includeStock && stockRowsData.length > 0) {
      const stockWs = buildStockStatementSheet(stockRowsData, date, stockEntryNotes || entryNotes, masterConfig);
      XLSX.utils.book_append_sheet(wb, stockWs, 'Stock Statement');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const [y, m, d] = date.split('-');
    const formattedDate = `${d}-${m}-${y}`;
    const shiftStr = shift ? `-${shift}` : '';
    const fileName = `${formattedDate}${shiftStr}-TS.xlsx`;

    // 6. Return response for client download
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

