import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export interface STGColumnDef {
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
  sort_order?: number;
  is_active?: boolean;
}

export const DEFAULT_STG_COLUMNS: STGColumnDef[] = [
  { key: 'variant', name: 'VARIANT', type: 'text', sort_order: 1 },
  { key: 'qty_lts', name: 'QTY (LTS)', type: 'number', decimals: 0, sort_order: 2 },
  { key: 'qty_kg', name: 'QTY (KG)', type: 'calculated', formula: 'qty_lts * sp_gr', decimals: 2, sort_order: 3 },
  { key: 'fat_pct', name: 'FAT (%)', type: 'number', decimals: 2, sort_order: 4 },
  { key: 'snf_pct', name: 'SNF (%)', type: 'number', decimals: 2, sort_order: 5 },
  { key: 'sp_gr', name: 'SP.GR', type: 'number', decimals: 4, sort_order: 6 },
  { key: 'kg_fat', name: 'KG FAT', type: 'calculated', formula: 'qty_kg * fat_pct / 100', decimals: 3, sort_order: 7 },
  { key: 'kg_snf', name: 'KG SNF', type: 'calculated', formula: 'qty_kg * snf_pct / 100', decimals: 3, sort_order: 8 },
];

// GET /api/ts/columns - Fetch STG column definitions strictly from DB table prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: res, error } = await supabase
      .from('prep_chart_configs')
      .select('config_json')
      .eq('config_key', 'stg_columns')
      .maybeSingle();

    let columns: STGColumnDef[] = [];
    if (!error && res && Array.isArray(res.config_json)) {
      columns = res.config_json;
    } else {
      columns = DEFAULT_STG_COLUMNS;
    }

    return NextResponse.json({ success: true, columns });
  } catch (err: any) {
    console.error('GET /api/ts/columns error:', err);
    return NextResponse.json({ success: true, columns: DEFAULT_STG_COLUMNS });
  }
}

// POST /api/ts/columns - Save STG column definitions to prep_chart_configs and synchronize all statement masters
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const columns: STGColumnDef[] = Array.isArray(body.columns) ? body.columns : body;
    if (!Array.isArray(columns)) {
      return NextResponse.json({ error: 'Invalid payload, expected array of columns' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // 1. Primary Save: store configured columns to prep_chart_configs
    const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
      config_key: 'stg_columns',
      config_json: columns,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'config_key' });

    if (upsertErr) throw upsertErr;

    // 2. Synchronize all existing statement masters in `stg_masters` table and `prep_chart_configs`
    try {
      const PROHIBITED_NAMES = new Set([
        'Opening Balance Particular',
        'Receipt Particular',
        'Disposal Particular',
        'Reconciliation Item / Summary Label',
      ]);

      const syncSectionCols = (
        existingCols: any[] | undefined,
        isRecon: boolean = false
      ) => {
        return columns.map((cfgCol: any, idx: number) => {
          const existing = Array.isArray(existingCols)
            ? existingCols.find((c: any) => c.key === cfgCol.key || (isRecon && cfgCol.key === 'variant' && c.key === 'label'))
            : null;

          // Discard prohibited artificial names; strictly use configured column name unless a valid user custom name was given
          const colName = existing?.name && !PROHIBITED_NAMES.has(existing.name)
            ? existing.name
            : cfgCol.name;

          return {
            ...cfgCol,
            key: isRecon && (existing?.key === 'label' || cfgCol.key === 'label') ? 'label' : cfgCol.key,
            name: colName,
            type: cfgCol.type || existing?.type || (cfgCol.key === 'variant' || cfgCol.key === 'label' ? 'text' : 'number'),
            formula: existing?.formula || cfgCol.formula,
            decimals: cfgCol.decimals !== undefined ? cfgCol.decimals : existing?.decimals,
            unit: cfgCol.unit || existing?.unit,
            sort_order: idx + 1,
            is_active: cfgCol.is_active !== undefined ? cfgCol.is_active : true,
          };
        });
      };

      // 2a. Update dedicated stg_masters table
      const { data: stgRows, error: stgErr } = await supabase.from('stg_masters').select('*');
      if (!stgErr && Array.isArray(stgRows) && stgRows.length > 0) {
        const updatedStgRows = stgRows.map((r: any) => {
          const ob_columns = syncSectionCols(r.ob_columns, false);
          const receipt_columns = syncSectionCols(r.receipt_columns, false);
          const disposal_columns = syncSectionCols(r.disposal_columns, false);
          const recon_columns = syncSectionCols(r.recon_columns, true);

          return {
            ...r,
            ob_columns,
            receipt_columns,
            disposal_columns,
            recon_columns,
            custom_columns: receipt_columns,
            updated_by: actorUsername,
            updated_at: new Date().toISOString(),
          };
        });

        await supabase.from('stg_masters').upsert(updatedStgRows, { onConflict: 'key' });
      }

      // 2b. Update prep_chart_configs ('stg_masters')
      const { data: stgConfig } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stg_masters')
        .maybeSingle();

      if (stgConfig && Array.isArray(stgConfig.config_json) && stgConfig.config_json.length > 0) {
        const updatedMastersConfig = stgConfig.config_json.map((m: any) => {
          const ob_columns = syncSectionCols(m.ob_columns, false);
          const receipt_columns = syncSectionCols(m.receipt_columns, false);
          const disposal_columns = syncSectionCols(m.disposal_columns, false);
          const recon_columns = syncSectionCols(m.recon_columns, true);

          return {
            ...m,
            ob_columns,
            receipt_columns,
            disposal_columns,
            recon_columns,
            custom_columns: receipt_columns,
          };
        });

        await supabase.from('prep_chart_configs').upsert({
          config_key: 'stg_masters',
          config_json: updatedMastersConfig,
          updated_by: actorUsername,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'config_key' });
      }
    } catch (syncErr) {
      console.warn('Failed to sync masters columns:', syncErr);
    }

    return NextResponse.json({ success: true, columns });
  } catch (err: any) {
    console.error('POST /api/ts/columns error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save STG columns' }, { status: 500 });
  }
}
