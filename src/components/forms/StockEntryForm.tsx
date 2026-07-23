// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Milk & Cream Stock Statement Entry Form
// Supports dynamic product columns (insert at middle, delete with warnings)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Shift } from '@/lib/types';
import { STOCK_RECEIPT_LABELS, STOCK_DISPOSAL_LABELS, STOCK_PRODUCT_COLUMNS } from '@/lib/types';
import Header from '@/components/layout/Header';
import Link from 'next/link';

type ColKey = string;

interface StockRowState {
  row_type: 'OB' | 'RECEIPT' | 'DISPOSAL';
  row_label: string;
  values: Partial<Record<ColKey, string>>;
}

function makeDefaultRows(receipts: any[] = ["Receipts:"], disposals: any[] = ["To DLT Milk", "To FC Milk", "To STD Milk", "To MKT"]): StockRowState[] {
  const make = (row_type: StockRowState['row_type'], row_label: string): StockRowState => ({
    row_type, row_label, values: {},
  });

  const getLabel = (r: any) => typeof r === 'string' ? r : (r.short_name || r.full_name || '');

  return [
    make('OB', 'Opening Balance'),
    ...receipts.map(r => make('RECEIPT', getLabel(r))),
    ...disposals.map(r => make('DISPOSAL', getLabel(r))),
  ];
}

