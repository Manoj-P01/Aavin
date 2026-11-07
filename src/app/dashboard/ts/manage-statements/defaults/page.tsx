'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getStandardColumnDecimals, cleanStatementLabel } from '@/lib/calculations';
import { useConfirm } from '@/context/ConfirmContext';

export type STGSectionType = 'OB' | 'RECEIPT' | 'DISPOSAL' | 'RECON';

export interface STGColumnDef {
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
  sort_order?: number;
  is_active?: boolean;
}

export interface STGReconRow {
  id: string;
  label: string;
  row_type?: string;
  values: Record<string, any>;
  is_formula?: boolean;
  color_hint?: 'green' | 'blue' | 'orange' | 'yellow' | 'purple' | 'dark' | 'default';
}

export interface STGRowData {
  variant: string;
  row_type?: 'OB' | 'RECEIPT' | 'DISPOSAL';
  side?: 'RECEIPT' | 'DISPOSAL';
  values: Record<string, any>;
}

export interface STGMasterDef {
  key: string;
  label: string;
  name?: string;
  variant?: string;
  description?: string;
  is_split?: boolean;
  ob_rows?: STGRowData[];
  receipt_rows?: STGRowData[];
  disposal_rows?: STGRowData[];
  reconciliation_rows?: STGReconRow[];
  ob_columns?: STGColumnDef[];
  receipt_columns?: STGColumnDef[];
  disposal_columns?: STGColumnDef[];
  recon_columns?: STGColumnDef[];
  custom_columns?: STGColumnDef[];
  default_rows?: STGRowData[];
  rows?: any[];
  sort_order?: number;
  is_active?: boolean;
}

export const getDefaultSTGColumns = (): STGColumnDef[] => [
  { key: 'qty_lts', name: 'Qty (Lts)', type: 'number', decimals: 0, sort_order: 1 },
  { key: 'sp_gr', name: 'SP.G', type: 'number', decimals: 4, sort_order: 2 },
  { key: 'qty_kg', name: 'Qty (Kg)', type: 'calculated', formula: 'qty_lts * sp_gr', decimals: 2, sort_order: 3 },
  { key: 'fat_pct', name: 'Fat%', type: 'number', decimals: 2, sort_order: 4 },
  { key: 'snf_pct', name: 'Snf%', type: 'number', decimals: 2, sort_order: 5 },
  { key: 'kg_fat', name: 'Kg.Fat', type: 'calculated', formula: 'qty_kg * fat_pct / 100', decimals: 3, sort_order: 6 },
  { key: 'kg_snf', name: 'Kg.Snf', type: 'calculated', formula: 'qty_kg * snf_pct / 100', decimals: 3, sort_order: 7 },
];

export const getDefaultReconRows = (): STGReconRow[] => [
  {
    id: 'recon_row_1',
    label: 'Total Receipts (+)',
    row_type: 'TOTAL_RECEIPT',
    is_formula: true,
    color_hint: 'green',
    values: {
      qty_lts: '=RECEIPTS.lts',
      lts: '=RECEIPTS.lts',
      sp_gr: '—',
      qty_kg: '=RECEIPTS.kg',
      kg: '=RECEIPTS.kg',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=RECEIPTS.kg_fat',
      kg_snf: '=RECEIPTS.kg_snf',
      note: 'Total of all Receipts',
    },
  },
  {
    id: 'recon_row_2',
    label: 'Opening Balance (OB)',
    row_type: 'OB',
    is_formula: true,
    color_hint: 'blue',
    values: {
      qty_lts: '=OB.lts',
      lts: '=OB.lts',
      sp_gr: '=OB.sp_gr',
      qty_kg: '=OB.kg',
      kg: '=OB.kg',
      fat_pct: '=OB.fat_pct',
      snf_pct: '=OB.snf_pct',
      kg_fat: '=OB.kg_fat',
      kg_snf: '=OB.kg_snf',
      note: 'Beginning Inventory',
    },
  },
  {
    id: 'recon_row_3',
    label: 'Grand Total Receipts (=)',
    row_type: 'GRAND_TOTAL_RECEIPT',
    is_formula: true,
    color_hint: 'dark',
    values: {
      qty_lts: '=R1+R2',
      lts: '=R1+R2',
      sp_gr: '—',
      qty_kg: '=R1+R2',
      kg: '=R1+R2',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=R1+R2',
      kg_snf: '=R1+R2',
      note: 'Total Receipts + OB',
    },
  },
  {
    id: 'recon_row_4',
    label: 'Total Disposals (-)',
    row_type: 'TOTAL_DISPOSAL',
    is_formula: true,
    color_hint: 'orange',
    values: {
      qty_lts: '=DISPOSALS.lts',
      lts: '=DISPOSALS.lts',
      sp_gr: '—',
      qty_kg: '=DISPOSALS.kg',
      kg: '=DISPOSALS.kg',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=DISPOSALS.kg_fat',
      kg_snf: '=DISPOSALS.kg_snf',
      note: 'Total of all Disposals',
    },
  },
  {
    id: 'recon_row_5',
    label: 'Closing Balance / Physical Count',
    row_type: 'CB',
    is_formula: true,
    color_hint: 'yellow',
    values: {
      qty_lts: '=CB.lts',
      lts: '=CB.lts',
      sp_gr: '=CB.sp_gr',
      qty_kg: '=CB.kg',
      kg: '=CB.kg',
      fat_pct: '=CB.fat_pct',
      snf_pct: '=CB.snf_pct',
      kg_fat: '=CB.kg_fat',
      kg_snf: '=CB.kg_snf',
      note: 'Physical stock at end of shift',
    },
  },
  {
    id: 'recon_row_6',
    label: 'Grand Total Disposals (=)',
    row_type: 'GRAND_TOTAL_DISPOSAL',
    is_formula: true,
    color_hint: 'dark',
    values: {
      qty_lts: '=R4+R5',
      lts: '=R4+R5',
      sp_gr: '—',
      qty_kg: '=R4+R5',
      kg: '=R4+R5',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=R4+R5',
      kg_snf: '=R4+R5',
      note: 'Total Disposals + CB',
    },
  },
  {
    id: 'recon_row_7',
    label: 'Operational Loss (-) / Gain (+)',
    row_type: 'LOSS_GAIN',
    is_formula: true,
    color_hint: 'purple',
    values: {
      qty_lts: '=R3-R6',
      lts: '=R3-R6',
      sp_gr: '—',
      qty_kg: '=R3-R6',
      kg: '=R3-R6',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=R3-R6',
      kg_snf: '=R3-R6',
      note: 'Grand Total Receipts - Grand Total Disposals',
    },
  },
  {
    id: 'recon_row_8',
    label: 'Net Loss / Gain %',
    row_type: 'LOSS_GAIN_PCT',
    is_formula: true,
    color_hint: 'purple',
    values: {
      qty_lts: '=(R7/R3)*100',
      lts: '=(R7/R3)*100',
      sp_gr: '—',
      qty_kg: '=(R7/R3)*100',
      kg: '=(R7/R3)*100',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=(R7/R3)*100',
      kg_snf: '=(R7/R3)*100',
      note: 'Operational variance percentage',
    },
  },
];

