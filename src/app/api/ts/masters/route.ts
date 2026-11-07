import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const DEFAULT_STG_MASTERS = [
  {
    key: 'wh_milk',
    label: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    name: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'WHOLE MILK',
    product_variant: 'WHOLE MILK',
    sort_order: 1,
    is_active: true,
    receipt_rows: [
      { variant: 'P.VELUR CC', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'P.VELUR CC' } },
      { variant: "BMC's", row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: "BMC's" } },
      { variant: 'LAB SAMPLE RTN', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'LAB SAMPLE RTN' } },
      { variant: 'WF', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WF' } },
      { variant: 'SMP', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP' } },
      { variant: 'RINSE MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'RINSE MILK' } },
      { variant: 'BUTTER MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'BUTTER MILK' } },
      { variant: 'DLT SACHET RTN', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'DLT SACHET RTN' } },
      { variant: 'FCM SACHET RTN', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'FCM SACHET RTN' } },
      { variant: 'STD SACHET RTN', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'STD SACHET RTN' } },
    ],
    disposal_rows: [
      { variant: 'SEPERATION', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SEPERATION' } },
      { variant: 'DLT MILK', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'DLT MILK' } },
      { variant: 'FC.MILK', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'FC.MILK' } },
      { variant: 'STD.Milk', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'STD.Milk' } },
      { variant: 'TM MILK(CURD)', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'TM MILK(CURD)' } },
      { variant: 'CUP CURD', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'CUP CURD' } },
      { variant: 'KHOA', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'KHOA' } },
      { variant: 'LAB SAMPLE', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'LAB SAMPLE' } },
      { variant: 'TO METRO', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'TO METRO' } },
      { variant: 'WF', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'WF' } },
      { variant: 'SMP', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SMP' } },
    ],
  },
  {
    key: 'skim_milk',
    label: 'SKIMMED MILK - RECEIPT AND DISPOSAL STATEMENT',
    name: 'SKIMMED MILK - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'SKIM MILK',
    product_variant: 'SKIM MILK',
    sort_order: 2,
    is_active: true,
    receipt_rows: [
      { variant: 'SKIMMILK RECEIPT', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SKIMMILK RECEIPT' } },
      { variant: 'SMP', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP' } },
      { variant: 'WATER FLUSH', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WATER FLUSH' } },
      { variant: 'BUTTER MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'BUTTER MILK' } },
    ],
    disposal_rows: [
      { variant: 'TM DELITE 3.5/8.5', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'TM DELITE 3.5/8.5' } },
      { variant: 'TM MILK(CURD)', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'TM MILK(CURD)' } },
      { variant: 'AMBATTUR-SSM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'AMBATTUR-SSM' } },
      { variant: 'SNR-SSM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SNR-SSM' } },
      { variant: 'DCPP-SSM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'DCPP-SSM' } },
      { variant: 'ERODE -SSM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'ERODE -SSM' } },
      { variant: 'CBE-SSM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'CBE-SSM' } },
    ],
  },
  {
    key: 'cream',
    label: 'CREAM - RECEIPT AND DISPOSAL STATEMENT',
    name: 'CREAM - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'CREAM',
    product_variant: 'CREAM',
    sort_order: 3,
    is_active: true,
    receipt_rows: [
      { variant: 'CREAM', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'CREAM' } },
    ],
    disposal_rows: [
      { variant: 'FCM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'FCM' } },
      { variant: 'STD', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'STD' } },
      { variant: 'CHURNING', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'CHURNING' } },
    ],
  },
  {
    key: 'separation',
    label: 'SEPARATION - RECEIPT AND DISPOSAL STATEMENT',
    name: 'SEPARATION - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'SEPARATION',
    product_variant: 'SEPARATION',
    sort_order: 4,
    is_active: true,
    receipt_rows: [
      { variant: 'WHOLE MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WHOLE MILK' } },
    ],
    disposal_rows: [
      { variant: 'SKIMMILK', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SKIMMILK' } },
      { variant: 'CREAM', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'CREAM' } },
    ],
  },
  {
    key: 'delite',
    label: 'DELITE - RECEIPT AND DISPOSAL STATEMENT',
    name: 'DELITE - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'DELITE',
    product_variant: 'DELITE',
    sort_order: 5,
    is_active: true,
    receipt_rows: [
      { variant: 'WHOLE MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WHOLE MILK' } },
      { variant: 'SKIMMED MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SKIMMED MILK' } },
      { variant: 'SMP', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP' } },
      { variant: 'WATER', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WATER' } },
    ],
    disposal_rows: [
      { variant: 'SACHET FILLING', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'fcm',
    label: 'FCM - RECEIPT AND DISPOSAL STATEMENT',
    name: 'FCM - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'FCM',
    product_variant: 'FCM',
    sort_order: 6,
    is_active: true,
    receipt_rows: [
      { variant: 'WHOLE MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WHOLE MILK' } },
      { variant: 'CREAM', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'CREAM' } },
      { variant: 'SMP', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP' } },
      { variant: 'WATER', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WATER' } },
    ],
    disposal_rows: [
      { variant: 'SACHET FILLING', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'std',
    label: 'STD - RECEIPT AND DISPOSAL STATEMENT',
    name: 'STD - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'STD',
    product_variant: 'STD',
    sort_order: 7,
    is_active: true,
    receipt_rows: [
      { variant: 'WHOLE MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WHOLE MILK' } },
      { variant: 'CREAM', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'CREAM' } },
      { variant: 'SMP', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP' } },
      { variant: 'WATER', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WATER' } },
    ],
    disposal_rows: [
      { variant: 'SACHET FILLING', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'curd',
    label: 'CURD - RECEIPT AND DISPOSAL STATEMENT',
    name: 'CURD - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'CURD',
    product_variant: 'CURD',
    sort_order: 8,
    is_active: true,
    receipt_rows: [
      { variant: 'WHOLE MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'WHOLE MILK' } },
      { variant: 'SKIMMED MILK', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SKIMMED MILK' } },
      { variant: 'SMP', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP' } },
    ],
    disposal_rows: [
      { variant: 'SACHET FILLING', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'smp_for_rsm',
    label: 'SMP FOR RSM - RECEIPT AND DISPOSAL STATEMENT',
    name: 'SMP FOR RSM - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'SMP FOR RSM',
    product_variant: 'SMP FOR RSM',
    sort_order: 9,
    is_active: true,
    receipt_rows: [
      { variant: 'SMP FOR SNF BOOSTING', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'SMP FOR SNF BOOSTING' } },
    ],
    disposal_rows: [
      { variant: 'DLT MILK', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'DLT MILK' } },
      { variant: 'FC.MILK', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'FC.MILK' } },
      { variant: 'STD.Milk', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'STD.Milk' } },
      { variant: 'TM MILK(CURD)', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'TM MILK(CURD)' } },
      { variant: 'CUP CURD', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'CUP CURD' } },
    ],
  },
].map(m => ({
  ...m,
  default_rows: [
    ...(m.receipt_rows || []),
    ...(m.disposal_rows || []),
  ]
}));

// GET /api/ts/masters - Fetch STG Statement Masters from stg_masters table or prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    let masters: any[] = [];
    let stgTableQueried = false;

    // 1. First try reading from dedicated stg_masters table
    try {
      const { data: stgRows, error: stgErr } = await supabase
        .from('stg_masters')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!stgErr && Array.isArray(stgRows)) {
        stgTableQueried = true;
        if (stgRows.length > 0) {
          masters = stgRows.map((r: any) => ({
            key: r.key,
            label: r.label,
            variant: r.variant,
            sort_order: r.sort_order,
            is_active: r.is_active,
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
      }
    } catch { }

    // 2. If stg_masters table had no records or not found, check prep_chart_configs (config_key = 'stg_masters')
    if (masters.length === 0) {
      const { data: res, error } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stg_masters')
        .maybeSingle();

      if (!error && res && Array.isArray(res.config_json)) {
        // If prep_chart_configs exists (even if empty []), respect user state
        masters = res.config_json;
      } else if (!res && !stgTableQueried) {
        // Only if database has neither stg_masters table nor prep_chart_configs entry, use defaults
        masters = DEFAULT_STG_MASTERS;
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

    // 3. Harmonize master section columns with configured STG columns (stg_columns)
    try {
      const { data: colData } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stg_columns')
        .maybeSingle();

      const configuredCols: any[] = (colData && Array.isArray(colData.config_json) && colData.config_json.length > 0)
        ? colData.config_json
        : [
            { key: 'variant', name: 'VARIANT', type: 'text', sort_order: 1 },
            { key: 'qty_lts', name: 'Qty (Lts)', type: 'number', decimals: 0, sort_order: 2 },
            { key: 'qty_kg', name: 'Qty (Kg)', type: 'calculated', formula: 'qty_lts * sp_gr', decimals: 2, sort_order: 3 },
            { key: 'fat_pct', name: 'Fat%', type: 'number', decimals: 2, sort_order: 4 },
            { key: 'snf_pct', name: 'Snf%', type: 'number', decimals: 2, sort_order: 5 },
            { key: 'sp_gr', name: 'SP.G', type: 'number', decimals: 4, sort_order: 6 },
            { key: 'kg_fat', name: 'Kg.Fat', type: 'calculated', formula: 'qty_kg * fat_pct / 100', decimals: 3, sort_order: 7 },
            { key: 'kg_snf', name: 'Kg.Snf', type: 'calculated', formula: 'qty_kg * snf_pct / 100', decimals: 3, sort_order: 8 },
          ];

      const PROHIBITED_NAMES = new Set([
        'Opening Balance Particular',
        'Receipt Particular',
        'Disposal Particular',
        'Reconciliation Item / Summary Label',
      ]);

      const cleanAndSyncCols = (existingCols: any[] | undefined, isRecon: boolean = false) => {
        if (!Array.isArray(existingCols) || existingCols.length === 0) {
          return configuredCols.map((cfgCol: any, idx: number) => ({
            ...cfgCol,
            key: isRecon && cfgCol.key === 'variant' ? 'label' : cfgCol.key,
            sort_order: idx + 1,
          }));
        }

        // Cleanse prohibited artificial names from existing columns, preserving all user edits & deletions
        return existingCols.map((col: any) => {
          if (PROHIBITED_NAMES.has(col.name)) {
            const matchingCfg = configuredCols.find((c: any) => c.key === col.key || (isRecon && col.key === 'label' && c.key === 'variant'));
            return {
              ...col,
              name: matchingCfg?.name || (col.key === 'variant' || col.key === 'label' ? 'VARIANT' : col.key),
            };
          }
          return col;
        });
      };

      masters = masters.map((m: any) => ({
        ...m,
        ob_columns: cleanAndSyncCols(m.ob_columns, false),
        receipt_columns: cleanAndSyncCols(m.receipt_columns, false),
        disposal_columns: cleanAndSyncCols(m.disposal_columns, false),
        recon_columns: cleanAndSyncCols(m.recon_columns, true),
      }));
    } catch (e) {
      console.warn('Harmonize masters with stg_columns warning:', e);
    }

    return NextResponse.json({ success: true, masters });
  } catch (err: any) {
    console.error('GET /api/ts/masters error:', err);
    return NextResponse.json({ success: true, masters: DEFAULT_STG_MASTERS });
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

    // Handle reset to defaults request
    if (body.action === 'reset') {
      mastersList = DEFAULT_STG_MASTERS;
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

    // 2. Delete from prep_chart_configs
    let remaining: any[] = [];
    try {
      const { data: res } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stg_masters')
        .maybeSingle();

      if (res && Array.isArray(res.config_json)) {
        remaining = deleteAll ? [] : res.config_json.filter((m: any) => !keysToDelete.includes(m.key));
      }

      await supabase.from('prep_chart_configs').upsert({
        config_key: 'stg_masters',
        config_json: remaining,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    } catch (e) {
      console.warn('prep_chart_configs delete warning:', e);
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
