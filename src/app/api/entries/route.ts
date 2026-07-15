import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, getLocalEntries, createLocalEntry, initDb, saveDb } from '@/lib/fileDb';
import type { ReportType, Shift } from '@/lib/types';

// GET /api/entries?report_type=TS&month=2026-06
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const report_type = searchParams.get('report_type') as ReportType | null;
    const month = searchParams.get('month'); // YYYY-MM
    const date = searchParams.get('date');   // YYYY-MM-DD
    const shift = searchParams.get('shift') as Shift | null;

    if (isLocalDbEnabled()) {
      const resolvedShift = searchParams.has('shift') ? shift : undefined;
      const data = await getLocalEntries(report_type || undefined, month || undefined, date || undefined, resolvedShift);
      return NextResponse.json({ data });
    }

    const supabase = getSupabaseServiceClient();
    let query = supabase.from('entries').select('*').order('entry_date', { ascending: false });

    if (report_type) query = query.eq('report_type', report_type);
    if (date) query = query.eq('entry_date', date);
    if (shift) {
      query = query.eq('shift', shift);
    } else if (searchParams.has('shift') && !shift) {
      query = query.is('shift', null);
    }
    if (month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
      query = query.gte('entry_date', start).lte('entry_date', end);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/entries – create or update an entry (upserts notes if duplicate)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entry_date, shift, report_type, notes } = body as {
      entry_date: string;
      shift: Shift | null;
      report_type: ReportType;
      notes?: string;
    };

    if (!entry_date || !report_type) {
      return NextResponse.json({ error: 'entry_date and report_type are required' }, { status: 400 });
    }

    if (isLocalDbEnabled()) {
      const db = await initDb();
      const exists = db.entries.find((e: any) => 
        e.entry_date === entry_date && 
        e.report_type === report_type &&
        (e.shift === shift || (!e.shift && !shift))
      );
      if (exists) {
        exists.notes = notes || null;
        exists.updated_at = new Date().toISOString();
        await saveDb(db);
        return NextResponse.json({ data: exists }, { status: 200 });
      }

      const data = await createLocalEntry(entry_date, shift, report_type, notes);
      return NextResponse.json({ data }, { status: 201 });
    }

    const supabase = getSupabaseServiceClient();

    // Query if entry already exists
    let query = supabase
      .from('entries')
      .select('id')
      .eq('entry_date', entry_date)
      .eq('report_type', report_type);
    
    if (shift) {
      query = query.eq('shift', shift);
    } else {
      query = query.is('shift', null);
    }

    const { data: existing, error: findErr } = await query;
    if (findErr) throw findErr;

    if (existing && existing.length > 0) {
      // Update existing entry's notes
      const { data, error } = await supabase
        .from('entries')
        .update({ notes: notes || null })
        .eq('id', existing[0].id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 200 });
    } else {
      // Insert new entry
      const { data, error } = await supabase
        .from('entries')
        .insert({ entry_date, shift: shift || null, report_type, notes: notes || null })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
