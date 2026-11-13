import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ts/fields - Fetch global field catalog strictly from stg_field_master
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('stg_field_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching stg_field_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, fields: data || [] });
  } catch (err: any) {
    console.error('GET /api/ts/fields error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch fields' }, { status: 500 });
  }
}

// POST /api/ts/fields - Upsert field definition in stg_field_master
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    const fieldsToSave: any[] = Array.isArray(body.fields)
      ? body.fields
      : (body.field ? [body.field] : (Array.isArray(body) ? body : []));

    if (fieldsToSave.length === 0) {
      return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
    }

    const rows = fieldsToSave.map((f: any, idx: number) => ({
      field_key: f.field_key || f.key,
      label: f.label || f.name,
      data_type: f.data_type || f.type || 'number',
      default_formula: f.default_formula || f.formula || '',
      decimals: typeof f.decimals === 'number' ? f.decimals : 3,
      unit: f.unit || '',
      is_identifier: !!f.is_identifier,
      sort_order: typeof f.sort_order === 'number' ? f.sort_order : idx + 1,
      is_active: f.is_active !== undefined ? !!f.is_active : true,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('stg_field_master')
      .upsert(rows, { onConflict: 'field_key' })
      .select();

    if (error) {
      console.error('Error upserting stg_field_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, fields: data });
  } catch (err: any) {
    console.error('POST /api/ts/fields error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save fields' }, { status: 500 });
  }
}

