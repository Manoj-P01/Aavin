import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const shift = searchParams.get('shift');
    const chartsParam = searchParams.get('charts');
    const chartKeys = chartsParam ? chartsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    const supabase = getSupabaseServiceClient();

    // 1. Fetch configs (masters and columns)
    const { data: configsData, error: configErr } = await supabase
      .from('prep_chart_configs')
      .select('config_key, config_json')
      .in('config_key', ['masters', 'columns']);

    if (configErr) {
      return NextResponse.json({ error: configErr.message }, { status: 500 });
    }

    const masters = configsData?.find(c => c.config_key === 'masters')?.config_json || [];
    const columns = configsData?.find(c => c.config_key === 'columns')?.config_json || [];

    // 2. Query entries with explicit columns
    let query = supabase
      .from('prep_chart_entries')
      .select('id, chart_key, entry_date, shift, entry_json, updated_at')
      .order('entry_date', { ascending: false })
      .order('chart_key', { ascending: true })
      .order('shift', { ascending: true });

    if (from) {
      query = query.gte('entry_date', from);
    }
    if (to) {
      query = query.lte('entry_date', to);
    }
    if (shift && shift !== 'all' && shift !== 'B') {
      query = query.eq('shift', shift);
    }
    if (chartKeys.length > 0) {
      query = query.in('chart_key', chartKeys);
    }

    const { data: entries, error: entriesErr } = await query;
    if (entriesErr) {
      return NextResponse.json({ error: entriesErr.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        masters,
        columns,
        entries: entries || [],
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