export default function StockEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const [entryDate, setEntryDate] = useState(paramDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift>(paramShift === 'N' || paramShift === 'D' ? paramShift : 'D');
  const [shiftConfigs, setShiftConfigs] = useState<any[]>([
    { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
    { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
  ]);
  const [reportMode, setReportMode] = useState<'full_day' | 'shift'>('full_day');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<StockRowState[]>(() => makeDefaultRows());
  const [globalProducts, setGlobalProducts] = useState<any[]>(() => [...STOCK_PRODUCT_COLUMNS]);
  const [columns, setColumns] = useState<Array<{ key: ColKey; label: string; full_name?: string; short_name?: string }>>(() => [...STOCK_PRODUCT_COLUMNS]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [receiptRowsConfig, setReceiptRowsConfig] = useState<any[]>(["Receipts:"]);
  const [disposalRowsConfig, setDisposalRowsConfig] = useState<any[]>([
    "To DLT Milk",
    "To FC Milk",
    "To STD Milk",
    "To MKT",
  ]);
  const [obUnlocked, setObUnlocked] = useState(false);

  const setColumnsUnique = (newCols: Array<{ key: ColKey; label: string; full_name?: string; short_name?: string }> | ((prev: Array<{ key: ColKey; label: string; full_name?: string; short_name?: string }>) => Array<{ key: ColKey; label: string; full_name?: string; short_name?: string }>)) => {
    setColumns(prev => {
      const resolved = typeof newCols === 'function' ? newCols(prev) : newCols;
      const seen = new Set<string>();
      return resolved.filter(c => {
        if (seen.has(c.key)) return false;
        seen.add(c.key);
        return true;
      });
    });
  };

  // Load shifts config on mount
  useEffect(() => {
    async function loadShiftConfig() {
      try {
        const res = await fetch('/api/entries?report_type=STOCK');
        if (res.ok) {
          const json = await res.json();
          const entries: any[] = json.data || [];
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
              let parsedShifts = [
                { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
                { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
              ];
              let parsedMode: 'full_day' | 'shift' = 'full_day';
              let parsedProducts = [...STOCK_PRODUCT_COLUMNS];
              
              if (parsed && typeof parsed === 'object') {
                if (parsed.mode) parsedMode = parsed.mode;
                if (Array.isArray(parsed.shifts)) parsedShifts = parsed.shifts;
                if (Array.isArray(parsed.products)) parsedProducts = parsed.products;
              }
              
              let parsedReceiptRows = ["Receipts:"];
              let parsedDisposalRows = ["To DLT Milk", "To FC Milk", "To STD Milk", "To MKT"];
              if (Array.isArray(parsed.receipt_rows)) parsedReceiptRows = parsed.receipt_rows;
              if (Array.isArray(parsed.disposal_rows)) parsedDisposalRows = parsed.disposal_rows;

              setShiftConfigs(parsedShifts);
              setReportMode(parsedMode);
              setGlobalProducts(parsedProducts);
              setColumnsUnique(parsedProducts);
              setReceiptRowsConfig(parsedReceiptRows);
              setDisposalRowsConfig(parsedDisposalRows);

              if (parsedMode === 'full_day') {
                setShift('D');
              } else if (!paramShift) {
                const now = new Date();
                const currentHours = now.getHours();
                const currentMinutes = now.getMinutes();
                const currentTimeVal = currentHours * 60 + currentMinutes;

                let detectedShift: Shift = 'D';
                for (const s of parsedShifts) {
                  const [startH, startM] = s.start.split(':').map(Number);
                  const [endH, endM] = s.end.split(':').map(Number);
                  const startVal = startH * 60 + startM;
                  const endVal = endH * 60 + endM;

                  if (startVal < endVal) {
                    if (currentTimeVal >= startVal && currentTimeVal < endVal) {
                      detectedShift = s.key as Shift;
                      break;
                    }
                  } else {
                    if (currentTimeVal >= startVal || currentTimeVal < endVal) {
                      detectedShift = s.key as Shift;
                      break;
                    }
                  }
                }
                setShift(detectedShift);
              }
            } catch (e) {
              console.error('Failed to parse stock config notes:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error loading shift configuration:', err);
      } finally {
        setConfigLoaded(true);
      }
    }
    loadShiftConfig();
  }, []);

  useEffect(() => {
    if (!configLoaded) return;
    if (!entryDate || !shift) return;
    setError('');
    setSuccess('');
    setObUnlocked(false);
    let active = true;

    async function loadData() {
      try {
        const res = await fetch(`/api/stock?date=${entryDate}&shift=${shift}`);
        // Retrieve latest products config from state
        const activeProducts = globalProducts.length > 0 ? globalProducts : [...STOCK_PRODUCT_COLUMNS];

        if (!res.ok) {
          if (active) {
            // Helper to get previous shift/date
            const getPreviousShiftInfo = (): { date: string; shift: Shift } => {
              if (reportMode === 'shift' && shift === 'N') {
                return { date: entryDate, shift: 'D' };
              } else {
                const [year, month, day] = entryDate.split('-').map(Number);
                const prevDateObj = new Date(year, month - 1, day - 1);
                const yyyy = prevDateObj.getFullYear();
                const mm = String(prevDateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(prevDateObj.getDate()).padStart(2, '0');
                const prevDateStr = `${yyyy}-${mm}-${dd}`;
                return { date: prevDateStr, shift: reportMode === 'shift' ? 'N' : 'D' };
              }
            };

            // Helper to compute Closing Balance from rows
            const calcClosingBalanceFromRows = (dbRows: any[], cols: any[], prevCustomValues: any = {}): Record<string, string> => {
              const obSum: Record<string, number> = {};
              const recSum: Record<string, number> = {};
              const dispSum: Record<string, number> = {};
              const DB_COLUMNS = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'toned_curd', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'];

              cols.forEach(col => {
                obSum[col.key] = 0;
                recSum[col.key] = 0;
                dispSum[col.key] = 0;
              });

              dbRows.forEach((r: any) => {
                const label = r.row_label;
                cols.forEach(col => {
                  let val = 0;
                  if (DB_COLUMNS.includes(col.key)) {
                    val = Number(r[col.key]) || 0;
                  } else {
                    const rowVals = prevCustomValues[label];
                    val = rowVals ? (parseFloat(rowVals[col.key]) || 0) : 0;
                  }

                  if (r.row_type === 'OB') {
                    obSum[col.key] = (obSum[col.key] || 0) + val;
                  } else if (r.row_type === 'RECEIPT') {
                    recSum[col.key] = (recSum[col.key] || 0) + val;
                  } else if (r.row_type === 'DISPOSAL') {
                    dispSum[col.key] = (dispSum[col.key] || 0) + val;
                  }
                });
              });

              const cb: Record<string, string> = {};
              cols.forEach(col => {
                const val = obSum[col.key] + recSum[col.key] - dispSum[col.key];
                cb[col.key] = val === 0 ? '' : String(val);
              });
              return cb;
            };

            const fetchPrevShiftCB = async () => {
              let initialObValues: Record<string, string> = {};
              let finalCols = [...activeProducts];
              try {
                const prevInfo = getPreviousShiftInfo();
                const prevRes = await fetch(`/api/stock?date=${prevInfo.date}&shift=${prevInfo.shift}`);
                if (prevRes.ok) {
                  const prevJson = await prevRes.json();
                  const prevEntry = prevJson.data?.entries?.[0];
                  const prevRows = prevJson.data?.stock_rows || [];
                  
                  let prevCustomCols: Array<{ key: ColKey; label: string }> = [];
                  let prevCustomVals: Record<string, Record<ColKey, string>> = {};
                  if (prevEntry && prevEntry.notes) {
                    const notesParts = prevEntry.notes.split('\n');
                    notesParts.forEach((part: string) => {
                      if (part.includes('__METADATA__:')) {
                        const [, metaJson] = part.split('__METADATA__:');
                        try {
                          const meta = JSON.parse(metaJson);
                          if (meta.custom_columns) prevCustomCols = meta.custom_columns;
                          if (meta.custom_values) prevCustomVals = meta.custom_values;
                        } catch {}
                      }
                    });
                  }

                  prevCustomCols.forEach((cc: any) => {
                    if (!finalCols.some(col => col.key === cc.key)) {
                      finalCols.push(cc);
                    }
                  });

                  initialObValues = calcClosingBalanceFromRows(prevRows, finalCols, prevCustomVals);
                }
              } catch (err) {
                console.error('Error fetching previous shift closing balance:', err);
              }

              if (active) {
                setColumnsUnique(finalCols);
                const defaultRows = makeDefaultRows(receiptRowsConfig, disposalRowsConfig);
                defaultRows[0].values = initialObValues;
                setRows(defaultRows);
                setNotes('');
              }
            };

            fetchPrevShiftCB();
          }
          return;
        }

        const json = await res.json();
        const entry = json.data?.entries?.[0];
        if (!entry) return;

        if (active) {
          let parsedCols = [...activeProducts];
          let customVals: Record<string, Record<string, string>> = {};
          let cleanNotes = entry.notes || '';

          const notesParts = (entry.notes || '').split('\n');
          notesParts.forEach((part: string) => {
            if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
              const [, metaJson] = part.split('__METADATA__:');
              try {
                const meta = JSON.parse(metaJson);
                if (meta.custom_columns) {
                  meta.custom_columns.forEach((cc: any) => {
                    if (!parsedCols.some(col => col.key === cc.key)) {
                      parsedCols.push(cc);
                    }
                  });
                }
                if (meta.custom_values) {
                  customVals = meta.custom_values;
                }
              } catch (e) {
                console.error('Failed to parse metadata:', e);
              }
              cleanNotes = cleanNotes.replace(part, '').trim();
            }
          });

          setColumnsUnique(parsedCols);
          setNotes(cleanNotes);

          const sortedDbRows = [...(json.data.stock_rows || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          let loadedRows: StockRowState[] = [];
          if (sortedDbRows.length > 0) {
            loadedRows = sortedDbRows.map((dbRow: any) => {
              const values: Record<string, string> = {};
              parsedCols.forEach(col => {
                if (dbRow[col.key] !== undefined && dbRow[col.key] !== null) {
                  values[col.key] = dbRow[col.key] === 0 ? '' : String(dbRow[col.key]);
                }
              });

              if (customVals[dbRow.row_label]) {
                Object.entries(customVals[dbRow.row_label]).forEach(([colKey, val]) => {
                  values[colKey] = val;
                });
              }

              return {
                row_type: dbRow.row_type,
                row_label: dbRow.row_label,
                values,
              };
            });
          } else {
            loadedRows = makeDefaultRows(receiptRowsConfig, disposalRowsConfig);
          }
          setRows(loadedRows);

        }
      } catch (err) {
        console.error('Error loading existing stock data:', err);
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift, configLoaded, globalProducts, reportMode]);

  const updateCell = (rowIdx: number, col: ColKey, val: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], values: { ...next[rowIdx].values, [col]: val } };
      return next;
    });
  };

  const addRowAfter = (row_type: StockRowState['row_type'], idx: number) => {
    setRows(prev => {
      const next = [...prev];
      const newItem: StockRowState = {
        row_type,
        row_label: '',
        values: {},
      };
      if (idx !== -1) {
        next.splice(idx + 1, 0, newItem);
      } else {
        let insertAt = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].row_type === row_type) {
            insertAt = i;
            break;
          }
        }
        if (insertAt !== -1) {
          next.splice(insertAt + 1, 0, newItem);
        } else {
          next.push(newItem);
        }
      }
      return next;
    });
  };

  const deleteRow = (idx: number) => {
    setRows(prev => {
      const item = prev[idx];
      if (!item) return prev;
      const hasData = Object.values(item.values).some(v => v && parseFloat(v) !== 0);
      if (hasData || item.row_label.trim() !== '') {
        const ok = window.confirm("Are you sure you want to remove this row containing data?");
        if (!ok) return prev;
      }
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const addColumnAfter = (colKey: string) => {
    const label = window.prompt("Enter new column header name:");
    if (!label || label.trim() === '') return;

    const newKey = 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setColumnsUnique(prev => {
      const idx = prev.findIndex(c => c.key === colKey);
      const next = [...prev];
      if (idx === -1) {
        next.push({ key: newKey, label: label.trim() });
      } else {
        next.splice(idx + 1, 0, { key: newKey, label: label.trim() });
      }
      return next;
    });
  };

  const deleteColumn = (colKey: string) => {
    const hasData = rows.some(r => r.values[colKey] && parseFloat(r.values[colKey]) !== 0);
    if (hasData) {
      const ok = window.confirm("Are you sure you want to remove this column and all its data?");
      if (!ok) return;
    }

    setColumnsUnique(prev => prev.filter(c => c.key !== colKey));
    setRows(prev => prev.map(r => {
      const nextValues = { ...r.values };
      delete nextValues[colKey];
      return { ...r, values: nextValues };
    }));
  };

  const autoCompileSTGFromStock = async (
    targetDate: string,
    targetShift: Shift | null,
    stockCols: Array<{ key: string; label: string }>,
    stockRowsState: StockRowState[]
  ) => {
    // 1. Load active mapping rules without date parameter
    let mappingRules: any[] = [];
    try {
      const mapRes = await fetch('/api/entries?report_type=STOCK_MAPPING');
      if (mapRes.ok) {
        const mapJson = await mapRes.json();
        const mapEntry = mapJson.data?.[0];
        if (mapEntry && mapEntry.notes) {
          const list = JSON.parse(mapEntry.notes);
          if (Array.isArray(list) && list.length > 0) mappingRules = list;
        }
      }
    } catch (e) {
      console.error('Failed loading STOCK_MAPPING rules for autoCompile:', e);
    }

    if (mappingRules.length === 0) {
      mappingRules = [
        { stockProductKey: 'wh_milk', stockSection: 'OB', stockParticular: 'Opening Balance', stgBlockKey: 'WM', stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT', stgSection: 'OB', stgItemName: 'OB', stgTargetField: 'qty_lts' },
        { stockProductKey: 'wh_milk', stockSection: 'RECEIPT', stockParticular: 'Receipts:', stgBlockKey: 'WM', stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT', stgSection: 'RECEIPT', stgItemName: 'Receipt', stgTargetField: 'qty_lts' },
        { stockProductKey: 'wh_milk', stockSection: 'DISPOSAL', stockParticular: 'To DLT Milk', stgBlockKey: 'WM', stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT', stgSection: 'DISPOSAL', stgItemName: 'To DLT Milk', stgTargetField: 'qty_lts' },
        { stockProductKey: 'wh_milk', stockSection: 'DISPOSAL', stockParticular: 'To FC Milk', stgBlockKey: 'WM', stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT', stgSection: 'DISPOSAL', stgItemName: 'To FC Milk', stgTargetField: 'qty_lts' },
        { stockProductKey: 'wh_milk', stockSection: 'DISPOSAL', stockParticular: 'To STD Milk', stgBlockKey: 'WM', stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT', stgSection: 'DISPOSAL', stgItemName: 'To STD Milk', stgTargetField: 'qty_lts' },
        { stockProductKey: 'wh_milk', stockSection: 'DISPOSAL', stockParticular: 'To MKT', stgBlockKey: 'WM', stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT', stgSection: 'DISPOSAL', stgItemName: 'To MKT', stgTargetField: 'qty_lts' },
        { stockProductKey: 'skim_milk', stockSection: 'OB', stockParticular: 'Opening Balance', stgBlockKey: 'SSM', stgBlockLabel: 'SKIM MILK STATEMENT', stgSection: 'OB', stgItemName: 'OB', stgTargetField: 'qty_lts' },
        { stockProductKey: 'skim_milk', stockSection: 'RECEIPT', stockParticular: 'Receipts:', stgBlockKey: 'SSM', stgBlockLabel: 'SKIM MILK STATEMENT', stgSection: 'RECEIPT', stgItemName: 'Receipt', stgTargetField: 'qty_lts' },
        { stockProductKey: 'cream', stockSection: 'OB', stockParticular: 'Opening Balance', stgBlockKey: 'CREAM', stgBlockLabel: 'CREAM STATEMENT', stgSection: 'OB', stgItemName: 'OB', stgTargetField: 'qty_kg' },
        { stockProductKey: 'smp', stockSection: 'OB', stockParticular: 'Opening Balance', stgBlockKey: 'SMP', stgBlockLabel: 'SMP STATEMENT', stgSection: 'OB', stgItemName: 'OB', stgTargetField: 'qty_kg' },
      ];
    }

    const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/[:\s]+/g, ' ').trim();

    const blocksData: Record<string, {
      label: string;
      ob: any;
      receipts: any[];
      disposals: any[];
      cb: any;
    }> = {};

    const customStatements: Array<{ key: string; label: string }> = [];
    const enabledBlockKeys: string[] = [];

    mappingRules.forEach(rule => {
      const { stockProductKey, stockSection, stockParticular, stgBlockKey, stgBlockLabel, stgSection, stgItemName, stgTargetField } = rule;

      const normProductKey = normalizeStr(stockProductKey);
      const col = stockCols.find(c =>
        c.key.toLowerCase() === stockProductKey.toLowerCase() ||
        normalizeStr(c.key) === normProductKey ||
        normalizeStr(c.label) === normProductKey
      );

      const normParticular = normalizeStr(stockParticular);
      const stockRow = stockRowsState.find(r => {
        if (r.row_type !== stockSection) return false;
        const normLabel = normalizeStr(r.row_label);
        return normLabel === normParticular || normLabel.includes(normParticular) || normParticular.includes(normLabel);
      });

      if (!stockRow) return;

      const getValFromRow = (r: StockRowState) => {
        if (!r.values) return 0;
        if (r.values[stockProductKey] !== undefined && r.values[stockProductKey] !== '') {
          return parseFloat(r.values[stockProductKey] || '0') || 0;
        }
        if (col && r.values[col.key] !== undefined && r.values[col.key] !== '') {
          return parseFloat(r.values[col.key] || '0') || 0;
        }
        for (const k of Object.keys(r.values)) {
          if (k.toLowerCase() === stockProductKey.toLowerCase() || normalizeStr(k) === normProductKey) {
            return parseFloat(r.values[k] || '0') || 0;
          }
        }
        return 0;
      };

      const valNum = getValFromRow(stockRow);
      if (!valNum || isNaN(valNum)) return;

      if (!blocksData[stgBlockKey]) {
        blocksData[stgBlockKey] = {
          label: stgBlockLabel || `${stgBlockKey} STATEMENT`,
          ob: { item_name: 'OB', qty_lts: '', qty_kg: '', fat_pct: '', snf_pct: '', sp_gr: '1.0285', kg_fat: '', kg_snf: '' },
          receipts: [],
          disposals: [],
          cb: { item_name: 'CB', qty_lts: '', qty_kg: '', fat_pct: '', snf_pct: '', sp_gr: '', kg_fat: '', kg_snf: '' },
        };
      }

      if (!enabledBlockKeys.includes(stgBlockKey)) {
        enabledBlockKeys.push(stgBlockKey);
        customStatements.push({ key: stgBlockKey, label: stgBlockLabel || `${stgBlockKey} Statement` });
      }

      const b = blocksData[stgBlockKey];
      const isSMP = stgBlockKey === 'SMP' || (stgBlockLabel || '').toUpperCase().includes('SMP');

      const fieldKey = stgTargetField || (isSMP ? 'qty_kg' : 'qty_lts');

      const assignVal = (targetObj: any) => {
        targetObj[fieldKey] = String(valNum);
        if (fieldKey === 'qty_lts' && !isSMP) {
          targetObj.qty_kg = (valNum * 1.0285).toFixed(3);
          targetObj.sp_gr = '1.0285';
        } else if (fieldKey === 'qty_kg' && isSMP) {
          targetObj.qty_lts = '';
        }
      };

      if (stgSection === 'OB') {
        assignVal(b.ob);
      } else if (stgSection === 'CB') {
        assignVal(b.cb);
      } else {
        const list = stgSection === 'RECEIPT' ? b.receipts : b.disposals;
        let existing = list.find(r => normalizeStr(r.item_name) === normalizeStr(stgItemName));
        if (!existing) {
          existing = { item_name: stgItemName, qty_lts: '', qty_kg: '', fat_pct: '', snf_pct: '', sp_gr: isSMP ? '' : '1.0285', kg_fat: '', kg_snf: '' };
          list.push(existing);
        }
        assignVal(existing);
      }
    });

    if (enabledBlockKeys.length === 0) return;

    // Build database stg_rows & customBlocksState
    const stg_rows: any[] = [];
    const customBlocksState: Record<string, any> = {};

    Object.entries(blocksData).forEach(([bKey, b]) => {
      const obLts = parseFloat(b.ob.qty_lts) || 0;
      const obKg = parseFloat(b.ob.qty_kg) || 0;

      let receiptsLtsTotal = 0;
      let receiptsKgTotal = 0;
      b.receipts.forEach((r: any) => {
        receiptsLtsTotal += parseFloat(r.qty_lts) || 0;
        receiptsKgTotal += parseFloat(r.qty_kg) || 0;
      });

      let disposalsLtsTotal = 0;
      let disposalsKgTotal = 0;
      b.disposals.forEach((d: any) => {
        disposalsLtsTotal += parseFloat(d.qty_lts) || 0;
        disposalsKgTotal += parseFloat(d.qty_kg) || 0;
      });

      const cbLts = obLts + receiptsLtsTotal - disposalsLtsTotal;
      const cbKg = obKg + receiptsKgTotal - disposalsKgTotal;

      b.cb.qty_lts = cbLts > 0 ? String(cbLts) : '';
      b.cb.qty_kg = cbKg > 0 ? cbKg.toFixed(3) : '';

      stg_rows.push({
        product_block: bKey,
        side: 'RECEIPT',
        item_name: 'OB',
        qty_lts: obLts,
        qty_kg: obKg,
        fat_pct: parseFloat(b.ob.fat_pct) || 0,
        snf_pct: parseFloat(b.ob.snf_pct) || 0,
        sp_gr: parseFloat(b.ob.sp_gr) || 1.0285,
        kg_fat: parseFloat(b.ob.kg_fat) || 0,
        kg_snf: parseFloat(b.ob.kg_snf) || 0,
        sort_order: 0,
      });

      b.receipts.forEach((r: any, idx: number) => {
        stg_rows.push({
          product_block: bKey,
          side: 'RECEIPT',
          item_name: r.item_name,
          qty_lts: parseFloat(r.qty_lts) || 0,
          qty_kg: parseFloat(r.qty_kg) || 0,
          fat_pct: parseFloat(r.fat_pct) || 0,
          snf_pct: parseFloat(r.snf_pct) || 0,
          sp_gr: parseFloat(r.sp_gr) || 1.0285,
          kg_fat: parseFloat(r.kg_fat) || 0,
          kg_snf: parseFloat(r.kg_snf) || 0,
          sort_order: idx + 1,
        });
      });

      b.disposals.forEach((d: any, idx: number) => {
        stg_rows.push({
          product_block: bKey,
          side: 'DISPOSAL',
          item_name: d.item_name,
          qty_lts: parseFloat(d.qty_lts) || 0,
          qty_kg: parseFloat(d.qty_kg) || 0,
          fat_pct: parseFloat(d.fat_pct) || 0,
          snf_pct: parseFloat(d.snf_pct) || 0,
          sp_gr: parseFloat(d.sp_gr) || 1.0285,
          kg_fat: parseFloat(d.kg_fat) || 0,
          kg_snf: parseFloat(d.kg_snf) || 0,
          sort_order: idx + 1,
        });
      });

      stg_rows.push({
        product_block: bKey,
        side: 'DISPOSAL',
        item_name: 'CB',
        qty_lts: cbLts > 0 ? cbLts : 0,
        qty_kg: cbKg > 0 ? Number(cbKg.toFixed(3)) : 0,
        fat_pct: parseFloat(b.cb.fat_pct) || 0,
        snf_pct: parseFloat(b.cb.snf_pct) || 0,
        sp_gr: parseFloat(b.cb.sp_gr) || 1.0285,
        kg_fat: parseFloat(b.cb.kg_fat) || 0,
        kg_snf: parseFloat(b.cb.kg_snf) || 0,
        sort_order: 99,
      });

      customBlocksState[bKey] = {
        opening_balance: b.ob,
        receipts: b.receipts,
        disposals: b.disposals,
        physical_count: b.cb,
      };
    });

    // Save TS entry via POST /api/entries
    const tsMeta = {
      custom_statements: customStatements,
      custom_blocks: customBlocksState,
      enabled_blocks: enabledBlockKeys,
    };
    const tsNotes = "\n__METADATA__:" + JSON.stringify(tsMeta);

    const tsEntryRes = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_date: targetDate,
        shift: targetShift,
        report_type: 'TS',
        notes: tsNotes,
      }),
    });

    if (tsEntryRes.ok) {
      const tsEntryJson = await tsEntryRes.json();
      const tsEntryId = tsEntryJson.data?.id;

      if (tsEntryId) {
        await fetch('/api/ts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_id: tsEntryId,
            ts_rows: [],
            stg_rows,
          }),
        });
      }
    }
  };

  const handleSave = async (nextAction: 'view' | 'stay' | 'next') => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      // 1. Extract custom columns and values metadata
      const DB_COLUMNS = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'toned_curd', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'];
      const customCols = columns.filter(c => !DB_COLUMNS.includes(c.key));
      const customValues: Record<string, Record<string, string>> = {}; // row_label -> colKey -> val
      rows.forEach(r => {
        const vals: Record<string, string> = {};
        customCols.forEach(cc => {
          if (r.values[cc.key]) {
            vals[cc.key] = r.values[cc.key]!;
          }
        });
        if (Object.keys(vals).length > 0) {
          customValues[r.row_label] = vals;
        }
      });

      // 2. Append metadata to notes for database-compatible serialization
      const metadata = {
        custom_columns: customCols,
        custom_values: customValues,
      };
      const finalNotes = notes.trim() + "\n__METADATA__:" + JSON.stringify(metadata);

      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: entryDate, shift, report_type: 'STOCK', notes: finalNotes }),
      });
      const entryData = await entryRes.json();
      if (!entryRes.ok) throw new Error(entryData.error || 'Failed to create entry');

      const entry_id = entryData.data.id;

      // 3. Map standard 12 columns to standard postgres fields
      const stockRows = rows.map((r, i) => ({
        row_type: r.row_type,
        row_label: r.row_label,
        sort_order: i,
        ...Object.fromEntries(
          DB_COLUMNS.map(colKey => [colKey, parseFloat(r.values[colKey] || '0') || 0])
        ),
      }));

      const stockRes = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id, stock_rows: stockRows, separation_details: null }),
      });
      if (!stockRes.ok) {
        const d = await stockRes.json();
        throw new Error(d.error || 'Failed to save stock rows');
      }

      // 4. Automatically create / compile Solid Balance (STG) Entry for this date/shift
      try {
        await autoCompileSTGFromStock(entryDate, shift, columns, rows);
      } catch (stgErr) {
        console.error('Auto-compiling STG entry warning:', stgErr);
      }

      setSuccess('Stock Statement & STG Receipts & Disposals saved successfully!');

      if (nextAction === 'view') {
        router.push(`/dashboard/stock/${entryDate}/${shift}`);
      } else if (nextAction === 'next') {
        // Advance to next shift or day
        if (reportMode === 'shift') {
          if (shift === 'D') {
            setShift('N');
          } else {
            const [year, month, day] = entryDate.split('-').map(Number);
            const nextDate = new Date(year, month - 1, day + 1);
            const yyyy = nextDate.getFullYear();
            const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
            const dd = String(nextDate.getDate()).padStart(2, '0');
            setEntryDate(`${yyyy}-${mm}-${dd}`);
            setShift('D');
          }
        } else {
          // Full Day mode: advance to next day
          const [year, month, day] = entryDate.split('-').map(Number);
          const nextDate = new Date(year, month - 1, day + 1);
          const yyyy = nextDate.getFullYear();
          const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDate.getDate()).padStart(2, '0');
          setEntryDate(`${yyyy}-${mm}-${dd}`);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const getSectionSum = (rowType: 'OB' | 'RECEIPT' | 'DISPOSAL', colKey: string): number => {
    return rows
      .filter(r => r.row_type === rowType)
      .reduce((sum, r) => sum + (parseFloat(r.values[colKey] || '0') || 0), 0);
  };

  const renderSection = (
    sectionLabel: string,
    rowTypes: StockRowState['row_type'][],
    headerColor: string
  ) => {
    const sRows = rows.map((r, i) => ({ r, i })).filter(x => rowTypes.includes(x.r.row_type));
    const isBalanceSection = rowTypes.includes('OB');
    const rowType = rowTypes[0]; // 'RECEIPT' or 'DISPOSAL'

    return (
      <div key={sectionLabel} className="entry-form-section">
        <div className="entry-form-section-title" style={{ color: headerColor, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{sectionLabel}</span>
          {isBalanceSection && (
            <button
              type="button"
              className="btn btn-secondary btn-sm no-print"
              onClick={() => setObUnlocked(!obUnlocked)}
              style={{
                padding: '4px 10px',
                fontSize: '0.72rem',
                height: 24,
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: obUnlocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                color: obUnlocked ? '#ef4444' : 'var(--brand-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {obUnlocked ? '🔒 Lock OB' : '✏️ Edit OB'}
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 220 }}>Particulars</th>
                {columns.map(col => {
                  const DB_COLUMNS = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'toned_curd', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'];
                  const isCustom = !DB_COLUMNS.includes(col.key);
                  return (
                    <th key={col.key} style={{ minWidth: 110, fontSize: '0.65rem', textAlign: 'center', padding: '8px 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                          style={{ fontWeight: 700 }}
                          title={col.full_name ? `${col.full_name} (${col.short_name || col.label})` : (col.short_name || col.label)}
                        >
                          {col.short_name || col.label}
                        </div>
                        <div className="no-print" style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            title="Add column after this"
                            onClick={() => addColumnAfter(col.key)}
                          >
                            ➕
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                              title="Delete column"
                              onClick={() => deleteColumn(col.key)}
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th style={{ minWidth: 110, fontSize: '0.65rem', textAlign: 'center', padding: '8px 4px', fontWeight: 700 }}>Total</th>
                {!isBalanceSection && <th className="no-print" style={{ width: 70 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sRows.map(({ r, i }) => (
                <tr key={i}>
                  <td className="product-label" style={{ padding: 4 }}>
                    {isBalanceSection ? (
                      <span style={{ fontWeight: 600, paddingLeft: 8 }}>{r.row_label}</span>
                    ) : (
                      <input
                        type="text"
                        placeholder="Enter Particulars..."
                        value={r.row_label}
                        onChange={e => {
                          const val = e.target.value;
                          setRows(prev => {
                            const next = [...prev];
                            next[i] = { ...next[i], row_label: val };
                            return next;
                          });
                        }}
                        style={{ textAlign: 'left', fontWeight: 500, border: 'none', background: 'transparent', width: '100%', padding: '6px 8px' }}
                      />
                    )}
                  </td>
                  {columns.map(col => (
                    <td key={col.key}>
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={r.values[col.key] || ''}
                        onChange={e => updateCell(i, col.key, e.target.value)}
                        id={`stock-${r.row_type}-${i}-${col.key}`}
                        style={{
                          fontFamily: 'var(--font-numbers)',
                          backgroundColor: (isBalanceSection && !obUnlocked) ? '#f8fafc' : 'transparent',
                          color: (isBalanceSection && !obUnlocked) ? '#64748b' : 'inherit',
                          cursor: (isBalanceSection && !obUnlocked) ? 'not-allowed' : 'text',
                        }}
                        readOnly={isBalanceSection && !obUnlocked}
                        onKeyDown={e => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();
                          }
                        }}
                        onWheel={e => e.currentTarget.blur()}
                      />
                    </td>
                  ))}
                  <td style={{ padding: 4 }}>
                    <input
                      type="text"
                      value={(() => {
                        const total = columns.reduce((sum, col) => sum + (parseFloat(r.values[col.key] || '0') || 0), 0);
                        return total === 0 ? '' : total.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                      })()}
                      disabled
                      style={{
                        fontFamily: 'var(--font-numbers)',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        textAlign: 'center',
                        border: 'none',
                        width: '100%',
                        padding: '6px 8px',
                        cursor: 'not-allowed',
                      }}
                    />
                  </td>
                  {!isBalanceSection && (
                    <td className="no-print" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Add row below"
                          onClick={() => addRowAfter(rowType, i)}
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Delete row"
                          onClick={() => deleteRow(i)}
                        >
                          ❌
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!isBalanceSection && (
                <tr className="no-print" style={{ cursor: 'pointer', background: '#f8fafc' }} onClick={() => {
                  const lastRow = sRows[sRows.length - 1];
                  addRowAfter(rowType, lastRow ? lastRow.i : -1);
                }}>
                  <td colSpan={columns.length + 3} style={{ textAlign: 'center', color: 'var(--brand-primary)', fontWeight: 600, padding: 8 }}>
                    ➕ Add Row
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSummaryTable = () => {
    return (
      <div className="entry-form-section" style={{ marginTop: 24 }}>
        <div className="entry-form-section-title" style={{ color: 'var(--brand-primary)' }}>
          📊 Stock Statement Summary (Live)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 220 }}>Summary Item</th>
                {columns.map(col => (
                  <th key={col.key} style={{ minWidth: 110, fontSize: '0.65rem', textAlign: 'center', padding: '8px 4px' }}>
                    <div style={{ fontWeight: 700 }}>{col.label}</div>
                  </th>
                ))}
                <th style={{ minWidth: 110, fontSize: '0.65rem', textAlign: 'center', padding: '8px 4px', fontWeight: 700 }}>Total</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {/* 1. Opening Balance */}
              <tr style={{ background: 'rgba(14, 165, 233, 0.04)', fontWeight: 600 }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Opening Balance</td>
                {columns.map(col => {
                  const val = getSectionSum('OB', col.key);
                  return (
                    <td key={col.key} style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)' }}>
                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)', fontWeight: 700 }}>
                  {(() => {
                    const rowSum = columns.reduce((sum, col) => sum + getSectionSum('OB', col.key), 0);
                    return rowSum === 0 ? '—' : rowSum.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                  })()}
                </td>
                <td></td>
              </tr>
              {/* 2. Total Receipts */}
              <tr style={{ background: 'rgba(16, 185, 129, 0.02)', fontWeight: 600 }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Total Receipts (+)</td>
                {columns.map(col => {
                  const val = getSectionSum('RECEIPT', col.key);
                  return (
                    <td key={col.key} style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)' }}>
                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)', fontWeight: 700 }}>
                  {(() => {
                    const rowSum = columns.reduce((sum, col) => sum + getSectionSum('RECEIPT', col.key), 0);
                    return rowSum === 0 ? '—' : rowSum.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                  })()}
                </td>
                <td></td>
              </tr>
              {/* 3. TOTAL (OB + Receipts) */}
              <tr style={{ background: 'rgba(16, 185, 129, 0.08)', fontWeight: 700 }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 700 }}>TOTAL (OB + Receipts)</td>
                {columns.map(col => {
                  const obVal = getSectionSum('OB', col.key);
                  const recVal = getSectionSum('RECEIPT', col.key);
                  const val = obVal + recVal;
                  return (
                    <td key={col.key} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, padding: '8px 4px', fontFamily: 'var(--font-numbers)' }}>
                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)', fontWeight: 700 }}>
                  {(() => {
                    const rowSum = columns.reduce((sum, col) => sum + (getSectionSum('OB', col.key) + getSectionSum('RECEIPT', col.key)), 0);
                    return rowSum === 0 ? '—' : rowSum.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                  })()}
                </td>
                <td></td>
              </tr>
              {/* 4. Total Disposals */}
              <tr style={{ background: 'rgba(245, 158, 11, 0.02)', fontWeight: 600 }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Total Disposals (-)</td>
                {columns.map(col => {
                  const val = getSectionSum('DISPOSAL', col.key);
                  return (
                    <td key={col.key} style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)' }}>
                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)', fontWeight: 700 }}>
                  {(() => {
                    const rowSum = columns.reduce((sum, col) => sum + getSectionSum('DISPOSAL', col.key), 0);
                    return rowSum === 0 ? '—' : rowSum.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                  })()}
                </td>
                <td></td>
              </tr>
              {/* 5. Closing Balance */}
              <tr style={{ background: 'rgba(14, 165, 233, 0.12)', fontWeight: 700 }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 700 }}>Closing Balance (=)</td>
                {columns.map(col => {
                  const obVal = getSectionSum('OB', col.key);
                  const recVal = getSectionSum('RECEIPT', col.key);
                  const dispVal = getSectionSum('DISPOSAL', col.key);
                  const val = obVal + recVal - dispVal;
                  return (
                    <td key={col.key} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, padding: '8px 4px', color: val < 0 ? '#ef4444' : 'inherit', fontFamily: 'var(--font-numbers)' }}>
                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.8rem', padding: '8px 4px', fontFamily: 'var(--font-numbers)', fontWeight: 700 }}>
                  {(() => {
                    const rowSum = columns.reduce((sum, col) => {
                      const obVal = getSectionSum('OB', col.key);
                      const recVal = getSectionSum('RECEIPT', col.key);
                      const dispVal = getSectionSum('DISPOSAL', col.key);
                      return sum + (obVal + recVal - dispVal);
                    }, 0);
                    return rowSum === 0 ? '—' : rowSum.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                  })()}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <Header
        title="New Stock Statement Entry"
        subtitle={`Enter daily milk & cream stock data (${reportMode === 'full_day' ? 'Full Day' : (shift === 'D' ? 'Day Shift' : 'Night Shift')})`}
        actions={
          <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">← Back to Stock List</Link>
        }
      />
      <div className="form-container">
        {/* Header */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Entry Details</div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={async () => {
                await handleSave('stay');
                router.push(`/dashboard/ts/new-stg?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 600, background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)', borderColor: '#0284c7' }}
            >
              {saving ? 'Saving...' : '💾 Save & Open Solid Balance (STG) Entry ➔'}
            </button>
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                id="stock-entry-date"
                type="date"
                className="form-input"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            {reportMode === 'shift' ? (
              <div className="form-group">
                <label className="form-label">Shift *</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {(['D', 'N'] as Shift[]).map(s => {
                    const cfg = shiftConfigs.find(c => c.key === s) || {
                      label: s === 'D' ? 'Day Shift' : 'Night Shift',
                      start: s === 'D' ? '06:00' : '18:00',
                      end: s === 'D' ? '18:00' : '06:00'
                    };
                    return (
                      <button
                        key={s}
                        id={`shift-${s}`}
                        type="button"
                        className={`btn ${shift === s ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setShift(s)}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 12px', height: 'auto', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {s === 'D' ? '☀️' : '🌙'} {cfg.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                          {cfg.start} - {cfg.end}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Shift</label>
                <input
                  type="text"
                  className="form-input"
                  value="Full Day"
                  disabled
                  style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                type="text"
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Holiday, machine maintenance..."
              />
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {renderSection('Opening Balance', ['OB'], '#0ea5e9')}
        {renderSection('Receipts', ['RECEIPT'], '#10b981')}
        {renderSection('Disposals', ['DISPOSAL'], '#f59e0b')}

        {renderSummaryTable()}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }} className="no-print">
          <div>
            <button className="btn btn-secondary" onClick={() => router.back()} disabled={saving}>
              Cancel
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave('stay')}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              💾 Save progress
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave('next')}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ⏭️ Save & Continue (Next)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await handleSave('stay');
                router.push(`/dashboard/ts/new-stg?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
              }}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)', borderColor: '#0284c7' }}
            >
              💾 Save & Open Solid Balance (STG) Entry ➔
            </button>
            <button
              id="stock-save-btn"
              className="btn btn-primary"
              onClick={() => handleSave('view')}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} /> Saving…
                </>
              ) : (
                <>💾 Save & View Report</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
