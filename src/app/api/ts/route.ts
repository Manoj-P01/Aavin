import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { calcKgFatSnf } from '@/lib/calculations';
import { isLocalDbEnabled, getLocalEntries, getLocalTSData, saveLocalTSData, initDb, saveDb } from '@/lib/fileDb';
import type { TSMilkRowInput, STGRow, Shift } from '@/lib/types';

// GET /api/ts?entry_id=xxx  OR  ?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entry_id = searchParams.get('entry_id');
    const date = searchParams.get('date');

    if (!entry_id && !date) {
      return NextResponse.json({ error: 'entry_id or date required' }, { status: 400 });
    }

    const shift = searchParams.get('shift') as Shift | null;

    if (isLocalDbEnabled()) {
      let resolvedEntryId = entry_id;
      let notes = '';
      if (!resolvedEntryId && date) {
        let entries = getLocalEntries('TS', undefined, date, shift);
        if (entries.length === 0 && (shift === 'D' || shift === 'N')) {
          // Fallback to null shift for legacy entries
          entries = getLocalEntries('TS', undefined, date, null);
        }
        if (entries.length === 0) return NextResponse.json({ error: 'TS entry not found for date' }, { status: 404 });
        resolvedEntryId = entries[0].id;
        notes = entries[0].notes || '';
      } else if (resolvedEntryId) {
        const db = initDb();
        const entry = db.entries.find((e: any) => e.id === resolvedEntryId);
        if (entry) notes = entry.notes || '';
      }
      const tsData = getLocalTSData(resolvedEntryId!);
      return NextResponse.json({ data: { ...tsData, notes } });
    }

    const supabase = getSupabaseServiceClient();
    let resolvedEntryId = entry_id;
    let entryNotes = '';

    if (!resolvedEntryId && date) {
      let query = supabase
        .from('entries')
        .select('id, notes')
        .eq('entry_date', date)
        .eq('report_type', 'TS');

      if (shift) {
        query = query.eq('shift', shift);
      } else {
        query = query.is('shift', null);
      }

      let { data: entries, error: entryErr } = await query;
      if ((entryErr || !entries || entries.length === 0) && (shift === 'D' || shift === 'N')) {
        // Fallback to null shift for legacy entries in Supabase
        const fallbackQuery = supabase
          .from('entries')
          .select('id, notes')
          .eq('entry_date', date)
          .eq('report_type', 'TS')
          .is('shift', null);
        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          entries = fallbackRes.data;
        }
      }

      if (!entries || entries.length === 0) {
        return NextResponse.json({ error: 'TS entry not found for date' }, { status: 404 });
      }
      resolvedEntryId = entries[0].id;
      entryNotes = entries[0].notes || '';
    } else if (resolvedEntryId) {
      const { data: entry } = await supabase
        .from('entries')
        .select('notes')
        .eq('id', resolvedEntryId)
        .single();
      if (entry) entryNotes = entry.notes || '';
    }

    const [tsRows, stgRows] = await Promise.all([
      supabase.from('ts_milk_rows').select('*').eq('entry_id', resolvedEntryId!).order('sort_order'),
      supabase.from('stg_rows').select('*').eq('entry_id', resolvedEntryId!).order('sort_order'),
    ]);

    if (tsRows.error) throw tsRows.error;
    if (stgRows.error) throw stgRows.error;

    return NextResponse.json({ data: { ts_rows: tsRows.data, stg_rows: stgRows.data, notes: entryNotes } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/ts – save TS + STG rows for an entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entry_id, ts_rows, stg_rows } = body as {
      entry_id: string;
      ts_rows: (TSMilkRowInput & { section: string; sort_order?: number })[];
      stg_rows?: Partial<STGRow>[];
    };

    if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });
    const { section } = body as { section?: string };

    if (isLocalDbEnabled()) {
      const tsInsert = saveLocalTSData(entry_id, ts_rows, stg_rows, section);
      return NextResponse.json({
        data: { ts_rows: tsInsert, stg_rows: stg_rows || [] },
      }, { status: 201 });
    }

    const supabase = getSupabaseServiceClient();

    // Compute or use manual values for TS rows
    const tsRowsWithCalc = (ts_rows || []).map((r, i) => {
      const qty_kg = Number(r.qty_kg) || 0;
      const fat_pct = Number(r.fat_pct) || 0;
      const snf_pct = Number(r.snf_pct) || 0;
      const defaults = calcKgFatSnf(qty_kg, fat_pct, snf_pct);

      // If user typed custom values, prioritize them, otherwise use auto-calculated ones
      const kg_fat = r.kg_fat !== undefined && r.kg_fat !== '' ? Number(r.kg_fat) : defaults.kg_fat;
      const kg_snf = r.kg_snf !== undefined && r.kg_snf !== '' ? Number(r.kg_snf) : defaults.kg_snf;

      return {
        entry_id,
        section: r.section,
        product: r.product,
        qty_lts: Number(r.qty_lts) || 0,
        qty_kg,
        fat_pct,
        snf_pct,
        sp_gr: Number(r.sp_gr) || 0,
        kg_fat,
        kg_snf,
        remarks: r.remarks || null,
        sort_order: r.sort_order ?? i,
      };
    });

    const stgRowsWithCalc = (stg_rows || []).map((r, i) => {
      const qty_kg = Number(r.qty_kg) || 0;
      const fat_pct = Number(r.fat_pct) || 0;
      const snf_pct = Number(r.snf_pct) || 0;
      const defaults = calcKgFatSnf(qty_kg, fat_pct, snf_pct);
      const kg_fat = r.kg_fat !== undefined && Number(r.kg_fat) !== 0 ? Number(r.kg_fat) : defaults.kg_fat;
      const kg_snf = r.kg_snf !== undefined && Number(r.kg_snf) !== 0 ? Number(r.kg_snf) : defaults.kg_snf;
      return {
        entry_id,
        product_block: r.product_block,
        side: r.side,
        item_name: r.item_name,
        qty_lts: Number(r.qty_lts) || 0,
        qty_kg,
        fat_pct,
        snf_pct,
        sp_gr: Number(r.sp_gr) || 0,
        kg_fat,
        kg_snf,
        sort_order: r.sort_order ?? i,
      };
    });

    // Delete existing rows for this entry/section then re-insert
    if (section) {
      await supabase.from('ts_milk_rows').delete().eq('entry_id', entry_id).eq('section', section);
    } else {
      await Promise.all([
        supabase.from('ts_milk_rows').delete().eq('entry_id', entry_id),
        supabase.from('stg_rows').delete().eq('entry_id', entry_id),
      ]);
    }

    const [tsInsert, stgInsert] = await Promise.all([
      tsRowsWithCalc.length > 0
        ? supabase.from('ts_milk_rows').insert(tsRowsWithCalc).select()
        : Promise.resolve({ data: [], error: null }),
      stgRowsWithCalc.length > 0
        ? supabase.from('stg_rows').insert(stgRowsWithCalc).select()
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tsInsert.error) throw tsInsert.error;
    if (stgInsert.error) throw stgInsert.error;

    return NextResponse.json({
      data: { ts_rows: tsInsert.data, stg_rows: stgInsert.data },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
