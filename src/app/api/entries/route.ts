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
    const rawShift = searchParams.get('shift');
    const shift = (rawShift === 'null' || !rawShift) ? null : rawShift as Shift;

    const today = new Date().toISOString().split('T')[0];

    if (isLocalDbEnabled()) {
      const resolvedShift = searchParams.has('shift') ? shift : undefined;
      const rawData = await getLocalEntries(report_type || undefined, month || undefined, date || undefined, resolvedShift);
      const data = rawData.map((e: any) => e.entry_date === '1970-01-01' ? { ...e, entry_date: today } : e);
      return NextResponse.json({ data });
    }

    const supabase = getSupabaseServiceClient();

    if (report_type === 'INTERNAL_STOCK_MAPPING') {
      const { data: partitionRules } = await supabase
        .from('receipt_partition_mappings')
        .select('*');
      if (Array.isArray(partitionRules) && partitionRules.length > 0) {
        const formatted = partitionRules.map((r: any) => ({
          id: r.id,
          sourceDisposalParticular: r.source_disposal_particular,
          targetReceiptProductKey: r.target_receipt_product_key,
          targetReceiptProductLabel: r.target_receipt_product_label,
          partitions: r.partitions,
          enabled: r.enabled !== false,
        }));
        return NextResponse.json({
          data: [{
            id: 'db-internal-mappings',
            report_type: 'INTERNAL_STOCK_MAPPING',
            entry_date: today,
            notes: JSON.stringify(formatted)
          }]
        });
      }
    } else if (report_type === 'STOCK_MAPPING') {
      const { data: stmtRules } = await supabase
        .from('statement_mapping_rules')
        .select('*');
      if (Array.isArray(stmtRules) && stmtRules.length > 0) {
        const formatted = stmtRules.map((r: any) => ({
          id: r.id,
          stockProductKey: r.stock_product_key,
          stockProductLabel: r.stock_product_label,
          stockSection: r.stock_section,
          stockParticular: r.stock_particular,
          stgBlockKey: r.stg_block_key,
          stgBlockLabel: r.stg_block_label,
          stgSection: r.stg_section,
          stgItemName: r.stg_item_name,
          stgTargetField: r.stg_target_field
        }));
        return NextResponse.json({
          data: [{
            id: 'db-stock-mappings',
            report_type: 'STOCK_MAPPING',
            entry_date: today,
            notes: JSON.stringify(formatted)
          }]
        });
      }
    }

    let dbReportType = report_type;
    let targetDate = date;

    if (report_type === 'INTERNAL_STOCK_MAPPING') {
      dbReportType = 'STOCK';
      targetDate = '1970-01-02';
    } else if (report_type === 'STOCK_MAPPING') {
      dbReportType = 'STOCK';
      targetDate = '1970-01-03';
    }

    let query = supabase.from('entries').select('*').order('entry_date', { ascending: false });

    if (dbReportType) query = query.eq('report_type', dbReportType);
    if (targetDate) query = query.eq('entry_date', targetDate);
    if (shift) {
      query = query.eq('shift', shift);
    } else if (searchParams.has('shift') && !shift && report_type !== 'INTERNAL_STOCK_MAPPING' && report_type !== 'STOCK_MAPPING') {
      query = query.is('shift', null);
    }
    if (month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const endDate = new Date(Number(y), Number(m), 0);
      const endY = endDate.getFullYear();
      const endM = String(endDate.getMonth() + 1).padStart(2, '0');
      const endD = String(endDate.getDate()).padStart(2, '0');
      const end = `${endY}-${endM}-${endD}`;
      query = query.gte('entry_date', start).lte('entry_date', end);
    }

    const { data: rawData, error } = await query;
    if (error) throw error;
    const data = (rawData || []).map((e: any) => e.entry_date === '1970-01-01' ? { ...e, entry_date: today } : e);
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
    const { shift, report_type, notes } = body as {
      entry_date?: string;
      shift: Shift | null;
      report_type: ReportType;
      notes?: string;
    };
    const today = new Date().toISOString().split('T')[0];
    const entry_date = (!body.entry_date || body.entry_date === '1970-01-01') ? today : body.entry_date;

    if (!report_type) {
      return NextResponse.json({ error: 'report_type is required' }, { status: 400 });
    }

    let cleanNotes: string | null = null;
    if (typeof notes === 'string' && notes.trim().length > 0) {
      cleanNotes = notes.trim();
    }

    if (isLocalDbEnabled()) {
      const db = await initDb();
      const exists = db.entries.find((e: any) => 
        e.entry_date === entry_date && 
        e.report_type === report_type &&
        (e.shift === shift || (!e.shift && !shift))
      );
      if (exists) {
        exists.notes = cleanNotes;
        exists.updated_at = new Date().toISOString();
        await saveDb(db);
        return NextResponse.json({ data: exists }, { status: 200 });
      }

      const data = await createLocalEntry(entry_date, shift, report_type, cleanNotes);
      return NextResponse.json({ data }, { status: 201 });
    }

    const supabase = getSupabaseServiceClient();

    const actorUsername = req.headers.get('x-user-name') || 'admin';

    // ── Direct Handling for INTERNAL_STOCK_MAPPING ───────────────────────────
    if (report_type === 'INTERNAL_STOCK_MAPPING') {
      if (!cleanNotes) {
        return NextResponse.json({ success: true, data: [] }, { status: 200 });
      }
      const rules = JSON.parse(cleanNotes);
      if (!Array.isArray(rules)) {
        return NextResponse.json({ error: 'Invalid rules array' }, { status: 400 });
      }

      // Delete existing records in receipt_partition_mappings
      await supabase.from('receipt_partition_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const toInsert = rules.map((r: any) => ({
        source_disposal_particular: r.sourceDisposalParticular,
        target_receipt_product_key: r.targetReceiptProductKey || null,
        target_receipt_product_label: r.targetReceiptProductLabel || null,
        partitions: r.partitions || null,
        enabled: r.enabled !== false,
        created_by: actorUsername,
        updated_by: actorUsername,
      }));

      if (toInsert.length > 0) {
        const { data: insData, error: insErr } = await supabase
          .from('receipt_partition_mappings')
          .insert(toInsert)
          .select('*');

        if (insErr) {
          console.error('Error writing to receipt_partition_mappings:', insErr);
          // If schema cache error PGRST204 (missing partitions column), retry without optional columns
          if (insErr.code === 'PGRST204' || insErr.message?.includes('partitions')) {
            const fallbackInsert = rules.map((r: any) => ({
              source_disposal_particular: r.sourceDisposalParticular,
              target_receipt_product_key: r.targetReceiptProductKey || null,
              enabled: r.enabled !== false,
              created_by: actorUsername,
              updated_by: actorUsername,
            }));
            const { data: fbData, error: fbErr } = await supabase
              .from('receipt_partition_mappings')
              .insert(fallbackInsert)
              .select('*');
            if (fbErr) throw fbErr;
            return NextResponse.json({ success: true, data: fbData }, { status: 200 });
          }
          throw insErr;
        }
        return NextResponse.json({ success: true, data: insData }, { status: 200 });
      }
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    // ── Direct Handling for STOCK_MAPPING ────────────────────────────────────
    if (report_type === 'STOCK_MAPPING') {
      if (!cleanNotes) {
        return NextResponse.json({ success: true, data: [] }, { status: 200 });
      }
      const rules = JSON.parse(cleanNotes);
      if (!Array.isArray(rules)) {
        return NextResponse.json({ error: 'Invalid rules array' }, { status: 400 });
      }

      // Delete existing records in statement_mapping_rules
      await supabase.from('statement_mapping_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const toInsert = rules.map((r: any) => ({
        stock_product_key: r.stockProductKey,
        stock_product_label: r.stockProductLabel || '',
        stock_section: r.stockSection,
        stock_particular: r.stockParticular,
        stg_block_key: r.stgBlockKey,
        stg_block_label: r.stgBlockLabel || '',
        stg_section: r.stgSection,
        stg_item_name: r.stgItemName,
        stg_target_field: r.stgTargetField || 'qty_lts',
        created_by: actorUsername,
        updated_by: actorUsername,
      }));

      if (toInsert.length > 0) {
        const { data: insData, error: insErr } = await supabase
          .from('statement_mapping_rules')
          .insert(toInsert)
          .select('*');

        if (insErr) {
          console.error('Error writing to statement_mapping_rules:', insErr);
          throw insErr;
        }
        return NextResponse.json({ success: true, data: insData }, { status: 200 });
      }
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    // ── Regular Entries Processing ───────────────────────────────────────────
    let query = supabase
      .from('entries')
      .select('id')
      .eq('entry_date', entry_date)
      .eq('report_type', report_type);
    
    if (shift) {
      query = query.eq('shift', shift);
    }

    const { data: existing, error: findErr } = await query;
    if (findErr) throw findErr;

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('entries')
        .update({ notes: cleanNotes, updated_by: actorUsername, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 200 });
    } else {
      const { data, error } = await supabase
        .from('entries')
        .insert({
          entry_date: entry_date,
          shift: shift || null,
          report_type: report_type,
          notes: cleanNotes,
          created_by: actorUsername,
          updated_by: actorUsername,
        })
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
