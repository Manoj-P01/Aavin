// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – NKL Solid Balance Details (STG) Entry Form
// Sectioned view matching Milk & Cream Stock Statement Entry
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

  // Standard STG columns
  const [stgColumns, setStgColumns] = useState<STGColumnDef[]>([
    { key: 'variant', name: 'Particular / Variant', type: 'text', sort_order: 1 },
    { key: 'qty_lts', name: 'Qty (Lts)', type: 'number', decimals: 0, sort_order: 2 },
    { key: 'sp_gr', name: 'SP.G', type: 'number', decimals: 4, sort_order: 3 },
    { key: 'qty_kg', name: 'Qty (Kg)', type: 'calculated', formula: 'qty_lts * sp_gr', decimals: 2, sort_order: 4 },
    { key: 'fat_pct', name: 'Fat%', type: 'number', decimals: 2, sort_order: 5 },
    { key: 'snf_pct', name: 'Snf%', type: 'number', decimals: 2, sort_order: 6 },
    { key: 'kg_fat', name: 'Kg.Fat', type: 'calculated', formula: 'qty_kg * fat_pct / 100', decimals: 3, sort_order: 7 },
    { key: 'kg_snf', name: 'Kg.Snf', type: 'calculated', formula: 'qty_kg * snf_pct / 100', decimals: 3, sort_order: 8 },
  ]);

  const activeBlockState = useMemo(() => {
    if (!activeBlock || !blocks[activeBlock]) {
      return { rows: [], opening_balance: {}, physical_count: {}, cmpdd_norm: '0.5' };
    }
    return blocks[activeBlock];
  }, [activeBlock, blocks]);

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

  // Fetch data
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
          }
        }
      } catch (e) {
        console.error('Failed to load STG data:', e);
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift, populateBlockDefaultsFromMaster]);

  // Cell change handlers
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

      // Auto compute calculated columns
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
          notes: `${notes}\n__METADATA__:${JSON.stringify({ custom_statements: statements, custom_blocks: blocks, enabled_blocks: enabledBlockKeys })}`,
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

  // Register actions with parent if requested
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
    <div className="daily-entry-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <Header
        title="Solid Balance Details (STG) Entry"
        subtitle="Manage Receipts and Disposals statement entry with automated reconciliation matching Milk & Cream Stock Statement Entry."
      />

      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top Control Card */}
        <div className="card" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* Date, Shift, and Notes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  ENTRY DATE
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  style={{ height: 32, fontWeight: 700, fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  SHIFT
                </label>
                <select
                  className="form-input"
                  value={shift || ''}
                  onChange={e => setShift(e.target.value ? (e.target.value as Shift) : null)}
                  style={{ height: 32, fontWeight: 700, fontSize: '0.85rem' }}
                >
                  <option value="">Full Day (Default)</option>
                  <option value="D">Day Shift (D)</option>
                  <option value="N">Night Shift (N)</option>
                </select>
              </div>

              {/* Statement Master Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#b45309', marginBottom: 2 }}>
                  STATEMENT MASTER
                </label>
                <select
                  className="form-input"
                  value={activeBlock}
                  onChange={e => setActiveBlock(e.target.value)}
                  style={{
                    height: 32,
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    color: '#b45309',
                    background: '#fffbeb',
                    borderColor: '#fde68a',
                    minWidth: 260,
                  }}
                >
                  {availableStatements.map(s => (
                    <option key={s.key} value={s.key}>
                      {cleanStatementLabel(s.label || s.key)}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Decimals Switcher */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  DECIMALS VIEW
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  {(['auto', 0, 1, 2, 3] as const).map(dec => (
                    <button
                      key={`dec_btn_${dec}`}
                      type="button"
                      onClick={() => setViewDecimals(dec)}
                      style={{
                        background: viewDecimals === dec ? '#0284c7' : 'transparent',
                        color: viewDecimals === dec ? '#ffffff' : '#475569',
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {dec === 'auto' ? 'Auto' : `.${dec}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Link
                href="/dashboard/ts/manage-statements/defaults"
                className="btn btn-secondary btn-sm"
                title="Open Master Default Formulation Tables"
              >
                ⚙️ Master Defaults
              </Link>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting}
                style={{
                  background: '#ffffff',
                  border: '1px solid #16a34a',
                  color: '#16a34a',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📥 {exporting ? 'Exporting...' : 'Export Excel'}
              </button>

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🖨 Print / PDF
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                }}
              >
                {saving ? '💾 Saving...' : '💾 Save Statement'}
              </button>
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <input
              type="text"
              className="form-input"
              value={notes}
              placeholder="Notes / Remarks for this statement (optional)..."
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', height: 30, fontSize: '0.82rem' }}
            />
          </div>
        </div>

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
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: '0.92rem', color: '#1e293b' }}>
            ⚖️ Stock Balance & Reconciliation Summary (Matching Sample Sheet & Milk & Cream Stock Statement)
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ width: '100%', minWidth: 720, margin: 0 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 44, textAlign: 'center', fontSize: '0.72rem' }}>#</th>
                  <th style={{ width: 240, textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>Reconciliation Item</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Qty (Lts)</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Qty (Kg)</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Fat%</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Snf%</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>SP.G</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Kg.Fat</th>
                  <th style={{ textAlign: 'right', fontSize: '0.75rem' }}>Kg.Snf</th>
                  <th style={{ width: 140, textAlign: 'center', fontSize: '0.72rem' }}>Reconciled Note</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Total Receipts */}
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#166534', fontSize: '0.75rem' }}>1</td>
                  <td style={{ fontWeight: 800, color: '#166534', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Total Receipts (+)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#166534' }}>{formatDisplayNum(totals.rec.lts, 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#166534' }}>{formatDisplayNum(totals.rec.kg, 2)}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#166534' }}>{formatDisplayNum(totals.rec.fat, 3)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#166534' }}>{formatDisplayNum(totals.rec.snf, 3)}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>Total of all Receipts</td>
                </tr>

                {/* 2. Opening Balance */}
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#eff6ff' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#1d4ed8', fontSize: '0.75rem' }}>2</td>
                  <td style={{ fontWeight: 800, color: '#1d4ed8', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Opening Balance (OB)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#1d4ed8' }}>{formatDisplayNum(totals.ob.lts, 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#1d4ed8' }}>{formatDisplayNum(totals.ob.kg, 2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-numbers)' }}>{formatDisplayNum(ob.fat_pct, 2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-numbers)' }}>{formatDisplayNum(ob.snf_pct, 2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-numbers)' }}>{formatDisplayNum(ob.sp_gr, 4)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#1d4ed8' }}>{formatDisplayNum(totals.ob.fat, 3)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#1d4ed8' }}>{formatDisplayNum(totals.ob.snf, 3)}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>Beginning Inventory</td>
                </tr>

                {/* 3. Grand Total Receipts */}
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.75rem' }}>3</td>
                  <td style={{ fontWeight: 900, color: '#0f172a', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Grand Total Receipts (=)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandRec.lts, 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandRec.kg, 2)}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandRec.fat, 3)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandRec.snf, 3)}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>Total Receipts + OB</td>
                </tr>

                {/* 4. Total Disposals */}
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fff7ed' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#c2410c', fontSize: '0.75rem' }}>4</td>
                  <td style={{ fontWeight: 800, color: '#c2410c', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Total Disposals (-)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#c2410c' }}>{formatDisplayNum(totals.disp.lts, 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#c2410c' }}>{formatDisplayNum(totals.disp.kg, 2)}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#c2410c' }}>{formatDisplayNum(totals.disp.fat, 3)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#c2410c' }}>{formatDisplayNum(totals.disp.snf, 3)}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#c2410c', fontWeight: 700 }}>Total of all Disposals</td>
                </tr>

                {/* 5. Closing Balance / Physical Count */}
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fefce8' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#854d0e', fontSize: '0.75rem' }}>5</td>
                  <td style={{ fontWeight: 800, color: '#854d0e', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Closing Balance (CB)
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={cb.qty_lts ?? ''}
                      placeholder="0"
                      onChange={e => handlePhysicalCountChange('qty_lts', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 800, color: '#854d0e' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#854d0e', padding: '6px 8px' }}>
                    {cb.qty_kg ? formatDisplayNum(cb.qty_kg, 2) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={cb.fat_pct ?? ''}
                      placeholder="0"
                      onChange={e => handlePhysicalCountChange('fat_pct', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={cb.snf_pct ?? ''}
                      placeholder="0"
                      onChange={e => handlePhysicalCountChange('snf_pct', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={cb.sp_gr ?? ''}
                      placeholder="0"
                      onChange={e => handlePhysicalCountChange('sp_gr', e.target.value)}
                      style={{ height: 28, fontSize: '0.82rem', textAlign: 'right', fontFamily: 'var(--font-numbers)' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#854d0e', padding: '6px 8px' }}>
                    {cb.kg_fat ? formatDisplayNum(cb.kg_fat, 3) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#854d0e', padding: '6px 8px' }}>
                    {cb.kg_snf ? formatDisplayNum(cb.kg_snf, 3) : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#854d0e', fontWeight: 700 }}>Physical Stock Count</td>
                </tr>

                {/* 6. Grand Total Disposals */}
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.75rem' }}>6</td>
                  <td style={{ fontWeight: 900, color: '#0f172a', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Grand Total Disposals (=)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandDisp.lts, 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandDisp.kg, 2)}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandDisp.fat, 3)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', color: '#0f172a' }}>{formatDisplayNum(totals.grandDisp.snf, 3)}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>Disposals + CB</td>
                </tr>

                {/* 7. Loss / Gain */}
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: totals.lossGain.fat >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.75rem' }}>7</td>
                  <td style={{ fontWeight: 800, color: totals.lossGain.fat >= 0 ? '#166534' : '#dc2626', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Loss / Gain
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)' }}>{formatDisplayNum(totals.lossGain.lts, 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)' }}>{formatDisplayNum(totals.lossGain.kg, 2)}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: totals.lossGain.fat >= 0 ? '#166534' : '#dc2626' }}>
                    {formatDisplayNum(totals.lossGain.fat, 3)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: totals.lossGain.snf >= 0 ? '#166534' : '#dc2626' }}>
                    {formatDisplayNum(totals.lossGain.snf, 3)}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 800 }}>Variance</td>
                </tr>

                {/* 8. Loss / Gain % */}
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>8</td>
                  <td style={{ fontWeight: 800, color: '#475569', fontSize: '0.82rem', padding: '6px 8px' }}>
                    Loss / Gain %
                  </td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: totals.lossGainPct.fat > totals.norm ? '#dc2626' : '#166534' }}>
                    {formatDisplayNum(totals.lossGainPct.fat, 3)}%
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: totals.lossGainPct.snf > totals.norm ? '#dc2626' : '#166534' }}>
                    {formatDisplayNum(totals.lossGainPct.snf, 3)}%
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Loss % vs Grand Total</td>
                </tr>

                {/* 9. CMPDD Norms % */}
                <tr style={{ background: '#f8fafc' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>9</td>
                  <td style={{ fontWeight: 800, color: '#475569', fontSize: '0.82rem', padding: '6px 8px' }}>
                    CMPDD Norms %
                  </td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#475569' }}>
                    {totals.norm}%
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', color: '#475569' }}>
                    {totals.norm}%
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Permitted Norm</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side-by-side Plain Uncolored Print & PDF Modal */}
      {isPrintModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', width: '95%', maxWidth: 1100, maxHeight: '92vh', overflowY: 'auto', padding: 24, borderRadius: 8, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            {/* Modal Controls */}
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

              {/* Side-by-side Table */}
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
                        {/* Receipt Columns */}
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'center' }}>{r ? idx + 1 : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3 }}>{r ? (r.variant || r.values.variant) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.qty_lts ? formatDisplayNum(r.values.qty_lts, 0) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.qty_kg ? formatDisplayNum(r.values.qty_kg, 2) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.fat_pct ? formatDisplayNum(r.values.fat_pct, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.snf_pct ? formatDisplayNum(r.values.snf_pct, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.sp_gr ? formatDisplayNum(r.values.sp_gr, 4) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.kg_fat ? formatDisplayNum(r.values.kg_fat, 3) : ''}</td>
                        <td style={{ border: '1px solid #000', padding: 3, textAlign: 'right' }}>{r?.values.kg_snf ? formatDisplayNum(r.values.kg_snf, 3) : ''}</td>

                        {/* Disposal Columns */}
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

                  {/* Staggered Totals Rows matching 01-05-2026-TS.xlsx Sheet STG */}
                  {/* Row 1: Right = Total Disposal */}
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

                  {/* Row 2: Right = CB */}
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

                  {/* Row 3: Right = Grand Total */}
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

                  {/* Row 4: Left = Total Receipt / Right = Loss/Gain */}
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

                  {/* Row 5: Left = OB / Right = Loss/Gain % */}
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

                  {/* Row 6: Left = Grand Total / Right = CMPDD Norms % */}
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
    </div>
  );
}
