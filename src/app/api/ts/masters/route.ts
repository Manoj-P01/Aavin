import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// Default empty fallback array (all statement masters are strictly fetched from DB table stg_masters)
export const DEFAULT_STG_MASTERS: any[] = [];

// Cleanse prohibited artificial names from column definitions
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

// GET /api/ts/masters - Fetch STG Statement Masters strictly from stg_masters table or prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    let masters: any[] = [];
    let sourceTable = 'none';

    // 1. Fetch strictly from dedicated stg_masters table
    try {
      const { data: stgRows, error: stgErr } = await supabase
        .from('stg_masters')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!stgErr && Array.isArray(stgRows) && stgRows.length > 0) {
        sourceTable = 'stg_masters';
        masters = stgRows.map((r: any) => {
          const meta = typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {};
          const normVal = meta.cmpdd_norm || r.cmpdd_norm || '0.5';
          return {
            key: r.key,
            label: r.label,
            variant: r.variant,
            description: r.description || '',
            sort_order: r.sort_order,
            is_active: r.is_active,
            cmpdd_norm: normVal,
            metadata: { ...meta, cmpdd_norm: normVal },
            ob_columns: cleanseCols(r.ob_columns),
            receipt_columns: cleanseCols(r.receipt_columns),
            disposal_columns: cleanseCols(r.disposal_columns),
            recon_columns: cleanseCols(r.recon_columns),
            ob_rows: r.ob_rows || [],
            receipt_rows: r.receipt_rows || [],
            disposal_rows: r.disposal_rows || [],
            reconciliation_rows: r.reconciliation_rows || [],
          };
        });
      } else if (stgErr) {
        console.warn('stg_masters table read error (falling back to prep_chart_configs):', stgErr.message || stgErr);
      }
    } catch (e) {
      console.warn('stg_masters table read exception:', e);
    }

    // 2. If stg_masters was not available or empty, check prep_chart_configs
    if (masters.length === 0) {
      try {
        const { data: res, error: cfgErr } = await supabase
          .from('prep_chart_configs')
          .select('config_json')
          .eq('config_key', 'stg_masters')
          .maybeSingle();

        if (!cfgErr && res && Array.isArray(res.config_json) && res.config_json.length > 0) {
          sourceTable = 'prep_chart_configs';
          masters = res.config_json.map((m: any) => {
            const meta = typeof m.metadata === 'object' && m.metadata !== null ? m.metadata : {};
            const normVal = meta.cmpdd_norm || m.cmpdd_norm || '0.5';
            return {
              ...m,
              cmpdd_norm: normVal,
              metadata: { ...meta, cmpdd_norm: normVal },
              ob_columns: cleanseCols(m.ob_columns),
              receipt_columns: cleanseCols(m.receipt_columns),
              disposal_columns: cleanseCols(m.disposal_columns),
              recon_columns: cleanseCols(m.recon_columns),
            };
          });
        }
      } catch (e) {
        console.warn('prep_chart_configs read exception:', e);
      }
    }

    return NextResponse.json({ success: true, masters, sourceTable });
  } catch (err: any) {
    console.error('GET /api/ts/masters error:', err);
    return NextResponse.json({ success: true, masters: [], error: err.message });
  }
}

