import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export interface STGColumnDef {
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
  sort_order?: number;
  is_active?: boolean;
}

// GET /api/ts/columns - Fetch STG column definitions strictly from DB table prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: res, error } = await supabase
      .from('prep_chart_configs')
      .select('config_json')
      .eq('config_key', 'stg_columns')
      .maybeSingle();

    let columns: STGColumnDef[] = [];
    if (!error && res && Array.isArray(res.config_json)) {
      columns = res.config_json;
    }

    return NextResponse.json({ success: true, columns });
  } catch (err: any) {
    console.error('GET /api/ts/columns error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch STG columns' }, { status: 500 });
  }
}

// POST /api/ts/columns - Save STG column definitions to prep_chart_configs
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const columns = Array.isArray(body.columns) ? body.columns : body;
    if (!Array.isArray(columns)) {
      return NextResponse.json({ error: 'Invalid payload, expected array of columns' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
      config_key: 'stg_columns',
      config_json: columns,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'config_key' });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({ success: true, columns });
  } catch (err: any) {
    console.error('POST /api/ts/columns error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save STG columns' }, { status: 500 });
  }
}
