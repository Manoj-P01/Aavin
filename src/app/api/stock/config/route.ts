import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET /api/stock/config - Load Stock Products Configuration (Product Columns, Receipt Rows, Disposal Rows)
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Fetch Products Master
    let products: any[] = [];
    const { data: prodData, error: prodErr } = await supabase
      .from('products_master')
      .select('id, product_key, product_name, short_name, category, sort_order, is_active, is_default')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!prodErr && Array.isArray(prodData) && prodData.length > 0) {
      products = prodData.map((p, idx) => ({
        id: p.id,
        key: p.product_key,
        full_name: p.product_name,
        short_name: p.short_name,
        category: p.category || '',
        sort_order: p.sort_order || idx + 1,
        is_active: p.is_active,
      }));
    }

    // 2. Fetch Particulars Master (Receipt Rows)
    let receiptRows: any[] = [];
    let recData: any[] | null = null;
    const { data: recRpcData, error: recRpcErr } = await supabase.rpc('fn_get_active_particulars_master', {
      p_section_type: 'RECEIPT',
    });
    if (!recRpcErr && Array.isArray(recRpcData)) {
      recData = recRpcData;
    } else {
      const { data: recDbData, error: recErr } = await supabase
        .from('particulars_master')
        .select('id, section_type, particular_name, code, sort_order, is_active')
        .eq('section_type', 'RECEIPT')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (recErr) console.error('Error fetching receipt_rows:', recErr);
      recData = recDbData;
    }

    if (Array.isArray(recData) && recData.length > 0) {
      receiptRows = recData.map((r, idx) => ({
        id: r.id,
        full_name: r.particular_name,
        short_name: r.code || r.particular_name,
        sort_order: r.sort_order || idx + 1,
        is_active: r.is_active,
      }));
    }

    // 3. Fetch Particulars Master (Disposal Rows)
    let disposalRows: any[] = [];
    let dispData: any[] | null = null;
    const { data: dispRpcData, error: dispRpcErr } = await supabase.rpc('fn_get_active_particulars_master', {
      p_section_type: 'DISPOSAL',
    });
    if (!dispRpcErr && Array.isArray(dispRpcData)) {
      dispData = dispRpcData;
    } else {
      const { data: dispDbData, error: dispErr } = await supabase
        .from('particulars_master')
        .select('id, section_type, particular_name, code, sort_order, is_active')
        .eq('section_type', 'DISPOSAL')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (dispErr) console.error('Error fetching disposal_rows:', dispErr);
      dispData = dispDbData;
    }

    if (Array.isArray(dispData) && dispData.length > 0) {
      disposalRows = dispData.map((d, idx) => ({
        id: d.id,
        full_name: d.particular_name,
        short_name: d.code || d.particular_name,
        sort_order: d.sort_order || idx + 1,
        is_active: d.is_active,
      }));
    }

    return NextResponse.json({
      products,
      receipt_rows: receiptRows,
      disposal_rows: disposalRows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch stock config';
    console.error('GET /api/stock/config error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/stock/config - Save/Update Stock Products Configuration with Soft Delete & Case-Insensitive Re-open
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { products, receipt_rows, disposal_rows, removed_product_ids, removed_receipt_ids, removed_disposal_ids } = body as {
      products?: Array<{ id?: string; key?: string; full_name: string; short_name: string; category?: string }>;
      receipt_rows?: Array<{ id?: string; full_name: string; short_name: string }>;
      disposal_rows?: Array<{ id?: string; full_name: string; short_name: string }>;
      removed_product_ids?: string[];
      removed_receipt_ids?: string[];
      removed_disposal_ids?: string[];
    };

    const supabase = getSupabaseServiceClient();

    // 1. Process Soft-Deletions
    if (Array.isArray(removed_product_ids) && removed_product_ids.length > 0) {
      for (const id of removed_product_ids) {
        if (!id) continue;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const filterCol = isUuid ? 'id' : 'product_key';
        await supabase.from('products_master').update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() }).eq(filterCol, id);
      }
    }

    if (Array.isArray(removed_receipt_ids) && removed_receipt_ids.length > 0) {
      for (const id of removed_receipt_ids) {
        if (!id) continue;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const filterCol = isUuid ? 'id' : 'particular_name';
        await supabase.from('particulars_master').update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() }).eq(filterCol, id);
      }
    }

    if (Array.isArray(removed_disposal_ids) && removed_disposal_ids.length > 0) {
      for (const id of removed_disposal_ids) {
        if (!id) continue;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const filterCol = isUuid ? 'id' : 'particular_name';
        await supabase.from('particulars_master').update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() }).eq(filterCol, id);
      }
    }

    // 2. Save / Upsert Product Columns (Positions 1, 2, 3...)
    const savedProducts: any[] = [];
    if (Array.isArray(products)) {
      for (let i = 0; i < products.length; i++) {
        const prod = products[i];
        const full_name = prod.full_name?.trim() || prod.short_name?.trim() || '';
        const short_name = prod.short_name?.trim() || full_name;
        if (!full_name && !short_name) continue;

        const position = i + 1; // 1-indexed ordering position
        const key = prod.key || full_name.toLowerCase().replace(/\s+/g, '_');
        const category = prod.category?.trim() || null;

        const { data: dbData } = await supabase
          .from('products_master')
          .upsert({
            product_key: key,
            product_name: full_name,
            short_name: short_name,
            category: category,
            sort_order: position,
            is_active: true,
            updated_by: actorUsername,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'product_key' })
          .select('id, product_key, product_name, short_name, category, sort_order, is_active')
          .single();
        if (dbData) savedProducts.push(dbData);
      }
    }

    // 3. Save / Upsert Default Receipt Rows (Positions 1, 2, 3...)
    const savedReceiptRows: any[] = [];
    if (Array.isArray(receipt_rows)) {
      for (let i = 0; i < receipt_rows.length; i++) {
        const row = receipt_rows[i];
        const full_name = row.full_name?.trim() || row.short_name?.trim() || '';
        const short_name = row.short_name?.trim() || full_name;
        if (!full_name) continue;

        const position = i + 1; // 1-indexed ordering position

        const { data: dbData } = await supabase
          .from('particulars_master')
          .upsert({
            section_type: 'RECEIPT',
            particular_name: full_name,
            code: short_name,
            sort_order: position,
            is_active: true,
            updated_by: actorUsername,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'section_type,particular_name' })
          .select('id, section_type, particular_name, code, sort_order, is_active')
          .single();
        if (dbData) savedReceiptRows.push(dbData);
      }
    }

    // 4. Save / Upsert Default Disposal Rows (Positions 1, 2, 3...)
    const savedDisposalRows: any[] = [];
    if (Array.isArray(disposal_rows)) {
      for (let i = 0; i < disposal_rows.length; i++) {
        const row = disposal_rows[i];
        const full_name = row.full_name?.trim() || row.short_name?.trim() || '';
        const short_name = row.short_name?.trim() || full_name;
        if (!full_name) continue;

        const position = i + 1; // 1-indexed ordering position

        const { data: dbData } = await supabase
          .from('particulars_master')
          .upsert({
            section_type: 'DISPOSAL',
            particular_name: full_name,
            code: short_name,
            sort_order: position,
            is_active: true,
            updated_by: actorUsername,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'section_type,particular_name' })
          .select('id, section_type, particular_name, code, sort_order, is_active')
          .single();
        if (dbData) savedDisposalRows.push(dbData);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Products saved successfully!',
      products: savedProducts,
      receipt_rows: savedReceiptRows,
      disposal_rows: savedDisposalRows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save stock config';
    console.error('POST /api/stock/config error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
