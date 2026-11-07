import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_TS_MASTER } from '../statement-masters/route';

// GET /api/ts/statement-columns
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Try reading from ts_masters
    try {
      const { data, error } = await supabase
        .from('ts_masters')
        .select('columns')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data && Array.isArray(data.columns) && data.columns.length > 0) {
        return NextResponse.json({ columns: data.columns, source: 'ts_masters' });
      }
    } catch (e) {
      console.warn('Failed reading columns from ts_masters:', e);
    }

    // 2. Check prep_chart_configs
    try {
      const { data: cfg, error: cfgErr } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'ts_masters')
        .maybeSingle();

      if (!cfgErr && cfg && cfg.config_json && Array.isArray(cfg.config_json.columns) && cfg.config_json.columns.length > 0) {
        return NextResponse.json({ columns: cfg.config_json.columns, source: 'prep_chart_configs' });
      }
    } catch (e) {
      console.warn('Failed reading columns from prep_chart_configs:', e);
    }

    // 3. Fallback
    return NextResponse.json({ columns: DEFAULT_TS_MASTER.columns, source: 'default_constants' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch TS statement columns';
    return NextResponse.json({ error: msg, columns: DEFAULT_TS_MASTER.columns }, { status: 500 });
  }
}

// POST /api/ts/statement-columns
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const columns = Array.isArray(body.columns) ? body.columns : [];
    const supabase = getSupabaseServiceClient();

    if (columns.length === 0) {
      return NextResponse.json({ error: 'Columns array cannot be empty' }, { status: 400 });
    }

    // Update in ts_masters
    let savedToTsMasters = false;
    try {
      const { data: existing } = await supabase
        .from('ts_masters')
        .select('*')
        .eq('key', 'default_ts')
        .maybeSingle();

      const updated = {
        ...(existing || DEFAULT_TS_MASTER),
        columns,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('ts_masters')
        .upsert(updated, { onConflict: 'key' });

      if (!upsertErr) savedToTsMasters = true;
    } catch (e) {
      console.warn('ts_masters column update error:', e);
    }

    // Backup to prep_chart_configs
    try {
      const { data: cfg } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'ts_masters')
        .maybeSingle();

      const updatedCfg = {
        ...(cfg?.config_json || DEFAULT_TS_MASTER),
        columns,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('prep_chart_configs')
        .upsert({
          config_key: 'ts_masters',
          config_json: updatedCfg,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'config_key' });
    } catch (e) {
      console.warn('prep_chart_configs column backup error:', e);
    }

    return NextResponse.json({ success: true, columns, saved_to_db: savedToTsMasters });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save TS statement columns';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

