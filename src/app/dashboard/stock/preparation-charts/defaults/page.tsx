'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import type { ChartColumnDef, ChartMasterDef, ChartRowData, ChartEntryData } from '@/app/api/stock/preparation-charts/route';
import { getStandardColumnDecimals } from '@/lib/calculations';
import { useConfirm } from '@/context/ConfirmContext';

export default function MasterDefaultFormulationsPage() {
  const { confirm, showWarning } = useConfirm();
  const [columns, setColumns] = useState<ChartColumnDef[]>([]);
  const [defaultColumns, setDefaultColumns] = useState<ChartColumnDef[]>([]);
  const [chartColumnsMap, setChartColumnsMap] = useState<Record<string, ChartColumnDef[]>>({});
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, {
    rows: ChartRowData[];
    target_batch_liters?: number;
    target_fat?: number;
    target_snf?: number;
    columns?: ChartColumnDef[];
  }>>({});
  const [chartEntriesData, setChartEntriesData] = useState<Record<string, {
    rows: ChartRowData[];
    target_batch_liters?: number;
    target_fat?: number;
    target_snf?: number;
    columns?: ChartColumnDef[];
  }>>({});

  const [activeChartKey, setActiveChartKey] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartRowData[]>([]);
  const [targetBatchLit, setTargetBatchLit] = useState<number | undefined>(undefined);
  const [targetFat, setTargetFat] = useState<number | undefined>(undefined);
  const [targetSnf, setTargetSnf] = useState<number | undefined>(undefined);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [isColEditing, setIsColEditing] = useState<boolean>(false);

  // Modal State for Adding / Editing Columns
  const [isColModalOpen, setIsColModalOpen] = useState<boolean>(false);
  const [colModalInsertIdx, setColModalInsertIdx] = useState<number | null>(null);
  const [colModalEditingKey, setColModalEditingKey] = useState<string | null>(null);

  const [formColKey, setFormColKey] = useState<string>('');
  const [formColName, setFormColName] = useState<string>('');
  const [formColType, setFormColType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formColFormula, setFormColFormula] = useState<string>('');
  const [formColUnit, setFormColUnit] = useState<string>('');
  const [formColDecimals, setFormColDecimals] = useState<number | undefined>(undefined);

  // Modal State for Save As Separate Master Template
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState<boolean>(false);
  const [saveAsName, setSaveAsName] = useState<string>('');
  const [saveAsKey, setSaveAsKey] = useState<string>('');
  const [saveAsVariant, setSaveAsVariant] = useState<string>('');
  const [saveAsBatchLit, setSaveAsBatchLit] = useState<string>('');
  const [saveAsFat, setSaveAsFat] = useState<string>('');
  const [saveAsSnf, setSaveAsSnf] = useState<string>('');
  const [saveAsSpGr, setSaveAsSpGr] = useState<string>('');
  const [saveAsDescription, setSaveAsDescription] = useState<string>('');

  // Modal State for Creating a Brand New Master Template
  const [isNewMasterModalOpen, setIsNewMasterModalOpen] = useState<boolean>(false);
  const [newMasterName, setNewMasterName] = useState<string>('');
  const [newMasterKey, setNewMasterKey] = useState<string>('');
  const [newMasterVariant, setNewMasterVariant] = useState<string>('');
  const [newMasterBatchLit, setNewMasterBatchLit] = useState<string>('');
  const [newMasterFat, setNewMasterFat] = useState<string>('');
  const [newMasterSnf, setNewMasterSnf] = useState<string>('');
  const [newMasterSpGr, setNewMasterSpGr] = useState<string>('');
  const [newMasterDescription, setNewMasterDescription] = useState<string>('');
  const [newMasterSource, setNewMasterSource] = useState<string>('blank');

  // Fetch Configs & Templates from DB
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/preparation-charts');
      if (res.ok) {
        const json = await res.json();
        const loadedCols: ChartColumnDef[] = json.columns || [];
        const loadedChartCols: Record<string, ChartColumnDef[]> = json.chart_columns || {};
        const loadedMasters: ChartMasterDef[] = json.masters || [];
        const loadedTemplates: Record<string, any> = json.templates || {};

        setDefaultColumns(loadedCols);
        setChartColumnsMap(loadedChartCols);
        setMasters(loadedMasters);
        setTemplates(loadedTemplates);

        if (loadedMasters.length > 0) {
          const initialKey = activeChartKey && loadedMasters.some(m => m.key === activeChartKey)
            ? activeChartKey
            : loadedMasters[0].key;
          setActiveChartKey(initialKey);
          loadChartMasterDefaults(initialKey, loadedMasters, loadedTemplates, loadedChartCols, loadedCols);
        }
      }
    } catch (err) {
      console.error('Failed to load preparation charts defaults:', err);
    }
    setLoading(false);
  }, [activeChartKey]);

  useEffect(() => {
    loadData();
  }, []);

  const loadChartMasterDefaults = (
    chartKey: string,
    mastersList: ChartMasterDef[],
    tmplMap: Record<string, any>,
    chartColsMap: Record<string, ChartColumnDef[]>,
    fallbackCols: ChartColumnDef[]
  ) => {
    const chartMaster = mastersList.find(m => m.key === chartKey);
    const existingTmpl = tmplMap[chartKey];

    // Load columns specifically for this chart master only
    const specificCols = chartColsMap[chartKey] || existingTmpl?.columns;
    const colsToUse = Array.isArray(specificCols) && specificCols.length > 0
      ? JSON.parse(JSON.stringify(specificCols))
      : JSON.parse(JSON.stringify(fallbackCols));
    setColumns(colsToUse);

    if (existingTmpl && Array.isArray(existingTmpl.rows) && existingTmpl.rows.length > 0) {
      setRows(JSON.parse(JSON.stringify(existingTmpl.rows)));
      setTargetBatchLit(existingTmpl.target_batch_liters !== undefined ? existingTmpl.target_batch_liters : chartMaster?.target_batch_liters);
      setTargetFat(existingTmpl.target_fat !== undefined ? existingTmpl.target_fat : chartMaster?.target_fat);
      setTargetSnf(existingTmpl.target_snf !== undefined ? existingTmpl.target_snf : chartMaster?.target_snf);
    } else {
      // Clean empty row - Variant column is NOT auto-filled
      setRows([{ variant: '', values: {} }]);
      setTargetBatchLit(chartMaster?.target_batch_liters);
      setTargetFat(chartMaster?.target_fat);
      setTargetSnf(chartMaster?.target_snf);
    }
    setSelectedCell(null);
    setFocusedCell(null);
  };

  const handleSwitchChartMaster = async (newKey: string) => {
    if (newKey === activeChartKey) return;
    if (isDirty) {
      const isConfirmed = await confirm({
        title: 'Unsaved Changes',
        message: `You have unsaved changes in the formulation template for "${activeMaster?.name}". If you switch tabs without saving, these changes will be discarded. Do you want to switch anyway?`,
        confirmText: 'Discard & Switch',
        cancelText: 'Stay on Current',
        type: 'warning',
      });
      if (!isConfirmed) return;
    }
    setIsDirty(false);
    setActiveChartKey(newKey);
    loadChartMasterDefaults(newKey, masters, templates, chartColumnsMap, defaultColumns);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to convert 0-indexed column position into Excel Column Letter (A, B, C, D...)
  const getExcelColName = (idx: number) => {
    let name = '';
    let n = idx;
    while (n >= 0) {
      name = String.fromCharCode((n % 26) + 65) + name;
      n = Math.floor(n / 26) - 1;
    }
    return name;
  };

  // Helper to format number according to column decimal precision
  const formatNumberValue = (num: number, decimals?: number, colKey?: string): string => {
    if (isNaN(num)) return '-';
    const dec = getStandardColumnDecimals(colKey || '', decimals);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  // Safe Excel Formula Evaluator
  const evaluateExcelFormula = (
    formulaInput: string,
    rowIndex: number,
    rowVals: Record<string, any>,
    rowsContext?: ChartRowData[],
    depth: number = 0
  ): number => {
    if (!formulaInput || typeof formulaInput !== 'string' || depth > 10) return 0;
    let expr = formulaInput.trim();
    if (expr.startsWith('=')) expr = expr.substring(1).trim();
    if (expr.startsWith('+')) expr = expr.substring(1).trim();

    if (!expr) return 0;

    const rowList = rowsContext || rows || [];

    // 1. Expand Excel Cell Range syntax like D2:D7 or SUM(D2:D7) or AVERAGE(A1:C3)
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
      const joined = cells.join(', ');
      const func = fnName ? fnName.toUpperCase() : 'SUM';
      return `${func}(${joined})`;
    });

    // 2. Replace Excel Cell References like A1, B1, C2, D1 with numeric values
    expr = expr.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      let colIdx = 0;
      const upperLetters = colLetters.toUpperCase();
      for (let i = 0; i < upperLetters.length; i++) {
        colIdx = colIdx * 26 + (upperLetters.charCodeAt(i) - 64);
      }
      colIdx = colIdx - 1;

      const targetRowIdx = parseInt(rowNumStr, 10) - 1;
      const targetCol = columns[colIdx];
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

      if (rawVal === undefined || rawVal === null || rawVal === '') {
        return '0';
      }

      if (typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'))) {
        const evaluatedTarget = evaluateExcelFormula(rawVal, targetRowIdx, targetVals, rowList, depth + 1);
        return String(evaluatedTarget);
      }

      if (targetCol.type === 'calculated') {
        const computedTarget = computeCell(targetCol, targetVals, targetRowIdx, rowList);
        const numVal = typeof computedTarget === 'number' ? computedTarget : parseFloat(String(computedTarget || 0));
        return isNaN(numVal) ? '0' : String(numVal);
      }

      const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
      return isNaN(numVal) ? '0' : String(numVal);
    });

    // 3. Replace column key identifiers like qty_lit, sp_gr, qty_kg, fat_pct, snf_pct
    columns.forEach(col => {
      if (expr.includes(col.key)) {
        const rawVal = rowVals[col.key];
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0));
        expr = expr.replaceAll(col.key, String(isNaN(numVal) ? 0 : numVal));
      }
    });

    // 4. Safely evaluate expression
    try {
      let cleanExpr = expr.replace(/[^0-9.\-+\/*%() ,a-zA-Z]/g, '').trim();
      cleanExpr = cleanExpr.replace(/[\-+\/*%,]+$/g, '').trim();
      if (!cleanExpr) return 0;

      let openCount = 0;
      for (let i = 0; i < cleanExpr.length; i++) {
        if (cleanExpr[i] === '(') openCount++;
        else if (cleanExpr[i] === ')') openCount--;
      }
      if (openCount > 0) {
        cleanExpr += ')'.repeat(openCount);
      }

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

  // Computed cell helper
  const computeCell = (col: ChartColumnDef, rowVals: Record<string, any>, rowIndex: number = 0, rowsContext?: ChartRowData[]) => {
    const rList = rowsContext || rows || [];
    const cellVal = rowVals ? rowVals[col.key] : undefined;

    // 1. If an explicit formula or value was set for this cell
    if (cellVal !== undefined && cellVal !== '' && cellVal !== null) {
      if (typeof cellVal === 'string' && (cellVal.startsWith('=') || cellVal.startsWith('=+'))) {
        return evaluateExcelFormula(cellVal, rowIndex, rowVals, rList);
      }
      if (typeof cellVal === 'number') return cellVal;
      const numVal = parseFloat(String(cellVal));
      if (!isNaN(numVal)) return numVal;
      return cellVal;
    }

    // 2. Default calculated column rules when cellVal is empty/undefined
    if (col.type === 'calculated') {
      if (col.formula) {
        return evaluateExcelFormula(`= ${col.formula}`, rowIndex, rowVals, rList);
      }
      const qtyLitVal = rowVals ? rowVals.qty_lit : undefined;
      const spGrVal = rowVals ? rowVals.sp_gr : undefined;

      const qtyLit = typeof qtyLitVal === 'string' && (qtyLitVal.startsWith('=') || qtyLitVal.startsWith('=+'))
        ? evaluateExcelFormula(qtyLitVal, rowIndex, rowVals, rList)
        : parseFloat(String(qtyLitVal || 0));

      const spGr = typeof spGrVal === 'string' && (spGrVal.startsWith('=') || spGrVal.startsWith('=+'))
        ? evaluateExcelFormula(spGrVal, rowIndex, rowVals, rList)
        : parseFloat(String(spGrVal || 0));

      const rawQtyKg = rowVals ? rowVals.qty_kg : undefined;
      const qtyKg = rawQtyKg !== undefined && rawQtyKg !== '' && rawQtyKg !== null
        ? (typeof rawQtyKg === 'string' && (rawQtyKg.startsWith('=') || rawQtyKg.startsWith('=+'))
          ? evaluateExcelFormula(rawQtyKg, rowIndex, rowVals, rList)
          : parseFloat(String(rawQtyKg || 0)))
        : (spGr > 0 ? qtyLit * spGr : qtyLit);

      const fatPctVal = rowVals ? rowVals.fat_pct : undefined;
      const fatPct = typeof fatPctVal === 'string' && (fatPctVal.startsWith('=') || fatPctVal.startsWith('=+'))
        ? evaluateExcelFormula(fatPctVal, rowIndex, rowVals, rList)
        : parseFloat(String(fatPctVal || 0));

      const snfPctVal = rowVals ? rowVals.snf_pct : undefined;
      const snfPct = typeof snfPctVal === 'string' && (snfPctVal.startsWith('=') || snfPctVal.startsWith('=+'))
        ? evaluateExcelFormula(snfPctVal, rowIndex, rowVals, rList)
        : parseFloat(String(snfPctVal || 0));

      if (col.key === 'qty_kg') return qtyKg;
      if (col.key === 'kg_fat') return (qtyKg * fatPct) / 100;
      if (col.key === 'kg_snf') return (qtyKg * snfPct) / 100;

      return 0;
    }
    return cellVal !== undefined ? cellVal : '';
  };

  // Shifts cell references in formulas (e.g., A1, B1, C2) when columns are inserted or deleted
  const shiftExcelFormulaReferences = (
    formula: string,
    action: 'insert' | 'delete',
    targetIdx: number
  ): string => {
    if (!formula || typeof formula !== 'string' || (!formula.includes('=') && !formula.startsWith('+'))) return formula;

    return formula.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      let cIdx = 0;
      const upperLetters = colLetters.toUpperCase();
      for (let i = 0; i < upperLetters.length; i++) {
        cIdx = cIdx * 26 + (upperLetters.charCodeAt(i) - 64);
      }
      cIdx = cIdx - 1;

      let newCIdx = cIdx;
      if (action === 'insert') {
        if (cIdx >= targetIdx) {
          newCIdx = cIdx + 1;
        }
      } else if (action === 'delete') {
        if (cIdx === targetIdx) {
          return '#REF!';
        }
        if (cIdx > targetIdx) {
          newCIdx = cIdx - 1;
        }
      }

      const newColLetters = getExcelColName(newCIdx);
      return `${newColLetters}${rowNumStr}`;
    });
  };

  // Adjusts Excel formula row references when dragging up/down
  const adjustFormulaRowOffset = (formula: string, sourceRowIdx: number, targetRowIdx: number): string => {
    if (!formula || typeof formula !== 'string') return formula;
    if (!formula.startsWith('=') && !formula.startsWith('+')) return formula;

    const rowOffset = targetRowIdx - sourceRowIdx;
    if (rowOffset === 0) return formula;

    return formula.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      const originalRowNum = parseInt(rowNumStr, 10);
      const newRowNum = Math.max(1, originalRowNum + rowOffset);
      return `${colLetters}${newRowNum}`;
    });
  };

  // Active cell details for Formula Bar
  const activeCellDetails = useMemo(() => {
    if (!selectedCell || !columns.length) {
      return { address: 'A1', colName: '', isCalculated: false, formulaText: '', value: '-' };
    }
    const colIdx = columns.findIndex(c => c.key === selectedCell.colKey);
    if (colIdx === -1) {
      return { address: 'A1', colName: '', isCalculated: false, formulaText: '', value: '-' };
    }

    const col = columns[colIdx];
    const excelColLetter = getExcelColName(colIdx);
    const excelRowNum = selectedCell.rowIndex + 1;
    const address = `${excelColLetter}${excelRowNum}`;

    const currentRow = rows[selectedCell.rowIndex] || { values: {} };
    const rowVals = currentRow.values || {};

    let formulaText = '';
    const computedVal = computeCell(col, rowVals, selectedCell.rowIndex, rows);

    const storedVal = rowVals[col.key];
    if (typeof storedVal === 'string' && (storedVal.startsWith('=') || storedVal.startsWith('=+'))) {
      formulaText = storedVal;
    } else if (col.type === 'calculated') {
      if (col.formula) {
        formulaText = `= ${col.formula}`;
      } else if (col.key === 'qty_kg') {
        const qtyLitLetter = getExcelColName(Math.max(0, columns.findIndex(c => c.key === 'qty_lit')));
        const spGrLetter = getExcelColName(Math.max(0, columns.findIndex(c => c.key === 'sp_gr')));
        formulaText = `= ${qtyLitLetter}${excelRowNum} * ${spGrLetter}${excelRowNum}`;
      } else if (col.key === 'kg_fat') {
        const qtyKgLetter = getExcelColName(Math.max(0, columns.findIndex(c => c.key === 'qty_kg')));
        const fatPctLetter = getExcelColName(Math.max(0, columns.findIndex(c => c.key === 'fat_pct')));
        formulaText = `= (${qtyKgLetter}${excelRowNum} * ${fatPctLetter}${excelRowNum}) / 100`;
      } else if (col.key === 'kg_snf') {
        const qtyKgLetter = getExcelColName(Math.max(0, columns.findIndex(c => c.key === 'qty_kg')));
        const snfPctLetter = getExcelColName(Math.max(0, columns.findIndex(c => c.key === 'snf_pct')));
        formulaText = `= (${qtyKgLetter}${excelRowNum} * ${snfPctLetter}${excelRowNum}) / 100`;
      } else {
        formulaText = `= CALCULATED`;
      }
    } else {
      const rawVal = storedVal !== undefined ? storedVal : (col.type === 'text' ? (currentRow.variant || '') : '');
      formulaText = rawVal !== '' ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
    }

    const formattedValDisplay = typeof computedVal === 'number'
      ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '0')
      : (computedVal || '-');

    return {
      address,
      colName: col.name,
      isCalculated: col.type === 'calculated',
      formulaText,
      value: formattedValDisplay
    };
  }, [selectedCell, columns, rows]);

  const handleCellChange = (rowIndex: number, colKey: string, rawVal: any) => {
    setIsDirty(true);
    setRows(prev => {
      const next = [...prev];
      const targetRow = { ...next[rowIndex] };
      const targetVals = { ...targetRow.values, [colKey]: rawVal };
      targetRow.values = targetVals;
      const col = columns.find(c => c.key === colKey);
      if (col?.type === 'text') {
        targetRow.variant = rawVal;
      }
      next[rowIndex] = targetRow;
      return next;
    });
  };

  // Excel Drag-to-Fill state & mouse listeners
  const [fillDrag, setFillDrag] = useState<{
    sourceRow: number;
    targetRow: number;
    colKey: string;
  } | null>(null);

  const handleFillDragStart = (e: React.MouseEvent, rowIndex: number, colKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFillDrag({
      sourceRow: rowIndex,
      targetRow: rowIndex,
      colKey,
    });
  };

  useEffect(() => {
    if (!fillDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const rowElem = elem?.closest('[data-row-index]');
      if (rowElem) {
        const rawIdx = rowElem.getAttribute('data-row-index');
        if (rawIdx !== null) {
          const rIdx = parseInt(rawIdx, 10);
          if (!isNaN(rIdx)) {
            setFillDrag(prev => prev ? { ...prev, targetRow: rIdx } : null);
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (fillDrag) {
        const { sourceRow, targetRow, colKey } = fillDrag;
        if (sourceRow !== targetRow) {
          setIsDirty(true);
          const minRow = Math.min(sourceRow, targetRow);
          const maxRow = Math.max(sourceRow, targetRow);

          setRows(prev => {
            const next = [...prev];
            const sourceVal = prev[sourceRow]?.values?.[colKey];
            for (let r = minRow; r <= maxRow; r++) {
              if (r === sourceRow) continue;
              const rData = { ...next[r] };
              const vals = { ...rData.values };
              let valToSet: any = sourceVal;
              if (typeof sourceVal === 'string' && (sourceVal.startsWith('=') || sourceVal.startsWith('+'))) {
                valToSet = adjustFormulaRowOffset(sourceVal, sourceRow, r);
              }
              vals[colKey] = valToSet;
              rData.values = vals;
              const col = columns.find(c => c.key === colKey);
              if (col?.type === 'text') rData.variant = valToSet;
              next[r] = rData;
            }
            return next;
          });
        }
      }
      setFillDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [fillDrag, columns]);

  // Column Actions
  const handleOpenAddColumn = (insertIdx?: number) => {
    setColModalEditingKey(null);
    setColModalInsertIdx(insertIdx !== undefined ? insertIdx : columns.length);
    setFormColKey('');
    setFormColName('');
    setFormColType('number');
    setFormColFormula('');
    setFormColUnit('');
    setFormColDecimals(undefined);
    setIsColModalOpen(true);
  };

  const handleOpenEditColumn = (col: ChartColumnDef) => {
    setColModalInsertIdx(null);
    setColModalEditingKey(col.key);
    setFormColKey(col.key);
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
      alert('Please enter a Column Name');
      return;
    }

    const keyToUse = colModalEditingKey || formColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || formColName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const newCol: ChartColumnDef = {
      key: keyToUse,
      name: formColName.trim(),
      type: formColType,
      formula: formColType === 'calculated' ? formColFormula.trim() : undefined,
      unit: formColUnit.trim(),
      decimals: formColDecimals !== undefined ? formColDecimals : undefined,
      sort_order: colModalEditingKey
        ? (columns.find(c => c.key === colModalEditingKey)?.sort_order || columns.length + 1)
        : (colModalInsertIdx !== null ? colModalInsertIdx + 1 : columns.length + 1),
      is_active: true,
    };

    let updatedCols: ChartColumnDef[];
    let targetShiftIdx: number | null = null;
    let shiftAction: 'insert' | 'delete' | null = null;

    if (colModalEditingKey) {
      updatedCols = columns.map(c => (c.key === colModalEditingKey ? newCol : c));
    } else {
      if (columns.some(c => c.key === newCol.key)) {
        alert(`Column key "${newCol.key}" already exists! Please use a unique column name.`);
        return;
      }
      updatedCols = [...columns];
      const insertIdx = colModalInsertIdx !== null ? colModalInsertIdx : columns.length;
      updatedCols.splice(insertIdx, 0, newCol);
      targetShiftIdx = insertIdx;
      shiftAction = 'insert';
    }

    const reindexedCols = updatedCols.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(reindexedCols);
    if (activeChartKey) {
      setChartColumnsMap(prev => ({
        ...prev,
        [activeChartKey]: reindexedCols,
      }));
    }

    // Shift formula references on rows for this active chart only
    if (shiftAction && targetShiftIdx !== null) {
      const shiftedIdx = targetShiftIdx;
      setRows(prev => {
        return prev.map(row => {
          const updatedVals = { ...row.values };
          Object.keys(updatedVals).forEach(vk => {
            const val = updatedVals[vk];
            if (typeof val === 'string' && (val.startsWith('=') || val.startsWith('+'))) {
              updatedVals[vk] = shiftExcelFormulaReferences(val, 'insert', shiftedIdx);
            }
          });
          return { ...row, values: updatedVals };
        });
      });
    }

    setIsDirty(true);
    setIsColModalOpen(false);
    showToast(colModalEditingKey ? `Updated column "${newCol.name}" for this chart master. Click "⭐ Save Master Default Table" to save to database.` : `Inserted column "${newCol.name}" for this chart master. Click "⭐ Save Master Default Table" to save to database.`);
  };

  const chartDecimalMode = useMemo(() => {
    const numCols = columns.filter(c => c.type !== 'text');
    if (numCols.length === 0) return '';
    const firstDec = numCols[0].decimals;
    if (firstDec === undefined) return '';
    const allSame = numCols.every(c => c.decimals === firstDec);
    return allSame ? String(firstDec) : 'custom';
  }, [columns]);

  const handleApplyGlobalDecimals = (decimalsVal: string) => {
    const numDec = decimalsVal !== '' && decimalsVal !== 'custom' ? parseInt(decimalsVal, 10) : undefined;
    const updatedCols = columns.map(c => c.type !== 'text' ? { ...c, decimals: numDec } : c);
    setColumns(updatedCols);
    if (activeChartKey) {
      setChartColumnsMap(prev => ({
        ...prev,
        [activeChartKey]: updatedCols,
      }));
    }
    setIsDirty(true);
    showToast(`Updated column decimal precision for this chart master. Click "⭐ Save Master Default Table" to save to database.`);
  };

  const handleDeleteColumnInline = async (key: string, colIdx: number) => {
    if (columns.length <= 1) {
      await showWarning('Cannot delete the last remaining column.', 'Cannot Delete Column');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Confirm Column Deletion',
      message: `Are you sure you want to delete column "${columns[colIdx]?.name}" from this chart master?`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!isConfirmed) return;

    const filteredCols = columns.filter(c => c.key !== key).map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(filteredCols);
    if (activeChartKey) {
      setChartColumnsMap(prev => ({
        ...prev,
        [activeChartKey]: filteredCols,
      }));
    }

    // Shift formulas on deleted column index for this active chart only
    setRows(prev => {
      return prev.map(row => {
        const updatedVals = { ...row.values };
        delete updatedVals[key];
        Object.keys(updatedVals).forEach(vk => {
          const val = updatedVals[vk];
          if (typeof val === 'string' && (val.startsWith('=') || val.startsWith('+'))) {
            updatedVals[vk] = shiftExcelFormulaReferences(val, 'delete', colIdx);
          }
        });
        return { ...row, values: updatedVals };
      });
    });

    setIsDirty(true);
    showToast(`Deleted column "${key}" from this chart master. Click "⭐ Save Master Default Table" to save to database.`);
  };

  // Save Master Default Formulation Template & Columns for Current Master
  const handleSaveDefaultTemplate = async () => {
    if (!activeChartKey) return;
    setSaving(true);
    const chartMaster = masters.find(m => m.key === activeChartKey);

    try {
      const templatePayload = {
        chart_key: activeChartKey,
        rows: rows,
        target_batch_liters: targetBatchLit,
        target_fat: targetFat,
        target_snf: targetSnf,
        columns: columns,
      };

      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_key: activeChartKey,
          columns: columns,
          template: templatePayload,
        }),
      });

      if (res.ok) {
        setTemplates(prev => ({
          ...prev,
          [activeChartKey]: templatePayload,
        }));
        setChartColumnsMap(prev => ({
          ...prev,
          [activeChartKey]: columns,
        }));
        setIsDirty(false);
        showToast(`⭐ Saved Master Default formulation table and columns for "${chartMaster?.name || activeChartKey}" in database! All un-entered daily charts will inherit these defaults.`);
      } else {
        showToast('❌ Failed to save default master template');
      }
    } catch (err) {
      console.error('Save master template error:', err);
      showToast('❌ Server error saving master template');
    }
    setSaving(false);
  };

  // Open Save As Modal
  const handleOpenSaveAs = () => {
    if (!activeMaster) return;
    setSaveAsName(`${activeMaster.name} (COPY)`);
    setSaveAsKey('');
    setSaveAsVariant(activeMaster.product_variant || '');
    setSaveAsBatchLit(targetBatchLit !== undefined ? String(targetBatchLit) : (activeMaster.target_batch_liters !== undefined ? String(activeMaster.target_batch_liters) : ''));
    setSaveAsFat(targetFat !== undefined ? String(targetFat) : (activeMaster.target_fat !== undefined ? String(activeMaster.target_fat) : ''));
    setSaveAsSnf(targetSnf !== undefined ? String(targetSnf) : (activeMaster.target_snf !== undefined ? String(activeMaster.target_snf) : ''));
    setSaveAsSpGr(activeMaster.target_sp_gr !== undefined ? String(activeMaster.target_sp_gr) : '');
    setSaveAsDescription(activeMaster.description || '');
    setIsSaveAsModalOpen(true);
  };

  // Save As Separate Master Default Template
  const handleSaveAsSeparateMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveAsName.trim()) {
      alert('Please enter a Chart Name');
      return;
    }

    const keyToUse = saveAsKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      saveAsName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (masters.some(m => m.key === keyToUse)) {
      alert(`A chart with key "${keyToUse}" already exists! Please use a unique Chart Name.`);
      return;
    }

    setSaving(true);
    const newMaster: ChartMasterDef = {
      key: keyToUse,
      name: saveAsName.trim().toUpperCase(),
      product_variant: saveAsVariant.trim().toUpperCase() || saveAsName.trim().split(' ')[0],
      target_fat: saveAsFat !== '' ? parseFloat(saveAsFat) : undefined,
      target_snf: saveAsSnf !== '' ? parseFloat(saveAsSnf) : undefined,
      target_sp_gr: saveAsSpGr !== '' ? parseFloat(saveAsSpGr) : undefined,
      target_batch_liters: saveAsBatchLit !== '' ? parseFloat(saveAsBatchLit) : undefined,
      description: saveAsDescription.trim(),
      sort_order: masters.length + 1,
      is_active: true,
    };

    // Deep clone current columns and rows so changes to this new master NEVER affect original master
    const clonedColumns: ChartColumnDef[] = JSON.parse(JSON.stringify(columns));
    const clonedRows: ChartRowData[] = JSON.parse(JSON.stringify(rows));

    const updatedMasters = [...masters, newMaster];

    const templatePayload = {
      chart_key: keyToUse,
      rows: clonedRows,
      target_batch_liters: newMaster.target_batch_liters,
      target_fat: newMaster.target_fat,
      target_snf: newMaster.target_snf,
      columns: clonedColumns,
    };

    try {
      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masters: updatedMasters,
          chart_key: keyToUse,
          columns: clonedColumns,
          template: templatePayload,
        }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setTemplates(prev => ({
          ...prev,
          [keyToUse]: templatePayload,
        }));
        setChartColumnsMap(prev => ({
          ...prev,
          [keyToUse]: clonedColumns,
        }));

        setIsSaveAsModalOpen(false);
        setIsDirty(false);
        setActiveChartKey(keyToUse);
        loadChartMasterDefaults(keyToUse, updatedMasters, {
          ...templates,
          [keyToUse]: templatePayload,
        }, {
          ...chartColumnsMap,
          [keyToUse]: clonedColumns,
        }, defaultColumns);

        showToast(`⭐ Saved as new separate Master Default Template "${newMaster.name}"! The original master template is completely unaffected.`);
      } else {
        showToast('❌ Failed to save new master template');
      }
    } catch (err) {
      console.error('Save as master template error:', err);
      showToast('❌ Server error saving new master template');
    }
    setSaving(false);
  };

  // Open New Master Modal
  const handleOpenNewMaster = () => {
    setNewMasterName('');
    setNewMasterKey('');
    setNewMasterVariant('');
    setNewMasterBatchLit('');
    setNewMasterFat('');
    setNewMasterSnf('');
    setNewMasterSpGr('');
    setNewMasterDescription('');
    setNewMasterSource(activeChartKey || 'blank');
    setIsNewMasterModalOpen(true);
  };

  // Create Brand New Master Template
  const handleCreateNewMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim()) {
      alert('Please enter a Chart Name');
      return;
    }

    const keyToUse = newMasterKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      newMasterName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (masters.some(m => m.key === keyToUse)) {
      alert(`A chart with key "${keyToUse}" already exists! Please use a unique Chart Name.`);
      return;
    }

    setSaving(true);
    const newMaster: ChartMasterDef = {
      key: keyToUse,
      name: newMasterName.trim().toUpperCase(),
      product_variant: newMasterVariant.trim().toUpperCase() || newMasterName.trim().split(' ')[0],
      target_fat: newMasterFat !== '' ? parseFloat(newMasterFat) : undefined,
      target_snf: newMasterSnf !== '' ? parseFloat(newMasterSnf) : undefined,
      target_sp_gr: newMasterSpGr !== '' ? parseFloat(newMasterSpGr) : undefined,
      target_batch_liters: newMasterBatchLit !== '' ? parseFloat(newMasterBatchLit) : undefined,
      description: newMasterDescription.trim(),
      sort_order: masters.length + 1,
      is_active: true,
    };

    let initialCols: ChartColumnDef[];
    let initialRows: ChartRowData[];

    if (newMasterSource === 'blank' || !templates[newMasterSource]) {
      initialCols = JSON.parse(JSON.stringify(defaultColumns));
      initialRows = [{ variant: '', values: {} }];
    } else {
      const sourceTmpl = templates[newMasterSource];
      const sourceCols = chartColumnsMap[newMasterSource] || sourceTmpl?.columns || defaultColumns;
      initialCols = JSON.parse(JSON.stringify(sourceCols));
      initialRows = JSON.parse(JSON.stringify(sourceTmpl?.rows || [{ variant: '', values: {} }]));
    }

    const updatedMasters = [...masters, newMaster];

    const templatePayload = {
      chart_key: keyToUse,
      rows: initialRows,
      target_batch_liters: newMaster.target_batch_liters,
      target_fat: newMaster.target_fat,
      target_snf: newMaster.target_snf,
      columns: initialCols,
    };

    try {
      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masters: updatedMasters,
          chart_key: keyToUse,
          columns: initialCols,
          template: templatePayload,
        }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setTemplates(prev => ({
          ...prev,
          [keyToUse]: templatePayload,
        }));
        setChartColumnsMap(prev => ({
          ...prev,
          [keyToUse]: initialCols,
        }));

        setIsNewMasterModalOpen(false);
        setIsDirty(false);
        setActiveChartKey(keyToUse);
        loadChartMasterDefaults(keyToUse, updatedMasters, {
          ...templates,
          [keyToUse]: templatePayload,
        }, {
          ...chartColumnsMap,
          [keyToUse]: initialCols,
        }, defaultColumns);

        showToast(`✅ Created new Chart Master "${newMaster.name}" with its own separate default template!`);
      } else {
        showToast('❌ Failed to create new chart master');
      }
    } catch (err) {
      console.error('Error creating new chart master:', err);
      showToast('❌ Server error creating chart master');
    }
    setSaving(false);
  };

  const activeMaster = useMemo(() => {
    if (!activeChartKey) return null;
    return masters.find(m => m.key === activeChartKey) || null;
  }, [masters, activeChartKey]);

  return (
    <>
      <Header
        title="Master Default Formulation Tables"
        subtitle="Manage default batch formulation templates & pre-defined formulas inherited by daily preparation charts"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/stock/preparation-charts" className="btn btn-primary btn-sm">
              🗓️ Daily Preparation Charts Dashboard
            </Link>
            <Link href="/dashboard/stock/preparation-charts/masters" className="btn btn-secondary btn-sm">
              ⚙️ Preparation Chart Master Names
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
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
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Master Selector Tabs Bar */}
        <div className="card" style={{ marginBottom: 12, padding: '12px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Select Chart Master Name:
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              💡 Each master has its own separate default template and columns.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {masters.map(m => {
              const isSelected = m.key === activeChartKey;
              return (
                <button
                  key={`default_tab_${m.key}`}
                  type="button"
                  onClick={() => handleSwitchChartMaster(m.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: isSelected ? '#b45309' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#475569',
                    border: isSelected ? '1px solid #b45309' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📋 {m.name}</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>({m.product_variant || 'DEFAULT'})</span>
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
                background: '#f8fafc',
                color: '#0284c7',
                border: '1px dashed #38bdf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Add a brand new Chart Master and default template"
            >
              <span>➕ Add Chart Master</span>
            </button>
          </div>
        </div>

        {/* Main formulation Table Card */}
        {activeChartKey && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* Table Header Bar */}
            <div style={{ padding: '12px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⭐ Default Master Template for {activeMaster?.name}</span>
                  <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    {activeMaster?.product_variant || 'DEFAULT'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: 2 }}>
                  Formulas and values saved here will automatically populate on all un-entered daily preparation charts for this master.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleOpenSaveAs}
                  className="btn btn-secondary btn-sm"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #f59e0b',
                    color: '#b45309',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.8rem',
                    padding: '5px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                  title="Save current formulation table as a new separate Master Template without modifying existing templates"
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
                  {isColEditing ? '⚙️ Done Editing Columns' : '✏️ Edit Table Columns'}
                </button>

                {isColEditing && (
                  <button
                    type="button"
                    onClick={() => handleOpenAddColumn()}
                    style={{ background: '#f0f9ff', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ➕ Add Column
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setRows(prev => [
                      ...prev,
                      { variant: '', values: {} }
                    ]);
                    setIsDirty(true);
                  }}
                  style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  ➕ Add Ingredient Row
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
                  minWidth: 65,
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Excel Formula Indicator"
              >
                <span>ƒx</span>
              </div>

              <div style={{ height: 20, width: 1, background: '#fcd34d' }} />

              {/* Active Column Name & Formula Input */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
                {activeCellDetails.colName && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: '#fef3c7',
                      color: '#b45309',
                      padding: '2px 8px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activeCellDetails.colName}
                  </span>
                )}
                <input
                  type="text"
                  className="form-input"
                  disabled={!selectedCell}
                  value={activeCellDetails.formulaText}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onChange={e => {
                    if (!selectedCell) return;
                    handleCellChange(selectedCell.rowIndex, selectedCell.colKey, e.target.value);
                  }}
                  placeholder={selectedCell ? "Enter default value or formula e.g. =+B1*A1" : "Click any cell in the table below to inspect or enter default formula"}
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: '#ffffff',
                    color: activeCellDetails.formulaText.startsWith('=') ? '#b45309' : 'var(--text-primary)',
                    borderColor: selectedCell ? '#b45309' : 'var(--border)',
                    height: 30,
                  }}
                />
              </div>

              {/* Computed Value Result Badge */}
              {selectedCell && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: '#78350f' }}>Value:</span>
                  <span style={{ fontFamily: 'var(--font-numbers)', fontWeight: 800 }}>{activeCellDetails.value}</span>
                </div>
              )}
            </div>

            {/* Scrollable Table Viewport */}
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
              <table className="inline-table" style={{ width: '100%', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                    {columns.map((col, cIdx) => (
                      <th
                        key={`m_col_${col.key}`}
                        style={{
                          textAlign: col.type === 'text' ? 'left' : 'right',
                          background: col.type === 'calculated' ? '#e0f2fe' : '#f1f5f9',
                          color: col.type === 'calculated' ? '#0369a1' : 'var(--text-primary)',
                          padding: '8px 10px',
                          fontSize: '0.82rem',
                          minWidth: 110,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 4 }}>
                          <span style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: 800, fontFamily: 'monospace' }}>
                            {getExcelColName(cIdx)}
                          </span>
                          {isColEditing && (
                            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenAddColumn(cIdx)}
                                style={{ background: '#ffffff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 3, padding: '1px 4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                title="Insert Column to Left"
                              >
                                +L
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAddColumn(cIdx + 1)}
                                style={{ background: '#ffffff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 3, padding: '1px 4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                title="Insert Column to Right"
                              >
                                +R
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditColumn(col)}
                                style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 3, padding: '1px 4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                title="Edit Column Details / Rename"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteColumnInline(col.key, cIdx)}
                                style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 3, padding: '1px 4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                title="Delete Column"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.type === 'text' ? 'flex-start' : 'space-between', gap: 6 }}>
                          <span>{col.name} {col.unit ? `(${col.unit})` : ''}</span>
                          {col.type !== 'text' && (
                            <select
                              value={col.decimals !== undefined ? String(col.decimals) : ''}
                              onChange={(e) => {
                                const val = e.target.value !== '' ? parseInt(e.target.value, 10) : undefined;
                                const updated = columns.map(c => c.key === col.key ? { ...c, decimals: val } : c);
                                setColumns(updated);
                                if (activeChartKey) {
                                  setChartColumnsMap(prev => ({
                                    ...prev,
                                    [activeChartKey]: updated,
                                  }));
                                }
                                setIsDirty(true);
                              }}
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 4px',
                                height: 20,
                                fontWeight: 700,
                                color: '#0369a1',
                                background: '#ffffff',
                                border: '1px solid #bae6fd',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                              title={`Set required decimal places for column ${col.name}`}
                            >
                              <option value="">Auto ({getStandardColumnDecimals(col.key)})</option>
                              <option value="0">.0 (Whole)</option>
                              <option value="1">.1 Dec</option>
                              <option value="2">.2 Decs</option>
                              <option value="3">.3 Decs</option>
                              <option value="4">.4 Decs</option>
                            </select>
                          )}
                        </div>
                      </th>
                    ))}
                    {isColEditing && (
                      <th style={{ width: 120, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenAddColumn()}
                          style={{ background: '#f0f9ff', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          title="Add New Column at End"
                        >
                          ➕ Column
                        </button>
                      </th>
                    )}
                    <th style={{ width: 110, textAlign: 'center' }}>Row Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={`modal_row_${rIdx}`}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem' }}>
                        {rIdx + 1}
                      </td>
                      {columns.map((col, cIdx) => {
                        const isCellSelected = selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;
                        const isCellFocused = focusedCell?.rowIndex === rIdx && focusedCell?.colKey === col.key;
                        const computedVal = computeCell(col, row.values || {}, rIdx, rows);

                        if (col.type === 'calculated') {
                          const formattedCalc = typeof computedVal === 'number'
                            ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '-')
                            : (computedVal || '-');

                          return (
                            <td
                              key={`m_cell_${rIdx}_${col.key}`}
                              onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key })}
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: '#0369a1',
                                background: isCellSelected ? '#bae6fd' : '#f0f9ff',
                                fontFamily: 'var(--font-numbers)',
                                outline: isCellSelected ? '2px solid #0284c7' : 'none',
                                outlineOffset: -2,
                                cursor: 'pointer',
                              }}
                              title={`Cell ${getExcelColName(cIdx)}${rIdx + 1} (${col.name}): Click to view formula`}
                            >
                              {formattedCalc}
                            </td>
                          );
                        }

                        const rawVal = row.values?.[col.key];
                        const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                        let displayVal = rawVal !== undefined ? rawVal : (col.type === 'text' ? row.variant : '');
                        if (isFormula && !isCellFocused) {
                          displayVal = typeof computedVal === 'number'
                            ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '-')
                            : String(computedVal || '-');
                        } else if (!isCellFocused && !isFormula && rawVal !== undefined && rawVal !== '' && col.type === 'number') {
                          const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
                          if (!isNaN(numVal)) {
                            displayVal = formatNumberValue(numVal, col.decimals, col.key);
                          }
                        }

                        const isDraggedInFillModal = !!(fillDrag && fillDrag.colKey === col.key &&
                          rIdx >= Math.min(fillDrag.sourceRow, fillDrag.targetRow) &&
                          rIdx <= Math.max(fillDrag.sourceRow, fillDrag.targetRow));

                        return (
                          <td key={`m_cell_${rIdx}_${col.key}`} data-row-index={rIdx} style={{ position: 'relative' }}>
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
                                title={`Default Formula Present: ${rawVal}`}
                              />
                            )}
                            <input
                              type="text"
                              className="form-input"
                              value={displayVal}
                              placeholder="-"
                              title={isFormula ? `Default Formula: ${rawVal}` : undefined}
                              onFocus={() => {
                                setSelectedCell({ rowIndex: rIdx, colKey: col.key });
                                setFocusedCell({ rowIndex: rIdx, colKey: col.key });
                              }}
                              onBlur={() => setFocusedCell(null)}
                              onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              onChange={e => handleCellChange(rIdx, col.key, e.target.value)}
                              style={{
                                padding: isFormula ? '3px 6px 3px 10px' : '3px 6px',
                                fontSize: '0.8rem',
                                height: 28,
                                textAlign: col.type === 'text' ? 'left' : 'right',
                                fontFamily: col.type === 'text' ? 'inherit' : 'var(--font-numbers)',
                                fontWeight: isFormula ? 800 : 700,
                                background: isDraggedInFillModal
                                  ? '#fef3c7'
                                  : isCellSelected
                                    ? '#fef3c7'
                                    : isFormula
                                      ? '#fffbeb'
                                      : '#ffffff',
                                color: isFormula ? '#b45309' : 'var(--text-primary)',
                                borderColor: isDraggedInFillModal
                                  ? '#b45309'
                                  : isCellSelected
                                    ? '#b45309'
                                    : isFormula
                                      ? '#fcd34d'
                                      : 'var(--border)',
                                boxShadow: isDraggedInFillModal
                                  ? '0 0 0 2px rgba(180, 83, 9, 0.45)'
                                  : isCellSelected
                                    ? '0 0 0 2px rgba(180, 83, 9, 0.25)'
                                    : 'none',
                              }}
                            />

                            {/* Excel Fill Handle Square */}
                            {isCellSelected && (
                              <div
                                onMouseDown={e => handleFillDragStart(e, rIdx, col.key)}
                                style={{
                                  position: 'absolute',
                                  bottom: 2,
                                  right: 2,
                                  width: 8,
                                  height: 8,
                                  background: '#b45309',
                                  border: '1px solid #ffffff',
                                  cursor: 'ns-resize',
                                  zIndex: 10,
                                  borderRadius: 1,
                                }}
                                title="Excel Fill Handle: Drag up or down to auto-fill default formula/values to adjacent cells with relative row adjustment"
                              />
                            )}
                          </td>
                        );
                      })}
                      {isColEditing && (
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.72rem' }}>
                          —
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (rIdx === 0) return;
                              setIsDirty(true);
                              setRows(prev => {
                                const copy = [...prev];
                                const temp = copy[rIdx];
                                copy[rIdx] = copy[rIdx - 1];
                                copy[rIdx - 1] = temp;
                                return copy;
                              });
                            }}
                            disabled={rIdx === 0}
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '1px 5px', fontSize: '0.7rem', cursor: 'pointer' }}
                            title="Move Row Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (rIdx === rows.length - 1) return;
                              setIsDirty(true);
                              setRows(prev => {
                                const copy = [...prev];
                                const temp = copy[rIdx];
                                copy[rIdx] = copy[rIdx + 1];
                                copy[rIdx + 1] = temp;
                                return copy;
                              });
                            }}
                            disabled={rIdx === rows.length - 1}
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '1px 5px', fontSize: '0.7rem', cursor: 'pointer' }}
                            title="Move Row Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDirty(true);
                              setRows(prev => {
                                const copy = [...prev];
                                copy.splice(rIdx + 1, 0, { variant: '', values: {} });
                                return copy;
                              });
                            }}
                            style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', borderRadius: 4, padding: '1px 6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                            title="Insert Empty Row Below"
                          >
                            ➕ Insert
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDirty(true);
                              setRows(prev => prev.filter((_, i) => i !== rIdx));
                            }}
                            style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontSize: '0.7rem', cursor: 'pointer' }}
                            title="Delete Row"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pinned Card Footer */}
            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                ⭐ Changes saved here will be stored in database as the Master Default template.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/dashboard/stock/preparation-charts" className="btn btn-secondary btn-sm">
                  Cancel
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenSaveAs}
                  disabled={saving || !activeChartKey}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d97706',
                    color: '#b45309',
                    fontWeight: 700,
                  }}
                  title="Save this table as a new separate Master Template without modifying existing templates"
                >
                  💾 Save Template
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveDefaultTemplate}
                  disabled={saving || !activeChartKey}
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  {saving ? 'Saving Default...' : '⭐ Save Master Default Table'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Column Inline */}
      {isColModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 10050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: 520,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {colModalEditingKey ? '✏️ Edit Preparation Column' : `➕ Insert Column at Position ${getExcelColName(colModalInsertIdx !== null ? colModalInsertIdx : columns.length)}`}
              </div>
              <button
                type="button"
                onClick={() => setIsColModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveColumnModal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Column Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Qty (Lit), Sp.gr, Fat%, Kg SNF"
                  value={formColName}
                  onChange={e => {
                    setFormColName(e.target.value);
                    if (!colModalEditingKey) {
                      setFormColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Field Key</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. qty_lit, sp_gr, fat_pct"
                  value={formColKey}
                  onChange={e => setFormColKey(e.target.value)}
                  disabled={!!colModalEditingKey}
                  style={{ background: colModalEditingKey ? '#f1f5f9' : '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data Type</label>
                  <select
                    className="form-select"
                    value={formColType}
                    onChange={e => setFormColType(e.target.value as any)}
                  >
                    <option value="number">Number (Input)</option>
                    <option value="text">Text (Variant/Name)</option>
                    <option value="calculated">Calculated (Formula)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Decimal Places</label>
                  <select
                    className="form-select"
                    value={formColDecimals !== undefined ? String(formColDecimals) : ''}
                    onChange={e => setFormColDecimals(e.target.value !== '' ? parseInt(e.target.value, 10) : undefined)}
                  >
                    <option value="">Auto / Default</option>
                    <option value="0">0 - Whole Number (102)</option>
                    <option value="1">1 Decimal Place (1.0)</option>
                    <option value="2">2 Decimal Places (1.02)</option>
                    <option value="3">3 Decimal Places (1.023)</option>
                    <option value="4">4 Decimal Places (1.0234)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Unit (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Liters, Kg, %"
                    value={formColUnit}
                    onChange={e => setFormColUnit(e.target.value)}
                  />
                </div>
              </div>

              {formColType === 'calculated' && (
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Formula Expression</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. B1 * C1 or (D1 * E1) / 100"
                    value={formColFormula}
                    onChange={e => setFormColFormula(e.target.value)}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
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
                >
                  {colModalEditingKey ? '💾 Update Column' : '➕ Save & Insert Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Save As Separate Master Default Template */}
      {isSaveAsModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 10050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: 580,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💾 Save As Separate Master Template</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: 2 }}>
                  Create an independent Master Chart based on <strong>{activeMaster?.name}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveAsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#78350f', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAsSeparateMaster} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.78rem', color: '#166534', lineHeight: 1.45 }}>
                ✨ <strong>Completely Separate & Isolated:</strong> The current formulation table ({rows.length} rows, {columns.length} columns, and all formulas) will be copied to this new master. Future edits made here or in this new template will <strong>NEVER affect each other</strong>.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>New Chart Master Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. TONED MILK PREPARATION CHART"
                    value={saveAsName}
                    onChange={e => {
                      setSaveAsName(e.target.value);
                      if (!saveAsKey) {
                        setSaveAsKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                      }
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Product Variant <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. TM, SM, FCM"
                    value={saveAsVariant}
                    onChange={e => setSaveAsVariant(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Field Key (Unique Identifier)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. toned_milk_prep_chart"
                  value={saveAsKey}
                  onChange={e => setSaveAsKey(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
              </div>             

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Master formulation template for standardized toned milk"
                  value={saveAsDescription}
                  onChange={e => setSaveAsDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsSaveAsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  {saving ? 'Saving Separate Master...' : '⭐ Confirm & Save As Separate Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Creating Brand New Master Template */}
      {isNewMasterModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 10050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: 580,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>➕ Create New Preparation Chart Master</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: 2 }}>
                  Set up a new milk/cream formulation table with its own independent default template
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewMasterModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#0369a1', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewMaster} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Chart Master Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. FCM 2 PREPARATION CHART"
                    value={newMasterName}
                    onChange={e => {
                      setNewMasterName(e.target.value);
                      if (!newMasterKey) {
                        setNewMasterKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                      }
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Product Variant <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. FCM, TM, SM"
                    value={newMasterVariant}
                    onChange={e => setNewMasterVariant(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Initial Formulation Template</label>
                <select
                  className="form-select"
                  value={newMasterSource}
                  onChange={e => setNewMasterSource(e.target.value)}
                >
                  <option value="blank">✨ Clean empty table (1 empty ingredient row)</option>
                  {masters.map(m => (
                    <option key={`new_src_${m.key}`} value={m.key}>
                      📋 Copy initial formulation from "{m.name}" ({m.product_variant || 'DEFAULT'})
                    </option>
                  ))}
                </select>
              </div>                
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Description or notes for this formulation chart"
                  value={newMasterDescription}
                  onChange={e => setNewMasterDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsNewMasterModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? 'Creating Master...' : '➕ Create Master Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
