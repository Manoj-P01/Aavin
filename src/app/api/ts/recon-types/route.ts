import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/ts/recon-types - Fetch all recon row types strictly from stg_recon_row_type_master
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('stg_recon_row_type_master')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching stg_recon_row_type_master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, types: data || [] });
  } catch (err: any) {
    console.error('GET /api/ts/recon-types error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch recon types' }, { status: 500 });
  }
}

