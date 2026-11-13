import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getProducts } from '@/lib/masters';

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

    query = query.order('entry_date', { ascending: false }).order('shift', { ascending: true });

    const { data: entries, error: entryErr } = await query;
    if (entryErr) throw entryErr;
    if (!entries || entries.length === 0) {
      return NextResponse.json({ data: [] });
    }
    const entryIds = entries.map(e => e.id);
    const { data: rows, error: rowsErr } = await supabase
      .from('stock_rows')
      .select('id, entry_id, row_type, row_label, entry_json, sort_order')
      .in('entry_id', entryIds)
      .order('sort_order');
    if (rowsErr) throw rowsErr;

    const effectiveRows: any[] = [];
    (rows || []).forEach((r: any) => {
      const entryJson = typeof r.entry_json === 'string' ? JSON.parse(r.entry_json) : (r.entry_json || {});
      const isSectionParent = ['Opening Balance', 'Receipts', 'Disposals'].includes(r.row_label) && Array.isArray(entryJson?.rows);
      if (isSectionParent && entryJson.rows.length > 0) {
        entryJson.rows.forEach((inner: any, iIdx: number) => {
          effectiveRows.push({
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
        effectiveRows.push(r);
      }
    });

    let dbCols: string[] = [];
    try {
      const dbProds = await getProducts();
      if (Array.isArray(dbProds) && dbProds.length > 0) {
        dbCols = dbProds.map(p => p.product_key.replace(/\./g, '_').toLowerCase());
      }
    } catch (e) {
      console.warn('Could not fetch getProducts in GET /api/stock/query:', e);
    }
    const allProdKeys = Array.from(new Set(dbCols));
    const metadataKeys = new Set(['id', 'entry_id', 'row_type', 'row_label', 'sort_order', 'created_at', 'created_by', 'updated_at', 'updated_by', 'entry_json', 'values']);

    if (allProdKeys.length === 0) {
      effectiveRows.forEach(r => {
        if (r.values && typeof r.values === 'object') {
          Object.keys(r.values).forEach(k => {
            if (!metadataKeys.has(k)) allProdKeys.push(k);
          });
        }
        Object.keys(r).forEach(k => {
          if (!metadataKeys.has(k)) allProdKeys.push(k);
        });
      });
    }

    // Aggregate by row_type and row_label
    const aggregatedMap: Record<string, any> = {};

    for (const r of effectiveRows) {
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
        processedCols.add(pKey);
        const normKey = pKey.replace(/\./g, '_').toLowerCase();
        processedCols.add(normKey);

        const targetNorm = pKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        let numVal = 0;

        const directVal = r.values?.[pKey] ?? r.values?.[normKey] ?? r[pKey] ?? r[normKey];
        if (directVal !== undefined && directVal !== null && directVal !== '') {
          const num = typeof directVal === 'number' ? directVal : parseFloat(String(directVal));
          if (!isNaN(num) && num !== 0) numVal = num;
        }

        if (numVal === 0 && targetNorm) {
          const searchSource = r.values && Object.keys(r.values).length > 0 ? r.values : r;
          for (const [rk, rv] of Object.entries(searchSource)) {
            if (metadataKeys.has(rk)) continue;
            if (rv === undefined || rv === null || rv === '' || typeof rv === 'object') continue;
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
      const searchSource = r.values && Object.keys(r.values).length > 0 ? { ...r, ...r.values } : r;
      for (const [col, val] of Object.entries(searchSource)) {
        if (metadataKeys.has(col) || processedCols.has(col)) continue;
        if (val === undefined || val === null || val === '' || typeof val === 'object') continue;

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

