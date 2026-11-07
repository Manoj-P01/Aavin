'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Step, { DAILY_ENTRY_STEP_ITEMS } from '@/components/ui/Step';
import { calcKgFatSnf, calcQtyKg, generateDynamicBalanceRows } from '@/lib/calculations';
import type { TSSection, Shift } from '@/lib/types';
import { useConfirm } from '@/context/ConfirmContext';
import { DEFAULT_TS_MASTER } from '@/app/api/ts/statement-masters/route';
import { DEFAULT_STG_TO_TS_RULES, StgToTsMappingRule } from '@/app/api/ts/stg-mappings/route';

interface RowState {
  section: TSSection;
  product: string;
  qty_lts: string;
  qty_kg: string;
  fat_pct: string;
  snf_pct: string;
  sp_gr: string;
  kg_fat: string;
  kg_snf: string;
  remarks: string;
}

const DEFAULT_SP_GR: Record<string, number> = {
  WM: 1.0272, SSM: 1.0311, CREAM: 0.9893, 'DLT MILK': 1.0298,
  'FC.MILK': 1.0298, 'STD.Milk': 1.029, SMP: 1.3834,
};

const DEFAULT_FAT: Record<string, number> = {
  WM: 3.93, SSM: 0.05, CREAM: 39.21, 'DLT MILK': 3.5,
  'FC.MILK': 6, 'STD.Milk': 4.5, SMP: 0.5,
};

const DEFAULT_SNF: Record<string, number> = {
  WM: 7.95, SSM: 8.14, CREAM: 5.53, 'DLT MILK': 8.5,
  'FC.MILK': 9, 'STD.Milk': 8.5, SMP: 96.3,
};

function buildDefaultRowsFromMaster(masterDef: any = DEFAULT_TS_MASTER): RowState[] {
  const result: RowState[] = [];
  const add = (section: TSSection, items: any[]) => {
    (items || []).forEach((item: any) => {
      const prod = (typeof item === 'string' ? item : item.variant || item.product || '').trim();
      if (!prod) return;
      result.push({
        section,
        product: prod,
        qty_lts: item.qty_lts ? String(item.qty_lts) : '',
        qty_kg: item.qty_kg ? String(item.qty_kg) : '',
        fat_pct: item.fat_pct !== undefined ? String(item.fat_pct) : (DEFAULT_FAT[prod] ? String(DEFAULT_FAT[prod]) : ''),
        snf_pct: item.snf_pct !== undefined ? String(item.snf_pct) : (DEFAULT_SNF[prod] ? String(DEFAULT_SNF[prod]) : ''),
        sp_gr: item.sp_gr !== undefined ? String(item.sp_gr) : (DEFAULT_SP_GR[prod] ? String(DEFAULT_SP_GR[prod]) : ''),
        kg_fat: item.kg_fat ? String(item.kg_fat) : '',
        kg_snf: item.kg_snf ? String(item.kg_snf) : '',
        remarks: item.remarks || '',
      });
    });
  };

  add('OB', masterDef?.ob_rows || DEFAULT_TS_MASTER.ob_rows);
  add('RECEIPT', masterDef?.receipt_rows || DEFAULT_TS_MASTER.receipt_rows);
  add('DISPOSAL_DESPATCH', masterDef?.despatch_rows || DEFAULT_TS_MASTER.despatch_rows);
  add('LOCAL_SALE', masterDef?.local_sale_rows || DEFAULT_TS_MASTER.local_sale_rows);
  add('OTHER_DISPOSAL', masterDef?.other_disposal_rows || DEFAULT_TS_MASTER.other_disposal_rows);
  add('CB', masterDef?.cb_rows || DEFAULT_TS_MASTER.cb_rows);

  return result;
}

