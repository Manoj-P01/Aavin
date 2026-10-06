import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET /api/ts/masters - Fetch STG Statement Masters strictly from Supabase DB table prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    let masters: any[] = [];
    const { data: res, error } = await supabase
      .from('prep_chart_configs')
      .select('config_json')
      .eq('config_key', 'stg_masters')
      .maybeSingle();

    if (!error && res && Array.isArray(res.config_json)) {
      masters = res.config_json;
    }

    return NextResponse.json({ success: true, masters });
  } catch (err: any) {
    console.error('GET /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch statement masters' }, { status: 500 });
  }
}

// POST /api/ts/masters - Save STG Statement Masters strictly to Supabase DB table prep_chart_configs
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const supabase = getSupabaseServiceClient();
    const mastersList = Array.isArray(body.masters) ? body.masters : (Array.isArray(body.statements) ? body.statements : body);

    if (!Array.isArray(mastersList)) {
      return NextResponse.json({ error: 'Invalid payload, expected array of statement masters' }, { status: 400 });
    }

    // 1. Save strictly into prep_chart_configs DB table with config_key = 'stg_masters'
    const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
      config_key: 'stg_masters',
      config_json: mastersList,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'config_key' });

    if (upsertErr) throw upsertErr;

    // 2. Also sync to entries table (report_type = 'TS') for backward compatibility
    try {
      await supabase.from('entries').insert({
        report_type: 'TS',
        notes: JSON.stringify(mastersList),
        created_by: actorUsername,
      });
    } catch {}

    return NextResponse.json({ success: true, masters: mastersList });
  } catch (err: any) {
    console.error('POST /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save statement masters' }, { status: 500 });
  }
}

// DELETE /api/ts/masters?key=XXX - Delete a statement master from Supabase DB table
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) return NextResponse.json({ error: 'Statement master key required' }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { data: res } = await supabase
      .from('prep_chart_configs')
      .select('config_json')
      .eq('config_key', 'stg_masters')
      .maybeSingle();

    if (res && Array.isArray(res.config_json)) {
      const remaining = res.config_json.filter((m: any) => m.key !== key);
      await supabase.from('prep_chart_configs').upsert({
        config_key: 'stg_masters',
        config_json: remaining,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      return NextResponse.json({ success: true, masters: remaining });
    }

    return NextResponse.json({ success: true, message: 'Statement master deleted' });
  } catch (err: any) {
    console.error('DELETE /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete statement master' }, { status: 500 });
  }
}
