import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import type { StockRow, Shift, Entry } from '@/lib/types';

// GET /api/stock?date=YYYY-MM-DD&shift=D|N  OR  ?date=YYYY-MM-DD (both shifts)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const shift = searchParams.get('shift') as Shift | null;
    const entry_id = searchParams.get('entry_id');
    const month = searchParams.get('month'); // YYYY-MM for monthly list



    const supabase = getSupabaseServiceClient();

    // Single entry by ID
    if (entry_id) {
      let summaryData: any[] = [];
      try {
        const { data: sData } = await supabase.from('stock_summary_rows').select('*').eq('entry_id', entry_id).order('sort_order');
        if (Array.isArray(sData)) summaryData = sData;
      } catch (e) {}

      const [entryRes, rowsRes, sepRes] = await Promise.all([
        supabase.from('entries').select('id, entry_date, shift, notes').eq('id', entry_id).single(),
        supabase.from('stock_rows').select('*').eq('entry_id', entry_id).order('sort_order'),
        supabase.from('separation_details').select('*').eq('entry_id', entry_id).single(),
      ]);
      return NextResponse.json({
        data: {
          entries: entryRes.data ? [entryRes.data] : [],
          stock_rows: rowsRes.data || [],
          stock_summary_rows: summaryData,
          separation_details: sepRes.data || null
        },
      });
    }

    // Monthly list: return all entries for the month
    if (month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const endDate = new Date(Number(y), Number(m), 0);
      const endY = endDate.getFullYear();
      const endM = String(endDate.getMonth() + 1).padStart(2, '0');
      const endD = String(endDate.getDate()).padStart(2, '0');
      const end = `${endY}-${endM}-${endD}`;
      const { data, error } = await supabase
        .from('entries')
        .select('id, entry_date, shift, notes, created_at')
        .eq('report_type', 'STOCK')
        .gte('entry_date', start)
        .lte('entry_date', end)
        .order('entry_date')
        .order('shift');
      if (error) throw error;
      return NextResponse.json({ data });
    }

    // By date + optional shift
    if (!date) return NextResponse.json({ error: 'date or entry_id or month required' }, { status: 400 });

    let entryQuery = supabase
      .from('entries')
      .select('id, entry_date, shift, notes')
      .eq('entry_date', date)
      .eq('report_type', 'STOCK');

    if (shift) entryQuery = entryQuery.eq('shift', shift);

    let { data: entries, error: entryErr } = await entryQuery;
    if ((entryErr || !entries || entries.length === 0) && shift) {
      const fallbackQuery = supabase
        .from('entries')
        .select('id, entry_date, shift, notes')
        .eq('entry_date', date)
        .eq('report_type', 'STOCK');
      const fallbackRes = await fallbackQuery;
      if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
        entries = fallbackRes.data;
      }
    }
    if (!entries?.length) return NextResponse.json({ error: 'No stock entries found' }, { status: 404 });

    // Fetch rows for all matching entries
    const entryIds = entries.map(e => e.id);
    let summaryData: any[] = [];
    try {
      const { data: sData } = await supabase.from('stock_summary_rows').select('*').in('entry_id', entryIds).order('sort_order');
      if (Array.isArray(sData)) summaryData = sData;
    } catch (e) {}

    const [rowsRes, sepRes] = await Promise.all([
      supabase.from('stock_rows').select('*').in('entry_id', entryIds).order('sort_order'),
      supabase.from('separation_details').select('*').in('entry_id', entryIds),
    ]);

    return NextResponse.json({
      data: {
        entries,
        stock_rows: rowsRes.data || [],
        stock_summary_rows: summaryData,
        separation_details: sepRes.data || [],
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/stock – save stock rows and summary rows for a shift entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entry_id, stock_rows, stock_summary_rows, separation_details } = body as {
      entry_id: string;
      stock_rows: Partial<StockRow>[];
      stock_summary_rows?: any[];
      separation_details?: Record<string, number>;
    };

    if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });

    const actorUsername = req.headers.get('x-user-name') || 'admin';
    const normalizeColKey = (k: string) => k.trim().replace(/\.+/g, '_').replace(/_+/g, '_').toLowerCase();
    const standardValidCols = new Set(['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water']);

    let finalCols = Array.from(standardValidCols);
    try {
      const supabase = getSupabaseServiceClient();
      const { data: dbProds } = await supabase.from('products_master').select('product_key').eq('is_active', true);
      if (Array.isArray(dbProds) && dbProds.length > 0) {
        const dbCols = dbProds.map(p => normalizeColKey(p.product_key));
        finalCols = Array.from(new Set([...standardValidCols, ...dbCols]));
      }
    } catch (e) {}

    const rowsToInsert = (stock_rows || []).map((r: any, i: number) => {
      const rowObj: any = {
        entry_id,
        row_type: r.row_type,
        row_label: r.row_label,
        sort_order: r.sort_order ?? i,
        created_by: actorUsername,
        updated_by: actorUsername,
      };

      finalCols.forEach(colKey => {
        const targetNorm = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        let numVal = 0;

        if (r[colKey] !== undefined && r[colKey] !== null && r[colKey] !== '') {
          const num = typeof r[colKey] === 'number' ? r[colKey] : parseFloat(String(r[colKey]));
          if (!isNaN(num) && num !== 0) numVal = num;
        }

        if (numVal === 0 && targetNorm) {
          for (const [rk, rv] of Object.entries(r)) {
            if (rv === undefined || rv === null || rv === '') continue;
            if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm) {
              const num = typeof rv === 'number' ? rv : parseFloat(String(rv));
              if (!isNaN(num) && num !== 0) {
                numVal = num;
                break;
              }
            }
          }
        }

        rowObj[colKey] = numVal;
      });

      return rowObj;
    });

    // Prepare final summary rows (use provided or auto-compute from rowsToInsert)
    let finalSummaryRows: any[] = [];
    if (Array.isArray(stock_summary_rows) && stock_summary_rows.length > 0) {
      finalSummaryRows = stock_summary_rows.map((s: any, idx: number) => {
        const summaryDataObj: Record<string, number> = { ...(s.summary_data || {}) };

        finalCols.forEach(colKey => {
          const normKey = colKey.trim().replace(/\.+/g, '_').replace(/_+/g, '_').toLowerCase();
          const targetNorm = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          let numVal = 0;

          if (s[colKey] !== undefined && s[colKey] !== null && s[colKey] !== '') {
            const num = typeof s[colKey] === 'number' ? s[colKey] : parseFloat(String(s[colKey]));
            if (!isNaN(num)) numVal = num;
          } else if (s[normKey] !== undefined && s[normKey] !== null && s[normKey] !== '') {
            const num = typeof s[normKey] === 'number' ? s[normKey] : parseFloat(String(s[normKey]));
            if (!isNaN(num)) numVal = num;
          } else if (summaryDataObj[colKey] !== undefined && summaryDataObj[colKey] !== null) {
            const num = typeof summaryDataObj[colKey] === 'number' ? summaryDataObj[colKey] : parseFloat(String(summaryDataObj[colKey]));
            if (!isNaN(num)) numVal = num;
          } else if (summaryDataObj[normKey] !== undefined && summaryDataObj[normKey] !== null) {
            const num = typeof summaryDataObj[normKey] === 'number' ? summaryDataObj[normKey] : parseFloat(String(summaryDataObj[normKey]));
            if (!isNaN(num)) numVal = num;
          } else if (targetNorm) {
            for (const [sk, sv] of Object.entries(s)) {
              if (sv === undefined || sv === null || sv === '') continue;
              if (sk.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm) {
                const num = typeof sv === 'number' ? sv : parseFloat(String(sv));
                if (!isNaN(num)) {
                  numVal = num;
                  break;
                }
              }
            }
          }
          summaryDataObj[colKey] = numVal;
          summaryDataObj[normKey] = numVal;
        });

        return {
          entry_id,
          summary_type: s.summary_type || s.row_type,
          row_label: s.row_label || '',
          summary_data: summaryDataObj,
          sort_order: s.sort_order ?? idx,
          created_by: actorUsername,
          updated_by: actorUsername,
        };
      });
    } else {
      // Auto-compute 4 summary rows
      const obData: Record<string, number> = {};
      const recData: Record<string, number> = {};
      const dispData: Record<string, number> = {};
      const cbData: Record<string, number> = {};

      finalCols.forEach(colKey => {
        const normKey = colKey.trim().replace(/\.+/g, '_').replace(/_+/g, '_').toLowerCase();
        let obVal = 0, recVal = 0, dispVal = 0;
        rowsToInsert.forEach(r => {
          const val = Number(r[colKey]) || 0;
          if (r.row_type === 'OB') obVal += val;
          else if (r.row_type === 'RECEIPT') recVal += val;
          else if (r.row_type === 'DISPOSAL') dispVal += val;
        });
        obData[colKey] = obVal;
        obData[normKey] = obVal;
        recData[colKey] = recVal;
        recData[normKey] = recVal;
        dispData[colKey] = dispVal;
        dispData[normKey] = dispVal;
        cbData[colKey] = obVal + recVal - dispVal;
        cbData[normKey] = obVal + recVal - dispVal;
      });

      finalSummaryRows = [
        { entry_id, summary_type: 'OB', row_label: 'Opening Balance (OB)', summary_data: obData, sort_order: 0, created_by: actorUsername, updated_by: actorUsername },
        { entry_id, summary_type: 'TOTAL_RECEIPT', row_label: 'Total Receipts (+)', summary_data: recData, sort_order: 1, created_by: actorUsername, updated_by: actorUsername },
        { entry_id, summary_type: 'TOTAL_DISPOSAL', row_label: 'Total Disposals (-)', summary_data: dispData, sort_order: 2, created_by: actorUsername, updated_by: actorUsername },
        { entry_id, summary_type: 'CB', row_label: 'Closing Balance (=)', summary_data: cbData, sort_order: 3, created_by: actorUsername, updated_by: actorUsername },
      ];
    }

    // Store stock_summary_rows strictly in DB table
    const supabase = getSupabaseServiceClient();

    try {
      await supabase.from('stock_summary_rows').delete().eq('entry_id', entry_id);
    } catch (e) {}

    await Promise.all([
      supabase.from('stock_rows').delete().eq('entry_id', entry_id),
      supabase.from('separation_details').delete().eq('entry_id', entry_id),
    ]);

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase.from('stock_rows').insert(rowsToInsert);
      if (insertErr) {
        console.error('Failed to insert stock_rows in Supabase:', insertErr);
        throw new Error(`Failed to insert stock rows: ${insertErr.message}`);
      }
    }

    if (separation_details) {
      await supabase.from('separation_details').insert({ entry_id, ...separation_details });
    }

    if (finalSummaryRows.length > 0) {
      try {
        const { error: sumErr } = await supabase.from('stock_summary_rows').insert(finalSummaryRows);
        if (sumErr) {
          console.warn('Note: stock_summary_rows DB table insert warning:', sumErr.message || sumErr);
        }
      } catch (e) {
        console.warn('Note: stock_summary_rows DB table insert skipped or failed:', e);
      }
    }

    return NextResponse.json({ data: { entry_id, row_count: rowsToInsert.length, summary_count: finalSummaryRows.length } }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
