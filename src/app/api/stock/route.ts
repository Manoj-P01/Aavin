import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, getLocalEntries, getLocalStockData, saveLocalStockData } from '@/lib/fileDb';
import type { StockRow, Shift, Entry } from '@/lib/types';

// GET /api/stock?date=YYYY-MM-DD&shift=D|N  OR  ?date=YYYY-MM-DD (both shifts)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const shift = searchParams.get('shift') as Shift | null;
    const entry_id = searchParams.get('entry_id');
    const month = searchParams.get('month'); // YYYY-MM for monthly list

    // Check Local DB fallback
    if (isLocalDbEnabled()) {
      if (entry_id) {
        const data = await getLocalStockData(entry_id);
        return NextResponse.json({ data });
      }

      if (month) {
        const data = await getLocalEntries('STOCK', month);
        return NextResponse.json({ data });
      }

      if (!date) return NextResponse.json({ error: 'date or entry_id or month required' }, { status: 400 });

      let entries = await getLocalEntries('STOCK', undefined, date);
      let matchedEntries = shift ? entries.filter(e => e.shift === shift) : entries;
      if (matchedEntries.length === 0 && shift) {
        matchedEntries = entries;
      }
      if (matchedEntries.length === 0) return NextResponse.json({ error: 'No stock entries found' }, { status: 404 });

      // Gather rows for all matching entries
      const stock_rows: StockRow[] = [];
      const separation_details: any[] = [];

      for (const entry of matchedEntries) {
        const d = await getLocalStockData(entry.id);
        stock_rows.push(...d.stock_rows);
        if (d.separation_details) separation_details.push(d.separation_details);
      }

      return NextResponse.json({
        data: {
          entries: matchedEntries,
          stock_rows,
          separation_details,
        },
      });
    }

    const supabase = getSupabaseServiceClient();

    // Single entry by ID
    if (entry_id) {
      const [entryRes, rowsRes, sepRes] = await Promise.all([
        supabase.from('entries').select('id, entry_date, shift, notes').eq('id', entry_id).single(),
        supabase.from('stock_rows').select('*').eq('entry_id', entry_id).order('sort_order'),
        supabase.from('separation_details').select('*').eq('entry_id', entry_id).single(),
      ]);
      return NextResponse.json({
        data: {
          entries: entryRes.data ? [entryRes.data] : [],
          stock_rows: rowsRes.data || [],
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
    const [rowsRes, sepRes] = await Promise.all([
      supabase.from('stock_rows').select('*').in('entry_id', entryIds).order('sort_order'),
      supabase.from('separation_details').select('*').in('entry_id', entryIds),
    ]);

    return NextResponse.json({
      data: {
        entries,
        stock_rows: rowsRes.data || [],
        separation_details: sepRes.data || [],
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/stock – save stock rows for a shift entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entry_id, stock_rows, separation_details } = body as {
      entry_id: string;
      stock_rows: Partial<StockRow>[];
      separation_details?: Record<string, number>;
    };

    if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });

    if (isLocalDbEnabled()) {
      const result = await saveLocalStockData(entry_id, stock_rows, separation_details);
      return NextResponse.json({ data: { entry_id, row_count: result.row_count } }, { status: 201 });
    }

    const supabase = getSupabaseServiceClient();

    const actorUsername = req.headers.get('x-user-name') || 'admin';

    const stdCols = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'toned_curd', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'];

    const rowsToInsert = (stock_rows || []).map((r: any, i: number) => {
      const rowObj: any = {
        entry_id,
        row_type: r.row_type,
        row_label: r.row_label,
        sort_order: r.sort_order ?? i,
        created_by: actorUsername,
        updated_by: actorUsername,
      };

      stdCols.forEach(colKey => {
        const dotKey = colKey.replace(/_/g, '.');
        const altDotKey = colKey === 'wh_milk' ? 'wh.milk' : colKey === 'dlt_milk' ? 'dlt.milk' : colKey === 'fc_milk' ? 'fc._milk' : colKey === 'std_milk' ? 'std.milk' : dotKey;
        const val = r[colKey] ?? r[dotKey] ?? r[altDotKey];
        rowObj[colKey] = Number(val) || 0;
      });

      return rowObj;
    });

    // Delete existing then re-insert
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

    return NextResponse.json({ data: { entry_id, row_count: rowsToInsert.length } }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
