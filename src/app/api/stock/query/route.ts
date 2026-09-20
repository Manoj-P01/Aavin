import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

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

    // Dynamic product keys from products_master and standard defaults
    const defaultCols = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'];

    let dbCols: string[] = [];
    try {
      const { data: dbProds } = await supabase
        .from('products_master')
        .select('product_key')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (Array.isArray(dbProds) && dbProds.length > 0) {
        dbCols = dbProds.map(p => p.product_key.replace(/\./g, '_').toLowerCase());
      }
    } catch (e) {
      console.warn('Could not fetch products_master in GET /api/stock/query:', e);
    }
    const allProdKeys = Array.from(new Set([...defaultCols, ...dbCols]));
    const metadataKeys = new Set(['id', 'entry_id', 'row_type', 'row_label', 'sort_order', 'created_at', 'created_by', 'updated_at', 'updated_by']);

    // Aggregate by row_type and row_label
    const aggregatedMap: Record<string, any> = {};

    for (const r of rows) {
      const key = `${r.row_type}_${r.row_label}`;
      if (!aggregatedMap[key]) {
        const initObj: Record<string, any> = {
          row_type: r.row_type,
          row_label: r.row_label,
          sort_order: r.sort_order,
        };
        allProdKeys.forEach(pKey => {
          initObj[pKey] = 0;
        });
        aggregatedMap[key] = initObj;
      }
      const target = aggregatedMap[key];

      const processedCols = new Set<string>();

      // Process active product keys with generic alphanumeric lookup
      for (const pKey of allProdKeys) {
        const targetNorm = pKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        let numVal = 0;

        if (r[pKey] !== undefined && r[pKey] !== null && r[pKey] !== '') {
          const num = typeof r[pKey] === 'number' ? r[pKey] : parseFloat(String(r[pKey]));
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

        target[pKey] = (target[pKey] || 0) + numVal;
      }


      // Process any remaining dynamic columns on r
      for (const [col, val] of Object.entries(r)) {
        if (metadataKeys.has(col) || processedCols.has(col)) continue;
        if (val === undefined || val === null || val === '') continue;

        const numVal = typeof val === 'number' ? val : parseFloat(String(val));
        if (isNaN(numVal) || numVal === 0) continue;

        const normalizedKey = col.replace(/\./g, '_').toLowerCase();
        target[normalizedKey] = (target[normalizedKey] || 0) + numVal;
      }
    }

    // Return sorted by sort_order
    const result = Object.values(aggregatedMap).sort((a, b) => a.sort_order - b.sort_order);
    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

