import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export const DEFAULT_TS_MASTER = {
  key: 'default_ts',
  label: 'Total Solids (TS) Statement',
  description: 'Default Total Solids Statement master template and formulations matching standard plant dairy operations.',
  sort_order: 1,
  is_active: true,
  columns: [
    { key: 'sno', name: 'S.no', type: 'number', sort_order: 1, is_active: true },
    { key: 'particular', name: 'Particular', type: 'text', sort_order: 2, is_active: true },
    { key: 'qty_lts', name: 'Milk (Lit)', type: 'number', unit: 'Lts', decimals: 2, sort_order: 3, is_active: true },
    { key: 'qty_kg', name: 'Milk (Kg)', type: 'calculated', formula: 'qty_lts * sp_gr', unit: 'Kg', decimals: 2, sort_order: 4, is_active: true },
    { key: 'fat_pct', name: 'Avg Fat %', type: 'number', unit: '%', decimals: 2, sort_order: 5, is_active: true },
    { key: 'snf_pct', name: 'Avg SNF %', type: 'number', unit: '%', decimals: 2, sort_order: 6, is_active: true },
    { key: 'sp_gr', name: 'Sp. Gr', type: 'calculated', formula: '1 + (snf_pct - (0.2 * fat_pct) - 0.36) / 250', decimals: 4, sort_order: 7, is_active: true },
    { key: 'kg_fat', name: 'Kg Fat', type: 'calculated', formula: 'qty_kg * fat_pct / 100', unit: 'Kg', decimals: 2, sort_order: 8, is_active: true },
    { key: 'kg_snf', name: 'Kg SNF', type: 'calculated', formula: 'qty_kg * snf_pct / 100', unit: 'Kg', decimals: 2, sort_order: 9, is_active: true },
  ],
  ob_rows: [
    { variant: 'WM', fat_pct: 3.93, snf_pct: 7.95, sp_gr: 1.0272 },
    { variant: 'SSM', fat_pct: 0.05, snf_pct: 8.14, sp_gr: 1.0311 },
    { variant: 'CREAM', fat_pct: 39.21, snf_pct: 5.53, sp_gr: 0.9893 },
    { variant: 'DLT MILK', fat_pct: 3.5, snf_pct: 8.5, sp_gr: 1.0298 },
    { variant: 'FC.MILK', fat_pct: 6.0, snf_pct: 9.0, sp_gr: 1.0298 },
    { variant: 'STD.Milk', fat_pct: 4.5, snf_pct: 8.5, sp_gr: 1.0290 },
    { variant: 'SMP', fat_pct: 0.5, snf_pct: 96.3, sp_gr: 1.3834 },
  ],
  receipt_rows: [
    { variant: 'P.VELUR CC' },
    { variant: "BMC's" },
    { variant: 'LAB SAMPLE RTN' },
    { variant: 'WF' },
    { variant: 'SMP', fat_pct: 0.5, snf_pct: 96.3 },
    { variant: 'RINSE MILK' },
    { variant: 'BUTTER MILK' },
    { variant: 'DLT SACHET RTN' },
    { variant: 'FCM SACHET RTN' },
    { variant: 'STD SACHET RTN' },
  ],
  despatch_rows: [
    { variant: 'AMBATTUR-SSM' },
    { variant: 'SNR-SSM' },
    { variant: 'DCPP-SSM' },
    { variant: 'ERODE -SSM' },
    { variant: 'CBE-SSM' },
  ],
  local_sale_rows: [
    { variant: 'DLT MILK', fat_pct: 3.5, snf_pct: 8.5 },
    { variant: 'FC.MILK', fat_pct: 6.0, snf_pct: 9.0 },
    { variant: 'STD.Milk', fat_pct: 4.5, snf_pct: 8.5 },
    { variant: 'OTHERS' },
  ],
  other_disposal_rows: [
    { variant: 'SMP' },
    { variant: 'CURD/ BM' },
    { variant: 'TO KHOA' },
    { variant: 'LAB SAMPLE' },
    { variant: 'CREAM-CON' },
  ],
  cb_rows: [
    { variant: 'WM', fat_pct: 3.93, snf_pct: 7.95, sp_gr: 1.0272 },
    { variant: 'SSM', fat_pct: 0.05, snf_pct: 8.14, sp_gr: 1.0311 },
    { variant: 'CREAM', fat_pct: 39.21, snf_pct: 5.53, sp_gr: 0.9893 },
    { variant: 'DLT MILK', fat_pct: 3.5, snf_pct: 8.5, sp_gr: 1.0298 },
    { variant: 'FC.MILK', fat_pct: 6.0, snf_pct: 9.0, sp_gr: 1.0298 },
    { variant: 'STD.Milk', fat_pct: 4.5, snf_pct: 8.5, sp_gr: 1.0290 },
    { variant: 'SMP', fat_pct: 0.5, snf_pct: 96.3, sp_gr: 1.3834 },
  ],
  reconciliation_rows: [
    { id: 'arrival_total', label: 'TOTAL ARRIVAL', formula: 'SUM(OB) + SUM(RECEIPT)', is_formula: true },
    { id: 'disposal_total', label: 'TOTAL DISPOSAL', formula: 'SUM(DESPATCH) + SUM(LOCAL) + SUM(OTHER) + SUM(CB)', is_formula: true },
    { id: 'loss', label: 'LOSS', formula: 'TOTAL_DISPOSAL - TOTAL_ARRIVAL', is_formula: true },
    { id: 'loss_pct', label: 'LOSS %', formula: '(LOSS / TOTAL_ARRIVAL) * 100', is_formula: true },
    { id: 'cmpdd_loss_pct', label: 'CMPDD LOSS %', values: { kg_fat: 0.5, kg_snf: 0.5 } },
  ],
};

