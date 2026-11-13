import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ts/sections - Fetch all STG sections strictly from stg_section_master
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('stg_section_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching stg_section_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sections: data || [] });
  } catch (err: any) {
    console.error('GET /api/ts/sections error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch sections' }, { status: 500 });
  }
}

// POST /api/ts/sections - Upsert sections into stg_section_master
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    const list: any[] = Array.isArray(body.sections)
      ? body.sections
      : (Array.isArray(body) ? body : (body.section ? [body.section] : []));

    if (list.length === 0) {
      return NextResponse.json({ error: 'No sections provided in payload' }, { status: 400 });
    }

    const rows = list.map((s: any, idx: number) => ({
      section_key: String(s.section_key || s.key || '').trim().toLowerCase(),
      label: s.label || s.name || s.section_key,
      row_side: s.row_side || 'NEUTRAL',
      is_single_row: !!s.is_single_row,
      sort_order: typeof s.sort_order === 'number' ? s.sort_order : idx + 1,
      is_active: s.is_active !== undefined ? !!s.is_active : true,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    })).filter(r => r.section_key);

    const { data, error } = await supabase
      .from('stg_section_master')
      .upsert(rows, { onConflict: 'section_key' })
      .select();

    if (error) {
      console.error('Error upserting stg_section_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sections: data });
  } catch (err: any) {
    console.error('POST /api/ts/sections error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save sections' }, { status: 500 });
  }
}
