import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, getLocalEntries, createLocalEntry } from '@/lib/fileDb';
import type { ReportType, Shift } from '@/lib/types';

// GET /api/entries?report_type=TS&month=2026-06
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const report_type = searchParams.get('report_type') as ReportType | null;
    const month = searchParams.get('month'); // YYYY-MM
    const date = searchParams.get('date');   // YYYY-MM-DD

    if (isLocalDbEnabled()) {
      const data = getLocalEntries(report_type || undefined, month || undefined, date || undefined);
      return NextResponse.json({ data });
    }

    const supabase = getSupabaseServiceClient();
    let query = supabase.from('entries').select('*').order('entry_date', { ascending: false });

    if (report_type) query = query.eq('report_type', report_type);
    if (date) query = query.eq('entry_date', date);
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

// POST /api/entries – create a new entry
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
      // Guard duplicate
      const entries = getLocalEntries(report_type, undefined, entry_date);
      const exists = entries.find(e => e.shift === (shift || null));
      if (exists) {
        return NextResponse.json({ error: 'Entry for this date/shift already exists' }, { status: 409 });
      }

      const data = createLocalEntry(entry_date, shift, report_type, notes);
      return NextResponse.json({ data }, { status: 201 });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('entries')
      .insert({ entry_date, shift: shift || null, report_type, notes: notes || null })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Entry for this date/shift already exists' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
