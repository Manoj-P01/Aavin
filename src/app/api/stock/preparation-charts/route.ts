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
  decimals?: number; // 0 for Whole Number (102), 1 for 1.0, 2 for 1.02, 3 for 1.023, etc.
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

export interface ChartBatchData {
  batch_number: number;
  batch_name?: string;
  target_batch_liters?: number;
  target_fat?: number;
  target_snf?: number;
  rows: ChartRowData[];
}

export interface ChartEntryData {
  chart_key: string;
  entry_date: string;
  shift: string;
  batches?: ChartBatchData[];
  rows?: ChartRowData[];
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

    // 4. Fetch Custom Mappings Rules strictly from dedicated table prep_to_stock_mapping_rules
    try {
      const { data: dbRules, error: dbErr } = await supabase
        .from('prep_to_stock_mapping_rules')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!dbErr && dbRules) {
        mappings = dbRules.map(r => ({
          id: r.id || r.rule_key,
          sourceChartKey: r.source_chart_key || '*',
          sourceVariant: r.source_variant,
          sourceColKey: r.source_col_key || 'qty_lit',
          targetRowType: r.target_row_type || 'RECEIPT',
          targetRowLabel: r.target_row_label || undefined,
          targetProductKey: r.target_product_key,
          enabled: r.enabled !== false,
          description: r.description || '',
        }));
      } else {
        mappings = [];
      }
    } catch (e) {
      console.error('Error fetching prep_to_stock_mapping_rules:', e);
      mappings = [];
    }

    // 5. Fetch Entries JSON for requested date & shift
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const shift = url.searchParams.get('shift');

    let entries: Record<string, ChartEntryData> = {};

    if (date) {
      try {
        let query = supabase
          .from('prep_chart_entries')
          .select('*')
          .eq('entry_date', date);

        if (shift) {
          if (shift === 'F') {
            query = query.in('shift', ['F', 'D', 'N']);
          } else {
            query = query.in('shift', [shift, 'F', 'D', 'N']);
          }
        }

        const { data: entriesRes } = await query;

        if (Array.isArray(entriesRes) && entriesRes.length > 0) {
          entriesRes.forEach((e: any) => {
            const entryData = typeof e.entry_json === 'string' ? JSON.parse(e.entry_json) : (e.entry_json || {});
            
            let batchesList: ChartBatchData[] = Array.isArray(entryData.batches) && entryData.batches.length > 0
              ? entryData.batches
              : [];

            if (batchesList.length === 0 && Array.isArray(entryData.rows) && entryData.rows.length > 0) {
              batchesList = [{
                batch_number: 1,
                batch_name: 'Batch #1',
                target_batch_liters: entryData.target_batch_liters,
                target_fat: entryData.target_fat,
                target_snf: entryData.target_snf,
                rows: entryData.rows,
              }];
            }

            entries[e.chart_key] = {
              chart_key: e.chart_key,
              entry_date: e.entry_date,
              shift: e.shift,
              batches: batchesList,
              rows: entryData.rows || (batchesList[0]?.rows || []),
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

    // 4. Save Custom Mapping Rules into dedicated prep_to_stock_mapping_rules table
    if (Array.isArray(body.mappings)) {
      try {
        // Clear old mapping rules and insert fresh list to support deletes and reordering
        await supabase.from('prep_to_stock_mapping_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const dbRows = body.mappings.map((m: any, idx: number) => ({
          rule_key: m.id || `rule_${idx}`,
          source_chart_key: m.sourceChartKey || '*',
          source_variant: m.sourceVariant || '',
          source_col_key: m.sourceColKey || 'qty_lit',
          target_row_type: m.targetRowType || 'RECEIPT',
          target_row_label: m.targetRowLabel || null,
          target_product_key: m.targetProductKey || '',
          enabled: m.enabled !== false,
          description: m.description || '',
          sort_order: idx + 1,
          updated_by: actorUsername,
          updated_at: new Date().toISOString(),
        }));

        await supabase.from('prep_to_stock_mapping_rules').upsert(dbRows, { onConflict: 'rule_key' });
      } catch (err) {
        console.warn('Dedicated prep_to_stock_mapping_rules table save warning:', err);
      }

      // Clean up legacy prep_chart_configs mappings key if present
      try {
        await supabase.from('prep_chart_configs').delete().eq('config_key', 'mappings');
      } catch (e) {
        // ignore error
      }
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
