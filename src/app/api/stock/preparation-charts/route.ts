import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export interface ChartColumnDef {
  id?: string;
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  sort_order: number;
  is_active?: boolean;
  [extraProperty: string]: any; // Allow arbitrary dynamic properties in JSON
}

export interface ChartMasterDef {
  id?: string;
  key: string;
  name: string;
  product_variant: string;
  target_fat?: number;
  target_snf?: number;
  target_sp_gr?: number;
  description?: string;
  sort_order: number;
  is_active?: boolean;
  [extraProperty: string]: any; // Allow arbitrary dynamic properties in JSON
}

export interface ChartRowData {
  id?: string;
  variant: string;
  values: Record<string, any>;
  [extraProperty: string]: any;
}

export interface ChartEntryData {
  chart_key: string;
  entry_date: string;
  shift: string;
  rows: ChartRowData[];
  target_batch_liters?: number;
  target_fat?: number;
  target_snf?: number;
  [extraProperty: string]: any;
}

export interface PrepToStockMappingRule {
  id: string;
  sourceChartKey: string;
  sourceVariant: string;
  sourceColKey: string;
  targetRowType: 'RECEIPT' | 'DISPOSAL';
  targetRowLabel?: string;
  targetProductKey: string;
  enabled: boolean;
  description?: string;
}

const DEFAULT_MAPPING_RULES: PrepToStockMappingRule[] = [
  {
    id: 'rule_delite',
    sourceChartKey: '*',
    sourceVariant: 'DELITE',
    sourceColKey: 'qty_lit',
    targetRowType: 'RECEIPT',
    targetProductKey: 'dlt_milk',
    enabled: true,
    description: 'DELITE Preparation Chart Qty(Lit) ➔ DLT.Milk (Receipts)',
  },
  {
    id: 'rule_fcm',
    sourceChartKey: '*',
    sourceVariant: 'FCM',
    sourceColKey: 'qty_lit',
    targetRowType: 'RECEIPT',
    targetProductKey: 'fcm',
    enabled: true,
    description: 'FCM Preparation Chart Qty(Lit) ➔ FCM (Receipts)',
  },
  {
    id: 'rule_std',
    sourceChartKey: '*',
    sourceVariant: 'STD MILK',
    sourceColKey: 'qty_lit',
    targetRowType: 'RECEIPT',
    targetProductKey: 'std_milk',
    enabled: true,
    description: 'STD Preparation Chart Qty(Lit) ➔ STD.Milk (Receipts)',
  },
  {
    id: 'rule_skim',
    sourceChartKey: '*',
    sourceVariant: 'SKIM MILK',
    sourceColKey: 'qty_lit',
    targetRowType: 'RECEIPT',
    targetProductKey: 'skim_milk',
    enabled: true,
    description: 'Skim Milk Preparation Chart Qty(Lit) ➔ SKIM MILK (Receipts)',
  },
];

// GET /api/stock/preparation-charts - Fetch masters, columns & entries strictly from Supabase JSON store
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    let columns: ChartColumnDef[] = [];
    let masters: ChartMasterDef[] = [];
    let mappings: PrepToStockMappingRule[] = [];

    // 1. Fetch Columns JSON array from prep_chart_configs
    try {
      const { data: colsRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'columns')
        .maybeSingle();

      if (colsRes && Array.isArray(colsRes.config_json)) {
        columns = colsRes.config_json.filter((c: any) => c.is_active !== false);
      }
    } catch (e) {
      console.error('Error fetching columns JSON:', e);
    }

    // 2. Fetch Masters JSON array from prep_chart_configs
    try {
      const { data: mastersRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'masters')
        .maybeSingle();

      if (mastersRes && Array.isArray(mastersRes.config_json)) {
        masters = mastersRes.config_json.filter((m: any) => m.is_active !== false);
      }
    } catch (e) {
      console.error('Error fetching masters JSON:', e);
    }

    // 3. Fetch Master Default Templates from prep_chart_configs
    let templates: Record<string, {
      rows: ChartRowData[];
      target_batch_liters?: number;
      target_fat?: number;
      target_snf?: number;
    }> = {};

    try {
      const { data: tmplRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'templates')
        .maybeSingle();

      if (tmplRes && tmplRes.config_json && typeof tmplRes.config_json === 'object') {
        templates = tmplRes.config_json;
      }
    } catch (e) {
      console.error('Error fetching templates JSON:', e);
    }

    // 4. Fetch Custom Mappings Rules from prep_chart_configs
    try {
      const { data: mapRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'mappings')
        .maybeSingle();

      if (mapRes && Array.isArray(mapRes.config_json) && mapRes.config_json.length > 0) {
        mappings = mapRes.config_json;
      } else {
        mappings = DEFAULT_MAPPING_RULES;
      }
    } catch (e) {
      console.error('Error fetching mappings JSON:', e);
      mappings = DEFAULT_MAPPING_RULES;
    }

    // 5. Fetch Entries JSON for requested date & shift
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const shift = url.searchParams.get('shift');

    let entries: Record<string, ChartEntryData> = {};

    if (date && shift) {
      try {
        let query = supabase
          .from('prep_chart_entries')
          .select('*')
          .eq('entry_date', date);

        if (shift === 'F') {
          query = query.in('shift', ['F', 'D']);
        } else {
          query = query.eq('shift', shift);
        }

        const { data: entriesRes } = await query;

        if (Array.isArray(entriesRes) && entriesRes.length > 0) {
          entriesRes.forEach((e: any) => {
            const entryData = typeof e.entry_json === 'string' ? JSON.parse(e.entry_json) : (e.entry_json || {});
            entries[e.chart_key] = {
              chart_key: e.chart_key,
              entry_date: e.entry_date,
              shift: e.shift,
              rows: entryData.rows || [],
              target_batch_liters: entryData.target_batch_liters,
              target_fat: entryData.target_fat,
              target_snf: entryData.target_snf,
              ...entryData,
            };
          });
        }
      } catch (e) {
        console.error('Error fetching entries JSON:', e);
      }
    }

    return NextResponse.json({
      success: true,
      columns,
      masters,
      templates,
      mappings,
      entries,
    });
  } catch (err: any) {
    console.error('GET /api/stock/preparation-charts error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch preparation charts' }, { status: 500 });
  }
}

