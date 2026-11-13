// ─────────────────────────────────────────────────────────────
// src/lib/export/excelTS.ts
// Excel builder for Total Solids (TS) Statement
// ─────────────────────────────────────────────────────────────

import XLSX from 'xlsx-js-style';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { generateDynamicBalanceRows, calcTSTotals } from '@/lib/calculations';
import { CALC_CONFIG } from '@/lib/config';
import type { TSMilkRow } from '@/lib/types';
import { cell, val } from './excelStyles';

export async function buildTSStatementSheet(
  tsRowsData: TSMilkRow[],
  date: string,
  entryNotes: string | undefined,
  wb: XLSX.WorkBook
) {
  if (!tsRowsData || tsRowsData.length === 0) return;

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

  // Get global statements config
  let gStmts: any[] = [];
  try {
    const supabase = getSupabaseServiceClient();
    const { data } = await supabase
      .from('entries')
      .select('notes')
      .eq('report_type', 'TS')
      .order('entry_date', { ascending: false });

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
  } catch (e) {
    console.warn('Failed to load global TS statements config:', e);
  }

  const { obRows, cbRows } = generateDynamicBalanceRows(tsRowsData, entryNotes ?? null, gStmts);
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

  type AlignedRow = {
    left: { type: 'header'; label: string } | { type: 'total'; label: string; qty_lts: number; qty_kg: number; kg_fat: number; kg_snf: number } | { type: 'item'; index: number; data: TSMilkRow } | { type: 'empty' };
    right: { type: 'header'; label: string } | { type: 'total'; label: string; qty_lts: number; qty_kg: number; kg_fat: number; kg_snf: number } | { type: 'item'; index: number; data: TSMilkRow } | { type: 'empty' };
  };

  const leftList: AlignedRow['left'][] = [];
  const rightList: AlignedRow['right'][] = [];

  // Left Side
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

  // Right Side
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

  const orgTitle = (process.env.NEXT_PUBLIC_ORG_NAME || "NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS' UNION LTD").toUpperCase();

  const tsData: any[][] = [
    [
      cell(orgTitle, { isBold: true, noBorder: true })
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
      rowVal[0] = cell('');
      rowVal[1] = cell(row.left.label, { isBold: true });
      for (let c = 2; c < 9; c++) rowVal[c] = cell('');
      merges.push({ s: { r: rIndex, c: 1 }, e: { r: rIndex, c: 8 } });
    } else if (row.left.type === 'total') {
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
      rowVal[9] = cell('');
      rowVal[10] = cell(row.right.label, { isBold: true });
      for (let c = 11; c < 18; c++) rowVal[c] = cell('');
      merges.push({ s: { r: rIndex, c: 10 }, e: { r: rIndex, c: 17 } });
    } else if (row.right.type === 'total') {
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

  // Grand Totals
  const gtRowIdx = tsData.length;
  tsData.push([
    cell('G.TOTAL', { isBold: true }), cell(''), cell(val(totals.grand_total_arrival_lts), { isBold: true, isNum: true }), cell(val(totals.grand_total_arrival_kg), { isBold: true, isNum: true }), cell('-'), cell('-'), cell('-'), cell(val(totals.grand_total_arrival_kg_fat, 4), { isBold: true, isNum: true }), cell(val(totals.grand_total_arrival_kg_snf, 4), { isBold: true, isNum: true }),
    cell('G.TOTAL', { isBold: true }), cell(''), cell(val(totals.grand_total_disposal_lts), { isBold: true, isNum: true }), cell(val(totals.grand_total_disposal_kg), { isBold: true, isNum: true }), cell('-'), cell('-'), cell('-'), cell(val(totals.grand_total_disposal_kg_fat, 4), { isBold: true, isNum: true }), cell(val(totals.grand_total_disposal_kg_snf, 4), { isBold: true, isNum: true })
  ]);
  merges.push({ s: { r: gtRowIdx, c: 0 }, e: { r: gtRowIdx, c: 1 } });
  merges.push({ s: { r: gtRowIdx, c: 9 }, e: { r: gtRowIdx, c: 10 } });

  // Loss/Gain
  const lgRowIdx = tsData.length;
  tsData.push([
    cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
    cell(''), cell('LOSS', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(Math.abs(totals.loss_kg_fat), 4), { isBold: true, isNum: true }), cell(val(Math.abs(totals.loss_kg_snf), 4), { isBold: true, isNum: true })
  ]);
  merges.push({ s: { r: lgRowIdx, c: 10 }, e: { r: lgRowIdx, c: 15 } });

  // Loss %
  const lpRowIdx = tsData.length;
  tsData.push([
    cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
    cell(''), cell('LOSS%', { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(totals.loss_pct_fat, 4), { isBold: true, isNum: true }), cell(val(totals.loss_pct_snf, 4), { isBold: true, isNum: true })
  ]);
  merges.push({ s: { r: lpRowIdx, c: 10 }, e: { r: lpRowIdx, c: 15 } });

  let globalCmpddNorm = CALC_CONFIG.TS_REPORT.CMPDD_NORM_PCT || 0.5;
  if (entryNotes) {
    const parts = entryNotes.split('\n');
    parts.forEach(part => {
      if (part.includes('__METADATA__:')) {
        try {
          const meta = JSON.parse(part.split('__METADATA__:')[1]);
          if (meta.cmpdd_norms && meta.cmpdd_norms.WM) globalCmpddNorm = parseFloat(meta.cmpdd_norms.WM) || globalCmpddNorm;
          else if (meta.cmpdd_norm) globalCmpddNorm = parseFloat(meta.cmpdd_norm) || globalCmpddNorm;
        } catch {}
      }
    });
  }

  // Norm row
  const normRowIdx = tsData.length;
  tsData.push([
    cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }), cell('', { noBorder: true }),
    cell(''), cell(`CMPDD LOSS % (${globalCmpddNorm}%)`, { isBold: true }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(val(globalCmpddNorm, 2), { isBold: true, isNum: true }), cell(val(globalCmpddNorm, 2), { isBold: true, isNum: true })
  ]);
  merges.push({ s: { r: normRowIdx, c: 10 }, e: { r: normRowIdx, c: 15 } });

  const tsWs = XLSX.utils.aoa_to_sheet(tsData);
  tsWs['!cols'] = colWidths;
  tsWs['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, tsWs, 'TS');
}

