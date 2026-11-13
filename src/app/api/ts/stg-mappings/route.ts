import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export interface StgToTsMappingRule {
  id?: string;
  rule_key?: string;
  source_statement_key: string;
  source_section: string;
  source_row_name: string;
  source_field: string;
  target_section: string;
  target_particular: string;
  target_field: string;
  enabled?: boolean;
  description?: string;
  sort_order?: number;
}

// GET /api/ts/stg-mappings - Strictly fetch mapping rules from stg_to_ts_mapping_rules table
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('stg_to_ts_mapping_rules')
      .select('id, rule_key, source_statement_key, source_section, source_row_name, source_field, target_section, target_particular, target_field, enabled, description, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching stg_to_ts_mapping_rules:', error);
      return NextResponse.json({ error: error.message, rules: [] }, { status: 500 });
    }

    return NextResponse.json({ rules: data || [], source: 'stg_to_ts_mapping_rules' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch STG to TS mappings';
    return NextResponse.json({ error: msg, rules: [] }, { status: 500 });
  }
}

// POST /api/ts/stg-mappings - Upsert rules strictly in stg_to_ts_mapping_rules table
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();
    const rules: StgToTsMappingRule[] = Array.isArray(body.rules) ? body.rules : [];
    const supabase = getSupabaseServiceClient();

    if (rules.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    // Upsert formatted rules
    const formatted = rules.map((r, idx) => ({
      ...(typeof r.id === 'string' && UUID_REGEX.test(r.id) ? { id: r.id } : {}),
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
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }));

    const { data, error: upsertErr } = await supabase
      .from('stg_to_ts_mapping_rules')
      .upsert(formatted, { onConflict: 'rule_key' })
      .select();

    if (upsertErr) {
      console.error('stg_to_ts_mapping_rules upsert error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0, rules: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save STG to TS mappings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