function applyStgRulesToRows(
  currentRows: RowState[],
  stgRows: any[],
  rules: StgToTsMappingRule[]
): { updatedRows: RowState[]; mappedCount: number } {
  let mappedCount = 0;
  const nextRows = currentRows.map(row => ({ ...row }));
  const normalizeKey = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  nextRows.forEach(row => {
    const targetSec = row.section;
    const targetProd = normalizeKey(row.product);

    // Find rules targeting this section and particular
    const matchingRules = (rules || []).filter(r => {
      if (!r.enabled && r.enabled !== undefined) return false;
      const rSec = r.target_section;
      const rProd = normalizeKey(r.target_particular);
      return rSec === targetSec && (rProd === targetProd || rProd === '*');
    });

    matchingRules.forEach(rule => {
      const srcStmt = normalizeKey(rule.source_statement_key);
      const srcSec = (rule.source_section || '').toUpperCase();
      const srcRowName = normalizeKey(rule.source_row_name);

      // Find matching STG row
      const matchedStg = (stgRows || []).find((sRow: any) => {
        const sBlock = normalizeKey(sRow.product_block || sRow.statement_key || '');
        if (srcStmt !== '*' && srcStmt !== sBlock) return false;

        const sSide = (sRow.side || '').toUpperCase();
        const sItem = (sRow.item_name || '').toUpperCase();

        if (srcSec === 'OB' && (sSide === 'OB' || sItem === 'OB' || sItem.includes('OPENING'))) return true;
        if (srcSec === 'CB' && (sSide === 'CB' || sItem === 'CB' || sItem.includes('CLOSING'))) return true;
        if (srcSec === 'RECEIPT' && sSide !== 'RECEIPT') return false;
        if (srcSec === 'DISPOSAL' && sSide !== 'DISPOSAL') return false;

        const sItemNorm = normalizeKey(sRow.item_name || '');
        return srcRowName === '*' || srcRowName === sItemNorm;
      });

      if (matchedStg) {
        const field = rule.target_field || 'all';
        if (field === 'all' || field === 'qty_lts') {
          if (matchedStg.qty_lts !== undefined && matchedStg.qty_lts !== null) {
            row.qty_lts = String(matchedStg.qty_lts);
            mappedCount++;
          }
        }
        if (field === 'all' || field === 'qty_kg') {
          if (matchedStg.qty_kg !== undefined && matchedStg.qty_kg !== null) {
            row.qty_kg = String(matchedStg.qty_kg);
          }
        }
        if (field === 'all' || field === 'fat_pct') {
          if (matchedStg.fat_pct !== undefined && matchedStg.fat_pct !== null) {
            row.fat_pct = String(matchedStg.fat_pct);
          }
        }
        if (field === 'all' || field === 'snf_pct') {
          if (matchedStg.snf_pct !== undefined && matchedStg.snf_pct !== null) {
            row.snf_pct = String(matchedStg.snf_pct);
          }
        }
        if (field === 'all' || field === 'sp_gr') {
          if (matchedStg.sp_gr !== undefined && matchedStg.sp_gr !== null) {
            row.sp_gr = String(matchedStg.sp_gr);
          }
        }
        if (field === 'all' || field === 'kg_fat') {
          if (matchedStg.kg_fat !== undefined && matchedStg.kg_fat !== null) {
            row.kg_fat = String(matchedStg.kg_fat);
          }
        }
        if (field === 'all' || field === 'kg_snf') {
          if (matchedStg.kg_snf !== undefined && matchedStg.kg_snf !== null) {
            row.kg_snf = String(matchedStg.kg_snf);
          }
        }

        // Recalculate calculated values using standard Excel formulas if sp_gr or qty_kg were not directly supplied
        const fat = parseFloat(row.fat_pct) || 0;
        const snf = parseFloat(row.snf_pct) || 0;
        if ((!row.sp_gr || parseFloat(row.sp_gr) === 0) && (fat > 0 || snf > 0)) {
          row.sp_gr = (1 + (snf - (0.2 * fat) - 0.36) / 250).toFixed(4);
        }

        const lts = parseFloat(row.qty_lts) || 0;
        const spg = parseFloat(row.sp_gr) || 0;
        if ((!row.qty_kg || parseFloat(row.qty_kg) === 0) && lts > 0 && spg > 0) {
          row.qty_kg = String(calcQtyKg(lts, spg));
        }

        const kg = parseFloat(row.qty_kg) || 0;
        if (kg > 0 && (fat > 0 || snf > 0)) {
          const calc = calcKgFatSnf(kg, fat, snf);
          if (!row.kg_fat || parseFloat(row.kg_fat) === 0) row.kg_fat = calc.kg_fat > 0 ? String(calc.kg_fat) : '';
          if (!row.kg_snf || parseFloat(row.kg_snf) === 0) row.kg_snf = calc.kg_snf > 0 ? String(calc.kg_snf) : '';
        }
      }
    });
  });

  return { updatedRows: nextRows, mappedCount };
}

