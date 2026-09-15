import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading local_db.json:', e);
  }
  return {};
}

function writeLocalDb(data: any) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local_db.json:', e);
  }
}

// GET /api/stock/config - Load Stock Products Configuration (Product Columns, Receipt Rows, Disposal Rows)
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Fetch Products Master
    let products: any[] = [];
    const { data: prodData, error: prodErr } = await supabase
      .from('products_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!prodErr && Array.isArray(prodData) && prodData.length > 0) {
      products = prodData.map((p, idx) => ({
        id: p.id,
        key: p.product_key,
        full_name: p.product_name,
        short_name: p.short_name,
        sort_order: p.sort_order || idx + 1,
        is_active: p.is_active,
      }));
    }

    // 2. Fetch Particulars Master (Receipt Rows)
    let receiptRows: any[] = [];
    const { data: recData, error: recErr } = await supabase
      .from('particulars_master')
      .select('*')
      .eq('section_type', 'RECEIPT')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!recErr && Array.isArray(recData) && recData.length > 0) {
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
    const { data: dispData, error: dispErr } = await supabase
      .from('particulars_master')
      .select('*')
      .eq('section_type', 'DISPOSAL')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!dispErr && Array.isArray(dispData) && dispData.length > 0) {
      disposalRows = dispData.map((d, idx) => ({
        id: d.id,
        full_name: d.particular_name,
        short_name: d.code || d.particular_name,
        sort_order: d.sort_order || idx + 1,
        is_active: d.is_active,
      }));
    }

    // 4. Local DB fallback sync if Supabase is empty or offline
    const localDb = readLocalDb();
    if (products.length === 0 && Array.isArray(localDb.products_master)) {
      products = localDb.products_master
        .filter((p: any) => p.is_active !== false)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    if (receiptRows.length === 0 && Array.isArray(localDb.receipt_rows)) {
      receiptRows = localDb.receipt_rows
        .filter((r: any) => r.is_active !== false)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    if (disposalRows.length === 0 && Array.isArray(localDb.disposal_rows)) {
      disposalRows = localDb.disposal_rows
        .filter((d: any) => d.is_active !== false)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    return NextResponse.json({
      products,
      receipt_rows: receiptRows,
      disposal_rows: disposalRows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch stock config';
    console.error('GET /api/stock/config error:', msg);

    // Local DB fallback on error
    const localDb = readLocalDb();
    return NextResponse.json({
      products: (localDb.products_master || []).filter((p: any) => p.is_active !== false),
      receipt_rows: (localDb.receipt_rows || []).filter((r: any) => r.is_active !== false),
      disposal_rows: (localDb.disposal_rows || []).filter((d: any) => d.is_active !== false),
    });
  }
}

// POST /api/stock/config - Save/Update Stock Products Configuration with Soft Delete & Case-Insensitive Re-open
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { products, receipt_rows, disposal_rows, removed_product_ids, removed_receipt_ids, removed_disposal_ids } = body as {
      products?: Array<{ id?: string; key?: string; full_name: string; short_name: string }>;
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
        const { error: rpcErr } = await supabase.rpc('fn_soft_delete_product_master', { p_id: id, p_actor: actorUsername });
        if (rpcErr) {
          await supabase.from('products_master').update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() }).eq('id', id);
        }
      }
    }

    if (Array.isArray(removed_receipt_ids) && removed_receipt_ids.length > 0) {
      for (const id of removed_receipt_ids) {
        if (!id) continue;
        const { error: rpcErr } = await supabase.rpc('fn_soft_delete_particular_master', { p_id: id, p_actor: actorUsername });
        if (rpcErr) {
          await supabase.from('particulars_master').update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() }).eq('id', id);
        }
      }
    }

    if (Array.isArray(removed_disposal_ids) && removed_disposal_ids.length > 0) {
      for (const id of removed_disposal_ids) {
        if (!id) continue;
        const { error: rpcErr } = await supabase.rpc('fn_soft_delete_particular_master', { p_id: id, p_actor: actorUsername });
        if (rpcErr) {
          await supabase.from('particulars_master').update({ is_active: false, updated_by: actorUsername, updated_at: new Date().toISOString() }).eq('id', id);
        }
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

        // Execute case-insensitive upsert SP fn_upsert_product_master
        const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_product_master', {
          p_product_key: key,
          p_product_name: full_name,
          p_short_name: short_name,
          p_category: 'Liquid Milk',
          p_sort_order: position,
          p_is_active: true,
          p_actor: actorUsername,
        });

        if (!spErr && Array.isArray(spData) && spData.length > 0) {
          savedProducts.push(spData[0]);
        } else {
          // Direct fallback upsert
          const { data: dbData } = await supabase
            .from('products_master')
            .upsert({
              product_key: key,
              product_name: full_name,
              short_name: short_name,
              sort_order: position,
              is_active: true,
              updated_by: actorUsername,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'product_key' })
            .select('*')
            .single();
          if (dbData) savedProducts.push(dbData);
        }
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

        // Execute case-insensitive upsert SP fn_upsert_particular_master
        const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_particular_master', {
          p_section_type: 'RECEIPT',
          p_particular_name: full_name,
          p_code: short_name,
          p_sort_order: position,
          p_is_active: true,
          p_actor: actorUsername,
        });

        if (!spErr && Array.isArray(spData) && spData.length > 0) {
          savedReceiptRows.push(spData[0]);
        } else {
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
            .select('*')
            .single();
          if (dbData) savedReceiptRows.push(dbData);
        }
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

        // Execute case-insensitive upsert SP fn_upsert_particular_master
        const { data: spData, error: spErr } = await supabase.rpc('fn_upsert_particular_master', {
          p_section_type: 'DISPOSAL',
          p_particular_name: full_name,
          p_code: short_name,
          p_sort_order: position,
          p_is_active: true,
          p_actor: actorUsername,
        });

        if (!spErr && Array.isArray(spData) && spData.length > 0) {
          savedDisposalRows.push(spData[0]);
        } else {
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
            .select('*')
            .single();
          if (dbData) savedDisposalRows.push(dbData);
        }
      }
    }

    // 5. Also sync to local_db.json
    const localDb = readLocalDb();
    localDb.products_master = savedProducts;
    localDb.receipt_rows = savedReceiptRows;
    localDb.disposal_rows = savedDisposalRows;
    writeLocalDb(localDb);

    return NextResponse.json({
      success: true,
      message: 'Stock products configuration saved successfully!',
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