// POST /api/ts/masters - Save STG Statement Masters directly to stg_masters table and prep_chart_configs
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
      const { data: stgRows, error: resetErr } = await supabase
        .from('stg_masters')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!resetErr && Array.isArray(stgRows)) {
        return NextResponse.json({ success: true, masters: stgRows });
      }

      // Fallback reset to prep_chart_configs
      const { data: cfgRow } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stg_masters')
        .maybeSingle();

      return NextResponse.json({ success: true, masters: cfgRow?.config_json || [] });
    }

    if (!Array.isArray(mastersList)) {
      return NextResponse.json({ error: 'Invalid payload, expected array of statement masters' }, { status: 400 });
    }

    let stgTableSaved = false;
    let stgTableError: string | null = null;
    let prepChartConfigsSaved = false;
    let prepChartConfigsError: string | null = null;

    // 1. Primary Store: Save directly into dedicated separate stg_masters table
    try {
      const currentKeys = mastersList.map((m: any) => m.key).filter(Boolean);

      // Clean up any deleted statements from stg_masters table cleanly using key difference
      const { data: existingRows } = await supabase
        .from('stg_masters')
        .select('key');

      if (Array.isArray(existingRows)) {
        const keysToDelete = existingRows
          .map((r: any) => r.key)
          .filter((k: string) => k && !currentKeys.includes(k));

        if (keysToDelete.length > 0) {
          await supabase.from('stg_masters').delete().in('key', keysToDelete);
        }
      }

      if (mastersList.length > 0) {
        const rowsToUpsert = mastersList.map((m: any, idx: number) => {
          const meta = {
            ...(typeof m.metadata === 'object' && m.metadata !== null ? m.metadata : {}),
            cmpdd_norm: m.cmpdd_norm !== undefined && m.cmpdd_norm !== null && m.cmpdd_norm !== ''
              ? String(m.cmpdd_norm)
              : (m.metadata?.cmpdd_norm || '0.5'),
          };
          return {
            key: m.key,
            label: m.label || m.variant || 'Untitled Statement',
            variant: m.variant || m.key || 'Statement',
            description: m.description || '',
            metadata: meta,
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
          };
        });

        const { error: upsertErr } = await supabase
          .from('stg_masters')
          .upsert(rowsToUpsert, { onConflict: 'key' });

        if (!upsertErr) {
          stgTableSaved = true;
        } else {
          stgTableError = upsertErr.message;
          console.warn('stg_masters table write warning:', upsertErr.message);
        }
      } else {
        // When empty (all deleted), clear all rows from stg_masters
        const { error: delErr } = await supabase.from('stg_masters').delete().neq('key', '');
        if (!delErr) stgTableSaved = true;
      }
    } catch (e: any) {
      stgTableError = e.message || String(e);
      console.warn('stg_masters table write exception:', e);
    }

    // 2. Secondary Sync: Keep prep_chart_configs updated as resilient sync / fallback
    try {
      const cleansedMasters = mastersList.map((m: any) => {
        const meta = {
          ...(typeof m.metadata === 'object' && m.metadata !== null ? m.metadata : {}),
          cmpdd_norm: m.cmpdd_norm !== undefined && m.cmpdd_norm !== null && m.cmpdd_norm !== ''
            ? String(m.cmpdd_norm)
            : (m.metadata?.cmpdd_norm || '0.5'),
        };
        return {
          ...m,
          cmpdd_norm: meta.cmpdd_norm,
          metadata: meta,
          ob_columns: cleanseCols(m.ob_columns),
          receipt_columns: cleanseCols(m.receipt_columns),
          disposal_columns: cleanseCols(m.disposal_columns),
          recon_columns: cleanseCols(m.recon_columns),
          custom_columns: cleanseCols(m.receipt_columns || m.custom_columns),
        };
      });

      const { error: cfgErr } = await supabase.from('prep_chart_configs').upsert({
        config_key: 'stg_masters',
        config_json: cleansedMasters,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      if (!cfgErr) {
        prepChartConfigsSaved = true;
      } else {
        prepChartConfigsError = cfgErr.message;
        console.warn('prep_chart_configs write warning:', cfgErr.message);
      }
    } catch (e: any) {
      prepChartConfigsError = e.message || String(e);
      console.warn('prep_chart_configs write exception:', e);
    }

    // If both writes failed, throw an informative error
    if (!stgTableSaved && !prepChartConfigsSaved) {
      return NextResponse.json({
        error: `Failed to save statement formulation tables to database. stg_masters error: ${stgTableError || 'unknown'}. prep_chart_configs error: ${prepChartConfigsError || 'unknown'}. Please make sure migration 017_stg_masters_table.sql has been executed in Supabase SQL Editor.`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      masters: mastersList,
      savedToStgMasters: stgTableSaved,
      savedToPrepChartConfigs: prepChartConfigsSaved,
      stgTableError: stgTableError,
    });
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

    // 1. Delete from dedicated stg_masters table
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
