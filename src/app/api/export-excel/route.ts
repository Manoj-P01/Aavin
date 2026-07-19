import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, initDb } from '@/lib/fileDb';
import { generateDynamicBalanceRows, calcTSTotals, fmtNum } from '@/lib/calculations';
import type { Shift, TSMilkRow, STGRow } from '@/lib/types';

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
      if (v === null || v === undefined || isNaN(v)) return '';
      return Number(v.toFixed(decimals));
    };

    // 3. Build TS Report Sheet
    if (includeTs && tsRowsData.length > 0) {
      // Get global statements config
      let gStmts: any[] = [];
      if (isLocalDbEnabled()) {
        const db = await initDb();
        const configEntry = db.entries.find((e: any) => e.entry_date === '1970-01-01' && e.report_type === 'TS');
        if (configEntry && configEntry.notes) {
          try { gStmts = JSON.parse(configEntry.notes) || []; } catch {}
        }
      } else {
        const supabase = getSupabaseServiceClient();
        const { data } = await supabase.from('entries').select('notes').eq('entry_date', '1970-01-01').eq('report_type', 'TS');
        if (data && data.length > 0 && data[0].notes) {
          try { gStmts = JSON.parse(data[0].notes) || []; } catch {}
        }
      }

      const { obRows, cbRows } = generateDynamicBalanceRows(stgRowsData, entryNotes, gStmts);
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
        leftList.push({ type: 'header', label: 'O/B (Opening Balance)' });
        rowsBySection.OB.forEach((r, i) => leftList.push({ type: 'item', index: i + 1, data: r }));
        leftList.push({ type: 'total', label: 'O/B Total', ...getSectionTotal(rowsBySection.OB) });
      }
      if (rowsBySection.RECEIPT.length > 0) {
        leftList.push({ type: 'header', label: 'Receipts' });
        rowsBySection.RECEIPT.forEach((r, i) => leftList.push({ type: 'item', index: i + 1, data: r }));
        leftList.push({ type: 'total', label: 'Receipts Total', ...getSectionTotal(rowsBySection.RECEIPT) });
      }

      // Pop right
      if (rowsBySection.DISPOSAL_DESPATCH.length > 0) {
        rightList.push({ type: 'header', label: 'Disposal - Despatch / Sale' });
        rowsBySection.DISPOSAL_DESPATCH.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'Despatch Total', ...getSectionTotal(rowsBySection.DISPOSAL_DESPATCH) });
      }
      if (rowsBySection.LOCAL_SALE.length > 0) {
        rightList.push({ type: 'header', label: 'Local Sales' });
        rowsBySection.LOCAL_SALE.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'Local Sales Total', ...getSectionTotal(rowsBySection.LOCAL_SALE) });
      }
      if (rowsBySection.OTHER_DISPOSAL.length > 0) {
        rightList.push({ type: 'header', label: 'Other Disposal' });
        rowsBySection.OTHER_DISPOSAL.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'Other Disposal Total', ...getSectionTotal(rowsBySection.OTHER_DISPOSAL) });
      }
      if (rowsBySection.CB.length > 0) {
        rightList.push({ type: 'header', label: 'C/B (Closing Balance)' });
        rowsBySection.CB.forEach((r, i) => rightList.push({ type: 'item', index: i + 1, data: r }));
        rightList.push({ type: 'total', label: 'C/B Total', ...getSectionTotal(rowsBySection.CB) });
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
        ['NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS\' UNION LTD'],
        ['TOTAL SOLIDS DETAILS'],
        [`DATE: ${new Date(date).toLocaleDateString('en-IN')} | SHIFT: ${shiftText}`],
        [],
        ['ARRIVAL', '', '', '', '', '', '', '', '', 'DISPOSAL'],
        [
          'S.No', 'Arrival', 'Milk (Lit)', 'Milk (Kg)', 'Avg Fat %', 'Avg SNF %', 'Sp. Gr', 'Kg Fat', 'Kg SNF',
          'S.No', 'Disposal', 'Milk (Lit)', 'Milk (Kg)', 'Avg Fat %', 'Avg SNF %', 'Sp. Gr', 'Kg Fat', 'Kg SNF'
        ]
      ];

      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 17 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } },
        { s: { r: 4, c: 9 }, e: { r: 4, c: 17 } },
      ];

      alignedRows.forEach((row, i) => {
        const rIndex = 6 + i;
        const rowVal: any[] = new Array(18).fill('');

        // Left side
        if (row.left.type === 'header') {
          rowVal[0] = row.left.label;
          merges.push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 8 } });
        } else if (row.left.type === 'total') {
          rowVal[1] = row.left.label;
          rowVal[2] = val(row.left.qty_lts);
          rowVal[3] = val(row.left.qty_kg);
          rowVal[4] = '-';
          rowVal[5] = '-';
          rowVal[6] = '-';
          rowVal[7] = val(row.left.kg_fat, 4);
          rowVal[8] = val(row.left.kg_snf, 4);
          merges.push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 1 } });
        } else if (row.left.type === 'item') {
          const item = row.left.data;
          rowVal[0] = row.left.index;
          rowVal[1] = item.product;
          rowVal[2] = val(item.qty_lts);
          rowVal[3] = val(item.qty_kg);
          rowVal[4] = val(item.fat_pct, 4);
          rowVal[5] = val(item.snf_pct, 4);
          rowVal[6] = val(item.sp_gr, 4);
          rowVal[7] = val(item.kg_fat, 4);
          rowVal[8] = val(item.kg_snf, 4);
        }

        // Right side
        if (row.right.type === 'header') {
          rowVal[9] = row.right.label;
          merges.push({ s: { r: rIndex, c: 9 }, e: { r: rIndex, c: 17 } });
        } else if (row.right.type === 'total') {
          rowVal[10] = row.right.label;
          rowVal[11] = val(row.right.qty_lts);
          rowVal[12] = val(row.right.qty_kg);
          rowVal[13] = '-';
          rowVal[14] = '-';
          rowVal[15] = '-';
          rowVal[16] = val(row.right.kg_fat, 4);
          rowVal[17] = val(row.right.kg_snf, 4);
          merges.push({ s: { r: rIndex, c: 9 }, e: { r: rIndex, c: 10 } });
        } else if (row.right.type === 'item') {
          const item = row.right.data;
          rowVal[9] = row.right.index;
          rowVal[10] = item.product;
          rowVal[11] = val(item.qty_lts);
          rowVal[12] = val(item.qty_kg);
          rowVal[13] = val(item.fat_pct, 4);
          rowVal[14] = val(item.snf_pct, 4);
          rowVal[15] = val(item.sp_gr, 4);
          rowVal[16] = val(item.kg_fat, 4);
          rowVal[17] = val(item.kg_snf, 4);
        }

        tsData.push(rowVal);
      });

      // Add Grand Totals
      const gtRowIdx = tsData.length;
      tsData.push([
        '', 'G. TOTAL (Arrival)', val(totals.grand_total_arrival_lts), val(totals.grand_total_arrival_kg), '-', '-', '-', val(totals.grand_total_arrival_kg_fat, 4), val(totals.grand_total_arrival_kg_snf, 4),
        '', 'G. TOTAL (Disposal)', val(totals.grand_total_disposal_lts), val(totals.grand_total_disposal_kg), '-', '-', '-', val(totals.grand_total_disposal_kg_fat, 4), val(totals.grand_total_disposal_kg_snf, 4)
      ]);
      merges.push({ s: { r: gtRowIdx, c: 0 }, e: { r: gtRowIdx, c: 1 } });
      merges.push({ s: { r: gtRowIdx, c: 9 }, e: { r: gtRowIdx, c: 10 } });

      // Add Loss/Gain
      const lgRowIdx = tsData.length;
      tsData.push([
        '', '', '', '', '', '', '', '', '',
        '', totals.loss_kg_fat >= 0 ? 'LOSS' : 'GAIN', '-', '-', '-', '-', '-', val(Math.abs(totals.loss_kg_fat), 4), val(Math.abs(totals.loss_kg_snf), 4)
      ]);
      merges.push({ s: { r: lgRowIdx, c: 0 }, e: { r: lgRowIdx, c: 8 } });
      merges.push({ s: { r: lgRowIdx, c: 9 }, e: { r: lgRowIdx, c: 10 } });

      // Add Loss %
      const lpRowIdx = tsData.length;
      tsData.push([
        '', '', '', '', '', '', '', '', '',
        '', 'LOSS %', '', '', '', '', '', val(totals.loss_pct_fat, 4), val(totals.loss_pct_snf, 4)
      ]);
      merges.push({ s: { r: lpRowIdx, c: 0 }, e: { r: lpRowIdx, c: 8 } });
      merges.push({ s: { r: lpRowIdx, c: 10 }, e: { r: lpRowIdx, c: 15 } });

      // Add Norm
      const normRowIdx = tsData.length;
      tsData.push([
        '', '', '', '', '', '', '', '', '',
        '', 'CMPDD NORM (0.5%)', '', '', '', '', '', val(totals.cmpdd_norm_pct, 2), val(totals.cmpdd_norm_pct, 2)
      ]);
      merges.push({ s: { r: normRowIdx, c: 0 }, e: { r: normRowIdx, c: 8 } });
      merges.push({ s: { r: normRowIdx, c: 10 }, e: { r: normRowIdx, c: 15 } });

      const tsWs = XLSX.utils.aoa_to_sheet(tsData);
      tsWs['!cols'] = colWidths;
      tsWs['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, tsWs, 'TS Report');
    }

    // 4. Build STG Report Sheets (each block in a separate sheet)
    if (includeStg && stgRowsData.length > 0) {
      // Parse custom statements and custom blocks
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

      allBlocks.forEach(blockInfo => {
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

        // Build STG Data Block
        const blockLabel = BLOCK_LABELS[block] || `${blockInfo.label.toUpperCase()} – RECEIPT AND DISPOSAL STATEMENT`;

        const stgData: any[][] = [
          ['NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS\' UNION LTD'],
          ['SOLID BALANCE DETAILS (STG)'],
          [`DATE: ${new Date(date).toLocaleDateString('en-IN')} | SHIFT: ${shiftText}`],
          [blockLabel],
          [],
          ['RECEIPTS', '', '', '', '', '', '', '', '', 'DISPOSALS'],
          [
            'S.No', 'Receipt', 'Qty (Lts)', 'Qty (Kg)', 'Fat %', 'SNF %', 'Sp. Gr', 'Kg.Fat', 'Kg.SNF',
            'S.No', 'Disposal', 'Qty (Lts)', 'Qty (Kg)', 'Fat %', 'SNF %', 'Sp. Gr', 'Kg.Fat', 'Kg.SNF'
          ]
        ];

        const stgMerges: XLSX.Range[] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: 17 } },
          { s: { r: 3, c: 0 }, e: { r: 3, c: 17 } },
          { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } },
          { s: { r: 5, c: 9 }, e: { r: 5, c: 17 } },
        ];

        alignedRows.forEach((row, i) => {
          const rIndex = 7 + i;
          const rowVal: any[] = new Array(18).fill('');

          // Left: Receipt
          if (row.r) {
            rowVal[0] = i + 1;
            rowVal[1] = row.r.item_name;
            rowVal[2] = val(row.r.qty_lts);
            rowVal[3] = val(row.r.qty_kg);
            rowVal[4] = val(row.r.fat_pct, 4);
            rowVal[5] = val(row.r.snf_pct, 4);
            rowVal[6] = val(row.r.sp_gr, 4);
            rowVal[7] = val(row.r.kg_fat, 4);
            rowVal[8] = val(row.r.kg_snf, 4);
          }

          // Right: Disposal
          if (row.d) {
            rowVal[9] = i + 1;
            rowVal[10] = row.d.item_name;
            rowVal[11] = val(row.d.qty_lts);
            rowVal[12] = val(row.d.qty_kg);
            rowVal[13] = val(row.d.fat_pct, 4);
            rowVal[14] = val(row.d.snf_pct, 4);
            rowVal[15] = val(row.d.sp_gr, 4);
            rowVal[16] = val(row.d.kg_fat, 4);
            rowVal[17] = val(row.d.kg_snf, 4);
          }

          stgData.push(rowVal);
        });

        // Add subtotal
        const subRowIdx = stgData.length;
        stgData.push([
          '', 'Total', val(totRec.lts), val(totRec.kg), '', '', '', val(totRec.fat, 4), val(totRec.snf, 4),
          '', 'Total', val(totDisp.lts), val(totDisp.kg), '', '', '', val(totDisp.fat, 4), val(totDisp.snf, 4)
        ]);
        stgMerges.push({ s: { r: subRowIdx, c: 0 }, e: { r: subRowIdx, c: 1 } });
        stgMerges.push({ s: { r: subRowIdx, c: 9 }, e: { r: subRowIdx, c: 10 } });

        // Add OB / CB
        const obcbRowIdx = stgData.length;
        stgData.push([
          '', 'Opening Balance (OB)', val(obVal.lts), val(obVal.kg), val(obVal.fat_pct, 4), val(obVal.snf_pct, 4), val(obVal.sp_gr, 4), val(obVal.fat, 4), val(obVal.snf, 4),
          '', 'Closing Balance (CB)', val(physicalCB.lts), val(physicalCB.kg), '', '', '', val(physicalCB.fat, 4), val(physicalCB.snf, 4)
        ]);
        stgMerges.push({ s: { r: obcbRowIdx, c: 0 }, e: { r: obcbRowIdx, c: 1 } });
        stgMerges.push({ s: { r: obcbRowIdx, c: 9 }, e: { r: obcbRowIdx, c: 10 } });

        // Add Grand Total
        const gRowIdx = stgData.length;
        stgData.push([
          '', 'Grand Total', val(grandRec.lts), val(grandRec.kg), '', '', '', val(grandRec.fat, 4), val(grandRec.snf, 4),
          '', 'Grand Total', val(grandDisp.lts), val(grandDisp.kg), '', '', '', val(grandDisp.fat, 4), val(grandDisp.snf, 4)
        ]);
        stgMerges.push({ s: { r: gRowIdx, c: 0 }, e: { r: gRowIdx, c: 1 } });
        stgMerges.push({ s: { r: gRowIdx, c: 9 }, e: { r: gRowIdx, c: 10 } });

        // Add Physical Count
        const pRowIdx = stgData.length;
        stgData.push([
          '', '', '', '', '', '', '', '', '',
          '', 'Physical Count (CB)', val(physicalCB.lts), val(physicalCB.kg), val(physicalCB.fat_pct, 4), val(physicalCB.snf_pct, 4), val(physicalCB.sp_gr, 4), val(physicalCB.fat, 4), val(physicalCB.snf, 4)
        ]);
        stgMerges.push({ s: { r: pRowIdx, c: 0 }, e: { r: pRowIdx, c: 8 } });
        stgMerges.push({ s: { r: pRowIdx, c: 9 }, e: { r: pRowIdx, c: 10 } });

        // Add Loss/Gain
        const lossRowIdx = stgData.length;
        stgData.push([
          '', '', '', '', '', '', '', '', '',
          '', 'Loss / Gain', val(lossGain.lts), val(lossGain.kg), '', '', '', val(lossGain.fat, 4), val(lossGain.snf, 4)
        ]);
        stgMerges.push({ s: { r: lossRowIdx, c: 0 }, e: { r: lossRowIdx, c: 8 } });
        stgMerges.push({ s: { r: lossRowIdx, c: 9 }, e: { r: lossRowIdx, c: 10 } });

        // Add Loss/Gain %
        const lossPctRowIdx = stgData.length;
        stgData.push([
          '', '', '', '', '', '', '', '', '',
          '', 'Loss / Gain %', `${val(lossGainPct.lts)}%`, `${val(lossGainPct.kg)}%`, '', '', '', `${val(lossGainPct.fat)}%`, `${val(lossGainPct.snf)}%`
        ]);
        stgMerges.push({ s: { r: lossPctRowIdx, c: 0 }, e: { r: lossPctRowIdx, c: 8 } });
        stgMerges.push({ s: { r: lossPctRowIdx, c: 9 }, e: { r: lossPctRowIdx, c: 10 } });

        const stgWs = XLSX.utils.aoa_to_sheet(stgData);
        stgWs['!cols'] = colWidths;
        stgWs['!merges'] = stgMerges;
        XLSX.utils.book_append_sheet(wb, stgWs, `STG - ${block}`);
      });
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // 5. Save locally in "d:\Manoj_Personal\Aavin\excel"
    const targetDir = 'd:\\Manoj_Personal\\Aavin\\excel';
    const [y, m, d] = date.split('-');
    const formattedDate = `${d}-${m}-${y}`;
    const shiftStr = shift ? `-${shift}` : '';
    const fileName = `${formattedDate}${shiftStr}-TS.xlsx`;

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const localPath = path.join(targetDir, fileName);
      fs.writeFileSync(localPath, excelBuffer);
    } catch (fsErr) {
      console.error('Failed to save Excel file locally:', fsErr);
    }

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
