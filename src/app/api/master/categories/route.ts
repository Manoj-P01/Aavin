import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

const DEFAULT_CATEGORIES = [
  { id: 'cat_1', category_name: 'Liquid Milk', code: 'MILK', sort_order: 1, is_active: true },
  { id: 'cat_2', category_name: 'Products', code: 'PROD', sort_order: 2, is_active: true },
  { id: 'cat_3', category_name: 'By-Products', code: 'BYPROD', sort_order: 3, is_active: true },
  { id: 'cat_4', category_name: 'Others', code: 'OTHR', sort_order: 4, is_active: true },
];

// GET /api/master/categories - List active product categories from product_categories_master
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // Query product_categories_master
    const { data: categories, error } = await supabase
      .from('product_categories_master')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ data: DEFAULT_CATEGORIES });
    }

    return NextResponse.json({ data: categories });
  } catch (err: unknown) {
    return NextResponse.json({ data: DEFAULT_CATEGORIES });
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

    // Try SP fn_upsert_product_category first
    const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_product_category', {
      p_category_name: cleanName,
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
      .from('product_categories_master')
      .upsert({
        category_name: cleanName,
        code: code?.trim() || cleanName.substring(0, 4).toUpperCase(),
        sort_order: Number(sort_order) || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: actorUsername,
        updated_by: actorUsername,
      }, { onConflict: 'category_name' })
      .select('*')
      .single();

    if (error) throw error;
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

    if (category_name) {
      const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_product_category', {
        p_category_name: category_name.trim(),
        p_code: code,
        p_sort_order: sort_order,
        p_is_active: is_active,
        p_actor: actorUsername,
      });

      if (!spErr && spData) {
        return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData });
      }
    }

    if (!id) return NextResponse.json({ error: 'Category ID or category_name is required' }, { status: 400 });

    const updatePayload: Record<string, any> = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };

    if (category_name !== undefined) updatePayload.category_name = category_name.trim();
    if (code !== undefined) updatePayload.code = code.trim();
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = Number(sort_order);

    const { data, error } = await supabase
      .from('product_categories_master')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/master/categories - Soft delete / delete category from product_categories_master
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

    // Try SP soft delete first
    const { error: rpcErr } = await supabase.rpc('fn_soft_delete_product_category', {
      p_id: id,
      p_actor: actorUsername,
    });

    if (rpcErr) {
      await supabase
        .from('product_categories_master')
        .update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ success: true, message: 'Category soft-deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
