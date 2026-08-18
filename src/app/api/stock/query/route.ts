import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, getLocalAggregatedStock } from '@/lib/fileDb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'day' | 'month' | 'year' | 'range'
    const date = searchParams.get('date');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!type) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (isLocalDbEnabled()) {
      const data = await getLocalAggregatedStock(type, date || undefined, month || undefined, year || undefined, from || undefined, to || undefined);
      return NextResponse.json({ data });
    }

    const supabase = getSupabaseServiceClient();
    let query = supabase.from('entries').select('id, entry_date, shift').eq('report_type', 'STOCK');

    if (type === 'day' && date) {
      query = query.eq('entry_date', date);
    } else if (type === 'month' && month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const endDate = new Date(Number(y), Number(m), 0);
      const endY = endDate.getFullYear();
      const endM = String(endDate.getMonth() + 1).padStart(2, '0');
      const endD = String(endDate.getDate()).padStart(2, '0');
      const end = `${endY}-${endM}-${endD}`;
      query = query.gte('entry_date', start).lte('entry_date', end);
    } else if (type === 'year' && year) {
      query = query.gte('entry_date', `${year}-01-01`).lte('entry_date', `${year}-12-31`);
    } else if (type === 'range' && from && to) {
      query = query.gte('entry_date', from).lte('entry_date', to);
    } else {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { data: entries, error: entryErr } = await query;
    if (entryErr) throw entryErr;
    if (!entries || entries.length === 0) {
      return NextResponse.json({ data: [] });
    }
    const entryIds = entries.map(e => e.id);
    const { data: rows, error: rowsErr } = await supabase
      .from('stock_rows')
      .select('*')
      .in('entry_id', entryIds)
      .order('sort_order');
    if (rowsErr) throw rowsErr;

    // Aggregate by row_type and row_label
    const aggregatedMap: Record<string, any> = {};

    for (const r of rows) {
      const key = `${r.row_type}_${r.row_label}`;
      if (!aggregatedMap[key]) {
        aggregatedMap[key] = {
          row_type: r.row_type,
          row_label: r.row_label,
          wh_milk: 0, dlt_milk: 0, fc_milk: 0, std_milk: 0,
          toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0,
          butter_milk: 0, r_con: 0, smp: 0, water: 0,
          sort_order: r.sort_order,
        };
      }
      const target = aggregatedMap[key];
      target.wh_milk += Number(r.wh_milk) || 0;
      target.dlt_milk += Number(r.dlt_milk) || 0;
      target.fc_milk += Number(r.fc_milk) || 0;
      target.std_milk += Number(r.std_milk) || 0;
      target.toned_curd += Number(r.toned_curd) || 0;
      target.dtm += Number(r.dtm) || 0;
      target.skim_milk += Number(r.skim_milk) || 0;
      target.cream += Number(r.cream) || 0;
      target.butter_milk += Number(r.butter_milk) || 0;
      target.r_con += Number(r.r_con) || 0;
      target.smp += Number(r.smp) || 0;
      target.water += Number(r.water) || 0;
    }

    // Return sorted by sort_order
    const result = Object.values(aggregatedMap).sort((a, b) => a.sort_order - b.sort_order);
    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
