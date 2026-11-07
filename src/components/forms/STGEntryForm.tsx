// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – NKL Solid Balance Details (STG) Entry Form
// Features separate master for each individual statement with inline statement creation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Step, { DAILY_ENTRY_STEP_ITEMS } from '@/components/ui/Step';
import { useRouter, useSearchParams } from 'next/navigation';
import { fmtNum, cleanStatementLabel, getStandardColumnDecimals } from '@/lib/calculations';
import { useConfirm } from '@/context/ConfirmContext';
import type { Shift } from '@/lib/types';

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

export interface STGReconData {
  columns: STGColumnDef[];
  rows: STGReconRow[];
}

export const getDefaultReconColumns = (): STGColumnDef[] => [
  { key: 'lts', name: 'Qty (Lts)', type: 'number', decimals: 0, sort_order: 1 },
  { key: 'sp_gr', name: 'SP.G', type: 'number', decimals: 4, sort_order: 2 },
  { key: 'kg', name: 'Qty (Kg)', type: 'calculated', decimals: 2, sort_order: 3 },
  { key: 'fat_pct', name: 'Fat%', type: 'number', decimals: 2, sort_order: 4 },
  { key: 'snf_pct', name: 'Snf%', type: 'number', decimals: 2, sort_order: 5 },
  { key: 'kg_fat', name: 'Kg.Fat', type: 'calculated', decimals: 3, sort_order: 6 },
  { key: 'kg_snf', name: 'Kg.Snf', type: 'calculated', decimals: 3, sort_order: 7 },
  { key: 'note', name: 'Reconciled Note', type: 'text', sort_order: 8 },
];

export const getDefaultReconRows = (): STGReconRow[] => [
  {
    id: 'recon_row_1',
    label: 'Total Receipts (+)',
    row_type: 'TOTAL_RECEIPT',
    is_formula: true,
    color_hint: 'green',
    values: {
      lts: '=RECEIPTS.lts',
      sp_gr: '—',
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
      lts: '=OB.lts',
      sp_gr: '=OB.sp_gr',
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
      lts: '=R1+R2',
      sp_gr: '—',
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
      lts: '=DISPOSALS.lts',
      sp_gr: '—',
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
      lts: '=CB.lts',
      sp_gr: '=CB.sp_gr',
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
      lts: '=R4+R5',
      sp_gr: '—',
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
      lts: '=R3-R6',
      sp_gr: '—',
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
      lts: '=(R7/R3)*100',
      sp_gr: '—',
      kg: '=(R7/R3)*100',
      fat_pct: '—',
      snf_pct: '—',
      kg_fat: '=(R7/R3)*100',
      kg_snf: '=(R7/R3)*100',
      note: 'Percentage loss/gain',
    },
  },
];

