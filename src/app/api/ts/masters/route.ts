import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// Default empty fallback array (all statement masters are strictly fetched from DB table stg_masters)
export const DEFAULT_STG_MASTERS: any[] = [];

// GET /api/ts/masters - Fetch STG Statement Masters strictly from stg_masters table or prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    let masters: any[] = [];
    let stgTableQueried = false;

    // 1. Fetch strictly from dedicated stg_masters table
    try {
      const { data: stgRows, error: stgErr } = await supabase
        .from('stg_masters')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!stgErr && Array.isArray(stgRows)) {
        stgTableQueried = true;
        masters = stgRows.map((r: any) => ({
          key: r.key,
          label: r.label,
          variant: r.variant,
          description: r.description || '',
          sort_order: r.sort_order,
          is_active: r.is_active,
          cmpdd_norm: r.cmpdd_norm || '',
          ob_columns: r.ob_columns || [],
          receipt_columns: r.receipt_columns || [],
          disposal_columns: r.disposal_columns || [],
          recon_columns: r.recon_columns || [],
          ob_rows: r.ob_rows || [],
          receipt_rows: r.receipt_rows || [],
          disposal_rows: r.disposal_rows || [],
          reconciliation_rows: r.reconciliation_rows || [],
        }));
      }
    } catch (e) {
      console.warn('stg_masters table read warning:', e);
    }

    // 2. If stg_masters was not queried/available, check prep_chart_configs
    if (!stgTableQueried || masters.length === 0) {
      try {
        const { data: res, error } = await supabase
          .from('prep_chart_configs')
          .select('config_json')
          .eq('config_key', 'stg_masters')
          .maybeSingle();

        if (!error && res && Array.isArray(res.config_json)) {
          masters = res.config_json;
        }
      } catch (e) {
        console.warn('prep_chart_configs read warning:', e);
      }
    } else {
      // Merge any metadata properties (such as cmpdd_norm) from prep_chart_configs
      try {
        const { data: cfgRes } = await supabase
          .from('prep_chart_configs')
          .select('config_json')
          .eq('config_key', 'stg_masters')
          .maybeSingle();
        if (cfgRes && Array.isArray(cfgRes.config_json)) {
          const cfgMap = new Map(cfgRes.config_json.map((c: any) => [c.key, c]));
          masters = masters.map((m: any) => {
            const extra = cfgMap.get(m.key);
            return {
              ...m,
              cmpdd_norm: m.cmpdd_norm || extra?.cmpdd_norm || '',
            };
          });
        }
      } catch { }
    }

    // 3. Cleanse prohibited artificial names from existing columns
    const PROHIBITED_NAMES = new Set([
      'Opening Balance Particular',
      'Receipt Particular',
      'Disposal Particular',
      'Reconciliation Item / Summary Label',
    ]);

    const cleanseCols = (cols: any[] | undefined) => {
      if (!Array.isArray(cols)) return [];
      return cols.map((col: any) => {
        if (PROHIBITED_NAMES.has(col.name)) {
          return {
            ...col,
            name: col.key === 'variant' ? 'VARIANT' : (col.key === 'label' ? 'LABEL' : col.key),
          };
        }
        return col;
      });
    };

    masters = masters.map((m: any) => ({
      ...m,
      ob_columns: cleanseCols(m.ob_columns),
      receipt_columns: cleanseCols(m.receipt_columns),
      disposal_columns: cleanseCols(m.disposal_columns),
      recon_columns: cleanseCols(m.recon_columns),
    }));

    return NextResponse.json({ success: true, masters });
  } catch (err: any) {
    console.error('GET /api/ts/masters error:', err);
    return NextResponse.json({ success: true, masters: [] });
  }
}

