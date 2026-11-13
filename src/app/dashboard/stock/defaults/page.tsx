'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { useMasters } from '@/hooks/useMasters';
import KeyField, { executeKeyRename } from '@/components/ui/KeyField';

export interface StockMasterDef {
  key: string;
  name: string;
  description?: string;
  is_default?: boolean;
  sort_order?: number;
}

export interface StockRowState {
  row_type: 'OB' | 'RECEIPT' | 'DISPOSAL';
  row_label: string;
  values: Record<string, string>;
}

export interface ProductColDef {
  key: string;
  label: string;
  category?: string;
  short_name?: string;
  full_name?: string;
}

export interface SummaryFormulasDef {
  total_receipts?: Record<string, string>;
  total_available?: Record<string, string>;
  total_disposals?: Record<string, string>;
  closing_balance?: Record<string, string>;
}

export interface StockTemplateDef {
  rows: StockRowState[];
  product_columns?: ProductColDef[];
  description?: string;
  summary_formulas?: SummaryFormulasDef;
}

export type StatementRowType =
  | 'OB'
  | 'RECEIPT'
  | 'TOTAL_RECEIPTS'
  | 'TOTAL_AVAILABLE'
  | 'DISPOSAL'
  | 'TOTAL_DISPOSALS'
  | 'CLOSING_BALANCE';

export interface SelectedCellInfo {
  rowType: StatementRowType;
  rowIndex?: number;
  rowLabel: string;
  colKey: string;
  excelAddress: string;
}

