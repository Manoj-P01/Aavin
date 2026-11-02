// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – NKL Solid Balance Details (STG) Entry Form
// Renders single formulation matrix grid matching Master Default Formulation Tables
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Step, { DAILY_ENTRY_STEP_ITEMS } from '@/components/ui/Step';
import { useRouter, useSearchParams } from 'next/navigation';
import { fmtNum, cleanStatementLabel, getStandardColumnDecimals } from '@/lib/calculations';
import { useConfirm } from '@/context/ConfirmContext';
import MasterDetailLayout from '@/components/ui/MasterDetailLayout';
import type { Shift } from '@/lib/types';

type STGProductBlock = string;

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

export interface STGRowData {
  variant: string;
  values: Record<string, any>;
}

export interface STGBlockState {
  rows: STGRowData[];
  cmpdd_norm?: string;
  summary_overrides?: Record<string, string>;
  opening_balance?: {
    qty_lts?: string;
    qty_kg?: string;
    fat_pct?: string;
    snf_pct?: string;
    sp_gr?: string;
    kg_fat?: string;
    kg_snf?: string;
  };
  physical_count?: {
    qty_lts?: string;
    qty_kg?: string;
    fat_pct?: string;
    snf_pct?: string;
    sp_gr?: string;
    kg_fat?: string;
    kg_snf?: string;
  };
}

export interface STGEntryFormProps {
  onRegisterActions?: (actions: { handleSave: () => void; saving: boolean }) => void;
  saveButtonRef?: React.RefObject<HTMLDivElement | null>;
  stepMode?: boolean;
  activeStep?: string;
  onStepChange?: (stepKey: string) => void;
  onNextStep?: (date?: string, shift?: any) => void;
  onPrevStep?: (date?: string, shift?: any) => void;
  onDateShiftChange?: (date: string, shift: Shift | null) => void;
  initialDate?: string;
  initialShift?: Shift | null;
}