// GET /api/ts/statement-masters
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Try reading from dedicated ts_masters table
    try {
      const { data, error } = await supabase
        .from('ts_masters')
        .select('*')
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

    // 3. Fallback to default constants
    return NextResponse.json({ master: DEFAULT_TS_MASTER, source: 'default_constants' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch TS statement masters';
    return NextResponse.json({ error: msg, master: DEFAULT_TS_MASTER }, { status: 500 });
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
      columns: Array.isArray(body.columns) ? body.columns : DEFAULT_TS_MASTER.columns,
      ob_rows: Array.isArray(body.ob_rows) ? body.ob_rows : [],
      receipt_rows: Array.isArray(body.receipt_rows) ? body.receipt_rows : [],
      despatch_rows: Array.isArray(body.despatch_rows) ? body.despatch_rows : [],
      local_sale_rows: Array.isArray(body.local_sale_rows) ? body.local_sale_rows : [],
      other_disposal_rows: Array.isArray(body.other_disposal_rows) ? body.other_disposal_rows : [],
      cb_rows: Array.isArray(body.cb_rows) ? body.cb_rows : [],
      reconciliation_rows: Array.isArray(body.reconciliation_rows) ? body.reconciliation_rows : [],
      updated_at: new Date().toISOString(),
    };

    // 1. Save to ts_masters
    let savedToTsMasters = false;
    try {
      const { error: upsertErr } = await supabase
        .from('ts_masters')
        .upsert(masterToSave, { onConflict: 'key' });

      if (!upsertErr) {
        savedToTsMasters = true;
      } else {
        console.warn('ts_masters upsert error:', upsertErr.message);
      }
    } catch (e) {
      console.warn('ts_masters upsert exception:', e);
    }

    // 2. Always backup to prep_chart_configs for durability
    try {
      await supabase
        .from('prep_chart_configs')
        .upsert({
          config_key: 'ts_masters',
          config_json: masterToSave,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'config_key' });
    } catch (e) {
      console.warn('prep_chart_configs backup exception:', e);
    }

    return NextResponse.json({
      success: true,
      master: masterToSave,
      saved_to_db: savedToTsMasters,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save TS statement masters';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