// POST /api/ts/masters - Save STG Statement Masters to prep_chart_configs and stg_masters
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const supabase = getSupabaseServiceClient();

    let mastersList = Array.isArray(body.masters)
      ? body.masters
      : (Array.isArray(body.statements) ? body.statements : (Array.isArray(body) ? body : null));

    // Handle reset to table data request
    if (body.action === 'reset') {
      const { data: stgRows } = await supabase
        .from('stg_masters')
        .select('*')
        .order('sort_order', { ascending: true });
      return NextResponse.json({ success: true, masters: stgRows || [] });
    }

    if (!Array.isArray(mastersList)) {
      return NextResponse.json({ error: 'Invalid payload, expected array of statement masters' }, { status: 400 });
    }

    const PROHIBITED_NAMES = new Set([
      'Opening Balance Particular',
      'Receipt Particular',
      'Disposal Particular',
      'Reconciliation Item / Summary Label',
    ]);

    const cleanseCols = (cols: any[]) => {
      if (!Array.isArray(cols)) return [];
      return cols.map((c: any) => {
        if (PROHIBITED_NAMES.has(c.name)) {
          return { ...c, name: 'VARIANT' };
        }
        return c;
      });
    };

    // 1. Primary Store: Save directly into dedicated separate stg_masters table
    try {
      const currentKeys = mastersList.map((m: any) => m.key).filter(Boolean);
      if (currentKeys.length > 0) {
        // Clean up any deleted statements from stg_masters table
        await supabase.from('stg_masters').delete().not('key', 'in', `(${currentKeys.map((k: string) => `"${k}"`).join(',')})`);
      } else {
        // When empty (all deleted), clear all rows from stg_masters
        await supabase.from('stg_masters').delete().neq('key', '');
      }

      if (mastersList.length > 0) {
        const rowsToUpsert = mastersList.map((m: any, idx: number) => ({
          key: m.key,
          label: m.label || m.variant || 'Untitled Statement',
          variant: m.variant || m.key || 'Statement',
          description: m.description || '',
          cmpdd_norm: m.cmpdd_norm || '',
          sort_order: typeof m.sort_order === 'number' ? m.sort_order : idx + 1,
          is_active: m.is_active !== undefined ? !!m.is_active : true,
          ob_columns: cleanseCols(m.ob_columns),
          receipt_columns: cleanseCols(m.receipt_columns),
          disposal_columns: cleanseCols(m.disposal_columns),
          recon_columns: cleanseCols(m.recon_columns),
          ob_rows: m.ob_rows || [],
          receipt_rows: m.receipt_rows || [],
          disposal_rows: m.disposal_rows || [],
          reconciliation_rows: m.reconciliation_rows || [],
          updated_by: actorUsername,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('stg_masters').upsert(rowsToUpsert, { onConflict: 'key' });
      }
    } catch (e) {
      console.warn('stg_masters table write warning:', e);
    }

    // 2. Secondary/Fallback Sync: Keep prep_chart_configs updated for compatibility
    try {
      const cleansedMasters = mastersList.map((m: any) => ({
        ...m,
        ob_columns: cleanseCols(m.ob_columns),
        receipt_columns: cleanseCols(m.receipt_columns),
        disposal_columns: cleanseCols(m.disposal_columns),
        recon_columns: cleanseCols(m.recon_columns),
        custom_columns: cleanseCols(m.receipt_columns || m.custom_columns),
      }));

      await supabase.from('prep_chart_configs').upsert({
        config_key: 'stg_masters',
        config_json: cleansedMasters,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    } catch { }

    // 3. Also sync to entries table (report_type = 'TS') for backward compatibility
    try {
      await supabase.from('entries').insert({
        report_type: 'TS',
        notes: JSON.stringify(mastersList),
        created_by: actorUsername,
      });
    } catch { }

    return NextResponse.json({ success: true, masters: mastersList });
  } catch (err: any) {
    console.error('POST /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save statement masters' }, { status: 500 });
  }
}

// DELETE /api/ts/masters?key=XXX or body: { keys: [...], all?: boolean }
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const { searchParams } = new URL(req.url);
    const singleKey = searchParams.get('key');
    const keysParam = searchParams.get('keys');
    let deleteAll = searchParams.get('all') === 'true';

    let keysToDelete: string[] = [];
    if (singleKey) keysToDelete.push(singleKey);
    if (keysParam) {
      keysParam.split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
        if (!keysToDelete.includes(k)) keysToDelete.push(k);
      });
    }

    // Parse body if present for bulk delete or all delete
    try {
      const body = await req.json();
      if (body.all) deleteAll = true;
      if (Array.isArray(body.keys)) {
        body.keys.forEach((k: string) => {
          if (k && !keysToDelete.includes(k)) keysToDelete.push(k);
        });
      } else if (typeof body.key === 'string' && body.key) {
        if (!keysToDelete.includes(body.key)) keysToDelete.push(body.key);
      }
    } catch {
      // Body may be empty on query-string DELETE
    }

    if (!deleteAll && keysToDelete.length === 0) {
      return NextResponse.json({ error: 'Statement master key(s) required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // 1. Delete from dedicated stg_masters table if present
    try {
      if (deleteAll) {
        await supabase.from('stg_masters').delete().neq('key', '');
      } else {
        await supabase.from('stg_masters').delete().in('key', keysToDelete);
      }
    } catch (e) {
      console.warn('stg_masters delete warning:', e);
    }

    // 2. Fetch remaining records strictly from stg_masters table and keep prep_chart_configs in sync
    let remaining: any[] = [];
    try {
      if (!deleteAll) {
        const { data: stgRemaining } = await supabase
          .from('stg_masters')
          .select('*')
          .order('sort_order', { ascending: true });

        if (Array.isArray(stgRemaining)) {
          remaining = stgRemaining;
        }
      }

      await supabase.from('prep_chart_configs').upsert({
        config_key: 'stg_masters',
        config_json: remaining,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    } catch (e) {
      console.warn('stg_masters / prep_chart_configs delete sync error:', e);
    }

    // 3. Sync to entries table
    try {
      await supabase.from('entries').insert({
        report_type: 'TS',
        notes: JSON.stringify(remaining),
        created_by: actorUsername,
      });
    } catch { }

    return NextResponse.json({
      success: true,
      masters: remaining,
      deletedCount: deleteAll ? 'all' : keysToDelete.length,
      message: deleteAll ? 'All statement masters deleted' : `${keysToDelete.length} statement master(s) deleted`
    });
  } catch (err: any) {
    console.error('DELETE /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete statement master' }, { status: 500 });
  }
}
