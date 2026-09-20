import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET /api/master/dairies - List dairies dynamically from dairy_destinations_master
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // Try stored procedure fn_get_active_dairy_destinations() first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_get_active_dairy_destinations');
    if (!rpcErr && Array.isArray(rpcData)) {
      return NextResponse.json({ data: rpcData });
    }

    // Direct table query fallback
    const { data: dairies, error } = await supabase
      .from('dairy_destinations_master')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching dairy_destinations_master:', error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: dairies || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching dairies';
    console.error('dairy_destinations_master API error:', msg);
    return NextResponse.json({ data: [] });
  }
}

// POST /api/master/dairies - Declare / Upsert dairy via Stored Procedure fn_upsert_dairy_destination
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { dairy_name, code, sort_order, is_active } = body as {
      dairy_name?: string;
      code?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    if (!dairy_name) {
      return NextResponse.json({ error: 'Dairy name is required' }, { status: 400 });
    }

    const cleanName = dairy_name.trim();
    const supabase = getSupabaseServiceClient();

    // Call SP fn_upsert_dairy_destination
    const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_dairy_destination', {
      p_dairy_name: cleanName,
      p_code: code?.trim() || cleanName.substring(0, 4).toUpperCase(),
      p_sort_order: Number(sort_order) || 0,
      p_is_active: is_active !== undefined ? is_active : true,
      p_actor: actorUsername,
    });

    if (!spErr && spData) {
      return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData }, { status: 201 });
    }

    // Direct Table Upsert fallback
    const { data, error } = await supabase
      .from('dairy_destinations_master')
      .upsert({
        dairy_name: cleanName,
        code: code?.trim() || cleanName.substring(0, 4).toUpperCase(),
        sort_order: Number(sort_order) || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: actorUsername,
        updated_by: actorUsername,
      }, { onConflict: 'dairy_name' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to declare destination dairy';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/master/dairies - Update destination dairy configuration via Stored Procedure or Table
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { id, dairy_name, code, is_active, sort_order } = body as {
      id?: string;
      dairy_name?: string;
      code?: string;
      is_active?: boolean;
      sort_order?: number;
    };

    const supabase = getSupabaseServiceClient();

    if (dairy_name) {
      // Call SP fn_upsert_dairy_destination
      const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_dairy_destination', {
        p_dairy_name: dairy_name,
        p_code: code,
        p_sort_order: sort_order,
        p_is_active: is_active,
        p_actor: actorUsername,
      });

      if (!spErr && spData) {
        return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData });
      }
    }

    if (!id) return NextResponse.json({ error: 'Dairy ID or dairy_name is required' }, { status: 400 });

    const updatePayload: Record<string, any> = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };

    if (dairy_name !== undefined) updatePayload.dairy_name = dairy_name.trim();
    if (code !== undefined) updatePayload.code = code.trim();
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = Number(sort_order);

    const { data, error } = await supabase
      .from('dairy_destinations_master')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update destination dairy';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/master/dairies - Delete destination dairy from dairy_destinations_master
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Dairy ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('dairy_destinations_master')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Destination dairy deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete destination dairy';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
