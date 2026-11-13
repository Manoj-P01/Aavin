import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ts/particulars?statement_key=...&section_key=...
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { searchParams } = new URL(req.url);
    const statementKey = searchParams.get('statement_key');
    const sectionKey = searchParams.get('section_key');

    let query = supabase
      .from('stg_particular_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (statementKey) {
      query = query.eq('statement_key', statementKey);
    }
    if (sectionKey) {
      query = query.eq('section_key', sectionKey);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching stg_particular_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, particulars: data || [] });
  } catch (err: any) {
    console.error('GET /api/ts/particulars error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch particulars' }, { status: 500 });
  }
}

// POST /api/ts/particulars - Upsert particulars into stg_particular_master
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    const itemsToSave: any[] = Array.isArray(body.particulars)
      ? body.particulars
      : (body.particular ? [body.particular] : (Array.isArray(body) ? body : []));

    if (itemsToSave.length === 0) {
      return NextResponse.json({ error: 'No particulars provided' }, { status: 400 });
    }

    const rows = itemsToSave.map((p: any, idx: number) => {
      const pName = (p.particular_name || p.particular || p.name || p.label || '').trim();
      const pCode = (p.particular_code || p.code || pName.toLowerCase().replace(/[^a-z0-9_]/g, '_')) || `part_${idx + 1}`;
      return {
        ...(p.id ? { id: p.id } : {}),
        statement_key: p.statement_key || p.statementKey,
        section_key: p.section_key || p.sectionKey,
        particular_code: pCode,
        particular_name: pName,
        default_values: p.default_values || p.values || {},
        sort_order: typeof p.sort_order === 'number' ? p.sort_order : idx + 1,
        is_active: p.is_active !== undefined ? !!p.is_active : true,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('stg_particular_master')
      .upsert(rows, { onConflict: 'statement_key,section_key,particular_code' })
      .select();

    if (error) {
      console.error('Error upserting stg_particular_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, particulars: data });
  } catch (err: any) {
    console.error('POST /api/ts/particulars error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save particulars' }, { status: 500 });
  }
}

// DELETE /api/ts/particulars?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Particular ID required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('stg_particular_master')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('DELETE /api/ts/particulars error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete particular' }, { status: 500 });
  }
}

