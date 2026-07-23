import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx-js-style';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, initDb } from '@/lib/fileDb';
import { generateDynamicBalanceRows, calcTSTotals } from '@/lib/calculations';
import type { Shift, TSMilkRow, STGRow } from '@/lib/types';

// Helper to create styled cell objects
function cell(value: any, opts?: { isHeader?: boolean; isBold?: boolean; isNum?: boolean; isTitle?: boolean; alignment?: string; noBorder?: boolean }) {
  const isHeader = opts?.isHeader ?? false;
  const isBold = opts?.isBold ?? false;
  const isNum = opts?.isNum ?? false;
  const isTitle = opts?.isTitle ?? false;
  const noBorder = opts?.noBorder ?? false;

  let type = 's';
  if (typeof value === 'number') {
    type = 'n';
  } else if (typeof value === 'boolean') {
    type = 'b';
  }

  const style: any = {
    font: {
      name: 'Calibri',
      sz: isTitle ? 11 : 10,
      bold: isHeader || isBold || isTitle,
    },
    alignment: {
      vertical: 'center',
      horizontal: opts?.alignment || (isNum ? 'right' : (isHeader || isTitle ? 'center' : 'left')),
    }
  };

  if (!noBorder) {
    style.border = {
      top: { style: 'thin', color: { rgb: 'A0A0A0' } },
      bottom: { style: 'thin', color: { rgb: 'A0A0A0' } },
      left: { style: 'thin', color: { rgb: 'A0A0A0' } },
      right: { style: 'thin', color: { rgb: 'A0A0A0' } }
    };
  }

  if (isTitle) {
    style.fill = { fgColor: { rgb: 'F1F5F9' } };
  } else if (isHeader) {
    style.fill = { fgColor: { rgb: 'E2E8F0' } };
  }

  return { v: value === null || value === undefined ? '' : value, t: type, s: style };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const rawShift = searchParams.get('shift');
    const shift = (rawShift === 'null' || !rawShift) ? null : rawShift as Shift;
    const includeStg = searchParams.get('stg') === 'true';
    const includeTs = searchParams.get('ts') === 'true';

    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    let entryNotes = '';
    let stgRowsData: STGRow[] = [];
    let tsRowsData: TSMilkRow[] = [];

    // 1. Fetch data from DB or local JSON
    if (isLocalDbEnabled()) {
      const db = await initDb();
      const entry = db.entries.find((e: any) =>
        e.entry_date === date &&
        e.report_type === 'TS' &&
        (e.shift === shift || (!e.shift && !shift))
      );
      if (entry) {
        entryNotes = entry.notes || '';
        stgRowsData = db.stg_rows.filter((r: any) => r.entry_id === entry.id) as STGRow[];
        tsRowsData = db.ts_milk_rows.filter((r: any) => r.entry_id === entry.id) as TSMilkRow[];
      }
    } else {
      const supabase = getSupabaseServiceClient();
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

      const { data: entries, error: entryErr } = await query;
      if (entryErr) throw entryErr;

      if (entries && entries.length > 0) {
        const entryId = entries[0].id;
        entryNotes = entries[0].notes || '';

        const [tsRows, stgRows] = await Promise.all([
          supabase
            .from('ts_milk_rows')
            .select('*')
            .eq('entry_id', entryId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('stg_rows')
            .select('*')
            .eq('entry_id', entryId)
            .order('sort_order', { ascending: true }),
        ]);

        if (tsRows.error) throw tsRows.error;
        if (stgRows.error) throw stgRows.error;

        tsRowsData = tsRows.data as TSMilkRow[];
        stgRowsData = stgRows.data as STGRow[];
      }
    }

    if (tsRowsData.length === 0 && stgRowsData.length === 0) {
      return NextResponse.json({ error: 'No report data found for this date and shift' }, { status: 404 });
    }

    // Determine shift text
    const shiftText = shift ? (shift === 'D' ? 'Day Shift' : 'Night Shift') : 'Full Day';

    // 2. Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Set common column widths
    const colWidths = [
      { wch: 6 },  // S.No
      { wch: 24 }, // Name
      { wch: 14 }, // Lit
      { wch: 14 }, // Kg
      { wch: 11 }, // Fat
      { wch: 11 }, // SNF
      { wch: 11 }, // SpGr
      { wch: 13 }, // Kg Fat
      { wch: 13 }, // Kg SNF
      { wch: 6 },  // S.No
      { wch: 24 }, // Name
      { wch: 14 }, // Lit
      { wch: 14 }, // Kg
      { wch: 11 }, // Fat
      { wch: 11 }, // SNF
      { wch: 11 }, // SpGr
      { wch: 13 }, // Kg Fat
      { wch: 13 }  // Kg SNF
    ];

    // Format helper to format values as numbers/strings
    const val = (v: number | null | undefined, decimals = 3) => {
      if (v === null || v === undefined || isNaN(v)) return 0;
      return Number(v.toFixed(decimals));
    };

    // 3. Build TS Report Sheet
    if (includeTs && tsRowsData.length > 0) {
      // Get global statements config
      let gStmts: any[] = [];
      if (isLocalDbEnabled()) {
        const db = await initDb();
        const tsEntries = db.entries.filter((e: any) => e.report_type === 'TS').sort((a: any, b: any) => (b.entry_date || '').localeCompare(a.entry_date || ''));
        const configEntry = tsEntries.find((e: any) => {
          if (!e.notes || e.notes.includes('__METADATA__:')) return false;
          try {
            const parsed = JSON.parse(e.notes);
            return Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.key !== undefined);
          } catch { return false; }
        });
        if (configEntry && configEntry.notes) {
          try { gStmts = JSON.parse(configEntry.notes) || []; } catch {}
        }
      } else {
        const supabase = getSupabaseServiceClient();
        const { data } = await supabase.from('entries').select('notes').eq('report_type', 'TS').order('entry_date', { ascending: false });
        if (data && data.length > 0) {
          const configRow = data.find((e: any) => {
            if (!e.notes || e.notes.includes('__METADATA__:')) return false;
            try {
              const parsed = JSON.parse(e.notes);
              return Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.key !== undefined);
            } catch { return false; }
          });
          if (configRow && configRow.notes) {
            try { gStmts = JSON.parse(configRow.notes) || []; } catch {}
          }
        }
      }

      const { obRows, cbRows } = generateDynamicBalanceRows(tsRowsData, entryNotes, gStmts);
      const otherTsRows = tsRowsData.filter(r => r.section !== 'OB' && r.section !== 'CB');
      const rows = [...obRows, ...otherTsRows, ...cbRows];
      const totals = calcTSTotals(rows);

      // Group rows by section
      const rowsBySection: Record<string, TSMilkRow[]> = {
        OB: rows.filter(r => r.section === 'OB'),
        RECEIPT: rows.filter(r => r.section === 'RECEIPT'),
        DISPOSAL_DESPATCH: rows.filter(r => r.section === 'DISPOSAL_DESPATCH'),
        LOCAL_SALE: rows.filter(r => r.section === 'LOCAL_SALE'),
        OTHER_DISPOSAL: rows.filter(r => r.section === 'OTHER_DISPOSAL'),
        CB: rows.filter(r => r.section === 'CB'),
      };

      const getSectionTotal = (sRows: TSMilkRow[]) => ({
        qty_lts: sRows.reduce((a, r) => a + (r.qty_lts || 0), 0),
        qty_kg: sRows.reduce((a, r) => a + (r.qty_kg || 0), 0),
        kg_fat: sRows.reduce((a, r) => a + (r.kg_fat || 0), 0),
        kg_snf: sRows.reduce((a, r) => a + (r.kg_snf || 0), 0),
      });

      // Align columns side-by-side
      type AlignedRow = {
        left: { type: 'header'; label: string } | { type: 'total'; label: string; qty_lts: number; qty_kg: number; kg_fat: number; kg_snf: number } | { type: 'item'; index: number; data: TSMilkRow } | { type: 'empty' };
        right: { type: 'header'; label: string } | { type: 'total'; label: string; qty_lts: number; qty_kg: number; kg_fat: number; kg_snf: number } | { type: 'item'; index: number; data: TSMilkRow } | { type: 'empty' };
      };

      const leftList: AlignedRow['left'][] = [];
      const rightList: AlignedRow['right'][] = [];

      // Pop left
      if (rowsBySection.OB.length > 0) {
        leftList.push({ type: 'header', label: 'O/B' });
        rowsBySection.OB.forEach((r, i) => leftList.push({ type: 'item', index: i + 1, data: r }));
        leftList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.OB) });
      }
      if (rowsBySection.RECEIPT.length > 0) {
        leftList.push({ type: 'header', label: 'RECEIPTS' });
        rowsBySection.RECEIPT.forEach((r, i) => leftList.push({ type: 'item', index: i + 1, data: r }));
        leftList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.RECEIPT) });
      }

      // Pop right
      if (rowsBySection.DISPOSAL_DESPATCH.length > 0) {
        rightList.push({ type: 'header', label: 'DESPATCH/SALE' });
        rowsBySection.DISPOSAL_DESPATCH.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.DISPOSAL_DESPATCH) });
      }
      if (rowsBySection.LOCAL_SALE.length > 0) {
        rightList.push({ type: 'header', label: 'LOCAL SALES' });
        rowsBySection.LOCAL_SALE.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.LOCAL_SALE) });
      }
      if (rowsBySection.OTHER_DISPOSAL.length > 0) {
        rightList.push({ type: 'header', label: 'OTHER DISPOSAL' });
        rowsBySection.OTHER_DISPOSAL.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.OTHER_DISPOSAL) });
      }
      if (rowsBySection.CB.length > 0) {
        rightList.push({ type: 'header', label: 'C/B' });
        rowsBySection.CB.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'TOTAL', ...getSectionTotal(rowsBySection.CB) });
      }

      const alignedRows: AlignedRow[] = [];
      const maxLen = Math.max(leftList.length, rightList.length);
      for (let i = 0; i < maxLen; i++) {
        alignedRows.push({
          left: leftList[i] || { type: 'empty' },
          right: rightList[i] || { type: 'empty' },
        });
      }

      // Build Sheet Data
      const tsData: any[][] = [
        [
          cell('NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS\' UNION LTD', { isBold: true, noBorder: true })
        ],
        [
          cell('                         TOTAL SOLIDS DETAILS ', { isBold: true, noBorder: true }),
          ...new Array(16).fill(cell('', { noBorder: true })),
          cell(new Date(date).toLocaleDateString('en-IN'), { isBold: true, noBorder: true, alignment: 'right' })
        ],
        [
          cell('S.no', { isHeader: true }), cell('Arrival', { isHeader: true }), cell('Milk (Lit)', { isHeader: true }), cell('Milk (Kg)', { isHeader: true }), cell('Avg Fat %', { isHeader: true }), cell('Avg SNF %', { isHeader: true }), cell('Sp. Gr', { isHeader: true }), cell('Kg Fat', { isHeader: true }), cell('Kg SNF', { isHeader: true }),
          cell('S.no', { isHeader: true }), cell('Disposal', { isHeader: true }), cell('Milk (Lit)', { isHeader: true }), cell('Milk (Kg)', { isHeader: true }), cell('Avg Fat %', { isHeader: true }), cell('Avg SNF %', { isHeader: true }), cell('Sp. Gr', { isHeader: true }), cell('Kg Fat', { isHeader: true }), cell('Kg SNF', { isHeader: true })
        ]
      ];

      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
      ];

      alignedRows.forEach((row, i) => {
        const rIndex = 3 + i;
        const rowVal: any[] = new Array(18).fill('');

        // Left side
        if (row.left.type === 'header') {
          // Label goes to column index 1 because the merge is from 1 to 8
          rowVal[0] = cell('');
          rowVal[1] = cell(row.left.label, { isBold: true });
          for (let c = 2; c < 9; c++) rowVal[c] = cell('');
          merges.push({ s: { r: rIndex, c: 1 }, e: { r: rIndex, c: 8 } });
        } else if (row.left.type === 'total') {
          // Merge is from 0 to 1, so the label MUST go into column index 0!
          rowVal[0] = cell(row.left.label, { isBold: true });
          rowVal[1] = cell('');
          rowVal[2] = cell(val(row.left.qty_lts), { isBold: true, isNum: true });
          rowVal[3] = cell(val(row.left.qty_kg), { isBold: true, isNum: true });
          rowVal[4] = cell('');
          rowVal[5] = cell('');
          rowVal[6] = cell('');
          rowVal[7] = cell(val(row.left.kg_fat, 4), { isBold: true, isNum: true });
          rowVal[8] = cell(val(row.left.kg_snf, 4), { isBold: true, isNum: true });
          merges.push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 1 } });
        } else if (row.left.type === 'item') {
          const item = row.left.data;
          rowVal[0] = cell(row.left.index);
          rowVal[1] = cell(item.product);
          rowVal[2] = cell(val(item.qty_lts), { isNum: true });
          rowVal[3] = cell(val(item.qty_kg), { isNum: true });
          rowVal[4] = cell(val(item.fat_pct, 4), { isNum: true });
          rowVal[5] = cell(val(item.snf_pct, 4), { isNum: true });
          rowVal[6] = cell(val(item.sp_gr, 4), { isNum: true });
          rowVal[7] = cell(val(item.kg_fat, 4), { isNum: true });
          rowVal[8] = cell(val(item.kg_snf, 4), { isNum: true });
        } else {
          for (let c = 0; c < 9; c++) rowVal[c] = cell('');
        }

        // Right side
        if (row.right.type === 'header') {
          // Label goes to column index 10 because the merge is from 10 to 17
          rowVal[9] = cell('');
          rowVal[10] = cell(row.right.label, { isBold: true });
          for (let c = 11; c < 18; c++) rowVal[c] = cell('');
          merges.push({ s: { r: rIndex, c: 10 }, e: { r: rIndex, c: 17 } });
        } else if (row.right.type === 'total') {
          // Merge is from 9 to 10, so the label MUST go into column index 9!
          rowVal[9] = cell(row.right.label, { isBold: true });
          rowVal[10] = cell('');
          rowVal[11] = cell(val(row.right.qty_lts), { isBold: true, isNum: true });
          rowVal[12] = cell(val(row.right.qty_kg), { isBold: true, isNum: true });
          rowVal[13] = cell('');
          rowVal[14] = cell('');
          rowVal[15] = cell('');
          rowVal[16] = cell(val(row.right.kg_fat, 4), { isBold: true, isNum: true });
          rowVal[17] = cell(val(row.right.kg_snf, 4), { isBold: true, isNum: true });
          merges.push({ s: { r: rIndex, c: 9 }, e: { r: rIndex, c: 10 } });
        } else if (row.right.type === 'item') {
          const item = row.right.data;
          rowVal[9] = cell(row.right.index);
          rowVal[10] = cell(item.product);
          rowVal[11] = cell(val(item.qty_lts), { isNum: true });
          rowVal[12] = cell(val(item.qty_kg), { isNum: true });
          rowVal[13] = cell(val(item.fat_pct, 4), { isNum: true });
          rowVal[14] = cell(val(item.snf_pct, 4), { isNum: true });
          rowVal[15] = cell(val(item.sp_gr, 4), { isNum: true });
          rowVal[16] = cell(val(item.kg_fat, 4), { isNum: true });
          rowVal[17] = cell(val(item.kg_snf, 4), { isNum: true });
        } else {
          for (let c = 9; c < 18; c++) rowVal[c] = cell('');
        }

        tsData.push(rowVal);
      });

      // Add Grand Totals
      // Merge is from 0 to 1, and 9 to 10. Labels go to index 0 and 9 respectively!
      const gtRowIdx = tsData.length;
      tsData.push([
        cell('G.TOTAL', { isBold: true }), cell(''), cell(val(totals.grand_total_arrival_lts), { isBold: true, isNum: true }), cell(val(totals.grand_total_arrival_kg), { isBold: true, isNum: true }), cell('-'), cell('-'), cell('-'), cell(val(totals.grand_total_arrival_kg_fat, 4), { isBold: true, isNum: true }), cell(val(totals.grand_total_arrival_kg_snf, 4), { isBold: true, isNum: true }),
        cell('G.TOTAL', { isBold: true }), cell(''), cell(val(totals.grand_total_disposal_lts), { isBold: true, isNum: true }), cell(val(totals.grand_total_disposal_kg), { isBold: true, isNum: true }), cell('-'), cell('-'), cell('-'), cell(val(totals.grand_total_disposal_kg_fat, 4), { isBold: true, isNum: true }), cell(val(totals.grand_total_disposal_kg_snf, 4), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: gtRowIdx, c: 0 }, e: { r: gtRowIdx, c: 1 } });
      merges.push({ s: { r: gtRowIdx, c: 9 }, e: { r: gtRowIdx, c: 10 } });

      // Add Loss/Gain
      // Merge is from 10 to 15. Label goes to index 10!
      const lgRowIdx = tsData.length;
      tsData.push([
        cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
        cell(''), cell('LOSS', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(Math.abs(totals.loss_kg_fat), 4), { isBold: true, isNum: true }), cell(val(Math.abs(totals.loss_kg_snf), 4), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: lgRowIdx, c: 10 }, e: { r: lgRowIdx, c: 15 } });

      // Add Loss %
      // Merge is from 10 to 15. Label goes to index 10!
      const lpRowIdx = tsData.length;
      tsData.push([
        cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
        cell(''), cell('LOSS%', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(totals.loss_pct_fat, 4), { isBold: true, isNum: true }), cell(val(totals.loss_pct_snf, 4), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: lpRowIdx, c: 10 }, e: { r: lpRowIdx, c: 15 } });

      // Add Norm
      // Merge is from 10 to 15. Label goes to index 10!
      const normRowIdx = tsData.length;
      tsData.push([
        cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
        cell(''), cell('CMPDD LOSS %', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(totals.cmpdd_norm_pct, 2), { isBold: true, isNum: true }), cell(val(totals.cmpdd_norm_pct, 2), { isBold: true, isNum: true })
      ]);
      merges.push({ s: { r: normRowIdx, c: 10 }, e: { r: normRowIdx, c: 15 } });

      const tsWs = XLSX.utils.aoa_to_sheet(tsData);
      tsWs['!cols'] = colWidths;
      tsWs['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, tsWs, 'TS');
    }

    // 4. Build STG Report Sheet (All blocks inside a single sheet named 'STG')
    if (includeStg && stgRowsData.length > 0) {
      let customStatements: Array<{ key: string; label: string }> = [];
      let customBlocks: Record<string, any> = {};

      if (entryNotes) {
        const notesParts = entryNotes.split('\n');
        notesParts.forEach(part => {
          if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
            const [, metaJson] = part.split('__METADATA__:');
            try {
              const meta = JSON.parse(metaJson);
              if (meta.custom_statements) customStatements = meta.custom_statements;
              if (meta.custom_blocks) customBlocks = meta.custom_blocks;
            } catch {}
          }
        });
      }

      const baseBlocks = [
        { key: 'WM', label: 'Whole Milk' },
        { key: 'SSM', label: 'Skim Milk' },
        { key: 'CREAM', label: 'Cream' },
        { key: 'SMP', label: 'SMP / Other' },
      ];
      const blockMap = new Map<string, { key: string; label: string }>();
      baseBlocks.forEach(b => blockMap.set(b.key, b));
      customStatements.forEach(s => { if (s && s.key) blockMap.set(s.key, s); });
      const allBlocks = Array.from(blockMap.values());

      // Master array for single STG sheet data
      const stgSheetData: any[][] = [
        [
          cell('NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS\' UNION LTD', { isBold: true, noBorder: true })
        ],
        [
          cell('SOLID BALANCE DETAILS (STG)', { isBold: true, noBorder: true }),
          ...new Array(16).fill(cell('', { noBorder: true })),
          cell(new Date(date).toLocaleDateString('en-IN'), { isBold: true, noBorder: true, alignment: 'right' })
        ]
      ];

      const stgMerges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }
      ];

      allBlocks.forEach((blockInfo, blockIndex) => {
        const block = blockInfo.key;
        let blockRows = stgRowsData.filter(r => r.product_block === block);

        if (customBlocks[block]) {
          const bState = customBlocks[block];
          const makeRow = (itemName: string, side: 'RECEIPT' | 'DISPOSAL', itemState: any): STGRow => ({
            id: '',
            entry_id: '',
            product_block: block,
            side,
            item_name: itemName,
            qty_lts: parseFloat(itemState.qty_lts) || 0,
            qty_kg: parseFloat(itemState.qty_kg) || 0,
            fat_pct: parseFloat(itemState.fat_pct) || 0,
            snf_pct: parseFloat(itemState.snf_pct) || 0,
            sp_gr: parseFloat(itemState.sp_gr) || 0,
            kg_fat: parseFloat(itemState.kg_fat) || 0,
            kg_snf: parseFloat(itemState.kg_snf) || 0,
            sort_order: 0,
          });

          blockRows = [
            makeRow('OB', 'RECEIPT', bState.opening_balance),
            ...bState.receipts.map((r: any) => makeRow(r.item_name, 'RECEIPT', r)),
            ...bState.disposals.map((d: any) => makeRow(d.item_name, 'DISPOSAL', d)),
            makeRow('CB', 'DISPOSAL', bState.physical_count),
          ];
        }

        if (blockRows.length === 0) return;

        const obRow = blockRows.find(r => r.item_name === 'OB');
        const cbRow = blockRows.find(r => r.item_name === 'CB');
        const receipts = blockRows.filter(r => r.side === 'RECEIPT' && r.item_name !== 'OB');
        const disposals = blockRows.filter(r => r.side === 'DISPOSAL' && r.item_name !== 'CB');

        const maxLen = Math.max(receipts.length, disposals.length);
        const alignedRows: { r?: STGRow; d?: STGRow }[] = [];
        for (let i = 0; i < maxLen; i++) {
          alignedRows.push({ r: receipts[i], d: disposals[i] });
        }

        const totRec = {
          lts: receipts.reduce((a, r) => a + r.qty_lts, 0),
          kg: receipts.reduce((a, r) => a + r.qty_kg, 0),
          fat: receipts.reduce((a, r) => a + r.kg_fat, 0),
          snf: receipts.reduce((a, r) => a + r.kg_snf, 0),
        };
        const totDisp = {
          lts: disposals.reduce((a, r) => a + r.qty_lts, 0),
          kg: disposals.reduce((a, r) => a + r.qty_kg, 0),
          fat: disposals.reduce((a, r) => a + r.kg_fat, 0),
          snf: disposals.reduce((a, r) => a + r.kg_snf, 0),
        };

        const obVal = {
          lts: obRow ? obRow.qty_lts : 0,
          kg: obRow ? obRow.qty_kg : 0,
          fat_pct: obRow ? obRow.fat_pct : 0,
          snf_pct: obRow ? obRow.snf_pct : 0,
          sp_gr: obRow ? obRow.sp_gr : 0,
          fat: obRow ? obRow.kg_fat : 0,
          snf: obRow ? obRow.kg_snf : 0,
        };

        const physicalCB = {
          lts: cbRow ? cbRow.qty_lts : 0,
          kg: cbRow ? cbRow.qty_kg : 0,
          fat_pct: cbRow ? cbRow.fat_pct : 0,
          snf_pct: cbRow ? cbRow.snf_pct : 0,
          sp_gr: cbRow ? cbRow.sp_gr : 0,
          fat: cbRow ? cbRow.kg_fat : 0,
          snf: cbRow ? cbRow.kg_snf : 0,
        };

        const grandRec = {
          lts: obVal.lts + totRec.lts,
          kg: obVal.kg + totRec.kg,
          fat: obVal.fat + totRec.fat,
          snf: obVal.snf + totRec.snf,
        };

        const cbCalculated = {
          lts: grandRec.lts - totDisp.lts,
          kg: grandRec.kg - totDisp.kg,
          fat: grandRec.fat - totDisp.fat,
          snf: grandRec.snf - totDisp.snf,
        };

        const grandDisp = {
          lts: totDisp.lts + physicalCB.lts,
          kg: totDisp.kg + physicalCB.kg,
          fat: totDisp.fat + physicalCB.fat,
          snf: totDisp.snf + physicalCB.snf,
        };

        const lossGain = {
          lts: physicalCB.lts - cbCalculated.lts,
          kg: physicalCB.kg - cbCalculated.kg,
          fat: physicalCB.fat - cbCalculated.fat,
          snf: physicalCB.snf - cbCalculated.snf,
        };

        const lossGainPct = {
          lts: cbCalculated.lts !== 0 ? (lossGain.lts / cbCalculated.lts) * 100 : 0,
          kg: cbCalculated.kg !== 0 ? (lossGain.kg / cbCalculated.kg) * 100 : 0,
          fat: cbCalculated.fat !== 0 ? (lossGain.fat / cbCalculated.fat) * 100 : 0,
          snf: cbCalculated.snf !== 0 ? (lossGain.snf / cbCalculated.snf) * 100 : 0,
        };

        // Add spacer empty row if not first block
        if (blockIndex > 0) {
          stgSheetData.push(new Array(18).fill(cell('', { noBorder: true })));
        }

        // Add Block Header
        const startRowIdx = stgSheetData.length;
        const blockLabel = BLOCK_LABELS[block] || `${blockInfo.label.toUpperCase()} – RECEIPT AND DISPOSAL STATEMENT`;
        stgSheetData.push([
          cell(blockLabel, { isBold: true, noBorder: true }),
          ...new Array(17).fill(cell('', { noBorder: true }))
        ]);
        stgMerges.push({ s: { r: startRowIdx, c: 0 }, e: { r: startRowIdx, c: 17 } });

        // Add Headers row
        stgSheetData.push([
          cell('S.No.', { isHeader: true }), cell('Receipt', { isHeader: true }), cell('Qty (Lts)', { isHeader: true }), cell('Qty (Kg)', { isHeader: true }), cell('Fat%', { isHeader: true }), cell('Snf%', { isHeader: true }), cell('SP.G', { isHeader: true }), cell('Kg.Fat', { isHeader: true }), cell('Kg.SNF', { isHeader: true }),
          cell('S.No.', { isHeader: true }), cell('Disposal', { isHeader: true }), cell('Qty (Lts)', { isHeader: true }), cell('Qty (Kg)', { isHeader: true }), cell('Fat%', { isHeader: true }), cell('Snf%', { isHeader: true }), cell('SP.G', { isHeader: true }), cell('Kg.Fat', { isHeader: true }), cell('Kg.SNF', { isHeader: true })
        ]);

        // Add aligned rows
        alignedRows.forEach((row, i) => {
          const rowVal: any[] = new Array(18).fill('');

          // Left: Receipt
          if (row.r) {
            rowVal[0] = cell(i + 1);
            rowVal[1] = cell(row.r.item_name);
            rowVal[2] = cell(val(row.r.qty_lts), { isNum: true });
            rowVal[3] = cell(val(row.r.qty_kg), { isNum: true });
            rowVal[4] = cell(val(row.r.fat_pct, 4), { isNum: true });
            rowVal[5] = cell(val(row.r.snf_pct, 4), { isNum: true });
            rowVal[6] = cell(val(row.r.sp_gr, 4), { isNum: true });
            rowVal[7] = cell(val(row.r.kg_fat, 4), { isNum: true });
            rowVal[8] = cell(val(row.r.kg_snf, 4), { isNum: true });
          } else {
            for (let c = 0; c < 9; c++) rowVal[c] = cell('');
          }

          // Right: Disposal
          if (row.d) {
            rowVal[9] = cell(i + 1);
            rowVal[10] = cell(row.d.item_name);
            rowVal[11] = cell(val(row.d.qty_lts), { isNum: true });
            rowVal[12] = cell(val(row.d.qty_kg), { isNum: true });
            rowVal[13] = cell(val(row.d.fat_pct, 4), { isNum: true });
            rowVal[14] = cell(val(row.d.snf_pct, 4), { isNum: true });
            rowVal[15] = cell(val(row.d.sp_gr, 4), { isNum: true });
            rowVal[16] = cell(val(row.d.kg_fat, 4), { isNum: true });
            rowVal[17] = cell(val(row.d.kg_snf, 4), { isNum: true });
          } else {
            for (let c = 9; c < 18; c++) rowVal[c] = cell('');
          }

          stgSheetData.push(rowVal);
        });

        // Add Staggered totals
        // Row D1: Disposal Total row (on the right)
        // Merge is J to K (9 to 10), so label goes into index 9, index 10 is empty!
        const d1Idx = stgSheetData.length;
        stgSheetData.push([
          cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), // Left empty
          cell('Total', { isBold: true }), cell(''), cell(val(totDisp.lts), { isBold: true, isNum: true }), cell(val(totDisp.kg), { isBold: true, isNum: true }), cell(''), cell(''), cell(''), cell(val(totDisp.fat, 4), { isBold: true, isNum: true }), cell(val(totDisp.snf, 4), { isBold: true, isNum: true })
        ]);
        stgMerges.push({ s: { r: d1Idx, c: 9 }, e: { r: d1Idx, c: 10 } });

        // Row D2: CB row (on the right)
        // Merge is J to K (9 to 10), so label goes into index 9, index 10 is empty!
        const d2Idx = stgSheetData.length;
        stgSheetData.push([
          cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), // Left empty
          cell('CB', { isBold: true }), cell(''), cell(val(physicalCB.lts), { isBold: true, isNum: true }), cell(val(physicalCB.kg), { isBold: true, isNum: true }), cell(val(physicalCB.fat_pct, 4), { isBold: true, isNum: true }), cell(val(physicalCB.snf_pct, 4), { isBold: true, isNum: true }), cell(val(physicalCB.sp_gr, 4), { isBold: true, isNum: true }), cell(val(physicalCB.fat, 4), { isBold: true, isNum: true }), cell(val(physicalCB.snf, 4), { isBold: true, isNum: true })
        ]);
        stgMerges.push({ s: { r: d2Idx, c: 9 }, e: { r: d2Idx, c: 10 } });

        // Row D3: Grand Total row (on the right)
        // Merge is J to K (9 to 10), so label goes into index 9, index 10 is empty!
        const d3Idx = stgSheetData.length;
        stgSheetData.push([
          cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), // Left empty
          cell('Grand Total', { isBold: true }), cell(''), cell(val(grandDisp.lts), { isBold: true, isNum: true }), cell(val(grandDisp.kg), { isBold: true, isNum: true }), cell(''), cell(''), cell(''), cell(val(grandDisp.fat, 4), { isBold: true, isNum: true }), cell(val(grandDisp.snf, 4), { isBold: true, isNum: true })
        ]);
        stgMerges.push({ s: { r: d3Idx, c: 9 }, e: { r: d3Idx, c: 10 } });

        // Row R1: Receipt Total (left) / Loss/Gain (right)
        // Left merge 0 to 1, label goes to index 0, index 1 is empty!
        // Right merge 9 to 10, label goes to index 9, index 10 is empty!
        const r1Idx = stgSheetData.length;
        stgSheetData.push([
          cell('Total', { isBold: true }), cell(''), cell(val(totRec.lts), { isBold: true, isNum: true }), cell(val(totRec.kg), { isBold: true, isNum: true }), cell(''), cell(''), cell(''), cell(val(totRec.fat, 4), { isBold: true, isNum: true }), cell(val(totRec.snf, 4), { isBold: true, isNum: true }),
          cell('Loss/Gain', { isBold: true }), cell(''), cell(val(lossGain.lts), { isBold: true, isNum: true }), cell(val(lossGain.kg), { isBold: true, isNum: true }), cell(''), cell(''), cell(''), cell(val(lossGain.fat, 4), { isBold: true, isNum: true }), cell(val(lossGain.snf, 4), { isBold: true, isNum: true })
        ]);
        stgMerges.push({ s: { r: r1Idx, c: 0 }, e: { r: r1Idx, c: 1 } });
        stgMerges.push({ s: { r: r1Idx, c: 9 }, e: { r: r1Idx, c: 10 } });

        // Row R2: OB (left) / Loss/Gain % (right)
        // Left merge 0 to 1, label goes to index 0, index 1 is empty!
        // Right merge 9 to 10, label goes to index 9, index 10 is empty!
        const r2Idx = stgSheetData.length;
        stgSheetData.push([
          cell('OB', { isBold: true }), cell(''), cell(val(obVal.lts), { isBold: true, isNum: true }), cell(val(obVal.kg), { isBold: true, isNum: true }), cell(val(obVal.fat_pct, 4), { isBold: true, isNum: true }), cell(val(obVal.snf_pct, 4), { isBold: true, isNum: true }), cell(val(obVal.sp_gr, 4), { isBold: true, isNum: true }), cell(val(obVal.fat, 4), { isBold: true, isNum: true }), cell(val(obVal.snf, 4), { isBold: true, isNum: true }),
          cell('Loss/Gain %', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell(`${val(lossGainPct.fat)}%`, { isBold: true, alignment: 'right' }), cell(`${val(lossGainPct.snf)}%`, { isBold: true, alignment: 'right' })
        ]);
        stgMerges.push({ s: { r: r2Idx, c: 0 }, e: { r: r2Idx, c: 1 } });
        stgMerges.push({ s: { r: r2Idx, c: 9 }, e: { r: r2Idx, c: 10 } });

        // Row R3: Grand Total (left) / CMPDD Norms (right)
        // Left merge 0 to 1, label goes to index 0, index 1 is empty!
        // Right merge 9 to 10, label goes to index 9, index 10 is empty!
        const r3Idx = stgSheetData.length;
        stgSheetData.push([
          cell('Grand Total', { isBold: true }), cell(''), cell(val(grandRec.lts), { isBold: true, isNum: true }), cell(val(grandRec.kg), { isBold: true, isNum: true }), cell(''), cell(''), cell(''), cell(val(grandRec.fat, 4), { isBold: true, isNum: true }), cell(val(grandRec.snf, 4), { isBold: true, isNum: true }),
          cell('CMPDD Norms %', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell('0.5%', { isBold: true, alignment: 'right' }), cell('0.5%', { isBold: true, alignment: 'right' })
        ]);
        stgMerges.push({ s: { r: r3Idx, c: 0 }, e: { r: r3Idx, c: 1 } });
        stgMerges.push({ s: { r: r3Idx, c: 9 }, e: { r: r3Idx, c: 10 } });
      });

      const stgWs = XLSX.utils.aoa_to_sheet(stgSheetData);
      stgWs['!cols'] = colWidths;
      stgWs['!merges'] = stgMerges;
      XLSX.utils.book_append_sheet(wb, stgWs, 'STG');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const [y, m, d] = date.split('-');
    const formattedDate = `${d}-${m}-${y}`;
    const shiftStr = shift ? `-${shift}` : '';
    const fileName = `${formattedDate}${shiftStr}-TS.xlsx`;

    // 6. Return response for client download
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const BLOCK_LABELS: Record<string, string> = {
  WM: 'TENTATIVE WHOLE MILK – RECEIPT AND DISPOSAL STATEMENT',
  SSM: 'SKIMMED MILK – RECEIPT AND DISPOSAL STATEMENT',
  CREAM: 'CREAM – RECEIPT AND DISPOSAL STATEMENT',
  SMP: 'SMP / OTHER – RECEIPT AND DISPOSAL STATEMENT',
};
