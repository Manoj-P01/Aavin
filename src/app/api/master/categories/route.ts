import { NextRequest, NextResponse } from 'next/server';
import { invalidateMasterTag } from '@/lib/masters';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET /api/master/categories - List active product categories from product_categories_master
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // Query product_categories_master
    const { data: categories, error } = await supabase
      .from('product_categories_master')
      .select('id, category_name, code, sort_order, is_active')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching product_categories_master:', error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: categories || [] });
  } catch (err: unknown) {
    return NextResponse.json({ data: [] });
  }
}

// POST /api/master/categories - Upsert category via Stored Procedure or Table
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { category_name, code, sort_order, is_active } = body as {
      category_name?: string;
      code?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    if (!category_name || !category_name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const cleanName = category_name.trim();
    const supabase = getSupabaseServiceClient();

    // Direct Table Upsert
    const { data, error } = await supabase
      .from('product_categories_master')
      .upsert({
        category_name: cleanName,
        code: code?.trim() || cleanName.substring(0, 4).toUpperCase(),
        sort_order: Number(sort_order) || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: actorUsername,
        updated_by: actorUsername,
      }, { onConflict: 'category_name' })
      .select('id, category_name, code, sort_order, is_active, created_at, updated_at')
      .single();

    if (error) throw error;
    invalidateMasterTag('masters-categories');
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to declare category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/master/categories - Update category in product_categories_master
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { id, category_name, code, is_active, sort_order } = body as {
      id?: string;
      category_name?: string;
      code?: string;
      is_active?: boolean;
      sort_order?: number;
    };

    const supabase = getSupabaseServiceClient();

    if (!id && !category_name) return NextResponse.json({ error: 'Category ID or category_name is required' }, { status: 400 });

    const updatePayload: Record<string, any> = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };

    if (category_name !== undefined) updatePayload.category_name = category_name.trim();
    if (code !== undefined) updatePayload.code = code.trim();
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = Number(sort_order);

    const isUuid = Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    let updateQuery = supabase.from('product_categories_master').update(updatePayload);

    if (isUuid && id) {
      updateQuery = updateQuery.eq('id', id);
    } else if (id) {
      updateQuery = updateQuery.or(`id.eq.${id},category_name.eq.${id},code.eq.${id}`);
    } else if (category_name) {
      updateQuery = updateQuery.eq('category_name', category_name.trim());
    }

    const { data, error } = await updateQuery.select('id, category_name, code, sort_order, is_active, created_at, updated_at').single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/master/categories - Delete category from product_categories_master
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
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // 1. Try SP soft delete first if available
    try {
      await supabase.rpc('fn_soft_delete_product_category', {
        p_id: id,
        p_actor: actorUsername,
      });
    } catch {
      // ignore RPC error if procedure does not exist
    }

    // 3. Perform actual hard DELETE from product_categories_master table by ID, category_name, or code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let deleteQuery = supabase.from('product_categories_master').delete();

    if (isUuid) {
      deleteQuery = deleteQuery.eq('id', id);
    } else {
      deleteQuery = deleteQuery.or(`id.eq.${id},category_name.eq.${id},code.eq.${id}`);
    }

    const { error: delErr } = await deleteQuery;

    if (delErr) {
      // If hard delete fails (e.g., due to FK constraint), update is_active = false
      let updateQuery = supabase
        .from('product_categories_master')
        .update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() });

      if (isUuid) {
        updateQuery = updateQuery.eq('id', id);
      } else {
        updateQuery = updateQuery.or(`id.eq.${id},category_name.eq.${id},code.eq.${id}`);
      }
      await updateQuery;
    }

    invalidateMasterTag('masters-categories');
    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

