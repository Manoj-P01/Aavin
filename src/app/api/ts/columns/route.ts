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

export interface STGColumnSections {
  ob: STGColumnDef[];
  receipt: STGColumnDef[];
  disposal: STGColumnDef[];
  cb: STGColumnDef[];
  recon: STGColumnDef[];
}

export const DEFAULT_STG_SECTIONS: STGColumnSections = {
  ob: [],
  receipt: [],
  disposal: [],
  cb: [],
  recon: [],
};

export const DEFAULT_STG_COLUMNS: STGColumnDef[] = [];

// Helper to sanitize array of columns
const sanitizeCols = (cols: any[] | undefined): STGColumnDef[] => {
  if (!Array.isArray(cols)) return [];
  return cols.map((c: any, idx: number) => ({
    key: String(c.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: c.name || c.label || c.key,
    type: c.type || 'number',
    formula: c.formula || undefined,
    unit: c.unit || undefined,
    decimals: typeof c.decimals === 'number' ? c.decimals : undefined,
    sort_order: typeof c.sort_order === 'number' ? c.sort_order : idx + 1,
    is_active: c.is_active !== undefined ? !!c.is_active : true,
  })).filter(c => c.key);
};

// GET /api/ts/columns?statement_key=...
// Fetches section-specific column definitions strictly as stored.
// If a section is empty, it returns [] — NEVER falls back to or re-populates with globalFields!
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { searchParams } = new URL(req.url);
    const statementKey = searchParams.get('statement_key');

    let sections: STGColumnSections = {
      ob: [],
      receipt: [],
      disposal: [],
      cb: [],
      recon: [],
    };

    if (statementKey) {
      // 1. Try stg_statement_column_configs for this statement
      const { data: configs } = await supabase
        .from('stg_statement_column_configs')
        .select('section_key, columns_json')
        .eq('statement_key', statementKey);

      let foundConfigs = false;
      if (Array.isArray(configs) && configs.length > 0) {
        configs.forEach((cfg: any) => {
          const k = (cfg.section_key || '').toLowerCase() as keyof STGColumnSections;
          if (k in sections && Array.isArray(cfg.columns_json)) {
            sections[k] = sanitizeCols(cfg.columns_json);
            foundConfigs = true;
          }
        });
      }

      // If not configured in stg_statement_column_configs, check stg_masters for this statement
      if (!foundConfigs) {
        const { data: stmt, error } = await supabase
          .from('stg_masters')
          .select('ob_columns, receipt_columns, disposal_columns, cb_columns, recon_columns')
          .eq('key', statementKey)
          .maybeSingle();

        if (!error && stmt) {
          sections = {
            ob: sanitizeCols(stmt.ob_columns),
            receipt: sanitizeCols(stmt.receipt_columns),
            disposal: sanitizeCols(stmt.disposal_columns),
            cb: sanitizeCols(stmt.cb_columns),
            recon: sanitizeCols(stmt.recon_columns),
          };
        }
      }
    } else {
      // No statementKey specified: load global/default section columns
      // 1. Check stg_statement_column_configs for 'default_stg'
      const { data: configs } = await supabase
        .from('stg_statement_column_configs')
        .select('section_key, columns_json')
        .eq('statement_key', 'default_stg');

      let foundConfigs = false;
      if (Array.isArray(configs) && configs.length > 0) {
        configs.forEach((cfg: any) => {
          const k = (cfg.section_key || '').toLowerCase() as keyof STGColumnSections;
          if (k in sections && Array.isArray(cfg.columns_json)) {
            sections[k] = sanitizeCols(cfg.columns_json);
            foundConfigs = true;
          }
        });
      }

      // If not found in configs, check first statement in stg_masters
      if (!foundConfigs) {
        const { data: stmts } = await supabase
          .from('stg_masters')
          .select('ob_columns, receipt_columns, disposal_columns, cb_columns, recon_columns')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1);

        if (Array.isArray(stmts) && stmts.length > 0) {
          const stmt = stmts[0];
          sections = {
            ob: sanitizeCols(stmt.ob_columns),
            receipt: sanitizeCols(stmt.receipt_columns),
            disposal: sanitizeCols(stmt.disposal_columns),
            cb: sanitizeCols(stmt.cb_columns),
            recon: sanitizeCols(stmt.recon_columns),
          };
        }
      }
    }

    // Global field catalogue from stg_field_master for reference (never injected into sections)
    const { data: fieldRows } = await supabase
      .from('stg_field_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const globalFields: STGColumnDef[] = (fieldRows || []).map((f: any) => ({
      key: f.field_key,
      name: f.label,
      type: f.data_type,
      formula: f.default_formula || undefined,
      decimals: f.decimals,
      unit: f.unit || undefined,
      sort_order: f.sort_order,
      is_active: f.is_active,
    }));

    // Build flatColumns containing only actually configured columns from the sections
    const allColsMap = new Map<string, STGColumnDef>();
    [...sections.ob, ...sections.receipt, ...sections.disposal, ...sections.cb, ...sections.recon].forEach(c => {
      if (c && c.key && !allColsMap.has(c.key)) {
        allColsMap.set(c.key, c);
      }
    });
    const flatColumns = Array.from(allColsMap.values());

    return NextResponse.json({ success: true, sections, columns: flatColumns, globalFields });
  } catch (err: any) {
    console.error('GET /api/ts/columns error:', err);
    return NextResponse.json({ success: true, sections: DEFAULT_STG_SECTIONS, columns: [] });
  }
}

