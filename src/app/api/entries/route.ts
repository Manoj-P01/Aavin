import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import type { ReportType, ExtendedReportType, Shift } from '@/lib/types';

// GET /api/entries?report_type=TS&month=2026-06
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const report_type = searchParams.get('report_type') as ExtendedReportType | null;
    const month = searchParams.get('month'); // YYYY-MM
    const date = searchParams.get('date');   // YYYY-MM-DD
    const rawShift = searchParams.get('shift');
    const shift = (rawShift === 'null' || !rawShift) ? null : rawShift as Shift;

    const today = new Date().toISOString().split('T')[0];

    const supabase = getSupabaseServiceClient();

    if (report_type === 'INTERNAL_STOCK_MAPPING') {
      const { data: partitionRules } = await supabase
        .from('receipt_partition_mappings')
        .select('id, source_disposal_particular, target_receipt_product_key, target_receipt_product_label, partitions, enabled');
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
        .select('id, stock_product_key, stock_product_label, stock_section, stock_particular, stg_block_key, stg_block_label, stg_section, stg_item_name, stg_target_field');
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

    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 500) : 100;
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

    let query = supabase
      .from('entries')
      .select('id, entry_date, report_type, shift, notes, status, created_by, updated_by, created_at, updated_at')
      .order('entry_date', { ascending: false })
      .order('report_type', { ascending: true })
      .order('shift', { ascending: true });

    if (dbReportType) query = query.eq('report_type', dbReportType);
    if (targetDate) query = query.eq('entry_date', targetDate);
    if (fromDate) query = query.gte('entry_date', fromDate);
    if (toDate) query = query.lte('entry_date', toDate);
    if (shift) {
      query = query.eq('shift', shift);
    } else if (searchParams.has('shift') && !shift) {
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

    query = query.range(offset, offset + limit - 1);

    const { data: rawData, error } = await query;
    if (error) throw error;
    const data = rawData || [];

    // Performance Optimization: Only fetch child stock_rows/stock_summary_rows if specifically requested
    // (e.g. periodical reports) or for a single target date entry, preventing massive full-database joins.
    const includeRows = searchParams.get('include_rows') === 'true' || 
                        searchParams.get('rows') === 'true' || 
                        Boolean(targetDate && data.length <= 5);

    if (includeRows && dbReportType === 'STOCK' && data.length > 0) {
      const entryIds = data.map((e: any) => e.id);
      try {
        const [rowsRes, summaryRes] = await Promise.all([
          supabase.from('stock_rows').select('id, entry_id, row_type, row_label, entry_json, sort_order').in('entry_id', entryIds).order('sort_order'),
          supabase.from('stock_summary_rows').select('id, entry_id, summary_type, row_label, summary_data, sort_order').in('entry_id', entryIds).order('sort_order'),
        ]);

        const rowsMap: Record<string, any[]> = {};
        const summaryMap: Record<string, any[]> = {};

        (rowsRes.data || []).forEach((r: any) => {
          if (!rowsMap[r.entry_id]) rowsMap[r.entry_id] = [];
          const entryJson = typeof r.entry_json === 'string' ? JSON.parse(r.entry_json) : (r.entry_json || {});
          if (Array.isArray(entryJson.rows) && entryJson.rows.length > 0) {
            entryJson.rows.forEach((inner: any, iIdx: number) => {
              rowsMap[r.entry_id].push({
                id: `${r.id}_${iIdx}`,
                entry_id: r.entry_id,
                row_type: inner.row_type || r.row_type,
                row_label: inner.row_label || r.row_label,
                values: inner.values || {},
                sort_order: inner.sort_order ?? (r.sort_order * 100 + iIdx),
                ...(inner.values || {}),
              });
            });
          } else {
            rowsMap[r.entry_id].push(r);
          }
        });

        (summaryRes.data || []).forEach((s: any) => {
          if (!summaryMap[s.entry_id]) summaryMap[s.entry_id] = [];
          summaryMap[s.entry_id].push(s);
        });

        data.forEach((e: any) => {
          e.stock_rows = rowsMap[e.id] || [];
          e.stock_summary_rows = summaryMap[e.id] || [];
        });
      } catch (err) {
        console.warn('Warning fetching stock_rows or stock_summary_rows for entries:', err);
      }
    }

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
      report_type: ExtendedReportType;
      notes?: string;
    };
    const today = new Date().toISOString().split('T')[0];
    const entry_date = body.entry_date || today;

    if (!report_type) {
      return NextResponse.json({ error: 'report_type is required' }, { status: 400 });
    }

    let cleanNotes: string | null = null;
    if (typeof notes === 'string' && notes.trim().length > 0) {
      cleanNotes = notes.trim();
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
          .select('id, source_disposal_particular, target_receipt_product_key, target_receipt_product_label, partitions, enabled');

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
              .select('id, source_disposal_particular, target_receipt_product_key, enabled');
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

      // Safe FK lookups
      const [secRes, fieldRes] = await Promise.all([
        supabase.from('stg_section_master').select('section_key'),
        supabase.from('stg_field_master').select('field_key'),
      ]);
      const vSecKeys = new Set((secRes.data || []).map((s: any) => s.section_key));
      const sLowerMap = new Map<string, string>();
      (secRes.data || []).forEach((s: any) => sLowerMap.set(String(s.section_key).toLowerCase(), s.section_key));

      const vFieldKeys = new Set((fieldRes.data || []).map((f: any) => f.field_key));
      const fLowerMap = new Map<string, string>();
      (fieldRes.data || []).forEach((f: any) => fLowerMap.set(String(f.field_key).toLowerCase(), f.field_key));

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const toInsert = rules.map((r: any) => {
        const rawSec = r.section_key || r.stgSection || r.stg_section;
        const safeSec = rawSec && (vSecKeys.has(rawSec) ? rawSec : sLowerMap.get(String(rawSec).toLowerCase()) || null);
        const rawTarget = r.target_field || r.stgTargetField || r.stg_target_field;
        const cleanTarget = String(rawTarget || '').trim().toLowerCase();
        const normTarget = (!cleanTarget || ['ob', 'cb', 'receipt', 'disposal', 'variant', 'particular', 'particulars', 'label', 'name', 'item_name'].includes(cleanTarget))
          ? 'qty_lts'
          : (rawTarget || 'qty_lts');
        const safeTarget = normTarget && (vFieldKeys.has(normTarget) ? normTarget : fLowerMap.get(String(normTarget).toLowerCase()) || null);

        return {
          ...(typeof r.id === 'string' && UUID_REGEX.test(r.id) ? { id: r.id } : {}),
          stock_product_key: r.stockProductKey || r.stock_product_key || '',
          stock_product_label: r.stockProductLabel || r.stock_product_label || '',
          stock_section: r.stockSection || r.stock_section || '',
          stock_particular: r.stockParticular || r.stock_particular || '',
          stg_block_key: r.stgBlockKey || r.stg_block_key || r.statement_key || '',
          stg_block_label: r.stgBlockLabel || r.stg_block_label || '',
          stg_section: r.stgSection || r.stg_section || r.section_key || '',
          stg_item_name: r.stgItemName || r.stg_item_name || '',
          stg_target_field: normTarget,
          statement_key: r.statement_key || r.stgBlockKey || r.stg_block_key,
          section_key: safeSec || null,
          target_field: safeTarget || null,
          source_stage: r.source_stage || 'stage2',
          enabled: r.enabled !== false,
          created_by: actorUsername,
          updated_by: actorUsername,
        };
      });

      if (toInsert.length > 0) {
        const { data: insData, error: insErr } = await supabase
          .from('statement_mapping_rules')
          .upsert(toInsert)
          .select('id, stock_product_key, stock_product_label, stock_section, stock_particular, stg_block_key, stg_block_label, stg_section, stg_item_name, stg_target_field');

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
