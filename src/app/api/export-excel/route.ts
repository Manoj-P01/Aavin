// ─────────────────────────────────────────────────────────────
// src/app/api/export-excel/route.ts
// Excel Export Dispatcher for Stock, TS, and STG reports
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import XLSX from 'xlsx-js-style';
import { getSupabaseServiceClient } from '@/lib/supabase';
import type { Shift, TSMilkRow, STGRow, StockRow } from '@/lib/types';
import { unpackRows } from '@/lib/rowJson';
import {
  fetchMasterStockConfig,
  buildStockStatementSheet,
  getStockEntriesForPeriod,
} from '@/lib/export/excelStock';
import { buildTSStatementSheet } from '@/lib/export/excelTS';
import { buildSTGStatementSheet } from '@/lib/export/excelSTG';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate') || searchParams.get('from');
    const endDate = searchParams.get('endDate') || searchParams.get('to');
    const multiSheet = searchParams.get('multi_sheet') === 'true' || searchParams.get('periodical') === 'true';

    const masterConfig = await fetchMasterStockConfig();

    // 1. Handle Periodical Multi-Sheet Stock Statement Export for date ranges
    if ((startDate && endDate) || (multiSheet && (startDate || date))) {
      const sDate = startDate || date || '';
      const eDate = endDate || startDate || date || '';
      const entriesWithRows = await getStockEntriesForPeriod(sDate, eDate);

      if (!entriesWithRows || entriesWithRows.length === 0) {
        return NextResponse.json({ error: 'No stock statement entries found for the selected period' }, { status: 404 });
      }

      const wb = XLSX.utils.book_new();
      entriesWithRows.forEach((item, idx) => {
        const sheetName = String(idx + 1); // Sheets '1', '2', '3'...
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

    const supabase = getSupabaseServiceClient();

    // 2. Fetch TS/STG entries
    if (includeTs || includeStg) {
      let query = supabase
        .from('entries')
        .select('id, notes, shift, entry_date')
        .eq('entry_date', date)
        .eq('report_type', 'TS');

      if (shift && shift !== 'F') {
        query = query.eq('shift', shift);
      }

      const { data: entries, error } = await query;
      let tsEntries = entries;

      if (!error && (!tsEntries || tsEntries.length === 0) && shift) {
        const fallbackQuery = supabase
          .from('entries')
          .select('id, notes, shift, entry_date')
          .eq('entry_date', date)
          .eq('report_type', 'TS');
        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          tsEntries = fallbackRes.data;
        }
      }

      if (tsEntries && tsEntries.length > 0) {
        const entryId = tsEntries[0].id;
        entryNotes = tsEntries[0].notes || '';

        const [tsRes, stgRes] = await Promise.all([
          supabase.from('ts_milk_rows').select('id, entry_id, section, product, row_json, sort_order').eq('entry_id', entryId).order('sort_order'),
          supabase.from('stg_rows').select('id, entry_id, product_block, side, item_name, row_json, sort_order').eq('entry_id', entryId).order('sort_order'),
        ]);

        if (tsRes.data) tsRowsData = unpackRows(tsRes.data) as unknown as TSMilkRow[];
        if (stgRes.data) stgRowsData = unpackRows(stgRes.data) as unknown as STGRow[];
      }
    }

    // 3. Fetch Stock entry
    if (includeStock) {
      let query = supabase
        .from('entries')
        .select('id, notes, shift, entry_date')
        .eq('entry_date', date)
        .eq('report_type', 'STOCK');

      if (shift && shift !== 'F') {
        query = query.eq('shift', shift);
      }

      const { data: entries, error } = await query;
      let stockEntries = entries;

      if (!error && (!stockEntries || stockEntries.length === 0) && shift) {
        const fallbackQuery = supabase
          .from('entries')
          .select('id, notes, shift, entry_date')
          .eq('entry_date', date)
          .eq('report_type', 'STOCK');
        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          stockEntries = fallbackRes.data;
        }
      }

      if (stockEntries && stockEntries.length > 0) {
        const stockEntryId = stockEntries[0].id;
        stockEntryNotes = stockEntries[0].notes || '';

        const { data: rows } = await supabase
          .from('stock_rows')
          .select('id, entry_id, row_type, row_label, entry_json, sort_order')
          .eq('entry_id', stockEntryId)
          .order('sort_order');

        if (rows) {
          (rows || []).forEach((r: any) => {
            const entryJson = typeof r.entry_json === 'string' ? JSON.parse(r.entry_json) : (r.entry_json || {});
            if (Array.isArray(entryJson.rows) && entryJson.rows.length > 0) {
              entryJson.rows.forEach((inner: any, iIdx: number) => {
                stockRowsData.push({
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
              stockRowsData.push(r);
            }
          });
        }
      }
    }

    // 4. Create Workbook and Append Sheets
    const wb = XLSX.utils.book_new();

    if (includeTs && tsRowsData.length > 0) {
      await buildTSStatementSheet(tsRowsData, date, entryNotes, wb);
    }

    if (includeStg) {
      await buildSTGStatementSheet(stgRowsData, date, entryNotes, wb);
    }

    if (includeStock && stockRowsData.length > 0) {
      const stockWs = buildStockStatementSheet(stockRowsData, date, stockEntryNotes || entryNotes, masterConfig);
      XLSX.utils.book_append_sheet(wb, stockWs, 'Stock Statement');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const [y, m, d] = date.split('-');
    const formattedDate = `${d}-${m}-${y}`;
    const shiftStr = shift ? `-${shift}` : '';
    const fileName = `${formattedDate}${shiftStr}-TS.xlsx`;

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
