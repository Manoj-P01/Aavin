import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';
import { isLocalDbEnabled } from '@/lib/fileDb';

// GET /api/master/products - List products dynamically from products_master
export async function GET(req: NextRequest) {
  try {
    if (isLocalDbEnabled()) {
      return NextResponse.json({ data: [] });
    }

    const supabase = getSupabaseServiceClient();

    // Try stored procedure fn_get_active_products_master() first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_get_active_products_master');
    if (!rpcErr && Array.isArray(rpcData)) {
      return NextResponse.json({ data: rpcData });
    }

    // Direct table query fallback
    const { data: products, error } = await supabase
      .from('products_master')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching products_master:', error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: products || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching products';
    console.error('products_master API error:', msg);
    return NextResponse.json({ data: [] });
  }
}

// POST /api/master/products - Upsert product via Stored Procedure fn_upsert_product_master
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { product_key, product_name, short_name, category, sort_order, is_active } = body as {
      product_key?: string;
      product_name?: string;
      short_name?: string;
      category?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    if (!product_key || !product_name) {
      return NextResponse.json({ error: 'Product key and Product name are required' }, { status: 400 });
    }

    const cleanKey = product_key.trim().toLowerCase().replace(/\s+/g, '_');
    const supabase = getSupabaseServiceClient();

    // Call SP fn_upsert_product_master
    const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_product_master', {
      p_product_key: cleanKey,
      p_product_name: product_name.trim(),
      p_short_name: short_name?.trim() || cleanKey.toUpperCase(),
      p_category: category || 'Liquid Milk',
      p_sort_order: Number(sort_order) || 0,
      p_is_active: is_active !== undefined ? is_active : true,
      p_actor: actorUsername,
    });

    if (!spErr && spData) {
      return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData }, { status: 201 });
    }

    // Direct Table Upsert fallback
    const { data, error } = await supabase
      .from('products_master')
      .upsert({
        product_key: cleanKey,
        product_name: product_name.trim(),
        short_name: short_name?.trim() || cleanKey.toUpperCase(),
        category: category || 'Liquid Milk',
        sort_order: Number(sort_order) || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: actorUsername,
        updated_by: actorUsername,
      }, { onConflict: 'product_key' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to declare product';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/master/products - Update product configuration via Stored Procedure or Table
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { id, product_key, product_name, short_name, category, is_active, sort_order } = body as {
      id?: string;
      product_key?: string;
      product_name?: string;
      short_name?: string;
      category?: string;
      is_active?: boolean;
      sort_order?: number;
    };

    const supabase = getSupabaseServiceClient();

    if (product_key && product_name) {
      // Call SP fn_upsert_product_master
      const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_product_master', {
        p_product_key: product_key,
        p_product_name: product_name,
        p_short_name: short_name,
        p_category: category,
        p_sort_order: sort_order,
        p_is_active: is_active,
        p_actor: actorUsername,
      });

      if (!spErr && spData) {
        return NextResponse.json({ data: Array.isArray(spData) ? spData[0] : spData });
      }
    }

    if (!id) return NextResponse.json({ error: 'Product ID or product_key is required' }, { status: 400 });

    const updatePayload: Record<string, any> = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };

    if (product_name !== undefined) updatePayload.product_name = product_name.trim();
    if (short_name !== undefined) updatePayload.short_name = short_name.trim();
    if (category !== undefined) updatePayload.category = category;
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = Number(sort_order);

    const { data, error } = await supabase
      .from('products_master')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update product';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/master/products - Soft delete product from products_master
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
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // Call stored procedure fn_soft_delete_product_master first
    const { error: rpcErr } = await supabase.rpc('fn_soft_delete_product_master', {
      p_id: id,
      p_actor: actorUsername,
    });

    if (!rpcErr) {
      return NextResponse.json({ success: true, message: 'Product soft-deleted successfully' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let dbQuery = supabase
      .from('products_master')
      .update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() });

    if (isUuid) {
      dbQuery = dbQuery.eq('id', id);
    } else {
      dbQuery = dbQuery.eq('product_key', id);
    }

    const { error } = await dbQuery;

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Product soft-deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