function getExcelColName(colIdx: number): string {
  let name = '';
  let n = colIdx;
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

export default function MasterDefaultStockStatementPage() {
  const { confirm, showWarning, showError } = useConfirm();
  const { categories: masterCategories } = useMasters();

  const [masters, setMasters] = useState<StockMasterDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, StockTemplateDef>>({});
  const [activeMasterKey, setActiveMasterKey] = useState<string>('daily_stock_statement');

  const [productColumns, setProductColumns] = useState<ProductColDef[]>([]);
  const [rows, setRows] = useState<StockRowState[]>([]);
  const [summaryFormulas, setSummaryFormulas] = useState<SummaryFormulasDef>({});

  const [defaultProducts, setDefaultProducts] = useState<ProductColDef[]>([]);
  const [dbReceiptRows, setDbReceiptRows] = useState<string[]>([]);
  const [dbDisposalRows, setDbDisposalRows] = useState<string[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active cell & formula bar state
  const [selectedCell, setSelectedCell] = useState<SelectedCellInfo | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowType: StatementRowType; rowIndex?: number; colKey: string } | null>(null);
  const [isColEditing, setIsColEditing] = useState<boolean>(false);
  const [viewDecimals, setViewDecimals] = useState<number | 'auto'>('auto');

  const formatDisplayVal = (val: number | string, decimals: number | 'auto'): string => {
    if (val === '' || val === undefined || val === null) {
      return decimals === 'auto' ? '0.00' : decimals === 0 ? '0' : (0).toFixed(decimals);
    }
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return typeof val === 'string' ? val : '0';
    if (decimals === 'auto') {
      return num.toFixed(2);
    }
    return num.toFixed(decimals);
  };

  // Modal State for Save As Separate Master Template
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState<boolean>(false);
  const [saveAsName, setSaveAsName] = useState<string>('');
  const [saveAsKey, setSaveAsKey] = useState<string>('');
  const [saveAsDescription, setSaveAsDescription] = useState<string>('');

  // Modal State for Creating a Brand New Master Template
  const [isNewMasterModalOpen, setIsNewMasterModalOpen] = useState<boolean>(false);
  const [newMasterName, setNewMasterName] = useState<string>('');
  const [newMasterKey, setNewMasterKey] = useState<string>('');
  const [newMasterDescription, setNewMasterDescription] = useState<string>('');
  const [newMasterSource, setNewMasterSource] = useState<'blank' | 'clone'>('clone');

  // Modal State for Adding / Editing Product Columns
  const [isColModalOpen, setIsColModalOpen] = useState<boolean>(false);
  const [colModalEditingKey, setColModalEditingKey] = useState<string | null>(null);
  const [formColKey, setFormColKey] = useState<string>('');
  const [formColName, setFormColName] = useState<string>('');
  const [formColCategory, setFormColCategory] = useState<string>('');

  // Modal for Adding Particular Row
  const [isParticularModalOpen, setIsParticularModalOpen] = useState<boolean>(false);
  const [particularSectionType, setParticularSectionType] = useState<'RECEIPT' | 'DISPOSAL'>('RECEIPT');
  const [particularLabel, setParticularLabel] = useState<string>('');

  // Modal for Configuring Formula
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState<boolean>(false);
  const [formulaModalTargetRow, setFormulaModalTargetRow] = useState<{ rowType: StatementRowType; rowLabel: string; rowIndex?: number } | null>(null);
  const [formulaModalColKey, setFormulaModalColKey] = useState<string>('__ALL__');
  const [formulaModalExpression, setFormulaModalExpression] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to build standard fallback rows
  const generateFallbackRows = (receipts: string[] = [], disposals: string[] = []): StockRowState[] => {
    return [
      { row_type: 'OB', row_label: 'Opening Balance', values: {} },
      ...receipts.map(label => ({ row_type: 'RECEIPT' as const, row_label: label, values: {} })),
      ...disposals.map(label => ({ row_type: 'DISPOSAL' as const, row_label: label, values: {} })),
    ];
  };

  // Fetch Templates & Masters from DB
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/templates');
      if (res.ok) {
        const json = await res.json();
        const loadedMasters: StockMasterDef[] = json.masters || [];
        setMasters(loadedMasters);

        const loadedTemplates: Record<string, StockTemplateDef> = json.templates || {};
        setTemplates(loadedTemplates);

        const loadedProds: ProductColDef[] = json.default_products || [];
        setDefaultProducts(loadedProds);

        const loadedRecs: string[] = json.default_receipt_rows || [];
        const loadedDisps: string[] = json.default_disposal_rows || [];
        setDbReceiptRows(loadedRecs);
        setDbDisposalRows(loadedDisps);

        // Determine active master
        const targetMasterKey = loadedMasters.length > 0 ? loadedMasters[0].key : 'daily_stock_statement';
        setActiveMasterKey(targetMasterKey);

        // Load active master template
        loadTemplateForMaster(targetMasterKey, loadedTemplates, loadedProds, loadedRecs, loadedDisps);
      }
    } catch (err) {
      console.error('Failed to load stock templates:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load a specific template into table state
  const loadTemplateForMaster = (
    masterKey: string,
    allTemplates: Record<string, StockTemplateDef>,
    fallbackProds: ProductColDef[] = [],
    fallbackRecs: string[] = [],
    fallbackDisps: string[] = []
  ) => {
    const tmpl = allTemplates[masterKey];
    if (tmpl && Array.isArray(tmpl.rows) && tmpl.rows.length > 0) {
      setRows(tmpl.rows.map(r => ({ row_type: r.row_type, row_label: r.row_label, values: { ...r.values } })));
      if (Array.isArray(tmpl.product_columns) && tmpl.product_columns.length > 0) {
        setProductColumns(tmpl.product_columns);
      } else {
        setProductColumns(fallbackProds);
      }
      if (tmpl.summary_formulas) {
        setSummaryFormulas(tmpl.summary_formulas);
      } else {
        setSummaryFormulas({});
      }
    } else {
      // Build default standard template from DB master fallback if available
      const initialRows = generateFallbackRows(fallbackRecs, fallbackDisps);
      setRows(initialRows);
      setProductColumns(fallbackProds);
      setSummaryFormulas({});
    }
    setIsDirty(false);
    setSelectedCell(null);
    setFocusedCell(null);
  };

  // Switch Master Tab
  const handleSwitchMaster = async (newKey: string) => {
    if (newKey === activeMasterKey) return;

    if (isDirty) {
      const confirmSwitch = await confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes in the current statement template. Do you want to discard them and switch to another template?',
        confirmText: 'Discard & Switch',
        cancelText: 'Stay on Current',
        type: 'warning',
      });
      if (!confirmSwitch) return;
    }

    setActiveMasterKey(newKey);
    loadTemplateForMaster(newKey, templates, defaultProducts, dbReceiptRows, dbDisposalRows);
  };

  // Currently active master definition
  const activeMaster = useMemo(() => {
    return masters.find(m => m.key === activeMasterKey) || {
      key: activeMasterKey,
      name: 'Standard Daily Stock Statement',
      description: 'Standard Daily Milk & Cream Stock Statement Entry Template',
    };
  }, [masters, activeMasterKey]);

  // Split rows into categories
  const obRow = useMemo(() => rows.find(r => r.row_type === 'OB'), [rows]);
  const obRowIndex = useMemo(() => rows.findIndex(r => r.row_type === 'OB'), [rows]);
  const receiptRows = useMemo(() => rows.filter(r => r.row_type === 'RECEIPT'), [rows]);
  const disposalRows = useMemo(() => rows.filter(r => r.row_type === 'DISPOSAL'), [rows]);

  // Excel Row Number Mapping
  const totalReceiptsRowNum = useMemo(() => 2 + receiptRows.length, [receiptRows.length]);
  const totalAvailableRowNum = useMemo(() => 3 + receiptRows.length, [receiptRows.length]);
  const totalDisposalsRowNum = useMemo(() => 4 + receiptRows.length + disposalRows.length, [receiptRows.length, disposalRows.length]);
  const closingBalanceRowNum = useMemo(() => 5 + receiptRows.length + disposalRows.length, [receiptRows.length, disposalRows.length]);

  // Default formula generators for column cIdx
  const getDefaultTotalReceiptsFormula = useCallback((cIdx: number) => {
    const colL = getExcelColName(cIdx);
    return receiptRows.length > 0 ? `=SUM(${colL}2:${colL}${1 + receiptRows.length})` : '=0';
  }, [receiptRows.length]);

  const getDefaultTotalAvailableFormula = useCallback((cIdx: number) => {
    const colL = getExcelColName(cIdx);
    return `=${colL}1+${colL}${totalReceiptsRowNum}`;
  }, [totalReceiptsRowNum]);

  const getDefaultTotalDisposalsFormula = useCallback((cIdx: number) => {
    const colL = getExcelColName(cIdx);
    const firstDisp = 4 + receiptRows.length;
    const lastDisp = 3 + receiptRows.length + disposalRows.length;
    return disposalRows.length > 0 ? `=SUM(${colL}${firstDisp}:${colL}${lastDisp})` : '=0';
  }, [receiptRows.length, disposalRows.length]);

  const getDefaultClosingBalanceFormula = useCallback((cIdx: number) => {
    const colL = getExcelColName(cIdx);
    return `=${colL}${totalAvailableRowNum}-${colL}${totalDisposalsRowNum}`;
  }, [totalAvailableRowNum, totalDisposalsRowNum]);

  // Handle cell value / formula change across ALL rows (OB, Receipts, Disposals, Totals, Balance)
  const handleCellFormulaChange = (
    rowType: StatementRowType,
    colKey: string,
    val: string,
    rowIndex?: number
  ) => {
    setIsDirty(true);
    if (rowType === 'OB' || rowType === 'RECEIPT' || rowType === 'DISPOSAL') {
      const idx = rowIndex !== undefined ? rowIndex : rows.findIndex(r => r.row_type === rowType);
      if (idx !== -1) {
        setRows(prev => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            values: { ...next[idx].values, [colKey]: val },
          };
          return next;
        });
      }
    } else {
      const sectionKey =
        rowType === 'TOTAL_RECEIPTS'
          ? 'total_receipts'
          : rowType === 'TOTAL_AVAILABLE'
            ? 'total_available'
            : rowType === 'TOTAL_DISPOSALS'
              ? 'total_disposals'
              : 'closing_balance';

      setSummaryFormulas(prev => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] || {}),
          [colKey]: val,
        },
      }));
    }
  };

  // Safe Excel Formula Evaluator
  const evaluateStockFormula = useCallback((
    formulaOrVal: string,
    colKey: string,
    cIdx: number,
    depth: number = 0
  ): number => {
    if (!formulaOrVal || typeof formulaOrVal !== 'string' || depth > 10) return 0;
    let expr = formulaOrVal.trim();
    if (!expr) return 0;

    // If not starting with '=' or '+', parse number directly
    if (!expr.startsWith('=') && !expr.startsWith('+')) {
      const num = parseFloat(expr);
      return isNaN(num) ? 0 : num;
    }

    if (expr.startsWith('=')) expr = expr.substring(1).trim();
    if (expr.startsWith('+')) expr = expr.substring(1).trim();
    if (!expr) return 0;

    const colLetter = getExcelColName(cIdx);

    // 1. Expand range syntax like SUM(A2:A5)
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
        const colL = getExcelColName(c);
        for (let r = minRow; r <= maxRow; r++) {
          cells.push(`${colL}${r}`);
        }
      }
      const func = fnName ? fnName.toUpperCase() : 'SUM';
      return `${func}(${cells.join(', ')})`;
    });

    // 2. Replace Excel cell references like A1, B4, C7
    expr = expr.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      let targetColIdx = 0;
      const upperLetters = colLetters.toUpperCase();
      for (let i = 0; i < upperLetters.length; i++) {
        targetColIdx = targetColIdx * 26 + (upperLetters.charCodeAt(i) - 64);
      }
      targetColIdx -= 1;

      const targetCol = productColumns[targetColIdx];
      if (!targetCol) return '0';
      const targetRowNum = parseInt(rowNumStr, 10);

      let targetFormulaOrVal = '0';
      if (targetRowNum === 1) {
        targetFormulaOrVal = obRow?.values?.[targetCol.key] || '0';
      } else if (targetRowNum >= 2 && targetRowNum <= 1 + receiptRows.length) {
        const rIdx = targetRowNum - 2;
        targetFormulaOrVal = receiptRows[rIdx]?.values?.[targetCol.key] || '0';
      } else if (targetRowNum === totalReceiptsRowNum) {
        targetFormulaOrVal = summaryFormulas.total_receipts?.[targetCol.key] || getDefaultTotalReceiptsFormula(targetColIdx);
      } else if (targetRowNum === totalAvailableRowNum) {
        targetFormulaOrVal = summaryFormulas.total_available?.[targetCol.key] || getDefaultTotalAvailableFormula(targetColIdx);
      } else if (targetRowNum >= 4 + receiptRows.length && targetRowNum <= 3 + receiptRows.length + disposalRows.length) {
        const dIdx = targetRowNum - (4 + receiptRows.length);
        targetFormulaOrVal = disposalRows[dIdx]?.values?.[targetCol.key] || '0';
      } else if (targetRowNum === totalDisposalsRowNum) {
        targetFormulaOrVal = summaryFormulas.total_disposals?.[targetCol.key] || getDefaultTotalDisposalsFormula(targetColIdx);
      } else if (targetRowNum === closingBalanceRowNum) {
        targetFormulaOrVal = summaryFormulas.closing_balance?.[targetCol.key] || getDefaultClosingBalanceFormula(targetColIdx);
      }

      const evaluated = evaluateStockFormula(targetFormulaOrVal, targetCol.key, targetColIdx, depth + 1);
      return String(evaluated);
    });

    // 3. Replace semantic row tokens: [OB], [RECEIPTS], [TOTAL_RECEIPTS], [AVAILABLE], [TOTAL_AVAILABLE], [DISPOSALS], [TOTAL_DISPOSALS], [CLOSING_BALANCE], [CB]
    if (expr.includes('[OB]') || /\bOB\b/i.test(expr)) {
      const obVal = evaluateStockFormula(obRow?.values?.[colKey] || '0', colKey, cIdx, depth + 1);
      expr = expr.replace(/\[OB\]/gi, String(obVal)).replace(/\bOB\b/gi, String(obVal));
    }
    if (expr.includes('[TOTAL_RECEIPTS]') || expr.includes('[RECEIPTS]') || /\bTOTAL_RECEIPTS\b/i.test(expr)) {
      const totRecForm = summaryFormulas.total_receipts?.[colKey] || getDefaultTotalReceiptsFormula(cIdx);
      const recVal = evaluateStockFormula(totRecForm, colKey, cIdx, depth + 1);
      expr = expr.replace(/\[TOTAL_RECEIPTS\]/gi, String(recVal)).replace(/\[RECEIPTS\]/gi, String(recVal)).replace(/\bTOTAL_RECEIPTS\b/gi, String(recVal));
    }
    if (expr.includes('[TOTAL_AVAILABLE]') || expr.includes('[AVAILABLE]') || /\bTOTAL_AVAILABLE\b/i.test(expr)) {
      const totAvailForm = summaryFormulas.total_available?.[colKey] || getDefaultTotalAvailableFormula(cIdx);
      const availVal = evaluateStockFormula(totAvailForm, colKey, cIdx, depth + 1);
      expr = expr.replace(/\[TOTAL_AVAILABLE\]/gi, String(availVal)).replace(/\[AVAILABLE\]/gi, String(availVal)).replace(/\bTOTAL_AVAILABLE\b/gi, String(availVal));
    }
    if (expr.includes('[TOTAL_DISPOSALS]') || expr.includes('[DISPOSALS]') || /\bTOTAL_DISPOSALS\b/i.test(expr)) {
      const totDispForm = summaryFormulas.total_disposals?.[colKey] || getDefaultTotalDisposalsFormula(cIdx);
      const dispVal = evaluateStockFormula(totDispForm, colKey, cIdx, depth + 1);
      expr = expr.replace(/\[TOTAL_DISPOSALS\]/gi, String(dispVal)).replace(/\[DISPOSALS\]/gi, String(dispVal)).replace(/\bTOTAL_DISPOSALS\b/gi, String(dispVal));
    }
    if (expr.includes('[CLOSING_BALANCE]') || expr.includes('[CB]') || /\bCLOSING_BALANCE\b/i.test(expr)) {
      const cbForm = summaryFormulas.closing_balance?.[colKey] || getDefaultClosingBalanceFormula(cIdx);
      const cbVal = evaluateStockFormula(cbForm, colKey, cIdx, depth + 1);
      expr = expr.replace(/\[CLOSING_BALANCE\]/gi, String(cbVal)).replace(/\[CB\]/gi, String(cbVal)).replace(/\bCLOSING_BALANCE\b/gi, String(cbVal));
    }

    // 4. Replace product column key tokens if any exist
    productColumns.forEach(c => {
      if (expr.includes(c.key)) {
        const val = evaluateStockFormula(obRow?.values?.[c.key] || '0', c.key, cIdx, depth + 1);
        expr = expr.replaceAll(c.key, String(val));
      }
    });

    // 5. Evaluate clean mathematical expression
    try {
      let cleanExpr = expr.replace(/[^0-9.\-+\/*%() ,a-zA-Z]/g, '').trim();
      cleanExpr = cleanExpr.replace(/[\-+\/*%,]+$/g, '').trim();
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
  }, [
    productColumns,
    obRow,
    receiptRows,
    disposalRows,
    totalReceiptsRowNum,
    totalAvailableRowNum,
    totalDisposalsRowNum,
    closingBalanceRowNum,
    summaryFormulas,
    getDefaultTotalReceiptsFormula,
    getDefaultTotalAvailableFormula,
    getDefaultTotalDisposalsFormula,
    getDefaultClosingBalanceFormula,
  ]);

  // Live row calculations across all rows & summary rows
  const calculatedRows = useMemo(() => {
    const obValues: Record<string, number> = {};
    const receiptValues: Record<string, number>[] = receiptRows.map(() => ({}));
    const totalReceiptsValues: Record<string, number> = {};
    const totalAvailableValues: Record<string, number> = {};
    const disposalValues: Record<string, number>[] = disposalRows.map(() => ({}));
    const totalDisposalsValues: Record<string, number> = {};
    const closingBalanceValues: Record<string, number> = {};

    productColumns.forEach((col, cIdx) => {
      // 1. OB
      const obRaw = obRow?.values?.[col.key] || '0';
      obValues[col.key] = evaluateStockFormula(obRaw, col.key, cIdx);

      // 2. Receipts
      receiptRows.forEach((r, rIdx) => {
        const raw = r.values?.[col.key] || '0';
        receiptValues[rIdx][col.key] = evaluateStockFormula(raw, col.key, cIdx);
      });

      // 3. Total Receipts
      const totRecForm = summaryFormulas.total_receipts?.[col.key] || getDefaultTotalReceiptsFormula(cIdx);
      totalReceiptsValues[col.key] = evaluateStockFormula(totRecForm, col.key, cIdx);

      // 4. Total Available
      const totAvailForm = summaryFormulas.total_available?.[col.key] || getDefaultTotalAvailableFormula(cIdx);
      totalAvailableValues[col.key] = evaluateStockFormula(totAvailForm, col.key, cIdx);

      // 5. Disposals
      disposalRows.forEach((r, dIdx) => {
        const raw = r.values?.[col.key] || '0';
        disposalValues[dIdx][col.key] = evaluateStockFormula(raw, col.key, cIdx);
      });

      // 6. Total Disposals
      const totDispForm = summaryFormulas.total_disposals?.[col.key] || getDefaultTotalDisposalsFormula(cIdx);
      totalDisposalsValues[col.key] = evaluateStockFormula(totDispForm, col.key, cIdx);

      // 7. Closing Balance
      const cbForm = summaryFormulas.closing_balance?.[col.key] || getDefaultClosingBalanceFormula(cIdx);
      closingBalanceValues[col.key] = evaluateStockFormula(cbForm, col.key, cIdx);
    });

    return {
      obValues,
      receiptValues,
      totalReceiptsValues,
      totalAvailableValues,
      disposalValues,
      totalDisposalsValues,
      closingBalanceValues,
    };
  }, [
    productColumns,
    obRow,
    receiptRows,
    disposalRows,
    summaryFormulas,
    evaluateStockFormula,
    getDefaultTotalReceiptsFormula,
    getDefaultTotalAvailableFormula,
    getDefaultTotalDisposalsFormula,
    getDefaultClosingBalanceFormula,
  ]);

  // Compute horizontal sum across all product columns for a values record
  const getHorizontalSum = (valuesMap: Record<string, any>): number => {
    return productColumns.reduce((sum, c) => {
      const v = valuesMap[c.key];
      const n = typeof v === 'number' ? v : (parseFloat(v || '0') || 0);
      return sum + n;
    }, 0);
  };

  // Active cell details for Excel formula bar
  const activeCellDetails = useMemo(() => {
    if (!selectedCell) return { address: '', colLabel: '', rowLabel: '', value: '', formulaText: '' };
    const { rowType, rowIndex, rowLabel, colKey, excelAddress } = selectedCell;
    const colDef = productColumns.find(c => c.key === colKey);
    const colIdx = productColumns.findIndex(c => c.key === colKey);

    let rawVal = '';
    let calcVal = 0;

    if (rowType === 'OB') {
      rawVal = obRow?.values?.[colKey] || '';
      calcVal = calculatedRows.obValues[colKey] || 0;
    } else if (rowType === 'RECEIPT' && rowIndex !== undefined) {
      rawVal = rows[rowIndex]?.values?.[colKey] || '';
      const rIdx = receiptRows.findIndex(r => r === rows[rowIndex]);
      calcVal = rIdx !== -1 ? (calculatedRows.receiptValues[rIdx]?.[colKey] || 0) : 0;
    } else if (rowType === 'TOTAL_RECEIPTS') {
      rawVal = summaryFormulas.total_receipts?.[colKey] || (colIdx >= 0 ? getDefaultTotalReceiptsFormula(colIdx) : '');
      calcVal = calculatedRows.totalReceiptsValues[colKey] || 0;
    } else if (rowType === 'TOTAL_AVAILABLE') {
      rawVal = summaryFormulas.total_available?.[colKey] || (colIdx >= 0 ? getDefaultTotalAvailableFormula(colIdx) : '');
      calcVal = calculatedRows.totalAvailableValues[colKey] || 0;
    } else if (rowType === 'DISPOSAL' && rowIndex !== undefined) {
      rawVal = rows[rowIndex]?.values?.[colKey] || '';
      const dIdx = disposalRows.findIndex(r => r === rows[rowIndex]);
      calcVal = dIdx !== -1 ? (calculatedRows.disposalValues[dIdx]?.[colKey] || 0) : 0;
    } else if (rowType === 'TOTAL_DISPOSALS') {
      rawVal = summaryFormulas.total_disposals?.[colKey] || (colIdx >= 0 ? getDefaultTotalDisposalsFormula(colIdx) : '');
      calcVal = calculatedRows.totalDisposalsValues[colKey] || 0;
    } else if (rowType === 'CLOSING_BALANCE') {
      rawVal = summaryFormulas.closing_balance?.[colKey] || (colIdx >= 0 ? getDefaultClosingBalanceFormula(colIdx) : '');
      calcVal = calculatedRows.closingBalanceValues[colKey] || 0;
    }

    return {
      address: excelAddress,
      colLabel: colDef ? colDef.label : colKey,
      rowLabel,
      value: calcVal !== 0 ? formatDisplayVal(calcVal, viewDecimals) : (rawVal || formatDisplayVal(0, viewDecimals)),
      formulaText: rawVal || '',
    };
  }, [
    selectedCell,
    rows,
    obRow,
    receiptRows,
    disposalRows,
    productColumns,
    summaryFormulas,
    calculatedRows,
    viewDecimals,
    getDefaultTotalReceiptsFormula,
    getDefaultTotalAvailableFormula,
    getDefaultTotalDisposalsFormula,
    getDefaultClosingBalanceFormula,
  ]);

  // Open Formula Configuration Modal
  const handleOpenFormulaModal = (
    rowType: StatementRowType,
    rowLabel: string,
    rowIndex?: number
  ) => {
    setFormulaModalTargetRow({ rowType, rowLabel, rowIndex });
    setFormulaModalColKey('__ALL__');

    // Preset initial expression based on rowType
    if (rowType === 'TOTAL_RECEIPTS') {
      setFormulaModalExpression('=SUM(RECEIPTS)');
    } else if (rowType === 'TOTAL_AVAILABLE') {
      setFormulaModalExpression('=[OB] + [TOTAL_RECEIPTS]');
    } else if (rowType === 'TOTAL_DISPOSALS') {
      setFormulaModalExpression('=SUM(DISPOSALS)');
    } else if (rowType === 'CLOSING_BALANCE') {
      setFormulaModalExpression('=[TOTAL_AVAILABLE] - [TOTAL_DISPOSALS]');
    } else {
      setFormulaModalExpression('');
    }

    setIsFormulaModalOpen(true);
  };

  // Apply Formula Configuration from Modal
  const handleApplyFormulaModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaModalTargetRow) return;

    const { rowType, rowIndex, rowLabel } = formulaModalTargetRow;
    const expr = formulaModalExpression.trim();

    setIsDirty(true);

    if (formulaModalColKey === '__ALL__') {
      // Apply to all product columns
      productColumns.forEach((c, cIdx) => {
        let colExpr = expr;
        // If user typed generic keywords or relative formulas, we can customize per column
        if (expr === '=SUM(RECEIPTS)') {
          colExpr = getDefaultTotalReceiptsFormula(cIdx);
        } else if (expr === '=[OB] + [TOTAL_RECEIPTS]') {
          colExpr = getDefaultTotalAvailableFormula(cIdx);
        } else if (expr === '=SUM(DISPOSALS)') {
          colExpr = getDefaultTotalDisposalsFormula(cIdx);
        } else if (expr === '=[TOTAL_AVAILABLE] - [TOTAL_DISPOSALS]') {
          colExpr = getDefaultClosingBalanceFormula(cIdx);
        }
        handleCellFormulaChange(rowType, c.key, colExpr, rowIndex);
      });
      showToast(`✅ Applied formula to all columns for "${rowLabel}"!`);
    } else {
      // Apply to specific column
      handleCellFormulaChange(rowType, formulaModalColKey, expr, rowIndex);
      const col = productColumns.find(c => c.key === formulaModalColKey);
      showToast(`✅ Applied formula for "${rowLabel}" (${col?.label || formulaModalColKey})!`);
    }

    setIsFormulaModalOpen(false);
  };

  // Reset Formula to System Default
  const handleResetFormulaToDefault = () => {
    if (!formulaModalTargetRow) return;
    const { rowType, rowIndex, rowLabel } = formulaModalTargetRow;
    setIsDirty(true);

    if (rowType === 'OB' || rowType === 'RECEIPT' || rowType === 'DISPOSAL') {
      if (formulaModalColKey === '__ALL__') {
        productColumns.forEach(c => handleCellFormulaChange(rowType, c.key, '', rowIndex));
      } else {
        handleCellFormulaChange(rowType, formulaModalColKey, '', rowIndex);
      }
    } else {
      const sectionKey =
        rowType === 'TOTAL_RECEIPTS'
          ? 'total_receipts'
          : rowType === 'TOTAL_AVAILABLE'
            ? 'total_available'
            : rowType === 'TOTAL_DISPOSALS'
              ? 'total_disposals'
              : 'closing_balance';

      if (formulaModalColKey === '__ALL__') {
        setSummaryFormulas(prev => {
          const next = { ...prev };
          delete next[sectionKey];
          return next;
        });
      } else {
        setSummaryFormulas(prev => {
          const next = { ...prev };
          if (next[sectionKey]) {
            const copy = { ...next[sectionKey] };
            delete copy[formulaModalColKey];
            next[sectionKey] = copy;
          }
          return next;
        });
      }
    }

    showToast(`🔄 Reset formula to system default for "${rowLabel}"!`);
    setIsFormulaModalOpen(false);
  };

  // Save current template to Database
  const handleSaveCurrentTemplate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/stock/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            master_key: activeMasterKey,
            rows,
            product_columns: productColumns,
            summary_formulas: summaryFormulas,
            description: activeMaster.description || `Template for ${activeMaster.name}`,
          },
        }),
      });

      if (res.ok) {
        // Update local template map
        setTemplates(prev => ({
          ...prev,
          [activeMasterKey]: {
            rows,
            product_columns: productColumns,
            summary_formulas: summaryFormulas,
            description: activeMaster.description,
          },
        }));
        setIsDirty(false);
        showToast(`✅ Saved default master template for "${activeMaster.name}" to Database!`);
      } else {
        showToast('❌ Failed to save statement template to Database');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      showToast('❌ Server error saving statement template');
    }
    setSaving(false);
  };

  // Open "Save As" Modal
  const handleOpenSaveAs = () => {
    const baseKey = activeMasterKey.replace(/_template$/, '');
    const candidateKey = `${baseKey}_copy_${Date.now().toString().slice(-4)}`;
    setSaveAsKey(candidateKey);
    setSaveAsName(`${activeMaster.name} (Copy)`);
    setSaveAsDescription(activeMaster.description || '');
    setIsSaveAsModalOpen(true);
  };

  // Submit "Save As" Modal
  const handleConfirmSaveAs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveAsName.trim() || !saveAsKey.trim()) {
      showWarning('Name and Key Required', 'Please enter a valid Template Name and Key.');
      return;
    }

    const cleanKey = saveAsKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (masters.some(m => m.key === cleanKey)) {
      showWarning('Duplicate Key', `A master template with key "${cleanKey}" already exists.`);
      return;
    }

    const newMaster: StockMasterDef = {
      key: cleanKey,
      name: saveAsName.trim(),
      description: saveAsDescription.trim() || `Master Statement template for ${saveAsName.trim()}`,
      sort_order: masters.length + 1,
    };

    const updatedMasters = [...masters, newMaster];
    const newTemplate: StockTemplateDef = {
      rows: rows.map(r => ({ ...r, values: { ...r.values } })),
      product_columns: [...productColumns],
      summary_formulas: JSON.parse(JSON.stringify(summaryFormulas)),
      description: newMaster.description,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/stock/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masters: updatedMasters,
          template: {
            master_key: cleanKey,
            rows: newTemplate.rows,
            product_columns: newTemplate.product_columns,
            summary_formulas: newTemplate.summary_formulas,
            description: newTemplate.description,
          },
        }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setTemplates(prev => ({ ...prev, [cleanKey]: newTemplate }));
        setActiveMasterKey(cleanKey);
        setIsDirty(false);
        setIsSaveAsModalOpen(false);
        showToast(`✅ Created and switched to new Master Template "${newMaster.name}"!`);
      } else {
        showToast('❌ Failed to save new master template');
      }
    } catch (err) {
      console.error('Error saving as new master:', err);
      showToast('❌ Server error saving new master template');
    }
    setSaving(false);
  };

  // Open "New Master" Modal
  const handleOpenNewMaster = () => {
    setNewMasterKey(`stock_statement_${Date.now().toString().slice(-4)}`);
    setNewMasterName('New Stock Statement Template');
    setNewMasterDescription('Custom Milk & Cream Stock Statement formulation template');
    setNewMasterSource('clone');
    setIsNewMasterModalOpen(true);
  };

  // Submit "New Master" Modal
  const handleConfirmNewMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim() || !newMasterKey.trim()) {
      showWarning('Name and Key Required', 'Please enter a valid Template Name and Key.');
      return;
    }

    const cleanKey = newMasterKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (masters.some(m => m.key === cleanKey)) {
      showWarning('Duplicate Key', `A master with key "${cleanKey}" already exists.`);
      return;
    }

    const newMaster: StockMasterDef = {
      key: cleanKey,
      name: newMasterName.trim(),
      description: newMasterDescription.trim(),
      sort_order: masters.length + 1,
    };

    const newRows = newMasterSource === 'clone'
      ? rows.map(r => ({ ...r, values: { ...r.values } }))
      : generateFallbackRows(dbReceiptRows, dbDisposalRows);

    const newCols = newMasterSource === 'clone'
      ? [...productColumns]
      : [...defaultProducts];

    const newSummaryFormulas = newMasterSource === 'clone'
      ? JSON.parse(JSON.stringify(summaryFormulas))
      : {};

    const updatedMasters = [...masters, newMaster];
    setSaving(true);
    try {
      const res = await fetch('/api/stock/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masters: updatedMasters,
          template: {
            master_key: cleanKey,
            rows: newRows,
            product_columns: newCols,
            summary_formulas: newSummaryFormulas,
            description: newMaster.description,
          },
        }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setTemplates(prev => ({
          ...prev,
          [cleanKey]: { rows: newRows, product_columns: newCols, summary_formulas: newSummaryFormulas, description: newMaster.description },
        }));
        setActiveMasterKey(cleanKey);
        setRows(newRows);
        setProductColumns(newCols);
        setSummaryFormulas(newSummaryFormulas);
        setIsDirty(false);
        setIsNewMasterModalOpen(false);
        showToast(`✅ Created new Statement Master "${newMaster.name}"!`);
      } else {
        showToast('❌ Failed to create statement master');
      }
    } catch (err) {
      console.error('Error creating statement master:', err);
      showToast('❌ Server error creating master');
    }
    setSaving(false);
  };

  // Add / Edit Product Column Modal Handlers
  const handleOpenAddColumn = () => {
    setColModalEditingKey(null);
    setFormColKey('');
    setFormColName('');
    setFormColCategory('');
    setIsColModalOpen(true);
  };

  const handleOpenEditColumn = (col: ProductColDef) => {
    setColModalEditingKey(col.key);
    setFormColKey(col.key);
    setFormColName(col.label);
    setFormColCategory(col.category || '');
    setIsColModalOpen(true);
  };

  const handleSaveColumnModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formColName.trim()) {
      showWarning('Column Name Required', 'Please provide a valid product column name.');
      return;
    }

    const keyToUse = formColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || formColName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!keyToUse) {
      showWarning('Column Key Required', 'Please provide a valid product column key.');
      return;
    }

    if (colModalEditingKey) {
      const oldKey = colModalEditingKey;
      if (keyToUse !== oldKey) {
        if (productColumns.some(c => c.key === keyToUse)) {
          showWarning('Duplicate Column Key', `A column with key "${keyToUse}" already exists.`);
          return;
        }
        executeKeyRename({
          scope: 'product',
          oldKey,
          newKey: keyToUse,
          confirm,
          showError,
        });
      }

      setIsDirty(true);
      // 1. Update productColumns
      setProductColumns(prev =>
        prev.map(c =>
          c.key === oldKey
            ? { ...c, key: keyToUse, label: formColName.trim(), category: formColCategory, short_name: formColName.trim(), full_name: formColName.trim() }
            : c
        )
      );

      // 2. Update all row values in `rows`
      setRows(prev =>
        prev.map(r => {
          const nextVals = { ...r.values };
          if (oldKey in nextVals) {
            nextVals[keyToUse] = nextVals[oldKey];
            delete nextVals[oldKey];
          }
          return { ...r, values: nextVals };
        })
      );

      // 3. Update summaryFormulas if present
      setSummaryFormulas(prev => {
        const next = { ...prev };
        (['total_receipts', 'total_available', 'total_disposals', 'closing_balance'] as const).forEach(k => {
          if (next[k] && oldKey in next[k]) {
            const copy = { ...next[k] };
            copy[keyToUse] = copy[oldKey];
            delete copy[oldKey];
            next[k] = copy;
          }
        });
        return next;
      });

      // 4. Update selectedCell if this column was selected
      if (selectedCell?.colKey === oldKey) {
        setSelectedCell(prev => prev ? { ...prev, colKey: keyToUse } : null);
      }
    } else {
      // Add new column
      if (productColumns.some(c => c.key === keyToUse)) {
        showWarning('Duplicate Column Key', `A column with key "${keyToUse}" already exists.`);
        return;
      }

      setIsDirty(true);
      const newCol: ProductColDef = {
        key: keyToUse,
        label: formColName.trim(),
        category: formColCategory,
        short_name: formColName.trim(),
        full_name: formColName.trim(),
      };
      setProductColumns(prev => [...prev, newCol]);
    }

    setIsColModalOpen(false);
  };

  const handleDeleteColumn = async (colKey: string) => {
    const isConfirmed = await confirm({
      title: 'Remove Product Column',
      message: `Are you sure you want to remove product column "${colKey}" from this template?`,
      confirmText: 'Remove Column',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;

    setIsDirty(true);
    setProductColumns(prev => prev.filter(c => c.key !== colKey));
    setRows(prev =>
      prev.map(r => {
        const nextVals = { ...r.values };
        delete nextVals[colKey];
        return { ...r, values: nextVals };
      })
    );
    setSummaryFormulas(prev => {
      const next = { ...prev };
      (['total_receipts', 'total_available', 'total_disposals', 'closing_balance'] as const).forEach(k => {
        if (next[k] && colKey in next[k]) {
          const copy = { ...next[k] };
          delete copy[colKey];
          next[k] = copy;
        }
      });
      return next;
    });
    if (selectedCell?.colKey === colKey) {
      setSelectedCell(null);
    }
  };

  // Add Particular Row Modal Handlers
  const handleOpenAddParticular = (type: 'RECEIPT' | 'DISPOSAL') => {
    setParticularSectionType(type);
    const existingLabels = rows.filter(r => r.row_type === type).map(r => r.row_label);
    const available = (type === 'RECEIPT' ? dbReceiptRows : dbDisposalRows).filter(l => !existingLabels.includes(l));
    setParticularLabel(available.length > 0 ? available[0] : '');
    setIsParticularModalOpen(true);
  };

  const handleSaveParticularModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!particularLabel.trim()) {
      showWarning('Particular Name Required', 'Please enter or select a particular row name.');
      return;
    }

    setIsDirty(true);
    const newRow: StockRowState = {
      row_type: particularSectionType,
      row_label: particularLabel.trim(),
      values: {},
    };

    setRows(prev => {
      const next = [...prev];
      if (particularSectionType === 'RECEIPT') {
        const lastReceiptIdx = next.map(r => r.row_type).lastIndexOf('RECEIPT');
        const insertIdx = lastReceiptIdx !== -1 ? lastReceiptIdx + 1 : next.length;
        next.splice(insertIdx, 0, newRow);
      } else {
        next.push(newRow);
      }
      return next;
    });

    setIsParticularModalOpen(false);
  };

  const handleDeleteRow = async (rowIdx: number) => {
    const row = rows[rowIdx];
    if (!row) return;

    if (row.row_type === 'OB') {
      showWarning('Protected Row', 'Opening Balance is a core statement row and cannot be removed.');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Delete Particular Row',
      message: `Are you sure you want to remove "${row.row_label}" from this master template?`,
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;

    setIsDirty(true);
    setRows(prev => prev.filter((_, idx) => idx !== rowIdx));
  };

  const handleMoveRow = (rowIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const row = rows[rowIdx];
    const targetRow = rows[targetIdx];
    // Keep sections together (OB first, then Receipts, then Disposals)
    if (row.row_type !== targetRow.row_type) return;

    setIsDirty(true);
    setRows(prev => {
      const next = [...prev];
      const temp = next[rowIdx];
      next[rowIdx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  return (
    <>
      <Header
        title="Master Default Stock Statements"
        subtitle="Configure, customize and save master statement templates for Milk & Cream Stock Statement Entry"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard/stock/products"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 600 }}
              title="Manage Products List & Particulars"
            >
              📦 Products List
            </Link>
            <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">
              ← Back to Stock Register
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveCurrentTemplate}
              disabled={saving}
              style={{ fontWeight: 700 }}
            >
              {saving ? 'Saving...' : '💾 Save Statement Template'}
            </button>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {toastMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              background: toastMessage.includes('❌') ? '#fef2f2' : '#f0fdf4',
              border: toastMessage.includes('❌') ? '1px solid #fca5a5' : '1px solid #86efac',
              color: toastMessage.includes('❌') ? '#991b1b' : '#166534',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── MASTER TEMPLATES TOP SWITCHER ───────────────────────────────────── */}
        <div
          className="card"
          style={{
            padding: '12px 18px',
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📦</span>
              <span>Stock Statement Master Templates</span>
              <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {masters.length}
              </span>
            </div>
            {isDirty && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}>
                ● Unsaved Changes in &quot;{activeMaster.name}&quot;
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {masters.map(m => {
              const isSelected = m.key === activeMasterKey;
              return (
                <button
                  key={`stock_master_tab_${m.key}`}
                  type="button"
                  onClick={() => handleSwitchMaster(m.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: isSelected ? 'var(--brand-primary)' : '#f8fafc',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>📋 {m.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleOpenNewMaster}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 700,
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1px dashed #38bdf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
              title="Add a brand new Stock Statement Master Template"
            >
              <span>➕ Add Statement Master</span>
            </button>
          </div>
        </div>

        {/* ─── STATEMENT FORMULATION TABLE CARD ─────────────────────────────────── */}
        <div
          className="card"
          style={{
            padding: 0,
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Table Header Action Bar */}
          <div
            style={{
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              borderBottom: '1px solid #bbf7d0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⭐ Default Master Template for {activeMaster.name}</span>
                <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                  {rows.length} Statement Rows | {productColumns.length} Products
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#14532d', marginTop: 3 }}>
                Values, rows, and product columns saved here will automatically populate when creating new Milk &amp; Cream Stock Statement Entries.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleOpenSaveAs}
                className="btn btn-secondary btn-sm"
                style={{
                  background: '#ffffff',
                  border: '1px solid #16a34a',
                  color: '#15803d',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.8rem',
                }}
                title="Save current formulation as a new separate Master Template without modifying existing templates"
              >
                💾 Save Template
              </button>

              <button
                type="button"
                onClick={() => setIsColEditing(prev => !prev)}
                style={{
                  background: isColEditing ? '#e0f2fe' : '#ffffff',
                  border: isColEditing ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  color: isColEditing ? '#0369a1' : '#475569',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isColEditing ? '⚙️ Done Editing Products' : '✏️ Edit Product Columns'}
              </button>

              {isColEditing && (
                <button
                  type="button"
                  onClick={handleOpenAddColumn}
                  style={{ background: '#f0f9ff', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  ➕ Add Product
                </button>
              )}

              {/* Decimal Precision View Selector */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '2px 4px',
                  gap: 2,
                  marginLeft: 4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
                title="Toggle decimal precision across all template cells and totals"
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', padding: '0 4px', display: 'flex', alignItems: 'center', gap: 3 }}>
                  🔢 View:
                </span>
                {([
                  { key: 'auto', label: 'Auto' },
                  { key: 0, label: '.0 Whole' },
                  { key: 1, label: '.1 Dec' },
                  { key: 2, label: '.2 Decs' },
                  { key: 3, label: '.3 Decs' },
                ] as const).map(opt => {
                  const active = viewDecimals === opt.key;
                  return (
                    <button
                      key={String(opt.key)}
                      type="button"
                      onClick={() => setViewDecimals(opt.key)}
                      style={{
                        border: active ? '1px solid #0284c7' : '1px solid transparent',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: '0.74rem',
                        fontWeight: active ? 700 : 500,
                        backgroundColor: active ? '#0284c7' : 'transparent',
                        color: active ? '#ffffff' : '#64748b',
                        cursor: 'pointer',
                        boxShadow: active ? '0 1px 2px rgba(2,132,199,0.2)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Excel Formula Bar */}
          <div
            style={{
              padding: '8px 16px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Cell Address */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontWeight: 800,
                fontSize: '0.85rem',
                color: 'var(--brand-primary)',
                fontFamily: 'monospace',
                minWidth: 65,
                justifyContent: 'center',
              }}
            >
              <span>{activeCellDetails.address || '--'}</span>
            </div>

            <div
              style={{
                fontWeight: 900,
                fontSize: '1.05rem',
                color: '#0284c7',
                fontStyle: 'italic',
                fontFamily: 'serif',
                userSelect: 'none',
              }}
              title="Excel Formula Indicator"
            >
              ƒx
            </div>

            <div style={{ height: 20, width: 1, background: '#cbd5e1' }} />

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 280, flexWrap: 'wrap' }}>
              {activeCellDetails.rowLabel && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '2px 8px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeCellDetails.rowLabel}
                </span>
              )}

              {activeCellDetails.colLabel && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    padding: '2px 8px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeCellDetails.colLabel}
                </span>
              )}

              <input
                type="text"
                className="form-input"
                style={{
                  height: 30,
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  background: '#ffffff',
                  borderColor: activeCellDetails.address ? 'var(--brand-primary)' : 'var(--border)',
                  color: (activeCellDetails.formulaText || '').startsWith('=') ? '#b45309' : 'var(--text-primary)',
                  fontWeight: (activeCellDetails.formulaText || '').startsWith('=') ? 700 : 500,
                  minWidth: 220,
                  flex: 1,
                }}
                placeholder={selectedCell ? 'Enter default quantity or formula e.g. =A1+B1 or =SUM(A2:A5)' : 'Click any cell below (OB, Receipts, Disposals, Totals, Balance) to inspect or edit formula'}
                disabled={!selectedCell}
                value={activeCellDetails.formulaText}
                onChange={e => {
                  if (selectedCell) {
                    handleCellFormulaChange(selectedCell.rowType, selectedCell.colKey, e.target.value, selectedCell.rowIndex);
                  }
                }}
              />

              {selectedCell && (
                <button
                  type="button"
                  onClick={() => handleOpenFormulaModal(selectedCell.rowType, selectedCell.rowLabel, selectedCell.rowIndex)}
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Configure formula with presets for this row"
                >
                  <span>⚡</span> Configure Formula
                </button>
              )}
            </div>
          </div>

          {/* Spreadsheet Table Grid Container */}
          <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="spinner" /> Loading stock statement master formulation...
              </div>
            ) : (
              <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.82rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ width: 45, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid var(--border)', background: '#f1f5f9' }}>#</th>
                    <th style={{ minWidth: 240, padding: '8px 12px', borderRight: '1px solid var(--border)', background: '#f1f5f9' }}>
                      Particulars (Stock Statement Flow)
                    </th>

                    {/* Product Columns */}
                    {productColumns.map((col, cIdx) => (
                      <th
                        key={col.key}
                        style={{
                          minWidth: 125,
                          textAlign: 'right',
                          padding: '8px 10px',
                          borderRight: '1px solid var(--border)',
                          background: '#f8fafc',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{col.label}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {getExcelColName(cIdx)} | {col.key}
                          </span>
                          {isColEditing && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditColumn(col)}
                                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(col.key)}
                                style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </th>
                    ))}

                    <th style={{ minWidth: 120, textAlign: 'right', padding: '8px 12px', background: '#f1f5f9', fontWeight: 800 }}>
                      Total Sum
                    </th>
                    <th style={{ width: 110, textAlign: 'center', padding: '8px 4px', background: '#f1f5f9' }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {/* ── 1. OPENING BALANCE ROW ─────────────────────────────────── */}
                  {obRow && (
                    <tr key="row_ob" style={{ background: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#0369a1', borderRight: '1px solid #bae6fd', padding: '6px 4px' }} title="Excel Row 1">
                        1
                      </td>
                      <td style={{ fontWeight: 800, color: '#0369a1', borderRight: '1px solid #bae6fd', padding: '6px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>🔵</span>
                          <span>{obRow.row_label}</span>
                        </span>
                      </td>

                      {productColumns.map((col, cIdx) => {
                        const colLetter = getExcelColName(cIdx);
                        const isSelected = selectedCell?.rowType === 'OB' && selectedCell?.colKey === col.key;
                        const isFocused = focusedCell?.rowType === 'OB' && focusedCell?.colKey === col.key;
                        const rawVal = obRow.values?.[col.key] || '';
                        const computedVal = calculatedRows.obValues[col.key] || 0;
                        const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                        const displayVal = isFocused
                          ? rawVal
                          : isFormula
                            ? (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals))
                            : (rawVal !== '' && !isNaN(parseFloat(rawVal)) ? formatDisplayVal(parseFloat(rawVal), viewDecimals) : (rawVal || formatDisplayVal(0, viewDecimals)));

                        return (
                          <td
                            key={`ob_${col.key}`}
                            style={{
                              padding: 2,
                              position: 'relative',
                              borderRight: '1px solid #bae6fd',
                              background: isSelected ? '#bae6fd' : '#f0f9ff',
                            }}
                          >
                            {isFormula && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 2,
                                  left: 2,
                                  width: 0,
                                  height: 0,
                                  borderStyle: 'solid',
                                  borderWidth: '7px 7px 0 0',
                                  borderColor: '#b45309 transparent transparent transparent',
                                  pointerEvents: 'none',
                                  zIndex: 5,
                                }}
                                title={`Formula: ${rawVal}`}
                              />
                            )}
                            <input
                              type="text"
                              value={displayVal}
                              title={isFormula ? `Formula: ${rawVal}` : undefined}
                              onFocus={() => {
                                setSelectedCell({ rowType: 'OB', rowIndex: obRowIndex, rowLabel: obRow.row_label, colKey: col.key, excelAddress: `${colLetter}1` });
                                setFocusedCell({ rowType: 'OB', rowIndex: obRowIndex, colKey: col.key });
                              }}
                              onBlur={() => setFocusedCell(null)}
                              onClick={() => setSelectedCell({ rowType: 'OB', rowIndex: obRowIndex, rowLabel: obRow.row_label, colKey: col.key, excelAddress: `${colLetter}1` })}
                              onChange={e => handleCellFormulaChange('OB', col.key, e.target.value, obRowIndex)}
                              style={{
                                width: '100%',
                                height: 28,
                                textAlign: 'right',
                                padding: isFormula ? '2px 6px 2px 10px' : '2px 8px',
                                border: isSelected ? '2px solid #0284c7' : '1px solid transparent',
                                borderRadius: 4,
                                background: 'transparent',
                                fontWeight: isFormula ? 800 : 600,
                                fontSize: '0.82rem',
                                color: isFormula ? '#b45309' : '#0369a1',
                                fontFamily: 'var(--font-numbers)',
                                outline: 'none',
                              }}
                              placeholder={formatDisplayVal(0, viewDecimals)}
                            />
                          </td>
                        );
                      })}

                      <td style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 800, color: '#0369a1', background: '#e0f2fe' }}>
                        {formatDisplayVal(getHorizontalSum(calculatedRows.obValues), viewDecimals)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenFormulaModal('OB', obRow.row_label, obRowIndex)}
                          style={{ background: '#ffffff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          title="Configure Formula for Opening Balance"
                        >
                          ⚡ Formula
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* ── 2. RECEIPTS HEADER / SECTION ───────────────────────────── */}
                  <tr style={{ background: '#f0fdf4', borderBottom: '1px solid #86efac' }}>
                    <td colSpan={productColumns.length + 3} style={{ padding: '6px 12px', fontWeight: 800, color: '#15803d', letterSpacing: '0.04em' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>📥 RECEIPTS</span>
                          <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 8 }}>
                            {receiptRows.length} particulars
                          </span>
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenFormulaModal('RECEIPT', 'Receipts (All Rows)')}
                            style={{ background: '#ffffff', border: '1px solid #86efac', color: '#166534', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                            title="Configure formula across receipt rows"
                          >
                            ⚡ Receipts Formula
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddParticular('RECEIPT')}
                            style={{ background: '#16a34a', border: 'none', color: '#ffffff', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ➕ Add Receipt Row
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {receiptRows.map((row, rIdx) => {
                    const rowIdx = rows.findIndex(r => r === row);
                    const excelRowNum = 2 + rIdx;

                    return (
                      <tr key={`receipt_${rowIdx}`} style={{ background: '#ffffff', borderBottom: '1px solid var(--border)' }}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', borderRight: '1px solid var(--border)', padding: '6px 4px' }} title={`Excel Row ${excelRowNum}`}>
                          {excelRowNum}
                        </td>
                        <td style={{ fontWeight: 600, borderRight: '1px solid var(--border)', padding: '6px 12px' }}>
                          <input
                            type="text"
                            value={row.row_label}
                            onChange={e => {
                              setIsDirty(true);
                              setRows(prev => {
                                const next = [...prev];
                                next[rowIdx] = { ...next[rowIdx], row_label: e.target.value };
                                return next;
                              });
                            }}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </td>

                        {productColumns.map((col, cIdx) => {
                          const colLetter = getExcelColName(cIdx);
                          const isSelected = selectedCell?.rowType === 'RECEIPT' && selectedCell?.rowIndex === rowIdx && selectedCell?.colKey === col.key;
                          const isFocused = focusedCell?.rowType === 'RECEIPT' && focusedCell?.rowIndex === rowIdx && focusedCell?.colKey === col.key;
                          const rawVal = row.values?.[col.key] || '';
                          const computedVal = calculatedRows.receiptValues[rIdx]?.[col.key] || 0;
                          const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                          const displayVal = isFocused
                            ? rawVal
                            : isFormula
                              ? (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals))
                              : (rawVal !== '' && !isNaN(parseFloat(rawVal)) ? formatDisplayVal(parseFloat(rawVal), viewDecimals) : (rawVal || formatDisplayVal(0, viewDecimals)));

                          return (
                            <td
                              key={`rec_${rowIdx}_${col.key}`}
                              style={{
                                padding: 2,
                                position: 'relative',
                                borderRight: '1px solid var(--border)',
                                background: isSelected ? '#dcfce7' : '#ffffff',
                              }}
                            >
                              {isFormula && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 2,
                                    left: 2,
                                    width: 0,
                                    height: 0,
                                    borderStyle: 'solid',
                                    borderWidth: '7px 7px 0 0',
                                    borderColor: '#b45309 transparent transparent transparent',
                                    pointerEvents: 'none',
                                    zIndex: 5,
                                  }}
                                  title={`Formula: ${rawVal}`}
                                />
                              )}
                              <input
                                type="text"
                                value={displayVal}
                                title={isFormula ? `Formula: ${rawVal}` : undefined}
                                onFocus={() => {
                                  setSelectedCell({ rowType: 'RECEIPT', rowIndex: rowIdx, rowLabel: row.row_label, colKey: col.key, excelAddress: `${colLetter}${excelRowNum}` });
                                  setFocusedCell({ rowType: 'RECEIPT', rowIndex: rowIdx, colKey: col.key });
                                }}
                                onBlur={() => setFocusedCell(null)}
                                onClick={() => setSelectedCell({ rowType: 'RECEIPT', rowIndex: rowIdx, rowLabel: row.row_label, colKey: col.key, excelAddress: `${colLetter}${excelRowNum}` })}
                                onChange={e => handleCellFormulaChange('RECEIPT', col.key, e.target.value, rowIdx)}
                                style={{
                                  width: '100%',
                                  height: 28,
                                  textAlign: 'right',
                                  padding: isFormula ? '2px 6px 2px 10px' : '2px 8px',
                                  border: isSelected ? '2px solid #16a34a' : '1px solid transparent',
                                  borderRadius: 4,
                                  background: 'transparent',
                                  fontWeight: isFormula ? 800 : 600,
                                  fontSize: '0.82rem',
                                  color: isFormula ? '#b45309' : 'var(--text-primary)',
                                  fontFamily: 'var(--font-numbers)',
                                  outline: 'none',
                                }}
                                placeholder={formatDisplayVal(0, viewDecimals)}
                              />
                            </td>
                          );
                        })}

                        <td style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 700, color: '#166534', background: '#f0fdf4' }}>
                          {formatDisplayVal(getHorizontalSum(calculatedRows.receiptValues[rIdx] || {}), viewDecimals)}
                        </td>

                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenFormulaModal('RECEIPT', row.row_label, rowIdx)}
                              style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#15803d', borderRadius: 3, padding: '1px 4px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                              title="Configure Formula for this Receipt row"
                            >
                              ⚡
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rowIdx, 'up')}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              title="Move Row Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rowIdx, 'down')}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              title="Move Row Down"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(rowIdx)}
                              style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              title="Delete Row"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── 3. TOTAL RECEIPTS ROW ─────────────────────────────────── */}
                  <tr style={{ background: '#dcfce7', borderBottom: '1px solid #86efac', fontWeight: 800 }}>
                    <td style={{ textAlign: 'center', color: '#166534', borderRight: '1px solid #86efac' }} title={`Excel Row ${totalReceiptsRowNum}`}>
                      ∑
                    </td>
                    <td style={{ color: '#166534', borderRight: '1px solid #86efac', padding: '6px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>Total Receipts</span>
                        <span style={{ fontSize: '0.68rem', color: '#15803d', opacity: 0.8 }}>(Configurable Formula)</span>
                      </span>
                    </td>
                    {productColumns.map((col, cIdx) => {
                      const colLetter = getExcelColName(cIdx);
                      const isSelected = selectedCell?.rowType === 'TOTAL_RECEIPTS' && selectedCell?.colKey === col.key;
                      const isFocused = focusedCell?.rowType === 'TOTAL_RECEIPTS' && focusedCell?.colKey === col.key;
                      const customFormula = summaryFormulas.total_receipts?.[col.key];
                      const defaultFormula = getDefaultTotalReceiptsFormula(cIdx);
                      const rawVal = customFormula !== undefined ? customFormula : defaultFormula;
                      const computedVal = calculatedRows.totalReceiptsValues[col.key] || 0;
                      const displayVal = isFocused
                        ? rawVal
                        : (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals));

                      return (
                        <td
                          key={`tot_rec_${col.key}`}
                          style={{
                            padding: 2,
                            position: 'relative',
                            borderRight: '1px solid #86efac',
                            background: isSelected ? '#bbf7d0' : '#dcfce7',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              width: 0,
                              height: 0,
                              borderStyle: 'solid',
                              borderWidth: '7px 7px 0 0',
                              borderColor: '#15803d transparent transparent transparent',
                              pointerEvents: 'none',
                              zIndex: 5,
                            }}
                            title={`Formula: ${rawVal}`}
                          />
                          <input
                            type="text"
                            value={displayVal}
                            title={`Formula: ${rawVal}`}
                            onFocus={() => {
                              setSelectedCell({ rowType: 'TOTAL_RECEIPTS', rowLabel: 'Total Receipts', colKey: col.key, excelAddress: `${colLetter}${totalReceiptsRowNum}` });
                              setFocusedCell({ rowType: 'TOTAL_RECEIPTS', colKey: col.key });
                            }}
                            onBlur={() => setFocusedCell(null)}
                            onClick={() => setSelectedCell({ rowType: 'TOTAL_RECEIPTS', rowLabel: 'Total Receipts', colKey: col.key, excelAddress: `${colLetter}${totalReceiptsRowNum}` })}
                            onChange={e => handleCellFormulaChange('TOTAL_RECEIPTS', col.key, e.target.value)}
                            style={{
                              width: '100%',
                              height: 28,
                              textAlign: 'right',
                              padding: '2px 6px 2px 10px',
                              border: isSelected ? '2px solid #15803d' : '1px solid transparent',
                              borderRadius: 4,
                              background: 'transparent',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              color: '#166534',
                              fontFamily: 'var(--font-numbers)',
                              outline: 'none',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '6px 12px', color: '#166534', background: '#bbf7d0', fontWeight: 800 }}>
                      {formatDisplayVal(getHorizontalSum(calculatedRows.totalReceiptsValues), viewDecimals)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenFormulaModal('TOTAL_RECEIPTS', 'Total Receipts')}
                        style={{ background: '#ffffff', border: '1px solid #86efac', color: '#166534', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        title="Configure Formula for Total Receipts"
                      >
                        ⚡ Formula
                      </button>
                    </td>
                  </tr>

                  {/* ── 4. TOTAL AVAILABLE (OB + RECEIPTS) ─────────────────────── */}
                  <tr style={{ background: '#bbf7d0', borderBottom: '2px solid #86efac', fontWeight: 800 }}>
                    <td style={{ textAlign: 'center', color: '#14532d', borderRight: '1px solid #86efac' }} title={`Excel Row ${totalAvailableRowNum}`}>
                      ∑
                    </td>
                    <td style={{ color: '#14532d', borderRight: '1px solid #86efac', padding: '6px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>Total Available (OB + Receipts)</span>
                        <span style={{ fontSize: '0.68rem', color: '#14532d', opacity: 0.8 }}>(Configurable Formula)</span>
                      </span>
                    </td>
                    {productColumns.map((col, cIdx) => {
                      const colLetter = getExcelColName(cIdx);
                      const isSelected = selectedCell?.rowType === 'TOTAL_AVAILABLE' && selectedCell?.colKey === col.key;
                      const isFocused = focusedCell?.rowType === 'TOTAL_AVAILABLE' && focusedCell?.colKey === col.key;
                      const customFormula = summaryFormulas.total_available?.[col.key];
                      const defaultFormula = getDefaultTotalAvailableFormula(cIdx);
                      const rawVal = customFormula !== undefined ? customFormula : defaultFormula;
                      const computedVal = calculatedRows.totalAvailableValues[col.key] || 0;
                      const displayVal = isFocused
                        ? rawVal
                        : (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals));

                      return (
                        <td
                          key={`tot_avail_${col.key}`}
                          style={{
                            padding: 2,
                            position: 'relative',
                            borderRight: '1px solid #86efac',
                            background: isSelected ? '#86efac' : '#bbf7d0',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              width: 0,
                              height: 0,
                              borderStyle: 'solid',
                              borderWidth: '7px 7px 0 0',
                              borderColor: '#14532d transparent transparent transparent',
                              pointerEvents: 'none',
                              zIndex: 5,
                            }}
                            title={`Formula: ${rawVal}`}
                          />
                          <input
                            type="text"
                            value={displayVal}
                            title={`Formula: ${rawVal}`}
                            onFocus={() => {
                              setSelectedCell({ rowType: 'TOTAL_AVAILABLE', rowLabel: 'Total Available (OB + Receipts)', colKey: col.key, excelAddress: `${colLetter}${totalAvailableRowNum}` });
                              setFocusedCell({ rowType: 'TOTAL_AVAILABLE', colKey: col.key });
                            }}
                            onBlur={() => setFocusedCell(null)}
                            onClick={() => setSelectedCell({ rowType: 'TOTAL_AVAILABLE', rowLabel: 'Total Available (OB + Receipts)', colKey: col.key, excelAddress: `${colLetter}${totalAvailableRowNum}` })}
                            onChange={e => handleCellFormulaChange('TOTAL_AVAILABLE', col.key, e.target.value)}
                            style={{
                              width: '100%',
                              height: 28,
                              textAlign: 'right',
                              padding: '2px 6px 2px 10px',
                              border: isSelected ? '2px solid #14532d' : '1px solid transparent',
                              borderRadius: 4,
                              background: 'transparent',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              color: '#14532d',
                              fontFamily: 'var(--font-numbers)',
                              outline: 'none',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '6px 12px', color: '#14532d', background: '#86efac', fontWeight: 800 }}>
                      {formatDisplayVal(getHorizontalSum(calculatedRows.totalAvailableValues), viewDecimals)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenFormulaModal('TOTAL_AVAILABLE', 'Total Available (OB + Receipts)')}
                        style={{ background: '#ffffff', border: '1px solid #86efac', color: '#14532d', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        title="Configure Formula for Total Available"
                      >
                        ⚡ Formula
                      </button>
                    </td>
                  </tr>

                  {/* ── 5. DISPOSALS HEADER / SECTION ──────────────────────────── */}
                  <tr style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
                    <td colSpan={productColumns.length + 3} style={{ padding: '6px 12px', fontWeight: 800, color: '#c2410c', letterSpacing: '0.04em' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>📤 DISPOSALS</span>
                          <span style={{ fontSize: '0.72rem', background: '#ffedd5', color: '#c2410c', padding: '1px 6px', borderRadius: 8 }}>
                            {disposalRows.length} particulars
                          </span>
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenFormulaModal('DISPOSAL', 'Disposals (All Rows)')}
                            style={{ background: '#ffffff', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                            title="Configure formula across disposal rows"
                          >
                            ⚡ Disposals Formula
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddParticular('DISPOSAL')}
                            style={{ background: '#ea580c', border: 'none', color: '#ffffff', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ➕ Add Disposal Row
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {disposalRows.map((row, dIdx) => {
                    const rowIdx = rows.findIndex(r => r === row);
                    const excelRowNum = 4 + receiptRows.length + dIdx;

                    return (
                      <tr key={`disp_${rowIdx}`} style={{ background: '#ffffff', borderBottom: '1px solid var(--border)' }}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', borderRight: '1px solid var(--border)', padding: '6px 4px' }} title={`Excel Row ${excelRowNum}`}>
                          {excelRowNum}
                        </td>
                        <td style={{ fontWeight: 600, borderRight: '1px solid var(--border)', padding: '6px 12px' }}>
                          <input
                            type="text"
                            value={row.row_label}
                            onChange={e => {
                              setIsDirty(true);
                              setRows(prev => {
                                const next = [...prev];
                                next[rowIdx] = { ...next[rowIdx], row_label: e.target.value };
                                return next;
                              });
                            }}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </td>

                        {productColumns.map((col, cIdx) => {
                          const colLetter = getExcelColName(cIdx);
                          const isSelected = selectedCell?.rowType === 'DISPOSAL' && selectedCell?.rowIndex === rowIdx && selectedCell?.colKey === col.key;
                          const isFocused = focusedCell?.rowType === 'DISPOSAL' && focusedCell?.rowIndex === rowIdx && focusedCell?.colKey === col.key;
                          const rawVal = row.values?.[col.key] || '';
                          const computedVal = calculatedRows.disposalValues[dIdx]?.[col.key] || 0;
                          const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                          const displayVal = isFocused
                            ? rawVal
                            : isFormula
                              ? (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals))
                              : (rawVal !== '' && !isNaN(parseFloat(rawVal)) ? formatDisplayVal(parseFloat(rawVal), viewDecimals) : (rawVal || formatDisplayVal(0, viewDecimals)));

                          return (
                            <td
                              key={`disp_${rowIdx}_${col.key}`}
                              style={{
                                padding: 2,
                                position: 'relative',
                                borderRight: '1px solid var(--border)',
                                background: isSelected ? '#ffedd5' : '#ffffff',
                              }}
                            >
                              {isFormula && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 2,
                                    left: 2,
                                    width: 0,
                                    height: 0,
                                    borderStyle: 'solid',
                                    borderWidth: '7px 7px 0 0',
                                    borderColor: '#b45309 transparent transparent transparent',
                                    pointerEvents: 'none',
                                    zIndex: 5,
                                  }}
                                  title={`Formula: ${rawVal}`}
                                />
                              )}
                              <input
                                type="text"
                                value={displayVal}
                                title={isFormula ? `Formula: ${rawVal}` : undefined}
                                onFocus={() => {
                                  setSelectedCell({ rowType: 'DISPOSAL', rowIndex: rowIdx, rowLabel: row.row_label, colKey: col.key, excelAddress: `${colLetter}${excelRowNum}` });
                                  setFocusedCell({ rowType: 'DISPOSAL', rowIndex: rowIdx, colKey: col.key });
                                }}
                                onBlur={() => setFocusedCell(null)}
                                onClick={() => setSelectedCell({ rowType: 'DISPOSAL', rowIndex: rowIdx, rowLabel: row.row_label, colKey: col.key, excelAddress: `${colLetter}${excelRowNum}` })}
                                onChange={e => handleCellFormulaChange('DISPOSAL', col.key, e.target.value, rowIdx)}
                                style={{
                                  width: '100%',
                                  height: 28,
                                  textAlign: 'right',
                                  padding: isFormula ? '2px 6px 2px 10px' : '2px 8px',
                                  border: isSelected ? '2px solid #ea580c' : '1px solid transparent',
                                  borderRadius: 4,
                                  background: 'transparent',
                                  fontWeight: isFormula ? 800 : 600,
                                  fontSize: '0.82rem',
                                  color: isFormula ? '#b45309' : 'var(--text-primary)',
                                  fontFamily: 'var(--font-numbers)',
                                  outline: 'none',
                                }}
                                placeholder={formatDisplayVal(0, viewDecimals)}
                              />
                            </td>
                          );
                        })}

                        <td style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 700, color: '#c2410c', background: '#fff7ed' }}>
                          {formatDisplayVal(getHorizontalSum(calculatedRows.disposalValues[dIdx] || {}), viewDecimals)}
                        </td>

                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenFormulaModal('DISPOSAL', row.row_label, rowIdx)}
                              style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#c2410c', borderRadius: 3, padding: '1px 4px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                              title="Configure Formula for this Disposal row"
                            >
                              ⚡
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rowIdx, 'up')}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              title="Move Row Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rowIdx, 'down')}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              title="Move Row Down"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(rowIdx)}
                              style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                              title="Delete Row"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── 6. TOTAL DISPOSALS ROW ─────────────────────────────────── */}
                  <tr style={{ background: '#ffedd5', borderBottom: '1px solid #fed7aa', fontWeight: 800 }}>
                    <td style={{ textAlign: 'center', color: '#9a3412', borderRight: '1px solid #fed7aa' }} title={`Excel Row ${totalDisposalsRowNum}`}>
                      ∑
                    </td>
                    <td style={{ color: '#9a3412', borderRight: '1px solid #fed7aa', padding: '6px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>Total Disposals</span>
                        <span style={{ fontSize: '0.68rem', color: '#9a3412', opacity: 0.8 }}>(Configurable Formula)</span>
                      </span>
                    </td>
                    {productColumns.map((col, cIdx) => {
                      const colLetter = getExcelColName(cIdx);
                      const isSelected = selectedCell?.rowType === 'TOTAL_DISPOSALS' && selectedCell?.colKey === col.key;
                      const isFocused = focusedCell?.rowType === 'TOTAL_DISPOSALS' && focusedCell?.colKey === col.key;
                      const customFormula = summaryFormulas.total_disposals?.[col.key];
                      const defaultFormula = getDefaultTotalDisposalsFormula(cIdx);
                      const rawVal = customFormula !== undefined ? customFormula : defaultFormula;
                      const computedVal = calculatedRows.totalDisposalsValues[col.key] || 0;
                      const displayVal = isFocused
                        ? rawVal
                        : (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals));

                      return (
                        <td
                          key={`tot_disp_${col.key}`}
                          style={{
                            padding: 2,
                            position: 'relative',
                            borderRight: '1px solid #fed7aa',
                            background: isSelected ? '#fed7aa' : '#ffedd5',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              width: 0,
                              height: 0,
                              borderStyle: 'solid',
                              borderWidth: '7px 7px 0 0',
                              borderColor: '#9a3412 transparent transparent transparent',
                              pointerEvents: 'none',
                              zIndex: 5,
                            }}
                            title={`Formula: ${rawVal}`}
                          />
                          <input
                            type="text"
                            value={displayVal}
                            title={`Formula: ${rawVal}`}
                            onFocus={() => {
                              setSelectedCell({ rowType: 'TOTAL_DISPOSALS', rowLabel: 'Total Disposals', colKey: col.key, excelAddress: `${colLetter}${totalDisposalsRowNum}` });
                              setFocusedCell({ rowType: 'TOTAL_DISPOSALS', colKey: col.key });
                            }}
                            onBlur={() => setFocusedCell(null)}
                            onClick={() => setSelectedCell({ rowType: 'TOTAL_DISPOSALS', rowLabel: 'Total Disposals', colKey: col.key, excelAddress: `${colLetter}${totalDisposalsRowNum}` })}
                            onChange={e => handleCellFormulaChange('TOTAL_DISPOSALS', col.key, e.target.value)}
                            style={{
                              width: '100%',
                              height: 28,
                              textAlign: 'right',
                              padding: '2px 6px 2px 10px',
                              border: isSelected ? '2px solid #ea580c' : '1px solid transparent',
                              borderRadius: 4,
                              background: 'transparent',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              color: '#9a3412',
                              fontFamily: 'var(--font-numbers)',
                              outline: 'none',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '6px 12px', color: '#9a3412', background: '#fed7aa', fontWeight: 800 }}>
                      {formatDisplayVal(getHorizontalSum(calculatedRows.totalDisposalsValues), viewDecimals)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenFormulaModal('TOTAL_DISPOSALS', 'Total Disposals')}
                        style={{ background: '#ffffff', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        title="Configure Formula for Total Disposals"
                      >
                        ⚡ Formula
                      </button>
                    </td>
                  </tr>

                  {/* ── 7. CLOSING BALANCE (AVAILABLE - DISPOSALS) ──────────────── */}
                  <tr style={{ background: '#f5f3ff', borderTop: '2px solid #ddd6fe', fontWeight: 900 }}>
                    <td style={{ textAlign: 'center', color: '#5b21b6', borderRight: '1px solid #ddd6fe' }} title={`Excel Row ${closingBalanceRowNum}`}>
                      ★
                    </td>
                    <td style={{ color: '#5b21b6', borderRight: '1px solid #ddd6fe', padding: '8px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>Closing Balance (Available - Disposals)</span>
                        <span style={{ fontSize: '0.68rem', color: '#5b21b6', opacity: 0.8 }}>(Configurable Formula)</span>
                      </span>
                    </td>
                    {productColumns.map((col, cIdx) => {
                      const colLetter = getExcelColName(cIdx);
                      const isSelected = selectedCell?.rowType === 'CLOSING_BALANCE' && selectedCell?.colKey === col.key;
                      const isFocused = focusedCell?.rowType === 'CLOSING_BALANCE' && focusedCell?.colKey === col.key;
                      const customFormula = summaryFormulas.closing_balance?.[col.key];
                      const defaultFormula = getDefaultClosingBalanceFormula(cIdx);
                      const rawVal = customFormula !== undefined ? customFormula : defaultFormula;
                      const computedVal = calculatedRows.closingBalanceValues[col.key] || 0;
                      const displayVal = isFocused
                        ? rawVal
                        : (computedVal !== 0 ? formatDisplayVal(computedVal, viewDecimals) : formatDisplayVal(0, viewDecimals));

                      return (
                        <td
                          key={`cb_${col.key}`}
                          style={{
                            padding: 2,
                            position: 'relative',
                            borderRight: '1px solid #ddd6fe',
                            background: isSelected ? '#ddd6fe' : '#f5f3ff',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              width: 0,
                              height: 0,
                              borderStyle: 'solid',
                              borderWidth: '7px 7px 0 0',
                              borderColor: '#5b21b6 transparent transparent transparent',
                              pointerEvents: 'none',
                              zIndex: 5,
                            }}
                            title={`Formula: ${rawVal}`}
                          />
                          <input
                            type="text"
                            value={displayVal}
                            title={`Formula: ${rawVal}`}
                            onFocus={() => {
                              setSelectedCell({ rowType: 'CLOSING_BALANCE', rowLabel: 'Closing Balance (Available - Disposals)', colKey: col.key, excelAddress: `${colLetter}${closingBalanceRowNum}` });
                              setFocusedCell({ rowType: 'CLOSING_BALANCE', colKey: col.key });
                            }}
                            onBlur={() => setFocusedCell(null)}
                            onClick={() => setSelectedCell({ rowType: 'CLOSING_BALANCE', rowLabel: 'Closing Balance (Available - Disposals)', colKey: col.key, excelAddress: `${colLetter}${closingBalanceRowNum}` })}
                            onChange={e => handleCellFormulaChange('CLOSING_BALANCE', col.key, e.target.value)}
                            style={{
                              width: '100%',
                              height: 28,
                              textAlign: 'right',
                              padding: '2px 6px 2px 10px',
                              border: isSelected ? '2px solid #7c3aed' : '1px solid transparent',
                              borderRadius: 4,
                              background: 'transparent',
                              fontWeight: 900,
                              fontSize: '0.82rem',
                              color: '#5b21b6',
                              fontFamily: 'var(--font-numbers)',
                              outline: 'none',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '8px 12px', color: '#5b21b6', background: '#ede9fe', fontWeight: 900 }}>
                      {formatDisplayVal(getHorizontalSum(calculatedRows.closingBalanceValues), viewDecimals)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenFormulaModal('CLOSING_BALANCE', 'Closing Balance (Available - Disposals)')}
                        style={{ background: '#ffffff', border: '1px solid #ddd6fe', color: '#5b21b6', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        title="Configure Formula for Closing Balance"
                      >
                        ⚡ Formula
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL: SAVE AS SEPARATE MASTER TEMPLATE ─────────────────────────── */}
      {isSaveAsModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsSaveAsModalOpen(false)}
        >
          <div
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 0,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                💾 Save as New Statement Master Template
              </div>
              <button type="button" onClick={() => setIsSaveAsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSaveAs} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Template Display Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={saveAsName}
                  onChange={e => {
                    setSaveAsName(e.target.value);
                    setSaveAsKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  placeholder="e.g. Monthly Plant Stock Statement"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Template Unique Key *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={saveAsKey}
                  onChange={e => setSaveAsKey(e.target.value)}
                  placeholder="e.g. monthly_plant_stock"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={saveAsDescription}
                  onChange={e => setSaveAsDescription(e.target.value)}
                  placeholder="Brief summary of template purpose"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsSaveAsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  Save New Master Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD BRAND NEW STATEMENT MASTER ───────────────────────────── */}
      {isNewMasterModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsNewMasterModalOpen(false)}
        >
          <div
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 0,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                ➕ Create Brand New Stock Statement Master
              </div>
              <button type="button" onClick={() => setIsNewMasterModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmNewMaster} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Master Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newMasterName}
                  onChange={e => {
                    setNewMasterName(e.target.value);
                    setNewMasterKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  placeholder="e.g. Bulk Milk Depot Stock Statement"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Master Key *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newMasterKey}
                  onChange={e => setNewMasterKey(e.target.value)}
                  placeholder="e.g. bulk_milk_depot_stock"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Initial Template Source</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="newMasterSource"
                      checked={newMasterSource === 'clone'}
                      onChange={() => setNewMasterSource('clone')}
                    />
                    <span>Clone from current &quot;{activeMaster.name}&quot;</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="newMasterSource"
                      checked={newMasterSource === 'blank'}
                      onChange={() => setNewMasterSource('blank')}
                    />
                    <span>Start with Standard DB Particulars</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsNewMasterModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  Create Master Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT PRODUCT COLUMN ─────────────────────────────────── */}
      {isColModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsColModalOpen(false)}
        >
          <div
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 0,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                {colModalEditingKey ? '✏️ Edit Product Column' : '➕ Add Product Column'}
              </div>
              <button type="button" onClick={() => setIsColModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveColumnModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Product Name / Label *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formColName}
                  onChange={e => {
                    setFormColName(e.target.value);
                    if (!colModalEditingKey) {
                      setFormColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  placeholder="e.g. Tea Special Milk"
                />
              </div>

              <KeyField
                label="Product Column Key"
                value={formColKey}
                onChange={setFormColKey}
                originalKey={colModalEditingKey}
                scope="product"
                existingKeys={productColumns.map(c => c.key)}
                placeholder="e.g. tea_special_milk"
                onRenameComplete={(oldKey, newKey) => {
                  setProductColumns(prev => prev.map(c => c.key === oldKey ? { ...c, key: newKey } : c));
                  setColModalEditingKey(newKey);
                }}
              />

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <select
                  className="form-select"
                  value={formColCategory}
                  onChange={e => setFormColCategory(e.target.value)}
                >
                  <option value="">-- No Category (Optional) --</option>
                  {masterCategories && masterCategories.map(c => (
                    <option key={c.id || c.category_name} value={c.category_name}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsColModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  {colModalEditingKey ? 'Update Column' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD PARTICULAR ROW ───────────────────────────────────────── */}
      {isParticularModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsParticularModalOpen(false)}
        >
          <div
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 0,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                ➕ Add {particularSectionType === 'RECEIPT' ? 'Receipts' : 'Disposals'} Particular Row
              </div>
              <button type="button" onClick={() => setIsParticularModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveParticularModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Select from Database Particulars</label>
                <select
                  className="form-select"
                  value={particularLabel}
                  onChange={e => setParticularLabel(e.target.value)}
                >
                  <option value="">-- Or enter custom name below --</option>
                  {(particularSectionType === 'RECEIPT' ? dbReceiptRows : dbDisposalRows).map(p => (
                    <option key={`p_opt_${p}`} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Particular Row Label *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={particularLabel}
                  onChange={e => setParticularLabel(e.target.value)}
                  placeholder="e.g. S.M.P / W.B Conversion"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsParticularModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  Add Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONFIGURE FORMULA ───────────────────────────────────────── */}
      {isFormulaModalOpen && formulaModalTargetRow && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsFormulaModalOpen(false)}
        >
          <div
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 0,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚡ Configure Formula</span>
                  <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                    {formulaModalTargetRow.rowLabel}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Set default or custom calculation formulas for this row across statement products.
                </div>
              </div>
              <button type="button" onClick={() => setIsFormulaModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyFormulaModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Target Product Column</label>
                <select
                  className="form-select"
                  value={formulaModalColKey}
                  onChange={e => setFormulaModalColKey(e.target.value)}
                >
                  <option value="__ALL__">🌐 Apply to All Product Columns</option>
                  {productColumns.map((c, i) => (
                    <option key={`f_col_${c.key}`} value={c.key}>
                      {getExcelColName(i)}: {c.label} ({c.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: 6 }}>
                  Quick Formula Presets
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setFormulaModalExpression('=SUM(RECEIPTS)')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', fontWeight: 600, cursor: 'pointer' }}
                  >
                    =SUM(RECEIPTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaModalExpression('=[OB] + [TOTAL_RECEIPTS]')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontWeight: 600, cursor: 'pointer' }}
                  >
                    =[OB] + [TOTAL_RECEIPTS]
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaModalExpression('=SUM(DISPOSALS)')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontWeight: 600, cursor: 'pointer' }}
                  >
                    =SUM(DISPOSALS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaModalExpression('=[TOTAL_AVAILABLE] - [TOTAL_DISPOSALS]')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#5b21b6', fontWeight: 600, cursor: 'pointer' }}
                  >
                    =[TOTAL_AVAILABLE] - [TOTAL_DISPOSALS]
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaModalExpression('=ROUND(A1 * 1.0, 2)')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  >
                    =ROUND(...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaModalExpression('=0')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  >
                    =0
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Formula Expression *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formulaModalExpression}
                  onChange={e => setFormulaModalExpression(e.target.value)}
                  placeholder="e.g. =[OB] + [TOTAL_RECEIPTS] or =SUM(A2:A5) or =A1*1.02"
                  style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Supports cell references like <code>A1</code>, <code>B4</code>, ranges like <code>SUM(A2:A5)</code>, or semantic tokens <code>[OB]</code>, <code>[TOTAL_RECEIPTS]</code>, <code>[TOTAL_AVAILABLE]</code>, <code>[TOTAL_DISPOSALS]</code>, <code>[CLOSING_BALANCE]</code>.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetFormulaToDefault}
                  style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                  title="Remove custom override and restore system default formula"
                >
                  🔄 Reset to Default
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsFormulaModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                    Apply Formula
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
