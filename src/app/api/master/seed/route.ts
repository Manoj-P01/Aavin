import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

const SEED_PRODUCTS = [
  { product_key: 'wh_milk', product_name: 'Whole Milk', short_name: 'WM', category: 'Liquid Milk', sort_order: 1 },
  { product_key: 'dlt_milk', product_name: 'DLT Milk', short_name: 'DLT', category: 'Liquid Milk', sort_order: 2 },
  { product_key: 'fc_milk', product_name: 'FC Milk', short_name: 'FC', category: 'Liquid Milk', sort_order: 3 },
  { product_key: 'std_milk', product_name: 'STD Milk', short_name: 'STD', category: 'Liquid Milk', sort_order: 4 },
  { product_key: 'toned_curd', product_name: 'Toned Curd', short_name: 'TC', category: 'Products', sort_order: 5 },
  { product_key: 'dtm', product_name: 'DTM', short_name: 'DTM', category: 'Liquid Milk', sort_order: 6 },
  { product_key: 'skim_milk', product_name: 'Skim Milk', short_name: 'SSM', category: 'Liquid Milk', sort_order: 7 },
  { product_key: 'cream', product_name: 'Cream', short_name: 'CRM', category: 'Products', sort_order: 8 },
  { product_key: 'butter_milk', product_name: 'Butter Milk', short_name: 'BM', category: 'Products', sort_order: 9 },
  { product_key: 'r_con', product_name: 'R.Con', short_name: 'RC', category: 'Products', sort_order: 10 },
  { product_key: 'smp', product_name: 'SMP', short_name: 'SMP', category: 'Products', sort_order: 11 },
  { product_key: 'water', product_name: 'Water', short_name: 'WTR', category: 'Others', sort_order: 12 }
];

const SEED_DAIRIES = [
  { dairy_name: 'Madurai-SSM', code: 'MDU', sort_order: 1 },
  { dairy_name: 'SNR-SSM', code: 'SNR', sort_order: 2 },
  { dairy_name: 'Erode-SSM', code: 'ERD', sort_order: 3 },
  { dairy_name: 'CBE-SSM', code: 'CBE', sort_order: 4 },
  { dairy_name: 'AMBATTUR-SSM', code: 'AMB', sort_order: 5 },
  { dairy_name: 'DCPP-SSM', code: 'DCPP', sort_order: 6 },
  { dairy_name: 'Tiruppur-SSM', code: 'TPR', sort_order: 7 },
  { dairy_name: 'Salem-SSM', code: 'SLM', sort_order: 8 }
];

// POST /api/master/seed - Seed Default Preset Master Data from UI
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const supabase = getSupabaseServiceClient();

    let seededProductsCount = 0;
    let seededDairiesCount = 0;

    // 1. Seed Products Master
    for (const p of SEED_PRODUCTS) {
      // Try SP fn_upsert_product_master first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_upsert_product_master', {
        p_product_key: p.product_key,
        p_product_name: p.product_name,
        p_short_name: p.short_name,
        p_category: p.category,
        p_sort_order: p.sort_order,
        p_is_active: true,
        p_actor: actorUsername,
      });

      if (!rpcErr && rpcData) {
        seededProductsCount++;
      } else {
        // Direct table upsert fallback
        const { error: upsertErr } = await supabase
          .from('products_master')
          .upsert({
            product_key: p.product_key,
            product_name: p.product_name,
            short_name: p.short_name,
            category: p.category,
            sort_order: p.sort_order,
            is_active: true,
            created_by: actorUsername,
            updated_by: actorUsername,
          }, { onConflict: 'product_key' });

        if (!upsertErr) seededProductsCount++;
      }
    }

    // 2. Seed Destination Union Dairies Master
    for (const d of SEED_DAIRIES) {
      // Try SP fn_upsert_dairy_destination first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_upsert_dairy_destination', {
        p_dairy_name: d.dairy_name,
        p_code: d.code,
        p_sort_order: d.sort_order,
        p_is_active: true,
        p_actor: actorUsername,
      });

      if (!rpcErr && rpcData) {
        seededDairiesCount++;
      } else {
        // Direct table upsert fallback
        const { error: upsertErr } = await supabase
          .from('dairy_destinations_master')
          .upsert({
            dairy_name: d.dairy_name,
            code: d.code,
            sort_order: d.sort_order,
            is_active: true,
            created_by: actorUsername,
            updated_by: actorUsername,
          }, { onConflict: 'dairy_name' });

        if (!upsertErr) seededDairiesCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${seededProductsCount} products and ${seededDairiesCount} destination union dairies!`,
      products_count: seededProductsCount,
      dairies_count: seededDairiesCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to seed master data';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