// Excel formula evaluator for Reconciliation Summary
export const evaluateReconCellFormula = (
  formulaStr: any,
  colKey: string,
  rIdx: number,
  currentRows: STGReconRow[],
  contextTotals: any,
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

  // Cross-references
  expr = expr.replace(/\bRECEIPTS?\.([a-z_0-9]+)\b/gi, (_, key) => {
    const k = key.toLowerCase();
    if (k === 'lts' || k === 'qty_lts') return String(contextTotals.rec?.lts || 0);
    if (k === 'kg' || k === 'qty_kg') return String(contextTotals.rec?.kg || 0);
    if (k === 'fat' || k === 'kg_fat') return String(contextTotals.rec?.fat || 0);
    if (k === 'snf' || k === 'kg_snf') return String(contextTotals.rec?.snf || 0);
    return '0';
  });

  expr = expr.replace(/\bDISPOSALS?\.([a-z_0-9]+)\b/gi, (_, key) => {
    const k = key.toLowerCase();
    if (k === 'lts' || k === 'qty_lts') return String(contextTotals.disp?.lts || 0);
    if (k === 'kg' || k === 'qty_kg') return String(contextTotals.disp?.kg || 0);
    if (k === 'fat' || k === 'kg_fat') return String(contextTotals.disp?.fat || 0);
    if (k === 'snf' || k === 'kg_snf') return String(contextTotals.disp?.snf || 0);
    return '0';
  });

  expr = expr.replace(/\bOB\.([a-z_0-9]+)\b/gi, (_, key) => {
    const k = key.toLowerCase();
    if (k === 'lts' || k === 'qty_lts') return String(contextTotals.ob?.lts || 0);
    if (k === 'kg' || k === 'qty_kg') return String(contextTotals.ob?.kg || 0);
    if (k === 'fat' || k === 'kg_fat') return String(contextTotals.ob?.fat || 0);
    if (k === 'snf' || k === 'kg_snf') return String(contextTotals.ob?.snf || 0);
    if (k === 'fat_pct') return String(contextTotals.ob?.fat_pct || 0);
    if (k === 'snf_pct') return String(contextTotals.ob?.snf_pct || 0);
    if (k === 'sp_gr') return String(contextTotals.ob?.sp_gr || 0);
    return '0';
  });

  expr = expr.replace(/\bCB\.([a-z_0-9]+)\b/gi, (_, key) => {
    const k = key.toLowerCase();
    if (k === 'lts' || k === 'qty_lts') return String(contextTotals.cb?.lts || 0);
    if (k === 'kg' || k === 'qty_kg') return String(contextTotals.cb?.kg || 0);
    if (k === 'fat' || k === 'kg_fat') return String(contextTotals.cb?.fat || 0);
    if (k === 'snf' || k === 'kg_snf') return String(contextTotals.cb?.snf || 0);
    if (k === 'fat_pct') return String(contextTotals.cb?.fat_pct || 0);
    if (k === 'snf_pct') return String(contextTotals.cb?.snf_pct || 0);
    if (k === 'sp_gr') return String(contextTotals.cb?.sp_gr || 0);
    return '0';
  });

  // Row references: R1 or R1.kg
  expr = expr.replace(/\bR([0-9]+)(?:\.([a-z_0-9]+))?\b/gi, (_, rowNum, targetColKey) => {
    const targetRIdx = parseInt(rowNum, 10) - 1;
    const targetRow = currentRows[targetRIdx];
    if (!targetRow) return '0';
    const cKey = (targetColKey || colKey).toLowerCase();
    const rawVal = targetRow.values?.[cKey];
    if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === '—' || rawVal === '-') return '0';
    if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
      const evalSub = evaluateReconCellFormula(rawVal, cKey, targetRIdx, currentRows, contextTotals, depth + 1);
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

export interface STGRowData {
  variant: string;
  row_type?: 'OB' | 'RECEIPT' | 'DISPOSAL';
  side?: 'RECEIPT' | 'DISPOSAL';
  values: Record<string, any>;
}

export interface STGOpeningBalance {
  qty_lts?: string;
  qty_kg?: string;
  fat_pct?: string;
  snf_pct?: string;
  sp_gr?: string;
  kg_fat?: string;
  kg_snf?: string;
}

export interface STGPhysicalCount {
  qty_lts?: string;
  qty_kg?: string;
  fat_pct?: string;
  snf_pct?: string;
  sp_gr?: string;
  kg_fat?: string;
  kg_snf?: string;
}

export interface STGBlockState {
  rows: STGRowData[];
  cmpdd_norm?: string;
  summary_overrides?: Record<string, string>;
  opening_balance?: STGOpeningBalance;
  physical_count?: STGPhysicalCount;
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
  const { confirm, showSuccess, showWarning, showError } = useConfirm();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const [entryDate, setEntryDate] = useState(initialDate || paramDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift | null>(
    initialShift !== undefined ? initialShift : ((paramShift === 'D' || paramShift === 'N') ? paramShift : null)
  );

  useEffect(() => {
    if (initialDate && initialDate !== entryDate) setEntryDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (initialShift !== undefined && initialShift !== shift) setShift(initialShift);
  }, [initialShift]);

  const [notes, setNotes] = useState('');
  const [reportMode, setReportMode] = useState<'full_day' | 'shift'>('full_day');

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('aavin_report_mode');
      if (savedMode === 'shift' || savedMode === 'full_day') {
        setReportMode(savedMode);
      }
    } catch {}
  }, []);

  const handleStepClick = (key: string) => {
    if (onDateShiftChange) {
      onDateShiftChange(entryDate, shift);
    }
    if (onStepChange) {
      onStepChange(key);
      return;
    }
    const s = shift || 'F';
    if (key === 'prep') {
      if (onPrevStep) {
        (onPrevStep as any)(entryDate, s);
      } else {
        router.push(`/dashboard/stock/new?step=prep&date=${entryDate}&shift=${s}`);
      }
    } else if (key === 'stock') {
      router.push(`/dashboard/stock/new?step=stock&date=${entryDate}&shift=${s}`);
    } else if (key === 'stg') {
      router.push(`/dashboard/stock/new?step=stg&date=${entryDate}&shift=${s}`);
    } else if (key === 'ts') {
      if (onNextStep) {
        (onNextStep as any)(entryDate, s);
      } else {
        router.push(`/dashboard/stock/new?step=ts&date=${entryDate}&shift=${s}`);
      }
    } else if (key === 'reports') {
      router.push(`/dashboard/ts/${entryDate}?shift=${s}`);
    }
  };

  const handleSyncFromStock = async () => {
    try {
      const s = shift || 'F';
      const res = await fetch(`/api/stock?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
      if (!res.ok) {
        await showWarning(`No saved Stock Statement found for date ${entryDate}. Please save the Stock Statement first.`, 'No Stock Data');
        return;
      }
      const json = await res.json();
      const stockRows: any[] = json.data?.stock_rows || [];
      if (!stockRows || stockRows.length === 0) {
        await showWarning(`No stock rows found for ${entryDate}.`, 'Empty Stock Data');
        return;
      }

      const targetColKeys = [activeBlock.toLowerCase()];
      if (activeBlock.toUpperCase() === 'WM') targetColKeys.push('wh_milk', 'whole_milk', 'wm');
      if (activeBlock.toUpperCase() === 'SSM') targetColKeys.push('skim_milk', 'ssm');
      if (activeBlock.toUpperCase() === 'CREAM') targetColKeys.push('cream');
      if (activeBlock.toUpperCase() === 'SMP') targetColKeys.push('smp');

      let syncedCount = 0;
      setBlocks(prev => {
        const copy = { ...prev };
        const currentBlockState = copy[activeBlock] || { rows: [], opening_balance: {}, physical_count: {} };
        const nextRows = [...(currentBlockState.rows || [])];

        const obRow = stockRows.find(r => r.row_type === 'OB');
        if (obRow) {
          for (const key of targetColKeys) {
            const val = obRow.values?.[key] ?? obRow[key];
            if (val !== undefined && val !== null && !isNaN(parseFloat(val))) {
              const numVal = parseFloat(val);
              if (numVal > 0) {
                currentBlockState.opening_balance = {
                  ...(currentBlockState.opening_balance || {}),
                  qty_lts: String(numVal),
                };
                syncedCount++;
                break;
              }
            }
          }
        }

        nextRows.forEach(r => {
          const rLabelNorm = (r.variant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchingStockRow = stockRows.find(sr => {
            if (r.row_type && sr.row_type && r.row_type !== sr.row_type) return false;
            const srLabelNorm = (sr.row_label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return srLabelNorm === rLabelNorm || srLabelNorm.includes(rLabelNorm) || rLabelNorm.includes(srLabelNorm);
          });

          if (matchingStockRow) {
            for (const key of targetColKeys) {
              const val = matchingStockRow.values?.[key] ?? matchingStockRow[key];
              if (val !== undefined && val !== null && !isNaN(parseFloat(val))) {
                const numVal = parseFloat(val);
                if (numVal > 0) {
                  r.values = { ...(r.values || {}), qty_lts: numVal };
                  syncedCount++;
                  break;
                }
              }
            }
          }
        });

        currentBlockState.rows = nextRows;
        copy[activeBlock] = currentBlockState;
        return copy;
      });

      setReceiptsUnlocked(true);
      setDisposalsUnlocked(true);
      if (syncedCount > 0) {
        await showSuccess(`Synced ${syncedCount} quantity value(s) from Stock Statement into ${currentStatement?.label || activeBlock}! Receipts & Disposals unlocked for editing.`, 'Stock Statement Synced');
      } else {
        await showWarning(`Found Stock Statement for ${entryDate}, but no matching rows found for ${currentStatement?.label || activeBlock}. You can enter values manually.`, 'Sync Notice');
      }
    } catch (err) {
      console.error(err);
      await showError('Failed to sync from Stock Statement.', 'Sync Error');
    }
  };
  const [masters, setMasters] = useState<any[]>([]);
  const [statements, setStatements] = useState<Array<{ key: string; label: string; variant?: string }>>([]);
  const [enabledBlockKeys, setEnabledBlockKeys] = useState<string[]>([]);
  const [activeBlock, setActiveBlock] = useState<string>('');
  const [blocks, setBlocks] = useState<Record<string, STGBlockState>>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Lock / Edit states
  const [obUnlocked, setObUnlocked] = useState(false);
  const [receiptsUnlocked, setReceiptsUnlocked] = useState(false);
  const [disposalsUnlocked, setDisposalsUnlocked] = useState(false);

  // View decimals
  const [viewDecimals, setViewDecimals] = useState<number | 'auto'>('auto');

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Modal: Create New Statement Master
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStmtName, setNewStmtName] = useState('');
  const [newStmtKey, setNewStmtKey] = useState('');
  const [newStmtKeyEdited, setNewStmtKeyEdited] = useState(false);
  const [newStmtVariant, setNewStmtVariant] = useState('');
  const [newStmtSource, setNewStmtSource] = useState('blank');
  const [newStmtReceiptParticulars, setNewStmtReceiptParticulars] = useState('');
  const [newStmtDisposalParticulars, setNewStmtDisposalParticulars] = useState('');

  // Modal: Rename Active Statement Master
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameVariant, setRenameVariant] = useState('');

  // ⚖️ Stock Balance & Reconciliation Summary State (stored per statement_key)
  const [reconciliations, setReconciliations] = useState<Record<string, STGReconData>>({});
  const [editingReconCell, setEditingReconCell] = useState<{ rIdx: number; colKey: string } | null>(null);

  // Modal: Add Custom Recon Row
  const [isAddReconRowModalOpen, setIsAddReconRowModalOpen] = useState(false);
  const [newReconRowLabel, setNewReconRowLabel] = useState('');
  const [newReconRowType, setNewReconRowType] = useState('CUSTOM');
  const [newReconRowColor, setNewReconRowColor] = useState<STGReconRow['color_hint']>('default');

  // Modal: Add Custom Recon Column
  const [isAddReconColModalOpen, setIsAddReconColModalOpen] = useState(false);
  const [newReconColName, setNewReconColName] = useState('');
  const [newReconColKey, setNewReconColKey] = useState('');
  const [newReconColType, setNewReconColType] = useState<'number' | 'text' | 'calculated'>('number');
  const [newReconColDecimals, setNewReconColDecimals] = useState<number>(2);
  const [newReconColUnit, setNewReconColUnit] = useState('');

  // Modal: Manage Recon Columns
  const [isManageReconColsModalOpen, setIsManageReconColsModalOpen] = useState(false);

  const availableStatements = useMemo(() => {
    return statements.filter(s => enabledBlockKeys.includes(s.key));
  }, [statements, enabledBlockKeys]);

  const currentStatement = useMemo(() => {
    return availableStatements.find(s => s.key === activeBlock) || availableStatements[0] || null;
  }, [availableStatements, activeBlock]);

  useEffect(() => {
    if (availableStatements.length > 0 && (!activeBlock || !availableStatements.some(s => s.key === activeBlock))) {
      setActiveBlock(availableStatements[0].key);
    }
  }, [availableStatements, activeBlock]);

  const activeBlockState = useMemo(() => {
    if (!activeBlock || !blocks[activeBlock]) {
      return { rows: [], opening_balance: {}, physical_count: {}, cmpdd_norm: '0.5' };
    }
    return blocks[activeBlock];
  }, [activeBlock, blocks]);

  // Active Reconciliation Summary for currently selected statement
  const activeRecon = useMemo<STGReconData>(() => {
    if (activeBlock && reconciliations[activeBlock]) {
      return reconciliations[activeBlock];
    }
    const stmtMaster = masters.find(m => m.key === activeBlock);
    const masterRows = (stmtMaster?.reconciliation_rows && Array.isArray(stmtMaster.reconciliation_rows) && stmtMaster.reconciliation_rows.length > 0)
      ? stmtMaster.reconciliation_rows
      : getDefaultReconRows();
    return {
      columns: getDefaultReconColumns(),
      rows: masterRows,
    };
  }, [activeBlock, reconciliations, masters]);

  const updateActiveRecon = useCallback((updater: (prev: STGReconData) => STGReconData) => {
    if (!activeBlock) return;
    setReconciliations(prev => {
      const stmtMaster = masters.find(m => m.key === activeBlock);
      const defaultRows = (stmtMaster?.reconciliation_rows && Array.isArray(stmtMaster.reconciliation_rows) && stmtMaster.reconciliation_rows.length > 0)
        ? stmtMaster.reconciliation_rows
        : getDefaultReconRows();
      const current = prev[activeBlock] || {
        columns: getDefaultReconColumns(),
        rows: defaultRows,
      };
      return {
        ...prev,
        [activeBlock]: updater(current),
      };
    });
  }, [activeBlock, masters]);

  // Reconciliation Handlers
  const handleAddReconRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReconRowLabel.trim()) return;
    const newRow: STGReconRow = {
      id: `recon_row_${Date.now()}`,
      label: newReconRowLabel.trim(),
      row_type: newReconRowType || 'CUSTOM',
      color_hint: newReconRowColor || 'default',
      values: {},
      is_formula: false,
    };
    updateActiveRecon(prev => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }));
    setIsAddReconRowModalOpen(false);
    setNewReconRowLabel('');
    setNewReconRowType('CUSTOM');
    setNewReconRowColor('default');
  };

  const handleDeleteReconRow = async (rIdx: number) => {
    const row = activeRecon.rows[rIdx];
    const confirmed = await confirm({
      title: 'Delete Reconciliation Row',
      message: `Are you sure you want to delete row "${row.label}" from this reconciliation summary?`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;
    updateActiveRecon(prev => ({
      ...prev,
      rows: prev.rows.filter((_, idx) => idx !== rIdx),
    }));
  };

  const handleMoveReconRow = (rIdx: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? rIdx - 1 : rIdx + 1;
    if (targetIdx < 0 || targetIdx >= activeRecon.rows.length) return;
    updateActiveRecon(prev => {
      const nextRows = [...prev.rows];
      const temp = nextRows[rIdx];
      nextRows[rIdx] = nextRows[targetIdx];
      nextRows[targetIdx] = temp;
      return { ...prev, rows: nextRows };
    });
  };

  const handleReconCellChange = (rIdx: number, colKey: string, val: any) => {
    updateActiveRecon(prev => {
      const nextRows = [...prev.rows];
      const targetRow = { ...nextRows[rIdx], values: { ...(nextRows[rIdx]?.values || {}) } };
      targetRow.values[colKey] = val;
      nextRows[rIdx] = targetRow;

      // Keep physical count in sync if user edits Closing Balance row directly
      if (targetRow.row_type === 'CB' && ['lts', 'qty_lts', 'fat_pct', 'snf_pct', 'sp_gr'].includes(colKey)) {
        const numVal = parseFloat(val);
        if (!isNaN(numVal) && !String(val).startsWith('=')) {
          const fieldMap: Record<string, keyof STGPhysicalCount> = {
            lts: 'qty_lts',
            qty_lts: 'qty_lts',
            fat_pct: 'fat_pct',
            snf_pct: 'snf_pct',
            sp_gr: 'sp_gr',
          };
          const mappedField = fieldMap[colKey];
          if (mappedField) {
            handlePhysicalCountChange(mappedField, String(val));
          }
        }
      }

      return { ...prev, rows: nextRows };
    });
  };

  const handleReconLabelChange = (rIdx: number, label: string) => {
    updateActiveRecon(prev => {
      const nextRows = [...prev.rows];
      nextRows[rIdx] = { ...nextRows[rIdx], label };
      return { ...prev, rows: nextRows };
    });
  };

  const handleResetReconTemplate = async () => {
    const confirmed = await confirm({
      title: 'Reset to Standard Reconciliation Template',
      message: 'This will reset the Stock Balance & Reconciliation Summary rows and formulas to the master default template. Continue?',
      confirmText: 'Reset Template',
      type: 'warning',
    });
    if (!confirmed) return;
    const stmtMaster = masters.find(m => m.key === activeBlock);
    const defaultRows = (stmtMaster?.reconciliation_rows && Array.isArray(stmtMaster.reconciliation_rows) && stmtMaster.reconciliation_rows.length > 0)
      ? stmtMaster.reconciliation_rows
      : getDefaultReconRows();
    updateActiveRecon(() => ({
      columns: getDefaultReconColumns(),
      rows: defaultRows,
    }));
    await showSuccess('Reconciliation Template loaded successfully!', 'Template Loaded');
  };

  const handleAddReconColumnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReconColName.trim()) return;
    const key = newReconColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      newReconColName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (activeRecon.columns.some(c => c.key === key)) {
      showWarning(`Column with key "${key}" already exists!`);
      return;
    }
    const newCol: STGColumnDef = {
      key,
      name: newReconColName.trim(),
      type: newReconColType,
      decimals: newReconColDecimals,
      unit: newReconColUnit.trim() || undefined,
      sort_order: activeRecon.columns.length + 1,
      is_active: true,
    };
    updateActiveRecon(prev => ({
      ...prev,
      columns: [...prev.columns, newCol],
    }));
    setIsAddReconColModalOpen(false);
    setNewReconColName('');
    setNewReconColKey('');
    setNewReconColUnit('');
    setNewReconColDecimals(2);
  };

  const handleDeleteReconColumn = async (colKey: string) => {
    const col = activeRecon.columns.find(c => c.key === colKey);
    const confirmed = await confirm({
      title: 'Delete Reconciliation Column',
      message: `Are you sure you want to delete column "${col?.name || colKey}"? All cell values for this column will be removed.`,
      confirmText: 'Delete Column',
      type: 'danger',
    });
    if (!confirmed) return;
    updateActiveRecon(prev => ({
      ...prev,
      columns: prev.columns.filter(c => c.key !== colKey),
      rows: prev.rows.map(r => {
        const copyVals = { ...(r.values || {}) };
        delete copyVals[colKey];
        return { ...r, values: copyVals };
      }),
    }));
  };

  // 📋 Reusable Select Statement Widget matching PreparationChartsDashboardPage
  const renderStatementSelectWidget = (idPrefix: string = 'stg') => (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: '#f0f9ff',
        padding: '3px 10px',
        borderRadius: 8,
        border: '1px solid #bae6fd',
      }}
    >
      <label
        htmlFor={`${idPrefix}-statement-select`}
        style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          color: '#0369a1',
          whiteSpace: 'nowrap',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          cursor: 'pointer',
        }}
      >
        <span>📋</span> Select Statement:
      </label>
      <select
        id={`${idPrefix}-statement-select`}
        className="form-select"
        value={activeBlock || ''}
        onChange={e => setActiveBlock(e.target.value)}
        disabled={availableStatements.length === 0}
        style={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color: '#0369a1',
          background: '#ffffff',
          border: '1px solid #7dd3fc',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          minWidth: 220,
        }}
      >
        {availableStatements.map(s => (
          <option key={s.key} value={s.key}>
            {cleanStatementLabel(s.label || s.key)} {s.variant ? `(${s.variant})` : ''}
          </option>
        ))}
      </select>
      {availableStatements.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            title="Previous Statement"
            onClick={() => {
              const idx = availableStatements.findIndex(s => s.key === activeBlock);
              if (idx > 0) setActiveBlock(availableStatements[idx - 1].key);
            }}
            disabled={availableStatements.findIndex(s => s.key === activeBlock) === 0}
            style={{
              padding: '2px 8px',
              border: '1px solid #bae6fd',
              borderRadius: 4,
              background: '#ffffff',
              cursor: availableStatements.findIndex(s => s.key === activeBlock) === 0 ? 'not-allowed' : 'pointer',
              color: '#0284c7',
              fontWeight: 800,
              fontSize: '0.8rem',
            }}
          >
            ◀
          </button>
          <button
            type="button"
            title="Next Statement"
            onClick={() => {
              const idx = availableStatements.findIndex(s => s.key === activeBlock);
              if (idx >= 0 && idx < availableStatements.length - 1) setActiveBlock(availableStatements[idx + 1].key);
            }}
            disabled={availableStatements.findIndex(s => s.key === activeBlock) === availableStatements.length - 1}
            style={{
              padding: '2px 8px',
              border: '1px solid #bae6fd',
              borderRadius: 4,
              background: '#ffffff',
              cursor: availableStatements.findIndex(s => s.key === activeBlock) === availableStatements.length - 1 ? 'not-allowed' : 'pointer',
              color: '#0284c7',
              fontWeight: 800,
              fontSize: '0.8rem',
            }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );

  const receiptRows = useMemo(() => {
    return (activeBlockState.rows || []).filter(r => r.row_type === 'RECEIPT' || r.side === 'RECEIPT');
  }, [activeBlockState.rows]);

  const disposalRows = useMemo(() => {
    return (activeBlockState.rows || []).filter(r => r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL');
  }, [activeBlockState.rows]);

  const formatDisplayNum = (val: any, decimals?: number, colKey?: string): string => {
    if (val === '' || val === undefined || val === null) return '-';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) return typeof val === 'string' ? val : '-';
    let dec = getStandardColumnDecimals(colKey || '', decimals);
    if (viewDecimals !== 'auto') {
      dec = viewDecimals;
    }
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  // Safe formula computation
  const computeCalculatedField = (colKey: string, vals: Record<string, any>) => {
    const qtyLit = parseFloat(vals.qty_lts) || 0;
    const spGr = parseFloat(vals.sp_gr) || 0;
    const qtyKg = vals.qty_kg !== undefined && vals.qty_kg !== '' ? parseFloat(vals.qty_kg) : (spGr > 0 ? qtyLit * spGr : qtyLit);
    const fatPct = parseFloat(vals.fat_pct) || 0;
    const snfPct = parseFloat(vals.snf_pct) || 0;

    if (colKey === 'qty_kg') return qtyKg;
    if (colKey === 'kg_fat') return (qtyKg * fatPct) / 100;
    if (colKey === 'kg_snf') return (qtyKg * snfPct) / 100;
    return 0;
  };

  // Populate block defaults from statement master
  const populateBlockDefaultsFromMaster = useCallback((stmtMaster: any): STGBlockState => {
    const rows: STGRowData[] = [];
    if (Array.isArray(stmtMaster.receipt_rows) && stmtMaster.receipt_rows.length > 0) {
      stmtMaster.receipt_rows.forEach((r: any) => {
        const name = r.variant || r.short_name || r.full_name || 'Particular';
        rows.push({ variant: name, row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: name, ...(r.values || {}) } });
      });
    }
    if (Array.isArray(stmtMaster.disposal_rows) && stmtMaster.disposal_rows.length > 0) {
      stmtMaster.disposal_rows.forEach((d: any) => {
        const name = d.variant || d.short_name || d.full_name || 'Particular';
        rows.push({ variant: name, row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: name, ...(d.values || {}) } });
      });
    }

    if (rows.length === 0 && Array.isArray(stmtMaster.default_rows) && stmtMaster.default_rows.length > 0) {
      stmtMaster.default_rows.forEach((r: any) => {
        const name = r.variant || r.short_name || r.full_name || 'Particular';
        rows.push({
          variant: name,
          row_type: r.row_type || r.side || 'RECEIPT',
          side: r.side || r.row_type || 'RECEIPT',
          values: { variant: name, ...(r.values || {}) }
        });
      });
    }

    if (rows.length === 0) {
      rows.push(
        { variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'Receipt 1' } },
        { variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'Disposal 1' } }
      );
    }

    return {
      rows,
      opening_balance: { qty_lts: '', sp_gr: '', qty_kg: '', fat_pct: '', snf_pct: '', kg_fat: '', kg_snf: '' },
      physical_count: { qty_lts: '', sp_gr: '', qty_kg: '', fat_pct: '', snf_pct: '', kg_fat: '', kg_snf: '' },
      cmpdd_norm: '0.5'
    };
  }, []);

  // Fetch statement masters and data
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
            setMasters(configJson.masters);
            globalStatements = configJson.masters.map((s: any) => ({
              ...s,
              label: cleanStatementLabel(s.label || s.name || s.key),
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
              newBlocks[s.key] = matchedMaster ? populateBlockDefaultsFromMaster(matchedMaster) : { rows: [] };
            });

            // Restore from custom_blocks state if present
            Object.entries(customBlocksState).forEach(([key, state]) => {
              if (newBlocks[key] && state.rows && Array.isArray(state.rows)) {
                newBlocks[key] = state;
              }
            });

            // Map stg_rows from DB
            if (data.data.stg_rows && Array.isArray(data.data.stg_rows) && data.data.stg_rows.length > 0) {
              data.data.stg_rows.forEach((row: any) => {
                const b = row.product_block;
                if (!newBlocks[b]) newBlocks[b] = { rows: [], opening_balance: {}, physical_count: {} };

                if (row.item_name === 'OB') {
                  newBlocks[b].opening_balance = {
                    qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                    qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                    fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                    snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                    sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                    kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                    kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                  };
                } else if (row.item_name === 'CB') {
                  newBlocks[b].physical_count = {
                    qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                    qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                    fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                    snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                    sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                    kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                    kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                  };
                } else {
                  const existingRow = newBlocks[b].rows.find(r => r.variant === row.item_name && (r.side === row.side || r.row_type === row.side));
                  if (existingRow) {
                    existingRow.values = {
                      ...existingRow.values,
                      qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                      qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                      fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                      snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                      sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                      kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                      kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                    };
                  } else {
                    newBlocks[b].rows.push({
                      variant: row.item_name,
                      row_type: row.side,
                      side: row.side,
                      values: {
                        variant: row.item_name,
                        qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                        qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                        fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                        snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                        sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                        kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                        kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                      }
                    });
                  }
                }
              });
            }

            setBlocks(newBlocks);

            // Load Reconciliation Summaries from dedicated table stg_reconciliation_entries
            try {
              const reconRes = await fetch(`/api/ts/reconciliation?date=${entryDate}&shift=${shift || 'F'}`);
              if (reconRes.ok) {
                const reconJson = await reconRes.json();
                if (reconJson.data && typeof reconJson.data === 'object' && Object.keys(reconJson.data).length > 0) {
                  setReconciliations(reconJson.data);
                }
              }
            } catch (rErr) {
              console.warn('Could not load reconciliation data:', rErr);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load STG data:', e);
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift, populateBlockDefaultsFromMaster]);

  // Handle Create Statement Master from Modal
  const handleCreateStatementMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStmtName.trim()) {
      showWarning('Please enter a Statement Master Name');
      return;
    }

    const cleanLabel = cleanStatementLabel(newStmtName.trim());
    const keyToUse = newStmtKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!keyToUse) {
      showWarning('Please enter a valid Field Key');
      return;
    }

    if (statements.some(s => s.key === keyToUse)) {
      showWarning(`Statement Master with key "${keyToUse}" already exists! Please use a unique Statement Name or key.`);
      return;
    }

    let initialReceipts: any[] = [];
    let initialDisposals: any[] = [];

    if (newStmtSource === 'blank') {
      const customRecs = newStmtReceiptParticulars.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const customDisps = newStmtDisposalParticulars.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

      initialReceipts = customRecs.length > 0
        ? customRecs.map(name => ({ variant: name, row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: name } }))
        : [{ variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: { variant: 'Receipt 1' } }];

      initialDisposals = customDisps.length > 0
        ? customDisps.map(name => ({ variant: name, row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: name } }))
        : [{ variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: { variant: 'Disposal 1' } }];
    } else {
      const srcMaster = masters.find(m => m.key === newStmtSource);
      if (srcMaster) {
        initialReceipts = JSON.parse(JSON.stringify(srcMaster.receipt_rows || []));
        initialDisposals = JSON.parse(JSON.stringify(srcMaster.disposal_rows || []));
      }
    }

    const allRows = [
      ...initialReceipts.map(r => ({ ...r, row_type: 'RECEIPT', side: 'RECEIPT' })),
      ...initialDisposals.map(d => ({ ...d, row_type: 'DISPOSAL', side: 'DISPOSAL' })),
    ];

    const newMasterObj = {
      key: keyToUse,
      label: cleanLabel,
      name: cleanLabel,
      variant: newStmtVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
      product_variant: newStmtVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
      sort_order: (masters.length || 0) + 1,
      receipt_rows: initialReceipts,
      disposal_rows: initialDisposals,
      default_rows: allRows,
      rows: allRows,
      is_active: true,
    };

    try {
      const updatedMasters = [...masters, newMasterObj];
      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: updatedMasters }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setStatements(prev => [...prev, { key: keyToUse, label: cleanLabel, variant: newMasterObj.variant }]);
        setEnabledBlockKeys(prev => Array.from(new Set([...prev, keyToUse])));
        setBlocks(prev => ({
          ...prev,
          [keyToUse]: {
            rows: allRows,
            opening_balance: { qty_lts: '', sp_gr: '', qty_kg: '', fat_pct: '', snf_pct: '', kg_fat: '', kg_snf: '' },
            physical_count: { qty_lts: '', sp_gr: '', qty_kg: '', fat_pct: '', snf_pct: '', kg_fat: '', kg_snf: '' },
            cmpdd_norm: '0.5'
          }
        }));
        setActiveBlock(keyToUse);
        setIsCreateModalOpen(false);
        setNewStmtName('');
        setNewStmtKey('');
        setNewStmtKeyEdited(false);
        setNewStmtVariant('');
        setNewStmtReceiptParticulars('');
        setNewStmtDisposalParticulars('');
        showSuccess(`✅ Statement Master "${cleanLabel}" created successfully and activated!`);
      } else {
        showError('Failed to save statement master to database.');
      }
    } catch (err) {
      showError('Network error creating statement master.');
    }
  };

  // Handle Rename Statement Master
  const handleRenameStatementMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim() || !activeBlock) return;
    const cleanLabel = cleanStatementLabel(renameValue.trim());

    try {
      const updatedMasters = masters.map(m => {
        if (m.key === activeBlock) {
          return {
            ...m,
            label: cleanLabel,
            name: cleanLabel,
            variant: renameVariant.trim().toUpperCase() || m.variant,
            product_variant: renameVariant.trim().toUpperCase() || m.product_variant,
          };
        }
        return m;
      });

      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: updatedMasters }),
      });

      if (res.ok) {
        setMasters(updatedMasters);
        setStatements(prev => prev.map(s => s.key === activeBlock ? { ...s, label: cleanLabel, variant: renameVariant } : s));
        setIsRenameModalOpen(false);
        showSuccess(`Updated Statement Master to "${cleanLabel}"`);
      } else {
        showError('Failed to update Statement Master.');
      }
    } catch (err) {
      showError('Network error updating Statement Master.');
    }
  };

  // Handle Delete Active Statement
  const handleDeleteActiveStatement = async () => {
    if (!activeBlock) return;
    const stmt = statements.find(s => s.key === activeBlock);
    const isConfirmed = await confirm({
      title: 'Delete Statement Master',
      message: `Are you sure you want to delete "${stmt?.label || activeBlock}"? This will remove its master template definition and rows from this entry.`,
      confirmText: 'Delete Statement Master',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;

    try {
      await fetch(`/api/ts/masters?key=${encodeURIComponent(activeBlock)}`, { method: 'DELETE' });
      const remainingStmts = statements.filter(s => s.key !== activeBlock);
      const remainingMasters = masters.filter(m => m.key !== activeBlock);
      setMasters(remainingMasters);
      setStatements(remainingStmts);
      setEnabledBlockKeys(prev => prev.filter(k => k !== activeBlock));
      setBlocks(prev => {
        const copy = { ...prev };
        delete copy[activeBlock];
        return copy;
      });
      if (remainingStmts.length > 0) {
        setActiveBlock(remainingStmts[0].key);
      }
      showSuccess('Statement Master removed successfully.');
    } catch (err) {
      showError('Error deleting Statement Master.');
    }
  };

  // Particulars cell change handlers
  const handleParticularCellChange = (globalIdx: number, colKey: string, val: string) => {
    if (!activeBlock) return;
    setBlocks(prev => {
      const copy = { ...prev };
      const block = { ...copy[activeBlock] };
      const rows = [...block.rows];
      const r = { ...rows[globalIdx], values: { ...rows[globalIdx].values } };
      if (colKey === 'variant') {
        r.variant = val;
      }
      r.values[colKey] = val;

      if (['qty_lts', 'sp_gr', 'fat_pct', 'snf_pct'].includes(colKey)) {
        const qtyKg = computeCalculatedField('qty_kg', r.values);
        r.values.qty_kg = qtyKg !== 0 ? String(qtyKg) : '';
        const kgFat = computeCalculatedField('kg_fat', r.values);
        r.values.kg_fat = kgFat !== 0 ? String(kgFat) : '';
        const kgSnf = computeCalculatedField('kg_snf', r.values);
        r.values.kg_snf = kgSnf !== 0 ? String(kgSnf) : '';
      }

      rows[globalIdx] = r;
      block.rows = rows;
      copy[activeBlock] = block;
      return copy;
    });
  };

  const handleOpeningBalanceChange = (field: keyof STGOpeningBalance, val: string) => {
    if (!activeBlock) return;
    setBlocks(prev => {
      const copy = { ...prev };
      const block = { ...copy[activeBlock] };
      const ob = { ...(block.opening_balance || {}), [field]: val };

      if (['qty_lts', 'sp_gr', 'fat_pct', 'snf_pct'].includes(field)) {
        const qtyLit = parseFloat(ob.qty_lts || '0') || 0;
        const spGr = parseFloat(ob.sp_gr || '0') || 0;
        const qtyKg = spGr > 0 ? qtyLit * spGr : qtyLit;
        ob.qty_kg = qtyKg !== 0 ? String(qtyKg) : '';
        const fatPct = parseFloat(ob.fat_pct || '0') || 0;
        const snfPct = parseFloat(ob.snf_pct || '0') || 0;
        ob.kg_fat = (qtyKg * fatPct) / 100 !== 0 ? String((qtyKg * fatPct) / 100) : '';
        ob.kg_snf = (qtyKg * snfPct) / 100 !== 0 ? String((qtyKg * snfPct) / 100) : '';
      }

      block.opening_balance = ob;
      copy[activeBlock] = block;
      return copy;
    });
  };

  const handlePhysicalCountChange = (field: keyof STGPhysicalCount, val: string) => {
    if (!activeBlock) return;
    setBlocks(prev => {
      const copy = { ...prev };
      const block = { ...copy[activeBlock] };
      const cb = { ...(block.physical_count || {}), [field]: val };

      if (['qty_lts', 'sp_gr', 'fat_pct', 'snf_pct'].includes(field)) {
        const qtyLit = parseFloat(cb.qty_lts || '0') || 0;
        const spGr = parseFloat(cb.sp_gr || '0') || 0;
        const qtyKg = spGr > 0 ? qtyLit * spGr : qtyLit;
        cb.qty_kg = qtyKg !== 0 ? String(qtyKg) : '';
        const fatPct = parseFloat(cb.fat_pct || '0') || 0;
        const snfPct = parseFloat(cb.snf_pct || '0') || 0;
        cb.kg_fat = (qtyKg * fatPct) / 100 !== 0 ? String((qtyKg * fatPct) / 100) : '';
        cb.kg_snf = (qtyKg * snfPct) / 100 !== 0 ? String((qtyKg * snfPct) / 100) : '';
      }

      block.physical_count = cb;
      copy[activeBlock] = block;
      return copy;
    });
  };

  const handleAddRow = (side: 'RECEIPT' | 'DISPOSAL') => {
    if (!activeBlock) return;
    setBlocks(prev => {
      const copy = { ...prev };
      const block = { ...copy[activeBlock] };
      block.rows = [
        ...block.rows,
        {
          variant: side === 'RECEIPT' ? 'New Receipt' : 'New Disposal',
          row_type: side,
          side: side,
          values: { variant: side === 'RECEIPT' ? 'New Receipt' : 'New Disposal' }
        }
      ];
      copy[activeBlock] = block;
      return copy;
    });
  };

  const handleDeleteRow = (globalIdx: number) => {
    if (!activeBlock) return;
    setBlocks(prev => {
      const copy = { ...prev };
      const block = { ...copy[activeBlock] };
      block.rows = block.rows.filter((_, idx) => idx !== globalIdx);
      copy[activeBlock] = block;
      return copy;
    });
  };

  // Reconciled Totals & Balances
  const totals = useMemo(() => {
    const ob = activeBlockState.opening_balance || {};
    const cb = activeBlockState.physical_count || {};

    const obLts = parseFloat(ob.qty_lts || '0') || 0;
    const obKg = parseFloat(ob.qty_kg || '0') || 0;
    const obFat = parseFloat(ob.kg_fat || '0') || 0;
    const obSnf = parseFloat(ob.kg_snf || '0') || 0;

    const cbLts = parseFloat(cb.qty_lts || '0') || 0;
    const cbKg = parseFloat(cb.qty_kg || '0') || 0;
    const cbFat = parseFloat(cb.kg_fat || '0') || 0;
    const cbSnf = parseFloat(cb.kg_snf || '0') || 0;

    const recLts = receiptRows.reduce((a, r) => a + (parseFloat(r.values.qty_lts) || 0), 0);
    const recKg = receiptRows.reduce((a, r) => a + (parseFloat(r.values.qty_kg) || 0), 0);
    const recFat = receiptRows.reduce((a, r) => a + (parseFloat(r.values.kg_fat) || 0), 0);
    const recSnf = receiptRows.reduce((a, r) => a + (parseFloat(r.values.kg_snf) || 0), 0);

    const dispLts = disposalRows.reduce((a, r) => a + (parseFloat(r.values.qty_lts) || 0), 0);
    const dispKg = disposalRows.reduce((a, r) => a + (parseFloat(r.values.qty_kg) || 0), 0);
    const dispFat = disposalRows.reduce((a, r) => a + (parseFloat(r.values.kg_fat) || 0), 0);
    const dispSnf = disposalRows.reduce((a, r) => a + (parseFloat(r.values.kg_snf) || 0), 0);

    const grandRecLts = obLts + recLts;
    const grandRecKg = obKg + recKg;
    const grandRecFat = obFat + recFat;
    const grandRecSnf = obSnf + recSnf;

    const grandDispLts = dispLts + cbLts;
    const grandDispKg = dispKg + cbKg;
    const grandDispFat = dispFat + cbFat;
    const grandDispSnf = dispSnf + cbSnf;

    const lossGainLts = cbLts - (grandRecLts - dispLts);
    const lossGainKg = cbKg - (grandRecKg - dispKg);
    const lossGainFat = cbFat - (grandRecFat - dispFat);
    const lossGainSnf = cbSnf - (grandRecSnf - dispSnf);

    const lossGainFatPct = grandRecFat !== 0 ? (lossGainFat / grandRecFat) * 100 : 0;
    const lossGainSnfPct = grandRecSnf !== 0 ? (lossGainSnf / grandRecSnf) * 100 : 0;

    const norm = parseFloat(activeBlockState.cmpdd_norm || '0.5') || 0.5;

    return {
      ob: { lts: obLts, kg: obKg, fat: obFat, snf: obSnf },
      cb: { lts: cbLts, kg: cbKg, fat: cbFat, snf: cbSnf },
      rec: { lts: recLts, kg: recKg, fat: recFat, snf: recSnf },
      disp: { lts: dispLts, kg: dispKg, fat: dispFat, snf: dispSnf },
      grandRec: { lts: grandRecLts, kg: grandRecKg, fat: grandRecFat, snf: grandRecSnf },
      grandDisp: { lts: grandDispLts, kg: grandDispKg, fat: grandDispFat, snf: grandDispSnf },
      lossGain: { lts: lossGainLts, kg: lossGainKg, fat: lossGainFat, snf: lossGainSnf },
      lossGainPct: { fat: lossGainFatPct, snf: lossGainSnfPct },
      norm,
    };
  }, [activeBlockState, receiptRows, disposalRows]);

  // Save handler
  const handleSave = async () => {
    if (!entryDate) {
      showError('Please select an entry date.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: entryDate,
          shift,
          report_type: 'TS',
          notes: `${notes}\n__METADATA__:${JSON.stringify({ custom_statements: statements, custom_blocks: blocks, enabled_blocks: enabledBlockKeys, reconciliation: reconciliations })}`,
        }),
      });

      const entryData = await entryRes.json();
      let entry_id = entryData.data?.id;

      if (!entry_id && entryRes.status === 409) {
        const getRes = await fetch(`/api/entries?report_type=TS&date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
        const getData = await getRes.json();
        entry_id = getData.data?.[0]?.id;
      }

      if (!entry_id) throw new Error('Could not retrieve entry ID');

      const stg_rows: any[] = [];
      Object.entries(blocks).forEach(([pBlock, bState]) => {
        if (!enabledBlockKeys.includes(pBlock)) return;

        // Opening Balance
        if (bState.opening_balance) {
          stg_rows.push({
            product_block: pBlock,
            side: 'RECEIPT',
            item_name: 'OB',
            qty_lts: bState.opening_balance.qty_lts || '0',
            sp_gr: bState.opening_balance.sp_gr || '0',
            qty_kg: bState.opening_balance.qty_kg || '0',
            fat_pct: bState.opening_balance.fat_pct || '0',
            snf_pct: bState.opening_balance.snf_pct || '0',
            kg_fat: bState.opening_balance.kg_fat || '0',
            kg_snf: bState.opening_balance.kg_snf || '0',
          });
        }

        // Particular rows
        (bState.rows || []).forEach(r => {
          const varName = r.variant || r.values?.variant || '';
          if (varName || Object.keys(r.values || {}).length > 0) {
            const side = (r.side || r.row_type || 'RECEIPT') as 'RECEIPT' | 'DISPOSAL';
            stg_rows.push({
              product_block: pBlock,
              side,
              item_name: varName,
              qty_lts: r.values?.qty_lts || '0',
              sp_gr: r.values?.sp_gr || '0',
              qty_kg: r.values?.qty_kg || '0',
              fat_pct: r.values?.fat_pct || '0',
              snf_pct: r.values?.snf_pct || '0',
              kg_fat: r.values?.kg_fat || '0',
              kg_snf: r.values?.kg_snf || '0',
            });
          }
        });

        // Physical count (CB)
        if (bState.physical_count) {
          stg_rows.push({
            product_block: pBlock,
            side: 'DISPOSAL',
            item_name: 'CB',
            qty_lts: bState.physical_count.qty_lts || '0',
            sp_gr: bState.physical_count.sp_gr || '0',
            qty_kg: bState.physical_count.qty_kg || '0',
            fat_pct: bState.physical_count.fat_pct || '0',
            snf_pct: bState.physical_count.snf_pct || '0',
            kg_fat: bState.physical_count.kg_fat || '0',
            kg_snf: bState.physical_count.kg_snf || '0',
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

      // Save reconciliation data strictly to dedicated table stg_reconciliation_entries
      try {
        await fetch('/api/ts/reconciliation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_id,
            entry_date: entryDate,
            shift: shift || 'F',
            reconciliations,
          }),
        });
      } catch (rSaveErr) {
        console.warn('Reconciliation entries save notice:', rSaveErr);
      }

      showSuccess('STG Statement saved successfully!');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setError(msg);
      showError(msg);
    }
    setSaving(false);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const url = `/api/export-excel?date=${entryDate}&shift=${shift ?? 'null'}&stg=true&ts=false&stock=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `NKL_STG_Statement_${entryDate}${shift ? `_${shift}` : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showSuccess('Excel exported successfully! Plain uncolored grid matching sample sheet.');
    } catch (e) {
      showError('Failed to export Excel report.');
    }
    setExporting(false);
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        handleSave: () => handleSaveRef.current(),
        saving,
      });
    }
  }, [onRegisterActions, saving]);

  // Render a particulars table (Receipts or Disposals) matching StockEntryForm
  const renderParticularsSection = (
    side: 'RECEIPT' | 'DISPOSAL',
    title: string,
    list: STGRowData[],
    unlocked: boolean,
    setUnlocked: (val: boolean) => void,
    colorScheme: { bg: string; text: string; border: string; btn: string }
  ) => {
    return (
      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden', border: `1px solid ${colorScheme.border}` }}>
        {/* Card Header */}
        <div style={{ background: colorScheme.bg, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colorScheme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: colorScheme.text }}>
              {side === 'RECEIPT' ? '📥' : '📤'} {title}
            </span>
            <span style={{ background: '#ffffff', border: `1px solid ${colorScheme.border}`, color: colorScheme.text, borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>
              {list.length} particulars
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setUnlocked(!unlocked)}
              style={{
                background: unlocked ? '#fef3c7' : '#ffffff',
                border: `1px solid ${unlocked ? '#f59e0b' : colorScheme.border}`,
                color: unlocked ? '#b45309' : colorScheme.text,
                borderRadius: 5,
                padding: '3px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {unlocked ? `🔒 Lock ${title}` : `✏️ Edit ${title}`}
            </button>

            <button
              type="button"
              onClick={() => handleAddRow(side)}
              style={{
                background: colorScheme.btn,
                color: '#ffffff',
                border: 'none',
                borderRadius: 5,
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ Add {title} Particular
            </button>
          </div>
        </div>

        {/* Table Grid */}
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ width: '100%', minWidth: 720, margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 44, textAlign: 'center', fontSize: '0.72rem' }}>#</th>
                <th style={{ width: 220, textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>{title} Particular</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Qty (Lts)</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>SP.G</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}>Qty (Kg)</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Fat%</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Snf%</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}>Kg.Fat</th>
                <th style={{ textAlign: 'right', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}>Kg.Snf</th>
                <th style={{ width: 90, textAlign: 'center', fontSize: '0.72rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '20px 12px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}>
                    No {title.toLowerCase()} recorded. Click "+ Add {title} Particular" to add.
                  </td>
                </tr>
              ) : (
                list.map((row, lIdx) => {
                  const globalIdx = (activeBlockState.rows || []).findIndex(r => r === row);
                  const isReadOnly = !unlocked;

                  return (
                    <tr key={`row_${side}_${globalIdx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', background: '#fafafa' }}>
                        {lIdx + 1}
                      </td>

                      {/* Particular Name */}
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={row.variant || row.values?.variant || ''}
                          readOnly={isReadOnly}
                          placeholder="Particular Name..."
                          onChange={e => handleParticularCellChange(globalIdx, 'variant', e.target.value)}
                          style={{
                            height: 28,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            background: isReadOnly ? 'transparent' : '#ffffff',
                            border: isReadOnly ? 'none' : '1px solid var(--border)',
                          }}
                        />
                      </td>

                      {/* Qty (Lts) */}
                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          className="form-input"
                          value={row.values.qty_lts ?? ''}
                          readOnly={isReadOnly}
                          placeholder="0"
                          onChange={e => handleParticularCellChange(globalIdx, 'qty_lts', e.target.value)}
                          style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                        />
                      </td>

                      {/* SP.G */}
                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          step="any"
                          className="form-input"
                          value={row.values.sp_gr ?? ''}
                          readOnly={isReadOnly}
                          placeholder="0"
                          onChange={e => handleParticularCellChange(globalIdx, 'sp_gr', e.target.value)}
                          style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                        />
                      </td>

                      {/* Qty (Kg) - Computed */}
                      <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-numbers)', background: '#f0f9ff' }}>
                        {row.values.qty_kg ? formatDisplayNum(row.values.qty_kg, 2, 'qty_kg') : '-'}
                      </td>

                      {/* Fat% */}
                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          step="any"
                          className="form-input"
                          value={row.values.fat_pct ?? ''}
                          readOnly={isReadOnly}
                          placeholder="0"
                          onChange={e => handleParticularCellChange(globalIdx, 'fat_pct', e.target.value)}
                          style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                        />
                      </td>

                      {/* Snf% */}
                      <td style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          step="any"
                          className="form-input"
                          value={row.values.snf_pct ?? ''}
                          readOnly={isReadOnly}
                          placeholder="0"
                          onChange={e => handleParticularCellChange(globalIdx, 'snf_pct', e.target.value)}
                          style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                        />
                      </td>

                      {/* Kg.Fat - Computed */}
                      <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-numbers)', background: '#f0f9ff' }}>
                        {row.values.kg_fat ? formatDisplayNum(row.values.kg_fat, 3, 'kg_fat') : '-'}
                      </td>

                      {/* Kg.Snf - Computed */}
                      <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-numbers)', background: '#f0f9ff' }}>
                        {row.values.kg_snf ? formatDisplayNum(row.values.kg_snf, 3, 'kg_snf') : '-'}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', background: '#fafafa' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(globalIdx)}
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Subtotal Footer */}
            {list.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#64748b' }}>Σ</td>
                  <td style={{ fontWeight: 800, color: colorScheme.text, padding: '6px 8px' }}>
                    Total {title}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 4px', fontFamily: 'var(--font-numbers)', color: colorScheme.text }}>
                    {formatDisplayNum(side === 'RECEIPT' ? totals.rec.lts : totals.disp.lts, 0)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 4px' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 8px', fontFamily: 'var(--font-numbers)', color: colorScheme.text, background: '#f1f5f9' }}>
                    {formatDisplayNum(side === 'RECEIPT' ? totals.rec.kg : totals.disp.kg, 2)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 4px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 8px', fontFamily: 'var(--font-numbers)', color: colorScheme.text, background: '#f1f5f9' }}>
                    {formatDisplayNum(side === 'RECEIPT' ? totals.rec.fat : totals.disp.fat, 3)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 8px', fontFamily: 'var(--font-numbers)', color: colorScheme.text, background: '#f1f5f9' }}>
                    {formatDisplayNum(side === 'RECEIPT' ? totals.rec.snf : totals.disp.snf, 3)}
                  </td>
                  <td style={{ background: '#f8fafc' }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  const ob = activeBlockState.opening_balance || {};
  const cb = activeBlockState.physical_count || {};

  return (
    <>
      <Header
        title="Solid Balance Details (STG) Entry"
        subtitle={`Enter daily STG solid balance data (${reportMode === 'full_day' ? 'Full Day' : (shift === 'D' ? 'Day Shift' : 'Night Shift')})`}
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
        {/* Entry Details Header Card matching StockEntryForm & user screenshot */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div className="section-title" style={{ margin: 0 }}>Entry Details</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} className="no-print">
                <Link
                  href={`/dashboard/ts/manage-statements/defaults?master=${encodeURIComponent(currentStatement?.key || activeBlock || 'wm')}`}
                  className="btn btn-secondary btn-xs"
                  style={{ borderColor: '#86efac', color: '#166534', backgroundColor: '#f0fdf4', fontSize: '0.75rem', padding: '4px 10px', fontWeight: 600 }}
                  title="Configure Master Default Statements Template for Solid Balance Details (STG) Entry"
                >
                  ⭐ Master Default Statements
                </Link>
                {renderStatementSelectWidget('top')}
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ borderColor: '#d97706', color: '#b45309', backgroundColor: '#fffbeb', fontSize: '0.75rem', padding: '4px 10px', fontWeight: 600 }}
                  onClick={() => handleStepClick('stock')}
                  title="Previous Stage: View Stock Statement Entry for selected Date & Shift"
                >
                  📦 Stock Statement Entry
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ borderColor: '#0284c7', color: '#0284c7', backgroundColor: '#f0f9ff', fontSize: '0.75rem', padding: '4px 10px', fontWeight: 600 }}
                  onClick={handleSyncFromStock}
                  title="Auto-fill receipt quantities from saved Stock Statement"
                >
                  ⚡ Sync from Stock Statement
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setIsPrintModalOpen(true)}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  🖨️ Print
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ borderColor: '#16a34a', color: '#16a34a', fontSize: '0.75rem', padding: '4px 10px', fontWeight: 600 }}
                  onClick={handleExportExcel}
                  disabled={exporting}
                >
                  📥 {exporting ? 'Exporting...' : 'Excel'}
                </button>

                {/* Decimal View Precision Selector */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '2px 4px',
                    gap: 2,
                    marginLeft: 4,
                  }}
                  title="Toggle decimal precision across all cells and totals in the statement"
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
                          padding: '2px 7px',
                          fontSize: '0.72rem',
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  color: '#b45309',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Create a Brand New Statement Master Template"
              >
                ➕ Create Statement Master
              </button>
              <Link
                href="/dashboard/ts/manage-statements"
                className="btn btn-secondary btn-xs"
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: '0.78rem',
                  padding: '4px 12px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Manage Statement Master Names (Update, Delete, Insert)"
              >
                ⚙️ Statement Master Names
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Date *</label>
              <input
                type="date"
                className="form-input"
                value={entryDate}
                onChange={e => {
                  setEntryDate(e.target.value);
                  if (onDateShiftChange) onDateShiftChange(e.target.value, shift);
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Shift</label>
              <select
                className="form-input"
                value={shift || ''}
                onChange={e => {
                  const val = e.target.value ? (e.target.value as Shift) : null;
                  setShift(val);
                  if (onDateShiftChange) onDateShiftChange(entryDate, val);
                }}
              >
                <option value="">Full Day (Default)</option>
                <option value="D">Day Shift (D)</option>
                <option value="N">Night Shift (N)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Notes (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Shift notes, remarks, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

{/* Statement Master Navigation Tabs Bar */}
        <div className="card" style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>
                📋 INDIVIDUAL STATEMENT MASTERS ({availableStatements.length}):
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                (Each statement has its own separate master, receipts, and disposals)
              </span>
              {renderStatementSelectWidget('bar')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Create a Brand New Statement Master Template"
              >
                ➕ Create Statement Master
              </button>
              <Link
                href="/dashboard/ts/manage-statements"
                className="btn btn-secondary btn-xs"
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: '0.78rem',
                  padding: '4px 12px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Manage Statement Master Names (Update, Delete, Insert)"
              >
                ⚙️ Statement Master Names
              </Link>
            </div>
          </div>

          {/* Scrolling Tabs List */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {availableStatements.map(s => {
              const isActive = s.key === activeBlock;
              const count = (blocks[s.key]?.rows || []).length;

              return (
                <button
                  key={`stmt_tab_${s.key}`}
                  type="button"
                  onClick={() => setActiveBlock(s.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: isActive ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: isActive ? '#0284c7' : '#ffffff',
                    color: isActive ? '#ffffff' : '#334155',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
                  }}
                >
                  <span>{cleanStatementLabel(s.label || s.key)}</span>
                  <span
                    style={{
                      background: isActive ? '#ffffff' : '#f1f5f9',
                      color: isActive ? '#0284c7' : '#64748b',
                      borderRadius: 10,
                      padding: '1px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Statement Header & Actions Banner */}
        {currentStatement && (
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a' }}>
                  {cleanStatementLabel(currentStatement.label || currentStatement.key)}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                  Master Key: <b>{currentStatement.key}</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Link
                href={`/dashboard/ts/manage-statements/defaults?master=${encodeURIComponent(currentStatement.key)}`}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', fontWeight: 700 }}
                title="Configure Master Default Formulation Table for this statement"
              >
                ⚙️ Master Defaults
              </Link>

              <button
                type="button"
                onClick={() => {
                  setRenameValue(currentStatement.label || currentStatement.key);
                  setRenameVariant(currentStatement.variant || '');
                  setIsRenameModalOpen(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', fontWeight: 700 }}
              >
                ✏️ Rename Master
              </button>

              {availableStatements.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteActiveStatement}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Delete this Statement Master"
                >
                  🗑️ Delete Master
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 16px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Section 1: Opening Balance Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
          <div style={{ background: '#eff6ff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #bfdbfe' }}>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1d4ed8' }}>
              📦 Opening Balance (OB)
            </span>

            <button
              type="button"
              onClick={() => setObUnlocked(!obUnlocked)}
              style={{
                background: obUnlocked ? '#fef3c7' : '#ffffff',
                border: `1px solid ${obUnlocked ? '#f59e0b' : '#93c5fd'}`,
                color: obUnlocked ? '#b45309' : '#1d4ed8',
                borderRadius: 5,
                padding: '3px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {obUnlocked ? '🔒 Lock OB' : '✏️ Edit OB'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ width: '100%', minWidth: 720, margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 44, textAlign: 'center', fontSize: '0.72rem' }}>#</th>
                  <th style={{ width: 220, textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>Label</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Qty (Lts)</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>SP.G</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}>Qty (Kg)</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Fat%</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Snf%</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}>Kg.Fat</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}>Kg.Snf</th>
                  <th style={{ width: 90, textAlign: 'center', fontSize: '0.72rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#1d4ed8', fontSize: '0.75rem', background: '#eff6ff' }}>OB</td>
                  <td style={{ fontWeight: 800, color: '#1d4ed8', fontSize: '0.82rem', padding: '6px 8px' }}>Opening Balance</td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={ob.qty_lts ?? ''}
                      readOnly={!obUnlocked}
                      placeholder="0"
                      onChange={e => handleOpeningBalanceChange('qty_lts', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={ob.sp_gr ?? ''}
                      readOnly={!obUnlocked}
                      placeholder="0"
                      onChange={e => handleOpeningBalanceChange('sp_gr', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-numbers)', background: '#f0f9ff' }}>
                    {ob.qty_kg ? formatDisplayNum(ob.qty_kg, 2) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={ob.fat_pct ?? ''}
                      readOnly={!obUnlocked}
                      placeholder="0"
                      onChange={e => handleOpeningBalanceChange('fat_pct', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={ob.snf_pct ?? ''}
                      readOnly={!obUnlocked}
                      placeholder="0"
                      onChange={e => handleOpeningBalanceChange('snf_pct', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-numbers)', background: '#f0f9ff' }}>
                    {ob.kg_fat ? formatDisplayNum(ob.kg_fat, 3) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#0369a1', fontFamily: 'var(--font-numbers)', background: '#f0f9ff' }}>
                    {ob.kg_snf ? formatDisplayNum(ob.kg_snf, 3) : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', color: obUnlocked ? '#b45309' : '#1d4ed8', fontWeight: 700 }}>
                    {obUnlocked ? 'Unlocked' : 'Locked'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Receipts Particulars */}
        {renderParticularsSection(
          'RECEIPT',
          'Receipts',
          receiptRows,
          receiptsUnlocked,
          setReceiptsUnlocked,
          { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', btn: '#16a34a' }
        )}

        {/* Section 3: Disposals Particulars */}
        {renderParticularsSection(
          'DISPOSAL',
          'Disposals',
          disposalRows,
          disposalsUnlocked,
          setDisposalsUnlocked,
          { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', btn: '#ea580c' }
        )}

        {/* Section 4: Stock Balance Reconciliation Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚖️</span> Stock Balance & Reconciliation Summary (Matching Sample Sheet & Milk & Cream Stock Statement)
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                Dynamic Rows & Columns with Formula Support · Stored in table <code>stg_reconciliation_entries</code> as JSON
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsAddReconRowModalOpen(true)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 5,
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Add a custom row to this statement reconciliation summary"
              >
                ➕ Add Row
              </button>

              <button
                type="button"
                onClick={() => setIsAddReconColModalOpen(true)}
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  borderRadius: 5,
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Add a new column to this statement reconciliation summary"
              >
                ➕ Add Column
              </button>

              <button
                type="button"
                onClick={() => setIsManageReconColsModalOpen(true)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  borderRadius: 5,
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Manage reconciliation columns (Rename, Decimals, Delete)"
              >
                ⚙️ Columns ({activeRecon.columns.length})
              </button>

              <button
                type="button"
                onClick={handleResetReconTemplate}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  color: '#b45309',
                  borderRadius: 5,
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Reset to standard 8-row reconciliation template with sample formulas"
              >
                ↺ Load Standard Template
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ width: '100%', minWidth: 800, margin: 0 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 44, textAlign: 'center', fontSize: '0.72rem' }}>#</th>
                  <th style={{ width: 240, textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>Reconciliation Item</th>
                  {activeRecon.columns.map(col => (
                    <th
                      key={`recon_th_${col.key}`}
                      style={{
                        textAlign: col.type === 'text' ? 'left' : 'right',
                        fontSize: '0.75rem',
                        padding: '6px 8px',
                        background: col.type === 'calculated' ? '#f0f9ff' : undefined,
                        color: col.type === 'calculated' ? '#0369a1' : undefined,
                      }}
                      title={`Field Key: ${col.key} | Type: ${col.type}${col.decimals !== undefined ? ` | Dec: ${col.decimals}` : ''}`}
                    >
                      {col.name} {col.unit ? `(${col.unit})` : ''}
                    </th>
                  ))}
                  <th style={{ width: 90, textAlign: 'center', fontSize: '0.72rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRecon.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeRecon.columns.length + 2}
                      style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}
                    >
                      No reconciliation rows configured. Click "+ Add Row" or "Load Standard Template" to begin.
                    </td>
                  </tr>
                ) : (
                  activeRecon.rows.map((row, rIdx) => {
                    const rowColor = row.color_hint || 'default';
                    let bg = '#ffffff';
                    let textColor = 'var(--text-primary)';
                    let borderCol = '#f1f5f9';
                    let fontWeight = 600;

                    if (rowColor === 'green') {
                      bg = '#f0fdf4';
                      textColor = '#166534';
                      borderCol = '#bbf7d0';
                      fontWeight = 800;
                    } else if (rowColor === 'blue') {
                      bg = '#eff6ff';
                      textColor = '#1d4ed8';
                      borderCol = '#bfdbfe';
                      fontWeight = 800;
                    } else if (rowColor === 'orange') {
                      bg = '#fff7ed';
                      textColor = '#c2410c';
                      borderCol = '#fed7aa';
                      fontWeight = 800;
                    } else if (rowColor === 'yellow') {
                      bg = '#fefce8';
                      textColor = '#854d0e';
                      borderCol = '#fef08a';
                      fontWeight = 800;
                    } else if (rowColor === 'purple') {
                      bg = '#faf5ff';
                      textColor = '#6b21a8';
                      borderCol = '#e9d5ff';
                      fontWeight = 800;
                    } else if (rowColor === 'dark') {
                      bg = '#f8fafc';
                      textColor = '#0f172a';
                      borderCol = '#cbd5e1';
                      fontWeight = 900;
                    }

                    return (
                      <tr
                        key={`recon_row_${row.id || rIdx}`}
                        style={{ borderBottom: `1px solid ${borderCol}`, background: bg }}
                      >
                        {/* Row Index */}
                        <td style={{ textAlign: 'center', fontWeight: 700, color: textColor, fontSize: '0.75rem' }}>
                          {rIdx + 1}
                        </td>

                        {/* Editable Row Label */}
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={row.label}
                            onChange={e => handleReconLabelChange(rIdx, e.target.value)}
                            placeholder="Reconciliation label..."
                            style={{
                              height: 28,
                              fontSize: '0.82rem',
                              fontWeight,
                              color: textColor,
                              background: 'transparent',
                              border: '1px solid transparent',
                              padding: '2px 6px',
                            }}
                            onFocus={e => (e.target.style.borderColor = '#0284c7')}
                            onBlur={e => (e.target.style.borderColor = 'transparent')}
                          />
                        </td>

                        {/* Columns */}
                        {activeRecon.columns.map(col => {
                          const rawVal = row.values?.[col.key];
                          const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                          const isEditing = editingReconCell?.rIdx === rIdx && editingReconCell?.colKey === col.key;
                          const computedVal = isFormula
                            ? evaluateReconCellFormula(rawVal, col.key, rIdx, activeRecon.rows, totals)
                            : (col.type === 'calculated'
                              ? computeCalculatedField(col.key, row.values || {})
                              : rawVal);

                          let displayStr = '—';
                          if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                            if (col.type === 'text') {
                              displayStr = String(rawVal);
                            } else if (typeof computedVal === 'number') {
                              displayStr = formatDisplayNum(computedVal, col.decimals, col.key);
                              if (row.row_type === 'LOSS_GAIN_PCT' || row.label.includes('%')) {
                                displayStr += '%';
                              }
                            } else {
                              displayStr = String(computedVal || '—');
                            }
                          } else if (col.type === 'text') {
                            displayStr = '';
                          }

                          return (
                            <td
                              key={`cell_${rIdx}_${col.key}`}
                              style={{
                                padding: '2px 4px',
                                textAlign: col.type === 'text' ? 'left' : 'right',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                              onClick={() => {
                                if (!isEditing) setEditingReconCell({ rIdx, colKey: col.key });
                              }}
                              title={isFormula ? `Formula: ${rawVal} (Click to edit)` : 'Click to edit cell'}
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  type="text"
                                  className="form-input"
                                  value={rawVal ?? ''}
                                  placeholder={col.type === 'text' ? 'Text or =formula' : '0 or =formula'}
                                  onChange={e => handleReconCellChange(rIdx, col.key, e.target.value)}
                                  onBlur={() => setEditingReconCell(null)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setEditingReconCell(null);
                                    }
                                  }}
                                  style={{
                                    height: 28,
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textAlign: col.type === 'text' ? 'left' : 'right',
                                    fontFamily: col.type === 'text' ? 'inherit' : 'var(--font-numbers)',
                                    background: '#ffffff',
                                    borderColor: '#0284c7',
                                    boxShadow: '0 0 0 2px rgba(2, 132, 199, 0.2)',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    fontWeight,
                                    color: textColor,
                                    fontFamily: col.type === 'text' ? 'inherit' : 'var(--font-numbers)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: col.type === 'text' ? 'flex-start' : 'flex-end',
                                    gap: 4,
                                    minHeight: 26,
                                  }}
                                >
                                  {isFormula && (
                                    <span
                                      style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        color: '#0284c7',
                                        background: '#e0f2fe',
                                        padding: '1px 3px',
                                        borderRadius: 3,
                                        fontFamily: 'monospace',
                                      }}
                                      title={`Formula: ${rawVal}`}
                                    >
                                      fx
                                    </span>
                                  )}
                                  <span>{displayStr}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Actions */}
                        <td style={{ textAlign: 'center', padding: '2px 4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            <button
                              type="button"
                              onClick={() => handleMoveReconRow(rIdx, 'up')}
                              disabled={rIdx === 0}
                              style={{
                                padding: '2px 5px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                borderRadius: 3,
                                fontSize: '0.7rem',
                                cursor: rIdx === 0 ? 'not-allowed' : 'pointer',
                                opacity: rIdx === 0 ? 0.3 : 1,
                              }}
                              title="Move Row Up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveReconRow(rIdx, 'down')}
                              disabled={rIdx === activeRecon.rows.length - 1}
                              style={{
                                padding: '2px 5px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                borderRadius: 3,
                                fontSize: '0.7rem',
                                cursor: rIdx === activeRecon.rows.length - 1 ? 'not-allowed' : 'pointer',
                                opacity: rIdx === activeRecon.rows.length - 1 ? 0.3 : 1,
                              }}
                              title="Move Row Down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReconRow(rIdx)}
                              style={{
                                padding: '2px 5px',
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#dc2626',
                                borderRadius: 3,
                                fontSize: '0.7rem',
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
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation & Action Buttons matching StockEntryForm */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 40, flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleStepClick('stock')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ⬅️ Previous Stage: Stock Statement Entry
          </button>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#16a34a', borderColor: '#16a34a' }}
            >
              {saving ? '💾 Saving...' : '💾 Save Solid Balance (STG) Details'}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await handleSave();
                handleStepClick('ts');
              }}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)', borderColor: '#0284c7' }}
            >
              Next: Proceed to TS Statement ➔
            </button>
          </div>
        </div>
      </div>

{/* Modal: Create New Statement Master */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0284c7' }}>
                ➕ Create New Statement Master
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStatementMaster} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Statement Master Name *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newStmtName}
                  placeholder="e.g. BUTTER MILK - RECEIPT AND DISPOSAL STATEMENT"
                  onChange={e => {
                    setNewStmtName(e.target.value);
                    if (!newStmtKeyEdited) {
                      const clean = cleanStatementLabel(e.target.value);
                      setNewStmtKey(clean.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
                    }
                  }}
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                    Field Key (Unique Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={newStmtKey}
                    placeholder="e.g. butter_milk"
                    onChange={e => {
                      setNewStmtKeyEdited(true);
                      setNewStmtKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }}
                    style={{ width: '100%', height: 32, fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                    Product Variant
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newStmtVariant}
                    placeholder="e.g. BUTTER MILK"
                    onChange={e => setNewStmtVariant(e.target.value)}
                    style={{ width: '100%', height: 32 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Master Template Source
                </label>
                <select
                  className="form-input"
                  value={newStmtSource}
                  onChange={e => setNewStmtSource(e.target.value)}
                  style={{ width: '100%', height: 32 }}
                >
                  <option value="blank">Blank Template (Start Fresh)</option>
                  {masters.map(m => (
                    <option key={m.key} value={m.key}>
                      Clone from {m.label || m.name || m.key}
                    </option>
                  ))}
                </select>
              </div>

              {newStmtSource === 'blank' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                      Initial Receipt Particulars (optional, separated by commas or lines)
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={newStmtReceiptParticulars}
                      placeholder="e.g. Butter Milk Receipt, Water Flush"
                      onChange={e => setNewStmtReceiptParticulars(e.target.value)}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                      Initial Disposal Particulars (optional, separated by commas or lines)
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={newStmtDisposalParticulars}
                      placeholder="e.g. To Sachet Packing, To Curd"
                      onChange={e => setNewStmtDisposalParticulars(e.target.value)}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                >
                  ➕ Create Statement Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Active Statement Master */}
      {isRenameModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginBottom: 14 }}>
              ✏️ Rename Statement Master
            </div>

            <form onSubmit={handleRenameStatementMaster} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                  Statement Master Display Label *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                  Product Variant (optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={renameVariant}
                  onChange={e => setRenameVariant(e.target.value)}
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRenameModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                >
                  Update Label
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Recon Row */}
      {isAddReconRowModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0284c7' }}>
                ➕ Add Reconciliation Row
              </div>
              <button
                type="button"
                onClick={() => setIsAddReconRowModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddReconRowSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                  Row Label / Item Name *
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  className="form-input"
                  value={newReconRowLabel}
                  onChange={e => setNewReconRowLabel(e.target.value)}
                  placeholder="e.g. Sampling Loss, Return Milk, Pipe Line Stock..."
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                    Row Type
                  </label>
                  <select
                    className="form-select"
                    value={newReconRowType}
                    onChange={e => setNewReconRowType(e.target.value)}
                    style={{ width: '100%', height: 32 }}
                  >
                    <option value="CUSTOM">Custom Row</option>
                    <option value="RECEIPT_TOTAL">Receipt Total</option>
                    <option value="DISPOSAL_TOTAL">Disposal Total</option>
                    <option value="LOSS_GAIN">Loss / Gain</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                    Highlight Color
                  </label>
                  <select
                    className="form-select"
                    value={newReconRowColor}
                    onChange={e => setNewReconRowColor(e.target.value as any)}
                    style={{ width: '100%', height: 32 }}
                  >
                    <option value="default">Default (White)</option>
                    <option value="green">Green (Receipts)</option>
                    <option value="blue">Blue (OB)</option>
                    <option value="orange">Orange (Disposals)</option>
                    <option value="yellow">Yellow (CB)</option>
                    <option value="purple">Purple (Loss/Gain)</option>
                    <option value="dark">Dark (Grand Totals)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddReconRowModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                >
                  Add Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Recon Column */}
      {isAddReconColModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, padding: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#16a34a' }}>
                ➕ Add Reconciliation Column
              </div>
              <button
                type="button"
                onClick={() => setIsAddReconColModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddReconColumnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                  Column Display Name *
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  className="form-input"
                  value={newReconColName}
                  onChange={e => {
                    setNewReconColName(e.target.value);
                    setNewReconColKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
                  }}
                  placeholder="e.g. Difference (Kg), TS Solids, Remarks..."
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                    Field Key *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={newReconColKey}
                    onChange={e => setNewReconColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="e.g. diff_kg"
                    style={{ width: '100%', height: 32, fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                    Type
                  </label>
                  <select
                    className="form-select"
                    value={newReconColType}
                    onChange={e => setNewReconColType(e.target.value as any)}
                    style={{ width: '100%', height: 32 }}
                  >
                    <option value="number">Number</option>
                    <option value="calculated">Calculated</option>
                    <option value="text">Text</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                    Decimals
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    className="form-input"
                    value={newReconColDecimals}
                    onChange={e => setNewReconColDecimals(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', height: 32 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                    Unit (optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newReconColUnit}
                    onChange={e => setNewReconColUnit(e.target.value)}
                    placeholder="e.g. Kg, Lts, %"
                    style={{ width: '100%', height: 32 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddReconColModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Recon Columns */}
      {isManageReconColsModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#334155' }}>
                ⚙️ Manage Reconciliation Columns ({activeRecon.columns.length})
              </div>
              <button
                type="button"
                onClick={() => setIsManageReconColsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
              <table className="inline-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: 30 }}>#</th>
                    <th style={{ textAlign: 'left' }}>Column Name</th>
                    <th>Key</th>
                    <th>Type</th>
                    <th>Dec</th>
                    <th style={{ width: 50, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRecon.columns.map((col, idx) => (
                    <tr key={`manage_col_${col.key}`}>
                      <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={col.name}
                          onChange={e => {
                            const val = e.target.value;
                            updateActiveRecon(prev => ({
                              ...prev,
                              columns: prev.columns.map(c => c.key === col.key ? { ...c, name: val } : c),
                            }));
                          }}
                          style={{ height: 26, fontSize: '0.78rem', fontWeight: 700 }}
                        />
                      </td>
                      <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b' }}>{col.key}</td>
                      <td style={{ fontSize: '0.72rem', color: '#64748b' }}>{col.type}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="6"
                          className="form-input"
                          value={col.decimals ?? 2}
                          onChange={e => {
                            const dec = parseInt(e.target.value, 10) || 0;
                            updateActiveRecon(prev => ({
                              ...prev,
                              columns: prev.columns.map(c => c.key === col.key ? { ...c, decimals: dec } : c),
                            }));
                          }}
                          style={{ height: 26, width: 48, fontSize: '0.78rem', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteReconColumn(col.key)}
                          disabled={activeRecon.columns.length <= 1}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fca5a5',
                            color: '#dc2626',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                          }}
                          title="Delete column"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsManageReconColsModalOpen(false);
                  setIsAddReconColModalOpen(true);
                }}
                className="btn btn-secondary btn-sm"
              >
                ➕ Add New Column
              </button>
              <button
                type="button"
                onClick={() => setIsManageReconColsModalOpen(false)}
                className="btn btn-primary btn-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Plain Uncolored Print & PDF Modal */}
      {isPrintModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', width: '95%', maxWidth: 1100, maxHeight: '92vh', overflowY: 'auto', padding: 24, borderRadius: 8, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                🖨 Printable View (Exact Match with 01-05-2026-TS.xlsx Sheet STG - Pure White, No Color)
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  🖨 Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Content - Pure White, Thin Borders, Side-by-side */}
            <div id="stg-print-area" style={{ background: '#ffffff', color: '#000000', fontFamily: 'Calibri, sans-serif' }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>
                NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCER'S UNION LTD., NAMAKKAL
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>
                <span>NAMAKKAL UNION- SOLID BALANCE DETAILS</span>
                <span>DATE: {entryDate}</span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' }}>
                {cleanStatementLabel(currentStatement?.label || activeBlock)} - RECEIPT AND DISPOSAL STATEMENT
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #000' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: 4, width: 28, textAlign: 'center' }}>S.No.</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'left' }}>Receipt</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Qty (Lts)</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Qty (Kg)</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Fat%</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Snf%</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>SP.G</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Kg.Fat</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Kg.Snf</th>
                    <th style={{ border: '1px solid #000', padding: 4, width: 28, textAlign: 'center' }}>S.No.</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'left' }}>Disposal</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Qty (Lts)</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Qty (Kg)</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Fat%</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Snf%</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>SP.G</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Kg.Fat</th>
                    <th style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}>Kg.Snf</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(receiptRows.length, disposalRows.length) }).map((_, idx) => {
                    const r = receiptRows[idx];
                    const d = disposalRows[idx];

                    return (
                      <tr key={`print_row_${idx}`}>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'center' }}>{r ? idx + 1 : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3 }}>{r ? (r.variant || r.values.variant) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.qty_lts ? formatDisplayNum(r.values.qty_lts, 0) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.qty_kg ? formatDisplayNum(r.values.qty_kg, 2) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.fat_pct ? formatDisplayNum(r.values.fat_pct, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.snf_pct ? formatDisplayNum(r.values.snf_pct, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.sp_gr ? formatDisplayNum(r.values.sp_gr, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.kg_fat ? formatDisplayNum(r.values.kg_fat, 3) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.kg_snf ? formatDisplayNum(r.values.kg_snf, 3) : ''}</td>

                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'center' }}>{d ? idx + 1 : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3 }}>{d ? (d.variant || d.values.variant) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.qty_lts ? formatDisplayNum(d.values.qty_lts, 0) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.qty_kg ? formatDisplayNum(d.values.qty_kg, 2) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.fat_pct ? formatDisplayNum(d.values.fat_pct, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.snf_pct ? formatDisplayNum(d.values.snf_pct, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.sp_gr ? formatDisplayNum(d.values.sp_gr, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.kg_fat ? formatDisplayNum(d.values.kg_fat, 3) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{d?.values.kg_snf ? formatDisplayNum(d.values.kg_snf, 3) : ''}</td>
                      </tr>
                    );
                  })}

                  {/* Summary rows */}
                  <tr>
                    <td colSpan={9} style={{ border: 'none' }} />
                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>Total</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.disp.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.disp.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.disp.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.disp.snf, 3)}</td>
                  </tr>

                  <tr>
                    <td colSpan={9} style={{ border: 'none' }} />
                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>CB</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.cb.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.cb.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(cb.fat_pct, 4)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(cb.snf_pct, 4)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(cb.sp_gr, 4)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.cb.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.cb.snf, 3)}</td>
                  </tr>

                  <tr>
                    <td colSpan={9} style={{ border: 'none' }} />
                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>Grand Total</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandDisp.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandDisp.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandDisp.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandDisp.snf, 3)}</td>
                  </tr>

                  <tr>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>Total</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.rec.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.rec.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.rec.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.rec.snf, 3)}</td>

                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>Loss/Gain</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.lossGain.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.lossGain.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.lossGain.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.lossGain.snf, 3)}</td>
                  </tr>

                  <tr>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>OB</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.ob.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.ob.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(ob.fat_pct, 4)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(ob.snf_pct, 4)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(ob.sp_gr, 4)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.ob.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.ob.snf, 3)}</td>

                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>Loss/Gain %</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.lossGainPct.fat, 4)}%</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.lossGainPct.snf, 4)}%</td>
                  </tr>

                  <tr>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>Grand Total</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandRec.lts, 0)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandRec.kg, 2)}</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandRec.fat, 3)}</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{formatDisplayNum(totals.grandRec.snf, 3)}</td>

                    <td colSpan={2} style={{ border: '1px solid #000', padding: 3, fontWeight: 'bold' }}>CMPDD Norms ({totals.norm}%)</td>
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3 }} />
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{totals.norm}%</td>
                    <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right', fontWeight: 'bold' }}>{totals.norm}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
