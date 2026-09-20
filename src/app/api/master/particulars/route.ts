import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET /api/master/particulars - Fetch active particulars from particulars_master
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section_type = searchParams.get('section_type');

    const supabase = getSupabaseServiceClient();

    // Try stored procedure fn_get_active_particulars_master first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_get_active_particulars_master', {
      p_section_type: section_type || null,
    });

    if (!rpcErr && Array.isArray(rpcData)) {
      return NextResponse.json({ data: rpcData });
    }

    // Direct table query fallback
    let query = supabase
      .from('particulars_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (section_type) {
      query = query.eq('section_type', section_type.toUpperCase().trim());
    }

    const { data: particulars, error } = await query;

    if (error) {
      console.error('Error fetching particulars_master:', error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: particulars || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching particulars';
    console.error('particulars_master API error:', msg);
    return NextResponse.json({ data: [] });
  }
}

// POST /api/master/particulars - Upsert particular via Stored Procedure fn_upsert_particular_master
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { section_type, particular_name, code, sort_order, is_active } = body as {
      section_type?: string;
      particular_name?: string;
      code?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    if (!section_type || !particular_name) {
      return NextResponse.json({ error: 'Section type and Particular name are required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // Call stored procedure fn_upsert_particular_master
    const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_particular_master', {
      p_section_type: section_type.toUpperCase().trim(),
      p_particular_name: particular_name.trim(),
      p_code: code?.trim() || particular_name.trim(),
      p_sort_order: Number(sort_order) || 0,
      p_is_active: is_active !== undefined ? is_active : true,
      p_actor: actorUsername,
    });

    if (!spErr && spData) {
      return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData }, { status: 201 });
    }

    // Direct table upsert fallback
    const { data, error } = await supabase
      .from('particulars_master')
      .upsert({
        section_type: section_type.toUpperCase().trim(),
        particular_name: particular_name.trim(),
        code: code?.trim() || particular_name.trim(),
        sort_order: Number(sort_order) || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: actorUsername,
        updated_by: actorUsername,
      }, { onConflict: 'section_type,particular_name' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to declare particular';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/master/particulars - Update particular configuration
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { id, section_type, particular_name, code, is_active, sort_order } = body as {
      id?: string;
      section_type?: string;
      particular_name?: string;
      code?: string;
      is_active?: boolean;
      sort_order?: number;
    };

    const supabase = getSupabaseServiceClient();

    if (section_type && particular_name) {
      const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_particular_master', {
        p_section_type: section_type.toUpperCase().trim(),
        p_particular_name: particular_name.trim(),
        p_code: code?.trim() || particular_name.trim(),
        p_sort_order: Number(sort_order) || 0,
        p_is_active: is_active !== undefined ? is_active : true,
        p_actor: actorUsername,
      });

      if (!spErr && spData) {
        return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData });
      }
    }

    if (!id) return NextResponse.json({ error: 'Particular ID or section_type & particular_name is required' }, { status: 400 });

    const updatePayload: Record<string, any> = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };

    if (particular_name !== undefined) updatePayload.particular_name = particular_name.trim();
    if (code !== undefined) updatePayload.code = code.trim();
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = Number(sort_order);

    const { data, error } = await supabase
      .from('particulars_master')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update particular';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/master/particulars - Soft delete particular
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Particular ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // Call stored procedure fn_soft_delete_particular_master first
    const { error: rpcErr } = await supabase.rpc('fn_soft_delete_particular_master', {
      p_id: id,
      p_actor: actorUsername,
    });

    if (!rpcErr) {
      return NextResponse.json({ success: true, message: 'Particular soft-deleted successfully' });
    }

    // Fallback to direct table soft delete
    const { error } = await supabase
      .from('particulars_master')
      .update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Particular soft-deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to soft delete particular';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