export default function STGEntryForm({
  onRegisterActions,
  saveButtonRef,
  stepMode = false,
  activeStep,
  onStepChange,
  onNextStep,
  onPrevStep,
  onDateShiftChange,
  initialDate,
  initialShift,
}: STGEntryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, showSuccess, showWarning } = useConfirm();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const [entryDate, setEntryDate] = useState(initialDate || paramDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift | null>(
    initialShift !== undefined ? initialShift : ((paramShift === 'D' || paramShift === 'N') ? paramShift : null)
  );

  useEffect(() => {
    if (initialDate && initialDate !== entryDate) {
      setEntryDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (initialShift !== undefined && initialShift !== shift) {
      setShift(initialShift);
    }
  }, [initialShift]);
  const [shiftConfigs, setShiftConfigs] = useState<any[]>([
    { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
    { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
  ]);
  const [notes, setNotes] = useState('');
  const [statements, setStatements] = useState<Array<{ key: string; label: string; variant?: string }>>([]);
  const [enabledBlockKeys, setEnabledBlockKeys] = useState<string[]>([]);
  const [activeBlock, setActiveBlock] = useState<STGProductBlock>('');
  const [blocks, setBlocks] = useState<Record<string, STGBlockState>>({});
  const [reportMode, setReportMode] = useState<'full_day' | 'shift'>('full_day');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedCell, setSelectedCell] = useState<{ blockKey: string; rowIndex: number | string; colKey: string; fieldKey?: string } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ blockKey: string; rowIndex: number; colKey: string } | null>(null);
  const [fillDrag, setFillDrag] = useState<{ blockKey: string; sourceRow: number; targetRow: number; colKey: string } | null>(null);
  const [productOptions, setProductOptions] = useState<string[]>([]);

  // Columns definition matching Master Default Formulation Tables
  const [stgColumns, setStgColumns] = useState<STGColumnDef[]>([
    { key: 'variant', name: 'VARIANT', type: 'text', sort_order: 1 },
    { key: 'qty_lts', name: 'QTY (LTS)', type: 'number', decimals: 0, sort_order: 2 },
    { key: 'sp_gr', name: 'SP.GR', type: 'number', decimals: 4, sort_order: 3 },
    { key: 'qty_kg', name: 'QTY (KG)', type: 'calculated', formula: 'qty_lts * sp_gr', decimals: 2, sort_order: 4 },
    { key: 'fat_pct', name: 'FAT (%)', type: 'number', decimals: 2, sort_order: 5 },
    { key: 'snf_pct', name: 'SNF (%)', type: 'number', decimals: 2, sort_order: 6 },
    { key: 'kg_fat', name: 'KG FAT', type: 'calculated', formula: 'qty_kg * fat_pct / 100', decimals: 3, sort_order: 7 },
    { key: 'kg_snf', name: 'KG SNF', type: 'calculated', formula: 'qty_kg * snf_pct / 100', decimals: 3, sort_order: 8 },
  ]);

  // Load product options for auto-completion
  useEffect(() => {
    async function loadProductsMaster() {
      try {
        const res = await fetch('/api/master/products');
        if (res.ok) {
          const json = await res.json();
          const prods = json.data || json.products || [];
          if (Array.isArray(prods) && prods.length > 0) {
            const names = prods.map((p: any) => p.short_name || p.product_name || p.full_name || p.key).filter(Boolean);
            setProductOptions(Array.from(new Set(names)));
          }
        }
      } catch (e) {
        console.error('Error fetching products master:', e);
      }
    }
    loadProductsMaster();
  }, []);

  // Fetch Columns & Shift Configs
  useEffect(() => {
    async function loadColumns() {
      try {
        const res = await fetch('/api/ts/columns');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.columns) && json.columns.length > 0) {
            setStgColumns(json.columns);
          }
        }
      } catch (err) {
        console.error('Failed to load columns:', err);
      }
    }
    loadColumns();
  }, []);

  // Excel Col Name helper (0 -> A, 1 -> B...)
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
    const dec = getStandardColumnDecimals(colKey || '', decimals);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  // Excel Formula Evaluator
  const evaluateExcelFormula = (
    formulaInput: string,
    rowIndex: number,
    rowVals: Record<string, any>,
    colsContext?: STGColumnDef[],
    rowsContext?: STGRowData[],
    depth: number = 0
  ): number => {
    if (!formulaInput || typeof formulaInput !== 'string' || depth > 10) return 0;
    let expr = formulaInput.trim();
    if (expr.startsWith('=')) expr = expr.substring(1).trim();
    if (expr.startsWith('+')) expr = expr.substring(1).trim();
    if (!expr) return 0;

    const colsList = colsContext || stgColumns;
    const rowList = rowsContext || (activeBlock ? blocks[activeBlock]?.rows : []) || [];

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

    expr = expr.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      let colIdx = 0;
      const upperLetters = colLetters.toUpperCase();
      for (let i = 0; i < upperLetters.length; i++) {
        colIdx = colIdx * 26 + (upperLetters.charCodeAt(i) - 64);
      }
      colIdx = colIdx - 1;

      const targetRowIdx = parseInt(rowNumStr, 10) - 1;
      const targetCol = colsList[colIdx];
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
        const evaluatedTarget = evaluateExcelFormula(rawVal, targetRowIdx, targetVals, colsList, rowList, depth + 1);
        return String(evaluatedTarget);
      }

      if (targetCol.type === 'calculated') {
        const computedTarget = computeCell(targetCol, targetVals, targetRowIdx, colsList, rowList);
        const numVal = typeof computedTarget === 'number' ? computedTarget : parseFloat(String(computedTarget || 0));
        return isNaN(numVal) ? '0' : String(numVal);
      }

      const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
      return isNaN(numVal) ? '0' : String(numVal);
    });

    colsList.forEach(col => {
      if (expr.includes(col.key)) {
        const rawVal = rowVals[col.key];
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0));
        expr = expr.replaceAll(col.key, String(isNaN(numVal) ? 0 : numVal));
      }
    });

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
  };

  const computeCell = (
    col: STGColumnDef,
    rowVals: Record<string, any>,
    rowIndex: number = 0,
    colsContext?: STGColumnDef[],
    rowsContext?: STGRowData[]
  ) => {
    const colsList = colsContext || stgColumns;
    const rList = rowsContext || (activeBlock ? blocks[activeBlock]?.rows : []) || [];
    const cellVal = rowVals ? rowVals[col.key] : undefined;

    if (cellVal !== undefined && cellVal !== '' && cellVal !== null) {
      if (typeof cellVal === 'string' && (cellVal.startsWith('=') || cellVal.startsWith('=+'))) {
        return evaluateExcelFormula(cellVal, rowIndex, rowVals, colsList, rList);
      }
      if (typeof cellVal === 'number') return cellVal;
      const numVal = parseFloat(String(cellVal));
      if (!isNaN(numVal)) return numVal;
      return cellVal;
    }

    if (col.type === 'calculated') {
      if (col.formula) {
        return evaluateExcelFormula(`= ${col.formula}`, rowIndex, rowVals, colsList, rList);
      }
      const qtyLitVal = rowVals ? rowVals.qty_lts : undefined;
      const spGrVal = rowVals ? rowVals.sp_gr : undefined;

      const qtyLit = typeof qtyLitVal === 'string' && (qtyLitVal.startsWith('=') || qtyLitVal.startsWith('=+'))
        ? evaluateExcelFormula(qtyLitVal, rowIndex, rowVals, colsList, rList)
        : parseFloat(String(qtyLitVal || 0));

      const spGr = typeof spGrVal === 'string' && (spGrVal.startsWith('=') || spGrVal.startsWith('=+'))
        ? evaluateExcelFormula(spGrVal, rowIndex, rowVals, colsList, rList)
        : parseFloat(String(spGrVal || 0));

      const rawQtyKg = rowVals ? rowVals.qty_kg : undefined;
      const qtyKg = rawQtyKg !== undefined && rawQtyKg !== '' && rawQtyKg !== null
        ? (typeof rawQtyKg === 'string' && (rawQtyKg.startsWith('=') || rawQtyKg.startsWith('=+'))
          ? evaluateExcelFormula(rawQtyKg, rowIndex, rowVals, colsList, rList)
          : parseFloat(String(rawQtyKg || 0)))
        : (spGr > 0 ? qtyLit * spGr : qtyLit);

      const fatPctVal = rowVals ? rowVals.fat_pct : undefined;
      const fatPct = typeof fatPctVal === 'string' && (fatPctVal.startsWith('=') || fatPctVal.startsWith('=+'))
        ? evaluateExcelFormula(fatPctVal, rowIndex, rowVals, colsList, rList)
        : parseFloat(String(fatPctVal || 0));

      const snfPctVal = rowVals ? rowVals.snf_pct : undefined;
      const snfPct = typeof snfPctVal === 'string' && (snfPctVal.startsWith('=') || snfPctVal.startsWith('=+'))
        ? evaluateExcelFormula(snfPctVal, rowIndex, rowVals, colsList, rList)
        : parseFloat(String(snfPctVal || 0));

      if (col.key === 'qty_kg') return qtyKg;
      if (col.key === 'kg_fat') return (qtyKg * fatPct) / 100;
      if (col.key === 'kg_snf') return (qtyKg * snfPct) / 100;

      return 0;
    }
    return cellVal !== undefined ? cellVal : '';
  };

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

  // Populate Block State Rows from Statement Master Def
  const populateBlockDefaultsFromMaster = useCallback((stmtMaster: any): STGBlockState => {
    const defaultRows = Array.isArray(stmtMaster.default_rows) && stmtMaster.default_rows.length > 0
      ? stmtMaster.default_rows
      : (Array.isArray(stmtMaster.rows) && stmtMaster.rows.length > 0 ? stmtMaster.rows : null);

    if (defaultRows) {
      const rows: STGRowData[] = defaultRows.map((r: any) => {
        const varName = r.variant || r.short_name || r.full_name || r.values?.variant || stmtMaster.variant || stmtMaster.label || 'Particular';
        const vals = r.values ? { ...r.values } : { ...r };
        delete vals.variant;
        return {
          variant: varName,
          values: { variant: varName, ...vals }
        };
      });
      return { rows, cmpdd_norm: '0.5' };
    }

    const rows: STGRowData[] = [];
    if (Array.isArray(stmtMaster.receipt_rows) && stmtMaster.receipt_rows.length > 0) {
      stmtMaster.receipt_rows.forEach((r: any) => {
        const name = r.short_name || r.full_name || 'Particular';
        rows.push({ variant: name, values: { variant: name } });
      });
    }
    if (Array.isArray(stmtMaster.disposal_rows) && stmtMaster.disposal_rows.length > 0) {
      stmtMaster.disposal_rows.forEach((d: any) => {
        const name = d.short_name || d.full_name || 'Particular';
        rows.push({ variant: name, values: { variant: name } });
      });
    }

    if (rows.length === 0) {
      const name = stmtMaster?.variant || stmtMaster?.label || 'Particular Variant';
      rows.push({ variant: name, values: { variant: name } });
    }

    return { rows, cmpdd_norm: '0.5' };
  }, []);

  // Fetch Statements and load todays entry from DB
  useEffect(() => {
    if (!entryDate) return;
    let active = true;

    async function loadData() {
      try {
        const configRes = await fetch('/api/ts/masters');
        let globalStatements: any[] = [];
        if (configRes.ok) {
          const configJson = await configRes.json();
          if (Array.isArray(configJson.masters) && configJson.masters.length > 0) {
            globalStatements = configJson.masters.map((s: any) => ({
              ...s,
              label: cleanStatementLabel(s.label),
            }));
          }
        }

        const res = await fetch(`/api/ts?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.data) {
            let todayCustomStatements: any[] = [];
            let customBlocksState: Record<string, any> = {};
            let cleanNotes = data.data.notes || '';
            let savedEnabledKeys: any = null;

            const notesParts = (data.data.notes || '').split('\n');
            notesParts.forEach((part: string) => {
              if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
                const [, metaJson] = part.split('__METADATA__:');
                try {
                  const meta = JSON.parse(metaJson);
                  if (meta.custom_statements) todayCustomStatements = meta.custom_statements;
                  if (meta.custom_blocks) customBlocksState = meta.custom_blocks;
                  if (meta.enabled_blocks) savedEnabledKeys = meta.enabled_blocks;
                } catch (e) {
                  console.error('Failed to parse STG metadata:', e);
                }
              }
            });

            cleanNotes = notesParts
              .filter((part: string) => !part.includes('__METADATA__:') && !part.includes('__STOCK_SUMMARY__:'))
              .join('\n')
              .trim();

            const stmtMap = new Map<string, { key: string; label: string }>();
            globalStatements.forEach((s: { key: string; label: string }) => stmtMap.set(s.key, s));
            todayCustomStatements.forEach((s: { key: string; label: string }) => {
              if (s && s.key) stmtMap.set(s.key, s);
            });
            if (data.data.stg_rows && Array.isArray(data.data.stg_rows)) {
              data.data.stg_rows.forEach((r: any) => {
                if (r.product_block && !stmtMap.has(r.product_block)) {
                  stmtMap.set(r.product_block, {
                    key: r.product_block,
                    label: `${r.product_block.toUpperCase()} STATEMENT`
                  });
                }
              });
            }
            const combinedStatements = Array.from(stmtMap.values());

            setStatements(combinedStatements);
            if (savedEnabledKeys && Array.isArray(savedEnabledKeys) && savedEnabledKeys.length > 0) {
              const allKeys = Array.from(new Set([...(savedEnabledKeys as string[]), ...combinedStatements.map(s => s.key)]));
              setEnabledBlockKeys(allKeys);
            } else {
              setEnabledBlockKeys(combinedStatements.map(s => s.key));
            }
            if (combinedStatements.length > 0) {
              setActiveBlock(combinedStatements[0].key);
            }
            setNotes(cleanNotes);

            const newBlocks: Record<string, STGBlockState> = {};
            combinedStatements.forEach((s: any) => {
              const matchedMaster = globalStatements.find((g: any) => g.key === s.key);
              newBlocks[s.key] = matchedMaster ? populateBlockDefaultsFromMaster(matchedMaster) : { rows: [{ variant: s.label, values: { variant: s.label } }] };
            });

            // If custom blocks state saved in metadata, use it
            Object.entries(customBlocksState).forEach(([key, state]) => {
              if (newBlocks[key] && state.rows && Array.isArray(state.rows)) {
                newBlocks[key] = state;
              }
            });

            // Map stg_rows from DB if custom_blocks metadata wasn't set
            if (data.data.stg_rows && Array.isArray(data.data.stg_rows)) {
              const blockRowsMap: Record<string, STGRowData[]> = {};
              data.data.stg_rows.forEach((row: any) => {
                const b = row.product_block;
                if (row.item_name === 'OB' || row.item_name === 'CB') return;
                if (!blockRowsMap[b]) blockRowsMap[b] = [];
                const itemName = row.item_name || 'Particular';
                blockRowsMap[b].push({
                  variant: itemName,
                  values: {
                    variant: itemName,
                    qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                    qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                    fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                    snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                    sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                    kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                    kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                  }
                });
              });
              Object.entries(blockRowsMap).forEach(([bKey, rowsList]) => {
                if (newBlocks[bKey] && rowsList.length > 0) {
                  newBlocks[bKey].rows = rowsList;
                }
              });
            }

            setBlocks(newBlocks);
            return;
          }
        }

        // New Entry: Populate defaults
        if (active) {
          const initialBlocks: Record<string, STGBlockState> = {};
          globalStatements.forEach((s: any) => {
            if (s && s.key) {
              initialBlocks[s.key] = populateBlockDefaultsFromMaster(s);
            }
          });
          setStatements(globalStatements);
          setEnabledBlockKeys(globalStatements.map(s => s.key));
          if (globalStatements.length > 0) {
            setActiveBlock(globalStatements[0].key);
          }
          setBlocks(initialBlocks);
        }
      } catch (err) {
        console.error('Error loading STG entry data:', err);
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift, populateBlockDefaultsFromMaster]);

  // Drag-to-fill handler
  const handleFillDragStart = (e: React.MouseEvent, blockKey: string, rowIndex: number, colKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFillDrag({ blockKey, sourceRow: rowIndex, targetRow: rowIndex, colKey });
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
        const { blockKey, sourceRow, targetRow, colKey } = fillDrag;
        if (sourceRow !== targetRow) {
          const minRow = Math.min(sourceRow, targetRow);
          const maxRow = Math.max(sourceRow, targetRow);

          setBlocks(prev => {
            const next = { ...prev };
            const b = { ...next[blockKey] };
            const bRows = [...(b.rows || [])];
            const sourceVal = bRows[sourceRow]?.values?.[colKey];

            for (let r = minRow; r <= maxRow; r++) {
              if (r === sourceRow) continue;
              const rData = { ...bRows[r] };
              const vals = { ...(rData.values || {}) };
              let valToSet: any = sourceVal;
              if (typeof sourceVal === 'string' && (sourceVal.startsWith('=') || sourceVal.startsWith('+'))) {
                valToSet = adjustFormulaRowOffset(sourceVal, sourceRow, r);
              }
              vals[colKey] = valToSet;
              rData.values = vals;
              const col = stgColumns.find(c => c.key === colKey);
              if (col?.type === 'text') rData.variant = valToSet;
              bRows[r] = rData;
            }
            b.rows = bRows;
            next[blockKey] = b;
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
  }, [fillDrag, stgColumns]);

  // Handle cell edit inside a statement block
  const handleCellChange = (rowIndex: number, colKey: string, rawVal: any) => {
    if (!activeBlock) return;
    setBlocks(prev => {
      const next = { ...prev };
      const b = { ...next[activeBlock] };
      const bRows = [...(b.rows || [])];
      const targetRow = { ...bRows[rowIndex] };
      const targetVals = { ...(targetRow.values || {}), [colKey]: rawVal };
      targetRow.values = targetVals;

      const col = stgColumns.find(c => c.key === colKey);
      if (col?.type === 'text') {
        targetRow.variant = rawVal;
      }
      bRows[rowIndex] = targetRow;
      b.rows = bRows;
      next[activeBlock] = b;
      return next;
    });
  };

  const handleObChange = (blockKey: string, field: string, value: string) => {
    setBlocks(prev => {
      const next = { ...prev };
      const b = { ...next[blockKey] };
      const ob = { ...(b.opening_balance || {}), [field]: value };

      const lts = parseFloat(ob.qty_lts || '0') || 0;
      const spgr = parseFloat(ob.sp_gr || '0') || 0;
      let kg = parseFloat(ob.qty_kg || '0') || 0;

      if (field === 'qty_lts' || field === 'sp_gr') {
        if (spgr > 0 && lts > 0) {
          kg = Math.round(lts * spgr * 100) / 100;
          ob.qty_kg = String(kg);
        } else if (lts > 0 && !ob.qty_kg) {
          kg = lts;
          ob.qty_kg = String(kg);
        }
      }

      const fatPct = parseFloat(ob.fat_pct || '0') || 0;
      const snfPct = parseFloat(ob.snf_pct || '0') || 0;
      if (kg > 0) {
        if (fatPct > 0) ob.kg_fat = String(Math.round(((kg * fatPct) / 100) * 1000) / 1000);
        if (snfPct > 0) ob.kg_snf = String(Math.round(((kg * snfPct) / 100) * 1000) / 1000);
      }

      b.opening_balance = ob;
      next[blockKey] = b;
      return next;
    });
  };

  const handleCbChange = (blockKey: string, field: string, value: string) => {
    setBlocks(prev => {
      const next = { ...prev };
      const b = { ...next[blockKey] };
      const cb = { ...(b.physical_count || {}), [field]: value };

      const lts = parseFloat(cb.qty_lts || '0') || 0;
      const spgr = parseFloat(cb.sp_gr || '0') || 0;
      let kg = parseFloat(cb.qty_kg || '0') || 0;

      if (field === 'qty_lts' || field === 'sp_gr') {
        if (spgr > 0 && lts > 0) {
          kg = Math.round(lts * spgr * 100) / 100;
          cb.qty_kg = String(kg);
        } else if (lts > 0 && !cb.qty_kg) {
          kg = lts;
          cb.qty_kg = String(kg);
        }
      }

      const fatPct = parseFloat(cb.fat_pct || '0') || 0;
      const snfPct = parseFloat(cb.snf_pct || '0') || 0;
      if (kg > 0) {
        if (fatPct > 0) cb.kg_fat = String(Math.round(((kg * fatPct) / 100) * 1000) / 1000);
        if (snfPct > 0) cb.kg_snf = String(Math.round(((kg * snfPct) / 100) * 1000) / 1000);
      }

      b.physical_count = cb;
      next[blockKey] = b;
      return next;
    });
  };

  const handleCmpddNormChange = (blockKey: string, value: string) => {
    setBlocks(prev => {
      const next = { ...prev };
      const b = { ...next[blockKey] };
      b.cmpdd_norm = value;
      next[blockKey] = b;
      return next;
    });
  };

  // Save STG statement to database
  const triggerBackgroundSave = async () => {
    setError('');
    try {
      const userNotesText = notes
        ? notes
          .split('\n')
          .filter(p => !p.includes('__METADATA__:') && !p.includes('__STOCK_SUMMARY__:'))
          .join('\n')
          .trim()
        : '';

      const metadata = {
        custom_statements: statements.filter(s => enabledBlockKeys.includes(s.key)),
        custom_blocks: blocks,
        enabled_blocks: enabledBlockKeys,
      };
      const finalNotes = (userNotesText ? userNotesText + "\n" : "") + "__METADATA__:" + JSON.stringify(metadata);

      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: entryDate, report_type: 'TS', shift, notes: finalNotes }),
      });
      const entryData = await entryRes.json();
      if (!entryRes.ok && entryRes.status !== 409) {
        throw new Error(entryData.error || 'Failed to initialize entry');
      }

      let entry_id = entryData.data?.id;
      if (!entry_id && entryRes.status === 409) {
        const getRes = await fetch(`/api/entries?report_type=TS&date=${entryDate}&shift=${shift}`);
        const getData = await getRes.json();
        entry_id = getData.data?.[0]?.id;
      }

      if (!entry_id) throw new Error('Could not retrieve entry ID');

      const stg_rows: any[] = [];
      Object.entries(blocks).forEach(([pBlock, blockState]) => {
        if (!enabledBlockKeys.includes(pBlock)) return;
        if (blockState && Array.isArray(blockState.rows)) {
          blockState.rows.forEach(r => {
            const varName = r.variant || r.values?.variant || '';
            if (varName || Object.keys(r.values || {}).some(k => k !== 'variant' && r.values[k] !== undefined && r.values[k] !== '')) {
              stg_rows.push({
                product_block: pBlock,
                side: 'DISPOSAL',
                item_name: varName,
                qty_lts: r.values?.qty_lts !== undefined ? String(r.values.qty_lts) : '',
                qty_kg: r.values?.qty_kg !== undefined ? String(r.values.qty_kg) : '',
                fat_pct: r.values?.fat_pct !== undefined ? String(r.values.fat_pct) : '',
                snf_pct: r.values?.snf_pct !== undefined ? String(r.values.snf_pct) : '',
                sp_gr: r.values?.sp_gr !== undefined ? String(r.values.sp_gr) : '',
                kg_fat: r.values?.kg_fat !== undefined ? String(r.values.kg_fat) : '',
                kg_snf: r.values?.kg_snf !== undefined ? String(r.values.kg_snf) : '',
              });
            }
          });
        }
      });

      const tsRes = await fetch('/api/ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id, ts_rows: [], stg_rows }),
      });

      if (!tsRes.ok) {
        const d = await tsRes.json();
        throw new Error(d.error || 'Failed to save STG statement data');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleSave = async () => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setSaving(true);
    await triggerBackgroundSave();
    setSaving(false);
    if (!error) {
      router.push(`/dashboard/ts/${entryDate}?tab=STG&shift=${shift}`);
    }
  };

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        handleSave: () => {
          handleSaveRef.current();
        },
        saving,
      });
    }
  }, [saving, onRegisterActions]);

  // Helper to resolve summary cell Excel address, column name, formula string, and display value
  const getSummaryFieldMeta = (
    fieldKey: string | undefined,
    rowKey: string,
    matrixRowCount: number,
    stgCols: STGColumnDef[],
    summaryVals: {
      totQtyLts: number; totQtyKg: number; totKgFat: number; totKgSnf: number;
      obLts: number; obKg: number; obFatPct: number; obSnfPct: number; obSpGr: number; obKgFat: number; obKgSnf: number;
      cbLts: number; cbKg: number; cbFatPct: number; cbSnfPct: number; cbSpGr: number; cbKgFat: number; cbKgSnf: number;
      calcGrandRecLts: number; calcGrandRecKg: number; calcGrandRecFat: number; calcGrandRecSnf: number;
      calcGrandDispLts: number; calcGrandDispKg: number; calcGrandDispFat: number; calcGrandDispSnf: number;
      calcLossGainLts: number; calcLossGainKg: number; calcLossGainFat: number; calcLossGainSnf: number;
      calcLossGainPctFat: number; calcLossGainPctSnf: number;
      cmpddNorm: number;
    }
  ) => {
    if (!fieldKey) return null;

    const receiptColIdx = stgCols.findIndex(c => c.key === 'variant' || c.key === 'receipt' || (c.type === 'text' && c.key !== 'disposal' && !c.key.toLowerCase().includes('disposal')));
    const disposalColIdx = stgCols.findIndex(c => c.key === 'disposal' || c.key.toLowerCase() === 'disposal' || c.name?.toLowerCase() === 'disposal');

    const qtyLtsIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'qty_lts');
    const spGrIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'sp_gr');
    const qtyKgIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'qty_kg');
    const fatPctIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'fat_pct');
    const snfPctIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'snf_pct');
    const kgFatIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'kg_fat');
    const kgSnfIdx = stgCols.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'kg_snf');

    const dispQtyLtsIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && (c.key.includes('qty_lts') || c.key.includes('lts'))) : qtyLtsIdx;
    const dispSpGrIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && c.key.includes('sp_gr')) : spGrIdx;
    const dispQtyKgIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && c.key.includes('qty_kg')) : qtyKgIdx;
    const dispFatPctIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && c.key.includes('fat_pct')) : fatPctIdx;
    const dispSnfPctIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && c.key.includes('snf_pct')) : snfPctIdx;
    const dispKgFatIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && (c.key.includes('kg_fat') || c.key.includes('fat'))) : kgFatIdx;
    const dispKgSnfIdx = disposalColIdx >= 0 ? stgCols.findIndex((c, i) => i > disposalColIdx && (c.key.includes('kg_snf') || c.key.includes('snf'))) : kgSnfIdx;

    const dQtyLtsIdx = dispQtyLtsIdx >= 0 ? dispQtyLtsIdx : (disposalColIdx >= 0 && qtyLtsIdx >= 0 ? disposalColIdx + qtyLtsIdx : qtyLtsIdx);
    const dSpGrIdx = dispSpGrIdx >= 0 ? dispSpGrIdx : (disposalColIdx >= 0 && spGrIdx >= 0 ? disposalColIdx + spGrIdx : spGrIdx);
    const dQtyKgIdx = dispQtyKgIdx >= 0 ? dispQtyKgIdx : (disposalColIdx >= 0 && qtyKgIdx >= 0 ? disposalColIdx + qtyKgIdx : qtyKgIdx);
    const dFatPctIdx = dispFatPctIdx >= 0 ? dispFatPctIdx : (disposalColIdx >= 0 && fatPctIdx >= 0 ? disposalColIdx + fatPctIdx : fatPctIdx);
    const dSnfPctIdx = dispSnfPctIdx >= 0 ? dispSnfPctIdx : (disposalColIdx >= 0 && snfPctIdx >= 0 ? disposalColIdx + snfPctIdx : snfPctIdx);
    const dKgFatIdx = dispKgFatIdx >= 0 ? dispKgFatIdx : (disposalColIdx >= 0 && kgFatIdx >= 0 ? disposalColIdx + kgFatIdx : kgFatIdx);
    const dKgSnfIdx = dispKgSnfIdx >= 0 ? dispKgSnfIdx : (disposalColIdx >= 0 && kgSnfIdx >= 0 ? disposalColIdx + kgSnfIdx : kgSnfIdx);

    const N = Math.max(1, matrixRowCount);
    const R_tot = N + 1;
    const R_ob = N + 2;
    const R_grand = N + 3;
    const R_lg = N + 4;
    const R_lg_pct = N + 5;
    const R_cmpdd = N + 6;

    const cLts = qtyLtsIdx >= 0 ? getExcelColName(qtyLtsIdx) : 'C';
    const cSpGr = spGrIdx >= 0 ? getExcelColName(spGrIdx) : 'D';
    const cKg = qtyKgIdx >= 0 ? getExcelColName(qtyKgIdx) : 'E';
    const cFatPct = fatPctIdx >= 0 ? getExcelColName(fatPctIdx) : 'F';
    const cSnfPct = snfPctIdx >= 0 ? getExcelColName(snfPctIdx) : 'G';
    const cKgFat = kgFatIdx >= 0 ? getExcelColName(kgFatIdx) : 'H';
    const cKgSnf = kgSnfIdx >= 0 ? getExcelColName(kgSnfIdx) : 'I';

    const cdLts = dQtyLtsIdx >= 0 ? getExcelColName(dQtyLtsIdx) : 'L';
    const cdSpGr = dSpGrIdx >= 0 ? getExcelColName(dSpGrIdx) : 'M';
    const cdKg = dQtyKgIdx >= 0 ? getExcelColName(dQtyKgIdx) : 'N';
    const cdFatPct = dFatPctIdx >= 0 ? getExcelColName(dFatPctIdx) : 'O';
    const cdSnfPct = dSnfPctIdx >= 0 ? getExcelColName(dSnfPctIdx) : 'P';
    const cdKgFat = dKgFatIdx >= 0 ? getExcelColName(dKgFatIdx) : 'Q';
    const cdKgSnf = dKgSnfIdx >= 0 ? getExcelColName(dKgSnfIdx) : 'R';

    let colIdx = -1;
    let rNum = R_tot;
    let colName = '';
    let formula = '';
    let displayValue = '-';

    switch (fieldKey) {
      // Total Receipts
      case 'tot_rec_lts':
        colIdx = qtyLtsIdx; rNum = R_tot;
        colName = 'Total Receipt QTY (Lts)';
        formula = `=SUM(${cLts}1:${cLts}${N})`;
        displayValue = formatNumberValue(summaryVals.totQtyLts, 0);
        break;
      case 'tot_rec_sp_gr':
        colIdx = spGrIdx; rNum = R_tot;
        colName = 'Total Receipt Sp.Gr';
        formula = `=+${cKg}${R_tot}/${cLts}${R_tot}`;
        displayValue = summaryVals.totQtyLts > 0 ? formatNumberValue(summaryVals.totQtyKg / summaryVals.totQtyLts, 4) : '0';
        break;
      case 'tot_rec_kg':
        colIdx = qtyKgIdx; rNum = R_tot;
        colName = 'Total Receipt QTY (Kg)';
        formula = `=SUM(${cKg}1:${cKg}${N})`;
        displayValue = formatNumberValue(summaryVals.totQtyKg, 2);
        break;
      case 'tot_rec_fat_pct':
        colIdx = fatPctIdx; rNum = R_tot;
        colName = 'Total Receipt FAT (%)';
        formula = `=+(${cKgFat}${R_tot}/${cKg}${R_tot})*100`;
        displayValue = summaryVals.totQtyKg > 0 ? formatNumberValue((summaryVals.totKgFat / summaryVals.totQtyKg) * 100, 2) + '%' : '0%';
        break;
      case 'tot_rec_snf_pct':
        colIdx = snfPctIdx; rNum = R_tot;
        colName = 'Total Receipt SNF (%)';
        formula = `=+(${cKgSnf}${R_tot}/${cKg}${R_tot})*100`;
        displayValue = summaryVals.totQtyKg > 0 ? formatNumberValue((summaryVals.totKgSnf / summaryVals.totQtyKg) * 100, 2) + '%' : '0%';
        break;
      case 'tot_rec_fat':
        colIdx = kgFatIdx; rNum = R_tot;
        colName = 'Total Receipt FAT (Kg)';
        formula = `=SUM(${cKgFat}1:${cKgFat}${N})`;
        displayValue = formatNumberValue(summaryVals.totKgFat, 3);
        break;
      case 'tot_rec_snf':
        colIdx = kgSnfIdx; rNum = R_tot;
        colName = 'Total Receipt SNF (Kg)';
        formula = `=SUM(${cKgSnf}1:${cKgSnf}${N})`;
        displayValue = formatNumberValue(summaryVals.totKgSnf, 3);
        break;

      // Total Disposals
      case 'tot_disp_lts':
        colIdx = dQtyLtsIdx; rNum = R_tot;
        colName = 'Total Disposal QTY (Lts)';
        formula = `=SUM(${cdLts}1:${cdLts}${N})`;
        displayValue = formatNumberValue(summaryVals.totQtyLts, 0);
        break;
      case 'tot_disp_sp_gr':
        colIdx = dSpGrIdx; rNum = R_tot;
        colName = 'Total Disposal Sp.Gr';
        formula = `=+${cdKg}${R_tot}/${cdLts}${R_tot}`;
        displayValue = summaryVals.totQtyLts > 0 ? formatNumberValue(summaryVals.totQtyKg / summaryVals.totQtyLts, 4) : '0';
        break;
      case 'tot_disp_kg':
        colIdx = dQtyKgIdx; rNum = R_tot;
        colName = 'Total Disposal QTY (Kg)';
        formula = `=SUM(${cdKg}1:${cdKg}${N})`;
        displayValue = formatNumberValue(summaryVals.totQtyKg, 2);
        break;
      case 'tot_disp_fat_pct':
        colIdx = dFatPctIdx; rNum = R_tot;
        colName = 'Total Disposal FAT (%)';
        formula = `=+(${cdKgFat}${R_tot}/${cdKg}${R_tot})*100`;
        displayValue = summaryVals.totQtyKg > 0 ? formatNumberValue((summaryVals.totKgFat / summaryVals.totQtyKg) * 100, 2) + '%' : '0%';
        break;
      case 'tot_disp_snf_pct':
        colIdx = dSnfPctIdx; rNum = R_tot;
        colName = 'Total Disposal SNF (%)';
        formula = `=+(${cdKgSnf}${R_tot}/${cdKg}${R_tot})*100`;
        displayValue = summaryVals.totQtyKg > 0 ? formatNumberValue((summaryVals.totKgSnf / summaryVals.totQtyKg) * 100, 2) + '%' : '0%';
        break;
      case 'tot_disp_fat':
        colIdx = dKgFatIdx; rNum = R_tot;
        colName = 'Total Disposal FAT (Kg)';
        formula = `=SUM(${cdKgFat}1:${cdKgFat}${N})`;
        displayValue = formatNumberValue(summaryVals.totKgFat, 3);
        break;
      case 'tot_disp_snf':
        colIdx = dKgSnfIdx; rNum = R_tot;
        colName = 'Total Disposal SNF (Kg)';
        formula = `=SUM(${cdKgSnf}1:${cdKgSnf}${N})`;
        displayValue = formatNumberValue(summaryVals.totKgSnf, 3);
        break;

      // Opening Balance
      case 'ob_qty_lts':
        colIdx = qtyLtsIdx; rNum = R_ob;
        colName = 'Opening Balance QTY (Lts)';
        formula = `= OB QTY (Lts)`;
        displayValue = formatNumberValue(summaryVals.obLts, 0);
        break;
      case 'ob_sp_gr':
        colIdx = spGrIdx; rNum = R_ob;
        colName = 'Opening Balance Sp.Gr';
        formula = `= OB Sp.Gr`;
        displayValue = formatNumberValue(summaryVals.obSpGr, 4);
        break;
      case 'ob_qty_kg':
        colIdx = qtyKgIdx; rNum = R_ob;
        colName = 'Opening Balance QTY (Kg)';
        formula = `= OB QTY (Kg)`;
        displayValue = formatNumberValue(summaryVals.obKg, 2);
        break;
      case 'ob_fat_pct':
        colIdx = fatPctIdx; rNum = R_ob;
        colName = 'Opening Balance FAT (%)';
        formula = `= OB FAT (%)`;
        displayValue = formatNumberValue(summaryVals.obFatPct, 2) + '%';
        break;
      case 'ob_snf_pct':
        colIdx = snfPctIdx; rNum = R_ob;
        colName = 'Opening Balance SNF (%)';
        formula = `= OB SNF (%)`;
        displayValue = formatNumberValue(summaryVals.obSnfPct, 2) + '%';
        break;
      case 'ob_kg_fat':
        colIdx = kgFatIdx; rNum = R_ob;
        colName = 'Opening Balance FAT (Kg)';
        formula = `=+(${cKg}${R_ob}*${cFatPct}${R_ob})/100`;
        displayValue = formatNumberValue(summaryVals.obKgFat, 3);
        break;
      case 'ob_kg_snf':
        colIdx = kgSnfIdx; rNum = R_ob;
        colName = 'Opening Balance SNF (Kg)';
        formula = `=+(${cKg}${R_ob}*${cSnfPct}${R_ob})/100`;
        displayValue = formatNumberValue(summaryVals.obKgSnf, 3);
        break;

      // Closing Balance
      case 'cb_qty_lts':
        colIdx = dQtyLtsIdx; rNum = R_ob;
        colName = 'Closing Balance QTY (Lts)';
        formula = `= CB QTY (Lts)`;
        displayValue = formatNumberValue(summaryVals.cbLts, 0);
        break;
      case 'cb_sp_gr':
        colIdx = dSpGrIdx; rNum = R_ob;
        colName = 'Closing Balance Sp.Gr';
        formula = `= CB Sp.Gr`;
        displayValue = formatNumberValue(summaryVals.cbSpGr, 4);
        break;
      case 'cb_qty_kg':
        colIdx = dQtyKgIdx; rNum = R_ob;
        colName = 'Closing Balance QTY (Kg)';
        formula = `= CB QTY (Kg)`;
        displayValue = formatNumberValue(summaryVals.cbKg, 2);
        break;
      case 'cb_fat_pct':
        colIdx = dFatPctIdx; rNum = R_ob;
        colName = 'Closing Balance FAT (%)';
        formula = `= CB FAT (%)`;
        displayValue = formatNumberValue(summaryVals.cbFatPct, 2) + '%';
        break;
      case 'cb_snf_pct':
        colIdx = dSnfPctIdx; rNum = R_ob;
        colName = 'Closing Balance SNF (%)';
        formula = `= CB SNF (%)`;
        displayValue = formatNumberValue(summaryVals.cbSnfPct, 2) + '%';
        break;
      case 'cb_kg_fat':
        colIdx = dKgFatIdx; rNum = R_ob;
        colName = 'Closing Balance FAT (Kg)';
        formula = `=+(${cdKg}${R_ob}*${cdFatPct}${R_ob})/100`;
        displayValue = formatNumberValue(summaryVals.cbKgFat, 3);
        break;
      case 'cb_kg_snf':
        colIdx = dKgSnfIdx; rNum = R_ob;
        colName = 'Closing Balance SNF (Kg)';
        formula = `=+(${cdKg}${R_ob}*${cdSnfPct}${R_ob})/100`;
        displayValue = formatNumberValue(summaryVals.cbKgSnf, 3);
        break;

      // Grand Total Receipts
      case 'grand_rec_lts':
        colIdx = qtyLtsIdx; rNum = R_grand;
        colName = 'Grand Total Receipt QTY (Lts)';
        formula = `=+${cLts}${R_tot}+${cLts}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandRecLts, 0);
        break;
      case 'grand_rec_sp_gr':
        colIdx = spGrIdx; rNum = R_grand;
        colName = 'Grand Total Receipt Sp.Gr';
        formula = `=+${cKg}${R_grand}/${cLts}${R_grand}`;
        displayValue = summaryVals.calcGrandRecLts > 0 ? formatNumberValue(summaryVals.calcGrandRecKg / summaryVals.calcGrandRecLts, 4) : '0';
        break;
      case 'grand_rec_kg':
        colIdx = qtyKgIdx; rNum = R_grand;
        colName = 'Grand Total Receipt QTY (Kg)';
        formula = `=+${cKg}${R_tot}+${cKg}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandRecKg, 2);
        break;
      case 'grand_rec_fat_pct':
        colIdx = fatPctIdx; rNum = R_grand;
        colName = 'Grand Total Receipt FAT (%)';
        formula = `=+(${cKgFat}${R_grand}/${cKg}${R_grand})*100`;
        displayValue = summaryVals.calcGrandRecKg > 0 ? formatNumberValue((summaryVals.calcGrandRecFat / summaryVals.calcGrandRecKg) * 100, 2) + '%' : '0%';
        break;
      case 'grand_rec_snf_pct':
        colIdx = snfPctIdx; rNum = R_grand;
        colName = 'Grand Total Receipt SNF (%)';
        formula = `=+(${cKgSnf}${R_grand}/${cKg}${R_grand})*100`;
        displayValue = summaryVals.calcGrandRecKg > 0 ? formatNumberValue((summaryVals.calcGrandRecSnf / summaryVals.calcGrandRecKg) * 100, 2) + '%' : '0%';
        break;
      case 'grand_rec_fat':
        colIdx = kgFatIdx; rNum = R_grand;
        colName = 'Grand Total Receipt FAT (Kg)';
        formula = `=+${cKgFat}${R_tot}+${cKgFat}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandRecFat, 3);
        break;
      case 'grand_rec_snf':
        colIdx = kgSnfIdx; rNum = R_grand;
        colName = 'Grand Total Receipt SNF (Kg)';
        formula = `=+${cKgSnf}${R_tot}+${cKgSnf}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandRecSnf, 3);
        break;

      // Grand Total Disposals
      case 'grand_disp_lts':
        colIdx = dQtyLtsIdx; rNum = R_grand;
        colName = 'Grand Total Disposal QTY (Lts)';
        formula = `=+${cdLts}${R_tot}+${cdLts}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandDispLts, 0);
        break;
      case 'grand_disp_sp_gr':
        colIdx = dSpGrIdx; rNum = R_grand;
        colName = 'Grand Total Disposal Sp.Gr';
        formula = `=+${cdKg}${R_grand}/${cdLts}${R_grand}`;
        displayValue = summaryVals.calcGrandDispLts > 0 ? formatNumberValue(summaryVals.calcGrandDispKg / summaryVals.calcGrandDispLts, 4) : '0';
        break;
      case 'grand_disp_kg':
        colIdx = dQtyKgIdx; rNum = R_grand;
        colName = 'Grand Total Disposal QTY (Kg)';
        formula = `=+${cdKg}${R_tot}+${cdKg}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandDispKg, 2);
        break;
      case 'grand_disp_fat_pct':
        colIdx = dFatPctIdx; rNum = R_grand;
        colName = 'Grand Total Disposal FAT (%)';
        formula = `=+(${cdKgFat}${R_grand}/${cdKg}${R_grand})*100`;
        displayValue = summaryVals.calcGrandDispKg > 0 ? formatNumberValue((summaryVals.calcGrandDispFat / summaryVals.calcGrandDispKg) * 100, 2) + '%' : '0%';
        break;
      case 'grand_disp_snf_pct':
        colIdx = dSnfPctIdx; rNum = R_grand;
        colName = 'Grand Total Disposal SNF (%)';
        formula = `=+(${cdKgSnf}${R_grand}/${cdKg}${R_grand})*100`;
        displayValue = summaryVals.calcGrandDispKg > 0 ? formatNumberValue((summaryVals.calcGrandDispSnf / summaryVals.calcGrandDispKg) * 100, 2) + '%' : '0%';
        break;
      case 'grand_disp_fat':
        colIdx = dKgFatIdx; rNum = R_grand;
        colName = 'Grand Total Disposal FAT (Kg)';
        formula = `=+${cdKgFat}${R_tot}+${cdKgFat}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandDispFat, 3);
        break;
      case 'grand_disp_snf':
        colIdx = dKgSnfIdx; rNum = R_grand;
        colName = 'Grand Total Disposal SNF (Kg)';
        formula = `=+${cdKgSnf}${R_tot}+${cdKgSnf}${R_ob}`;
        displayValue = formatNumberValue(summaryVals.calcGrandDispSnf, 3);
        break;

      // Loss / Gain
      case 'loss_gain_lts':
        colIdx = dQtyLtsIdx; rNum = R_lg;
        colName = 'Loss / Gain QTY (Lts)';
        formula = `=+${cdLts}${R_grand}-${cLts}${R_grand}`;
        displayValue = formatNumberValue(summaryVals.calcLossGainLts, 0);
        break;
      case 'loss_gain_kg':
        colIdx = dQtyKgIdx; rNum = R_lg;
        colName = 'Loss / Gain QTY (Kg)';
        formula = `=+${cdKg}${R_grand}-${cKg}${R_grand}`;
        displayValue = formatNumberValue(summaryVals.calcLossGainKg, 2);
        break;
      case 'loss_gain_fat':
        colIdx = dKgFatIdx; rNum = R_lg;
        colName = 'Loss / Gain FAT (Kg)';
        formula = `=+${cdKgFat}${R_grand}-${cKgFat}${R_grand}`;
        displayValue = formatNumberValue(summaryVals.calcLossGainFat, 3);
        break;
      case 'loss_gain_snf':
        colIdx = dKgSnfIdx; rNum = R_lg;
        colName = 'Loss / Gain SNF (Kg)';
        formula = `=+${cdKgSnf}${R_grand}-${cKgSnf}${R_grand}`;
        displayValue = formatNumberValue(summaryVals.calcLossGainSnf, 3);
        break;

      // Loss / Gain %
      case 'loss_gain_pct_fat':
        colIdx = dKgFatIdx; rNum = R_lg_pct;
        colName = 'Loss / Gain FAT (%)';
        formula = `=+(${cdKgFat}${R_lg}/${cKgFat}${R_grand})*100`;
        displayValue = formatNumberValue(summaryVals.calcLossGainPctFat, 2) + '%';
        break;
      case 'loss_gain_pct_snf':
        colIdx = dKgSnfIdx; rNum = R_lg_pct;
        colName = 'Loss / Gain SNF (%)';
        formula = `=+(${cdKgSnf}${R_lg}/${cKgSnf}${R_grand})*100`;
        displayValue = formatNumberValue(summaryVals.calcLossGainPctSnf, 2) + '%';
        break;

      // CMPDD Norms
      case 'cmpdd_norm':
        colIdx = dKgFatIdx >= 0 ? dKgFatIdx : dKgSnfIdx; rNum = R_cmpdd;
        colName = 'CMPDD Norms (%)';
        formula = `= CMPDD Norm (%)`;
        displayValue = formatNumberValue(summaryVals.cmpddNorm, 1) + '%';
        break;
    }

    const colLetter = colIdx >= 0 ? getExcelColName(colIdx) : 'C';
    const address = `${colLetter}${rNum}`;

    return { address, colName, formula, displayValue };
  };

  // Render Single Formulation Table matching Master Default Formulation Tables
  const renderStatementBlock = (s: { key: string; label: string; variant?: string } | null) => {
    if (!s) return null;
    const blockKey = s.key;
    const blockState = blocks[blockKey] || { rows: [] };
    const rows = blockState.rows || [];

    // Calculate Summary Values for Formula Bar & Summary Table
    const obState = blockState.opening_balance || {};
    const cbState = blockState.physical_count || {};
    const summaryOverrides = blockState.summary_overrides || {};

    const qtyLtsCol = stgColumns.find(c => c.key === 'qty_lts') || { key: 'qty_lts', name: 'QTY', type: 'number' as const };
    const qtyKgCol = stgColumns.find(c => c.key === 'qty_kg') || { key: 'qty_kg', name: 'QTY', type: 'calculated' as const };
    const kgFatCol = stgColumns.find(c => c.key === 'kg_fat') || { key: 'kg_fat', name: 'FAT', type: 'calculated' as const };
    const kgSnfCol = stgColumns.find(c => c.key === 'kg_snf') || { key: 'kg_snf', name: 'SNF', type: 'calculated' as const };

    const totQtyLts = rows.reduce((sum, r, rIdx) => sum + (Number(computeCell(qtyLtsCol, r.values || {}, rIdx, stgColumns, rows)) || 0), 0);
    const totQtyKg = rows.reduce((sum, r, rIdx) => sum + (Number(computeCell(qtyKgCol, r.values || {}, rIdx, stgColumns, rows)) || 0), 0);
    const totKgFat = rows.reduce((sum, r, rIdx) => sum + (Number(computeCell(kgFatCol, r.values || {}, rIdx, stgColumns, rows)) || 0), 0);
    const totKgSnf = rows.reduce((sum, r, rIdx) => sum + (Number(computeCell(kgSnfCol, r.values || {}, rIdx, stgColumns, rows)) || 0), 0);

    const recTotLts = summaryOverrides['tot_rec_lts'] !== undefined && summaryOverrides['tot_rec_lts'] !== '' ? parseFloat(summaryOverrides['tot_rec_lts']) : totQtyLts;
    const recTotKg = summaryOverrides['tot_rec_kg'] !== undefined && summaryOverrides['tot_rec_kg'] !== '' ? parseFloat(summaryOverrides['tot_rec_kg']) : totQtyKg;
    const recTotFat = summaryOverrides['tot_rec_fat'] !== undefined && summaryOverrides['tot_rec_fat'] !== '' ? parseFloat(summaryOverrides['tot_rec_fat']) : totKgFat;
    const recTotSnf = summaryOverrides['tot_rec_snf'] !== undefined && summaryOverrides['tot_rec_snf'] !== '' ? parseFloat(summaryOverrides['tot_rec_snf']) : totKgSnf;

    const dispTotLts = summaryOverrides['tot_disp_lts'] !== undefined && summaryOverrides['tot_disp_lts'] !== '' ? parseFloat(summaryOverrides['tot_disp_lts']) : totQtyLts;
    const dispTotKg = summaryOverrides['tot_disp_kg'] !== undefined && summaryOverrides['tot_disp_kg'] !== '' ? parseFloat(summaryOverrides['tot_disp_kg']) : totQtyKg;
    const dispTotFat = summaryOverrides['tot_disp_fat'] !== undefined && summaryOverrides['tot_disp_fat'] !== '' ? parseFloat(summaryOverrides['tot_disp_fat']) : totKgFat;
    const dispTotSnf = summaryOverrides['tot_disp_snf'] !== undefined && summaryOverrides['tot_disp_snf'] !== '' ? parseFloat(summaryOverrides['tot_disp_snf']) : totKgSnf;

    const obLts = parseFloat(obState.qty_lts || '0') || 0;
    const obKg = parseFloat(obState.qty_kg || '0') || 0;
    const obFatPct = parseFloat(obState.fat_pct || '0') || 0;
    const obSnfPct = parseFloat(obState.snf_pct || '0') || 0;
    const obSpGr = parseFloat(obState.sp_gr || '0') || 0;
    const obKgFat = obKg && obFatPct ? (obKg * obFatPct) / 100 : (parseFloat(obState.kg_fat || '0') || 0);
    const obKgSnf = obKg && obSnfPct ? (obKg * obSnfPct) / 100 : (parseFloat(obState.kg_snf || '0') || 0);

    const cbLts = parseFloat(cbState.qty_lts || '0') || 0;
    const cbKg = parseFloat(cbState.qty_kg || '0') || 0;
    const cbFatPct = parseFloat(cbState.fat_pct || '0') || 0;
    const cbSnfPct = parseFloat(cbState.snf_pct || '0') || 0;
    const cbSpGr = parseFloat(cbState.sp_gr || '0') || 0;
    const cbKgFat = cbKg && cbFatPct ? (cbKg * cbFatPct) / 100 : (parseFloat(cbState.kg_fat || '0') || 0);
    const cbKgSnf = cbKg && cbSnfPct ? (cbKg * cbSnfPct) / 100 : (parseFloat(cbState.kg_snf || '0') || 0);

    const calcGrandRecLts = recTotLts + obLts;
    const calcGrandRecKg = recTotKg + obKg;
    const calcGrandRecFat = recTotFat + obKgFat;
    const calcGrandRecSnf = recTotSnf + obKgSnf;

    const grandRecLts = summaryOverrides['grand_rec_lts'] !== undefined && summaryOverrides['grand_rec_lts'] !== '' ? parseFloat(summaryOverrides['grand_rec_lts']) : calcGrandRecLts;
    const grandRecKg = summaryOverrides['grand_rec_kg'] !== undefined && summaryOverrides['grand_rec_kg'] !== '' ? parseFloat(summaryOverrides['grand_rec_kg']) : calcGrandRecKg;
    const grandRecFat = summaryOverrides['grand_rec_fat'] !== undefined && summaryOverrides['grand_rec_fat'] !== '' ? parseFloat(summaryOverrides['grand_rec_fat']) : calcGrandRecFat;
    const grandRecSnf = summaryOverrides['grand_rec_snf'] !== undefined && summaryOverrides['grand_rec_snf'] !== '' ? parseFloat(summaryOverrides['grand_rec_snf']) : calcGrandRecSnf;

    const calcGrandDispLts = dispTotLts + cbLts;
    const calcGrandDispKg = dispTotKg + cbKg;
    const calcGrandDispFat = dispTotFat + cbKgFat;
    const calcGrandDispSnf = dispTotSnf + cbKgSnf;

    const grandDispLts = summaryOverrides['grand_disp_lts'] !== undefined && summaryOverrides['grand_disp_lts'] !== '' ? parseFloat(summaryOverrides['grand_disp_lts']) : calcGrandDispLts;
    const grandDispKg = summaryOverrides['grand_disp_kg'] !== undefined && summaryOverrides['grand_disp_kg'] !== '' ? parseFloat(summaryOverrides['grand_disp_kg']) : calcGrandDispKg;
    const grandDispFat = summaryOverrides['grand_disp_fat'] !== undefined && summaryOverrides['grand_disp_fat'] !== '' ? parseFloat(summaryOverrides['grand_disp_fat']) : calcGrandDispFat;
    const grandDispSnf = summaryOverrides['grand_disp_snf'] !== undefined && summaryOverrides['grand_disp_snf'] !== '' ? parseFloat(summaryOverrides['grand_disp_snf']) : calcGrandDispSnf;

    const calcLossGainLts = grandDispLts - grandRecLts;
    const calcLossGainKg = grandDispKg - grandRecKg;
    const calcLossGainFat = grandDispFat - grandRecFat;
    const calcLossGainSnf = grandDispSnf - grandRecSnf;

    const lossGainLts = summaryOverrides['loss_gain_lts'] !== undefined && summaryOverrides['loss_gain_lts'] !== '' ? parseFloat(summaryOverrides['loss_gain_lts']) : calcLossGainLts;
    const lossGainKg = summaryOverrides['loss_gain_kg'] !== undefined && summaryOverrides['loss_gain_kg'] !== '' ? parseFloat(summaryOverrides['loss_gain_kg']) : calcLossGainKg;
    const lossGainFat = summaryOverrides['loss_gain_fat'] !== undefined && summaryOverrides['loss_gain_fat'] !== '' ? parseFloat(summaryOverrides['loss_gain_fat']) : calcLossGainFat;
    const lossGainSnf = summaryOverrides['loss_gain_snf'] !== undefined && summaryOverrides['loss_gain_snf'] !== '' ? parseFloat(summaryOverrides['loss_gain_snf']) : calcLossGainSnf;

    const calcLossGainPctFat = grandRecFat !== 0 ? (lossGainFat / grandRecFat) * 100 : 0;
    const calcLossGainPctSnf = grandRecSnf !== 0 ? (lossGainSnf / grandRecSnf) * 100 : 0;

    const lossGainPctFat = summaryOverrides['loss_gain_pct_fat'] !== undefined && summaryOverrides['loss_gain_pct_fat'] !== '' ? parseFloat(summaryOverrides['loss_gain_pct_fat']) : calcLossGainPctFat;
    const lossGainPctSnf = summaryOverrides['loss_gain_pct_snf'] !== undefined && summaryOverrides['loss_gain_pct_snf'] !== '' ? parseFloat(summaryOverrides['loss_gain_pct_snf']) : calcLossGainPctSnf;

    const cmpddNorm = parseFloat(blockState.cmpdd_norm || '0.5') || 0.5;
    const isFatWithinNorm = Math.abs(lossGainPctFat) <= cmpddNorm;
    const isSnfWithinNorm = Math.abs(lossGainPctSnf) <= cmpddNorm;
    const isWithinNorm = isFatWithinNorm && isSnfWithinNorm;

    const receiptColIdx = stgColumns.findIndex(c => c.key === 'variant' || c.key === 'receipt' || (c.type === 'text' && c.key !== 'disposal' && c.key !== 'particular' && !c.key.toLowerCase().includes('disposal')));
    const disposalColIdx = stgColumns.findIndex(c => c.key === 'disposal' || c.key.toLowerCase() === 'disposal' || c.name?.toLowerCase() === 'disposal');

    const qtyLtsIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'qty_lts');
    const qtyKgIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'qty_kg');
    const spGrIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'sp_gr');
    const fatPctIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'fat_pct');
    const snfPctIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'snf_pct');
    const kgFatIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'kg_fat');
    const kgSnfIdx = stgColumns.findIndex((c, i) => (disposalColIdx < 0 || i < disposalColIdx) && c.key === 'kg_snf');

    const dispQtyLtsIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && (c.key.includes('qty_lts') || c.key.includes('lts'))) : qtyLtsIdx;
    const dispSpGrIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && c.key.includes('sp_gr')) : spGrIdx;
    const dispQtyKgIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && c.key.includes('qty_kg')) : qtyKgIdx;
    const dispFatPctIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && c.key.includes('fat_pct')) : fatPctIdx;
    const dispSnfPctIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && c.key.includes('snf_pct')) : snfPctIdx;
    const dispKgFatIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && (c.key.includes('kg_fat') || c.key.includes('fat'))) : kgFatIdx;
    const dispKgSnfIdx = disposalColIdx >= 0 ? stgColumns.findIndex((c, i) => i > disposalColIdx && (c.key.includes('kg_snf') || c.key.includes('snf'))) : kgSnfIdx;

    const dQtyLtsIdx = dispQtyLtsIdx >= 0 ? dispQtyLtsIdx : (disposalColIdx >= 0 && qtyLtsIdx >= 0 ? disposalColIdx + qtyLtsIdx : qtyLtsIdx);
    const dSpGrIdx = dispSpGrIdx >= 0 ? dispSpGrIdx : (disposalColIdx >= 0 && spGrIdx >= 0 ? disposalColIdx + spGrIdx : spGrIdx);
    const dQtyKgIdx = dispQtyKgIdx >= 0 ? dispQtyKgIdx : (disposalColIdx >= 0 && qtyKgIdx >= 0 ? disposalColIdx + qtyKgIdx : qtyKgIdx);
    const dFatPctIdx = dispFatPctIdx >= 0 ? dispFatPctIdx : (disposalColIdx >= 0 && fatPctIdx >= 0 ? disposalColIdx + fatPctIdx : fatPctIdx);
    const dSnfPctIdx = dispSnfPctIdx >= 0 ? dispSnfPctIdx : (disposalColIdx >= 0 && snfPctIdx >= 0 ? disposalColIdx + snfPctIdx : snfPctIdx);
    const dKgFatIdx = dispKgFatIdx >= 0 ? dispKgFatIdx : (disposalColIdx >= 0 && kgFatIdx >= 0 ? disposalColIdx + kgFatIdx : kgFatIdx);
    const dKgSnfIdx = dispKgSnfIdx >= 0 ? dispKgSnfIdx : (disposalColIdx >= 0 && kgSnfIdx >= 0 ? disposalColIdx + kgSnfIdx : kgSnfIdx);

    // Active Cell State Evaluation for Top Formula Bar
    let activeAddress = 'A1';
    let activeColName = '';
    let activeFormulaText = '';
    let activeValue = '-';

    if (selectedCell && selectedCell.blockKey === blockKey) {
      if (typeof selectedCell.rowIndex === 'number') {
        const colIdx = stgColumns.findIndex(c => c.key === selectedCell.colKey);
        if (colIdx >= 0) {
          const activeCol = stgColumns[colIdx];
          const excelColLetter = getExcelColName(colIdx);
          const excelRowNum = selectedCell.rowIndex + 1;
          activeAddress = `${excelColLetter}${excelRowNum}`;
          activeColName = activeCol.name;

          const currentRow = rows[selectedCell.rowIndex] || { variant: '', values: {} };
          const rowVals = currentRow.values || {};
          const computedVal = computeCell(activeCol, rowVals, selectedCell.rowIndex, stgColumns, rows);

          const storedVal = rowVals[activeCol.key];
          if (typeof storedVal === 'string' && (storedVal.startsWith('=') || storedVal.startsWith('=+'))) {
            activeFormulaText = storedVal;
          } else if (activeCol.type === 'calculated') {
            activeFormulaText = activeCol.formula ? `= ${activeCol.formula}` : '= CALCULATED';
          } else {
            const rawVal = storedVal !== undefined ? storedVal : (activeCol.type === 'text' ? (currentRow.variant || '') : '');
            activeFormulaText = rawVal !== '' ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
          }

          activeValue = typeof computedVal === 'number'
            ? (computedVal !== 0 ? formatNumberValue(computedVal, activeCol.decimals, activeCol.key) : '0')
            : (computedVal || '-');
        }
      } else if (typeof selectedCell.rowIndex === 'string') {
        const rKey = selectedCell.rowIndex;
        const fKey = selectedCell.fieldKey;

        const summaryMeta = getSummaryFieldMeta(
          fKey,
          rKey,
          rows.length,
          stgColumns,
          {
            totQtyLts, totQtyKg, totKgFat, totKgSnf,
            obLts, obKg, obFatPct, obSnfPct, obSpGr, obKgFat, obKgSnf,
            cbLts, cbKg, cbFatPct, cbSnfPct, cbSpGr, cbKgFat, cbKgSnf,
            calcGrandRecLts, calcGrandRecKg, calcGrandRecFat, calcGrandRecSnf,
            calcGrandDispLts, calcGrandDispKg, calcGrandDispFat, calcGrandDispSnf,
            calcLossGainLts, calcLossGainKg, calcLossGainFat, calcLossGainSnf,
            calcLossGainPctFat, calcLossGainPctSnf,
            cmpddNorm
          }
        );

        if (summaryMeta) {
          activeAddress = summaryMeta.address;
          activeColName = summaryMeta.colName;
          activeValue = summaryMeta.displayValue;
          const userOverride = fKey ? summaryOverrides[fKey] : undefined;
          if (userOverride !== undefined && userOverride !== '') {
            activeFormulaText = userOverride.startsWith('=') ? userOverride : `= ${userOverride}`;
          } else {
            activeFormulaText = summaryMeta.formula;
          }
        }
      }
    }

    return (
      <div className="card animate-fade-in" style={{ marginBottom: 32, display: 'flex', flexDirection: 'column' }}>
        {/* Header Bar */}
        <div style={{ padding: '12px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderRadius: '8px 8px 0 0' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⭐ Formulation Table for {cleanStatementLabel(s.label).replace(/\s*-\s*RECEIPT AND DISPOSAL STATEMENT$/i, '')}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: 2 }}>
              Matrix formulation table inherited from Master Default Formulation Tables.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setBlocks(prev => {
                  const next = { ...prev };
                  const b = { ...next[blockKey] };
                  const bRows = [...(b.rows || [])];
                  bRows.push({ variant: '', values: {} });
                  b.rows = bRows;
                  next[blockKey] = b;
                  return next;
                });
              }}
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ➕ Add Particular Row
            </button>
            <Link
              href="/dashboard/ts/manage-statements/defaults"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}
              title="Master Default Formulation Tables"
            >
              ⭐ Master Defaults
            </Link>
            <button
              type="button"
              className="no-print"
              onClick={async () => {
                const ok = await confirm({ title: 'Remove Statement Block', message: `Remove "${s.label}" from this shift?`, confirmText: 'Remove Block', cancelText: 'Cancel', type: 'danger' });
                if (ok) setEnabledBlockKeys(prev => prev.filter(k => k !== blockKey));
              }}
              style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ❌ Remove Block
            </button>
          </div>
        </div>

        {/* Formula Bar */}
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
            <span>{activeAddress}</span>
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

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
            {activeColName && (
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
                {activeColName}
              </span>
            )}
            <input
              type="text"
              className="form-input"
              disabled={!selectedCell || selectedCell.blockKey !== blockKey}
              value={activeFormulaText}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onChange={e => {
                if (!selectedCell || selectedCell.blockKey !== blockKey) return;
                const val = e.target.value;
                if (typeof selectedCell.rowIndex === 'number') {
                  handleCellChange(selectedCell.rowIndex, selectedCell.colKey, val);
                } else if (typeof selectedCell.rowIndex === 'string' && selectedCell.fieldKey) {
                  const fKey = selectedCell.fieldKey;
                  if (['ob_qty_lts', 'ob_sp_gr', 'ob_qty_kg', 'ob_fat_pct', 'ob_snf_pct'].includes(fKey)) {
                    handleObChange(blockKey, fKey.replace('ob_', ''), val);
                  } else if (['cb_qty_lts', 'cb_sp_gr', 'cb_qty_kg', 'cb_fat_pct', 'cb_snf_pct'].includes(fKey)) {
                    handleCbChange(blockKey, fKey.replace('cb_', ''), val);
                  } else if (fKey === 'cmpdd_norm') {
                    handleCmpddNormChange(blockKey, val);
                  } else {
                    setBlocks(prev => {
                      const next = { ...prev };
                      const b = { ...next[blockKey] };
                      const ov = { ...(b.summary_overrides || {}) };
                      if (val === '') {
                        delete ov[fKey];
                      } else {
                        ov[fKey] = val;
                      }
                      b.summary_overrides = ov;
                      next[blockKey] = b;
                      return next;
                    });
                  }
                }
              }}
              placeholder={selectedCell && selectedCell.blockKey === blockKey ? "Enter value or formula e.g. =SUM(C1:C4) or =+B1*A1" : "Click any cell in formulation or summary table to inspect formula"}
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: '#ffffff',
                color: activeFormulaText.startsWith('=') ? '#b45309' : 'var(--text-primary)',
                borderColor: selectedCell && selectedCell.blockKey === blockKey ? '#b45309' : 'var(--border)',
                height: 30,
              }}
            />
          </div>

          {selectedCell && selectedCell.blockKey === blockKey && (
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
              <span style={{ fontFamily: 'var(--font-numbers)', fontWeight: 800 }}>{activeValue}</span>
            </div>
          )}
        </div>

        {/* Matrix Grid Table */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table className="inline-table" style={{ width: '100%', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ width: 40, textAlign: 'center' }}>#</th>
                {stgColumns.map((col, cIdx) => (
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
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.type === 'text' ? 'flex-start' : 'space-between', gap: 6 }}>
                      <span>{col.name} {col.unit ? `(${col.unit})` : ''}</span>
                      {col.type !== 'text' && (
                        <select
                          value={col.decimals !== undefined ? String(col.decimals) : ''}
                          onChange={(e) => {
                            const val = e.target.value !== '' ? parseInt(e.target.value, 10) : undefined;
                            setStgColumns(prev => prev.map(c => c.key === col.key ? { ...c, decimals: val } : c));
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
                <th style={{ width: 110, textAlign: 'center' }}>Row Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={`stg_row_${blockKey}_${rIdx}`}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem' }}>
                    {rIdx + 1}
                  </td>
                  {stgColumns.map((col, cIdx) => {
                    const isCellSelected = selectedCell?.blockKey === blockKey && selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;
                    const isCellFocused = focusedCell?.blockKey === blockKey && focusedCell?.rowIndex === rIdx && focusedCell?.colKey === col.key;
                    const computedVal = computeCell(col, row.values || {}, rIdx, stgColumns, rows);

                    if (col.type === 'calculated') {
                      const formattedCalc = typeof computedVal === 'number'
                        ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '-')
                        : (computedVal || '-');

                      return (
                        <td
                          key={`m_cell_${rIdx}_${col.key}`}
                          onClick={() => setSelectedCell({ blockKey, rowIndex: rIdx, colKey: col.key })}
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

                    const isDraggedInFillModal = !!(fillDrag && fillDrag.blockKey === blockKey && fillDrag.colKey === col.key &&
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
                            title={`Formula: ${rawVal}`}
                          />
                        )}
                        <input
                          type="text"
                          list={col.type === 'text' ? 'variant-products-list' : undefined}
                          className="form-input"
                          value={displayVal}
                          placeholder="-"
                          title={isFormula ? `Formula: ${rawVal}` : undefined}
                          onFocus={() => {
                            setSelectedCell({ blockKey, rowIndex: rIdx, colKey: col.key });
                            setFocusedCell({ blockKey, rowIndex: rIdx, colKey: col.key });
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onClick={() => setSelectedCell({ blockKey, rowIndex: rIdx, colKey: col.key })}
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

                        {/* Drag-to-Fill Handle */}
                        {isCellSelected && (
                          <div
                            onMouseDown={e => handleFillDragStart(e, blockKey, rIdx, col.key)}
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
                            title="Excel Fill Handle: Drag up or down to auto-fill formula/values with relative row adjustment"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        type="button"
                        disabled={rIdx === 0}
                        onClick={() => {
                          if (rIdx === 0) return;
                          setBlocks(prev => {
                            const next = { ...prev };
                            const b = { ...next[blockKey] };
                            const bRows = [...(b.rows || [])];
                            const temp = bRows[rIdx];
                            bRows[rIdx] = bRows[rIdx - 1];
                            bRows[rIdx - 1] = temp;
                            b.rows = bRows;
                            next[blockKey] = b;
                            return next;
                          });
                        }}
                        style={{
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          cursor: rIdx === 0 ? 'not-allowed' : 'pointer',
                          opacity: rIdx === 0 ? 0.4 : 1,
                        }}
                        title="Move Row Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={rIdx === rows.length - 1}
                        onClick={() => {
                          if (rIdx === rows.length - 1) return;
                          setBlocks(prev => {
                            const next = { ...prev };
                            const b = { ...next[blockKey] };
                            const bRows = [...(b.rows || [])];
                            const temp = bRows[rIdx];
                            bRows[rIdx] = bRows[rIdx + 1];
                            bRows[rIdx + 1] = temp;
                            b.rows = bRows;
                            next[blockKey] = b;
                            return next;
                          });
                        }}
                        style={{
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          cursor: rIdx === rows.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: rIdx === rows.length - 1 ? 0.4 : 1,
                        }}
                        title="Move Row Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (rows.length <= 1) return;
                          setBlocks(prev => {
                            const next = { ...prev };
                            const b = { ...next[blockKey] };
                            b.rows = (b.rows || []).filter((_, idx) => idx !== rIdx);
                            next[blockKey] = b;
                            return next;
                          });
                        }}
                        style={{
                          border: '1px solid #fca5a5',
                          background: '#fef2f2',
                          color: '#dc2626',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
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

        {/* Dedicated Live Summary Table: Stock Statement Summary (Live) */}
        {(() => {
          const renderSummaryInput = (
            fieldKey: string,
            calcVal: number,
            decimals: number,
            unitSuffix: string = '',
            customStyle?: React.CSSProperties,
            rowKey: string = 'row-summary',
            colKey: string = 'qty_lts'
          ) => {
            const userOverride = summaryOverrides[fieldKey];
            const hasOverride = userOverride !== undefined && userOverride !== '';
            const displayCalc = !isNaN(calcVal) ? formatNumberValue(calcVal, decimals) : '-';
            const valToShow = hasOverride ? userOverride : (calcVal !== 0 && !isNaN(calcVal) ? String(calcVal) : '');
            const isCellSelected = selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === fieldKey;

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  type="text"
                  placeholder={displayCalc}
                  value={valToShow}
                  onFocus={() => setSelectedCell({ blockKey, rowIndex: rowKey, colKey, fieldKey })}
                  onClick={() => setSelectedCell({ blockKey, rowIndex: rowKey, colKey, fieldKey })}
                  onChange={e => {
                    const val = e.target.value;
                    setBlocks(prev => {
                      const next = { ...prev };
                      const b = { ...next[blockKey] };
                      const ov = { ...(b.summary_overrides || {}) };
                      if (val === '') {
                        delete ov[fieldKey];
                      } else {
                        ov[fieldKey] = val;
                      }
                      b.summary_overrides = ov;
                      next[blockKey] = b;
                      return next;
                    });
                  }}
                  title={`Calculated: ${displayCalc}. Click to inspect formula in Formula Bar or type to override.`}
                  style={{
                    width: '100%',
                    padding: '2px 4px',
                    fontSize: '0.8rem',
                    textAlign: 'right',
                    fontFamily: 'var(--font-numbers)',
                    fontWeight: 800,
                    borderRadius: 4,
                    border: isCellSelected
                      ? '2px solid #b45309'
                      : (hasOverride ? '1px solid #f59e0b' : '1px solid #cbd5e1'),
                    background: isCellSelected
                      ? '#fef3c7'
                      : (hasOverride ? '#fffbeb' : '#ffffff'),
                    color: hasOverride ? '#b45309' : (customStyle?.color || 'var(--text-primary)'),
                    boxShadow: isCellSelected
                      ? '0 0 0 2px rgba(180, 83, 9, 0.35)'
                      : (hasOverride ? '0 0 0 1px #f59e0b' : 'none'),
                    outline: 'none',
                    ...customStyle,
                  }}
                />
                {unitSuffix && <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>{unitSuffix}</span>}
              </div>
            );
          };

          const renderObInput = (field: string, val: string, placeholder: string, step?: string) => {
            const fieldKey = `ob_${field}`;
            const isCellSelected = selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === fieldKey;
            return (
              <input
                type="number"
                step={step}
                placeholder={placeholder}
                value={val || ''}
                onFocus={() => setSelectedCell({ blockKey, rowIndex: 'row-ob-cb', colKey: field, fieldKey })}
                onClick={() => setSelectedCell({ blockKey, rowIndex: 'row-ob-cb', colKey: field, fieldKey })}
                onChange={e => handleObChange(blockKey, field, e.target.value)}
                style={{
                  width: '100%',
                  padding: '2px 4px',
                  fontSize: '0.8rem',
                  textAlign: 'right',
                  borderRadius: 4,
                  border: isCellSelected ? '2px solid #b45309' : '1px solid #7dd3fc',
                  background: isCellSelected ? '#fef3c7' : '#ffffff',
                  fontWeight: 700,
                  boxShadow: isCellSelected ? '0 0 0 2px rgba(180, 83, 9, 0.35)' : 'none',
                  outline: 'none'
                }}
              />
            );
          };

          const renderCbInput = (field: string, val: string, placeholder: string, step?: string) => {
            const fieldKey = `cb_${field}`;
            const isCellSelected = selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === fieldKey;
            return (
              <input
                type="number"
                step={step}
                placeholder={placeholder}
                value={val || ''}
                onFocus={() => setSelectedCell({ blockKey, rowIndex: 'row-ob-cb', colKey: field, fieldKey })}
                onClick={() => setSelectedCell({ blockKey, rowIndex: 'row-ob-cb', colKey: field, fieldKey })}
                onChange={e => handleCbChange(blockKey, field, e.target.value)}
                style={{
                  width: '100%',
                  padding: '2px 4px',
                  fontSize: '0.8rem',
                  textAlign: 'right',
                  borderRadius: 4,
                  border: isCellSelected ? '2px solid #b45309' : '1px solid #fdba74',
                  background: isCellSelected ? '#fef3c7' : '#ffffff',
                  fontWeight: 700,
                  boxShadow: isCellSelected ? '0 0 0 2px rgba(180, 83, 9, 0.35)' : 'none',
                  outline: 'none'
                }}
              />
            );
          };

          const renderSummaryRowPair = (
            rowKey: string,
            icon: React.ReactNode,
            receiptLabel: React.ReactNode | null,
            receiptValues: Record<number, React.ReactNode>,
            disposalLabel: React.ReactNode | null,
            disposalValues: Record<number, React.ReactNode>,
            rowStyle: React.CSSProperties,
            lastColContent: React.ReactNode = '-'
          ) => {
            if (disposalColIdx >= 0) {
              return (
                <tr key={rowKey} style={rowStyle}>
                  <td style={{ textAlign: 'center' }}>{icon}</td>
                  {stgColumns.map((col, cIdx) => {
                    if (cIdx === receiptColIdx) {
                      return <td key={`r_lbl_${col.key}`}>{receiptLabel || <span style={{ color: '#94a3b8' }}>-</span>}</td>;
                    }
                    if (cIdx === disposalColIdx) {
                      return <td key={`d_lbl_${col.key}`}>{disposalLabel || <span style={{ color: '#94a3b8' }}>-</span>}</td>;
                    }
                    if (cIdx < disposalColIdx) {
                      if (receiptValues[cIdx] !== undefined) {
                        return (
                          <td key={`r_val_${col.key}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                            {receiptValues[cIdx]}
                          </td>
                        );
                      }
                      return <td key={`r_empty_${col.key}`} style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>;
                    }
                    if (cIdx > disposalColIdx) {
                      if (disposalValues[cIdx] !== undefined) {
                        return (
                          <td key={`d_val_${col.key}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                            {disposalValues[cIdx]}
                          </td>
                        );
                      }
                      return <td key={`d_empty_${col.key}`} style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>;
                    }
                    return <td key={`empty_${col.key}`} style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>;
                  })}
                  <td style={{ textAlign: 'center' }}>{lastColContent}</td>
                </tr>
              );
            }

            return (
              <React.Fragment key={rowKey}>
                {receiptLabel && (
                  <tr key={`${rowKey}-rec`} style={rowStyle}>
                    <td style={{ textAlign: 'center' }}>{icon}</td>
                    {stgColumns.map((col, cIdx) => {
                      if (cIdx === receiptColIdx) return <td key={col.key}>{receiptLabel}</td>;
                      if (receiptValues[cIdx] !== undefined) {
                        return <td key={col.key} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>{receiptValues[cIdx]}</td>;
                      }
                      return <td key={col.key} style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>;
                    })}
                    <td style={{ textAlign: 'center' }}>-</td>
                  </tr>
                )}
                {disposalLabel && (
                  <tr key={`${rowKey}-disp`} style={rowStyle}>
                    <td style={{ textAlign: 'center' }}>{icon}</td>
                    {stgColumns.map((col, cIdx) => {
                      if (cIdx === receiptColIdx) return <td key={col.key}>{disposalLabel}</td>;
                      if (disposalValues[cIdx] !== undefined) {
                        return <td key={col.key} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>{disposalValues[cIdx]}</td>;
                      }
                      return <td key={col.key} style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>;
                    })}
                    <td style={{ textAlign: 'center' }}>{lastColContent}</td>
                  </tr>
                )}
              </React.Fragment>
            );
          };

          const numStyle = (color: string) => ({ color, fontWeight: 800 } as React.CSSProperties);

          let summaryActiveAddress = `C${rows.length + 1}`;
          let summaryActiveColName = 'Total Receipt QTY (Lts)';
          let summaryActiveFormulaText = `=SUM(C1:${getExcelColName(qtyLtsIdx >= 0 ? qtyLtsIdx : 2)}${rows.length})`;
          let summaryActiveValue = formatNumberValue(totQtyLts, 0);

          if (selectedCell && selectedCell.blockKey === blockKey && typeof selectedCell.rowIndex === 'string') {
            const rKey = selectedCell.rowIndex;
            const fKey = selectedCell.fieldKey;

            const summaryMeta = getSummaryFieldMeta(
              fKey,
              rKey,
              rows.length,
              stgColumns,
              {
                totQtyLts, totQtyKg, totKgFat, totKgSnf,
                obLts, obKg, obFatPct, obSnfPct, obSpGr, obKgFat, obKgSnf,
                cbLts, cbKg, cbFatPct, cbSnfPct, cbSpGr, cbKgFat, cbKgSnf,
                calcGrandRecLts, calcGrandRecKg, calcGrandRecFat, calcGrandRecSnf,
                calcGrandDispLts, calcGrandDispKg, calcGrandDispFat, calcGrandDispSnf,
                calcLossGainLts, calcLossGainKg, calcLossGainFat, calcLossGainSnf,
                calcLossGainPctFat, calcLossGainPctSnf,
                cmpddNorm
              }
            );

            if (summaryMeta) {
              summaryActiveAddress = summaryMeta.address;
              summaryActiveColName = summaryMeta.colName;
              summaryActiveValue = summaryMeta.displayValue;
              const userOverride = fKey ? summaryOverrides[fKey] : undefined;
              if (userOverride !== undefined && userOverride !== '') {
                summaryActiveFormulaText = userOverride.startsWith('=') ? userOverride : `= ${userOverride}`;
              } else {
                summaryActiveFormulaText = summaryMeta.formula;
              }
            }
          }

          return (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '2px dashed #cbd5e1' }}>
              <div className="entry-form-section-title" style={{ color: 'var(--brand-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>📊 Stock Statement Summary (Live)</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 4 }}>
                  {cleanStatementLabel(s.label)}
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4 }}>
                  ⚡ Auto-calculated & Fully Editable
                </span>
              </div>

              {/* Dedicated Formula Bar for Stock Statement Summary (Live) */}
              <div
                style={{
                  padding: '8px 16px',
                  marginBottom: 14,
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: 8,
                  border: '1px solid #7dd3fc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(2, 132, 199, 0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#ffffff',
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: '1px solid #0284c7',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    color: '#0369a1',
                    fontFamily: 'monospace',
                    minWidth: 65,
                    justifyContent: 'center',
                  }}
                  title="Summary Cell Excel Address"
                >
                  <span>{summaryActiveAddress}</span>
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    color: '#0284c7',
                    fontStyle: 'italic',
                    fontFamily: 'serif',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Stock Statement Summary Formula Indicator"
                >
                  <span>ƒx</span>
                </div>

                <div style={{ height: 20, width: 1, background: '#7dd3fc' }} />

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
                  {summaryActiveColName && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: '#0284c7',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {summaryActiveColName}
                    </span>
                  )}
                  <input
                    type="text"
                    className="form-input"
                    value={summaryActiveFormulaText}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    onChange={e => {
                      if (!selectedCell || selectedCell.blockKey !== blockKey || typeof selectedCell.rowIndex !== 'string' || !selectedCell.fieldKey) return;
                      const val = e.target.value;
                      const fKey = selectedCell.fieldKey;

                      if (['ob_qty_lts', 'ob_sp_gr', 'ob_qty_kg', 'ob_fat_pct', 'ob_snf_pct'].includes(fKey)) {
                        handleObChange(blockKey, fKey.replace('ob_', ''), val);
                      } else if (['cb_qty_lts', 'cb_sp_gr', 'cb_qty_kg', 'cb_fat_pct', 'cb_snf_pct'].includes(fKey)) {
                        handleCbChange(blockKey, fKey.replace('cb_', ''), val);
                      } else if (fKey === 'cmpdd_norm') {
                        handleCmpddNormChange(blockKey, val);
                      } else {
                        setBlocks(prev => {
                          const next = { ...prev };
                          const b = { ...next[blockKey] };
                          const ov = { ...(b.summary_overrides || {}) };
                          if (val === '') {
                            delete ov[fKey];
                          } else {
                            ov[fKey] = val;
                          }
                          b.summary_overrides = ov;
                          next[blockKey] = b;
                          return next;
                        });
                      }
                    }}
                    placeholder="Click any cell in Stock Statement Summary (Live) below to inspect or enter formula (e.g. =SUM(C1:C4))"
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: '#ffffff',
                      color: summaryActiveFormulaText.startsWith('=') ? '#0284c7' : 'var(--text-primary)',
                      borderColor: '#0284c7',
                      height: 30,
                    }}
                  />
                </div>

                {summaryActiveValue && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: '#ffffff',
                      border: '1px solid #7dd3fc',
                      color: '#0369a1',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ color: '#0369a1' }}>Value:</span>
                    <span style={{ fontFamily: 'var(--font-numbers)', fontWeight: 800 }}>{summaryActiveValue}</span>
                  </div>
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="inline-table" style={{ width: '100%', minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ width: 40, textAlign: 'center' }}>#</th>
                      {stgColumns.map((col, cIdx) => (
                        <th
                          key={`sum_head_${col.key}`}
                          style={{
                            textAlign: col.type === 'text' ? 'left' : 'right',
                            background: col.type === 'calculated' ? '#e0f2fe' : '#f1f5f9',
                            color: col.type === 'calculated' ? '#0369a1' : 'var(--text-primary)',
                            padding: '8px 10px',
                            fontSize: '0.82rem',
                            minWidth: 110,
                          }}
                        >
                          <span>{col.name} {col.unit ? `(${col.unit})` : ''}</span>
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', width: 140 }}>Status / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Total (Receipt) & Total (Disposal) */}
                    {renderSummaryRowPair(
                      'row-total',
                      <span style={{ color: '#64748b' }}>∑</span>,
                      <span style={{ fontWeight: 800, color: '#334155' }}>Total (Receipt)</span>,
                      {
                        ...(qtyLtsIdx >= 0 ? { [qtyLtsIdx]: renderSummaryInput('tot_rec_lts', totQtyLts, 0, '', numStyle('#0369a1'), 'row-total', 'qty_lts') } : {}),
                        ...(spGrIdx >= 0 ? { [spGrIdx]: renderSummaryInput('tot_rec_sp_gr', totQtyLts > 0 ? totQtyKg / totQtyLts : 0, 4, '', { color: '#0369a1' }, 'row-total', 'sp_gr') } : {}),
                        ...(qtyKgIdx >= 0 ? { [qtyKgIdx]: renderSummaryInput('tot_rec_kg', totQtyKg, 2, '', numStyle('#0369a1'), 'row-total', 'qty_kg') } : {}),
                        ...(fatPctIdx >= 0 ? { [fatPctIdx]: renderSummaryInput('tot_rec_fat_pct', totQtyKg > 0 ? (totKgFat / totQtyKg) * 100 : 0, 2, '%', { color: '#0369a1' }, 'row-total', 'fat_pct') } : {}),
                        ...(snfPctIdx >= 0 ? { [snfPctIdx]: renderSummaryInput('tot_rec_snf_pct', totQtyKg > 0 ? (totKgSnf / totQtyKg) * 100 : 0, 2, '%', { color: '#0369a1' }, 'row-total', 'snf_pct') } : {}),
                        ...(kgFatIdx >= 0 ? { [kgFatIdx]: renderSummaryInput('tot_rec_fat', totKgFat, 3, '', numStyle('#0369a1'), 'row-total', 'kg_fat') } : {}),
                        ...(kgSnfIdx >= 0 ? { [kgSnfIdx]: renderSummaryInput('tot_rec_snf', totKgSnf, 3, '', numStyle('#0369a1'), 'row-total', 'kg_snf') } : {}),
                      },
                      <span style={{ fontWeight: 800, color: '#c2410c' }}>Total (Disposal)</span>,
                      {
                        ...(dQtyLtsIdx >= 0 ? { [dQtyLtsIdx]: renderSummaryInput('tot_disp_lts', totQtyLts, 0, '', numStyle('#c2410c'), 'row-total', 'qty_lts') } : {}),
                        ...(dSpGrIdx >= 0 ? { [dSpGrIdx]: renderSummaryInput('tot_disp_sp_gr', totQtyLts > 0 ? totQtyKg / totQtyLts : 0, 4, '', { color: '#c2410c' }, 'row-total', 'sp_gr') } : {}),
                        ...(dQtyKgIdx >= 0 ? { [dQtyKgIdx]: renderSummaryInput('tot_disp_kg', totQtyKg, 2, '', numStyle('#c2410c'), 'row-total', 'qty_kg') } : {}),
                        ...(dFatPctIdx >= 0 ? { [dFatPctIdx]: renderSummaryInput('tot_disp_fat_pct', totQtyKg > 0 ? (totKgFat / totQtyKg) * 100 : 0, 2, '%', { color: '#c2410c' }, 'row-total', 'fat_pct') } : {}),
                        ...(dSnfPctIdx >= 0 ? { [dSnfPctIdx]: renderSummaryInput('tot_disp_snf_pct', totQtyKg > 0 ? (totKgSnf / totQtyKg) * 100 : 0, 2, '%', { color: '#c2410c' }, 'row-total', 'snf_pct') } : {}),
                        ...(dKgFatIdx >= 0 ? { [dKgFatIdx]: renderSummaryInput('tot_disp_fat', totKgFat, 3, '', numStyle('#c2410c'), 'row-total', 'kg_fat') } : {}),
                        ...(dKgSnfIdx >= 0 ? { [dKgSnfIdx]: renderSummaryInput('tot_disp_snf', totKgSnf, 3, '', numStyle('#c2410c'), 'row-total', 'kg_snf') } : {}),
                      },
                      { background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }
                    )}

                    {/* Row 2: Opening Balance (O/B) & Closing Balance (C/B) */}
                    {renderSummaryRowPair(
                      'row-ob-cb',
                      <span style={{ color: '#0284c7' }}>📥</span>,
                      <span style={{ fontWeight: 800, color: '#0369a1' }}>Opening Balance (O/B)</span>,
                      {
                        ...(qtyLtsIdx >= 0 ? { [qtyLtsIdx]: renderObInput('qty_lts', obState.qty_lts || '', 'Lts') } : {}),
                        ...(spGrIdx >= 0 ? { [spGrIdx]: renderObInput('sp_gr', obState.sp_gr || '', 'Sp.Gr', '0.0001') } : {}),
                        ...(qtyKgIdx >= 0 ? { [qtyKgIdx]: renderObInput('qty_kg', obState.qty_kg || '', 'Kg') } : {}),
                        ...(fatPctIdx >= 0 ? { [fatPctIdx]: renderObInput('fat_pct', obState.fat_pct || '', 'Fat%', '0.01') } : {}),
                        ...(snfPctIdx >= 0 ? { [snfPctIdx]: renderObInput('snf_pct', obState.snf_pct || '', 'Snf%', '0.01') } : {}),
                        ...(kgFatIdx >= 0 ? { [kgFatIdx]: renderSummaryInput('ob_kg_fat', obKgFat, 3, '', numStyle('#0369a1'), 'row-ob-cb', 'kg_fat') } : {}),
                        ...(kgSnfIdx >= 0 ? { [kgSnfIdx]: renderSummaryInput('ob_kg_snf', obKgSnf, 3, '', numStyle('#0369a1'), 'row-ob-cb', 'kg_snf') } : {}),
                      },
                      <span style={{ fontWeight: 800, color: '#c2410c' }}>Closing Balance (C/B)</span>,
                      {
                        ...(dQtyLtsIdx >= 0 ? { [dQtyLtsIdx]: renderCbInput('qty_lts', cbState.qty_lts || '', 'Lts') } : {}),
                        ...(dSpGrIdx >= 0 ? { [dSpGrIdx]: renderCbInput('sp_gr', cbState.sp_gr || '', 'Sp.Gr', '0.0001') } : {}),
                        ...(dQtyKgIdx >= 0 ? { [dQtyKgIdx]: renderCbInput('qty_kg', cbState.qty_kg || '', 'Kg') } : {}),
                        ...(dFatPctIdx >= 0 ? { [dFatPctIdx]: renderCbInput('fat_pct', cbState.fat_pct || '', 'Fat%', '0.01') } : {}),
                        ...(dSnfPctIdx >= 0 ? { [dSnfPctIdx]: renderCbInput('snf_pct', cbState.snf_pct || '', 'Snf%', '0.01') } : {}),
                        ...(dKgFatIdx >= 0 ? { [dKgFatIdx]: renderSummaryInput('cb_kg_fat', cbKgFat, 3, '', numStyle('#c2410c'), 'row-ob-cb', 'kg_fat') } : {}),
                        ...(dKgSnfIdx >= 0 ? { [dKgSnfIdx]: renderSummaryInput('cb_kg_snf', cbKgSnf, 3, '', numStyle('#c2410c'), 'row-ob-cb', 'kg_snf') } : {}),
                      },
                      { background: '#f0f9ff', fontWeight: 800 }
                    )}

                    {/* Row 3: Grand Total Receipts & Grand Total Disposals */}
                    {renderSummaryRowPair(
                      'row-grand-total',
                      <span style={{ color: '#0369a1' }}>∑</span>,
                      <span style={{ fontWeight: 800, color: '#0c4a6e' }}>Grand Total Receipts</span>,
                      {
                        ...(qtyLtsIdx >= 0 ? { [qtyLtsIdx]: renderSummaryInput('grand_rec_lts', calcGrandRecLts, 0, '', numStyle('#0c4a6e'), 'row-grand-total', 'qty_lts') } : {}),
                        ...(spGrIdx >= 0 ? { [spGrIdx]: renderSummaryInput('grand_rec_sp_gr', grandRecLts > 0 ? grandRecKg / grandRecLts : 0, 4, '', { color: '#0c4a6e' }, 'row-grand-total', 'sp_gr') } : {}),
                        ...(qtyKgIdx >= 0 ? { [qtyKgIdx]: renderSummaryInput('grand_rec_kg', calcGrandRecKg, 2, '', numStyle('#0c4a6e'), 'row-grand-total', 'qty_kg') } : {}),
                        ...(fatPctIdx >= 0 ? { [fatPctIdx]: renderSummaryInput('grand_rec_fat_pct', grandRecKg > 0 ? (grandRecFat / grandRecKg) * 100 : 0, 2, '%', { color: '#0c4a6e' }, 'row-grand-total', 'fat_pct') } : {}),
                        ...(snfPctIdx >= 0 ? { [snfPctIdx]: renderSummaryInput('grand_rec_snf_pct', grandRecKg > 0 ? (grandRecSnf / grandRecKg) * 100 : 0, 2, '%', { color: '#0c4a6e' }, 'row-grand-total', 'snf_pct') } : {}),
                        ...(kgFatIdx >= 0 ? { [kgFatIdx]: renderSummaryInput('grand_rec_fat', calcGrandRecFat, 3, '', numStyle('#0c4a6e'), 'row-grand-total', 'kg_fat') } : {}),
                        ...(kgSnfIdx >= 0 ? { [kgSnfIdx]: renderSummaryInput('grand_rec_snf', calcGrandRecSnf, 3, '', numStyle('#0c4a6e'), 'row-grand-total', 'kg_snf') } : {}),
                      },
                      <span style={{ fontWeight: 800, color: '#7c2d12' }}>Grand Total Disposals</span>,
                      {
                        ...(dQtyLtsIdx >= 0 ? { [dQtyLtsIdx]: renderSummaryInput('grand_disp_lts', calcGrandDispLts, 0, '', numStyle('#7c2d12'), 'row-grand-total', 'qty_lts') } : {}),
                        ...(dSpGrIdx >= 0 ? { [dSpGrIdx]: renderSummaryInput('grand_disp_sp_gr', grandDispLts > 0 ? grandDispKg / grandDispLts : 0, 4, '', { color: '#7c2d12' }, 'row-grand-total', 'sp_gr') } : {}),
                        ...(dQtyKgIdx >= 0 ? { [dQtyKgIdx]: renderSummaryInput('grand_disp_kg', calcGrandDispKg, 2, '', numStyle('#7c2d12'), 'row-grand-total', 'qty_kg') } : {}),
                        ...(dFatPctIdx >= 0 ? { [dFatPctIdx]: renderSummaryInput('grand_disp_fat_pct', grandDispKg > 0 ? (grandDispFat / grandDispKg) * 100 : 0, 2, '%', { color: '#7c2d12' }, 'row-grand-total', 'fat_pct') } : {}),
                        ...(dSnfPctIdx >= 0 ? { [dSnfPctIdx]: renderSummaryInput('grand_disp_snf_pct', grandDispKg > 0 ? (grandDispSnf / grandDispKg) * 100 : 0, 2, '%', { color: '#7c2d12' }, 'row-grand-total', 'snf_pct') } : {}),
                        ...(dKgFatIdx >= 0 ? { [dKgFatIdx]: renderSummaryInput('grand_disp_fat', calcGrandDispFat, 3, '', numStyle('#7c2d12'), 'row-grand-total', 'kg_fat') } : {}),
                        ...(dKgSnfIdx >= 0 ? { [dKgSnfIdx]: renderSummaryInput('grand_disp_snf', calcGrandDispSnf, 3, '', numStyle('#7c2d12'), 'row-grand-total', 'kg_snf') } : {}),
                      },
                      { background: '#e0f2fe', fontWeight: 800, borderBottom: '1px solid #bae6fd' }
                    )}

                    {/* Row 4: Loss / Gain */}
                    {renderSummaryRowPair(
                      'row-loss-gain',
                      <span style={{ color: '#dc2626' }}>📊</span>,
                      null,
                      {},
                      <span style={{ fontWeight: 800, color: '#b91c1c' }}>Loss / Gain</span>,
                      {
                        ...(dQtyLtsIdx >= 0 ? { [dQtyLtsIdx]: renderSummaryInput('loss_gain_lts', calcLossGainLts, 0, '', { color: lossGainLts >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800 }, 'row-loss-gain', 'qty_lts') } : {}),
                        ...(dQtyKgIdx >= 0 ? { [dQtyKgIdx]: renderSummaryInput('loss_gain_kg', calcLossGainKg, 2, '', { color: lossGainKg >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800 }, 'row-loss-gain', 'qty_kg') } : {}),
                        ...(dKgFatIdx >= 0 ? { [dKgFatIdx]: renderSummaryInput('loss_gain_fat', calcLossGainFat, 3, '', { color: lossGainFat >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800 }, 'row-loss-gain', 'kg_fat') } : {}),
                        ...(dKgSnfIdx >= 0 ? { [dKgSnfIdx]: renderSummaryInput('loss_gain_snf', calcLossGainSnf, 3, '', { color: lossGainSnf >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800 }, 'row-loss-gain', 'kg_snf') } : {}),
                      },
                      { background: '#fef2f2', fontWeight: 800 }
                    )}

                    {/* Row 5: Loss / Gain % */}
                    {renderSummaryRowPair(
                      'row-loss-gain-pct',
                      <span style={{ color: '#dc2626' }}>%</span>,
                      null,
                      {},
                      <span style={{ fontWeight: 800, color: '#b91c1c' }}>Loss / Gain %</span>,
                      {
                        ...(dKgFatIdx >= 0 ? { [dKgFatIdx]: renderSummaryInput('loss_gain_pct_fat', calcLossGainPctFat, 2, '%', { color: Math.abs(lossGainPctFat) > cmpddNorm ? '#dc2626' : '#16a34a', fontWeight: 800 }, 'row-loss-gain-pct', 'kg_fat') } : {}),
                        ...(dKgSnfIdx >= 0 ? { [dKgSnfIdx]: renderSummaryInput('loss_gain_pct_snf', calcLossGainPctSnf, 2, '%', { color: Math.abs(lossGainPctSnf) > cmpddNorm ? '#dc2626' : '#16a34a', fontWeight: 800 }, 'row-loss-gain-pct', 'kg_snf') } : {}),
                      },
                      { background: '#fef2f2', fontWeight: 800 }
                    )}

                    {/* Row 6: CMPDD Norms % */}
                    {renderSummaryRowPair(
                      'row-cmpdd',
                      <span style={{ color: '#475569' }}>🎯</span>,
                      null,
                      {},
                      <span style={{ fontWeight: 800, color: '#334155' }}>CMPDD Norms %</span>,
                      {
                        ...(dKgFatIdx >= 0 ? {
                          [dKgFatIdx]: (
                            <input
                              type="number"
                              step="0.1"
                              value={blockState.cmpdd_norm || '0.5'}
                              onFocus={() => setSelectedCell({ blockKey, rowIndex: 'row-cmpdd', colKey: 'kg_fat', fieldKey: 'cmpdd_norm' })}
                              onClick={() => setSelectedCell({ blockKey, rowIndex: 'row-cmpdd', colKey: 'kg_fat', fieldKey: 'cmpdd_norm' })}
                              onChange={e => handleCmpddNormChange(blockKey, e.target.value)}
                              style={{
                                width: 55,
                                padding: '2px 4px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                borderRadius: 4,
                                border: selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === 'cmpdd_norm' ? '2px solid #b45309' : '1px solid #cbd5e1',
                                background: selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === 'cmpdd_norm' ? '#fef3c7' : '#ffffff',
                                boxShadow: selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === 'cmpdd_norm' ? '0 0 0 2px rgba(180, 83, 9, 0.35)' : 'none',
                                outline: 'none'
                              }}
                            />
                          )
                        } : {}),
                        ...(dKgSnfIdx >= 0 ? {
                          [dKgSnfIdx]: (
                            <input
                              type="number"
                              step="0.1"
                              value={blockState.cmpdd_norm || '0.5'}
                              onFocus={() => setSelectedCell({ blockKey, rowIndex: 'row-cmpdd', colKey: 'kg_snf', fieldKey: 'cmpdd_norm' })}
                              onClick={() => setSelectedCell({ blockKey, rowIndex: 'row-cmpdd', colKey: 'kg_snf', fieldKey: 'cmpdd_norm' })}
                              onChange={e => handleCmpddNormChange(blockKey, e.target.value)}
                              style={{
                                width: 55,
                                padding: '2px 4px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                borderRadius: 4,
                                border: selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === 'cmpdd_norm' ? '2px solid #b45309' : '1px solid #cbd5e1',
                                background: selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === 'cmpdd_norm' ? '#fef3c7' : '#ffffff',
                                boxShadow: selectedCell?.blockKey === blockKey && selectedCell?.fieldKey === 'cmpdd_norm' ? '0 0 0 2px rgba(180, 83, 9, 0.35)' : 'none',
                                outline: 'none'
                              }}
                            />
                          )
                        } : {}),
                      },
                      { background: '#f8fafc', fontWeight: 800, borderBottom: '2px solid #cbd5e1' },
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 800, background: isWithinNorm ? '#f0fdf4' : '#fef2f2', color: isWithinNorm ? '#15803d' : '#b91c1c', border: isWithinNorm ? '1px solid #86efac' : '1px solid #fca5a5' }}>
                        {isWithinNorm ? '🟢 Within CMPDD Norm' : '🔴 Exceeds CMPDD Norm'}
                      </span>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const handleStepClick = (key: string) => {
    if (onDateShiftChange) {
      onDateShiftChange(entryDate, shift);
    }
    if (onStepChange) {
      onStepChange(key);
      return;
    }
    const s = shift ?? 'F';
    if (key === 'prep') {
      router.push(`/dashboard/stock/preparation-charts?date=${entryDate}&shift=${s}`);
    } else if (key === 'stock') {
      router.push(`/dashboard/stock/new?date=${entryDate}&shift=${s}`);
    } else if (key === 'stg') {
      router.push(`/dashboard/ts/new-stg?date=${entryDate}&shift=${s}`);
    } else if (key === 'ts') {
      router.push(`/dashboard/ts/new?date=${entryDate}&shift=${s}`);
    } else if (key === 'reports') {
      router.push(`/dashboard/ts/${entryDate}?shift=${s}`);
    }
  };

  return (
    <>
      <Header
        title="Solid Balance Details (STG)"
        subtitle={`Default Formulation Matrix (${reportMode === 'full_day' ? 'Full Day' : (shift === 'D' ? 'Day Shift' : 'Night Shift')})`}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/ts/manage-statements/defaults" className="btn btn-secondary btn-sm" style={{ color: '#b45309', borderColor: '#fde68a', background: '#fffbeb', fontWeight: 700 }} title="Master Default Formulation Tables">
              ⭐ Master Default Tables
            </Link>
            <Link href="/dashboard/ts/manage-statements" className="btn btn-secondary btn-sm" style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }} title="Manage Statement Master Names">
              📊 Statement Master Names
            </Link>
            <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">← Back to Register</Link>
          </div>
        }
      >
        <Step
          items={DAILY_ENTRY_STEP_ITEMS}
          flat={true}
          activeStep={activeStep || 'stg'}
          onStepClick={handleStepClick}
          style={{ marginBottom: 0, marginTop: 4 }}
        />
      </Header>

      <div className="form-container">
        <datalist id="variant-products-list">
          {productOptions.map(p => (
            <option key={p} value={p} />
          ))}
        </datalist>

        {/* Date & Details */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>Register Date & Details</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={saving}
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving
                  ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Saving...</>
                  : '💾 Save & Compile STG Statement'
                }
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                type="date"
                className="form-input"
                value={entryDate}
                onChange={e => {
                  const newDate = e.target.value;
                  setEntryDate(newDate);
                  if (onDateShiftChange) onDateShiftChange(newDate, shift);
                }}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            {reportMode === 'shift' && (
              <>
                <div className="form-group">
                  <label className="form-label">Reporting Type *</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      type="button"
                      className={`btn ${shift === 'F' || !shift ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setShift('F');
                        if (onDateShiftChange) onDateShiftChange(entryDate, 'F');
                      }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>🗓️ Full Day (F)</span>
                    </button>
                    <button
                      type="button"
                      className={`btn ${shift === 'D' || shift === 'N' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setShift('D');
                        if (onDateShiftChange) onDateShiftChange(entryDate, 'D');
                      }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>⏱️ Shift-wise</span>
                    </button>
                  </div>
                </div>
                {shift && (
                  <div className="form-group animate-fade-in">
                    <label className="form-label">Shift *</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {(['D', 'N'] as Shift[]).map(s => {
                        const cfg = shiftConfigs.find(c => c.key === s) || {
                          label: s === 'D' ? 'Day Shift' : 'Night Shift',
                        };
                        return (
                          <button
                            key={s}
                            id={`shift-${s}`}
                            type="button"
                            className={`btn ${shift === s ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => {
                              setShift(s);
                              if (onDateShiftChange) onDateShiftChange(entryDate, s);
                            }}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
                          >
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {s === 'D' ? '☀️' : '🌙'} {cfg.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                type="text"
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter remarks or details..."
              />
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {/* Excluded Statements Display */}
        {statements.some(s => !enabledBlockKeys.includes(s.key)) && (
          <div className="card-glass" style={{ padding: '16px 20px', marginTop: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', border: '1px dashed var(--border)', borderRadius: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>💡 Excluded statements for this shift:</span>
            {statements.filter(s => !enabledBlockKeys.includes(s.key)).map(s => (
              <button
                key={s.key}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEnabledBlockKeys(prev => [...prev, s.key])}
                style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ➕ Add {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Statements Rendered in MasterDetailLayout */}
        <div style={{ marginTop: 20 }}>
          {statements.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', background: '#fff8f6', border: '1px solid #ffedd5' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#9a3412', marginBottom: 8 }}>
                No Statement Master Names Stored in Database
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
                No statement master names have been configured in database table (<code>prep_chart_configs</code>).
              </div>
              <Link href="/dashboard/ts/manage-statements" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                📊 Go to Statement Master Names
              </Link>
            </div>
          ) : statements.filter(s => enabledBlockKeys.includes(s.key)).length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              ⚠️ All statements have been excluded for this shift. Please click "➕ Add" above to include a statement block.
            </div>
          ) : (
            <MasterDetailLayout<{ key: string; label: string; variant?: string }>
              items={statements.filter(s => enabledBlockKeys.includes(s.key))}
              getItemKey={s => s.key}
              selectedKey={activeBlock || (statements.filter(s => enabledBlockKeys.includes(s.key))[0]?.key || null)}
              onSelectKey={key => setActiveBlock(key)}
              leftPanelTitle="📋 Statement Master Names"
              leftPanelWidth={330}
              searchPlaceholder="🔍 Search statement name..."
              filterPredicate={(s, q) =>
                s.label.toLowerCase().includes(q) ||
                s.key.toLowerCase().includes(q)
              }
              emptyListMessage="No statements matching search"
              emptyDetailMessage="Select a Statement Master Name from the left panel to display formulation matrix details"
              headerExtra={
                <Link
                  href="/dashboard/ts/manage-statements"
                  style={{ fontSize: '0.72rem', color: 'var(--brand-primary)', fontWeight: 700, textDecoration: 'none' }}
                  title="Manage or add dynamic Statement Master Names"
                >
                  ⚙️ Manage
                </Link>
              }
              renderListItem={(s, isSelected) => {
                const cleanTitle = cleanStatementLabel(s.label).replace(/\s*-\s*RECEIPT AND DISPOSAL STATEMENT$/i, '');
                const bRows = blocks[s.key]?.rows || [];
                const hasData = bRows.some(r => r.variant || Object.keys(r.values || {}).some(k => k !== 'variant' && r.values[k]));

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📋 {cleanTitle}</span>
                        {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />}
                      </div>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 10,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: isSelected ? '#b45309' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : '#475569',
                        }}
                      >
                        {s.key}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span>Formulation Matrix</span>
                      {hasData ? (
                        <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.68rem', background: '#dcfce7', padding: '1px 6px', borderRadius: 8 }}>
                          ✓ Data Present
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                          Empty
                        </span>
                      )}
                    </div>
                  </div>
                );
              }}
              renderDetail={selectedStatement => renderStatementBlock(selectedStatement)}
            />
          )}

          {stepMode && (
            <div
              className="no-print"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: 'var(--surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                marginTop: 20,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (onDateShiftChange) onDateShiftChange(entryDate, shift);
                  if (onPrevStep) {
                    onPrevStep(entryDate, shift);
                  } else {
                    router.push(`/dashboard/stock/new?date=${entryDate}&shift=${shift || 'F'}`);
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                ← Back to Stock Entry
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (onDateShiftChange) onDateShiftChange(entryDate, shift);
                  if (onNextStep) onNextStep(entryDate, shift);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  borderColor: '#0ea5e9',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)',
                }}
              >
                Next: Review TS Statement ➔
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
