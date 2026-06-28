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
        const data = getLocalStockData(entry_id);
        return NextResponse.json({ data });
      }

      if (month) {
        const data = getLocalEntries('STOCK', month);
        return NextResponse.json({ data });
      }

      if (!date) return NextResponse.json({ error: 'date or entry_id or month required' }, { status: 400 });

      let entries = getLocalEntries('STOCK', undefined, date);
      if (shift) entries = entries.filter(e => e.shift === shift);
      if (entries.length === 0) return NextResponse.json({ error: 'No stock entries found' }, { status: 404 });

      // Gather rows for all matching entries
      const stock_rows: StockRow[] = [];
      const separation_details: any[] = [];

      for (const entry of entries) {
        const d = getLocalStockData(entry.id);
        stock_rows.push(...d.stock_rows);
        if (d.separation_details) separation_details.push(d.separation_details);
      }

      return NextResponse.json({
        data: {
          entries,
          stock_rows,
          separation_details,
        },
      });
    }

    const supabase = getSupabaseServiceClient();

    // Single entry by ID
    if (entry_id) {
      const [rowsRes, sepRes] = await Promise.all([
        supabase.from('stock_rows').select('*').eq('entry_id', entry_id).order('sort_order'),
        supabase.from('separation_details').select('*').eq('entry_id', entry_id).single(),
      ]);
      return NextResponse.json({
        data: { stock_rows: rowsRes.data || [], separation_details: sepRes.data || null },
      });
    }

    // Monthly list: return all entries for the month
    if (month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
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
      .select('id, entry_date, shift')
      .eq('entry_date', date)
      .eq('report_type', 'STOCK');

    if (shift) entryQuery = entryQuery.eq('shift', shift);

    const { data: entries, error: entryErr } = await entryQuery;
    if (entryErr) throw entryErr;
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
      const result = saveLocalStockData(entry_id, stock_rows, separation_details);
      return NextResponse.json({ data: { entry_id, row_count: result.row_count } }, { status: 201 });
    }

    const supabase = getSupabaseServiceClient();

    const rowsToInsert = (stock_rows || []).map((r, i) => ({
      entry_id,
      row_type: r.row_type,
      row_label: r.row_label,
      wh_milk:     Number(r.wh_milk)     || 0,
      dlt_milk:    Number(r.dlt_milk)    || 0,
      fc_milk:     Number(r.fc_milk)     || 0,
      std_milk:    Number(r.std_milk)    || 0,
      toned_curd:  Number(r.toned_curd)  || 0,
      dtm:         Number(r.dtm)         || 0,
      skim_milk:   Number(r.skim_milk)   || 0,
      cream:       Number(r.cream)       || 0,
      butter_milk: Number(r.butter_milk) || 0,
      r_con:       Number(r.r_con)       || 0,
      smp:         Number(r.smp)         || 0,
      water:       Number(r.water)       || 0,
      sort_order:  r.sort_order ?? i,
    }));

    // Delete existing then re-insert
    await Promise.all([
      supabase.from('stock_rows').delete().eq('entry_id', entry_id),
      supabase.from('separation_details').delete().eq('entry_id', entry_id),
    ]);

    if (rowsToInsert.length > 0) {
      await supabase.from('stock_rows').insert(rowsToInsert);
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
