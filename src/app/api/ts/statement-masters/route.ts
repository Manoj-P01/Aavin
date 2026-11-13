import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

// GET /api/ts/statement-masters
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Try reading from dedicated ts_masters table
    try {
      const { data, error } = await supabase
        .from('ts_masters')
        .select('id, key, label, description, is_active, sort_order, columns, ob_particulars, receipt_particulars, despatch_particulars, local_sale_particulars, other_disposal_particulars, recon_rows, updated_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({ master: data, source: 'ts_masters' });
      }
    } catch (e) {
      console.warn('Failed reading ts_masters table, checking prep_chart_configs:', e);
    }

    // 2. Fallback to prep_chart_configs
    try {
      const { data: cfg, error: cfgErr } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'ts_masters')
        .maybeSingle();

      if (!cfgErr && cfg && cfg.config_json) {
        return NextResponse.json({ master: cfg.config_json, source: 'prep_chart_configs' });
      }
    } catch (e) {
      console.warn('Failed reading prep_chart_configs fallback:', e);
    }

    // 3. Return empty master if none configured in database
    return NextResponse.json({ master: null, source: 'none' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch TS statement masters';
    return NextResponse.json({ error: msg, master: null }, { status: 500 });
  }
}

// POST /api/ts/statement-masters
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    const masterToSave = {
      key: body.key || 'default_ts',
      label: body.label || 'Total Solids (TS) Statement',
      description: body.description || '',
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 1,
      is_active: body.is_active !== false,
      columns: Array.isArray(body.columns) ? body.columns : [],
      ob_rows: Array.isArray(body.ob_rows) ? body.ob_rows : [],
      receipt_rows: Array.isArray(body.receipt_rows) ? body.receipt_rows : [],
      despatch_rows: Array.isArray(body.despatch_rows) ? body.despatch_rows : [],
      local_sale_rows: Array.isArray(body.local_sale_rows) ? body.local_sale_rows : [],
      other_disposal_rows: Array.isArray(body.other_disposal_rows) ? body.other_disposal_rows : [],
      cb_rows: Array.isArray(body.cb_rows) ? body.cb_rows : [],
      reconciliation_rows: Array.isArray(body.reconciliation_rows) ? body.reconciliation_rows : [],
      updated_at: new Date().toISOString(),
    };

    // 1. Save to prep_chart_configs
    const { error: cfgErr } = await supabase
      .from('prep_chart_configs')
      .upsert({
        config_key: 'ts_masters',
        config_json: masterToSave,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

    if (cfgErr) {
      console.warn('Could not save to prep_chart_configs:', cfgErr);
    }

    // 2. Also upsert to ts_masters table if available
    try {
      await supabase
        .from('ts_masters')
        .upsert({
          key: masterToSave.key,
          label: masterToSave.label,
          description: masterToSave.description,
          sort_order: masterToSave.sort_order,
          is_active: masterToSave.is_active,
          columns: masterToSave.columns,
          ob_particulars: masterToSave.ob_rows,
          receipt_particulars: masterToSave.receipt_rows,
          despatch_particulars: masterToSave.despatch_rows,
          local_sale_particulars: masterToSave.local_sale_rows,
          other_disposal_particulars: masterToSave.other_disposal_rows,
          recon_rows: masterToSave.reconciliation_rows,
          updated_at: masterToSave.updated_at,
        }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Could not upsert to ts_masters table:', e);
    }

    return NextResponse.json({ success: true, master: masterToSave });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save TS statement master';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