// POST /api/stock/preparation-charts - Save masters, columns, templates & entries as flexible JSON in Supabase DB
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const supabase = getSupabaseServiceClient();

    // 1. Save Columns JSON array
    if (Array.isArray(body.columns)) {
      await supabase.from('prep_chart_configs').upsert({
        config_key: 'columns',
        config_json: body.columns,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    }

    // 2. Save Masters JSON array
    if (Array.isArray(body.masters)) {
      await supabase.from('prep_chart_configs').upsert({
        config_key: 'masters',
        config_json: body.masters,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    }

    // 3. Save Default Chart Templates
    if (body.templates && typeof body.templates === 'object') {
      await supabase.from('prep_chart_configs').upsert({
        config_key: 'templates',
        config_json: body.templates,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    }

    // 4. Save Custom Mapping Rules JSON array
    if (Array.isArray(body.mappings)) {
      await supabase.from('prep_chart_configs').upsert({
        config_key: 'mappings',
        config_json: body.mappings,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    } else if (body.template && body.template.chart_key) {
      const { data: tmplRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'templates')
        .maybeSingle();

      const existingTemplates = tmplRes?.config_json && typeof tmplRes.config_json === 'object' ? tmplRes.config_json : {};
      const updatedTemplates = {
        ...existingTemplates,
        [body.template.chart_key]: {
          rows: body.template.rows || [],
          target_batch_liters: body.template.target_batch_liters,
          target_fat: body.template.target_fat,
          target_snf: body.template.target_snf,
        }
      };

      await supabase.from('prep_chart_configs').upsert({
        config_key: 'templates',
        config_json: updatedTemplates,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });
    }

    // 4. Save Entry JSON for Date & Shift
    if (body.entry && body.entry.chart_key && body.entry.entry_date && body.entry.shift) {
      await supabase.from('prep_chart_entries').upsert({
        chart_key: body.entry.chart_key,
        entry_date: body.entry.entry_date,
        shift: body.entry.shift,
        entry_json: body.entry,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chart_key,entry_date,shift' });
    }

    return NextResponse.json({
      success: true,
      message: 'JSON configuration saved successfully to Supabase DB!',
    });
  } catch (err: any) {
    console.error('POST /api/stock/preparation-charts error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save preparation charts' }, { status: 500 });
  }
}

// DELETE /api/stock/preparation-charts - Remove column or chart master from JSON array
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const { searchParams } = new URL(req.url);

    const columnKey = searchParams.get('column_key');
    const masterKey = searchParams.get('master_key');

    const supabase = getSupabaseServiceClient();

    if (columnKey) {
      const { data: colsRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'columns')
        .maybeSingle();

      const existingCols = Array.isArray(colsRes?.config_json) ? colsRes.config_json : [];
      const filteredCols = existingCols.filter((c: any) => c.key !== columnKey);

      await supabase.from('prep_chart_configs').upsert({
        config_key: 'columns',
        config_json: filteredCols,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      return NextResponse.json({ success: true, message: `Column '${columnKey}' deleted from JSON config` });
    }

    if (masterKey) {
      const { data: mastersRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'masters')
        .maybeSingle();

      const existingMasters = Array.isArray(mastersRes?.config_json) ? mastersRes.config_json : [];
      const filteredMasters = existingMasters.filter((m: any) => m.key !== masterKey);

      await supabase.from('prep_chart_configs').upsert({
        config_key: 'masters',
        config_json: filteredMasters,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      return NextResponse.json({ success: true, message: `Chart master '${masterKey}' deleted from JSON config` });
    }

    return NextResponse.json({ error: 'Missing column_key or master_key parameter' }, { status: 400 });
  } catch (err: any) {
    console.error('DELETE /api/stock/preparation-charts error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete item' }, { status: 500 });
  }
}
