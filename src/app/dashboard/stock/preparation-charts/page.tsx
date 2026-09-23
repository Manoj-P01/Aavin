'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Step, { DAILY_ENTRY_STEP_ITEMS } from '@/components/ui/Step';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MasterDetailLayout from '@/components/ui/MasterDetailLayout';
import type { ChartColumnDef, ChartMasterDef, ChartRowData, ChartEntryData } from '@/app/api/stock/preparation-charts/route';

export interface PreparationChartsProps {
  stepMode?: boolean;
  activeStep?: string;
  onStepChange?: (key: string) => void;
  onNextStep?: () => void;
  initialDate?: string;
  initialShift?: 'D' | 'N' | 'F' | string | null;
}

export default function PreparationChartsDashboardPage({
  stepMode = false,
  activeStep,
  onStepChange,
  onNextStep,
  initialDate,
  initialShift,
}: PreparationChartsProps = {}) {
  const router = useRouter();

  const [date, setDate] = useState<string>(() => initialDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'D' | 'N' | 'F'>(() => {
    if (initialShift === 'D' || initialShift === 'N' || initialShift === 'F') return initialShift;
    return 'F';
  });

  const [columns, setColumns] = useState<ChartColumnDef[]>([]);
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [activeChartKey, setActiveChartKey] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isTableEditing, setIsTableEditing] = useState<boolean>(false);
  const [isColumnEditing, setIsColumnEditing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [hasSavedEntryMap, setHasSavedEntryMap] = useState<Record<string, boolean>>({});

  const [productOptions, setProductOptions] = useState<string[]>([
    'RAW MILK',
    'FCM',
    'DELITE',
    'STD MILK',
    'SKIM MILK',
    'TONED MILK',
    'DOUBLE TONED MILK',
    'CREAM',
    'SMP',
    'WATER',
    'R.CON',
    'BUTTER MILK',
    'CURD',
  ]);

  useEffect(() => {
    async function loadProductsMaster() {
      try {
        const res = await fetch('/api/master/products');
        if (res.ok) {
          const json = await res.json();
          const prods = json.data || json.products || [];
          if (Array.isArray(prods) && prods.length > 0) {
            const names = prods.map((p: any) => p.short_name || p.product_name || p.full_name || p.key).filter(Boolean);
            setProductOptions(prev => Array.from(new Set([...names, ...prev])));
          }
        }
      } catch (e) {
        console.error('Error fetching products master:', e);
      }
    }
    loadProductsMaster();
  }, []);

  // Shift config from system settings
  const [shiftConfig, setShiftConfig] = useState<{
    mode: 'full_day' | 'shift';
    shifts: Array<{ key: 'D' | 'N'; label: string; start?: string; end?: string }>;
  }>({
    mode: 'full_day',
    shifts: [
      { key: 'D', label: 'Day Shift' },
      { key: 'N', label: 'Night Shift' },
    ],
  });

  // Per chart local state: templates, rows & target batch
  const [templates, setTemplates] = useState<Record<string, {
    rows: ChartRowData[];
    target_batch_liters?: number;
    target_fat?: number;
    target_snf?: number;
  }>>({});

  const [chartEntriesData, setChartEntriesData] = useState<Record<string, {
    rows: ChartRowData[];
    target_batch_liters?: number;
    target_fat?: number;
    target_snf?: number;
  }>>({});

  // Fetch Shift Configuration from System Settings
  useEffect(() => {
    async function loadShiftSettings() {
      try {
        const res = await fetch('/api/entries?report_type=STOCK');
        if (res.ok) {
          const json = await res.json();
          const entries: any[] = json.data || [];
          const configEntry = entries.find((e: any) => {
            if (!e.notes || e.notes.includes('__METADATA__:')) return false;
            try {
              const parsed = JSON.parse(e.notes);
              return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('mode' in parsed || 'shifts' in parsed);
            } catch { return false; }
          });
          let loadedMode: 'full_day' | 'shift' = 'full_day';
          let loadedShifts = [
            { key: 'D' as const, label: 'Day Shift' },
            { key: 'N' as const, label: 'Night Shift' },
          ];
          if (configEntry?.notes) {
            try {
              const parsed = JSON.parse(configEntry.notes);
              if (parsed && typeof parsed === 'object') {
                if (parsed.mode) loadedMode = parsed.mode;
                if (Array.isArray(parsed.shifts)) loadedShifts = parsed.shifts;
              }
            } catch (e) {
              console.error('Error parsing shift settings notes:', e);
            }
          }
          setShiftConfig({ mode: loadedMode, shifts: loadedShifts });

          if (loadedMode === 'full_day') {
            setShift('F');
          } else {
            setShift(prev => (prev === 'F' ? 'D' : prev));
          }
        }
      } catch (e) {
        console.error('Error fetching shift settings:', e);
      }
    }
    loadShiftSettings();
  }, []);

  // Fetch Config & Saved Entries from Supabase DB
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const activeShift = shiftConfig.mode === 'full_day' ? 'F' : shift;
      const res = await fetch(`/api/stock/preparation-charts?date=${date}&shift=${activeShift}`);
      if (res.ok) {
        const json = await res.json();
        const loadedCols: ChartColumnDef[] = json.columns || [];
        const loadedMasters: ChartMasterDef[] = json.masters || [];
        const loadedTemplates: Record<string, any> = json.templates || {};
        const loadedEntries: Record<string, ChartEntryData> = json.entries || {};

        setColumns(loadedCols);
        setMasters(loadedMasters);
        setTemplates(loadedTemplates);

        if (loadedMasters.length > 0 && (!activeChartKey || !loadedMasters.some(m => m.key === activeChartKey))) {
          setActiveChartKey(loadedMasters[0].key);
        } else if (loadedMasters.length === 0) {
          setActiveChartKey(null);
        }

        // Build local state per master chart strictly from DB JSON (No hardcoded values)
        const stateMap: Record<string, { rows: ChartRowData[]; target_batch_liters?: number; target_fat?: number; target_snf?: number }> = {};
        const entryExistsMap: Record<string, boolean> = {};

        loadedMasters.forEach(m => {
          const savedEntry = loadedEntries[m.key];
          const masterTemplate = loadedTemplates[m.key];
          entryExistsMap[m.key] = !!(savedEntry && Array.isArray(savedEntry.rows) && savedEntry.rows.length > 0);

          if (savedEntry && Array.isArray(savedEntry.rows) && savedEntry.rows.length > 0) {
            stateMap[m.key] = {
              rows: savedEntry.rows,
              target_batch_liters: savedEntry.target_batch_liters !== undefined ? savedEntry.target_batch_liters : m.target_batch_liters,
              target_fat: savedEntry.target_fat !== undefined ? savedEntry.target_fat : m.target_fat,
              target_snf: savedEntry.target_snf !== undefined ? savedEntry.target_snf : m.target_snf,
            };
          } else if (masterTemplate && Array.isArray(masterTemplate.rows) && masterTemplate.rows.length > 0) {
            stateMap[m.key] = {
              rows: masterTemplate.rows,
              target_batch_liters: masterTemplate.target_batch_liters !== undefined ? masterTemplate.target_batch_liters : m.target_batch_liters,
              target_fat: masterTemplate.target_fat !== undefined ? masterTemplate.target_fat : m.target_fat,
              target_snf: masterTemplate.target_snf !== undefined ? masterTemplate.target_snf : m.target_snf,
            };
          } else {
            stateMap[m.key] = {
              rows: [
                { variant: m.product_variant || 'Milk Variant', values: { variant: m.product_variant || 'Milk Variant' } }
              ],
              target_batch_liters: m.target_batch_liters,
              target_fat: m.target_fat,
              target_snf: m.target_snf,
            };
          }
        });

        setHasSavedEntryMap(entryExistsMap);
        setChartEntriesData(stateMap);
      }
    } catch (err) {
      console.error('Failed to load preparation charts data:', err);
    }
    setLoading(false);
  }, [date, shift, shiftConfig.mode, activeChartKey]);

  useEffect(() => {
    loadData();
    setIsTableEditing(false);
    setIsColumnEditing(false);
  }, [date, shift, loadData]);

  // Auto-redirect to Master Defaults page if requested via URL search query
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openDefaults') === 'true') {
        router.push('/dashboard/stock/preparation-charts/defaults');
      }
    }
  }, [router]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activeMaster = useMemo(() => {
    if (!activeChartKey) return null;
    return masters.find(m => m.key === activeChartKey) || null;
  }, [masters, activeChartKey]);

  const activeState = useMemo(() => {
    if (!activeMaster) return { rows: [], target_batch_liters: 0, target_fat: 0, target_snf: 0 };
    return chartEntriesData[activeMaster.key] || { rows: [], target_batch_liters: 0, target_fat: 0, target_snf: 0 };
  }, [chartEntriesData, activeMaster]);

  // Update a single cell in active chart row
  const handleCellChange = (rowIndex: number, colKey: string, rawVal: any) => {
    if (!activeMaster) return;

    setChartEntriesData(prev => {
      const chartData = prev[activeMaster.key] || { rows: [] };
      const newRows = [...chartData.rows];
      const targetRow = { ...newRows[rowIndex] };
      const newVals = { ...targetRow.values, [colKey]: rawVal };
      targetRow.values = newVals;
      newRows[rowIndex] = targetRow;

      return {
        ...prev,
        [activeMaster.key]: {
          ...chartData,
          rows: newRows,
        },
      };
    });
  };

  // Update target batch liters for active chart
  const handleTargetBatchChange = (val: string) => {
    if (!activeMaster) return;
    const numVal = val !== '' ? parseFloat(val) : undefined;
    setChartEntriesData(prev => ({
      ...prev,
      [activeMaster.key]: {
        ...(prev[activeMaster.key] || { rows: [] }),
        target_batch_liters: numVal,
      },
    }));
  };

  // Add or insert row in active chart
  const handleAddRow = (insertIndex?: number) => {
    if (!activeMaster) return;

    if (!isTableEditing) {
      setIsTableEditing(true);
      setIsColumnEditing(false);
    }

    setChartEntriesData(prev => {
      const chartData = prev[activeMaster.key] || { rows: [] };
      const newRow: ChartRowData = {
        variant: 'New Ingredient',
        values: { variant: 'New Ingredient' },
      };
      const newRows = [...chartData.rows];
      if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= newRows.length) {
        newRows.splice(insertIndex, 0, newRow);
      } else {
        newRows.push(newRow);
      }
      return {
        ...prev,
        [activeMaster.key]: {
          ...chartData,
          rows: newRows,
        },
      };
    });
  };

  // Move row up or down in active chart
  const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
    if (!activeMaster) return;

    setChartEntriesData(prev => {
      const chartData = prev[activeMaster.key] || { rows: [] };
      const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
      if (targetIndex < 0 || targetIndex >= chartData.rows.length) return prev;

      const newRows = [...chartData.rows];
      const temp = newRows[rowIndex];
      newRows[rowIndex] = newRows[targetIndex];
      newRows[targetIndex] = temp;

      return {
        ...prev,
        [activeMaster.key]: {
          ...chartData,
          rows: newRows,
        },
      };
    });
  };

  // Delete row from active chart
  const handleDeleteRow = (rowIndex: number) => {
    if (!activeMaster) return;

    setChartEntriesData(prev => {
      const chartData = prev[activeMaster.key] || { rows: [] };
      const newRows = chartData.rows.filter((_, i) => i !== rowIndex);
      return {
        ...prev,
        [activeMaster.key]: {
          ...chartData,
          rows: newRows,
        },
      };
    });
  };

  // Selected cell state for Excel Formula Bar
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);

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

  // Adjusts Excel formula row references when dragging up/down (e.g. B1*C1 on row 0 dragged to row 1 becomes B2*C2)
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

  // Excel Drag-to-Fill (Fill Handle) state & effect
  const [fillDrag, setFillDrag] = useState<{
    sourceRow: number;
    targetRow: number;
    colKey: string;
    isModal: boolean;
  } | null>(null);

  const handleFillDragStart = (e: React.MouseEvent, rowIndex: number, colKey: string, isModal: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    setFillDrag({
      sourceRow: rowIndex,
      targetRow: rowIndex,
      colKey,
      isModal,
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
        const { sourceRow, targetRow, colKey, isModal } = fillDrag;
        if (sourceRow !== targetRow) {
          const minRow = Math.min(sourceRow, targetRow);
          const maxRow = Math.max(sourceRow, targetRow);

          if (activeMaster) {
            setChartEntriesData(prev => {
              const chartData = prev[activeMaster.key] || { rows: [] };
              const newRows = [...chartData.rows];
              const sourceVal = newRows[sourceRow]?.values?.[colKey];
              for (let r = minRow; r <= maxRow; r++) {
                if (r === sourceRow) continue;
                const rData = { ...newRows[r] };
                const vals = { ...rData.values };
                let valToSet: any = sourceVal;
                if (typeof sourceVal === 'string' && (sourceVal.startsWith('=') || sourceVal.startsWith('+'))) {
                  valToSet = adjustFormulaRowOffset(sourceVal, sourceRow, r);
                }
                vals[colKey] = valToSet;
                rData.values = vals;
                const col = columns.find(c => c.key === colKey);
                if (col?.type === 'text') rData.variant = valToSet;
                newRows[r] = rData;
              }
              return {
                ...prev,
                [activeMaster.key]: {
                  ...chartData,
                  rows: newRows,
                },
              };
            });
          }
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
  }, [fillDrag, activeMaster, columns]);

  // Modal State for Adding / Editing Columns directly from table
  const [isColModalOpen, setIsColModalOpen] = useState<boolean>(false);
  const [colModalInsertIdx, setColModalInsertIdx] = useState<number | null>(null);
  const [colModalEditingKey, setColModalEditingKey] = useState<string | null>(null);

  const [formColKey, setFormColKey] = useState<string>('');
  const [formColName, setFormColName] = useState<string>('');
  const [formColType, setFormColType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formColFormula, setFormColFormula] = useState<string>('');
  const [formColUnit, setFormColUnit] = useState<string>('');

  const handleOpenAddColumn = (insertIdx?: number) => {
    setColModalEditingKey(null);
    setColModalInsertIdx(insertIdx !== undefined ? insertIdx : columns.length);
    setFormColKey('');
    setFormColName('');
    setFormColType('number');
    setFormColFormula('');
    setFormColUnit('');
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
    setIsColModalOpen(true);
  };

  const saveColumnsToApi = async (colsToSave: ChartColumnDef[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: colsToSave }),
      });
      if (res.ok) {
        showToast(`✅ ${successMsg}`);
      } else {
        showToast('❌ Failed to save column updates');
      }
    } catch (err) {
      console.error('Error saving columns:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  const handleSaveColumnModal = async (e: React.FormEvent) => {
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

    // Re-index sort order
    const reindexedCols = updatedCols.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(reindexedCols);
    setIsColModalOpen(false);

    // If a column was inserted, shift formula references across all chart entries in local state and master modal rows
    if (shiftAction && targetShiftIdx !== null) {
      const shiftedIdx = targetShiftIdx;
      setChartEntriesData(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(chartKey => {
          const chartData = next[chartKey];
          if (chartData && Array.isArray(chartData.rows)) {
            const updatedRows = chartData.rows.map(row => {
              const updatedVals = { ...row.values };
              Object.keys(updatedVals).forEach(vk => {
                const val = updatedVals[vk];
                if (typeof val === 'string' && (val.startsWith('=') || val.startsWith('+'))) {
                  updatedVals[vk] = shiftExcelFormulaReferences(val, 'insert', shiftedIdx);
                }
              });
              return { ...row, values: updatedVals };
            });
            next[chartKey] = { ...chartData, rows: updatedRows };
          }
        });
        return next;
      });


    }

    await saveColumnsToApi(reindexedCols, colModalEditingKey ? `Updated column "${newCol.name}"` : `Inserted column "${newCol.name}"`);
  };

  const handleDeleteColumnInline = async (key: string, colIdx: number) => {
    if (columns.length <= 1) {
      alert('Cannot delete the last remaining column.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete column "${columns[colIdx]?.name}"?`)) return;

    const filteredCols = columns.filter(c => c.key !== key).map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(filteredCols);

    // Shift formulas for deleted column index
    setChartEntriesData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(chartKey => {
        const chartData = next[chartKey];
        if (chartData && Array.isArray(chartData.rows)) {
          const updatedRows = chartData.rows.map(row => {
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
          next[chartKey] = { ...chartData, rows: updatedRows };
        }
      });
      return next;
    });



    await saveColumnsToApi(filteredCols, `Deleted column "${key}"`);
  };

  // Safe Excel Formula Evaluator supporting Cell Ranges (e.g. SUM(D2:D7), D2:D7) and Math/Excel functions (SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS)
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

    const rowList = rowsContext || activeState.rows || [];

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

    // 2. Replace Excel Cell References like A1, B1, C2, D1 with numeric values (resolving nested formulas recursively)
    expr = expr.replace(/([A-Z]+)([0-9]+)/gi, (match, colLetters, rowNumStr) => {
      let colIdx = 0;
      const upperLetters = colLetters.toUpperCase();
      for (let i = 0; i < upperLetters.length; i++) {
        colIdx = colIdx * 26 + (upperLetters.charCodeAt(i) - 64);
      }
      colIdx = colIdx - 1; // 0-indexed column index

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

      // If rawVal itself is a formula (e.g. "=A1*B1"), evaluate it recursively
      if (typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'))) {
        const evaluatedTarget = evaluateExcelFormula(rawVal, targetRowIdx, targetVals, rowList, depth + 1);
        return String(evaluatedTarget);
      }

      // If targetCol is a calculated type column without direct value
      if (targetCol.type === 'calculated') {
        const computedTarget = computeCell(targetCol, targetVals, targetRowIdx, rowList);
        const numVal = typeof computedTarget === 'number' ? computedTarget : parseFloat(String(computedTarget || 0));
        return isNaN(numVal) ? '0' : String(numVal);
      }

      const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
      return isNaN(numVal) ? '0' : String(numVal);
    });

    // 3. Replace column key identifiers like qty_lit, sp_gr, qty_kg, fat_pct, snf_pct with values
    columns.forEach(col => {
      if (expr.includes(col.key)) {
        const rawVal = rowVals[col.key];
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0));
        expr = expr.replaceAll(col.key, String(isNaN(numVal) ? 0 : numVal));
      }
    });

    // 4. Safely evaluate expression with Excel Math Functions
    try {
      let cleanExpr = expr.replace(/[^0-9.\-+\/*%() ,a-zA-Z]/g, '').trim();
      // Remove trailing operators or commas: e.g. "0*0/" -> "0*0", "1+2+" -> "1+2", "1," -> "1"
      cleanExpr = cleanExpr.replace(/[\-+\/*%,]+$/g, '').trim();
      if (!cleanExpr) return 0;

      // Auto-balance opening parentheses if user is currently typing e.g. "SUM(10, 20"
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

  // Computed row values helper supporting custom Excel cell formulas
  const computeCell = (col: ChartColumnDef, rowVals: Record<string, any>, rowIndex: number = 0, rowsContext?: ChartRowData[]) => {
    const rList = rowsContext || activeState.rows || [];
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

  // Active cell Excel Coordinate (e.g. "B1", "C2") & formula details for Main Chart
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

    const currentRow = (activeState.rows || [])[selectedCell.rowIndex] || { values: {} };
    const rowVals = currentRow.values || {};

    let formulaText = '';
    const computedVal = computeCell(col, rowVals, selectedCell.rowIndex, activeState.rows);

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
      ? (computedVal !== 0 ? computedVal.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '-')
      : (computedVal || '-');

    return {
      address,
      colName: col.name,
      isCalculated: col.type === 'calculated',
      formulaText,
      value: formattedValDisplay,
    };
  }, [selectedCell, columns, activeState]);



  // Calculated totals for active chart (Strictly based on DB JSON values without hardcoded numbers)
  const totals = useMemo(() => {
    let totalQtyLit = 0;
    let totalQtyKg = 0;
    let totalKgFat = 0;
    let totalKgSnf = 0;

    (activeState.rows || []).forEach((r, rIdx) => {
      const vals = r.values || {};
      const qtyLitCol = columns.find(c => c.key === 'qty_lit') || { key: 'qty_lit', name: 'Qty (Lit)', type: 'number', sort_order: 1 };
      const spGrCol = columns.find(c => c.key === 'sp_gr') || { key: 'sp_gr', name: 'Sp.gr', type: 'number', sort_order: 2 };
      const qtyKgCol = columns.find(c => c.key === 'qty_kg') || { key: 'qty_kg', name: 'Qty (Kg)', type: 'calculated', sort_order: 3 };
      const fatPctCol = columns.find(c => c.key === 'fat_pct') || { key: 'fat_pct', name: 'Fat%', type: 'number', sort_order: 4 };
      const snfPctCol = columns.find(c => c.key === 'snf_pct') || { key: 'snf_pct', name: 'SNF%', type: 'number', sort_order: 5 };
      const kgFatCol = columns.find(c => c.key === 'kg_fat') || { key: 'kg_fat', name: 'Kg Fat', type: 'calculated', sort_order: 6 };
      const kgSnfCol = columns.find(c => c.key === 'kg_snf') || { key: 'kg_snf', name: 'Kg SNF', type: 'calculated', sort_order: 7 };

      const qtyLit = parseFloat(String(computeCell(qtyLitCol, vals, rIdx) || 0));
      const qtyKg = parseFloat(String(computeCell(qtyKgCol, vals, rIdx) || 0));
      const kgFat = parseFloat(String(computeCell(kgFatCol, vals, rIdx) || 0));
      const kgSnf = parseFloat(String(computeCell(kgSnfCol, vals, rIdx) || 0));

      totalQtyLit += isNaN(qtyLit) ? 0 : qtyLit;
      totalQtyKg += isNaN(qtyKg) ? 0 : qtyKg;
      totalKgFat += isNaN(kgFat) ? 0 : kgFat;
      totalKgSnf += isNaN(kgSnf) ? 0 : kgSnf;
    });

    const actualFatPct = totalQtyKg > 0 ? (totalKgFat / totalQtyKg) * 100 : 0;
    const actualSnfPct = totalQtyKg > 0 ? (totalKgSnf / totalQtyKg) * 100 : 0;
    const actualSpGr = totalQtyLit > 0 ? totalQtyKg / totalQtyLit : 0;

    const targetLit = activeState.target_batch_liters !== undefined ? activeState.target_batch_liters : (activeMaster?.target_batch_liters || 0);
    const targetSpGr = activeMaster?.target_sp_gr || 0;
    const targetKg = targetLit * targetSpGr;
    const targetFatPct = activeState.target_fat !== undefined && activeState.target_fat !== null ? activeState.target_fat : (activeMaster?.target_fat || 0);
    const targetSnfPct = activeState.target_snf !== undefined && activeState.target_snf !== null ? activeState.target_snf : (activeMaster?.target_snf || 0);

    const targetKgFat = (targetKg * targetFatPct) / 100;
    const targetKgSnf = (targetKg * targetSnfPct) / 100;

    const diffKgFat = totalKgFat - targetKgFat;
    const diffKgSnf = totalKgSnf - targetKgSnf;

    return {
      totalQtyLit,
      totalQtyKg,
      totalKgFat,
      totalKgSnf,
      actualFatPct,
      actualSnfPct,
      actualSpGr,
      targetLit,
      targetSpGr,
      targetKg,
      targetFatPct,
      targetSnfPct,
      targetKgFat,
      targetKgSnf,
      diffKgFat,
      diffKgSnf,
    };
  }, [activeState, activeMaster]);

  // Save active chart entry
  const handleSaveChart = async () => {
    if (!activeMaster) return;
    setSaving(true);

    try {
      const activeShift = shiftConfig.mode === 'full_day' ? 'F' : shift;
      const entryPayload = {
        chart_key: activeMaster.key,
        entry_date: date,
        shift: activeShift,
        rows: activeState.rows,
        target_batch_liters: activeState.target_batch_liters,
        target_fat: activeState.target_fat,
        target_snf: activeState.target_snf,
      };

      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: entryPayload }),
      });

      if (res.ok) {
        showToast(`✅ Saved ${activeMaster.name} for ${date} (${activeShift === 'F' ? 'Full Day' : activeShift === 'D' ? 'Day' : 'Night'})`);
      } else {
        showToast('❌ Failed to save chart entry');
      }
    } catch (err) {
      console.error('Save chart error:', err);
      showToast('❌ Server error saving chart');
    }
    setSaving(false);
  };

  // Save active chart as Master Default Template in DB
  const handleSaveAsMasterTemplate = async () => {
    if (!activeMaster) return;
    setSaving(true);

    try {
      const templatePayload = {
        chart_key: activeMaster.key,
        rows: activeState.rows,
        target_batch_liters: activeState.target_batch_liters,
        target_fat: activeState.target_fat,
        target_snf: activeState.target_snf,
      };

      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templatePayload }),
      });

      if (res.ok) {
        setTemplates(prev => ({
          ...prev,
          [activeMaster.key]: templatePayload,
        }));
        showToast(`⭐ Saved "${activeMaster.name}" as Default Master Template! All un-entered days will inherit this default formulation.`);
      } else {
        showToast('❌ Failed to save default master template');
      }
    } catch (err) {
      console.error('Save master template error:', err);
      showToast('❌ Server error saving master template');
    }
    setSaving(false);
  };

  const handleProceedToStockEntry = async () => {
    if (isTableEditing) {
      await handleSaveChart();
    }
    if (stepMode && onNextStep) {
      onNextStep();
    } else if (stepMode && onStepChange) {
      onStepChange('stock');
    } else {
      router.push(`/dashboard/stock/new?date=${date}&shift=${shift}`);
    }
  };

  const dayShiftLabel = shiftConfig.shifts.find(s => s.key === 'D')?.label || 'Day';
  const nightShiftLabel = shiftConfig.shifts.find(s => s.key === 'N')?.label || 'Night';

  return (
    <>
      <Header
        title="Milk & Cream Preparation Charts"
        subtitle="Prepare, formulate & calculate batch parameters prior to Stock Statement Entry"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleProceedToStockEntry}>
              ➡️ Save & Proceed to Stock Statement Entry
            </button>
          </div>
        }
      >
        {stepMode && (
          <Step
            items={DAILY_ENTRY_STEP_ITEMS}
            flat={true}
            activeStep={activeStep || 'prep'}
            onStepClick={(key) => {
              if (onStepChange) onStepChange(key);
            }}
            style={{ marginBottom: 0, marginTop: 4 }}
          />
        )}
      </Header>

      <div className="page-body animate-fade-in">
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
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Date, Shift Filter & Master/Column Config Header Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>📅 Entry Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{ width: 170 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>🕒 Shift:</label>
                {shiftConfig.mode === 'full_day' ? (
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #bae6fd',
                    }}
                  >
                    🗓️ Full Day
                  </span>
                ) : (
                  <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, gap: 3 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${shift === 'D' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setShift('D')}
                      style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      ☀️ {dayShiftLabel}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${shift === 'N' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setShift('N')}
                      style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      🌙 {nightShiftLabel}
                    </button>
                  </div>
                )}
              </div>

              {/* Separated ⭐ Master Default Formulations button inside Entry Date block */}
              <Link
                href="/dashboard/stock/preparation-charts/defaults"
                className="btn btn-secondary btn-sm"
                style={{ color: '#b45309', borderColor: '#fde68a', background: '#fffbeb', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                title="Create, view & edit default formulation chart tables stored in database"
              >
                ⭐ Master Default Formulations
              </Link>
            </div>

            {/* Repositioned Chart Master Names and Edit Columns / Formulation Buttons */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className={`btn btn-sm ${isColumnEditing ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setIsColumnEditing(prev => !prev);
                  setIsTableEditing(false);
                }}
                style={{ color: isColumnEditing ? '#ffffff' : '#0284c7', borderColor: '#bae6fd', background: isColumnEditing ? '#0284c7' : '#ffffff', fontWeight: 700 }}
                title="Toggle Column Editing (+L, +R, ✏️, ✕)"
              >
                ⚙️ Edit Columns
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isTableEditing ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setIsTableEditing(prev => !prev);
                  setIsColumnEditing(false);
                }}
                style={{ color: isTableEditing ? '#ffffff' : '#0369a1', borderColor: '#bae6fd', background: isTableEditing ? '#0369a1' : '#ffffff', fontWeight: 700 }}
                title="Toggle Table Data Editing"
              >
                ✏️ Edit Formulation Table
              </button>
              <Link href="/dashboard/stock/preparation-charts/masters" className="btn btn-secondary btn-sm" title="Manage Chart Master Names">
                📊 Chart Master Names
              </Link>
            </div>
          </div>
        </div>

        {/* ─── REUSABLE MASTER-DETAIL LAYOUT ────────────────────────────────────────── */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner" /> Loading preparation chart formulation engine...
          </div>
        ) : masters.length === 0 ? (
          <div className="card" style={{ padding: 45, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 6 }}>
              No Preparation Charts Configured in Database
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Create your chart master names (e.g., DELITE PREPARATION CHART, FCM PREPARATION CHART) from the Chart Master Names configuration page.
            </div>
            <Link href="/dashboard/stock/preparation-charts/masters" className="btn btn-primary btn-sm">
              📊 Open Chart Master Names Configuration
            </Link>
          </div>
        ) : (
          <MasterDetailLayout<ChartMasterDef>
            items={masters}
            getItemKey={m => m.key}
            selectedKey={activeChartKey}
            onSelectKey={key => {
              setActiveChartKey(key);
              setIsTableEditing(false);
              setIsColumnEditing(false);
            }}
            leftPanelTitle="📋 Select Preparation Chart"
            leftPanelWidth={340}
            searchPlaceholder="🔍 Search chart name or variant..."
            filterPredicate={(m, q) =>
              m.name.toLowerCase().includes(q) ||
              (m.product_variant || '').toLowerCase().includes(q) ||
              (m.description || '').toLowerCase().includes(q)
            }
            emptyListMessage="No preparation charts matching search"
            emptyDetailMessage="Select a Preparation Chart from the left panel to display formulation batch details"
            headerExtra={
              <Link
                href="/dashboard/stock/preparation-charts/masters"
                style={{ fontSize: '0.72rem', color: 'var(--brand-primary)', fontWeight: 700, textDecoration: 'none' }}
                title="Manage or add new Chart Names"
              >
                ⚙️ Manage
              </Link>
            }
            renderListItem={(m, isSelected) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📋 {m.name}</span>
                    {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />}
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: isSelected ? '#0284c7' : '#e2e8f0',
                      color: isSelected ? '#ffffff' : '#475569',
                    }}
                  >
                    {m.product_variant || 'DEFAULT'}
                  </span>
                </div>
              </div>
            )}
            renderDetail={selectedMaster => {
              if (!selectedMaster) return null;

              const qtyLitIdx = columns.findIndex(c => c.key === 'qty_lit');
              const labelColSpan = qtyLitIdx >= 0 ? qtyLitIdx + 1 : (columns.length > 0 && columns[0].type === 'text' ? 2 : 1);
              const summaryCols = qtyLitIdx >= 0 ? columns.slice(qtyLitIdx) : (columns.length > 0 && columns[0].type === 'text' ? columns.slice(1) : columns);

              return (
                <div className="card" style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {/* Header Banner with Edit / Read-Only controls */}
                  <div style={{
                    padding: '14px 20px',
                    background: isColumnEditing
                      ? 'linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)'
                      : isTableEditing
                        ? 'linear-gradient(90deg, #fefce8 0%, #fef9c3 100%)'
                        : 'linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <div>
                      <div style={{
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        color: isColumnEditing ? '#166534' : isTableEditing ? '#854d0e' : '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                      }}>
                        <span>📋 {selectedMaster.name}</span>
                        {hasSavedEntryMap[selectedMaster.key] ? (
                          <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }} title={`Saved entry for ${date}`}>
                            📄 SAVED DATE ENTRY
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }} title="Inheriting Master Default formulation from database">
                            ⭐ MASTER DEFAULT (Inherited)
                          </span>
                        )}
                        {isColumnEditing ? (
                          <span style={{ fontSize: '0.72rem', background: '#bbf7d0', color: '#166534', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                            ⚙️ EDIT COLUMNS MODE
                          </span>
                        ) : isTableEditing ? (
                          <span style={{ fontSize: '0.72rem', background: '#fef08a', color: '#854d0e', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                            ✏️ FORMULATION TABLE EDIT MODE
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                            🔒 READ ONLY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {selectedMaster.description || 'Milk & Cream batch calculation table'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {isColumnEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsColumnEditing(false)}
                          >
                            ✕ Exit Column Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setIsColumnEditing(false);
                              showToast('✅ Column structure editing completed');
                            }}
                            style={{ background: '#166534', borderColor: '#166534' }}
                          >
                            ✓ Done Editing Columns
                          </button>
                        </>
                      ) : isTableEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setIsTableEditing(false);
                              loadData();
                            }}
                          >
                            ✕ Cancel Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              await handleSaveChart();
                              setIsTableEditing(false);
                            }}
                            disabled={saving}
                            style={{ background: '#0284c7', borderColor: '#0284c7' }}
                          >
                            {saving ? 'Saving...' : `💾 Save Formulation (${date})`}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setIsColumnEditing(true);
                              setIsTableEditing(false);
                            }}
                            style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#ffffff', fontWeight: 700 }}
                          >
                            ⚙️ Edit Columns
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setIsTableEditing(true);
                              setIsColumnEditing(false);
                            }}
                            style={{ background: '#0284c7', borderColor: '#0284c7' }}
                          >
                            ✏️ Edit Formulation Table
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Excel Formula Bar (fx) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 16px',
                      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Cell Address Indicator (e.g., B2, D1) */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#ffffff',
                        border: '1px solid #0284c7',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: '#0284c7',
                        minWidth: 55,
                        textAlign: 'center',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        fontFamily: 'monospace',
                      }}
                      title="Excel Cell Address (Column Letter + Row Number)"
                    >
                      {activeCellDetails.address}
                    </div>

                    {/* fx Symbol */}
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
                      title="Excel Formula Indicator"
                    >
                      <span>ƒx</span>
                    </div>

                    <div style={{ height: 20, width: 1, background: '#cbd5e1' }} />

                    {/* Active Column Name & Formula Input */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
                      {activeCellDetails.colName && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: '#e0f2fe',
                            color: '#0369a1',
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
                        disabled={!isTableEditing || !selectedCell}
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
                        placeholder={selectedCell ? "Enter value or formula e.g. =+B1*A1" : "Click any cell in the table below to inspect or enter formula"}
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          background: isTableEditing ? '#ffffff' : '#f8fafc',
                          color: activeCellDetails.formulaText.startsWith('=') ? '#0369a1' : 'var(--text-primary)',
                          borderColor: selectedCell ? '#0284c7' : 'var(--border)',
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
                          border: '1px solid #bae6fd',
                          color: '#0369a1',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: '#64748b' }}>Value:</span>
                        <span style={{ fontFamily: 'var(--font-numbers)', fontWeight: 800 }}>{activeCellDetails.value}</span>
                      </div>
                    )}
                  </div>

                  {/* Matrix Table */}
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh' }}>
                    <table className="inline-table" style={{ width: '100%', minWidth: 800 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ width: 40, textAlign: 'center' }}>#</th>
                          {columns.map((col, cIdx) => (
                            <th
                              key={col.key}
                              style={{
                                textAlign: col.type === 'text' ? 'left' : 'right',
                                background: col.type === 'calculated' ? '#e0f2fe' : '#f8fafc',
                                color: col.type === 'calculated' ? '#0369a1' : 'var(--text-primary)',
                                fontWeight: 700,
                                padding: '8px 10px',
                                minWidth: 110,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 4 }}>
                                <span style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: 800, fontFamily: 'monospace', letterSpacing: 0.5 }}>
                                  {getExcelColName(cIdx)}
                                </span>
                                {isColumnEditing && (
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
                                      title="Edit Column Details"
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
                              <div>
                                {col.name} {col.unit ? `(${col.unit})` : ''}
                              </div>
                            </th>
                          ))}
                          {isColumnEditing && (
                            <th style={{ width: 150, textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                                <span>Actions</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddColumn()}
                                  style={{ background: '#f0f9ff', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                  title="Add New Column at End"
                                >
                                  ➕ Column
                                </button>
                              </div>
                            </th>
                          )}
                          {isTableEditing && (
                            <th style={{ width: 150, textAlign: 'center' }}>
                              Row Actions
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {(activeState.rows || []).map((row, rIdx) => (
                          <tr key={`row_${rIdx}`}>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem' }}>
                              {rIdx + 1}
                            </td>

                            {columns.map((col, cIdx) => {
                              const isCalc = col.type === 'calculated';
                              const computedVal = computeCell(col, row.values || {}, rIdx, activeState.rows);
                              const isCellSelected = selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;
                              const isCellFocused = focusedCell?.rowIndex === rIdx && focusedCell?.colKey === col.key;

                              const rawVal = row.values?.[col.key];
                              const isFormula = typeof rawVal === 'string' && (rawVal.startsWith('=') || rawVal.startsWith('=+'));
                              const displayVal = isFormula && !isCellFocused
                                ? (typeof computedVal === 'number' ? (computedVal !== 0 ? computedVal.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '-') : String(computedVal || '-'))
                                : (rawVal !== undefined ? rawVal : '');

                              if (isCalc) {
                                const formattedCalc = typeof computedVal === 'number'
                                  ? (computedVal !== 0 ? computedVal.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '-')
                                  : (computedVal || '-');

                                return (
                                  <td
                                    key={`cell_${rIdx}_${col.key}`}
                                    onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key })}
                                    style={{
                                      textAlign: 'right',
                                      fontFamily: 'var(--font-numbers)',
                                      fontWeight: 700,
                                      background: isCellSelected ? '#bae6fd' : '#f0f9ff',
                                      color: col.key === 'kg_fat' ? '#047857' : col.key === 'kg_snf' ? '#b45309' : '#0369a1',
                                      outline: isCellSelected ? '2px solid #0284c7' : 'none',
                                      outlineOffset: -2,
                                      cursor: 'pointer',
                                    }}
                                    title={`Cell ${getExcelColName(cIdx)}${rIdx + 1} (${col.name}): Click to view formula (${activeCellDetails.formulaText})`}
                                  >
                                    {formattedCalc}
                                  </td>
                                );
                              }

                               if (col.type === 'text') {
                                return (
                                  <td key={`cell_${rIdx}_${col.key}`}>
                                    <input
                                      type="text"
                                      list="variant-products-list"
                                      className="form-input"
                                      disabled={!isTableEditing}
                                      placeholder="Select Product / Variant"
                                      value={row.values?.[col.key] !== undefined ? row.values[col.key] : row.variant}
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
                                        padding: '3px 8px',
                                        fontSize: '0.8rem',
                                        height: 28,
                                        fontWeight: 700,
                                        background: isCellSelected ? '#f0f9ff' : isTableEditing ? '#ffffff' : '#f8fafc',
                                        borderColor: isCellSelected ? '#0284c7' : isTableEditing ? 'var(--border)' : 'transparent',
                                        boxShadow: isCellSelected ? '0 0 0 2px rgba(2, 132, 199, 0.25)' : 'none',
                                      }}
                                    />
                                  </td>
                                );
                              }

                              const isDraggedInFill = !!(fillDrag && !fillDrag.isModal && fillDrag.colKey === col.key &&
                                rIdx >= Math.min(fillDrag.sourceRow, fillDrag.targetRow) &&
                                rIdx <= Math.max(fillDrag.sourceRow, fillDrag.targetRow));

                              return (
                                <td key={`cell_${rIdx}_${col.key}`} data-row-index={rIdx} style={{ position: 'relative' }}>
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
                                        borderColor: '#16a34a transparent transparent transparent',
                                        pointerEvents: 'none',
                                        zIndex: 5,
                                      }}
                                      title={`Excel Formula Present: ${rawVal}`}
                                    />
                                  )}
                                  <input
                                    type="text"
                                    className="form-input"
                                    disabled={!isTableEditing}
                                    placeholder="-"
                                    value={displayVal}
                                    title={isFormula ? `Formula: ${rawVal}` : undefined}
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
                                      padding: isFormula ? '3px 8px 3px 12px' : '3px 8px',
                                      fontSize: '0.8rem',
                                      height: 28,
                                      textAlign: 'right',
                                      fontFamily: 'var(--font-numbers)',
                                      background: isDraggedInFill
                                        ? '#bae6fd'
                                        : isCellSelected
                                        ? '#bae6fd'
                                        : isFormula
                                        ? '#e0f2fe'
                                        : isTableEditing
                                        ? '#ffffff'
                                        : '#f8fafc',
                                      color: isFormula ? '#0369a1' : 'var(--text-primary)',
                                      borderColor: isDraggedInFill
                                        ? '#0284c7'
                                        : isCellSelected
                                        ? '#0284c7'
                                        : isFormula
                                        ? '#7dd3fc'
                                        : isTableEditing
                                        ? 'var(--border)'
                                        : 'transparent',
                                      boxShadow: isDraggedInFill
                                        ? '0 0 0 2px rgba(2, 132, 199, 0.45)'
                                        : isCellSelected
                                        ? '0 0 0 2px rgba(2, 132, 199, 0.25)'
                                        : 'none',
                                      fontWeight: isFormula ? 800 : 700,
                                    }}
                                  />

                                  {/* Excel Fill Handle Square */}
                                  {isCellSelected && isTableEditing && (
                                    <div
                                      onMouseDown={e => handleFillDragStart(e, rIdx, col.key, false)}
                                      style={{
                                        position: 'absolute',
                                        bottom: 2,
                                        right: 2,
                                        width: 8,
                                        height: 8,
                                        background: '#0284c7',
                                        border: '1px solid #ffffff',
                                        cursor: 'ns-resize',
                                        zIndex: 10,
                                        borderRadius: 1,
                                      }}
                                      title="Excel Fill Handle: Drag up or down to auto-fill formula/values to adjacent cells with relative row adjustment"
                                    />
                                  )}
                                </td>
                              );
                            })}

                            {isColumnEditing && (
                              <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.72rem' }}>
                                —
                              </td>
                            )}

                            {isTableEditing && (
                              <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleMoveRow(rIdx, 'up')}
                                    disabled={rIdx === 0}
                                    style={{ padding: '2px 5px', fontSize: '0.72rem', height: 26 }}
                                    title="Move Row Up"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleMoveRow(rIdx, 'down')}
                                    disabled={rIdx === (activeState.rows || []).length - 1}
                                    style={{ padding: '2px 5px', fontSize: '0.72rem', height: 26 }}
                                    title="Move Row Down"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleAddRow(rIdx + 1)}
                                    style={{ padding: '2px 7px', fontSize: '0.72rem', height: 26, color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }}
                                    title="Insert Row Below"
                                  >
                                    ➕ Insert
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(rIdx)}
                                    style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '2px 7px', fontSize: '0.72rem', cursor: 'pointer', height: 26, fontWeight: 700 }}
                                    title="Delete Row"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>


                    </table>
                  </div>

                  {/* Card Footer controls */}
                  <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {isTableEditing && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleSaveChart}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : '💾 Save Formulation'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleProceedToStockEntry}
                      >
                        ➡️ Save & Proceed to Stock Statement Entry
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
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
              background: 'var(--surface, #ffffff)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              marginTop: 20,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleProceedToStockEntry}
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
              Next: Proceed to Stock Statement Entry ➔
            </button>
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Column Inline directly from Table */}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
      {/* Datalist for Product Variant Dropdown */}
      <datalist id="variant-products-list">
        {productOptions.map(p => (
          <option key={`prod_opt_${p}`} value={p} />
        ))}
      </datalist>
    </>
  );
}
