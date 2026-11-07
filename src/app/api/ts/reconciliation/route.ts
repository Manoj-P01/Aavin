import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

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

    // 1. Try querying dedicated DB table stg_reconciliation_entries
    try {
      let query = supabase.from('stg_reconciliation_entries').select('*');

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

      if (!error && data && data.length > 0) {
        if (statement_key) {
          return NextResponse.json({
            success: true,
            data: data[0].summary_json || null,
            record: data[0],
            source: 'stg_reconciliation_entries',
          });
        }
        // Map by statement_key
        const map: Record<string, any> = {};
        data.forEach(item => {
          map[item.statement_key] = item.summary_json;
        });
        return NextResponse.json({
          success: true,
          data: map,
          records: data,
          source: 'stg_reconciliation_entries',
        });
      }
    } catch (dbErr) {
      console.warn('Note: stg_reconciliation_entries table query notice:', dbErr);
    }

    // 2. Fallback to prep_chart_configs if table does not exist or has no entry yet
    try {
      if (statement_key && date) {
        const configKey = `stg_recon_${statement_key}_${date}_${shift}`;
        const { data: configData } = await supabase
          .from('prep_chart_configs')
          .select('config_json')
          .eq('config_key', configKey)
          .single();

        if (configData && configData.config_json) {
          return NextResponse.json({
            success: true,
            data: configData.config_json,
            source: 'prep_chart_configs',
          });
        }
      } else if (date) {
        const batchConfigKey = `stg_recon_all_${date}_${shift}`;
        const { data: batchConfigData } = await supabase
          .from('prep_chart_configs')
          .select('config_json')
          .eq('config_key', batchConfigKey)
          .single();

        if (batchConfigData && batchConfigData.config_json) {
          return NextResponse.json({
            success: true,
            data: batchConfigData.config_json,
            source: 'prep_chart_configs',
          });
        }
      }
    } catch (configErr) {
      console.warn('Note: prep_chart_configs fallback query notice:', configErr);
    }

    // 3. Fallback to entries.notes __METADATA__
    if (date) {
      try {
        let entryQuery = supabase
          .from('entries')
          .select('id, notes')
          .eq('entry_date', date)
          .eq('report_type', 'TS');

        if (shift && shift !== 'F' && shift !== 'all') {
          entryQuery = entryQuery.eq('shift', shift);
        }

        const { data: entries } = await entryQuery;
        if (entries && entries.length > 0) {
          const notes = entries[0].notes || '';
          const metaMatch = notes.match(/__METADATA__:(.+)$/m);
          if (metaMatch && metaMatch[1]) {
            try {
              const meta = JSON.parse(metaMatch[1]);
              if (meta.reconciliation) {
                if (statement_key) {
                  return NextResponse.json({
                    success: true,
                    data: meta.reconciliation[statement_key] || null,
                    source: 'entries_notes',
                  });
                }
                return NextResponse.json({
                  success: true,
                  data: meta.reconciliation,
                  source: 'entries_notes',
                });
              }
            } catch {}
          }
        }
      } catch {}
    }

    return NextResponse.json({ success: true, data: null, message: 'No reconciliation entries found' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/ts/reconciliation - Save reconciliation entries as JSON format
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actorUsername = req.headers.get('x-user-name') || 'admin';
    const supabase = getSupabaseServiceClient();

    // Body can be a single statement reconciliation:
    // { entry_id?, statement_key, entry_date, shift?, summary_json }
    // OR multiple statements:
    // { entry_id?, entry_date, shift?, reconciliations: { [key: string]: summary_json } }

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

    let savedToTable = false;

    // 1. Primary: Save to dedicated public.stg_reconciliation_entries table
    try {
      const records = itemsToSave.map(item => ({
        entry_id,
        statement_key: item.statement_key,
        entry_date,
        shift,
        summary_json: item.summary_json,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase
        .from('stg_reconciliation_entries')
        .upsert(records, { onConflict: 'statement_key,entry_date,shift' });

      if (!upsertErr) {
        savedToTable = true;
      } else {
        console.warn('Note: stg_reconciliation_entries upsert notice:', upsertErr.message);
      }
    } catch (dbErr) {
      console.warn('Note: stg_reconciliation_entries table missing or error:', dbErr);
    }

    // 2. Secondary redundancy: Always save to prep_chart_configs as robust fallback
    try {
      for (const item of itemsToSave) {
        const configKey = `stg_recon_${item.statement_key}_${entry_date}_${shift}`;
        await supabase.from('prep_chart_configs').upsert({
          config_key: configKey,
          config_json: item.summary_json,
          updated_by: actorUsername,
          updated_at: new Date().toISOString(),
        });
      }

      // Also save combined map
      const combinedMap: Record<string, any> = {};
      itemsToSave.forEach(i => { combinedMap[i.statement_key] = i.summary_json; });
      await supabase.from('prep_chart_configs').upsert({
        config_key: `stg_recon_all_${entry_date}_${shift}`,
        config_json: combinedMap,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      });
    } catch (confErr) {
      console.warn('Note: prep_chart_configs backup notice:', confErr);
    }

    return NextResponse.json({
      success: true,
      saved_count: itemsToSave.length,
      saved_to_table: savedToTable,
      message: savedToTable
        ? 'Reconciliation summary entries saved strictly to stg_reconciliation_entries'
        : 'Reconciliation summary saved to prep_chart_configs (table fallback)',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

