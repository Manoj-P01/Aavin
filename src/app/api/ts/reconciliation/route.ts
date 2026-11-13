import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ts/reconciliation?date=YYYY-MM-DD&shift=F&statement_key=WM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const statement_key = searchParams.get('statement_key');
    const entry_id = searchParams.get('entry_id');
    const rawShift = searchParams.get('shift');
    const shift = (rawShift === 'null' || !rawShift) ? 'F' : rawShift;

    if (!date && !entry_id) {
      return NextResponse.json({ error: 'date or entry_id required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('stg_reconciliation_entries')
      .select('id, entry_id, statement_key, entry_date, shift, summary_json, updated_at')
      .order('entry_date', { ascending: false })
      .order('statement_key', { ascending: true })
      .order('shift', { ascending: true });

    if (entry_id) {
      query = query.eq('entry_id', entry_id);
    } else if (date) {
      query = query.eq('entry_date', date);
      if (shift && shift !== 'all') {
        query = query.eq('shift', shift);
      }
    }

    if (statement_key) {
      query = query.eq('statement_key', statement_key);
    }

    const { data, error } = await query;

    if (error) {
      console.error('stg_reconciliation_entries query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data && data.length > 0) {
      if (statement_key) {
        return NextResponse.json({
          success: true,
          data: data[0].summary_json || {},
          record: data[0],
          source: 'stg_reconciliation_entries',
        });
      }
      const map: Record<string, any> = {};
      data.forEach(item => {
        map[item.statement_key] = item.summary_json || {};
      });
      return NextResponse.json({
        success: true,
        data: map,
        records: data,
        source: 'stg_reconciliation_entries',
      });
    }

    // When no reconciliation entry exists, return empty object without inventing data
    return NextResponse.json({
      success: true,
      data: statement_key ? {} : {},
      records: [],
      source: 'none',
      message: 'No reconciliation entries found',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/ts/reconciliation - Save reconciliation entries strictly into stg_reconciliation_entries table
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || req.headers.get('x-user-name') || 'admin';
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    const entry_id = body.entry_id || null;
    const entry_date = body.entry_date;
    const shift = body.shift || 'F';

    if (!entry_date) {
      return NextResponse.json({ error: 'entry_date is required' }, { status: 400 });
    }

    const itemsToSave: Array<{ statement_key: string; summary_json: any }> = [];

    if (body.statement_key && body.summary_json) {
      itemsToSave.push({
        statement_key: body.statement_key,
        summary_json: body.summary_json,
      });
    } else if (body.reconciliations && typeof body.reconciliations === 'object') {
      Object.entries(body.reconciliations).forEach(([key, val]) => {
        itemsToSave.push({
          statement_key: key,
          summary_json: val,
        });
      });
    }

    if (itemsToSave.length === 0) {
      return NextResponse.json({ error: 'No reconciliation summary items provided' }, { status: 400 });
    }

    const records = itemsToSave.map(item => ({
      entry_id,
      statement_key: item.statement_key,
      entry_date,
      shift,
      summary_json: item.summary_json,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }));

    const { data, error: upsertErr } = await supabase
      .from('stg_reconciliation_entries')
      .upsert(records, { onConflict: 'entry_date,statement_key,shift' })
      .select();

    if (upsertErr) {
      console.error('stg_reconciliation_entries upsert error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      saved_count: itemsToSave.length,
      data,
      message: 'Reconciliation summary entries saved strictly to stg_reconciliation_entries',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