const SECTION_META: { key: TSSection; label: string; color: string }[] = [
  { key: 'OB',                label: 'O/B (Opening Balance)',          color: '#0284c7' },
  { key: 'RECEIPT',           label: 'Receipts',                       color: '#16a34a' },
  { key: 'DISPOSAL_DESPATCH', label: 'Disposal – Despatch / Sale',     color: '#ea580c' },
  { key: 'LOCAL_SALE',        label: 'Local Sales',                    color: '#ea580c' },
  { key: 'OTHER_DISPOSAL',    label: 'Other Disposal',                 color: '#ea580c' },
  { key: 'CB',                label: 'C/B (Closing Balance)',          color: '#0d9488' },
];

export interface TSEntryFormProps {
  stepMode?: boolean;
  activeStep?: string;
  onStepChange?: (stepKey: string) => void;
  onPrevStep?: (date?: string, shift?: any) => void;
  onFinish?: () => void;
  onDateShiftChange?: (date: string, shift: Shift | null) => void;
  initialDate?: string;
  initialShift?: Shift | null;
}

export default function TSEntryForm({
  stepMode = false,
  activeStep,
  onStepChange,
  onPrevStep,
  onFinish,
  onDateShiftChange,
  initialDate,
  initialShift,
}: TSEntryFormProps = {}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const getInitialShift = (): Shift | null => {
    if (initialShift !== undefined) return initialShift;
    if (paramShift === 'D' || paramShift === 'N') return paramShift;
    if (paramShift === 'null' || paramShift === 'NULL') return null;
    return null; // Default to Full Day if no shift is specified or it is invalid
  };

  const [entryDate, setEntryDate] = useState(initialDate || paramDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift | null>(getInitialShift());

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

  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<RowState[]>(() => buildDefaultRowsFromMaster());
  const [stgRowsCache, setStgRowsCache] = useState<any[]>([]);
  const [stgRulesCache, setStgRulesCache] = useState<StgToTsMappingRule[]>([]);
  const [syncingStg, setSyncingStg] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [mainSaving, setMainSaving] = useState(false);
  const [error, setError] = useState('');
  const [reportMode, setReportMode] = useState<'full_day' | 'shift'>('full_day');

  // Load existing TS entry on mount or when entryDate or shift changes
  useEffect(() => {
    if (!entryDate) return;
    let active = true;

    async function loadData() {
      try {
        // Fetch global reportMode setting
        let parsedMode: 'full_day' | 'shift' = 'full_day';
        try {
          const configRes = await fetch('/api/entries?report_type=STOCK&date=1970-01-01');
          if (configRes.ok) {
            const configJson = await configRes.json();
            const entries: any[] = configJson.data || [];
            const configEntry = entries.find((e: any) => {
              if (!e.notes || e.notes.includes('__METADATA__:')) return false;
              try {
                const parsed = JSON.parse(e.notes);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
              } catch { return false; }
            });
            if (configEntry && configEntry.notes) {
              try {
                const parsed = JSON.parse(configEntry.notes);
                if (parsed && typeof parsed === 'object') {
                  if (parsed.mode) parsedMode = parsed.mode;
                }
              } catch (e) {}
            }
          }
        } catch (err) {
          console.error('Failed to load shift mode config in TSEntryForm:', err);
        }
        setReportMode(parsedMode);
        if (parsedMode === 'full_day') {
          setShift(null);
        }

        // Fetch TS Statement Master formulations
        let tsMasterDef: any = DEFAULT_TS_MASTER;
        try {
          const mRes = await fetch('/api/ts/statement-masters');
          if (mRes.ok) {
            const mJson = await mRes.json();
            if (mJson.master) tsMasterDef = mJson.master;
          }
        } catch (err) {
          console.warn('Failed loading TS statement masters:', err);
        }

        // Fetch STG ➔ TS Mapping Rules
        let mappingRules: StgToTsMappingRule[] = DEFAULT_STG_TO_TS_RULES;
        try {
          const rRes = await fetch('/api/ts/stg-mappings');
          if (rRes.ok) {
            const rJson = await rRes.json();
            if (Array.isArray(rJson.rules)) mappingRules = rJson.rules;
          }
        } catch (err) {
          console.warn('Failed loading STG mappings:', err);
        }
        if (active) setStgRulesCache(mappingRules);

        // Fetch TS Entry & STG Rows for this date
        const res = await fetch(`/api/ts?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
        let activeRows: RowState[] = [];
        let hasSavedRows = false;
        let entryNotes = '';
        let stgRows: any[] = [];

        if (res.ok) {
          const data = await res.json();
          if (active && data.data) {
            entryNotes = data.data.notes || '';
            stgRows = data.data.stg_rows || [];
            if (active) setStgRowsCache(stgRows);

            if (data.data.ts_rows && data.data.ts_rows.length > 0) {
              hasSavedRows = true;
              activeRows = data.data.ts_rows.map((row: any) => ({
                section: row.section,
                product: row.product || '',
                qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                remarks: row.remarks || '',
              }));
            }
          }
        }

        if (!hasSavedRows) {
          // Initialize rows from TS Master Formulations
          const defaultRows = buildDefaultRowsFromMaster(tsMasterDef);
          // Apply STG mapping rules
          const { updatedRows } = applyStgRulesToRows(defaultRows, stgRows, mappingRules);
          activeRows = updatedRows;
        }

        if (active) {
          setRows(activeRows);
          setNotes(entryNotes);
        }
      } catch (err) {
        console.error('Error loading TS data:', err);
        if (active) {
          setRows(buildDefaultRowsFromMaster());
          setNotes('');
        }
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift]);

  const handleManualSyncFromStg = async () => {
    setSyncingStg(true);
    setSyncStatusMsg(null);
    try {
      // 1. Fetch fresh STG rows for current date and shift
      const res = await fetch(`/api/ts?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
      let freshStgRows: any[] = [];
      if (res.ok) {
        const json = await res.json();
        freshStgRows = json.data?.stg_rows || [];
      }

      // 2. Fetch fresh STG mapping rules
      let freshRules = stgRulesCache;
      try {
        const rRes = await fetch('/api/ts/stg-mappings');
        if (rRes.ok) {
          const rJson = await rRes.json();
          if (Array.isArray(rJson.rules)) freshRules = rJson.rules;
        }
      } catch {}

      if (freshStgRows.length === 0) {
        setSyncStatusMsg('⚠️ No STG statement entries found for this date & shift.');
        setTimeout(() => setSyncStatusMsg(null), 4000);
        setSyncingStg(false);
        return;
      }

      const { updatedRows, mappedCount } = applyStgRulesToRows(rows, freshStgRows, freshRules);
      setRows(updatedRows);
      setStgRowsCache(freshStgRows);
      setStgRulesCache(freshRules);

      setSyncStatusMsg(`✅ Successfully synced ${mappedCount} values from Solid Balance STG statement!`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatusMsg('❌ Failed to sync from STG statement.');
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
    setSyncingStg(false);
  };

  const updateRow = (idx: number, field: keyof RowState, value: string) => {
    const finalVal = field === 'product' ? value.toUpperCase() : value;
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: finalVal };

      // 1. Auto-calc sp_gr if fat_pct and snf_pct are entered
      if (field === 'fat_pct' || field === 'snf_pct') {
        const fat = parseFloat(field === 'fat_pct' ? value : next[idx].fat_pct) || 0;
        const snf = parseFloat(field === 'snf_pct' ? value : next[idx].snf_pct) || 0;
        if (fat > 0 || snf > 0) {
          // Standard Excel formula: 1 + (snf - (0.2 * fat) - 0.36) / 250
          const spg = 1 + (snf - (0.2 * fat) - 0.36) / 250;
          if (spg > 0) {
            next[idx].sp_gr = spg.toFixed(4);
          }
        }
      }

      // 2. Auto-calc qty_kg from qty_lts × sp_gr
      if (field === 'qty_lts' || field === 'sp_gr' || field === 'fat_pct' || field === 'snf_pct') {
        const lts = parseFloat(field === 'qty_lts' ? value : next[idx].qty_lts) || 0;
        const spg = parseFloat(field === 'sp_gr' ? value : next[idx].sp_gr) || 0;
        if (lts > 0 && spg > 0) {
          next[idx].qty_kg = String(calcQtyKg(lts, spg));
        }
      }

      // 3. Auto-calc kg_fat / kg_snf from qty_kg, fat_pct, snf_pct
      const kg = parseFloat(next[idx].qty_kg) || 0;
      const fat = parseFloat(next[idx].fat_pct) || 0;
      const snf = parseFloat(next[idx].snf_pct) || 0;
      const calc = calcKgFatSnf(kg, fat, snf);

      if (field === 'qty_kg' || field === 'qty_lts' || field === 'sp_gr' || field === 'fat_pct' || field === 'snf_pct') {
        next[idx].kg_fat = calc.kg_fat > 0 ? String(calc.kg_fat) : '';
        next[idx].kg_snf = calc.kg_snf > 0 ? String(calc.kg_snf) : '';
      }

      return next;
    });
  };

  const addRowAfter = (section: TSSection, originalIdx: number) => {
    setRows(prev => {
      const next = [...prev];
      const item: RowState = {
        section,
        product: '',
        qty_lts: '',
        qty_kg: '',
        fat_pct: '',
        snf_pct: '',
        sp_gr: '',
        kg_fat: '',
        kg_snf: '',
        remarks: '',
      };

      if (originalIdx !== -1) {
        next.splice(originalIdx + 1, 0, item);
      } else {
        // Find last index of this section in rows
        let insertAt = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].section === section) {
            insertAt = i;
            break;
          }
        }
        if (insertAt !== -1) {
          next.splice(insertAt + 1, 0, item);
        } else {
          next.push(item);
        }
      }
      return next;
    });
  };

  const deleteRow = async (originalIdx: number) => {
    const item = rows[originalIdx];
    if (!item) return;

    const hasContent = (
      item.product.trim() !== '' ||
      item.qty_lts.trim() !== '' ||
      item.qty_kg.trim() !== '' ||
      item.fat_pct.trim() !== '' ||
      item.snf_pct.trim() !== '' ||
      item.sp_gr.trim() !== '' ||
      item.kg_fat.trim() !== '' ||
      item.kg_snf.trim() !== '' ||
      (item.remarks || '').trim() !== ''
    );

    if (hasContent) {
      const ok = await confirm({
        title: 'Confirm Row Removal',
        message: 'Are you sure you want to remove this row containing data?',
        confirmText: 'Remove Row',
        cancelText: 'Cancel',
        type: 'warning',
      });
      if (!ok) return;
    }

    setRows(prev => {
      const next = [...prev];
      next.splice(originalIdx, 1);
      return next;
    });
  };

  // Helper to ensure the main entry exists, returning the entry ID
  const getOrCreateEntryId = async (): Promise<string> => {
    const cleanNotesText = notes ? notes.trim() : '';
    const entryRes = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: entryDate, shift, report_type: 'TS', notes: cleanNotesText || null }),
    });
    const entryData = await entryRes.json();
    if (!entryRes.ok && entryRes.status !== 409) {
      throw new Error(entryData.error || 'Failed to initialize entry');
    }

    if (entryRes.status === 409) {
      // Entry already exists, fetch it
      const getRes = await fetch(`/api/entries?report_type=TS&date=${entryDate}&shift=${shift}`);
      const getData = await getRes.json();
      if (getData.data && getData.data.length > 0) {
        return getData.data[0].id;
      }
      throw new Error('Conflict created but couldn\'t retrieve entry ID');
    }

    return entryData.data.id;
  };

  // Save a single section independently
  const handleSaveSection = async (section: TSSection) => {
    if (!entryDate) { setError('Please select a date first.'); return; }
    setSavingSection(prev => ({ ...prev, [section]: true }));
    setError('');
    try {
      const entryId = await getOrCreateEntryId();
      const sectionRows = rows.filter(r => r.section === section);

      const res = await fetch('/api/ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          section, // Let backend delete only this section's old entries
          ts_rows: sectionRows.map((r, i) => ({ ...r, sort_order: i })),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `Failed to save ${section} section`);
      }

      setSaveStatus(prev => ({ ...prev, [section]: 'Saved successfully! ✓' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [section]: '' }));
      }, 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Section save failed');
    } finally {
      setSavingSection(prev => ({ ...prev, [section]: false }));
    }
  };

  const handleSaveAll = async () => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setMainSaving(true); setError('');
    try {
      const entryId = await getOrCreateEntryId();

      const res = await fetch('/api/ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          ts_rows: rows.map((r, i) => ({ ...r, sort_order: i })),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save TS report');
      }

      router.push(`/dashboard/ts/${entryDate}?shift=${shift ?? 'null'}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setMainSaving(false);
    }
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
      router.push(`/dashboard/stock/new?step=stg&date=${entryDate}&shift=${s}`);
    } else if (key === 'ts') {
      router.push(`/dashboard/stock/new?step=ts&date=${entryDate}&shift=${s}`);
    } else if (key === 'reports') {
      router.push(`/dashboard/ts/${entryDate}?shift=${s}`);
    }
  };

  return (
    <>
      <Header
        title="Total Solids (TS) Statement"
        subtitle={`Auto-calculated Fat & SNF Balances (${reportMode === 'full_day' ? 'Full Day' : (shift === 'D' ? 'Day Shift' : 'Night Shift')})`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/dashboard/ts/defaults" className="btn btn-secondary btn-sm">⭐ TS Defaults</Link>
            <Link href="/dashboard/ts/columns" className="btn btn-secondary btn-sm">⚙️ Columns</Link>
            <Link href="/dashboard/ts/ts-mappings" className="btn btn-secondary btn-sm">🔗 STG Mappings</Link>
            <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">← Back to TS List</Link>
          </div>
        }
      >
        <Step
          items={DAILY_ENTRY_STEP_ITEMS}
          flat={true}
          activeStep={activeStep || 'ts'}
          onStepClick={handleStepClick}
          style={{ marginBottom: 0, marginTop: 4 }}
        />
      </Header>
      <div className="form-container">
      {/* Date / Shift / Notes */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Entry Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              id="ts-entry-date"
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
                    {[
                      { label: '☀️ Day Shift', value: 'D' },
                      { label: '🌙 Night Shift', value: 'N' }
                    ].map(s => (
                      <button
                        key={s.value}
                        type="button"
                        className={`btn ${shift === s.value ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setShift(s.value as Shift);
                          if (onDateShiftChange) onDateShiftChange(entryDate, s.value as Shift);
                        }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.label}</span>
                      </button>
                    ))}
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
              placeholder="e.g. Maintenance day, partial collection..."
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={handleManualSyncFromStg}
              disabled={syncingStg}
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, height: 38 }}
              title="Sync and update values from Stage 3 Solid Balance STG Statement using configured mapping rules"
            >
              {syncingStg ? <span className="spinner" /> : '🔄'} Sync from STG Statement
            </button>
          </div>
        </div>
      </div>

      {syncStatusMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>
          {syncStatusMsg}
        </div>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Sections */}
      {SECTION_META.map(({ key, label, color }) => {
        const isBalanceSection = key === 'OB' || key === 'CB';
        const sRowsWithIdx = rows
          .map((r, originalIdx) => ({ r, originalIdx }))
          .filter(x => x.r.section === key);

        return (
          <div key={key} className="entry-form-section">
            <div className="entry-form-section-title" style={{ color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {label}
                <span style={{ fontSize: '0.75rem', fontWeight: 500, marginLeft: 8, opacity: 0.85, padding: '2px 6px', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, verticalAlign: 'middle', color: 'var(--text-secondary)' }}>
                  🔗 STG Mapped
                </span>
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saveStatus[key] && (
                  <span style={{ fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>
                    {saveStatus[key]}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: color, border: 'none', boxShadow: 'none' }}
                  onClick={() => handleSaveSection(key)}
                  disabled={savingSection[key]}
                >
                  {savingSection[key] ? 'Saving...' : '💾 Save Section'}
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="inline-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', minWidth: 150 }}>Product</th>
                    <th style={{ minWidth: 90 }}>Qty (Lts)</th>
                    <th style={{ minWidth: 90, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Qty (Kg)</th>
                    <th style={{ minWidth: 70 }}>Fat %</th>
                    <th style={{ minWidth: 70 }}>SNF %</th>
                    <th style={{ minWidth: 70, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Sp. Gr</th>
                    <th style={{ minWidth: 90, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Kg Fat</th>
                    <th style={{ minWidth: 90, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Kg SNF</th>
                    <th className="no-print" style={{ width: 70 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sRowsWithIdx.map(({ r, originalIdx }) => (
                    <tr key={`${key}-${originalIdx}`}>
                      <td>
                        <input
                          type="text"
                          value={r.product}
                          onChange={e => updateRow(originalIdx, 'product', e.target.value)}
                          style={{ textAlign: 'left', fontWeight: 500, fontFamily: 'var(--font-sans)' }}
                          id={`ts-${key}-${originalIdx}-product`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={r.qty_lts}
                          onChange={e => updateRow(originalIdx, 'qty_lts', e.target.value)}
                          id={`ts-${key}-${originalIdx}-lts`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={r.qty_kg}
                          onChange={e => updateRow(originalIdx, 'qty_kg', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kg`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.fat_pct}
                          onChange={e => updateRow(originalIdx, 'fat_pct', e.target.value)}
                          id={`ts-${key}-${originalIdx}-fat`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.snf_pct}
                          onChange={e => updateRow(originalIdx, 'snf_pct', e.target.value)}
                          id={`ts-${key}-${originalIdx}-snf`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.sp_gr}
                          onChange={e => updateRow(originalIdx, 'sp_gr', e.target.value)}
                          id={`ts-${key}-${originalIdx}-spg`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.kg_fat}
                          onChange={e => updateRow(originalIdx, 'kg_fat', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kgfat`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.kg_snf}
                          onChange={e => updateRow(originalIdx, 'kg_snf', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kgsnf`}
                        />
                      </td>

                      <td className="no-print">
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                            title="Add row below"
                            onClick={() => addRowAfter(key, originalIdx)}
                          >
                            ➕
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                            title="Delete row"
                            onClick={() => deleteRow(originalIdx)}
                          >
                            ❌
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Clickable inline Add Row */}
                  {!isBalanceSection && (
                    <tr className="no-print" style={{ cursor: 'pointer', background: '#f8fafc' }} onClick={() => {
                      const lastSecRow = sRowsWithIdx[sRowsWithIdx.length - 1];
                      addRowAfter(key, lastSecRow ? lastSecRow.originalIdx : -1);
                    }}>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--brand-primary)', fontWeight: 600, padding: 8 }}>
                        ➕ Add Row
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: stepMode ? 'space-between' : 'flex-end', marginTop: 12, marginBottom: 40 }}>
        {stepMode ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (onDateShiftChange) onDateShiftChange(entryDate, shift);
                if (onPrevStep) {
                  onPrevStep(entryDate, shift);
                } else {
                  router.push(`/dashboard/stock/new?step=stg&date=${entryDate}&shift=${shift || 'F'}`);
                }
              }}
              disabled={mainSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ← Back to STG Statement
            </button>
            <button
              id="ts-finish-btn"
              className="btn btn-primary"
              onClick={async () => {
                await handleSaveAll();
                if (onFinish) onFinish();
              }}
              disabled={mainSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#10b981',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              {mainSaving ? 'Saving & Finalizing...' : '🎉 Save & Finish Daily Entry'}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-secondary"
              onClick={() => router.back()}
              disabled={mainSaving}
            >
              Cancel
            </button>
            <button
              id="ts-save-btn"
              className="btn btn-primary"
              onClick={handleSaveAll}
              disabled={mainSaving}
            >
              {mainSaving ? 'Saving All...' : '💾 Save Entire TS Report'}
            </button>
          </>
        )}
      </div>
    </div>
    </>
  );
}