// POST /api/ts/columns - Save STG column definitions
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const statementKey = body.statement_key || body.statementKey;
    const supabase = getSupabaseServiceClient();

    // Determine what sections to update
    const secUpdates: Partial<Record<keyof STGColumnSections, STGColumnDef[]>> = {};

    if (body.section && Array.isArray(body.columns)) {
      // Single section update: e.g. section: 'ob', columns: [...]
      const secKey = String(body.section).toLowerCase() as keyof STGColumnSections;
      secUpdates[secKey] = sanitizeCols(body.columns);
    } else if (body.sections && typeof body.sections === 'object') {
      if (Array.isArray(body.sections.ob)) secUpdates.ob = sanitizeCols(body.sections.ob);
      if (Array.isArray(body.sections.receipt)) secUpdates.receipt = sanitizeCols(body.sections.receipt);
      if (Array.isArray(body.sections.disposal)) secUpdates.disposal = sanitizeCols(body.sections.disposal);
      if (Array.isArray(body.sections.cb)) secUpdates.cb = sanitizeCols(body.sections.cb);
      if (Array.isArray(body.sections.recon)) secUpdates.recon = sanitizeCols(body.sections.recon);
    } else {
      if (Array.isArray(body.ob)) secUpdates.ob = sanitizeCols(body.ob);
      if (Array.isArray(body.receipt)) secUpdates.receipt = sanitizeCols(body.receipt);
      if (Array.isArray(body.disposal)) secUpdates.disposal = sanitizeCols(body.disposal);
      if (Array.isArray(body.cb)) secUpdates.cb = sanitizeCols(body.cb);
      if (Array.isArray(body.recon)) secUpdates.recon = sanitizeCols(body.recon);
    }

    // 1. Persist to stg_statement_column_configs
    const targetStmtKey = statementKey || 'default_stg';
    for (const [secKey, cols] of Object.entries(secUpdates)) {
      await supabase
        .from('stg_statement_column_configs')
        .upsert({
          statement_key: targetStmtKey,
          section_key: secKey,
          columns_json: cols,
          updated_by: actorUsername,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'statement_key,section_key' });
    }

    // 2. Also update stg_masters table
    const masterUpdates: any = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };
    if (secUpdates.ob !== undefined) masterUpdates.ob_columns = secUpdates.ob;
    if (secUpdates.receipt !== undefined) masterUpdates.receipt_columns = secUpdates.receipt;
    if (secUpdates.disposal !== undefined) masterUpdates.disposal_columns = secUpdates.disposal;
    if (secUpdates.cb !== undefined) masterUpdates.cb_columns = secUpdates.cb;
    if (secUpdates.recon !== undefined) masterUpdates.recon_columns = secUpdates.recon;

    if (Object.keys(masterUpdates).length > 2) {
      if (statementKey) {
        await supabase
          .from('stg_masters')
          .update(masterUpdates)
          .eq('key', statementKey);
      } else {
        // Update all statements with the new section column definitions
        await supabase
          .from('stg_masters')
          .update(masterUpdates)
          .neq('key', '');
      }
    }

    // 3. Register any new columns in stg_field_master catalogue
    const allCols: STGColumnDef[] = Object.values(secUpdates).flat();
    const uniqueCols = new Map<string, STGColumnDef>();
    allCols.forEach(c => {
      if (c && c.key && !uniqueCols.has(c.key)) uniqueCols.set(c.key, c);
    });

    for (const c of Array.from(uniqueCols.values())) {
      await supabase
        .from('stg_field_master')
        .upsert({
          field_key: c.key,
          label: c.name || c.key,
          data_type: c.type || 'number',
          default_formula: c.formula || '',
          decimals: typeof c.decimals === 'number' ? c.decimals : 3,
          unit: c.unit || '',
          sort_order: typeof c.sort_order === 'number' ? c.sort_order : 0,
          is_active: c.is_active !== undefined ? !!c.is_active : true,
          updated_by: actorUsername,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'field_key' });
    }

    return NextResponse.json({
      success: true,
      updatedSections: secUpdates,
      message: 'STG Column configuration saved successfully',
    });
  } catch (err: any) {
    console.error('POST /api/ts/columns error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save column definitions' }, { status: 500 });
  }
}
