'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getStandardColumnDecimals, cleanStatementLabel } from '@/lib/calculations';
import { useConfirm } from '@/context/ConfirmContext';

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

export interface STGMasterDef {
  key: string;
  label: string;
  name?: string;
  variant?: string;
  description?: string;
  is_split?: boolean;
  receipt_rows?: any[];
  disposal_rows?: any[];
  reconciliation_rows?: STGReconRow[];
  default_rows?: any[];
  rows?: any[];
  custom_columns?: STGColumnDef[];
  sort_order?: number;
  is_active?: boolean;
}

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

export interface STGRowData {
  variant: string;
  row_type?: 'OB' | 'RECEIPT' | 'DISPOSAL';
  side?: 'RECEIPT' | 'DISPOSAL';
  values: Record<string, any>;
}

function STGDefaultFormulationsContent() {
  const { confirm, showWarning } = useConfirm();
  const searchParams = useSearchParams();
  const paramMaster = searchParams?.get('master') || null;
  const [columns, setColumns] = useState<STGColumnDef[]>([]);
  const [defaultColumns, setDefaultColumns] = useState<STGColumnDef[]>([]);
  const [masters, setMasters] = useState<STGMasterDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, STGRowData[]>>({});

  const [activeMasterKey, setActiveMasterKey] = useState<string | null>(null);
  const [rows, setRows] = useState<STGRowData[]>([]);
  const [reconRows, setReconRows] = useState<STGReconRow[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colKey: string; isRecon?: boolean } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colKey: string; isRecon?: boolean } | null>(null);
  const [isColEditing, setIsColEditing] = useState<boolean>(false);
  const [viewDecimals, setViewDecimals] = useState<number | 'auto'>('auto');

  // Modal State for Adding / Editing Columns
  const [isColModalOpen, setIsColModalOpen] = useState<boolean>(false);
  const [colModalInsertIdx, setColModalInsertIdx] = useState<number | null>(null);
  const [colModalEditingKey, setColModalEditingKey] = useState<string | null>(null);

  const [formColKey, setFormColKey] = useState<string>('');
  const [colKeyManuallyEdited, setColKeyManuallyEdited] = useState<boolean>(false);
  const [formColName, setFormColName] = useState<string>('');
  const [formColType, setFormColType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formColFormula, setFormColFormula] = useState<string>('');
  const [formColUnit, setFormColUnit] = useState<string>('');
  const [formColDecimals, setFormColDecimals] = useState<number | undefined>(undefined);

  // Modal State for Managing Statement Master Names (Update, Delete, Insert)
  const [isManageMastersModalOpen, setIsManageMastersModalOpen] = useState<boolean>(false);
  const [editingMasterKey, setEditingMasterKey] = useState<string | null>(null);
  const [editMasterLabel, setEditMasterLabel] = useState<string>('');
  const [editMasterVariant, setEditMasterVariant] = useState<string>('');
  const [editMasterDescription, setEditMasterDescription] = useState<string>('');

  // Modal State for Creating a Brand New Statement Master Template
  const [isNewMasterModalOpen, setIsNewMasterModalOpen] = useState<boolean>(false);
  const [newMasterName, setNewMasterName] = useState<string>('');
  const [newMasterKey, setNewMasterKey] = useState<string>('');
  const [newMasterKeyManuallyEdited, setNewMasterKeyManuallyEdited] = useState<boolean>(false);
  const [newMasterVariant, setNewMasterVariant] = useState<string>('');
  const [newMasterDescription, setNewMasterDescription] = useState<string>('');
  const [newMasterSource, setNewMasterSource] = useState<string>('blank');
  const [newMasterColsSource, setNewMasterColsSource] = useState<string>('default');

  // Fill handle state
  const [fillDrag, setFillDrag] = useState<{ sourceRow: number; targetRow: number; colKey: string } | null>(null);

  // Split into Receipt and Disposal rows
  const receiptRows = useMemo(() => {
    return rows.filter(r => r.row_type === 'RECEIPT' || r.side === 'RECEIPT');
  }, [rows]);

  const disposalRows = useMemo(() => {
    return rows.filter(r => r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL');
  }, [rows]);

  // Fetch Configs & Templates from DB
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [colRes, masterRes] = await Promise.all([
        fetch('/api/ts/columns'),
        fetch('/api/ts/masters'),
      ]);

      let loadedCols: STGColumnDef[] = [];
      if (colRes.ok) {
        const json = await colRes.json();
        loadedCols = json.columns || [];
        setColumns(loadedCols);
        setDefaultColumns(loadedCols);
      }

      if (masterRes.ok) {
        const json = await masterRes.json();
        const loadedMasters: STGMasterDef[] = json.masters || [];
        setMasters(loadedMasters);

        const tmplMap: Record<string, STGRowData[]> = {};
        loadedMasters.forEach(m => {
          if (Array.isArray(m.default_rows) && m.default_rows.length > 0) {
            tmplMap[m.key] = m.default_rows;
          } else if (Array.isArray(m.receipt_rows) || Array.isArray(m.disposal_rows)) {
            tmplMap[m.key] = [
              ...(m.receipt_rows || []).map((r: any) => ({ ...r, row_type: 'RECEIPT', side: 'RECEIPT' })),
              ...(m.disposal_rows || []).map((r: any) => ({ ...r, row_type: 'DISPOSAL', side: 'DISPOSAL' })),
            ];
          } else if (Array.isArray(m.rows) && m.rows.length > 0) {
            tmplMap[m.key] = m.rows.map(r => ({ variant: r.short_name || r.full_name || r.variant || '', values: r.values || {}, row_type: r.row_type || r.side || 'RECEIPT', side: r.side || r.row_type || 'RECEIPT' }));
          }
        });
        setTemplates(tmplMap);

        if (loadedMasters.length > 0) {
          const initialKey = (paramMaster && loadedMasters.some(m => m.key === paramMaster))
            ? paramMaster
            : (activeMasterKey && loadedMasters.some(m => m.key === activeMasterKey)
              ? activeMasterKey
              : loadedMasters[0].key);
          setActiveMasterKey(initialKey);
          const initialMaster = loadedMasters.find(m => m.key === initialKey);
          if (initialMaster?.custom_columns && initialMaster.custom_columns.length > 0) {
            setColumns(initialMaster.custom_columns);
          } else if (loadedCols.length > 0) {
            setColumns(loadedCols);
          }
          loadMasterDefaults(initialKey, loadedMasters, tmplMap);
        }
      }
    } catch (err) {
      console.error('Failed to load STG defaults:', err);
    }
    setLoading(false);
  }, [activeMasterKey, paramMaster]);

  useEffect(() => {
    loadData();
  }, []);

  const loadMasterDefaults = (
    masterKey: string,
    mastersList: STGMasterDef[],
    tmplMap: Record<string, STGRowData[]>
  ) => {
    const master = mastersList.find(m => m.key === masterKey);
    const existingTmpl = tmplMap[masterKey];

    let loadedRows: STGRowData[] = [];
    if (existingTmpl && Array.isArray(existingTmpl) && existingTmpl.length > 0) {
      loadedRows = JSON.parse(JSON.stringify(existingTmpl));
    } else if (master?.default_rows && master.default_rows.length > 0) {
      loadedRows = JSON.parse(JSON.stringify(master.default_rows));
    } else if (master?.receipt_rows || master?.disposal_rows) {
      loadedRows = [
        ...(master.receipt_rows || []).map((r: any) => ({ ...r, row_type: 'RECEIPT', side: 'RECEIPT' })),
        ...(master.disposal_rows || []).map((r: any) => ({ ...r, row_type: 'DISPOSAL', side: 'DISPOSAL' })),
      ];
    } else {
      loadedRows = [
        { variant: 'Opening Balance', row_type: 'OB', side: 'RECEIPT', values: {} },
        { variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: {} },
        { variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} },
      ];
    }

    // Ensure rows have row_type and side
    if (master && (master.receipt_rows || master.disposal_rows)) {
      const recVariants = new Set((master.receipt_rows || []).map((r: any) => (r.variant || '').toLowerCase().trim()));
      const dispVariants = new Set((master.disposal_rows || []).map((r: any) => (r.variant || '').toLowerCase().trim()));
      loadedRows.forEach(r => {
        if (!r.row_type && !r.side) {
          const v = (r.variant || '').toLowerCase().trim();
          if (recVariants.has(v)) {
            r.row_type = 'RECEIPT';
            r.side = 'RECEIPT';
          } else if (dispVariants.has(v)) {
            r.row_type = 'DISPOSAL';
            r.side = 'DISPOSAL';
          } else {
            r.row_type = 'RECEIPT';
            r.side = 'RECEIPT';
          }
        }
      });
    }

    // Fallback if none tagged
    const hasRec = loadedRows.some(r => r.row_type === 'RECEIPT' || r.side === 'RECEIPT');
    const hasDisp = loadedRows.some(r => r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL');
    if (!hasRec && !hasDisp) {
      const half = Math.ceil(loadedRows.length / 2);
      loadedRows.forEach((r, idx) => {
        r.row_type = idx < half ? 'RECEIPT' : 'DISPOSAL';
        r.side = r.row_type;
      });
    }

    setRows(loadedRows);

    // Load reconciliation rows for this statement master
    if (master?.reconciliation_rows && Array.isArray(master.reconciliation_rows) && master.reconciliation_rows.length > 0) {
      setReconRows(JSON.parse(JSON.stringify(master.reconciliation_rows)));
    } else {
      setReconRows(getDefaultReconRows());
    }

    setSelectedCell(null);
    setFocusedCell(null);
  };

  const handleSwitchMaster = (newKey: string) => {
    setActiveMasterKey(newKey);
    const targetMaster = masters.find(m => m.key === newKey);
    if (targetMaster && Array.isArray(targetMaster.custom_columns) && targetMaster.custom_columns.length > 0) {
      setColumns(targetMaster.custom_columns);
    } else if (defaultColumns.length > 0) {
      setColumns(defaultColumns);
    }
    loadMasterDefaults(newKey, masters, templates);
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
    if (!editingMasterKey || !editMasterLabel.trim()) {
      showToast('❌ Please provide a valid Statement Master Name.');
      return;
    }
    const cleanLabel = cleanStatementLabel(editMasterLabel.trim());
    const updated = masters.map(m => {
      if (m.key === editingMasterKey) {
        return {
          ...m,
          label: cleanLabel,
          name: cleanLabel,
          variant: editMasterVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
          description: editMasterDescription.trim(),
        };
      }
      return m;
    });

    setSaving(true);
    try {
      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: updated }),
      });
      if (res.ok) {
        setMasters(updated);
        setEditingMasterKey(null);
        showToast(`✅ Updated Statement Master "${cleanLabel}" successfully.`);
      } else {
        showToast('❌ Failed to update statement master.');
      }
    } catch (err) {
      console.error('Update master error:', err);
      showToast('❌ Error updating statement master.');
    }
    setSaving(false);
  };

  const handleDeleteMaster = async (key: string, name: string) => {
    if (masters.length <= 1) {
      showToast('❌ At least one Statement Master must remain.');
      return;
    }
    const isConfirmed = await confirm({
      title: 'Delete Statement Master',
      message: `Are you sure you want to delete Statement Master "${name}"? This will delete the statement and its formulation table from the database.`,
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
        const remaining = masters.filter(m => m.key !== key);
        setMasters(remaining);
        const nextTemplates = { ...templates };
        delete nextTemplates[key];
        setTemplates(nextTemplates);

        if (activeMasterKey === key) {
          const nextKey = remaining[0]?.key;
          if (nextKey) {
            handleSwitchMaster(nextKey);
          }
        }
        showToast(`✅ Deleted statement master "${name}" successfully.`);
      } else {
        showToast('❌ Failed to delete statement master.');
      }
    } catch (err) {
      console.error('Delete master error:', err);
      showToast('❌ Error deleting statement master.');
    }
    setSaving(false);
  };

  const handleSelectAndClose = (masterKey: string) => {
    handleSwitchMaster(masterKey);
    setIsManageMastersModalOpen(false);
  };

  const handleCreateNewMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim()) {
      showToast('❌ Please enter a Statement Master Name');
      return;
    }

    const cleanLabel = cleanStatementLabel(newMasterName.trim());
    const keyToUse = newMasterKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!keyToUse) {
      showToast('❌ Please enter a valid Field Key');
      return;
    }

    if (masters.some(m => m.key === keyToUse)) {
      showToast(`❌ Master with key "${keyToUse}" already exists! Please use a unique Statement Master Name or key.`);
      return;
    }

    // Determine initial formulation template rows
    let initialRows: STGRowData[] = [];
    if (newMasterSource === 'blank') {
      initialRows = [
        { variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: {} },
        { variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} },
      ];
    } else {
      const srcTmpl = templates[newMasterSource] || (masters.find(m => m.key === newMasterSource)?.default_rows) || [];
      initialRows = JSON.parse(JSON.stringify(srcTmpl.length > 0 ? srcTmpl : [
        { variant: 'Receipt 1', row_type: 'RECEIPT', side: 'RECEIPT', values: {} },
        { variant: 'Disposal 1', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} },
      ]));
    }

    // Determine configured columns
    let initialCols: STGColumnDef[] = [];
    if (newMasterColsSource === 'default') {
      initialCols = JSON.parse(JSON.stringify(columns.length > 0 ? columns : defaultColumns));
    } else {
      const srcMaster = masters.find(m => m.key === newMasterColsSource);
      const srcCols = srcMaster?.custom_columns || columns;
      initialCols = JSON.parse(JSON.stringify(srcCols.length > 0 ? srcCols : defaultColumns));
    }

    const recRows = initialRows.filter(r => r.row_type === 'RECEIPT' || r.side === 'RECEIPT');
    const dispRows = initialRows.filter(r => r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL');

    let initialReconRows: STGReconRow[] = [];
    if (newMasterSource !== 'blank') {
      const srcMaster = masters.find(m => m.key === newMasterSource);
      if (srcMaster?.reconciliation_rows && Array.isArray(srcMaster.reconciliation_rows) && srcMaster.reconciliation_rows.length > 0) {
        initialReconRows = JSON.parse(JSON.stringify(srcMaster.reconciliation_rows));
      } else {
        initialReconRows = getDefaultReconRows();
      }
    } else {
      initialReconRows = getDefaultReconRows();
    }

    const newMaster: STGMasterDef = {
      key: keyToUse,
      label: cleanLabel,
      variant: newMasterVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
      description: newMasterDescription.trim(),
      sort_order: masters.length + 1,
      receipt_rows: recRows,
      disposal_rows: dispRows,
      reconciliation_rows: initialReconRows,
      default_rows: initialRows,
      rows: initialRows.map(r => ({ variant: r.variant || r.values.variant || '', values: r.values, row_type: r.row_type, side: r.side })),
      custom_columns: initialCols,
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
        setTemplates(prev => ({
          ...prev,
          [keyToUse]: initialRows,
        }));
        setIsNewMasterModalOpen(false);
        setActiveMasterKey(keyToUse);
        setRows(initialRows);
        setReconRows(initialReconRows);
        setColumns(initialCols);
        showToast(`✅ Created new Statement Master "${newMaster.label}" with initial formulation template & configured columns!`);
      } else {
        showToast('❌ Failed to create statement master');
      }
    } catch (err) {
      console.error('Error creating statement master:', err);
      showToast('❌ Server error creating statement master');
    }
    setSaving(false);
  };

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

  // Safe Excel Formula Evaluator
  const evaluateExcelFormula = (
    formulaInput: string,
    rowIndex: number,
    rowVals: Record<string, any>,
    rowsContext?: STGRowData[],
    depth: number = 0
  ): number => {
    if (!formulaInput || typeof formulaInput !== 'string' || depth > 10) return 0;
    let expr = formulaInput.trim();
    if (expr.startsWith('=')) expr = expr.substring(1).trim();
    if (expr.startsWith('+')) expr = expr.substring(1).trim();
    if (!expr) return 0;

    const rowList = rowsContext || rows || [];

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

      if (rawVal === undefined || rawVal === null || rawVal === '') return '0';

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

    columns.forEach(col => {
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
    rowsContext?: STGRowData[]
  ) => {
    const rList = rowsContext || rows || [];
    const cellVal = rowVals ? rowVals[col.key] : undefined;

    if (cellVal !== undefined && typeof cellVal === 'string' && (cellVal.startsWith('=') || cellVal.startsWith('=+'))) {
      return evaluateExcelFormula(cellVal, rowIndex, rowVals, rList);
    }

    if (col.type === 'calculated') {
      if (col.formula && typeof col.formula === 'string' && (col.formula.startsWith('=') || col.formula.startsWith('=+'))) {
        return evaluateExcelFormula(col.formula, rowIndex, rowVals, rList);
      }

      const qtyLitVal = rowVals ? rowVals.qty_lts : undefined;
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

  // Calculation of totals
  const totalReceipts = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => {
      if (col.type !== 'text') {
        const sum = receiptRows.reduce((acc, row) => {
          const globalIdx = rows.findIndex(r => r === row);
          const computed = computeCell(col, row.values, globalIdx, rows);
          const num = typeof computed === 'number' ? computed : parseFloat(String(computed || 0));
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
        totals[col.key] = sum;
      }
    });
    return totals;
  }, [columns, receiptRows, rows]);

  const totalDisposals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => {
      if (col.type !== 'text') {
        const sum = disposalRows.reduce((acc, row) => {
          const globalIdx = rows.findIndex(r => r === row);
          const computed = computeCell(col, row.values, globalIdx, rows);
          const num = typeof computed === 'number' ? computed : parseFloat(String(computed || 0));
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
        totals[col.key] = sum;
      }
    });
    return totals;
  }, [columns, disposalRows, rows]);

  const activeCellDetails = useMemo(() => {
    if (!selectedCell || !columns.length) {
      return { address: 'A1', colName: '', isCalculated: false, formulaText: '', value: '-' };
    }

    if (selectedCell.isRecon) {
      const colIdx = columns.findIndex(c => c.key === selectedCell.colKey);
      const col = colIdx !== -1 ? columns[colIdx] : { key: selectedCell.colKey, name: selectedCell.colKey, type: 'number' as const, decimals: 2 };
      const excelColLetter = colIdx !== -1 ? getExcelColName(colIdx) : 'R';
      const address = `R${selectedCell.rowIndex + 1}.${excelColLetter}`;

      const currentRow = reconRows[selectedCell.rowIndex] || { values: {}, label: '' };
      let rawVal = currentRow.values?.[selectedCell.colKey];
      if (rawVal === undefined) {
        if (selectedCell.colKey === 'qty_lts') rawVal = currentRow.values?.['lts'];
        else if (selectedCell.colKey === 'lts') rawVal = currentRow.values?.['qty_lts'];
        else if (selectedCell.colKey === 'qty_kg') rawVal = currentRow.values?.['kg'];
        else if (selectedCell.colKey === 'kg') rawVal = currentRow.values?.['qty_kg'];
      }

      let computedVal: any = rawVal ?? '';
      if (typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'))) {
        computedVal = evaluateReconFormula(rawVal, selectedCell.colKey, selectedCell.rowIndex, reconRows, totalReceipts, totalDisposals);
      }

      const valueStr = typeof computedVal === 'number'
        ? formatNumberValue(computedVal, (col as any).decimals, col.key)
        : (computedVal || '-');

      return {
        address,
        colName: `${currentRow.label || `Recon R${selectedCell.rowIndex + 1}`} → ${col.name}`,
        isCalculated: false,
        formulaText: rawVal !== undefined ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '',
        value: valueStr,
      };
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
      } else {
        formulaText = `= CALCULATED`;
      }
    } else {
      const rawVal = storedVal !== undefined ? storedVal : (col.type === 'text' ? (currentRow.variant || '') : '');
      formulaText = rawVal !== '' ? (String(rawVal).startsWith('=') ? String(rawVal) : `= ${rawVal}`) : '';
    }

    const valueStr = typeof computedVal === 'number'
      ? formatNumberValue(computedVal, col.decimals, col.key)
      : (computedVal || '-');

    return {
      address,
      colName: col.name,
      isCalculated: col.type === 'calculated',
      formulaText,
      value: valueStr,
    };
  }, [selectedCell, columns, rows, reconRows, viewDecimals, totalReceipts, totalDisposals]);

  const handleCellChange = (rowIndex: number, colKey: string, val: string) => {
    setRows(prev => {
      const copy = [...prev];
      if (!copy[rowIndex]) return prev;
      const updatedRow = { ...copy[rowIndex], values: { ...copy[rowIndex].values } };
      if (colKey === 'variant') {
        updatedRow.variant = val;
      }
      updatedRow.values[colKey] = val;
      copy[rowIndex] = updatedRow;
      return copy;
    });
  };

  const handleAddReceiptRow = () => {
    setRows(prev => [
      ...prev,
      { variant: '', row_type: 'RECEIPT', side: 'RECEIPT', values: {} }
    ]);
  };

  const handleAddDisposalRow = () => {
    setRows(prev => [
      ...prev,
      { variant: '', row_type: 'DISPOSAL', side: 'DISPOSAL', values: {} }
    ]);
  };

  // Safe Excel Formula Evaluator for Reconciliation Summary
  const evaluateReconFormula = (
    formulaStr: any,
    colKey: string,
    rIdx: number,
    reconList: STGReconRow[],
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

    // Cross-references to RECEIPTS and DISPOSALS
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
      const obRow = rows.find(r => (r.row_type === 'OB' || (r.variant || '').toLowerCase().includes('opening')));
      if (obRow) {
        const val = obRow.values?.[targetK];
        const num = parseFloat(String(val || 0));
        return String(isNaN(num) ? 0 : num);
      }
      return '0';
    });

    // Closing Balance references: CB or CB.col
    expr = expr.replace(/\bCB(?:\.([a-z_0-9]+))?\b/gi, (_, key) => {
      const targetK = (key || colKey).toLowerCase();
      const cbRow = rows.find(r => (r.row_type === 'DISPOSAL' && (r.variant || '').toLowerCase().includes('closing')));
      if (cbRow) {
        const val = cbRow.values?.[targetK];
        const num = parseFloat(String(val || 0));
        return String(isNaN(num) ? 0 : num);
      }
      const rec = recTotals[targetK] || 0;
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
        const evalSub = evaluateReconFormula(rawVal, cKey, targetRIdx, reconList, recTotals, dispTotals, depth + 1);
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
    const firstColKey = columns.filter(c => c.key !== 'variant')[0]?.key || 'qty_lts';
    setSelectedCell({ rowIndex: reconRows.length, colKey: firstColKey, isRecon: true });
    showToast(`➕ Added Reconciliation Row #${newIdx}`);
  };

  const handleDeleteReconRow = async (rIdx: number) => {
    const rowToDelete = reconRows[rIdx];
    const isConfirmed = await confirm({
      title: 'Delete Reconciliation Row',
      message: `Are you sure you want to delete row #${rIdx + 1} "${rowToDelete?.label || ''}"?`,
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;
    setReconRows(prev => prev.filter((_, idx) => idx !== rIdx));
    if (selectedCell?.isRecon && selectedCell.rowIndex === rIdx) {
      setSelectedCell(null);
    }
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
    if (selectedCell?.isRecon) {
      setSelectedCell({ ...selectedCell, rowIndex: targetIdx });
    }
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
      copy[rIdx] = {
        ...copy[rIdx],
        values: updatedVals,
      };
      return copy;
    });
  };

  const handleReconLabelChange = (rIdx: number, label: string) => {
    setReconRows(prev => {
      const copy = [...prev];
      if (!copy[rIdx]) return prev;
      copy[rIdx] = {
        ...copy[rIdx],
        label,
      };
      return copy;
    });
  };

  const handleReconColorChange = (rIdx: number, color: STGReconRow['color_hint']) => {
    setReconRows(prev => {
      const copy = [...prev];
      if (!copy[rIdx]) return prev;
      copy[rIdx] = {
        ...copy[rIdx],
        color_hint: color,
      };
      return copy;
    });
  };

  const handleResetReconTemplate = async () => {
    const isConfirmed = await confirm({
      title: 'Reset Reconciliation Summary Template',
      message: 'Reset reconciliation summary rows to the standard 8-row formulation template? Any custom formulas will be replaced.',
      confirmText: 'Reset to Standard',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!isConfirmed) return;
    setReconRows(getDefaultReconRows());
    showToast('Reset reconciliation summary to standard template.');
  };

  const handleMoveRow = (fromGlobalIdx: number, direction: 'UP' | 'DOWN', rowType: 'RECEIPT' | 'DISPOSAL') => {
    const list = rowType === 'RECEIPT' ? receiptRows : disposalRows;
    const currentListIdx = list.findIndex(r => r === rows[fromGlobalIdx]);
    if (currentListIdx === -1) return;
    if (direction === 'UP' && currentListIdx === 0) return;
    if (direction === 'DOWN' && currentListIdx === list.length - 1) return;

    const targetListIdx = direction === 'UP' ? currentListIdx - 1 : currentListIdx + 1;
    const targetItem = list[targetListIdx];
    const targetGlobalIdx = rows.findIndex(r => r === targetItem);
    if (targetGlobalIdx === -1) return;

    setRows(prev => {
      const copy = [...prev];
      const temp = copy[fromGlobalIdx];
      copy[fromGlobalIdx] = copy[targetGlobalIdx];
      copy[targetGlobalIdx] = temp;
      return copy;
    });
  };

  const handleDeleteRow = (globalIdx: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== globalIdx));
  };

  // Drag-fill start handler
  const handleFillDragStart = (e: React.MouseEvent, rowIndex: number, colKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFillDrag({ sourceRow: rowIndex, targetRow: rowIndex, colKey });

    const handleMouseMove = (moveEv: MouseEvent) => {
      const elem = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
      const cellElem = elem?.closest('td[data-row-index]');
      if (cellElem) {
        const hoverRowIdx = parseInt(cellElem.getAttribute('data-row-index') || '-1', 10);
        if (hoverRowIdx >= 0) {
          setFillDrag(prev => prev ? { ...prev, targetRow: hoverRowIdx } : null);
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setFillDrag(curr => {
        if (!curr || curr.sourceRow === curr.targetRow) return null;
        const { sourceRow, targetRow, colKey } = curr;
        const sourceRowObj = rows[sourceRow];
        const sourceVal = sourceRowObj?.values?.[colKey] ?? '';

        setRows(prev => {
          const copy = [...prev];
          const start = Math.min(sourceRow, targetRow);
          const end = Math.max(sourceRow, targetRow);
          for (let r = start; r <= end; r++) {
            if (r === sourceRow) continue;
            let finalVal = sourceVal;
            if (typeof sourceVal === 'string' && (sourceVal.startsWith('=') || sourceVal.startsWith('+'))) {
              finalVal = adjustFormulaRowOffset(sourceVal, sourceRow, r);
            }
            copy[r] = {
              ...copy[r],
              values: {
                ...(copy[r]?.values || {}),
                [colKey]: finalVal,
              },
            };
          }
          return copy;
        });
        return null;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Add / Edit Column Modal Handlers
  const handleOpenAddColumn = (insertAtIdx?: number) => {
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

  const handleOpenEditColumn = (col: STGColumnDef) => {
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
      showToast('❌ Please enter a Column Name');
      return;
    }

    const keyToUse = formColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!keyToUse) {
      showToast('❌ Please enter a valid Field Key');
      return;
    }

    if (!colModalEditingKey && columns.some(c => c.key === keyToUse)) {
      showToast(`❌ Column key "${keyToUse}" already exists! Please use a unique Field Key.`);
      return;
    }

    if (colModalEditingKey) {
      setColumns(prev => prev.map(c => c.key === colModalEditingKey ? {
        ...c,
        key: keyToUse,
        name: formColName.trim(),
        type: formColType,
        formula: formColType === 'calculated' ? formColFormula.trim() : undefined,
        unit: formColUnit.trim() || undefined,
        decimals: formColDecimals,
      } : c));

      if (colModalEditingKey !== keyToUse) {
        setRows(prev => prev.map(r => {
          const vals = { ...r.values };
          if (vals[colModalEditingKey] !== undefined) {
            vals[keyToUse] = vals[colModalEditingKey];
            delete vals[colModalEditingKey];
          }
          return { ...r, values: vals };
        }));
      }
      showToast(`Updated column "${formColName}"`);
    } else {
      const newCol: STGColumnDef = {
        key: keyToUse,
        name: formColName.trim(),
        type: formColType,
        formula: formColType === 'calculated' ? formColFormula.trim() : undefined,
        unit: formColUnit.trim() || undefined,
        decimals: formColDecimals,
        sort_order: columns.length + 1,
        is_active: true,
      };

      if (colModalInsertIdx !== null && colModalInsertIdx >= 0) {
        setColumns(prev => {
          const copy = [...prev];
          copy.splice(colModalInsertIdx, 0, newCol);
          return copy.map((c, i) => ({ ...c, sort_order: i + 1 }));
        });
      } else {
        setColumns(prev => [...prev, newCol]);
      }
      showToast(`Added new column "${newCol.name}" with key "${newCol.key}"`);
    }

    setIsColModalOpen(false);
  };

  const handleDeleteColumn = async (key: string) => {
    const colIdx = columns.findIndex(c => c.key === key);
    if (colIdx === -1) return;

    if (['variant', 'qty_lts', 'sp_gr', 'qty_kg', 'fat_pct', 'snf_pct', 'kg_fat', 'kg_snf'].includes(key)) {
      showWarning(`Column "${columns[colIdx]?.name}" is a core formulation column and cannot be deleted.`);
      return;
    }

    const isConfirmed = await confirm({
      title: 'Confirm Column Deletion',
      message: `Are you sure you want to delete column "${columns[colIdx]?.name}"?`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!isConfirmed) return;

    const filteredCols = columns.filter(c => c.key !== key).map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(filteredCols);

    setRows(prev => {
      return prev.map(row => {
        const updatedVals = { ...row.values };
        delete updatedVals[key];
        return { ...row, values: updatedVals };
      });
    });

    showToast(`Deleted column "${key}" locally. Click "⭐ Save Master Default Table" to save to database.`);
  };

  // Save Master Default Formulation Template & Columns
  const handleSaveDefaultTemplate = async () => {
    if (!activeMasterKey) return;
    setSaving(true);

    try {
      const recRows = rows.filter(r => r.row_type === 'RECEIPT' || r.side === 'RECEIPT');
      const dispRows = rows.filter(r => r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL');

      const updatedMasters = masters.map(m => {
        if (m.key === activeMasterKey) {
          return {
            ...m,
            receipt_rows: recRows,
            disposal_rows: dispRows,
            reconciliation_rows: reconRows,
            default_rows: rows,
            rows: rows.map(r => ({ variant: r.variant || r.values.variant || '', values: r.values, row_type: r.row_type || r.side, side: r.side || r.row_type })),
            custom_columns: columns,
          };
        }
        return m;
      });

      const [colRes, masterRes] = await Promise.all([
        fetch('/api/ts/columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columns }),
        }),
        fetch('/api/ts/masters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masters: updatedMasters }),
        }),
      ]);

      if (colRes.ok && masterRes.ok) {
        setMasters(updatedMasters);
        setTemplates(prev => ({
          ...prev,
          [activeMasterKey]: rows,
        }));
        showToast('✅ Master Default Formulation Table & columns saved successfully to database!');
      } else {
        showToast('❌ Failed to save default formulation table');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('❌ Server error saving default formulation table');
    }
    setSaving(false);
  };

  // Render a specific table section (Receipts or Disposals)
  const renderRowTable = (
    sectionType: 'RECEIPT' | 'DISPOSAL',
    sectionTitle: string,
    sectionList: STGRowData[],
    bgColor: string,
    accentColor: string,
    handleAddFn: () => void
  ) => {
    return (
      <div style={{ marginBottom: 24, border: `1px solid ${accentColor}40`, borderRadius: 8, overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Section Header */}
        <div style={{ background: bgColor, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${accentColor}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: accentColor }}>
              {sectionType === 'RECEIPT' ? '📥' : '📤'} {sectionTitle}
            </span>
            <span style={{ background: '#ffffff', border: `1px solid ${accentColor}60`, color: accentColor, borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>
              {sectionList.length} rows
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddFn}
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
            ➕ Add {sectionType === 'RECEIPT' ? 'Receipt' : 'Disposal'} Row
          </button>
        </div>

        {/* Section Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ width: '100%', minWidth: 700, margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 44, textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>#</th>
                <th style={{ width: 220, textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {sectionType === 'RECEIPT' ? 'Receipt Particular' : 'Disposal Particular'}
                </th>
                {columns.filter(c => c.key !== 'variant').map((col, cIdx) => (
                  <th
                    key={`col_th_${sectionType}_${col.key}`}
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
                      <span style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: 800, fontFamily: 'monospace' }}>
                        {getExcelColName(cIdx + 1)}
                      </span>
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
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    No {sectionTitle.toLowerCase()} added yet. Click "+ Add {sectionType === 'RECEIPT' ? 'Receipt' : 'Disposal'} Row" above.
                  </td>
                </tr>
              ) : (
                sectionList.map((row, listIdx) => {
                  const globalIdx = rows.findIndex(r => r === row);
                  if (globalIdx === -1) return null;

                  return (
                    <tr key={`row_${sectionType}_${globalIdx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', background: '#fafafa' }}>
                        {listIdx + 1}
                      </td>

                      {/* Particular / Variant Input */}
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={row.variant || row.values.variant || ''}
                          placeholder={sectionType === 'RECEIPT' ? 'Enter Receipt Particular...' : 'Enter Disposal Particular...'}
                          onChange={e => handleCellChange(globalIdx, 'variant', e.target.value)}
                          onFocus={() => {
                            setSelectedCell({ rowIndex: globalIdx, colKey: 'variant' });
                            setFocusedCell({ rowIndex: globalIdx, colKey: 'variant' });
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
                      {columns.filter(c => c.key !== 'variant').map((col) => {
                        const isCellSelected = selectedCell?.rowIndex === globalIdx && selectedCell?.colKey === col.key;
                        const isCellFocused = focusedCell?.rowIndex === globalIdx && focusedCell?.colKey === col.key;
                        const computedVal = computeCell(col, row.values, globalIdx, rows);

                        if (col.type === 'calculated') {
                          const formattedCalc = typeof computedVal === 'number'
                            ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '-')
                            : (computedVal || '-');

                          return (
                            <td
                              key={`calc_cell_${globalIdx}_${col.key}`}
                              onClick={() => setSelectedCell({ rowIndex: globalIdx, colKey: col.key })}
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: '#0369a1',
                                background: isCellSelected ? '#bae6fd' : '#f0f9ff',
                                fontFamily: 'var(--font-numbers)',
                                outline: isCellSelected ? '2px solid #0284c7' : 'none',
                                outlineOffset: -2,
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                padding: '4px 8px',
                              }}
                              title={`Cell ${col.name}: Click to view calculation`}
                            >
                              {formattedCalc}
                            </td>
                          );
                        }

                        const rawVal = row.values?.[col.key];
                        const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                        let displayVal = rawVal !== undefined ? rawVal : '';
                        if (isFormula && !isCellFocused) {
                          displayVal = typeof computedVal === 'number'
                            ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '-')
                            : (computedVal || '-');
                        }

                        return (
                          <td
                            key={`val_cell_${globalIdx}_${col.key}`}
                            data-row-index={globalIdx}
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
                                setSelectedCell({ rowIndex: globalIdx, colKey: col.key });
                                setFocusedCell({ rowIndex: globalIdx, colKey: col.key });
                              }}
                              onBlur={() => setFocusedCell(null)}
                              onClick={() => setSelectedCell({ rowIndex: globalIdx, colKey: col.key })}
                              onChange={e => handleCellChange(globalIdx, col.key, e.target.value)}
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

                            {/* Excel Fill Handle Square */}
                            {isCellSelected && (
                              <div
                                onMouseDown={e => handleFillDragStart(e, globalIdx, col.key)}
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
                                title="Excel Fill Handle: Drag up or down to auto-fill"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Row Action Buttons */}
                      <td style={{ textAlign: 'center', background: '#fafafa' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            type="button"
                            disabled={listIdx === 0}
                            onClick={() => handleMoveRow(globalIdx, 'UP', sectionType)}
                            style={{
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              cursor: listIdx === 0 ? 'not-allowed' : 'pointer',
                              opacity: listIdx === 0 ? 0.3 : 1,
                            }}
                            title="Move Row Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={listIdx === sectionList.length - 1}
                            onClick={() => handleMoveRow(globalIdx, 'DOWN', sectionType)}
                            style={{
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              cursor: listIdx === sectionList.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: listIdx === sectionList.length - 1 ? 0.3 : 1,
                            }}
                            title="Move Row Down"
                          >
                            ▼
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Subtotal Row */}
            {sectionList.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.75rem', color: '#64748b' }}>Σ</td>
                  <td style={{ fontWeight: 800, fontSize: '0.82rem', color: accentColor, padding: '6px 8px' }}>
                    Total {sectionTitle}
                  </td>
                  {columns.filter(c => c.key !== 'variant').map(col => {
                    const totalVal = sectionType === 'RECEIPT' ? totalReceipts[col.key] : totalDisposals[col.key];
                    return (
                      <td
                        key={`subtot_${sectionType}_${col.key}`}
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          color: accentColor,
                          padding: '6px 8px',
                          fontFamily: 'var(--font-numbers)',
                          background: '#f1f5f9',
                        }}
                      >
                        {totalVal !== undefined && totalVal !== 0 ? formatNumberValue(totalVal, col.decimals, col.key) : '-'}
                      </td>
                    );
                  })}
                  <td style={{ background: '#f8fafc' }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="daily-entry-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Master Default Formulation Tables (STG)"
        subtitle="Configure independent Receipt Rows and Disposal Rows, calculation columns, and default values matching Master Default Stock Statements."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setIsManageMastersModalOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ color: '#166534', borderColor: '#86efac', background: '#f0fdf4', fontWeight: 700 }}
              title="Show Statement Master Names with option to update, delete, and insert"
            >
              ⚙️ Statement Master Names ({masters.length})
            </button>
            <Link href="/dashboard/ts/manage-statements/columns" className="btn btn-secondary btn-sm" style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }}>
              ⚙️ Column Configuration
            </Link>
            <Link href="/dashboard/stock/new?step=stg" className="btn btn-secondary btn-sm">
              🧪 STG Entry
            </Link>
          </div>
        }
      />

      {toastMessage && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#1e293b', color: '#ffffff', padding: '10px 18px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.88rem', fontWeight: 600 }}>
          {toastMessage}
        </div>
      )}

      <div style={{ padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 12 }}>
        {/* Top Control Bar */}
        <div className="card" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
          {/* Master Switcher Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              STATEMENT MASTER:
            </span>

            <select
              className="form-input"
              value={activeMasterKey || ''}
              onChange={e => handleSwitchMaster(e.target.value)}
              disabled={loading || saving}
              style={{ fontWeight: 800, fontSize: '0.88rem', color: '#b45309', background: '#fffbeb', borderColor: '#fde68a', minWidth: 260, height: 34 }}
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
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                color: '#b45309',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Create a Brand New Statement Master Template"
            >
              ➕ Create New Statement Master
            </button>

            <button
              type="button"
              onClick={() => setIsManageMastersModalOpen(true)}
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#166534',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Show Statement Master Names with option to update, delete, and insert"
            >
              ⚙️ Statement Master Names ({masters.length})
            </button>
          </div>

          {/* Right Toolbar Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View Decimals Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Decimals:</span>
              {(['auto', 0, 1, 2, 3] as const).map(dec => (
                <button
                  key={`dec_${dec}`}
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

            <button
              type="button"
              onClick={() => handleOpenAddColumn()}
              style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ➕ Insert Column
            </button>

            <button
              type="button"
              onClick={() => setIsColEditing(!isColEditing)}
              style={{
                background: isColEditing ? '#e0f2fe' : '#ffffff',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isColEditing ? '⚙️ Done Editing' : '✏️ Edit Columns'}
            </button>

            <button
              type="button"
              onClick={handleAddReceiptRow}
              style={{ background: '#16a34a', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ➕ Add Receipt Row
            </button>

            <button
              type="button"
              onClick={handleAddDisposalRow}
              style={{ background: '#ea580c', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ➕ Add Disposal Row
            </button>

            <button
              type="button"
              onClick={handleAddReconRow}
              style={{ background: '#7c3aed', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ➕ Add Reconciliation Row
            </button>
          </div>
        </div>

        {/* Excel Formula Bar */}
        <div
          style={{
            padding: '8px 16px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
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
            }}
          >
            ƒx
          </div>

          <div style={{ height: 20, width: 1, background: '#fcd34d' }} />

          {/* Active Column Name & Formula Input */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
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
                {activeCellDetails.colName} {activeCellDetails.isCalculated ? '(Calculated)' : ''}
              </span>
            )}

            <input
              type="text"
              className="form-input"
              value={activeCellDetails.formulaText}
              readOnly={activeCellDetails.isCalculated}
              placeholder="Click any table cell to view or enter formulas/values..."
              onChange={e => {
                if (selectedCell && !activeCellDetails.isCalculated) {
                  if (selectedCell.isRecon) {
                    handleReconCellChange(selectedCell.rowIndex, selectedCell.colKey, e.target.value);
                  } else {
                    handleCellChange(selectedCell.rowIndex, selectedCell.colKey, e.target.value);
                  }
                }
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
                padding: '3px 10px',
                borderRadius: 6,
                background: '#ffffff',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              <span style={{ color: '#78350f' }}>Computed:</span>
              <span style={{ fontFamily: 'var(--font-numbers)', fontWeight: 800 }}>{activeCellDetails.value}</span>
            </div>
          )}
        </div>

        {/* Main Content Area - Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {/* Section 1: Receipts Table */}
          {renderRowTable(
            'RECEIPT',
            'Receipts',
            receiptRows,
            '#f0fdf4',
            '#166534',
            handleAddReceiptRow
          )}

          {/* Section 2: Disposals Table */}
          {renderRowTable(
            'DISPOSAL',
            'Disposals',
            disposalRows,
            '#fff7ed',
            '#c2410c',
            handleAddDisposalRow
          )}

          {/* Section 3: Stock Balance & Reconciliation Summary (Dynamic Formulation Table) */}
          <div style={{ marginBottom: 24, border: '1px solid #7c3aed40', borderRadius: 8, overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Section Header */}
            <div style={{ background: '#faf5ff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #7c3aed30' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#6b21a8' }}>
                  ⚖️ Stock Balance & Reconciliation Summary (Auto-Computed)
                </span>
                <span style={{ background: '#ffffff', border: '1px solid #d8b4fe', color: '#6b21a8', borderRadius: 12, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {reconRows.length} rows
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Reset to default 8 standard reconciliation formula rows"
                >
                  ↺ Load Standard Template
                </button>

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

            {/* Section Table */}
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
                    {columns.filter(c => c.key !== 'variant').map((col, cIdx) => (
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
                      <td colSpan={columns.length + 3} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
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
                          {/* Row Index */}
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
                          {columns.filter(c => c.key !== 'variant').map(col => {
                            const isCellSelected = selectedCell?.isRecon && selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;
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
                              computedVal = evaluateReconFormula(rawVal, col.key, rIdx, reconRows, totalReceipts, totalDisposals);
                            }

                            const displayFormatted = typeof computedVal === 'number'
                              ? (computedVal !== 0 ? formatNumberValue(computedVal, col.decimals, col.key) : '0')
                              : (computedVal || '-');

                            return (
                              <td
                                key={`recon_cell_${rIdx}_${col.key}`}
                                onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key, isRecon: true })}
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
                                      setSelectedCell({ rowIndex: rIdx, colKey: col.key, isRecon: true });
                                      setFocusedCell({ rowIndex: rIdx, colKey: col.key, isRecon: true });
                                    }}
                                    onBlur={() => setFocusedCell(null)}
                                    onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key, isRecon: true })}
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

                          {/* Row Action Buttons */}
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
              style={{
                background: '#b45309',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 18px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(180,83,9,0.2)',
              }}
            >
              {saving ? '💾 Saving Template...' : '⭐ Save Master Default Table'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Insert / Edit Column */}
      {isColModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 440, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 16, color: '#1e293b' }}>
              {colModalEditingKey ? '✏️ Edit Formulation Column' : '➕ Insert Formulation Column'}
            </div>

            <form onSubmit={handleSaveColumnModal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  Column Name (Display Label) *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formColName}
                  placeholder="e.g. SNF (Kg)"
                  onChange={e => {
                    setFormColName(e.target.value);
                    if (!colKeyManuallyEdited && !colModalEditingKey) {
                      setFormColKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
                    }
                  }}
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  Field Key (Internal Database Key) *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formColKey}
                  placeholder="e.g. snf_kg"
                  onChange={e => {
                    setColKeyManuallyEdited(true);
                    setFormColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  style={{ width: '100%', height: 32, fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                    Type
                  </label>
                  <select
                    className="form-input"
                    value={formColType}
                    onChange={e => setFormColType(e.target.value as any)}
                    style={{ width: '100%', height: 32 }}
                  >
                    <option value="number">Number (Input)</option>
                    <option value="calculated">Calculated (Formula)</option>
                    <option value="text">Text</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                    Decimals
                  </label>
                  <select
                    className="form-input"
                    value={formColDecimals !== undefined ? String(formColDecimals) : ''}
                    onChange={e => setFormColDecimals(e.target.value !== '' ? parseInt(e.target.value, 10) : undefined)}
                    style={{ width: '100%', height: 32 }}
                  >
                    <option value="">Auto</option>
                    <option value="0">.0 (Whole)</option>
                    <option value="1">.1 Dec</option>
                    <option value="2">.2 Decs</option>
                    <option value="3">.3 Decs</option>
                    <option value="4">.4 Decs</option>
                  </select>
                </div>
              </div>

              {formColType === 'calculated' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                    Default Formula (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formColFormula}
                    placeholder="e.g. qty_lts * sp_gr"
                    onChange={e => setFormColFormula(e.target.value)}
                    style={{ width: '100%', height: 32, fontFamily: 'monospace' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
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
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                >
                  {colModalEditingKey ? 'Update Column' : 'Save Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Statement Master Names (Update, Delete, Insert) */}
      {isManageMastersModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 880, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📊 Statement Master Names</span>
                  <span style={{ fontSize: '0.72rem', background: '#b45309', color: '#ffffff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    {masters.length} Masters
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: 2 }}>
                  Update, Delete, or Insert Statement Master Names for STG Formulation Tables
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageMastersModalOpen(false);
                  setEditingMasterKey(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#78350f', padding: '4px 8px' }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Subheader / Actions Bar */}
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  handleOpenNewMasterModal();
                }}
                className="btn btn-primary btn-sm"
                style={{ background: '#b45309', borderColor: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                ➕ Insert New Master Name
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Tip: Use <b>Edit</b> to rename, <b>Delete</b> to remove, or <b>View Table</b> to switch formulation.
                </span>
                <Link
                  href="/dashboard/ts/manage-statements"
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}
                >
                  ⚙️ Full Management Page ➔
                </Link>
              </div>
            </div>

            {/* Modal Body / Table */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <table className="inline-table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 40, textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>#</th>
                    <th style={{ textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>Statement Master Name</th>
                    <th style={{ width: 140, textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>Product / Variant</th>
                    <th style={{ width: 130, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>Formulation Rows</th>
                    <th style={{ width: 220, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m, idx) => {
                    const isEditing = editingMasterKey === m.key;
                    const isActive = activeMasterKey === m.key;
                    const totalRows = (m.receipt_rows?.length || 0) + (m.disposal_rows?.length || 0) || (templates[m.key]?.length || 0);

                    if (isEditing) {
                      return (
                        <tr key={`edit_${m.key}`} style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                          <td style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#b45309' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input
                                type="text"
                                className="form-input"
                                value={editMasterLabel}
                                onChange={e => setEditMasterLabel(e.target.value)}
                                placeholder="Statement Master Name"
                                style={{ width: '100%', height: 30, fontSize: '0.82rem', fontWeight: 700 }}
                              />
                              <input
                                type="text"
                                className="form-input"
                                value={editMasterDescription}
                                onChange={e => setEditMasterDescription(e.target.value)}
                                placeholder="Description (optional)"
                                style={{ width: '100%', height: 26, fontSize: '0.75rem' }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input
                              type="text"
                              className="form-input"
                              value={editMasterVariant}
                              onChange={e => setEditMasterVariant(e.target.value)}
                              placeholder="e.g. BUTTER MILK"
                              style={{ width: '100%', height: 30, fontSize: '0.82rem', fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                            {totalRows} rows
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={handleSaveEditMaster}
                                disabled={saving}
                                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
                              >
                                {saving ? 'Saving...' : '💾 Save'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={handleCancelEditMaster}
                              >
                                ✕ Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={m.key}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isActive ? '#f0fdf4' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                        }}
                      >
                        <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {cleanStatementLabel(m.label || m.name || m.key)}
                            </span>
                            {isActive && (
                              <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 10, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                            Key: {m.key} {m.description ? `• ${m.description}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                            {m.variant || (m as any).product_variant || 'DEFAULT'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                          📥 {(m.receipt_rows?.length || 0)} / 📤 {(m.disposal_rows?.length || 0)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleSelectAndClose(m.key)}
                              style={{ borderColor: '#0284c7', color: '#0284c7', background: '#f0f9ff', fontWeight: 700 }}
                              title="Switch to this Statement Master formulation table"
                            >
                              👁️ View Table
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleStartEditMaster(m)}
                              style={{ fontWeight: 700 }}
                              title="Edit / Rename Statement Master Name"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleDeleteMaster(m.key, m.label || m.name || m.key)}
                              disabled={masters.length <= 1}
                              style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2', fontWeight: 700 }}
                              title={masters.length <= 1 ? 'Cannot delete the only master' : 'Delete this Statement Master'}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Total Statement Masters: <b>{masters.length}</b>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsManageMastersModalOpen(false);
                  setEditingMasterKey(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Statement Master */}
      {isNewMasterModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 500, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 16, color: '#b45309' }}>
              ➕ Create New Statement Master Template
            </div>

            <form onSubmit={handleCreateNewMaster} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  Statement Master Name *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newMasterName}
                  placeholder="e.g. BUTTER MILK - RECEIPT AND DISPOSAL STATEMENT"
                  onChange={e => {
                    setNewMasterName(e.target.value);
                    if (!newMasterKeyManuallyEdited) {
                      const clean = cleanStatementLabel(e.target.value);
                      setNewMasterKey(clean.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
                    }
                  }}
                  style={{ width: '100%', height: 32 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  Field Key (Unique Identifier) *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newMasterKey}
                  placeholder="e.g. butter_milk"
                  onChange={e => {
                    setNewMasterKeyManuallyEdited(true);
                    setNewMasterKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  style={{ width: '100%', height: 32, fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  Initial Formulation Template Source
                </label>
                <select
                  className="form-input"
                  value={newMasterSource}
                  onChange={e => setNewMasterSource(e.target.value)}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
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
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  Create Master Template
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
    <Suspense fallback={<div className="p-8 text-center text-secondary">Loading Master Default Formulations...</div>}>
      <STGDefaultFormulationsContent />
    </Suspense>
  );
}
