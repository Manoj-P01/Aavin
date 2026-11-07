import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export interface StgToTsMappingRule {
  id: string;
  rule_key?: string;
  source_statement_key: string;
  source_section: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB' | 'RECON';
  source_row_name: string;
  source_field: string;
  target_section: 'OB' | 'RECEIPT' | 'DISPOSAL_DESPATCH' | 'LOCAL_SALE' | 'OTHER_DISPOSAL' | 'CB';
  target_particular: string;
  target_field: string;
  enabled: boolean;
  description?: string;
  sort_order?: number;
}

export const DEFAULT_STG_TO_TS_RULES: StgToTsMappingRule[] = [
  // 1. Opening Balance (O/B)
  { id: 'rule_ob_wm', rule_key: 'rule_ob_wm', source_statement_key: 'wm', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'WM', target_field: 'all', enabled: true, description: 'STG WM Opening Balance ➔ TS WM (O/B)' },
  { id: 'rule_ob_ssm', rule_key: 'rule_ob_ssm', source_statement_key: 'ssm', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'SSM', target_field: 'all', enabled: true, description: 'STG SSM Opening Balance ➔ TS SSM (O/B)' },
  { id: 'rule_ob_cream', rule_key: 'rule_ob_cream', source_statement_key: 'cream', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'CREAM', target_field: 'all', enabled: true, description: 'STG Cream Opening Balance ➔ TS CREAM (O/B)' },
  { id: 'rule_ob_dlt', rule_key: 'rule_ob_dlt', source_statement_key: 'dlt_milk', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'DLT MILK', target_field: 'all', enabled: true, description: 'STG DLT Milk Opening Balance ➔ TS DLT MILK (O/B)' },
  { id: 'rule_ob_fcm', rule_key: 'rule_ob_fcm', source_statement_key: 'fc_milk', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'FC.MILK', target_field: 'all', enabled: true, description: 'STG FCM Opening Balance ➔ TS FC.MILK (O/B)' },
  { id: 'rule_ob_std', rule_key: 'rule_ob_std', source_statement_key: 'std_milk', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'STD.Milk', target_field: 'all', enabled: true, description: 'STG STD Milk Opening Balance ➔ TS STD.Milk (O/B)' },
  { id: 'rule_ob_smp', rule_key: 'rule_ob_smp', source_statement_key: 'smp', source_section: 'OB', source_row_name: 'OB', source_field: 'all', target_section: 'OB', target_particular: 'SMP', target_field: 'all', enabled: true, description: 'STG SMP Opening Balance ➔ TS SMP (O/B)' },

  // 2. Receipts (WM Block Receipts)
  { id: 'rule_rec_pvelur', rule_key: 'rule_rec_pvelur', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'P.VELUR CC', source_field: 'all', target_section: 'RECEIPT', target_particular: 'P.VELUR CC', target_field: 'all', enabled: true, description: 'STG WM Receipt P.VELUR CC ➔ TS P.VELUR CC' },
  { id: 'rule_rec_bmcs', rule_key: 'rule_rec_bmcs', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: "BMC's", source_field: 'all', target_section: 'RECEIPT', target_particular: "BMC's", target_field: 'all', enabled: true, description: "STG WM Receipt BMC's ➔ TS BMC's" },
  { id: 'rule_rec_lab', rule_key: 'rule_rec_lab', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'LAB SAMPLE RTN', source_field: 'all', target_section: 'RECEIPT', target_particular: 'LAB SAMPLE RTN', target_field: 'all', enabled: true, description: 'STG WM Receipt LAB SAMPLE RTN ➔ TS LAB SAMPLE RTN' },
  { id: 'rule_rec_wf', rule_key: 'rule_rec_wf', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'WF', source_field: 'all', target_section: 'RECEIPT', target_particular: 'WF', target_field: 'all', enabled: true, description: 'STG WM Receipt WF ➔ TS WF' },
  { id: 'rule_rec_smp', rule_key: 'rule_rec_smp', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'SMP', source_field: 'all', target_section: 'RECEIPT', target_particular: 'SMP', target_field: 'all', enabled: true, description: 'STG WM Receipt SMP ➔ TS SMP' },
  { id: 'rule_rec_rinse', rule_key: 'rule_rec_rinse', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'RINSE MILK', source_field: 'all', target_section: 'RECEIPT', target_particular: 'RINSE MILK', target_field: 'all', enabled: true, description: 'STG WM Receipt RINSE MILK ➔ TS RINSE MILK' },
  { id: 'rule_rec_bm', rule_key: 'rule_rec_bm', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'BUTTER MILK', source_field: 'all', target_section: 'RECEIPT', target_particular: 'BUTTER MILK', target_field: 'all', enabled: true, description: 'STG WM Receipt BUTTER MILK ➔ TS BUTTER MILK' },
  { id: 'rule_rec_dlt_rtn', rule_key: 'rule_rec_dlt_rtn', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'DLT SACHET RTN', source_field: 'all', target_section: 'RECEIPT', target_particular: 'DLT SACHET RTN', target_field: 'all', enabled: true, description: 'STG WM Receipt DLT SACHET RTN ➔ TS DLT SACHET RTN' },
  { id: 'rule_rec_fcm_rtn', rule_key: 'rule_rec_fcm_rtn', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'FCM SACHET RTN', source_field: 'all', target_section: 'RECEIPT', target_particular: 'FCM SACHET RTN', target_field: 'all', enabled: true, description: 'STG WM Receipt FCM SACHET RTN ➔ TS FCM SACHET RTN' },
  { id: 'rule_rec_std_rtn', rule_key: 'rule_rec_std_rtn', source_statement_key: 'wm', source_section: 'RECEIPT', source_row_name: 'STD SACHET RTN', source_field: 'all', target_section: 'RECEIPT', target_particular: 'STD SACHET RTN', target_field: 'all', enabled: true, description: 'STG WM Receipt STD SACHET RTN ➔ TS STD SACHET RTN' },

  // 3. Despatch / Sale (SSM Block Disposals)
  { id: 'rule_desp_ambattur', rule_key: 'rule_desp_ambattur', source_statement_key: 'ssm', source_section: 'DISPOSAL', source_row_name: 'AMBATTUR-SSM', source_field: 'all', target_section: 'DISPOSAL_DESPATCH', target_particular: 'AMBATTUR-SSM', target_field: 'all', enabled: true, description: 'STG SSM Disposal AMBATTUR-SSM ➔ TS AMBATTUR-SSM' },
  { id: 'rule_desp_snr', rule_key: 'rule_desp_snr', source_statement_key: 'ssm', source_section: 'DISPOSAL', source_row_name: 'SNR-SSM', source_field: 'all', target_section: 'DISPOSAL_DESPATCH', target_particular: 'SNR-SSM', target_field: 'all', enabled: true, description: 'STG SSM Disposal SNR-SSM ➔ TS SNR-SSM' },
  { id: 'rule_desp_dcpp', rule_key: 'rule_desp_dcpp', source_statement_key: 'ssm', source_section: 'DISPOSAL', source_row_name: 'DCPP-SSM', source_field: 'all', target_section: 'DISPOSAL_DESPATCH', target_particular: 'DCPP-SSM', target_field: 'all', enabled: true, description: 'STG SSM Disposal DCPP-SSM ➔ TS DCPP-SSM' },
  { id: 'rule_desp_erode', rule_key: 'rule_desp_erode', source_statement_key: 'ssm', source_section: 'DISPOSAL', source_row_name: 'ERODE -SSM', source_field: 'all', target_section: 'DISPOSAL_DESPATCH', target_particular: 'ERODE -SSM', target_field: 'all', enabled: true, description: 'STG SSM Disposal ERODE -SSM ➔ TS ERODE -SSM' },
  { id: 'rule_desp_cbe', rule_key: 'rule_desp_cbe', source_statement_key: 'ssm', source_section: 'DISPOSAL', source_row_name: 'CBE-SSM', source_field: 'all', target_section: 'DISPOSAL_DESPATCH', target_particular: 'CBE-SSM', target_field: 'all', enabled: true, description: 'STG SSM Disposal CBE-SSM ➔ TS CBE-SSM' },

  // 4. Local Sales (DLT, FC, STD Sachet Filling)
  { id: 'rule_loc_dlt', rule_key: 'rule_loc_dlt', source_statement_key: 'dlt_milk', source_section: 'DISPOSAL', source_row_name: 'SACHET FILLING', source_field: 'qty_lts', target_section: 'LOCAL_SALE', target_particular: 'DLT MILK', target_field: 'qty_lts', enabled: true, description: 'STG DLT Milk Disposal Sachet Filling ➔ TS DLT MILK (Local Sales Qty Lts)' },
  { id: 'rule_loc_fcm', rule_key: 'rule_loc_fcm', source_statement_key: 'fc_milk', source_section: 'DISPOSAL', source_row_name: 'SACHET FILLING', source_field: 'qty_lts', target_section: 'LOCAL_SALE', target_particular: 'FC.MILK', target_field: 'qty_lts', enabled: true, description: 'STG FCM Disposal Sachet Filling ➔ TS FC.MILK (Local Sales Qty Lts)' },
  { id: 'rule_loc_std', rule_key: 'rule_loc_std', source_statement_key: 'std_milk', source_section: 'DISPOSAL', source_row_name: 'SACHET FILLING', source_field: 'qty_lts', target_section: 'LOCAL_SALE', target_particular: 'STD.Milk', target_field: 'qty_lts', enabled: true, description: 'STG STD Milk Disposal Sachet Filling ➔ TS STD.Milk (Local Sales Qty Lts)' },

  // 5. Closing Balance (C/B)
  { id: 'rule_cb_wm', rule_key: 'rule_cb_wm', source_statement_key: 'wm', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'WM', target_field: 'all', enabled: true, description: 'STG WM Closing Balance ➔ TS WM (C/B)' },
  { id: 'rule_cb_ssm', rule_key: 'rule_cb_ssm', source_statement_key: 'ssm', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'SSM', target_field: 'all', enabled: true, description: 'STG SSM Closing Balance ➔ TS SSM (C/B)' },
  { id: 'rule_cb_cream', rule_key: 'rule_cb_cream', source_statement_key: 'cream', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'CREAM', target_field: 'all', enabled: true, description: 'STG Cream Closing Balance ➔ TS CREAM (C/B)' },
  { id: 'rule_cb_dlt', rule_key: 'rule_cb_dlt', source_statement_key: 'dlt_milk', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'DLT MILK', target_field: 'all', enabled: true, description: 'STG DLT Milk Closing Balance ➔ TS DLT MILK (C/B)' },
  { id: 'rule_cb_fcm', rule_key: 'rule_cb_fcm', source_statement_key: 'fc_milk', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'FC.MILK', target_field: 'all', enabled: true, description: 'STG FCM Closing Balance ➔ TS FC.MILK (C/B)' },
  { id: 'rule_cb_std', rule_key: 'rule_cb_std', source_statement_key: 'std_milk', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'STD.Milk', target_field: 'all', enabled: true, description: 'STG STD Milk Closing Balance ➔ TS STD.Milk (C/B)' },
  { id: 'rule_cb_smp', rule_key: 'rule_cb_smp', source_statement_key: 'smp', source_section: 'CB', source_row_name: 'CB', source_field: 'all', target_section: 'CB', target_particular: 'SMP', target_field: 'all', enabled: true, description: 'STG SMP Closing Balance ➔ TS SMP (C/B)' },
];