function STGDefaultFormulationsContent() {
  const { confirm, showWarning } = useConfirm();
  const searchParams = useSearchParams();
  const paramMaster = searchParams?.get('master') || null;

  // Master definitions
  const [masters, setMasters] = useState<STGMasterDef[]>([]);
  const [activeMasterKey, setActiveMasterKey] = useState<string | null>(null);

  // Per-section Columns
  const [obColumns, setObColumns] = useState<STGColumnDef[]>(getDefaultSTGColumns());
  const [receiptColumns, setReceiptColumns] = useState<STGColumnDef[]>(getDefaultSTGColumns());
  const [disposalColumns, setDisposalColumns] = useState<STGColumnDef[]>(getDefaultSTGColumns());
  const [reconColumns, setReconColumns] = useState<STGColumnDef[]>(getDefaultSTGColumns());

  // Per-section Rows
  const [obRows, setObRows] = useState<STGRowData[]>([
    { variant: 'Opening Balance', row_type: 'OB', side: 'RECEIPT', values: {} }
  ]);
  const [receiptRows, setReceiptRows] = useState<STGRowData[]>([
    { variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: {} }
  ]);
  const [disposalRows, setDisposalRows] = useState<STGRowData[]>([
    { variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} }
  ]);
  const [reconRows, setReconRows] = useState<STGReconRow[]>(getDefaultReconRows());

  // Per-section Column Editing state (toggle button on each table header)
  const [editingColsSections, setEditingColsSections] = useState<Record<STGSectionType, boolean>>({
    OB: false,
    RECEIPT: false,
    DISPOSAL: false,
    RECON: false,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewDecimals, setViewDecimals] = useState<number | 'auto'>('auto');

  // Excel Cell Selection & Focus across all 4 sections
  const [selectedCell, setSelectedCell] = useState<{
    section: STGSectionType;
    rowIndex: number;
    colKey: string;
  } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{
    section: STGSectionType;
    rowIndex: number;
    colKey: string;
  } | null>(null);

  // Column Configuration Modal (view, reorder, edit, delete all columns for a section)
  const [isColConfigModalOpen, setIsColConfigModalOpen] = useState<boolean>(false);
  const [colConfigSection, setColConfigSection] = useState<STGSectionType>('RECEIPT');

  // Add / Edit Single Column Modal
  const [isColModalOpen, setIsColModalOpen] = useState<boolean>(false);
  const [colModalSection, setColModalSection] = useState<STGSectionType>('RECEIPT');
  const [colModalInsertIdx, setColModalInsertIdx] = useState<number | null>(null);
  const [colModalEditingKey, setColModalEditingKey] = useState<string | null>(null);

  const [formColKey, setFormColKey] = useState<string>('');
  const [colKeyManuallyEdited, setColKeyManuallyEdited] = useState<boolean>(false);
  const [formColName, setFormColName] = useState<string>('');
  const [formColType, setFormColType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formColFormula, setFormColFormula] = useState<string>('');
  const [formColUnit, setFormColUnit] = useState<string>('');
  const [formColDecimals, setFormColDecimals] = useState<number | undefined>(undefined);

  // Manage Statement Master Names Modal (Update, Delete, Insert)
  const [isManageMastersModalOpen, setIsManageMastersModalOpen] = useState<boolean>(false);
  const [editingMasterKey, setEditingMasterKey] = useState<string | null>(null);
  const [editMasterLabel, setEditMasterLabel] = useState<string>('');
  const [editMasterVariant, setEditMasterVariant] = useState<string>('');
  const [editMasterDescription, setEditMasterDescription] = useState<string>('');

  // Create New Statement Master Modal
  const [isNewMasterModalOpen, setIsNewMasterModalOpen] = useState<boolean>(false);
  const [newMasterName, setNewMasterName] = useState<string>('');
  const [newMasterKey, setNewMasterKey] = useState<string>('');
  const [newMasterKeyManuallyEdited, setNewMasterKeyManuallyEdited] = useState<boolean>(false);
  const [newMasterVariant, setNewMasterVariant] = useState<string>('');
  const [newMasterDescription, setNewMasterDescription] = useState<string>('');
  const [newMasterSource, setNewMasterSource] = useState<string>('blank');
  const [newMasterColsSource, setNewMasterColsSource] = useState<string>('default');

  // Helper getters and setters for sections
  const getSectionColumns = useCallback((sec: STGSectionType): STGColumnDef[] => {
    switch (sec) {
      case 'OB': return obColumns;
      case 'RECEIPT': return receiptColumns;
      case 'DISPOSAL': return disposalColumns;
      case 'RECON': return reconColumns;
    }
  }, [obColumns, receiptColumns, disposalColumns, reconColumns]);

  const setSectionColumns = useCallback((sec: STGSectionType, cols: STGColumnDef[]) => {
    switch (sec) {
      case 'OB': setObColumns(cols); break;
      case 'RECEIPT': setReceiptColumns(cols); break;
      case 'DISPOSAL': setDisposalColumns(cols); break;
      case 'RECON': setReconColumns(cols); break;
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getExcelColName = (idx: number) => {
    let name = '';
    let n = idx;
    while (n >= 0) {
      name = String.fromCharCode((n % 26) + 65) + name;
      n = Math.floor(n / 26) - 1;
    }
    return name;
  };

  const formatNumberValue = (num: number, decimals?: number, colKey?: string): string => {
    if (isNaN(num)) return '-';
    let dec = getStandardColumnDecimals(colKey || '', decimals);
    if (viewDecimals !== 'auto') {
      dec = viewDecimals;
    }
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  // Safe Excel Formula Evaluator for standard section rows
  const evaluateExcelFormula = (
    formulaInput: string,
    rowIndex: number,
    rowVals: Record<string, any>,
    rowList: STGRowData[],
    colList: STGColumnDef[],
    depth: number = 0
  ): number => {
    if (!formulaInput || typeof formulaInput !== 'string' || depth > 10) return 0;
    let expr = formulaInput.trim();
    if (expr.startsWith('=')) expr = expr.substring(1).trim();
    if (expr.startsWith('+')) expr = expr.substring(1).trim();
    if (!expr) return 0;

    // Excel functions like SUM(A1:A5)
    expr = expr.replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT)?\s*\(?\s*([A-Z]+)([0-9]+)\s*:\s*([A-Z]+)([0-9]+)\s*\)?/gi, (match, fnName, c1, r1, c2, r2) => {
      let col1Idx = 0, col2Idx = 0;
      const u1 = c1.toUpperCase();
      for (let i = 0; i < u1.length; i++) col1Idx = col1Idx * 26 + (u1.charCodeAt(i) - 64);
      col1Idx -= 1;

      const u2 = c2.toUpperCase();
      for (let i = 0; i < u2.length; i++) col2Idx = col2Idx * 26 + (u2.charCodeAt(i) - 64);
      col2Idx -= 1;

      const r1Num = parseInt(r1, 10);
      const r2Num = parseInt(r2, 10);

      const minCol = Math.min(col1Idx, col2Idx);
      const maxCol = Math.max(col1Idx, col2Idx);
      const minRow = Math.min(r1Num, r2Num);
      const maxRow = Math.max(r1Num, r2Num);

      const cells: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const colLetter = getExcelColName(c);
        for (let r = minRow; r <= maxRow; r++) {
          cells.push(`${colLetter}${r}`);
        }
      }
      const func = fnName ? fnName.toUpperCase() : 'SUM';
      return `${func}(${cells.join(', ')})`;
    });

    // Single cell references like A1, B2
    expr = expr.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      let colIdx = 0;
      const upperLetters = colLetters.toUpperCase();
      for (let i = 0; i < upperLetters.length; i++) {
        colIdx = colIdx * 26 + (upperLetters.charCodeAt(i) - 64);
      }
      colIdx = colIdx - 1;

      const targetRowIdx = parseInt(rowNumStr, 10) - 1;
      const targetCol = colList[colIdx];
      if (!targetCol) return '0';

      let rawVal: any = 0;
      let targetVals = rowVals;
      if (targetRowIdx === rowIndex) {
        rawVal = rowVals[targetCol.key];
      } else {
        const targetRow = rowList[targetRowIdx];
        rawVal = targetRow?.values?.[targetCol.key];
        targetVals = targetRow?.values || {};
      }

      if (rawVal === undefined || rawVal === null || rawVal === '') return '0';

      if (typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'))) {
        return String(evaluateExcelFormula(rawVal, targetRowIdx, targetVals, rowList, colList, depth + 1));
      }

      if (targetCol.type === 'calculated') {
        const computedTarget = computeCell(targetCol, targetVals, targetRowIdx, rowList, colList);
        const numVal = typeof computedTarget === 'number' ? computedTarget : parseFloat(String(computedTarget || 0));
        return isNaN(numVal) ? '0' : String(numVal);
      }

      const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
      return isNaN(numVal) ? '0' : String(numVal);
    });

    // Replace column key variables (e.g. qty_lts, sp_gr)
    colList.forEach(col => {
      if (expr.includes(col.key)) {
        const rawVal = rowVals[col.key];
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0));
        expr = expr.replaceAll(col.key, String(isNaN(numVal) ? 0 : numVal));
      }
    });

    try {
      let cleanExpr = expr.replace(/[^0-9.\-+/*%() ,a-zA-Z]/g, '').trim();
      cleanExpr = cleanExpr.replace(/[\-+/*%,]+$/g, '').trim();
      if (!cleanExpr) return 0;

      let openCount = 0;
      for (let i = 0; i < cleanExpr.length; i++) {
        if (cleanExpr[i] === '(') openCount++;
        else if (cleanExpr[i] === ')') openCount--;
      }
      if (openCount > 0) cleanExpr += ')'.repeat(openCount);

      const evaluator = Function(
        'SUM', 'AVERAGE', 'AVG', 'MIN', 'MAX', 'COUNT', 'ROUND', 'ABS',
        `"use strict"; return (${cleanExpr});`
      );

      const sumFn = (...args: any[]) => args.flat().reduce((a, b) => Number(a || 0) + Number(b || 0), 0);
      const avgFn = (...args: any[]) => {
        const arr = args.flat();
        return arr.length ? sumFn(...arr) / arr.length : 0;
      };
      const minFn = (...args: any[]) => Math.min(...args.flat().map(Number));
      const maxFn = (...args: any[]) => Math.max(...args.flat().map(Number));
      const countFn = (...args: any[]) => args.flat().length;
      const roundFn = (val: number, dec: number = 0) => {
        const p = Math.pow(10, dec);
        return Math.round(Number(val || 0) * p) / p;
      };
      const absFn = (val: number) => Math.abs(Number(val || 0));

      const evalResult = evaluator(sumFn, avgFn, avgFn, minFn, maxFn, countFn, roundFn, absFn);
      return typeof evalResult === 'number' && !isNaN(evalResult) ? evalResult : 0;
    } catch {
      return 0;
    }
  };

  const computeCell = (
    col: STGColumnDef,
    rowVals: Record<string, any>,
    rowIndex: number = 0,
    rowList: STGRowData[] = [],
    colList: STGColumnDef[] = []
  ) => {
    const cellVal = rowVals ? rowVals[col.key] : undefined;

    if (cellVal !== undefined && typeof cellVal === 'string' && (cellVal.startsWith('=') || cellVal.startsWith('=+'))) {
      return evaluateExcelFormula(cellVal, rowIndex, rowVals, rowList, colList);
    }

    if (col.type === 'calculated') {
      if (col.formula && typeof col.formula === 'string' && (col.formula.startsWith('=') || col.formula.startsWith('=+'))) {
        return evaluateExcelFormula(col.formula, rowIndex, rowVals, rowList, colList);
      }
      if (col.formula && typeof col.formula === 'string') {
        return evaluateExcelFormula(`=${col.formula}`, rowIndex, rowVals, rowList, colList);
      }

      // Built-in standard formulas
      const qtyLts = parseFloat(String(rowVals?.qty_lts ?? rowVals?.lts ?? 0)) || 0;
      const spGr = parseFloat(String(rowVals?.sp_gr ?? 0)) || 0;
      const fatPct = parseFloat(String(rowVals?.fat_pct ?? 0)) || 0;
      const snfPct = parseFloat(String(rowVals?.snf_pct ?? 0)) || 0;

      let qtyKg = parseFloat(String(rowVals?.qty_kg ?? rowVals?.kg ?? 0));
      if (isNaN(qtyKg) || qtyKg === 0) {
        qtyKg = qtyLts * spGr;
      }

      if (col.key === 'qty_kg' || col.key === 'kg') return qtyLts * spGr;
      if (col.key === 'kg_fat' || col.key === 'fat') return (qtyKg * fatPct) / 100;
      if (col.key === 'kg_snf' || col.key === 'snf') return (qtyKg * snfPct) / 100;

      return 0;
    }
    return cellVal !== undefined ? cellVal : '';
  };

  // Calculation of totals for each section
  const totalOB = useMemo(() => {
    const totals: Record<string, number> = {};
    obColumns.forEach(col => {
      if (col.type !== 'text') {
        const sum = obRows.reduce((acc, row, idx) => {
          const computed = computeCell(col, row.values, idx, obRows, obColumns);
          const num = typeof computed === 'number' ? computed : parseFloat(String(computed || 0));
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
        totals[col.key] = sum;
      }
    });
    return totals;
  }, [obColumns, obRows]);

  const totalReceipts = useMemo(() => {
    const totals: Record<string, number> = {};
    receiptColumns.forEach(col => {
      if (col.type !== 'text') {
        const sum = receiptRows.reduce((acc, row, idx) => {
          const computed = computeCell(col, row.values, idx, receiptRows, receiptColumns);
          const num = typeof computed === 'number' ? computed : parseFloat(String(computed || 0));
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
        totals[col.key] = sum;
      }
    });
    return totals;
  }, [receiptColumns, receiptRows]);

  const totalDisposals = useMemo(() => {
    const totals: Record<string, number> = {};
    disposalColumns.forEach(col => {
      if (col.type !== 'text') {
        const sum = disposalRows.reduce((acc, row, idx) => {
          const computed = computeCell(col, row.values, idx, disposalRows, disposalColumns);
          const num = typeof computed === 'number' ? computed : parseFloat(String(computed || 0));
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
        totals[col.key] = sum;
      }
    });
    return totals;
  }, [disposalColumns, disposalRows]);

  // Safe Excel Formula Evaluator for Reconciliation Summary
  const evaluateReconFormula = (
    formulaStr: any,
    colKey: string,
    rIdx: number,
    reconList: STGReconRow[],
    obTots: Record<string, number>,
    recTotals: Record<string, number>,
    dispTotals: Record<string, number>,
    depth: number = 0
  ): number | string => {
    if (depth > 10 || formulaStr === undefined || formulaStr === null || formulaStr === '') return 0;
    let expr = String(formulaStr).trim();
    if (expr === '—' || expr === '-') return '—';
    if (!expr.startsWith('=')) {
      const n = parseFloat(expr);
      return isNaN(n) ? expr : n;
    }
    expr = expr.substring(1).trim();
    if (expr.startsWith('+')) expr = expr.substring(1).trim();
    if (!expr) return 0;

    // Cross-references to RECEIPTS
    expr = expr.replace(/\bRECEIPTS?(?:\.([a-z_0-9]+))?\b/gi, (_, key) => {
      const targetK = (key || colKey).toLowerCase();
      if (recTotals[targetK] !== undefined) return String(recTotals[targetK]);
      if (targetK === 'qty_lts' && recTotals['lts'] !== undefined) return String(recTotals['lts']);
      if (targetK === 'lts' && recTotals['qty_lts'] !== undefined) return String(recTotals['qty_lts']);
      if (targetK === 'qty_kg' && recTotals['kg'] !== undefined) return String(recTotals['kg']);
      if (targetK === 'kg' && recTotals['qty_kg'] !== undefined) return String(recTotals['qty_kg']);
      if (targetK === 'fat' && recTotals['kg_fat'] !== undefined) return String(recTotals['kg_fat']);
      if (targetK === 'snf' && recTotals['kg_snf'] !== undefined) return String(recTotals['kg_snf']);
      return String(recTotals[colKey] || 0);
    });

    // Cross-references to DISPOSALS
    expr = expr.replace(/\bDISPOSALS?(?:\.([a-z_0-9]+))?\b/gi, (_, key) => {
      const targetK = (key || colKey).toLowerCase();
      if (dispTotals[targetK] !== undefined) return String(dispTotals[targetK]);
      if (targetK === 'qty_lts' && dispTotals['lts'] !== undefined) return String(dispTotals['lts']);
      if (targetK === 'lts' && dispTotals['qty_lts'] !== undefined) return String(dispTotals['qty_lts']);
      if (targetK === 'qty_kg' && dispTotals['kg'] !== undefined) return String(dispTotals['kg']);
      if (targetK === 'kg' && dispTotals['qty_kg'] !== undefined) return String(dispTotals['qty_kg']);
      if (targetK === 'fat' && dispTotals['kg_fat'] !== undefined) return String(dispTotals['kg_fat']);
      if (targetK === 'snf' && dispTotals['kg_snf'] !== undefined) return String(dispTotals['kg_snf']);
      return String(dispTotals[colKey] || 0);
    });

    // Opening Balance references: OB or OB.col
    expr = expr.replace(/\bOB(?:\.([a-z_0-9]+))?\b/gi, (_, key) => {
      const targetK = (key || colKey).toLowerCase();
      if (obTots[targetK] !== undefined) return String(obTots[targetK]);
      if (targetK === 'qty_lts' && obTots['lts'] !== undefined) return String(obTots['lts']);
      if (targetK === 'lts' && obTots['qty_lts'] !== undefined) return String(obTots['qty_lts']);
      if (targetK === 'qty_kg' && obTots['kg'] !== undefined) return String(obTots['kg']);
      if (targetK === 'kg' && obTots['qty_kg'] !== undefined) return String(obTots['qty_kg']);
      if (targetK === 'fat' && obTots['kg_fat'] !== undefined) return String(obTots['kg_fat']);
      if (targetK === 'snf' && obTots['kg_snf'] !== undefined) return String(obTots['kg_snf']);
      const firstOB = obRows[0]?.values;
      if (firstOB && firstOB[targetK] !== undefined) {
        const n = parseFloat(String(firstOB[targetK]));
        return String(isNaN(n) ? 0 : n);
      }
      return String(obTots[colKey] || 0);
    });

    // Closing Balance references: CB or CB.col
    expr = expr.replace(/\bCB(?:\.([a-z_0-9]+))?\b/gi, (_, key) => {
      const targetK = (key || colKey).toLowerCase();
      const rec = (obTots[targetK] || 0) + (recTotals[targetK] || 0);
      const disp = dispTotals[targetK] || 0;
      return String(rec - disp);
    });

    // Row references: R1, R2 or R1.kg, R2.lts
    expr = expr.replace(/\bR([0-9]+)(?:\.([a-z_0-9]+))?\b/gi, (_, rowNum, targetColKey) => {
      const targetRIdx = parseInt(rowNum, 10) - 1;
      const targetRow = reconList[targetRIdx];
      if (!targetRow) return '0';
      const cKey = (targetColKey || colKey).toLowerCase();
      let rawVal = targetRow.values?.[cKey];
      if (rawVal === undefined) {
        if (cKey === 'qty_lts') rawVal = targetRow.values?.['lts'];
        else if (cKey === 'lts') rawVal = targetRow.values?.['qty_lts'];
        else if (cKey === 'qty_kg') rawVal = targetRow.values?.['kg'];
        else if (cKey === 'kg') rawVal = targetRow.values?.['qty_kg'];
      }
      if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === '—' || rawVal === '-') return '0';
      if (typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'))) {
        const evalSub = evaluateReconFormula(rawVal, cKey, targetRIdx, reconList, obTots, recTotals, dispTotals, depth + 1);
        return String(typeof evalSub === 'number' ? evalSub : (parseFloat(String(evalSub)) || 0));
      }
      const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
      return isNaN(num) ? '0' : String(num);
    });

    try {
      if (!/^[0-9+\-*\/().\s,eEMath.minmaxroundabsfloorceil]+$/.test(expr)) return 0;
      const result = new Function('return (' + expr + ');')();
      return typeof result === 'number' && !isNaN(result) && isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  };

  // Active cell details for Excel Formula Bar
  const activeCellDetails = useMemo(() => {
    if (!selectedCell) {
      return { address: 'A1', sectionTag: '', colName: '', isCalculated: false, formulaText: '', value: '-' };
    }

    const { section, rowIndex, colKey } = selectedCell;
    const currentCols = getSectionColumns(section);
    const colIdx = currentCols.findIndex(c => c.key === colKey);
    const col = colIdx !== -1 ? currentCols[colIdx] : { key: colKey, name: colKey, type: 'number' as const, decimals: 2 };
    const excelColLetter = colIdx !== -1 ? getExcelColName(colIdx) : 'A';

    let sectionTag = '';
    let address = '';
    let formulaText = '';
    let valueStr = '-';
    let isCalculated = col.type === 'calculated';

    if (section === 'OB') {
      sectionTag = '🌅 Opening Balance';
      address = `OB${rowIndex + 1}.${excelColLetter}`;
      const row = obRows[rowIndex] || { values: {}, variant: '' };
      const rawVal = row.values?.[colKey];
      const computed = computeCell(col, row.values || {}, rowIndex, obRows, obColumns);
      formulaText = rawVal !== undefined ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
      valueStr = typeof computed === 'number' ? formatNumberValue(computed, col.decimals, col.key) : (computed || '-');
    } else if (section === 'RECEIPT') {
      sectionTag = '📥 Receipts';
      address = `REC${rowIndex + 1}.${excelColLetter}`;
      const row = receiptRows[rowIndex] || { values: {}, variant: '' };
      const rawVal = row.values?.[colKey];
      const computed = computeCell(col, row.values || {}, rowIndex, receiptRows, receiptColumns);
      formulaText = rawVal !== undefined ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
      valueStr = typeof computed === 'number' ? formatNumberValue(computed, col.decimals, col.key) : (computed || '-');
    } else if (section === 'DISPOSAL') {
      sectionTag = '📤 Disposals';
      address = `DISP${rowIndex + 1}.${excelColLetter}`;
      const row = disposalRows[rowIndex] || { values: {}, variant: '' };
      const rawVal = row.values?.[colKey];
      const computed = computeCell(col, row.values || {}, rowIndex, disposalRows, disposalColumns);
      formulaText = rawVal !== undefined ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
      valueStr = typeof computed === 'number' ? formatNumberValue(computed, col.decimals, col.key) : (computed || '-');
    } else if (section === 'RECON') {
      sectionTag = '⚖️ Reconciliation';
      address = `R${rowIndex + 1}.${excelColLetter}`;
      const row = reconRows[rowIndex] || { values: {}, label: '' };
      let rawVal = row.values?.[colKey];
      if (rawVal === undefined) {
        if (colKey === 'qty_lts') rawVal = row.values?.['lts'];
        else if (colKey === 'lts') rawVal = row.values?.['qty_lts'];
        else if (colKey === 'qty_kg') rawVal = row.values?.['kg'];
        else if (colKey === 'kg') rawVal = row.values?.['qty_kg'];
      }
      let computed: any = rawVal ?? '';
      if (typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'))) {
        computed = evaluateReconFormula(rawVal, colKey, rowIndex, reconRows, totalOB, totalReceipts, totalDisposals);
      }
      formulaText = rawVal !== undefined ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
      valueStr = typeof computed === 'number' ? formatNumberValue(computed, col.decimals, col.key) : (computed || '-');
    }

    return {
      address,
      sectionTag,
      colName: col.name,
      isCalculated,
      formulaText,
      value: valueStr,
    };
  }, [selectedCell, obColumns, receiptColumns, disposalColumns, reconColumns, obRows, receiptRows, disposalRows, reconRows, totalOB, totalReceipts, totalDisposals, viewDecimals]);

  // Loading data from API
  const loadMasterDefaults = useCallback((
    masterKey: string,
    mastersList: STGMasterDef[]
  ) => {
    const targetMaster = mastersList.find(m => m.key === masterKey);
    const standardCols = getDefaultSTGColumns();

    // Section Columns
    setObColumns(targetMaster?.ob_columns && targetMaster.ob_columns.length > 0
      ? targetMaster.ob_columns
      : (targetMaster?.custom_columns || standardCols));

    setReceiptColumns(targetMaster?.receipt_columns && targetMaster.receipt_columns.length > 0
      ? targetMaster.receipt_columns
      : (targetMaster?.custom_columns || standardCols));

    setDisposalColumns(targetMaster?.disposal_columns && targetMaster.disposal_columns.length > 0
      ? targetMaster.disposal_columns
      : (targetMaster?.custom_columns || standardCols));

    setReconColumns(targetMaster?.recon_columns && targetMaster.recon_columns.length > 0
      ? targetMaster.recon_columns
      : (targetMaster?.custom_columns || standardCols));

    // Section Rows
    // 1. Opening Balance Rows
    if (targetMaster?.ob_rows && Array.isArray(targetMaster.ob_rows) && targetMaster.ob_rows.length > 0) {
      setObRows(JSON.parse(JSON.stringify(targetMaster.ob_rows)));
    } else {
      const extractedOB = (targetMaster?.default_rows || targetMaster?.rows || []).filter((r: any) =>
        r.row_type === 'OB' || (r.variant || '').toLowerCase().includes('opening')
      );
      setObRows(extractedOB.length > 0 ? JSON.parse(JSON.stringify(extractedOB)) : [
        { variant: 'Opening Balance', row_type: 'OB', side: 'RECEIPT', values: {} }
      ]);
    }

    // 2. Receipt Rows
    if (targetMaster?.receipt_rows && Array.isArray(targetMaster.receipt_rows) && targetMaster.receipt_rows.length > 0) {
      setReceiptRows(JSON.parse(JSON.stringify(targetMaster.receipt_rows)));
    } else {
      const extractedRec = (targetMaster?.default_rows || targetMaster?.rows || []).filter((r: any) =>
        (r.row_type === 'RECEIPT' || r.side === 'RECEIPT') && r.row_type !== 'OB' && !(r.variant || '').toLowerCase().includes('opening')
      );
      setReceiptRows(extractedRec.length > 0 ? JSON.parse(JSON.stringify(extractedRec)) : [
        { variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: {} }
      ]);
    }

    // 3. Disposal Rows
    if (targetMaster?.disposal_rows && Array.isArray(targetMaster.disposal_rows) && targetMaster.disposal_rows.length > 0) {
      setDisposalRows(JSON.parse(JSON.stringify(targetMaster.disposal_rows)));
    } else {
      const extractedDisp = (targetMaster?.default_rows || targetMaster?.rows || []).filter((r: any) =>
        r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL'
      );
      setDisposalRows(extractedDisp.length > 0 ? JSON.parse(JSON.stringify(extractedDisp)) : [
        { variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} }
      ]);
    }

    // 4. Reconciliation Rows
    if (targetMaster?.reconciliation_rows && Array.isArray(targetMaster.reconciliation_rows) && targetMaster.reconciliation_rows.length > 0) {
      setReconRows(JSON.parse(JSON.stringify(targetMaster.reconciliation_rows)));
    } else {
      setReconRows(getDefaultReconRows());
    }

    setSelectedCell(null);
    setFocusedCell(null);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ts/masters');
      if (res.ok) {
        const json = await res.json();
        const loadedMasters: STGMasterDef[] = json.masters || [];
        setMasters(loadedMasters);

        if (loadedMasters.length > 0) {
          const initialKey = (paramMaster && loadedMasters.some(m => m.key === paramMaster))
            ? paramMaster
            : (activeMasterKey && loadedMasters.some(m => m.key === activeMasterKey)
              ? activeMasterKey
              : loadedMasters[0].key);
          setActiveMasterKey(initialKey);
          loadMasterDefaults(initialKey, loadedMasters);
        }
      }
    } catch (err) {
      console.error('Failed to load STG masters:', err);
    }
    setLoading(false);
  }, [activeMasterKey, paramMaster, loadMasterDefaults]);

  useEffect(() => {
    loadData();
  }, []);

  const handleSwitchMaster = (newKey: string) => {
    setActiveMasterKey(newKey);
    loadMasterDefaults(newKey, masters);
  };

  // Row Management Functions for Opening Balance (OB)
  const handleAddOBRow = () => {
    const newIdx = obRows.length + 1;
    setObRows(prev => [...prev, { variant: `Opening Stock ${newIdx}`, row_type: 'OB', side: 'RECEIPT', values: {} }]);
    setSelectedCell({ section: 'OB', rowIndex: obRows.length, colKey: obColumns[0]?.key || 'qty_lts' });
    showToast(`➕ Added Opening Balance Row #${newIdx}`);
  };

  const handleDeleteOBRow = async (idx: number) => {
    const rowToDelete = obRows[idx];
    const ok = await confirm({
      title: 'Delete Opening Balance Row',
      message: `Delete opening balance row "${rowToDelete?.variant || ''}"?`,
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    setObRows(prev => prev.filter((_, i) => i !== idx));
    if (selectedCell?.section === 'OB' && selectedCell.rowIndex === idx) setSelectedCell(null);
    showToast('Deleted opening balance row.');
  };

  const handleMoveOBRow = (idx: number, dir: 'UP' | 'DOWN') => {
    if (dir === 'UP' && idx === 0) return;
    if (dir === 'DOWN' && idx === obRows.length - 1) return;
    const targetIdx = dir === 'UP' ? idx - 1 : idx + 1;
    setObRows(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    if (selectedCell?.section === 'OB') setSelectedCell({ ...selectedCell, rowIndex: targetIdx });
  };

  const handleOBCellChange = (idx: number, colKey: string, val: string) => {
    setObRows(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      copy[idx] = { ...copy[idx], values: { ...copy[idx].values, [colKey]: val } };
      return copy;
    });
  };

  const handleOBVariantChange = (idx: number, val: string) => {
    setObRows(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      copy[idx] = { ...copy[idx], variant: val };
      return copy;
    });
  };

  // Row Management Functions for Receipts
  const handleAddReceiptRow = () => {
    const newIdx = receiptRows.length + 1;
    setReceiptRows(prev => [...prev, { variant: `Receipt ${newIdx}`, row_type: 'RECEIPT', side: 'RECEIPT', values: {} }]);
    setSelectedCell({ section: 'RECEIPT', rowIndex: receiptRows.length, colKey: receiptColumns[0]?.key || 'qty_lts' });
    showToast(`➕ Added Receipt Row #${newIdx}`);
  };

  const handleDeleteReceiptRow = async (idx: number) => {
    const rowToDelete = receiptRows[idx];
    const ok = await confirm({
      title: 'Delete Receipt Row',
      message: `Delete receipt row "${rowToDelete?.variant || ''}"?`,
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    setReceiptRows(prev => prev.filter((_, i) => i !== idx));
    if (selectedCell?.section === 'RECEIPT' && selectedCell.rowIndex === idx) setSelectedCell(null);
    showToast('Deleted receipt row.');
  };

  const handleMoveReceiptRow = (idx: number, dir: 'UP' | 'DOWN') => {
    if (dir === 'UP' && idx === 0) return;
    if (dir === 'DOWN' && idx === receiptRows.length - 1) return;
    const targetIdx = dir === 'UP' ? idx - 1 : idx + 1;
    setReceiptRows(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    if (selectedCell?.section === 'RECEIPT') setSelectedCell({ ...selectedCell, rowIndex: targetIdx });
  };

  const handleReceiptCellChange = (idx: number, colKey: string, val: string) => {
    setReceiptRows(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      copy[idx] = { ...copy[idx], values: { ...copy[idx].values, [colKey]: val } };
      return copy;
    });
  };

  const handleReceiptVariantChange = (idx: number, val: string) => {
    setReceiptRows(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      copy[idx] = { ...copy[idx], variant: val };
      return copy;
    });
  };

  // Row Management Functions for Disposals
  const handleAddDisposalRow = () => {
    const newIdx = disposalRows.length + 1;
    setDisposalRows(prev => [...prev, { variant: `Disposal ${newIdx}`, row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} }]);
    setSelectedCell({ section: 'DISPOSAL', rowIndex: disposalRows.length, colKey: disposalColumns[0]?.key || 'qty_lts' });
    showToast(`➕ Added Disposal Row #${newIdx}`);
  };

  const handleDeleteDisposalRow = async (idx: number) => {
    const rowToDelete = disposalRows[idx];
    const ok = await confirm({
      title: 'Delete Disposal Row',
      message: `Delete disposal row "${rowToDelete?.variant || ''}"?`,
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    setDisposalRows(prev => prev.filter((_, i) => i !== idx));
    if (selectedCell?.section === 'DISPOSAL' && selectedCell.rowIndex === idx) setSelectedCell(null);
    showToast('Deleted disposal row.');
  };

  const handleMoveDisposalRow = (idx: number, dir: 'UP' | 'DOWN') => {
    if (dir === 'UP' && idx === 0) return;
    if (dir === 'DOWN' && idx === disposalRows.length - 1) return;
    const targetIdx = dir === 'UP' ? idx - 1 : idx + 1;
    setDisposalRows(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    if (selectedCell?.section === 'DISPOSAL') setSelectedCell({ ...selectedCell, rowIndex: targetIdx });
  };

  const handleDisposalCellChange = (idx: number, colKey: string, val: string) => {
    setDisposalRows(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      copy[idx] = { ...copy[idx], values: { ...copy[idx].values, [colKey]: val } };
      return copy;
    });
  };

  const handleDisposalVariantChange = (idx: number, val: string) => {
    setDisposalRows(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      copy[idx] = { ...copy[idx], variant: val };
      return copy;
    });
  };

  // Row Management Functions for Reconciliation Summary
  const handleAddReconRow = () => {
    const newIdx = reconRows.length + 1;
    const newRow: STGReconRow = {
      id: `recon_${Date.now()}`,
      label: `Reconciliation Row ${newIdx}`,
      row_type: 'CUSTOM',
      is_formula: true,
      color_hint: 'default',
      values: {},
    };
    setReconRows(prev => [...prev, newRow]);
    const firstColKey = reconColumns.filter(c => c.key !== 'variant')[0]?.key || 'qty_lts';
    setSelectedCell({ section: 'RECON', rowIndex: reconRows.length, colKey: firstColKey });
    showToast(`➕ Added Reconciliation Row #${newIdx}`);
  };

  const handleDeleteReconRow = async (rIdx: number) => {
    const rowToDelete = reconRows[rIdx];
    const ok = await confirm({
      title: 'Delete Reconciliation Row',
      message: `Delete reconciliation row #${rIdx + 1} "${rowToDelete?.label || ''}"?`,
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    setReconRows(prev => prev.filter((_, idx) => idx !== rIdx));
    if (selectedCell?.section === 'RECON' && selectedCell.rowIndex === rIdx) setSelectedCell(null);
    showToast('Deleted reconciliation row.');
  };

  const handleMoveReconRow = (rIdx: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && rIdx === 0) return;
    if (direction === 'DOWN' && rIdx === reconRows.length - 1) return;
    const targetIdx = direction === 'UP' ? rIdx - 1 : rIdx + 1;
    setReconRows(prev => {
      const copy = [...prev];
      const temp = copy[rIdx];
      copy[rIdx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    if (selectedCell?.section === 'RECON') setSelectedCell({ ...selectedCell, rowIndex: targetIdx });
  };

  const handleReconCellChange = (rIdx: number, colKey: string, val: string) => {
    setReconRows(prev => {
      const copy = [...prev];
      if (!copy[rIdx]) return prev;
      const updatedVals = { ...copy[rIdx].values, [colKey]: val };
      if (colKey === 'qty_lts') updatedVals['lts'] = val;
      if (colKey === 'lts') updatedVals['qty_lts'] = val;
      if (colKey === 'qty_kg') updatedVals['kg'] = val;
      if (colKey === 'kg') updatedVals['qty_kg'] = val;
      copy[rIdx] = { ...copy[rIdx], values: updatedVals };
      return copy;
    });
  };

  const handleReconLabelChange = (rIdx: number, label: string) => {
    setReconRows(prev => {
      const copy = [...prev];
      if (!copy[rIdx]) return prev;
      copy[rIdx] = { ...copy[rIdx], label };
      return copy;
    });
  };

  const handleReconColorChange = (rIdx: number, color: STGReconRow['color_hint']) => {
    setReconRows(prev => {
      const copy = [...prev];
      if (!copy[rIdx]) return prev;
      copy[rIdx] = { ...copy[rIdx], color_hint: color };
      return copy;
    });
  };

  const handleResetReconTemplate = async () => {
    const ok = await confirm({
      title: 'Reset Reconciliation Summary Template',
      message: 'Reset reconciliation summary rows to the standard 8-row formulation template? Any custom formulas will be replaced.',
      confirmText: 'Reset to Standard',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!ok) return;
    setReconRows(getDefaultReconRows());
    showToast('Reset reconciliation summary to standard template.');
  };

  // Column Management Handlers for each section
  const handleToggleEditCols = (sec: STGSectionType) => {
    setEditingColsSections(prev => ({
      ...prev,
      [sec]: !prev[sec],
    }));
  };

  const handleOpenColConfigModal = (sec: STGSectionType) => {
    setColConfigSection(sec);
    setIsColConfigModalOpen(true);
  };

  const handleOpenAddColumn = (sec: STGSectionType, insertAtIdx?: number) => {
    setColModalSection(sec);
    setColModalEditingKey(null);
    setColModalInsertIdx(insertAtIdx !== undefined ? insertAtIdx : null);
    setFormColKey('');
    setColKeyManuallyEdited(false);
    setFormColName('');
    setFormColType('number');
    setFormColFormula('');
    setFormColUnit('');
    setFormColDecimals(undefined);
    setIsColModalOpen(true);
  };

  const handleOpenEditColumn = (sec: STGSectionType, col: STGColumnDef) => {
    setColModalSection(sec);
    setColModalEditingKey(col.key);
    setFormColKey(col.key);
    setColKeyManuallyEdited(true);
    setFormColName(col.name);
    setFormColType(col.type);
    setFormColFormula(col.formula || '');
    setFormColUnit(col.unit || '');
    setFormColDecimals(col.decimals);
    setIsColModalOpen(true);
  };

  const handleSaveColumnModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formColName.trim()) {
      showWarning('Please enter a column name');
      return;
    }
    const keyToUse = formColKey.trim() || formColName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const sec = colModalSection;
    const currentCols = getSectionColumns(sec);

    if (!colModalEditingKey && currentCols.some(c => c.key === keyToUse)) {
      showWarning(`Column with key "${keyToUse}" already exists in the ${sec} section!`);
      return;
    }

    const newCol: STGColumnDef = {
      key: keyToUse,
      name: formColName.trim(),
      type: formColType,
      formula: formColType === 'calculated' ? formColFormula.trim() : undefined,
      unit: formColUnit.trim() || undefined,
      decimals: formColDecimals,
      sort_order: colModalEditingKey
        ? (currentCols.find(c => c.key === colModalEditingKey)?.sort_order ?? currentCols.length)
        : (colModalInsertIdx !== null ? colModalInsertIdx + 1 : currentCols.length + 1),
      is_active: true,
    };

    let updatedCols: STGColumnDef[] = [];
    if (colModalEditingKey) {
      updatedCols = currentCols.map(c => (c.key === colModalEditingKey ? newCol : c));
      showToast(`✅ Updated column "${newCol.name}" in ${sec} section!`);
    } else if (colModalInsertIdx !== null && colModalInsertIdx >= 0) {
      const copy = [...currentCols];
      copy.splice(colModalInsertIdx, 0, newCol);
      updatedCols = copy.map((c, idx) => ({ ...c, sort_order: idx + 1 }));
      showToast(`✅ Inserted column "${newCol.name}" into ${sec} section!`);
    } else {
      updatedCols = [...currentCols, newCol].map((c, idx) => ({ ...c, sort_order: idx + 1 }));
      showToast(`✅ Added column "${newCol.name}" to ${sec} section!`);
    }

    setSectionColumns(sec, updatedCols);
    setIsColModalOpen(false);
  };

  const handleDeleteColumn = async (sec: STGSectionType, key: string) => {
    const currentCols = getSectionColumns(sec);
    const col = currentCols.find(c => c.key === key);
    if (!col) return;

    const ok = await confirm({
      title: `Delete Column from ${sec}`,
      message: `Are you sure you want to delete column "${col.name}" from the ${sec} section? Any row values in this column will be cleared.`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    const updatedCols = currentCols.filter(c => c.key !== key).map((c, idx) => ({ ...c, sort_order: idx + 1 }));
    setSectionColumns(sec, updatedCols);

    // Clear that key from rows of this section
    if (sec === 'OB') {
      setObRows(prev => prev.map(r => {
        const copy = { ...r.values };
        delete copy[key];
        return { ...r, values: copy };
      }));
    } else if (sec === 'RECEIPT') {
      setReceiptRows(prev => prev.map(r => {
        const copy = { ...r.values };
        delete copy[key];
        return { ...r, values: copy };
      }));
    } else if (sec === 'DISPOSAL') {
      setDisposalRows(prev => prev.map(r => {
        const copy = { ...r.values };
        delete copy[key];
        return { ...r, values: copy };
      }));
    } else if (sec === 'RECON') {
      setReconRows(prev => prev.map(r => {
        const copy = { ...r.values };
        delete copy[key];
        return { ...r, values: copy };
      }));
    }

    showToast(`Deleted column "${col.name}" from ${sec}.`);
  };

  const handleMoveColumn = (sec: STGSectionType, index: number, direction: 'LEFT' | 'RIGHT') => {
    const currentCols = getSectionColumns(sec);
    if (direction === 'LEFT' && index === 0) return;
    if (direction === 'RIGHT' && index === currentCols.length - 1) return;
    const targetIdx = direction === 'LEFT' ? index - 1 : index + 1;
    const copy = [...currentCols];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    const reindexed = copy.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setSectionColumns(sec, reindexed);
  };

  // Statement Master Management Handlers
  const handleStartEditMaster = (m: STGMasterDef) => {
    setEditingMasterKey(m.key);
    setEditMasterLabel(cleanStatementLabel(m.label || m.name || m.key));
    setEditMasterVariant(m.variant || (m as any).product_variant || '');
    setEditMasterDescription(m.description || '');
  };

  const handleCancelEditMaster = () => {
    setEditingMasterKey(null);
  };

  const handleSaveEditMaster = async () => {
    if (!editingMasterKey || !editMasterLabel.trim()) return;
    setSaving(true);
    const updatedMasters = masters.map(m => {
      if (m.key === editingMasterKey) {
        return {
          ...m,
          label: editMasterLabel.trim(),
          variant: editMasterVariant.trim().toUpperCase() || editMasterLabel.split(' ')[0],
          description: editMasterDescription.trim(),
        };
      }
      return m;
    });

    try {
      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: updatedMasters }),
      });
      if (res.ok) {
        setMasters(updatedMasters);
        setEditingMasterKey(null);
        showToast('✅ Statement Master updated successfully!');
      } else {
        showToast('❌ Failed to update Statement Master');
      }
    } catch {
      showToast('❌ Server error updating Statement Master');
    }
    setSaving(false);
  };

  const handleDeleteMaster = async (key: string, name: string) => {
    if (masters.length <= 1) {
      showWarning('Cannot delete the only statement master in the system.');
      return;
    }
    const isConfirmed = await confirm({
      title: 'Delete Statement Master',
      message: `Are you sure you want to delete Statement Master "${name}"? This will delete the statement and all its configured columns and formulation tables.`,
      confirmText: 'Delete Statement Master',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/ts/masters?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const updatedMasters = masters.filter(m => m.key !== key);
        setMasters(updatedMasters);
        if (activeMasterKey === key) {
          const nextKey = updatedMasters[0]?.key || null;
          setActiveMasterKey(nextKey);
          if (nextKey) loadMasterDefaults(nextKey, updatedMasters);
        }
        showToast(`✅ Deleted Statement Master "${name}"`);
      } else {
        showToast('❌ Failed to delete statement master');
      }
    } catch {
      showToast('❌ Server error deleting statement master');
    }
    setSaving(false);
  };

  const handleOpenNewMasterModal = () => {
    setNewMasterName('');
    setNewMasterKey('');
    setNewMasterKeyManuallyEdited(false);
    setNewMasterVariant('');
    setNewMasterDescription('');
    setNewMasterSource('blank');
    setNewMasterColsSource('default');
    setIsNewMasterModalOpen(true);
  };

  const handleCreateNewMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim()) {
      showWarning('Please enter a statement name');
      return;
    }
    const cleanLabel = cleanStatementLabel(newMasterName.trim());
    const keyToUse = (newMasterKey.trim() || cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
      .toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (masters.some(m => m.key === keyToUse)) {
      showWarning(`A Statement Master with key "${keyToUse}" already exists! Please choose a unique name or key.`);
      return;
    }

    const standardCols = getDefaultSTGColumns();
    let initOBCols: STGColumnDef[] = standardCols;
    let initRecCols: STGColumnDef[] = standardCols;
    let initDispCols: STGColumnDef[] = standardCols;
    let initReconCols: STGColumnDef[] = standardCols;

    let initOBRows: STGRowData[] = [{ variant: 'Opening Balance', row_type: 'OB', side: 'RECEIPT', values: {} }];
    let initRecRows: STGRowData[] = [{ variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: {} }];
    let initDispRows: STGRowData[] = [{ variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} }];
    let initReconRows: STGReconRow[] = getDefaultReconRows();

    if (newMasterSource !== 'blank') {
      const srcMaster = masters.find(m => m.key === newMasterSource);
      if (srcMaster) {
        if (srcMaster.ob_rows && srcMaster.ob_rows.length > 0) initOBRows = JSON.parse(JSON.stringify(srcMaster.ob_rows));
        if (srcMaster.receipt_rows && srcMaster.receipt_rows.length > 0) initRecRows = JSON.parse(JSON.stringify(srcMaster.receipt_rows));
        if (srcMaster.disposal_rows && srcMaster.disposal_rows.length > 0) initDispRows = JSON.parse(JSON.stringify(srcMaster.disposal_rows));
        if (srcMaster.reconciliation_rows && srcMaster.reconciliation_rows.length > 0) initReconRows = JSON.parse(JSON.stringify(srcMaster.reconciliation_rows));
      }
    }

    if (newMasterColsSource !== 'default') {
      const srcMaster = masters.find(m => m.key === newMasterColsSource);
      if (srcMaster) {
        if (srcMaster.ob_columns && srcMaster.ob_columns.length > 0) initOBCols = JSON.parse(JSON.stringify(srcMaster.ob_columns));
        if (srcMaster.receipt_columns && srcMaster.receipt_columns.length > 0) initRecCols = JSON.parse(JSON.stringify(srcMaster.receipt_columns));
        if (srcMaster.disposal_columns && srcMaster.disposal_columns.length > 0) initDispCols = JSON.parse(JSON.stringify(srcMaster.disposal_columns));
        if (srcMaster.recon_columns && srcMaster.recon_columns.length > 0) initReconCols = JSON.parse(JSON.stringify(srcMaster.recon_columns));
      }
    }

    const newMaster: STGMasterDef = {
      key: keyToUse,
      label: cleanLabel,
      variant: newMasterVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
      description: newMasterDescription.trim(),
      sort_order: masters.length + 1,
      ob_rows: initOBRows,
      receipt_rows: initRecRows,
      disposal_rows: initDispRows,
      reconciliation_rows: initReconRows,
      ob_columns: initOBCols,
      receipt_columns: initRecCols,
      disposal_columns: initDispCols,
      recon_columns: initReconCols,
      custom_columns: initRecCols,
      default_rows: [...initOBRows, ...initRecRows, ...initDispRows],
      rows: [...initOBRows, ...initRecRows, ...initDispRows],
    };

    setSaving(true);
    const updatedMasters = [...masters, newMaster];

    try {
      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: updatedMasters }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setIsNewMasterModalOpen(false);
        setActiveMasterKey(keyToUse);
        setObColumns(initOBCols);
        setReceiptColumns(initRecCols);
        setDisposalColumns(initDispCols);
        setReconColumns(initReconCols);
        setObRows(initOBRows);
        setReceiptRows(initRecRows);
        setDisposalRows(initDispRows);
        setReconRows(initReconRows);
        showToast(`✅ Created new Statement Master "${newMaster.label}" with separate section columns & rows!`);
      } else {
        showToast('❌ Failed to create statement master');
      }
    } catch {
      showToast('❌ Server error creating statement master');
    }
    setSaving(false);
  };

  // Save Master Default Formulation Template & Columns
  const handleSaveDefaultTemplate = async () => {
    if (!activeMasterKey) return;
    setSaving(true);

    try {
      const combinedRows = [
        ...obRows.map(r => ({ ...r, row_type: 'OB' as const, side: 'RECEIPT' as const })),
        ...receiptRows.map(r => ({ ...r, row_type: 'RECEIPT' as const, side: 'RECEIPT' as const })),
        ...disposalRows.map(r => ({ ...r, row_type: 'DISPOSAL' as const, side: 'DISPOSAL' as const })),
      ];

      const updatedMasters = masters.map(m => {
        if (m.key === activeMasterKey) {
          return {
            ...m,
            ob_rows: obRows,
            receipt_rows: receiptRows,
            disposal_rows: disposalRows,
            reconciliation_rows: reconRows,
            ob_columns: obColumns,
            receipt_columns: receiptColumns,
            disposal_columns: disposalColumns,
            recon_columns: reconColumns,
            custom_columns: receiptColumns,
            default_rows: combinedRows,
            rows: combinedRows,
          };
        }
        return m;
      });

      const [colRes, masterRes] = await Promise.all([
        fetch('/api/ts/columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columns: receiptColumns }),
        }),
        fetch('/api/ts/masters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masters: updatedMasters }),
        }),
      ]);

      if (colRes.ok && masterRes.ok) {
        setMasters(updatedMasters);
        showToast('✅ All 4 sections (Opening Balance, Receipts, Disposals, Reconciliation) and columns saved successfully to database!');
      } else {
        showToast('❌ Failed to save default formulation tables');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('❌ Server error saving default formulation tables');
    }
    setSaving(false);
  };

  // Renders one of the standard data sections: Opening Balance, Receipts, or Disposals
  const renderSectionTable = (
    sectionType: 'OB' | 'RECEIPT' | 'DISPOSAL',
    sectionTitle: string,
    sectionList: STGRowData[],
    sectionColumns: STGColumnDef[],
    bgColor: string,
    accentColor: string,
    icon: string,
    handleAddRowFn: () => void,
    handleDeleteRowFn: (idx: number) => void,
    handleMoveRowFn: (idx: number, dir: 'UP' | 'DOWN') => void,
    handleCellChangeFn: (idx: number, colKey: string, val: string) => void,
    handleVariantChangeFn: (idx: number, val: string) => void,
    sectionTotals: Record<string, number>
  ) => {
    const isEditCols = editingColsSections[sectionType];

    return (
      <div style={{ marginBottom: 24, border: `1px solid ${accentColor}40`, borderRadius: 8, overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Section Header Toolbar */}
        <div style={{ background: bgColor, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${accentColor}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: accentColor }}>
              {icon} {sectionTitle}
            </span>
            <span style={{ background: '#ffffff', border: `1px solid ${accentColor}60`, color: accentColor, borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>
              {sectionList.length} rows
            </span>
            <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
              {sectionColumns.length} columns
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Section Column Configuration Modal Button */}
            <button
              type="button"
              onClick={() => handleOpenColConfigModal(sectionType)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={`Configure all columns for ${sectionTitle}`}
            >
              ⚙️ Column Config
            </button>

            {/* Quick Insert Column for this section */}
            <button
              type="button"
              onClick={() => handleOpenAddColumn(sectionType)}
              style={{
                background: '#ffffff',
                border: `1px solid ${accentColor}80`,
                color: accentColor,
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title={`Add a new column specifically to ${sectionTitle}`}
            >
              ➕ Insert Column
            </button>

            {/* In-header Column Editing toggle */}
            <button
              type="button"
              onClick={() => handleToggleEditCols(sectionType)}
              style={{
                background: isEditCols ? `${accentColor}20` : '#ffffff',
                border: `1px solid ${accentColor}80`,
                color: accentColor,
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Toggle inline column header edit/delete controls"
            >
              {isEditCols ? '⚙️ Done Editing' : '✏️ Edit Columns'}
            </button>

            {/* Add Row Button */}
            <button
              type="button"
              onClick={handleAddRowFn}
              style={{
                background: accentColor,
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ➕ Add {sectionType === 'OB' ? 'OB' : sectionType === 'RECEIPT' ? 'Receipt' : 'Disposal'} Row
            </button>
          </div>
        </div>

        {/* Section Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ width: '100%', minWidth: 700, margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 44, textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>#</th>
                <th style={{ width: 220, textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {sectionType === 'OB' ? 'Opening Balance Particular' : sectionType === 'RECEIPT' ? 'Receipt Particular' : 'Disposal Particular'}
                </th>
                {sectionColumns.filter(c => c.key !== 'variant').map((col, cIdx) => (
                  <th
                    key={`th_${sectionType}_${col.key}`}
                    style={{
                      textAlign: col.type === 'text' ? 'left' : 'right',
                      background: col.type === 'calculated' ? '#e0f2fe' : '#f8fafc',
                      color: col.type === 'calculated' ? '#0369a1' : 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '0.78rem',
                      minWidth: 105,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.65rem', color: accentColor, fontWeight: 800, fontFamily: 'monospace' }}>
                        {getExcelColName(cIdx + 1)}
                      </span>

                      {/* Header controls when Edit Columns is active */}
                      {isEditCols && (
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button
                            type="button"
                            disabled={cIdx === 0}
                            onClick={() => handleMoveColumn(sectionType, cIdx, 'LEFT')}
                            style={{ padding: '0 3px', fontSize: '0.65rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2, cursor: 'pointer' }}
                            title="Move Column Left"
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            disabled={cIdx === sectionColumns.length - 1}
                            onClick={() => handleMoveColumn(sectionType, cIdx, 'RIGHT')}
                            style={{ padding: '0 3px', fontSize: '0.65rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2, cursor: 'pointer' }}
                            title="Move Column Right"
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditColumn(sectionType, col)}
                            style={{ padding: '0 3px', fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: 2, cursor: 'pointer' }}
                            title="Edit Column Properties"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(sectionType, col.key)}
                            style={{ padding: '0 3px', fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 2, cursor: 'pointer' }}
                            title="Delete Column"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.type === 'text' ? 'flex-start' : 'space-between', gap: 4 }}>
                      <span>{col.name} {col.unit ? `(${col.unit})` : ''}</span>
                    </div>
                  </th>
                ))}
                <th style={{ width: 110, textAlign: 'center', fontSize: '0.75rem' }}>Row Action</th>
              </tr>
            </thead>
            <tbody>
              {sectionList.length === 0 ? (
                <tr>
                  <td colSpan={sectionColumns.length + 2} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    No {sectionTitle.toLowerCase()} rows added yet. Click "+ Add {sectionType === 'OB' ? 'OB' : sectionType === 'RECEIPT' ? 'Receipt' : 'Disposal'} Row" above.
                  </td>
                </tr>
              ) : (
                sectionList.map((row, rIdx) => {
                  return (
                    <tr key={`row_${sectionType}_${rIdx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', background: '#fafafa' }}>
                        {rIdx + 1}
                      </td>

                      {/* Particular / Label Input */}
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={row.variant || ''}
                          placeholder={`Enter ${sectionTitle} Particular...`}
                          onChange={e => handleVariantChangeFn(rIdx, e.target.value)}
                          onFocus={() => {
                            setSelectedCell({ section: sectionType, rowIndex: rIdx, colKey: 'variant' });
                            setFocusedCell({ section: sectionType, rowIndex: rIdx, colKey: 'variant' });
                          }}
                          onBlur={() => setFocusedCell(null)}
                          style={{
                            height: 28,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            background: '#ffffff',
                            borderColor: 'var(--border)',
                          }}
                        />
                      </td>

                      {/* Dynamic Columns */}
                      {sectionColumns.filter(c => c.key !== 'variant').map(col => {
                        const isCellSelected = selectedCell?.section === sectionType && selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;
                        const computedVal = computeCell(col, row.values, rIdx, sectionList, sectionColumns);

                        if (col.type === 'calculated') {
                          const formattedCalc = typeof computedVal === 'number'
                            ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '-')
                            : (computedVal || '-');

                          return (
                            <td
                              key={`calc_cell_${rIdx}_${col.key}`}
                              onClick={() => setSelectedCell({ section: sectionType, rowIndex: rIdx, colKey: col.key })}
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: '#0369a1',
                                background: isCellSelected ? '#bae6fd' : '#f0f9ff',
                                fontFamily: 'var(--font-numbers)',
                                outline: isCellSelected ? '2px solid #0284c7' : 'none',
                                outlineOffset: -2,
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                              }}
                              title={`Calculated field: ${col.formula || 'Formula'} | Value: ${formattedCalc}`}
                            >
                              {formattedCalc}
                            </td>
                          );
                        }

                        const rawVal = row.values?.[col.key];
                        const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                        const displayVal = rawVal !== undefined ? rawVal : '';

                        return (
                          <td
                            key={`val_cell_${rIdx}_${col.key}`}
                            style={{
                              position: 'relative',
                              padding: 2,
                              background: isCellSelected ? '#fef3c7' : '#ffffff',
                            }}
                          >
                            <input
                              type="text"
                              className="form-input"
                              value={displayVal}
                              placeholder="-"
                              onFocus={() => {
                                setSelectedCell({ section: sectionType, rowIndex: rIdx, colKey: col.key });
                                setFocusedCell({ section: sectionType, rowIndex: rIdx, colKey: col.key });
                              }}
                              onBlur={() => setFocusedCell(null)}
                              onClick={() => setSelectedCell({ section: sectionType, rowIndex: rIdx, colKey: col.key })}
                              onChange={e => handleCellChangeFn(rIdx, col.key, e.target.value)}
                              style={{
                                padding: '3px 6px',
                                fontSize: '0.8rem',
                                height: 28,
                                textAlign: col.type === 'text' ? 'left' : 'right',
                                fontFamily: col.type === 'text' ? 'inherit' : 'var(--font-numbers)',
                                fontWeight: isFormula ? 800 : 700,
                                background: isCellSelected ? '#fef3c7' : isFormula ? '#fffbeb' : '#ffffff',
                                color: isFormula ? '#b45309' : 'var(--text-primary)',
                                borderColor: isCellSelected ? '#b45309' : isFormula ? '#fcd34d' : 'var(--border)',
                              }}
                            />
                          </td>
                        );
                      })}

                      {/* Row Action Buttons */}
                      <td style={{ textAlign: 'center', background: '#fafafa' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            type="button"
                            disabled={rIdx === 0}
                            onClick={() => handleMoveRowFn(rIdx, 'UP')}
                            style={{
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              cursor: rIdx === 0 ? 'not-allowed' : 'pointer',
                              opacity: rIdx === 0 ? 0.3 : 1,
                            }}
                            title="Move Row Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={rIdx === sectionList.length - 1}
                            onClick={() => handleMoveRowFn(rIdx, 'DOWN')}
                            style={{
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              cursor: rIdx === sectionList.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: rIdx === sectionList.length - 1 ? 0.3 : 1,
                            }}
                            title="Move Row Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRowFn(rIdx)}
                            style={{
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                            }}
                            title="Delete Row"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Row */}
              {sectionList.length > 0 && (
                <tr style={{ background: bgColor, borderTop: `2px solid ${accentColor}60`, fontWeight: 800 }}>
                  <td style={{ textAlign: 'center', color: accentColor, fontSize: '0.75rem' }}>Σ</td>
                  <td style={{ padding: '6px 8px', color: accentColor, fontSize: '0.82rem' }}>
                    Total {sectionTitle}
                  </td>
                  {sectionColumns.filter(c => c.key !== 'variant').map(col => {
                    const totalVal = sectionTotals[col.key];
                    return (
                      <td
                        key={`tot_${sectionType}_${col.key}`}
                        style={{
                          textAlign: col.type === 'text' ? 'left' : 'right',
                          padding: '6px 8px',
                          color: accentColor,
                          fontSize: '0.82rem',
                          fontFamily: col.type === 'text' ? 'inherit' : 'var(--font-numbers)',
                        }}
                      >
                        {col.type !== 'text' && totalVal !== undefined
                          ? (totalVal !== 0 ? formatNumberValue(totalVal, col.decimals, col.key) : '-')
                          : '-'}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', color: accentColor, fontSize: '0.72rem' }}>Total</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            background: '#0f172a',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Main Container Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {/* Top Control Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Statement Master Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              📋 Statement Master:
            </span>
            <select
              className="form-select"
              value={activeMasterKey || ''}
              onChange={e => handleSwitchMaster(e.target.value)}
              style={{ width: 260, fontWeight: 700, fontSize: '0.88rem', borderColor: '#0284c7', background: '#f0f9ff', color: '#0369a1' }}
            >
              {masters.map(m => (
                <option key={m.key} value={m.key}>
                  {cleanStatementLabel(m.label || m.name || m.key)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleOpenNewMasterModal}
              style={{
                background: '#0284c7',
                border: 'none',
                color: '#ffffff',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              ➕ Create Statement Master
            </button>

            <button
              type="button"
              onClick={() => setIsManageMastersModalOpen(true)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Manage Statement Master Names (Update, Delete, Insert)"
            >
              📋 Statement Master Names
            </button>
          </div>

          {/* Quick Add Row Shortcuts & Save Master Table */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleAddOBRow}
              style={{ background: '#2563eb', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Add a new row to Opening Balance"
            >
              ➕ Add OB Row
            </button>

            <button
              type="button"
              onClick={handleAddReceiptRow}
              style={{ background: '#16a34a', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Add a new row to Receipts"
            >
              ➕ Add Receipt Row
            </button>

            <button
              type="button"
              onClick={handleAddDisposalRow}
              style={{ background: '#ea580c', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Add a new row to Disposals"
            >
              ➕ Add Disposal Row
            </button>

            <button
              type="button"
              onClick={handleAddReconRow}
              style={{ background: '#7c3aed', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Add a new row to Reconciliation Summary"
            >
              ➕ Add Reconciliation Row
            </button>

            <button
              type="button"
              onClick={handleSaveDefaultTemplate}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ background: 'var(--primary)', fontWeight: 800, padding: '6px 14px' }}
            >
              {saving ? 'Saving Master...' : '⭐ Save Master Default Table'}
            </button>
          </div>
        </div>

        {/* Excel Formula Bar */}
        <div
          style={{
            padding: '8px 16px',
            background: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Active Cell Address Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid #fcd34d',
              fontWeight: 800,
              fontSize: '0.85rem',
              color: '#b45309',
              fontFamily: 'monospace',
              minWidth: 70,
              justifyContent: 'center',
            }}
          >
            <span>{activeCellDetails.address}</span>
          </div>

          <div
            style={{
              fontWeight: 900,
              fontSize: '1.05rem',
              color: '#b45309',
              fontStyle: 'italic',
              fontFamily: 'serif',
              userSelect: 'none',
            }}
          >
            ƒx
          </div>

          <div style={{ height: 20, width: 1, background: '#fcd34d' }} />

          {/* Active Section & Column Name Badge & Formula Input */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeCellDetails.sectionTag && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: '#fef3c7',
                  color: '#b45309',
                  padding: '2px 8px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {activeCellDetails.sectionTag} → {activeCellDetails.colName} {activeCellDetails.isCalculated ? '(Calculated)' : ''}
              </span>
            )}

            <input
              type="text"
              className="form-input"
              value={activeCellDetails.formulaText}
              readOnly={activeCellDetails.isCalculated}
              placeholder="Click any table cell across Opening Balance, Receipts, Disposals, or Reconciliation to view/edit formulas..."
              onChange={e => {
                if (!selectedCell || activeCellDetails.isCalculated) return;
                const { section, rowIndex, colKey } = selectedCell;
                if (section === 'OB') handleOBCellChange(rowIndex, colKey, e.target.value);
                else if (section === 'RECEIPT') handleReceiptCellChange(rowIndex, colKey, e.target.value);
                else if (section === 'DISPOSAL') handleDisposalCellChange(rowIndex, colKey, e.target.value);
                else if (section === 'RECON') handleReconCellChange(rowIndex, colKey, e.target.value);
              }}
              style={{
                flex: 1,
                fontSize: '0.85rem',
                fontFamily: 'var(--font-numbers)',
                fontWeight: 700,
                background: '#ffffff',
                color: activeCellDetails.formulaText.startsWith('=') ? '#b45309' : 'var(--text-primary)',
                borderColor: selectedCell ? '#b45309' : 'var(--border)',
                height: 30,
              }}
            />
          </div>

          {selectedCell && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.75rem',
                color: '#92400e',
                fontWeight: 700,
              }}
            >
              <span>Evaluated:</span>
              <span style={{ fontFamily: 'var(--font-numbers)', background: '#ffffff', padding: '2px 8px', borderRadius: 4, border: '1px solid #fcd34d' }}>
                {activeCellDetails.value}
              </span>
            </div>
          )}
        </div>

        {/* Content Body: Four Separate Sections */}
        <div style={{ padding: '20px 24px' }}>
          {/* Section 1: Opening Balance (OB) */}
          {renderSectionTable(
            'OB',
            'Opening Balance (OB)',
            obRows,
            obColumns,
            '#eff6ff',
            '#2563eb',
            '🌅',
            handleAddOBRow,
            handleDeleteOBRow,
            handleMoveOBRow,
            handleOBCellChange,
            handleOBVariantChange,
            totalOB
          )}

          {/* Section 2: Receipts */}
          {renderSectionTable(
            'RECEIPT',
            'Receipts',
            receiptRows,
            receiptColumns,
            '#f0fdf4',
            '#16a34a',
            '📥',
            handleAddReceiptRow,
            handleDeleteReceiptRow,
            handleMoveReceiptRow,
            handleReceiptCellChange,
            handleReceiptVariantChange,
            totalReceipts
          )}

          {/* Section 3: Disposals */}
          {renderSectionTable(
            'DISPOSAL',
            'Disposals',
            disposalRows,
            disposalColumns,
            '#fff7ed',
            '#ea580c',
            '📤',
            handleAddDisposalRow,
            handleDeleteDisposalRow,
            handleMoveDisposalRow,
            handleDisposalCellChange,
            handleDisposalVariantChange,
            totalDisposals
          )}

          {/* Section 4: Stock Balance & Reconciliation Summary (Auto-Computed) */}
          <div style={{ marginBottom: 24, border: '1px solid #7c3aed40', borderRadius: 8, overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Header */}
            <div style={{ background: '#faf5ff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #7c3aed30' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#6b21a8' }}>
                  ⚖️ Stock Balance & Reconciliation Summary (Auto-Computed)
                </span>
                <span style={{ background: '#ffffff', border: '1px solid #d8b4fe', color: '#6b21a8', borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {reconRows.length} rows
                </span>
                <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                  {reconColumns.length} columns
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Column Configuration Modal */}
                <button
                  type="button"
                  onClick={() => handleOpenColConfigModal('RECON')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Configure all columns for Reconciliation Summary"
                >
                  ⚙️ Column Config
                </button>

                {/* Insert Column */}
                <button
                  type="button"
                  onClick={() => handleOpenAddColumn('RECON')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d8b4fe',
                    color: '#7c3aed',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ➕ Insert Column
                </button>

                {/* Edit Columns Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleEditCols('RECON')}
                  style={{
                    background: editingColsSections.RECON ? '#ede9fe' : '#ffffff',
                    border: '1px solid #d8b4fe',
                    color: '#7c3aed',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {editingColsSections.RECON ? '⚙️ Done Editing' : '✏️ Edit Columns'}
                </button>

                {/* Reset Standard Template */}
                <button
                  type="button"
                  onClick={handleResetReconTemplate}
                  style={{
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Reset to default 8 standard reconciliation formula rows"
                >
                  ↺ Load Standard Template
                </button>

                {/* Add Recon Row */}
                <button
                  type="button"
                  onClick={handleAddReconRow}
                  style={{
                    background: '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  ➕ Add Reconciliation Row
                </button>
              </div>
            </div>

            {/* Reconciliation Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="inline-table" style={{ width: '100%', minWidth: 700, margin: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 44, textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>#</th>
                    <th style={{ width: 220, textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                      Reconciliation Item / Summary Label
                    </th>
                    <th style={{ width: 110, textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      Color Tint
                    </th>
                    {reconColumns.filter(c => c.key !== 'variant').map((col, cIdx) => (
                      <th
                        key={`recon_th_${col.key}`}
                        style={{
                          textAlign: col.type === 'text' ? 'left' : 'right',
                          background: col.type === 'calculated' ? '#e0f2fe' : '#f8fafc',
                          color: col.type === 'calculated' ? '#0369a1' : 'var(--text-primary)',
                          padding: '8px 10px',
                          fontSize: '0.78rem',
                          minWidth: 105,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 800, fontFamily: 'monospace' }}>
                            {getExcelColName(cIdx + 1)}
                          </span>

                          {editingColsSections.RECON && (
                            <div style={{ display: 'flex', gap: 2 }}>
                              <button
                                type="button"
                                disabled={cIdx === 0}
                                onClick={() => handleMoveColumn('RECON', cIdx, 'LEFT')}
                                style={{ padding: '0 3px', fontSize: '0.65rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2, cursor: 'pointer' }}
                                title="Move Column Left"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                disabled={cIdx === reconColumns.length - 1}
                                onClick={() => handleMoveColumn('RECON', cIdx, 'RIGHT')}
                                style={{ padding: '0 3px', fontSize: '0.65rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2, cursor: 'pointer' }}
                                title="Move Column Right"
                              >
                                ▶
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditColumn('RECON', col)}
                                style={{ padding: '0 3px', fontSize: '0.65rem', background: '#ede9fe', color: '#6b21a8', border: '1px solid #d8b4fe', borderRadius: 2, cursor: 'pointer' }}
                                title="Edit Column Properties"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn('RECON', col.key)}
                                style={{ padding: '0 3px', fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 2, cursor: 'pointer' }}
                                title="Delete Column"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.type === 'text' ? 'flex-start' : 'space-between', gap: 4 }}>
                          <span>{col.name} {col.unit ? `(${col.unit})` : ''}</span>
                        </div>
                      </th>
                    ))}
                    <th style={{ width: 140, textAlign: 'left', fontSize: '0.75rem', color: '#64748b' }}>Note / Description</th>
                    <th style={{ width: 110, textAlign: 'center', fontSize: '0.75rem' }}>Row Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reconRows.length === 0 ? (
                    <tr>
                      <td colSpan={reconColumns.length + 3} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                        No reconciliation rows configured yet. Click "➕ Add Reconciliation Row" or "↺ Load Standard Template" above.
                      </td>
                    </tr>
                  ) : (
                    reconRows.map((row, rIdx) => {
                      const rowColor = row.color_hint || 'default';
                      let rowBg = '#ffffff';
                      let rowTextColor = 'var(--text-primary)';
                      let rowBorderCol = '#f1f5f9';

                      if (rowColor === 'green') {
                        rowBg = '#f0fdf4';
                        rowTextColor = '#166534';
                        rowBorderCol = '#bbf7d0';
                      } else if (rowColor === 'blue') {
                        rowBg = '#eff6ff';
                        rowTextColor = '#1d4ed8';
                        rowBorderCol = '#bfdbfe';
                      } else if (rowColor === 'orange') {
                        rowBg = '#fff7ed';
                        rowTextColor = '#c2410c';
                        rowBorderCol = '#fed7aa';
                      } else if (rowColor === 'yellow') {
                        rowBg = '#fefce8';
                        rowTextColor = '#854d0e';
                        rowBorderCol = '#fef08a';
                      } else if (rowColor === 'purple') {
                        rowBg = '#faf5ff';
                        rowTextColor = '#6b21a8';
                        rowBorderCol = '#e9d5ff';
                      } else if (rowColor === 'dark') {
                        rowBg = '#f8fafc';
                        rowTextColor = '#0f172a';
                        rowBorderCol = '#cbd5e1';
                      }

                      return (
                        <tr key={`recon_row_${row.id || rIdx}`} style={{ borderBottom: `1px solid ${rowBorderCol}`, background: rowBg }}>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: rowTextColor, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            R{rIdx + 1}
                          </td>

                          {/* Editable Row Label */}
                          <td style={{ padding: '4px 8px' }}>
                            <input
                              type="text"
                              className="form-input"
                              value={row.label}
                              placeholder="Enter reconciliation row label..."
                              onChange={e => handleReconLabelChange(rIdx, e.target.value)}
                              style={{
                                height: 28,
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                background: '#ffffff',
                                borderColor: rowBorderCol !== '#f1f5f9' ? rowBorderCol : 'var(--border)',
                                color: rowTextColor,
                              }}
                            />
                          </td>

                          {/* Row Color Picker */}
                          <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <select
                              value={row.color_hint || 'default'}
                              onChange={e => handleReconColorChange(rIdx, e.target.value as any)}
                              style={{
                                height: 26,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                padding: '1px 4px',
                                background: '#ffffff',
                                color: '#334155',
                                cursor: 'pointer',
                                width: '100%',
                              }}
                              title="Row color highlight"
                            >
                              <option value="default">⚪ Default</option>
                              <option value="green">🟢 Green (Rec)</option>
                              <option value="blue">🔵 Blue (OB)</option>
                              <option value="orange">🟠 Orange (Disp)</option>
                              <option value="yellow">🟡 Yellow (CB)</option>
                              <option value="purple">🟣 Purple (Loss)</option>
                              <option value="dark">⚫ Dark (Total)</option>
                            </select>
                          </td>

                          {/* Dynamic Column Cells with Formulas */}
                          {reconColumns.filter(c => c.key !== 'variant').map(col => {
                            const isCellSelected = selectedCell?.section === 'RECON' && selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;
                            let rawVal = row.values?.[col.key];
                            if (rawVal === undefined) {
                              if (col.key === 'qty_lts') rawVal = row.values?.['lts'];
                              else if (col.key === 'lts') rawVal = row.values?.['qty_lts'];
                              else if (col.key === 'qty_kg') rawVal = row.values?.['kg'];
                              else if (col.key === 'kg') rawVal = row.values?.['qty_kg'];
                            }

                            const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                            let computedVal: any = rawVal ?? '';
                            if (isFormula) {
                              computedVal = evaluateReconFormula(rawVal, col.key, rIdx, reconRows, totalOB, totalReceipts, totalDisposals);
                            }

                            const displayFormatted = typeof computedVal === 'number'
                              ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '0')
                              : (computedVal || '-');

                            return (
                              <td
                                key={`recon_cell_${rIdx}_${col.key}`}
                                onClick={() => setSelectedCell({ section: 'RECON', rowIndex: rIdx, colKey: col.key })}
                                style={{
                                  position: 'relative',
                                  padding: 2,
                                  background: isCellSelected ? '#faf5ff' : 'transparent',
                                  outline: isCellSelected ? '2px solid #7c3aed' : 'none',
                                  outlineOffset: -2,
                                }}
                              >
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={rawVal ?? ''}
                                    placeholder={displayFormatted !== '-' ? String(displayFormatted) : '-'}
                                    onFocus={() => {
                                      setSelectedCell({ section: 'RECON', rowIndex: rIdx, colKey: col.key });
                                      setFocusedCell({ section: 'RECON', rowIndex: rIdx, colKey: col.key });
                                    }}
                                    onBlur={() => setFocusedCell(null)}
                                    onClick={() => setSelectedCell({ section: 'RECON', rowIndex: rIdx, colKey: col.key })}
                                    onChange={e => handleReconCellChange(rIdx, col.key, e.target.value)}
                                    title={isFormula ? `Formula: ${rawVal} | Value: ${displayFormatted}` : `Value: ${rawVal || '-'}`}
                                    style={{
                                      padding: isFormula ? '3px 22px 3px 6px' : '3px 6px',
                                      fontSize: '0.8rem',
                                      height: 28,
                                      textAlign: col.type === 'text' ? 'left' : 'right',
                                      fontFamily: col.type === 'text' ? 'inherit' : 'var(--font-numbers)',
                                      fontWeight: isFormula ? 800 : 700,
                                      background: isCellSelected ? '#f5f3ff' : isFormula ? '#faf5ff' : '#ffffff',
                                      color: isFormula ? '#6b21a8' : rowTextColor,
                                      borderColor: isCellSelected ? '#7c3aed' : isFormula ? '#d8b4fe' : 'var(--border)',
                                    }}
                                  />
                                  {isFormula && (
                                    <span
                                      style={{
                                        position: 'absolute',
                                        right: 4,
                                        fontSize: '0.62rem',
                                        fontWeight: 900,
                                        color: '#7c3aed',
                                        background: '#ede9fe',
                                        padding: '1px 3px',
                                        borderRadius: 3,
                                        fontFamily: 'serif',
                                        fontStyle: 'italic',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      fx
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Note / Description */}
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              type="text"
                              className="form-input"
                              value={row.values?.note ?? ''}
                              placeholder="Summary note..."
                              onChange={e => handleReconCellChange(rIdx, 'note', e.target.value)}
                              style={{
                                height: 28,
                                fontSize: '0.75rem',
                                padding: '3px 6px',
                                background: '#ffffff',
                                borderColor: 'var(--border)',
                              }}
                            />
                          </td>

                          {/* Row Actions */}
                          <td style={{ textAlign: 'center', background: '#fafafa' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button
                                type="button"
                                disabled={rIdx === 0}
                                onClick={() => handleMoveReconRow(rIdx, 'UP')}
                                style={{
                                  border: '1px solid var(--border)',
                                  background: '#ffffff',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  fontSize: '0.72rem',
                                  cursor: rIdx === 0 ? 'not-allowed' : 'pointer',
                                  opacity: rIdx === 0 ? 0.3 : 1,
                                }}
                                title="Move Row Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={rIdx === reconRows.length - 1}
                                onClick={() => handleMoveReconRow(rIdx, 'DOWN')}
                                style={{
                                  border: '1px solid var(--border)',
                                  background: '#ffffff',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  fontSize: '0.72rem',
                                  cursor: rIdx === reconRows.length - 1 ? 'not-allowed' : 'pointer',
                                  opacity: rIdx === reconRows.length - 1 ? 0.3 : 1,
                                }}
                                title="Move Row Down"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteReconRow(rIdx)}
                                style={{
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                }}
                                title="Delete Reconciliation Row"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Footer Bar */}
        <div style={{ padding: '12px 18px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            ⭐ Changes saved here will be stored in database as the Master Default Formulation Table for <b>{activeMasterKey}</b>.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/ts/manage-statements" className="btn btn-secondary btn-sm">
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSaveDefaultTemplate}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 800 }}
            >
              {saving ? 'Saving Changes...' : '⭐ Save Master Default Table'}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: Section Column Configuration Modal (view, reorder, edit, delete all columns for a section) */}
      {isColConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                  ⚙️ Column Configuration — {colConfigSection === 'OB' ? 'Opening Balance (OB)' : colConfigSection === 'RECEIPT' ? 'Receipts' : colConfigSection === 'DISPOSAL' ? 'Disposals' : 'Reconciliation Summary'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Manage, reorder, edit, and delete formulation columns specifically for this section.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsColConfigModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Column List */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <table className="inline-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 44, textAlign: 'center', fontSize: '0.75rem' }}>#</th>
                    <th style={{ textAlign: 'left', fontSize: '0.78rem', fontWeight: 800 }}>Column Name</th>
                    <th style={{ textAlign: 'left', fontSize: '0.78rem', fontWeight: 700 }}>Field Key</th>
                    <th style={{ textAlign: 'center', fontSize: '0.75rem', width: 100 }}>Type</th>
                    <th style={{ textAlign: 'left', fontSize: '0.75rem' }}>Formula / Unit</th>
                    <th style={{ textAlign: 'center', fontSize: '0.75rem', width: 70 }}>Decimals</th>
                    <th style={{ width: 140, textAlign: 'center', fontSize: '0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSectionColumns(colConfigSection).map((col, idx) => (
                    <tr key={`cfg_col_${col.key}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                        {col.name}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#0284c7' }}>
                        {col.key}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: col.type === 'calculated' ? '#e0f2fe' : col.type === 'number' ? '#f0fdf4' : '#f8fafc',
                          color: col.type === 'calculated' ? '#0369a1' : col.type === 'number' ? '#166534' : '#475569',
                        }}>
                          {col.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {col.formula ? `Formula: ${col.formula}` : (col.unit ? `Unit: ${col.unit}` : '—')}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.78rem', fontFamily: 'var(--font-numbers)' }}>
                        {col.decimals !== undefined ? col.decimals : 'Auto'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveColumn(colConfigSection, idx, 'LEFT')}
                            style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                            title="Move Column Up / Left"
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            disabled={idx === getSectionColumns(colConfigSection).length - 1}
                            onClick={() => handleMoveColumn(colConfigSection, idx, 'RIGHT')}
                            style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', opacity: idx === getSectionColumns(colConfigSection).length - 1 ? 0.3 : 1 }}
                            title="Move Column Down / Right"
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditColumn(colConfigSection, col)}
                            style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                            title="Edit Column"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(colConfigSection, col.key)}
                            style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                            title="Delete Column"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => handleOpenAddColumn(colConfigSection)}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 800 }}
              >
                ➕ Add New Column
              </button>

              <button
                type="button"
                onClick={() => setIsColConfigModalOpen(false)}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 800 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Insert or Edit Single Column Modal */}
      {isColModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 460, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 16, color: '#1e293b' }}>
              {colModalEditingKey ? `✏️ Edit Column (${colModalSection})` : `➕ Insert Column into ${colModalSection}`}
            </div>

            <form onSubmit={handleSaveColumnModal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Column Name / Label *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formColName}
                  placeholder="e.g. Qty (Lts), Fat%, Density..."
                  onChange={e => {
                    const val = e.target.value;
                    setFormColName(val);
                    if (!colKeyManuallyEdited && !colModalEditingKey) {
                      setFormColKey(val.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Field Key (internal identifier) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!colModalEditingKey}
                  className="form-input"
                  value={formColKey}
                  placeholder="e.g. qty_lts, fat_pct..."
                  onChange={e => {
                    setColKeyManuallyEdited(true);
                    setFormColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  style={{ fontFamily: 'monospace', background: colModalEditingKey ? '#f8fafc' : '#ffffff' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Data Type
                </label>
                <select
                  className="form-select"
                  value={formColType}
                  onChange={e => setFormColType(e.target.value as any)}
                >
                  <option value="number">Numeric (User-entered value)</option>
                  <option value="calculated">Calculated (Excel Formula)</option>
                  <option value="text">Text / Particular</option>
                </select>
              </div>

              {formColType === 'calculated' && (
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Calculation Formula
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formColFormula}
                    placeholder="e.g. qty_lts * sp_gr or =qty_kg * fat_pct / 100"
                    onChange={e => setFormColFormula(e.target.value)}
                    style={{ fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: 4 }}>
                    Use column field keys (e.g. <code>qty_lts * sp_gr</code> or <code>qty_kg * fat_pct / 100</code>).
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Decimal Places
                  </label>
                  <select
                    className="form-select"
                    value={formColDecimals !== undefined ? formColDecimals : ''}
                    onChange={e => setFormColDecimals(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                  >
                    <option value="">Auto Standard</option>
                    <option value="0">0 Whole (1,234)</option>
                    <option value="1">1 Dec (1,234.5)</option>
                    <option value="2">2 Decs (1,234.56)</option>
                    <option value="3">3 Decs (1,234.567)</option>
                    <option value="4">4 Decs (1.0285)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Unit (optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formColUnit}
                    placeholder="e.g. Lts, Kg, %..."
                    onChange={e => setFormColUnit(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsColModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 800 }}
                >
                  {colModalEditingKey ? 'Save Changes' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manage Statement Master Names Modal */}
      {isManageMastersModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                  📋 Manage Statement Master Names
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Update, delete, or create new Statement Master templates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsManageMastersModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <table className="inline-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 44, textAlign: 'center', fontSize: '0.75rem' }}>#</th>
                    <th style={{ textAlign: 'left', fontSize: '0.78rem', fontWeight: 800 }}>Statement Label</th>
                    <th style={{ textAlign: 'left', fontSize: '0.78rem', fontWeight: 700 }}>Identifier Key</th>
                    <th style={{ width: 140, textAlign: 'center', fontSize: '0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m, idx) => {
                    const isEditing = editingMasterKey === m.key;
                    const isActive = activeMasterKey === m.key;

                    return (
                      <tr key={m.key} style={{ borderBottom: '1px solid #f1f5f9', background: isActive ? '#f0f9ff' : '#ffffff' }}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editMasterLabel}
                              onChange={e => setEditMasterLabel(e.target.value)}
                              style={{ height: 28, fontSize: '0.82rem', fontWeight: 700 }}
                              autoFocus
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                                {cleanStatementLabel(m.label || m.name || m.key)}
                              </span>
                              {isActive && (
                                <span style={{ fontSize: '0.65rem', background: '#0284c7', color: '#ffffff', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                                  Active
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b' }}>
                          {m.key}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={handleSaveEditMaster}
                                disabled={saving}
                                style={{ background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditMaster}
                                style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditMaster(m)}
                                style={{ background: '#f1f5f9', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 4, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMaster(m.key, m.label || m.name || m.key)}
                                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => {
                  setIsManageMastersModalOpen(false);
                  handleOpenNewMasterModal();
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 800 }}
              >
                ➕ Create New Statement Master
              </button>

              <button
                type="button"
                onClick={() => setIsManageMastersModalOpen(false)}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 800 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Create Statement Master Modal */}
      {isNewMasterModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 480, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 16, color: '#1e293b' }}>
              ➕ Create New Statement Master
            </div>

            <form onSubmit={handleCreateNewMaster} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Statement Name *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newMasterName}
                  placeholder="e.g. BUTTER MILK STATEMENT"
                  onChange={e => {
                    const val = e.target.value;
                    setNewMasterName(val);
                    if (!newMasterKeyManuallyEdited) {
                      setNewMasterKey(val.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Identifier Key *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newMasterKey}
                  placeholder="e.g. butter_milk_statement"
                  onChange={e => {
                    setNewMasterKeyManuallyEdited(true);
                    setNewMasterKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Copy Initial Rows & Formulation Template From
                </label>
                <select
                  className="form-select"
                  value={newMasterSource}
                  onChange={e => setNewMasterSource(e.target.value)}
                >
                  <option value="blank">Empty Template (Start with blank OB, Receipt & Disposal rows)</option>
                  {masters.map(m => (
                    <option key={`src_${m.key}`} value={m.key}>
                      Copy from: {cleanStatementLabel(m.label || m.name || m.key)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Copy Configured Columns From
                </label>
                <select
                  className="form-select"
                  value={newMasterColsSource}
                  onChange={e => setNewMasterColsSource(e.target.value)}
                >
                  <option value="default">Standard TS Columns (Qty Lts, SP.G, Qty Kg, Fat%, Snf%, Kg Fat, Kg Snf)</option>
                  {masters.map(m => (
                    <option key={`col_src_${m.key}`} value={m.key}>
                      Copy from: {cleanStatementLabel(m.label || m.name || m.key)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsNewMasterModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 800 }}
                >
                  {saving ? 'Creating...' : 'Create Statement Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function STGDefaultFormulationsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Master Default Formulation Tables (STG)"
        subtitle="Manage Statement Masters, Configure Columns & Default Formulation Rows for Opening Balance, Receipts, Disposals, and Reconciliation"
      />
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Formulation Tables...</div>}>
        <STGDefaultFormulationsContent />
      </Suspense>
    </div>
  );
}
