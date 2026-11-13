// ─────────────────────────────────────────────────────────────
// src/lib/export/excelSTG.ts
// Excel builder for Solid Balance Details (STG) Statements
// ─────────────────────────────────────────────────────────────

import XLSX from 'xlsx-js-style';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { CALC_CONFIG } from '@/lib/config';
import type { STGRow } from '@/lib/types';
import { cell, val } from './excelStyles';

export async function buildSTGStatementSheet(
  stgRowsData: STGRow[],
  date: string,
  entryNotes: string | undefined,
  wb: XLSX.WorkBook
) {
  const stgCell = (value: any, opts?: Parameters<typeof cell>[1]) => cell(value, { ...opts, noColor: true });

  const colWidths = [
    { wch: 6 },   // S.no
    { wch: 18 },  // Particulars / Product
    { wch: 12 },  // Milk (Lit)
    { wch: 12 },  // Milk (Kg)
    { wch: 11 },  // Avg Fat %
    { wch: 11 },  // Avg SNF %
    { wch: 10 },  // Sp. Gr
    { wch: 13 },  // Kg Fat
    { wch: 13 },  // Kg SNF
    { wch: 6 },   // S.no
    { wch: 18 },  // Particulars / Product
    { wch: 12 },  // Milk (Lit)
    { wch: 12 },  // Milk (Kg)
    { wch: 11 },  // Avg Fat %
    { wch: 11 },  // Avg SNF %
    { wch: 10 },  // Sp. Gr
    { wch: 13 },  // Kg Fat
    { wch: 13 }   // Kg SNF
  ];

  let customStatements: Array<{ key: string; label: string }> = [];
  let customBlocks: Record<string, any> = {};
  let cmpddNorms: Record<string, string> = {};

  if (entryNotes) {
    const notesParts = entryNotes.split('\n');
    notesParts.forEach(part => {
      if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
        const [, metaJson] = part.split('__METADATA__:');
        try {
          const meta = JSON.parse(metaJson);
          if (meta.custom_statements) customStatements = meta.custom_statements;
          if (meta.custom_blocks) customBlocks = meta.custom_blocks;
          if (meta.cmpdd_norms) cmpddNorms = meta.cmpdd_norms;
        } catch {}
      }
    });
  }

  // Fetch statement masters dynamically from database if not embedded in notes
  if (customStatements.length === 0) {
    try {
      const supabase = getSupabaseServiceClient();
      const { data: stgTableRows, error: stgTableErr } = await supabase
        .from('stg_masters')
        .select('key, label, variant')
        .order('sort_order', { ascending: true });

      if (!stgTableErr && Array.isArray(stgTableRows) && stgTableRows.length > 0) {
        customStatements = stgTableRows.map((m: any) => ({
          key: m.key,
          label: m.label || m.variant || m.key,
        }));
      }
    } catch (e) {}
  }

  const blockMap = new Map<string, { key: string; label: string }>();
  if (customStatements && customStatements.length > 0) {
    customStatements.forEach(s => { if (s && s.key) blockMap.set(s.key, s); });
  }
  stgRowsData.forEach((r: any) => {
    if (r.product_block && !blockMap.has(r.product_block)) {
      const cleanKey = r.product_block.toUpperCase();
      blockMap.set(r.product_block, { key: r.product_block, label: `${cleanKey} – RECEIPT AND DISPOSAL STATEMENT` });
    }
  });
  const allBlocks = Array.from(blockMap.values());

  if (allBlocks.length === 0 && stgRowsData.length === 0) return;

  const orgHeader = (process.env.NEXT_PUBLIC_ORG_NAME || "NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS' UNION LTD., NAMAKKAL").toUpperCase();

  const stgSheetData: any[][] = [
    [
      stgCell(orgHeader, { isBold: true, noBorder: true })
    ],
    [
      stgCell('NAMAKKAL UNION- SOLID BALANCE DETAILS', { isBold: true, noBorder: true }),
      ...new Array(16).fill(stgCell('', { noBorder: true })),
      stgCell('DATE', { isBold: true, noBorder: true, alignment: 'right' })
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
      const makeRowFromState = (itemName: string, side: 'RECEIPT' | 'DISPOSAL', itemState: any): STGRow => ({
        id: '',
        entry_id: '',
        product_block: block,
        side,
        item_name: itemName,
        qty_lts: parseFloat(itemState?.qty_lts) || 0,
        qty_kg: parseFloat(itemState?.qty_kg) || 0,
        fat_pct: parseFloat(itemState?.fat_pct) || 0,
        snf_pct: parseFloat(itemState?.snf_pct) || 0,
        sp_gr: parseFloat(itemState?.sp_gr) || 0,
        kg_fat: parseFloat(itemState?.kg_fat) || 0,
        kg_snf: parseFloat(itemState?.kg_snf) || 0,
        sort_order: 0,
      });

      const constructedRows: STGRow[] = [];
      if (bState.opening_balance) {
        constructedRows.push(makeRowFromState('OB', 'RECEIPT', bState.opening_balance));
      }

      if (Array.isArray(bState.rows) && bState.rows.length > 0) {
        bState.rows.forEach((r: any) => {
          const varName = r.variant || r.values?.variant || '';
          const side = (r.side || r.row_type || 'RECEIPT') as 'RECEIPT' | 'DISPOSAL';
          constructedRows.push(makeRowFromState(varName, side, r.values || r));
        });
      } else {
        if (Array.isArray(bState.receipts)) {
          bState.receipts.forEach((r: any) => constructedRows.push(makeRowFromState(r.item_name || r.variant, 'RECEIPT', r)));
        }
        if (Array.isArray(bState.disposals)) {
          bState.disposals.forEach((d: any) => constructedRows.push(makeRowFromState(d.item_name || d.variant, 'DISPOSAL', d)));
        }
      }

      if (bState.physical_count) {
        constructedRows.push(makeRowFromState('CB', 'DISPOSAL', bState.physical_count));
      }

      if (constructedRows.length > 0) {
        blockRows = constructedRows;
      }
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

    if (blockIndex > 0) {
      stgSheetData.push(new Array(18).fill(stgCell('', { noBorder: true })));
    }

    const startRowIdx = stgSheetData.length;
    const rawLabel = (blockInfo.label || (customStatements.find(s => s.key === block)?.label) || '').trim();
    let blockLabel = rawLabel ? (rawLabel.toUpperCase().includes('STATEMENT') ? rawLabel.toUpperCase() : `${rawLabel.toUpperCase()} - RECEIPT AND DISPOSAL STATEMENT`) : `${block.toUpperCase()} - RECEIPT AND DISPOSAL STATEMENT`;
    stgSheetData.push([
      stgCell(blockLabel, { isBold: true, noBorder: true }),
      ...new Array(16).fill(stgCell('', { noBorder: true })),
      stgCell(new Date(date).toLocaleDateString('en-IN'), { isBold: true, noBorder: true, alignment: 'right' })
    ]);
    stgMerges.push({ s: { r: startRowIdx, c: 0 }, e: { r: startRowIdx, c: 16 } });

    // Headers row
    stgSheetData.push([
      stgCell('S.No.', { isHeader: true }), stgCell('Receipt', { isHeader: true }), stgCell('Qty (Lts)', { isHeader: true }), stgCell('Qty (Kg)', { isHeader: true }), stgCell('Fat%', { isHeader: true }), stgCell('Snf%', { isHeader: true }), stgCell('SP.G', { isHeader: true }), stgCell('Kg.Fat', { isHeader: true }), stgCell('Kg.Snf', { isHeader: true }),
      stgCell('S.No.', { isHeader: true }), stgCell('Disposal', { isHeader: true }), stgCell('Qty (Lts)', { isHeader: true }), stgCell('Qty (Kg)', { isHeader: true }), stgCell('Fat%', { isHeader: true }), stgCell('Snf%', { isHeader: true }), stgCell('SP.G', { isHeader: true }), stgCell('Kg.Fat', { isHeader: true }), stgCell('Kg.Snf', { isHeader: true })
    ]);

    alignedRows.forEach((row, i) => {
      const rowVal: any[] = new Array(18).fill('');

      if (row.r) {
        rowVal[0] = stgCell(i + 1, { alignment: 'center' });
        rowVal[1] = stgCell(row.r.item_name);
        rowVal[2] = stgCell(val(row.r.qty_lts, 0), { isNum: true });
        rowVal[3] = stgCell(val(row.r.qty_kg, 2), { isNum: true });
        rowVal[4] = stgCell(val(row.r.fat_pct, 4), { isNum: true });
        rowVal[5] = stgCell(val(row.r.snf_pct, 4), { isNum: true });
        rowVal[6] = stgCell(val(row.r.sp_gr, 4), { isNum: true });
        rowVal[7] = stgCell(val(row.r.kg_fat, 3), { isNum: true });
        rowVal[8] = stgCell(val(row.r.kg_snf, 3), { isNum: true });
      } else {
        for (let c = 0; c < 9; c++) rowVal[c] = stgCell('');
      }

      if (row.d) {
        rowVal[9] = stgCell(i + 1, { alignment: 'center' });
        rowVal[10] = stgCell(row.d.item_name);
        rowVal[11] = stgCell(val(row.d.qty_lts, 0), { isNum: true });
        rowVal[12] = stgCell(val(row.d.qty_kg, 2), { isNum: true });
        rowVal[13] = stgCell(val(row.d.fat_pct, 4), { isNum: true });
        rowVal[14] = stgCell(val(row.d.snf_pct, 4), { isNum: true });
        rowVal[15] = stgCell(val(row.d.sp_gr, 4), { isNum: true });
        rowVal[16] = stgCell(val(row.d.kg_fat, 3), { isNum: true });
        rowVal[17] = stgCell(val(row.d.kg_snf, 3), { isNum: true });
      } else {
        for (let c = 9; c < 18; c++) rowVal[c] = stgCell('');
      }

      stgSheetData.push(rowVal);
    });

    // Summary Rows
    const d1Idx = stgSheetData.length;
    stgSheetData.push([
      stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }),
      stgCell('Total', { isBold: true }), stgCell(''), stgCell(val(totDisp.lts, 0), { isBold: true, isNum: true }), stgCell(val(totDisp.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(totDisp.fat, 3), { isBold: true, isNum: true }), stgCell(val(totDisp.snf, 3), { isBold: true, isNum: true })
    ]);
    stgMerges.push({ s: { r: d1Idx, c: 9 }, e: { r: d1Idx, c: 10 } });

    const d2Idx = stgSheetData.length;
    stgSheetData.push([
      stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }),
      stgCell('CB', { isBold: true }), stgCell(''), stgCell(val(physicalCB.lts, 0), { isBold: true, isNum: true }), stgCell(val(physicalCB.kg, 2), { isBold: true, isNum: true }), stgCell(val(physicalCB.fat_pct, 4), { isBold: true, isNum: true }), stgCell(val(physicalCB.snf_pct, 4), { isBold: true, isNum: true }), stgCell(val(physicalCB.sp_gr, 4), { isBold: true, isNum: true }), stgCell(val(physicalCB.fat, 3), { isBold: true, isNum: true }), stgCell(val(physicalCB.snf, 3), { isBold: true, isNum: true })
    ]);
    stgMerges.push({ s: { r: d2Idx, c: 9 }, e: { r: d2Idx, c: 10 } });

    const d3Idx = stgSheetData.length;
    stgSheetData.push([
      stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }), stgCell('', { noBorder: true }),
      stgCell('Grand Total', { isBold: true }), stgCell(''), stgCell(val(grandDisp.lts, 0), { isBold: true, isNum: true }), stgCell(val(grandDisp.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(grandDisp.fat, 3), { isBold: true, isNum: true }), stgCell(val(grandDisp.snf, 3), { isBold: true, isNum: true })
    ]);
    stgMerges.push({ s: { r: d3Idx, c: 9 }, e: { r: d3Idx, c: 10 } });

    const r1Idx = stgSheetData.length;
    stgSheetData.push([
      stgCell('Total', { isBold: true }), stgCell(''), stgCell(val(totRec.lts, 0), { isBold: true, isNum: true }), stgCell(val(totRec.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(totRec.fat, 3), { isBold: true, isNum: true }), stgCell(val(totRec.snf, 3), { isBold: true, isNum: true }),
      stgCell('Loss/Gain', { isBold: true }), stgCell(''), stgCell(val(lossGain.lts, 0), { isBold: true, isNum: true }), stgCell(val(lossGain.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(lossGain.fat, 3), { isBold: true, isNum: true }), stgCell(val(lossGain.snf, 3), { isBold: true, isNum: true })
    ]);
    stgMerges.push({ s: { r: r1Idx, c: 0 }, e: { r: r1Idx, c: 1 } });
    stgMerges.push({ s: { r: r1Idx, c: 9 }, e: { r: r1Idx, c: 10 } });

    const r2Idx = stgSheetData.length;
    stgSheetData.push([
      stgCell('OB', { isBold: true }), stgCell(''), stgCell(val(obVal.lts, 0), { isBold: true, isNum: true }), stgCell(val(obVal.kg, 2), { isBold: true, isNum: true }), stgCell(val(obVal.fat_pct, 4), { isBold: true, isNum: true }), stgCell(val(obVal.snf_pct, 4), { isBold: true, isNum: true }), stgCell(val(obVal.sp_gr, 4), { isBold: true, isNum: true }), stgCell(val(obVal.fat, 3), { isBold: true, isNum: true }), stgCell(val(obVal.snf, 3), { isBold: true, isNum: true }),
      stgCell('Loss/Gain %', { isBold: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(`${val(lossGainPct.fat, 4)}%`, { isBold: true, alignment: 'right' }), stgCell(`${val(lossGainPct.snf, 4)}%`, { isBold: true, alignment: 'right' })
    ]);
    stgMerges.push({ s: { r: r2Idx, c: 0 }, e: { r: r2Idx, c: 1 } });
    stgMerges.push({ s: { r: r2Idx, c: 9 }, e: { r: r2Idx, c: 10 } });

    const defaultNorm = CALC_CONFIG.TS_REPORT.CMPDD_NORM_PCT || 0.5;
    const bCmpddNormStr = (customBlocks[block] && customBlocks[block].cmpdd_norm)
      ? customBlocks[block].cmpdd_norm
      : (cmpddNorms[block] || String(defaultNorm));
    const bCmpddNorm = parseFloat(bCmpddNormStr) || defaultNorm;

    const r3Idx = stgSheetData.length;
    stgSheetData.push([
      stgCell('Grand Total', { isBold: true }), stgCell(''), stgCell(val(grandRec.lts, 0), { isBold: true, isNum: true }), stgCell(val(grandRec.kg, 2), { isBold: true, isNum: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(val(grandRec.fat, 3), { isBold: true, isNum: true }), stgCell(val(grandRec.snf, 3), { isBold: true, isNum: true }),
      stgCell(`CMPDD Norms (${bCmpddNorm}%)`, { isBold: true }), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(''), stgCell(`${bCmpddNorm}%`, { isBold: true, alignment: 'right' }), stgCell(`${bCmpddNorm}%`, { isBold: true, alignment: 'right' })
    ]);
    stgMerges.push({ s: { r: r3Idx, c: 0 }, e: { r: r3Idx, c: 1 } });
    stgMerges.push({ s: { r: r3Idx, c: 9 }, e: { r: r3Idx, c: 10 } });
  });

  const stgWs = XLSX.utils.aoa_to_sheet(stgSheetData);
  stgWs['!cols'] = colWidths;
  stgWs['!merges'] = stgMerges;
  XLSX.utils.book_append_sheet(wb, stgWs, 'STG');
}