// GET /api/ts/stg-mappings
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Try reading from dedicated stg_to_ts_mapping_rules table
    try {
      const { data, error } = await supabase
        .from('stg_to_ts_mapping_rules')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json({ rules: data, source: 'stg_to_ts_mapping_rules' });
      }
    } catch (e) {
      console.warn('Failed reading from stg_to_ts_mapping_rules table:', e);
    }

    // 2. Check prep_chart_configs
    try {
      const { data: cfg, error: cfgErr } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stg_to_ts_mappings')
        .maybeSingle();

      if (!cfgErr && cfg && Array.isArray(cfg.config_json) && cfg.config_json.length > 0) {
        return NextResponse.json({ rules: cfg.config_json, source: 'prep_chart_configs' });
      }
    } catch (e) {
      console.warn('Failed reading prep_chart_configs fallback for stg_to_ts_mappings:', e);
    }

    // 3. Fallback to default constants
    return NextResponse.json({ rules: DEFAULT_STG_TO_TS_RULES, source: 'default_constants' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch STG to TS mappings';
    return NextResponse.json({ error: msg, rules: DEFAULT_STG_TO_TS_RULES }, { status: 500 });
  }
}

// POST /api/ts/stg-mappings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rules: StgToTsMappingRule[] = Array.isArray(body.rules) ? body.rules : [];
    const supabase = getSupabaseServiceClient();

    // 1. Try saving into stg_to_ts_mapping_rules table
    let savedToTable = false;
    try {
      // Clear and re-insert
      const { error: delErr } = await supabase
        .from('stg_to_ts_mapping_rules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (!delErr && rules.length > 0) {
        const formatted = rules.map((r, idx) => ({
          rule_key: r.rule_key || `stg_ts_rule_${idx + 1}_${Date.now()}`,
          source_statement_key: r.source_statement_key,
          source_section: r.source_section,
          source_row_name: r.source_row_name,
          source_field: r.source_field || 'qty_lts',
          target_section: r.target_section,
          target_particular: r.target_particular,
          target_field: r.target_field || 'qty_lts',
          enabled: r.enabled !== false,
          description: r.description || '',
          sort_order: typeof r.sort_order === 'number' ? r.sort_order : idx + 1,
          updated_at: new Date().toISOString(),
        }));

        const { error: insErr } = await supabase
          .from('stg_to_ts_mapping_rules')
          .insert(formatted);

        if (!insErr) savedToTable = true;
      }
    } catch (e) {
      console.warn('stg_to_ts_mapping_rules table write error:', e);
    }

    // 2. Always backup to prep_chart_configs
    try {
      await supabase
        .from('prep_chart_configs')
        .upsert({
          config_key: 'stg_to_ts_mappings',
          config_json: rules,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'config_key' });
    } catch (e) {
      console.warn('prep_chart_configs backup error:', e);
    }

    return NextResponse.json({ success: true, count: rules.length, saved_to_db: savedToTable });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save STG to TS mappings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

