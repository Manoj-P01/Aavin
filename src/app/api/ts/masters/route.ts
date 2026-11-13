import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const DEFAULT_STG_MASTERS: any[] = [];

// Helper to normalize and preserve column definitions strictly as defined
const sanitizeCols = (cols: any[] | undefined) => {
  if (!Array.isArray(cols)) return [];
  return cols.map((col: any) => ({
    key: col.key,
    name: col.name || col.label || col.key,
    type: col.type || 'number',
    sort_order: typeof col.sort_order === 'number' ? col.sort_order : 0,
    is_active: col.is_active !== undefined ? !!col.is_active : true,
    ...(col.decimals !== undefined ? { decimals: col.decimals } : {}),
    ...(col.unit ? { unit: col.unit } : {}),
    ...(col.formula ? { formula: col.formula } : {}),
  }));
};

// GET /api/ts/masters - Fetch STG Statement Masters strictly from stg_masters table
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { searchParams } = new URL(req.url);
    const statementKey = searchParams.get('key');

    let query = supabase
      .from('stg_masters')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (statementKey) {
      query = query.eq('key', statementKey);
    }

    const { data: stgRows, error: stgErr } = await query;

    if (stgErr) {
      console.error('Error fetching stg_masters:', stgErr);
      return NextResponse.json({ success: false, masters: [], error: stgErr.message }, { status: 500 });
    }

    const masters = (stgRows || []).map((r: any) => ({
      key: r.key,
      label: r.label,
      variant: r.variant || r.key,
      description: r.description || '',
      sort_order: r.sort_order ?? 1,
      is_active: r.is_active !== undefined ? r.is_active : true,
      product_key: r.product_key || null,
      cmpdd_norm_pct: r.cmpdd_norm_pct !== null && r.cmpdd_norm_pct !== undefined ? Number(r.cmpdd_norm_pct) : 0.5,
      ob_columns: sanitizeCols(r.ob_columns),
      receipt_columns: sanitizeCols(r.receipt_columns),
      disposal_columns: sanitizeCols(r.disposal_columns),
      cb_columns: sanitizeCols(r.cb_columns),
      recon_columns: sanitizeCols(r.recon_columns),
      ob_rows: Array.isArray(r.ob_rows) ? r.ob_rows : [],
      receipt_rows: Array.isArray(r.receipt_rows) ? r.receipt_rows : [],
      disposal_rows: Array.isArray(r.disposal_rows) ? r.disposal_rows : [],
      cb_rows: Array.isArray(r.cb_rows) ? r.cb_rows : [],
      reconciliation_rows: Array.isArray(r.reconciliation_rows) ? r.reconciliation_rows : [],
    }));

    return NextResponse.json({ success: true, masters, sourceTable: 'stg_masters' });
  } catch (err: any) {
    console.error('GET /api/ts/masters error:', err);
    return NextResponse.json({ success: false, masters: [], error: err.message }, { status: 500 });
  }
}

// POST /api/ts/masters - Upsert statement masters without deleting omitted keys
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const supabase = getSupabaseServiceClient();

    let mastersList = Array.isArray(body.masters)
      ? body.masters
      : (Array.isArray(body.statements) ? body.statements : (Array.isArray(body) ? body : (body.master ? [body.master] : null)));

    if (!Array.isArray(mastersList) || mastersList.length === 0) {
      return NextResponse.json({ error: 'Invalid payload, expected array of statement masters' }, { status: 400 });
    }

    // Only delete omitted keys when caller explicitly asks for replace_all
    if (body.action === 'replace_all') {
      const currentKeys = mastersList.map((m: any) => m.key).filter(Boolean);
      const { data: existingRows } = await supabase.from('stg_masters').select('key');
      if (Array.isArray(existingRows)) {
        const keysToDelete = existingRows.map((r: any) => r.key).filter((k: string) => k && !currentKeys.includes(k));
        if (keysToDelete.length > 0) {
          await supabase.from('stg_masters').delete().in('key', keysToDelete);
        }
      }
    }

    const rowsToUpsert = mastersList.map((m: any, idx: number) => ({
      key: m.key,
      label: m.label || m.variant || 'Untitled Statement',
      variant: m.variant || m.key || 'Statement',
      description: m.description || '',
      sort_order: typeof m.sort_order === 'number' ? m.sort_order : idx + 1,
      is_active: m.is_active !== undefined ? !!m.is_active : true,
      product_key: m.product_key || null,
      cmpdd_norm_pct: m.cmpdd_norm_pct !== undefined ? Number(m.cmpdd_norm_pct) : (m.cmpdd_norm !== undefined ? Number(m.cmpdd_norm) : 0.5),
      ob_columns: sanitizeCols(m.ob_columns),
      receipt_columns: sanitizeCols(m.receipt_columns),
      disposal_columns: sanitizeCols(m.disposal_columns),
      cb_columns: sanitizeCols(m.cb_columns),
      recon_columns: sanitizeCols(m.recon_columns),
      ob_rows: Array.isArray(m.ob_rows) ? m.ob_rows : [],
      receipt_rows: Array.isArray(m.receipt_rows) ? m.receipt_rows : [],
      disposal_rows: Array.isArray(m.disposal_rows) ? m.disposal_rows : [],
      cb_rows: Array.isArray(m.cb_rows) ? m.cb_rows : [],
      reconciliation_rows: Array.isArray(m.reconciliation_rows) ? m.reconciliation_rows : [],
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }));

    const { data: savedData, error: upsertErr } = await supabase
      .from('stg_masters')
      .upsert(rowsToUpsert, { onConflict: 'key' })
      .select();

    if (upsertErr) {
      console.error('stg_masters upsert error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      masters: savedData,
      savedToStgMasters: true,
    });
  } catch (err: any) {
    console.error('POST /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save statement masters' }, { status: 500 });
  }
}

// DELETE /api/ts/masters?key=XXX or body: { keys: [...], all?: boolean }
export async function DELETE(req: NextRequest) {
  try {
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

    if (deleteAll) {
      await supabase.from('stg_masters').delete().neq('key', '');
      await supabase.from('stg_particular_master').delete().neq('statement_key', '');
    } else {
      await supabase.from('stg_masters').delete().in('key', keysToDelete);
      await supabase.from('stg_particular_master').delete().in('statement_key', keysToDelete);
    }

    const { data: remaining } = await supabase
      .from('stg_masters')
      .select('*')
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      success: true,
      masters: remaining || [],
      deletedCount: deleteAll ? 'all' : keysToDelete.length,
    });
  } catch (err: any) {
    console.error('DELETE /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete statement master' }, { status: 500 });
  }
}
