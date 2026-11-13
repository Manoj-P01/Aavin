import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (val: any): boolean => typeof val === 'string' && UUID_REGEX.test(val);

// GET /api/mappings - Fetch configurable cross-statement mapping rules from statement_mapping_rules table
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { searchParams } = new URL(req.url);
    const statementKey = searchParams.get('statement_key');
    const sourceStage = searchParams.get('source_stage');

    let query = supabase
      .from('statement_mapping_rules')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (statementKey) {
      query = query.or(`statement_key.eq.${statementKey},stg_block_key.eq.${statementKey}`);
    }
    if (sourceStage) {
      query = query.eq('source_stage', sourceStage);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching statement_mapping_rules:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rules: data || [] });
  } catch (err: any) {
    console.error('GET /api/mappings error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch mapping rules' }, { status: 500 });
  }
}

// POST /api/mappings - Upsert mapping rules into statement_mapping_rules
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    const rulesToSave: any[] = Array.isArray(body.rules)
      ? body.rules
      : (body.rule ? [body.rule] : (Array.isArray(body) ? body : []));

    if (rulesToSave.length === 0) {
      return NextResponse.json({ error: 'No mapping rules provided in payload' }, { status: 400 });
    }

    // 1. Fetch valid foreign keys from referenced master tables to guarantee zero FK violations
    const [secRes, fieldRes, partRes] = await Promise.all([
      supabase.from('stg_section_master').select('section_key'),
      supabase.from('stg_field_master').select('field_key'),
      supabase.from('stg_particular_master').select('id'),
    ]);

    const validSecKeys = new Set((secRes.data || []).map((s: any) => s.section_key));
    const secLowerMap = new Map<string, string>();
    (secRes.data || []).forEach((s: any) => secLowerMap.set(String(s.section_key).toLowerCase(), s.section_key));

    const validFieldKeys = new Set((fieldRes.data || []).map((f: any) => f.field_key));
    const fieldLowerMap = new Map<string, string>();
    (fieldRes.data || []).forEach((f: any) => fieldLowerMap.set(String(f.field_key).toLowerCase(), f.field_key));

    const validPartIds = new Set((partRes.data || []).map((p: any) => p.id));

    const rows = rulesToSave.map((r: any, idx: number) => {
      // Validate UUID syntax to prevent PostgreSQL 22P02 error
      const validId = isUuid(r.id) ? r.id : crypto.randomUUID();
      const ruleKey = r.rule_key || r.ruleKey || (typeof r.id === 'string' && !isUuid(r.id) ? r.id : `rule_${Date.now()}_${idx + 1}`);

      // Safely resolve section_key FK (only link if present in stg_section_master)
      const rawSec = r.section_key || r.stg_section || r.stgSection;
      let safeSectionKey: string | null = null;
      if (rawSec) {
        if (validSecKeys.has(rawSec)) {
          safeSectionKey = rawSec;
        } else if (secLowerMap.has(String(rawSec).toLowerCase())) {
          safeSectionKey = secLowerMap.get(String(rawSec).toLowerCase())!;
        }
      }

      // Safely resolve target_field FK (only link if present in stg_field_master)
      const rawField = r.target_field || r.stg_target_field || r.stgTargetField;
      const cleanField = String(rawField || '').trim().toLowerCase();
      const normField = (!cleanField || ['ob', 'cb', 'receipt', 'disposal', 'variant', 'particular', 'particulars', 'label', 'name', 'item_name'].includes(cleanField))
        ? 'qty_lts'
        : (rawField || 'qty_lts');

      let safeTargetField: string | null = null;
      if (validFieldKeys.has(normField)) {
        safeTargetField = normField;
      } else if (fieldLowerMap.has(normField.toLowerCase())) {
        safeTargetField = fieldLowerMap.get(normField.toLowerCase())!;
      }

      // Safely resolve particular_id FK (only link if present in stg_particular_master)
      const rawPartId = isUuid(r.particular_id) ? r.particular_id : null;
      const safePartId = rawPartId && validPartIds.has(rawPartId) ? rawPartId : null;

      return {
        id: validId,
        rule_key: ruleKey,
        source_stage: r.source_stage || r.sourceStage || 'stage2',
        source_variant: r.source_variant || r.sourceVariant || null,
        source_field: r.source_field || r.sourceField || 'qty_lts',
        statement_key: r.statement_key || r.stg_block_key || r.stgBlockKey,
        section_key: safeSectionKey,
        particular_id: safePartId,
        target_field: safeTargetField,
        enabled: r.enabled !== undefined ? !!r.enabled : true,
        sort_order: typeof r.sort_order === 'number' ? r.sort_order : idx + 1,
        // Legacy columns for backward compatibility with schema
        stock_product_key: r.stock_product_key || r.stockProductKey || '',
        stock_product_label: r.stock_product_label || r.stockProductLabel || '',
        stock_section: r.stock_section || r.stockSection || '',
        stock_particular: r.stock_particular || r.stockParticular || '',
        stg_block_key: r.stg_block_key || r.stgBlockKey || r.statement_key || '',
        stg_block_label: r.stg_block_label || r.stgBlockLabel || '',
        stg_section: r.stg_section || r.stgSection || r.section_key || 'OB',
        stg_item_name: r.stg_item_name || r.stgItemName || '',
        stg_target_field: normField,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('statement_mapping_rules')
      .upsert(rows, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Error upserting statement_mapping_rules:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rules: data });
  } catch (err: any) {
    console.error('POST /api/mappings error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save mapping rules' }, { status: 500 });
  }
}

// DELETE /api/mappings?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const statementKey = searchParams.get('statement_key');

    const supabase = getSupabaseServiceClient();

    if (id) {
      let query = supabase.from('statement_mapping_rules').delete();
      if (isUuid(id)) {
        query = query.eq('id', id);
      } else {
        query = query.eq('rule_key', id);
      }
      const { error } = await query;

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (statementKey) {
      const { error } = await supabase
        .from('statement_mapping_rules')
        .delete()
        .or(`statement_key.eq.${statementKey},stg_block_key.eq.${statementKey}`);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, deletedStatementKey: statementKey });
    }

    return NextResponse.json({ error: 'id or statement_key required for deletion' }, { status: 400 });
  } catch (err: any) {
    console.error('DELETE /api/mappings error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete mapping rule' }, { status: 500 });
  }
}
