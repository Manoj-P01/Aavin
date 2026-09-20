'use client';

import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { fmtDate } from '@/lib/calculations';
import type { Entry } from '@/lib/types';

interface ProductCol {
  key: string;
  label: string;
  short_name?: string;
  full_name?: string;
}



const MONTH_NAMES = [
  { val: '01', name: 'January', short: 'Jan' },
  { val: '02', name: 'February', short: 'Feb' },
  { val: '03', name: 'March', short: 'Mar' },
  { val: '04', name: 'April', short: 'Apr' },
  { val: '05', name: 'May', short: 'May' },
  { val: '06', name: 'June', short: 'Jun' },
  { val: '07', name: 'July', short: 'Jul' },
  { val: '08', name: 'August', short: 'Aug' },
  { val: '09', name: 'September', short: 'Sep' },
  { val: '10', name: 'October', short: 'Oct' },
  { val: '11', name: 'November', short: 'Nov' },
  { val: '12', name: 'December', short: 'Dec' },
];

export default function PeriodicalSummaryReportPage() {
  const currentYearNum = new Date().getFullYear();
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');

  // Filter Selection Mode: 'MONTH' | 'YEAR' | 'CUSTOM'
  const [filterMode, setFilterMode] = useState<'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');

  // Mode 1: Month Selection State
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthNum]);

  // Mode 2: Year Selection State
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYearNum]);

  // Mode 3: Custom Date Range State
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Available Years in DB
  const [availableYears, setAvailableYears] = useState<number[]>([
    currentYearNum,
    currentYearNum - 1,
    currentYearNum - 2,
  ]);

  // Raw Stock Entries
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [columns, setColumns] = useState<ProductCol[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all stock entries on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        try {
          const cfgRes = await fetch('/api/stock/config');
          if (cfgRes.ok) {
            const cfgJson = await cfgRes.json();
            if (Array.isArray(cfgJson.products) && cfgJson.products.length > 0) {
              setColumns(cfgJson.products.map((p: any) => ({
                key: p.key || p.product_key,
                label: p.short_name || p.full_name || p.key,
                short_name: p.short_name || p.code,
                full_name: p.full_name || p.product_name,
              })));
            }
          }
        } catch (cfgErr) {
          console.error('Failed to load DB stock config:', cfgErr);
        }

        const res = await fetch('/api/entries?report_type=STOCK');
        if (res.ok) {
          const json = await res.json();
          const list: Entry[] = (json.data || []).filter((e: Entry) => e.entry_date && e.entry_date !== '1970-01-01');
          setAllEntries(list);

          // Discover available years from data
          const yearsSet = new Set<number>();
          yearsSet.add(currentYearNum);
          list.forEach(e => {
            if (e.entry_date) {
              const y = parseInt(e.entry_date.split('-')[0], 10);
              if (!isNaN(y)) yearsSet.add(y);
            }
          });
          const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
          setAvailableYears(sortedYears);

          // Extract columns from metadata entry if present
          const metaEntry = (json.data || []).find((e: any) => e.entry_date === '1970-01-01' || (e.notes && e.notes.includes('__METADATA__:')));
          if (metaEntry && metaEntry.notes) {
            try {
              const metaText = metaEntry.notes.replace('__METADATA__:', '');
              const parsed = JSON.parse(metaText);
              if (parsed && Array.isArray(parsed.columns) && parsed.columns.length > 0) {
                setColumns(parsed.columns);
              }
            } catch (err) {}
          }
        }
      } catch (err) {
        console.error('Failed to fetch stock entries for periodical report:', err);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Filter entries based on active mode
  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      if (!entry.entry_date) return false;
      const [y, m] = entry.entry_date.split('-');

      if (filterMode === 'MONTH') {
        const entryYear = parseInt(y, 10);
        return entryYear === selectedYear && selectedMonths.includes(m);
      }

      if (filterMode === 'YEAR') {
        const entryYear = parseInt(y, 10);
        return selectedYears.includes(entryYear);
      }

      if (filterMode === 'CUSTOM') {
        return entry.entry_date >= fromDate && entry.entry_date <= toDate;
      }

      return true;
    }).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }, [allEntries, filterMode, selectedYear, selectedMonths, selectedYears, fromDate, toDate]);

  // Statement Selector Tab State: 'STOCK' | 'STG' | 'TS'
  const [activeStatementType, setActiveStatementType] = useState<'STOCK' | 'STG' | 'TS'>('STOCK');

  // Date-Wise View Mode State: 'CONSOLIDATED' | 'PRODUCT_WISE'
  const [dateWiseViewMode, setDateWiseViewMode] = useState<'CONSOLIDATED' | 'PRODUCT_WISE'>('PRODUCT_WISE');
  // Sub-view mode for Product-Wise View: 'SEPARATE' (individual statement tables per product) | 'COMBINED' (particulars breakdown table)
  const [productSubViewMode, setProductSubViewMode] = useState<'SEPARATE' | 'COMBINED'>('SEPARATE');
  // Multi-select product keys for Product-Wise View
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  // Checkbox dropdown popover toggle state
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);

  // Aggregated Stock Statement Data Calculation
  const aggregatedReport = useMemo(() => {
    if (filteredEntries.length === 0) return null;

    // Parse all rows from filtered entries safely
    const parsedEntries = filteredEntries.map(e => {
      let rowsData: any[] = [];
      try {
        const rawPayload = (e as any).stock_rows || (e as any).rows || (e as any).data || e.notes;
        if (Array.isArray(rawPayload)) {
          rowsData = rawPayload;
        } else if (typeof rawPayload === 'string') {
          if (!rawPayload.includes('__METADATA__:')) {
            const parsed = JSON.parse(rawPayload);
            if (Array.isArray(parsed)) {
              rowsData = parsed;
            } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).rows)) {
              rowsData = (parsed as any).rows;
            }
          }
        } else if (rawPayload && typeof rawPayload === 'object' && Array.isArray((rawPayload as any).rows)) {
          rowsData = (rawPayload as any).rows;
        }
      } catch (err) {}

      const safeRows = (Array.isArray(rowsData) ? rowsData : []).map(r => {
        if (!r || typeof r !== 'object') return null;
        const values: Record<string, string> = {};
        if (r.values && typeof r.values === 'object') {
          Object.assign(values, r.values);
        }
        Object.keys(r).forEach(k => {
          if (k !== 'row_type' && k !== 'row_label' && k !== 'values' && k !== 'id' && k !== 'entry_id') {
            if (r[k] !== undefined && r[k] !== null) {
              values[k] = String(r[k]);
            }
          }
        });
        return {
          row_type: r.row_type as 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB',
          row_label: r.row_label || '',
          values,
        };
      }).filter(Boolean) as Array<{ row_type: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB'; row_label: string; values: Record<string, string> }>;

      return { entry: e, rows: safeRows };
    });

    // 1. Consolidated OB (from earliest entry)
    const earliest = parsedEntries[0];
    const obValues: Record<string, number> = {};
    columns.forEach(c => (obValues[c.key] = 0));

    if (earliest && Array.isArray(earliest.rows)) {
      earliest.rows
        .filter(r => r && r.row_type === 'OB')
        .forEach(r => {
          columns.forEach(c => {
            const normK = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
            let valNum = 0;
            for (const [k, v] of Object.entries(r.values || {})) {
              if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normK) {
                const num = parseFloat(String(v));
                if (!isNaN(num)) {
                  valNum = num;
                  if (num !== 0) break;
                }
              }
            }
            obValues[c.key] += valNum;
          });
        });
    }

    // 2. Aggregate Receipts (Grouped by row Particulars)
    const receiptParticularsMap: Record<string, Record<string, number>> = {};
    // 3. Aggregate Disposals (Grouped by row Particulars)
    const disposalParticularsMap: Record<string, Record<string, number>> = {};

    // 4. Date-wise Statements calculation
    const dateWiseStatements = parsedEntries.map(item => {
      const e = item.entry;
      const dateStr = e.entry_date;
      const shiftStr = e.shift || 'F';

      const dayOb: Record<string, number> = {};
      const dayRec: Record<string, number> = {};
      const dayDisp: Record<string, number> = {};
      const dayCb: Record<string, number> = {};

      const dayRecParticulars: Record<string, Record<string, number>> = {};
      const dayDispParticulars: Record<string, Record<string, number>> = {};
      const allRecParticulars: Record<string, number> = {};
      const allDispParticulars: Record<string, number> = {};

      columns.forEach(c => {
        dayOb[c.key] = 0;
        dayRec[c.key] = 0;
        dayDisp[c.key] = 0;
        dayCb[c.key] = 0;
        dayRecParticulars[c.key] = {};
        dayDispParticulars[c.key] = {};
      });

      // Check if entry has stored stock_summary_rows table data or embedded in notes
      let summaryRows = (e as any).stock_summary_rows as any[] | undefined;

      if ((!summaryRows || summaryRows.length === 0) && e.notes && e.notes.includes('__STOCK_SUMMARY__:')) {
        try {
          const match = e.notes.split('__STOCK_SUMMARY__:')[1];
          if (match) {
            const summaryStr = match.split('\n')[0];
            const parsed = JSON.parse(summaryStr);
            if (Array.isArray(parsed)) summaryRows = parsed;
          }
        } catch (err) {}
      }

      let hasSummaryData = false;

      if (Array.isArray(summaryRows) && summaryRows.length > 0) {
        summaryRows.forEach(sRow => {
          const sType = sRow.summary_type || sRow.row_type;
          const sDataObj = sRow.summary_data || sRow.values || sRow;

          columns.forEach(c => {
            const normK = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
            let valNum = 0;
            if (sDataObj && typeof sDataObj === 'object') {
              if (sDataObj[c.key] !== undefined && sDataObj[c.key] !== null && sDataObj[c.key] !== '') {
                const num = parseFloat(String(sDataObj[c.key]));
                if (!isNaN(num)) valNum = num;
              } else {
                for (const [k, v] of Object.entries(sDataObj)) {
                  if (k !== 'summary_type' && k !== 'row_type' && k !== 'row_label' && k !== 'id' && k !== 'entry_id' && k !== 'summary_data') {
                    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normK) {
                      const num = parseFloat(String(v));
                      if (!isNaN(num)) {
                        valNum = num;
                        if (num !== 0) break;
                      }
                    }
                  }
                }
              }
            }
            if (sType === 'OB') { dayOb[c.key] = valNum; hasSummaryData = true; }
            else if (sType === 'TOTAL_RECEIPT') { dayRec[c.key] = valNum; hasSummaryData = true; }
            else if (sType === 'TOTAL_DISPOSAL') { dayDisp[c.key] = valNum; hasSummaryData = true; }
            else if (sType === 'CB') { dayCb[c.key] = valNum; hasSummaryData = true; }
          });
        });
      }

      item.rows.forEach(r => {
        if (!r) return;
        const vals = r.values || {};
        columns.forEach(c => {
          const normK = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          let valNum = 0;
          for (const [k, v] of Object.entries(vals)) {
            if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normK) {
              const num = parseFloat(String(v));
              if (!isNaN(num)) {
                valNum = num;
                if (num !== 0) break;
              }
            }
          }

          if (r.row_type === 'OB') {
            if (!hasSummaryData) dayOb[c.key] += valNum;
          } else if (r.row_type === 'RECEIPT') {
            if (!hasSummaryData) dayRec[c.key] += valNum;
            const label = (r.row_label || '').trim() || 'Receipts';
            dayRecParticulars[c.key][label] = (dayRecParticulars[c.key][label] || 0) + valNum;
            allRecParticulars[label] = (allRecParticulars[label] || 0) + valNum;
          } else if (r.row_type === 'DISPOSAL') {
            if (!hasSummaryData) dayDisp[c.key] += valNum;
            const label = (r.row_label || '').trim() || 'Disposals';
            dayDispParticulars[c.key][label] = (dayDispParticulars[c.key][label] || 0) + valNum;
            allDispParticulars[label] = (allDispParticulars[label] || 0) + valNum;
          }
        });
      });

      columns.forEach(c => {
        if (!hasSummaryData || dayCb[c.key] === undefined) {
          dayCb[c.key] = (dayOb[c.key] || 0) + (dayRec[c.key] || 0) - (dayDisp[c.key] || 0);
        }
      });

      const totalOb = Object.values(dayOb).reduce((sum, v) => sum + v, 0);
      const totalRec = Object.values(dayRec).reduce((sum, v) => sum + v, 0);
      const totalDisp = Object.values(dayDisp).reduce((sum, v) => sum + v, 0);
      const totalCb = Object.values(dayCb).reduce((sum, v) => sum + v, 0);

      return {
        id: e.id,
        date: dateStr,
        shift: shiftStr,
        dayOb,
        dayRec,
        dayDisp,
        dayCb,
        dayRecParticulars,
        dayDispParticulars,
        allRecParticulars,
        allDispParticulars,
        totalOb,
        totalRec,
        totalDisp,
        totalCb,
      };
    });

    parsedEntries.forEach(item => {
      if (!item || !Array.isArray(item.rows)) return;
      item.rows.forEach(r => {
        if (!r || !r.row_type) return;
        const values = r.values || {};
        if (r.row_type === 'RECEIPT') {
          const label = (r.row_label || '').trim() || 'Receipts';
          if (!receiptParticularsMap[label]) {
            receiptParticularsMap[label] = {};
            columns.forEach(c => (receiptParticularsMap[label][c.key] = 0));
          }
          columns.forEach(c => {
            const normK = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
            let valNum = 0;
            for (const [k, v] of Object.entries(values)) {
              if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normK) {
                const num = parseFloat(String(v));
                if (!isNaN(num)) {
                  valNum = num;
                  if (num !== 0) break;
                }
              }
            }
            receiptParticularsMap[label][c.key] += valNum;
          });
        }

        if (r.row_type === 'DISPOSAL') {
          const label = (r.row_label || '').trim() || 'Disposals';
          if (!disposalParticularsMap[label]) {
            disposalParticularsMap[label] = {};
            columns.forEach(c => (disposalParticularsMap[label][c.key] = 0));
          }
          columns.forEach(c => {
            const normK = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
            let valNum = 0;
            for (const [k, v] of Object.entries(values)) {
              if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normK) {
                const num = parseFloat(String(v));
                if (!isNaN(num)) {
                  valNum = num;
                  if (num !== 0) break;
                }
              }
            }
            disposalParticularsMap[label][c.key] += valNum;
          });
        }
      });
    });

    // Sum of all Receipts per column
    const totalReceiptsCol: Record<string, number> = {};
    columns.forEach(c => {
      totalReceiptsCol[c.key] = Object.values(receiptParticularsMap).reduce(
        (sum, pMap) => sum + (pMap[c.key] || 0), 0
      );
    });

    // Sum of all Disposals per column
    const totalDisposalsCol: Record<string, number> = {};
    columns.forEach(c => {
      totalDisposalsCol[c.key] = Object.values(disposalParticularsMap).reduce(
        (sum, pMap) => sum + (pMap[c.key] || 0), 0
      );
    });

    // Consolidated CB per column = OB + Total Receipts - Total Disposals
    const cbValues: Record<string, number> = {};
    columns.forEach(c => {
      cbValues[c.key] = (obValues[c.key] || 0) + (totalReceiptsCol[c.key] || 0) - (totalDisposalsCol[c.key] || 0);
    });

    // Grand totals across all product columns
    const grandTotalOB = Object.values(obValues).reduce((sum, v) => sum + v, 0);
    const grandTotalReceipts = Object.values(totalReceiptsCol).reduce((sum, v) => sum + v, 0);
    const grandTotalDisposals = Object.values(totalDisposalsCol).reduce((sum, v) => sum + v, 0);
    const grandTotalCB = Object.values(cbValues).reduce((sum, v) => sum + v, 0);

    return {
      entriesCount: filteredEntries.length,
      startDate: filteredEntries[0]?.entry_date,
      endDate: filteredEntries[filteredEntries.length - 1]?.entry_date,
      obValues,
      receiptParticularsMap,
      totalReceiptsCol,
      disposalParticularsMap,
      totalDisposalsCol,
      cbValues,
      grandTotalOB,
      grandTotalReceipts,
      grandTotalDisposals,
      grandTotalCB,
      dateWiseStatements,
    };
  }, [filteredEntries, columns]);

  // Month selection helpers
  const toggleMonth = (mVal: string) => {
    setSelectedMonths(prev =>
      prev.includes(mVal)
        ? (prev.length > 1 ? prev.filter(x => x !== mVal) : prev)
        : [...prev, mVal].sort()
    );
  };

  const selectQuarter = (monthsArr: string[]) => {
    setSelectedMonths(monthsArr);
  };

  // Year selection helpers
  const toggleYear = (yr: number) => {
    setSelectedYears(prev =>
      prev.includes(yr)
        ? (prev.length > 1 ? prev.filter(x => x !== yr) : prev)
        : [...prev, yr].sort((a, b) => b - a)
    );
  };

  const { showWarning, showError } = useConfirm();

  // Export Multi-Sheet Excel (Each daily statement in its own sheet tab like JULY-26STMT-1.xlsx)
  const handleExportMultiSheetExcel = async () => {
    if (!aggregatedReport || !aggregatedReport.startDate || !aggregatedReport.endDate) {
      await showWarning('Please select a valid date range first.', 'Invalid Date Range');
      return;
    }
    try {
      const url = `/api/export-excel?startDate=${aggregatedReport.startDate}&endDate=${aggregatedReport.endDate}&stock=true&multi_sheet=true`;
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to export multi-sheet Excel');
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const sParts = aggregatedReport.startDate.split('-');
      const eParts = aggregatedReport.endDate.split('-');
      const formattedS = sParts.length === 3 ? `${sParts[2]}-${sParts[1]}-${sParts[0]}` : aggregatedReport.startDate;
      const formattedE = eParts.length === 3 ? `${eParts[2]}-${eParts[1]}-${eParts[0]}` : aggregatedReport.endDate;
      a.download = `Stock-Statements-Daily-Sheets_${formattedS}_to_${formattedE}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      await showError(err instanceof Error ? err.message : 'Failed to export multi-sheet Excel file', 'Export Failed');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!aggregatedReport) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `Periodical Stock Summary Report (${aggregatedReport.startDate} to ${aggregatedReport.endDate})\n\n`;

    // Header row
    csvContent += `Section,Particulars,${columns.map(c => `"${c.label}"`).join(',')},Total\n`;

    // OB Row
    const obRowVals = columns.map(c => aggregatedReport.obValues[c.key] || 0);
    csvContent += `Opening Balance,Opening Balance,${obRowVals.join(',')},${aggregatedReport.grandTotalOB}\n`;

    // Receipts Rows
    Object.entries(aggregatedReport.receiptParticularsMap).forEach(([pName, pValues]) => {
      const rowVals = columns.map(c => pValues[c.key] || 0);
      const rowTotal = rowVals.reduce((sum, v) => sum + v, 0);
      csvContent += `Receipts,"${pName}",${rowVals.join(',')},${rowTotal}\n`;
    });
    const recTotals = columns.map(c => aggregatedReport.totalReceiptsCol[c.key] || 0);
    csvContent += `Receipts,TOTAL RECEIPTS,${recTotals.join(',')},${aggregatedReport.grandTotalReceipts}\n`;

    // Disposals Rows
    Object.entries(aggregatedReport.disposalParticularsMap).forEach(([pName, pValues]) => {
      const rowVals = columns.map(c => pValues[c.key] || 0);
      const rowTotal = rowVals.reduce((sum, v) => sum + v, 0);
      csvContent += `Disposals,"${pName}",${rowVals.join(',')},${rowTotal}\n`;
    });
    const dispTotals = columns.map(c => aggregatedReport.totalDisposalsCol[c.key] || 0);
    csvContent += `Disposals,TOTAL DISPOSALS,${dispTotals.join(',')},${aggregatedReport.grandTotalDisposals}\n`;

    // CB Row
    const cbRowVals = columns.map(c => aggregatedReport.cbValues[c.key] || 0);
    csvContent += `Closing Balance,Closing Balance,${cbRowVals.join(',')},${aggregatedReport.grandTotalCB}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Periodical_Stock_Report_${aggregatedReport.startDate}_to_${aggregatedReport.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render Product-Wise Date Table
  const renderProductWiseTable = () => {
    if (!aggregatedReport) return null;
    const activeKeys = selectedProductKeys.length === 0 ? columns.map(c => c.key) : selectedProductKeys;
    const isSingleProduct = activeKeys.length === 1;
    const recLabels = Object.keys(aggregatedReport.receiptParticularsMap);
    const dispLabels = Object.keys(aggregatedReport.disposalParticularsMap);
    const selectedCols = columns.filter(c => activeKeys.includes(c.key));

    const prodTitle = activeKeys.length === columns.length
      ? 'ALL Products (Consolidated Total)'
      : activeKeys.length === 1
        ? `${selectedCols[0]?.label || ''}`
        : `${activeKeys.length} Selected Products (${selectedCols.map(c => c.short_name || c.key).join(', ')})`;

    // Helper to render individual product statement card
    const renderSingleProductStatementCard = (pKey: string) => {
      const col = columns.find(c => c.key === pKey);
      const prodLabel = col?.label || col?.full_name || pKey;
      const shortName = col?.short_name || pKey;

      const pRecLabels = recLabels.filter(l =>
        aggregatedReport.dateWiseStatements.some(s => (s.dayRecParticulars?.[pKey]?.[l] || 0) !== 0)
      );
      const pDispLabels = dispLabels.filter(l =>
        aggregatedReport.dateWiseStatements.some(s => (s.dayDispParticulars?.[pKey]?.[l] || 0) !== 0)
      );

      let pPeriodOb = 0;
      let pPeriodRec = 0;
      let pPeriodDisp = 0;
      let pPeriodCb = 0;
      const pPeriodRecParticularsTotal: Record<string, number> = {};
      const pPeriodDispParticularsTotal: Record<string, number> = {};

      pRecLabels.forEach(l => (pPeriodRecParticularsTotal[l] = 0));
      pDispLabels.forEach(l => (pPeriodDispParticularsTotal[l] = 0));

      const pRows = aggregatedReport.dateWiseStatements.map((stmt, idx) => {
        const ob = stmt.dayOb[pKey] || 0;
        const totalRec = stmt.dayRec[pKey] || 0;
        const totalDisp = stmt.dayDisp[pKey] || 0;
        const cb = stmt.dayCb[pKey] !== undefined ? stmt.dayCb[pKey] : (ob + totalRec - totalDisp);

        if (idx === 0) pPeriodOb = ob;
        pPeriodRec += totalRec;
        pPeriodDisp += totalDisp;
        pPeriodCb = cb;

        const recVals: Record<string, number> = {};
        pRecLabels.forEach(l => {
          const val = stmt.dayRecParticulars?.[pKey]?.[l] || 0;
          recVals[l] = val;
          pPeriodRecParticularsTotal[l] += val;
        });

        const dispVals: Record<string, number> = {};
        pDispLabels.forEach(l => {
          const val = stmt.dayDispParticulars?.[pKey]?.[l] || 0;
          dispVals[l] = val;
          pPeriodDispParticularsTotal[l] += val;
        });

        return { stmt, ob, recVals, totalRec, dispVals, totalDisp, cb };
      });

      const hasParticulars = pRecLabels.length > 0 || pDispLabels.length > 0;

      return (
        <div key={`p_card_${pKey}`} className="card" style={{ marginBottom: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: 'linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>📦 Stock Statement:</span>
              <span style={{ fontSize: '1.05rem', color: 'var(--brand-primary)', fontWeight: 800 }}>{prodLabel}</span>
              <span style={{ fontSize: '0.75rem', background: '#0284c7', color: '#fff', padding: '3px 10px', borderRadius: 12, fontWeight: 700 }}>
                {shortName}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {pRows.length} Daily Statements ({fmtDate(aggregatedReport.startDate)} - {fmtDate(aggregatedReport.endDate)})
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ minWidth: hasParticulars ? 950 : 850, width: '100%' }}>
              <thead>
                <tr>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'center', width: 130, background: '#f1f5f9', verticalAlign: 'middle' }}>Date</th>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'center', width: 75, background: '#f1f5f9', verticalAlign: 'middle' }}>Shift</th>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 130, background: '#e0f2fe', color: '#0369a1', verticalAlign: 'middle' }}>Opening (OB)</th>

                  {pRecLabels.length > 0 ? (
                    <th colSpan={pRecLabels.length + 1} style={{ textAlign: 'center', background: '#d1fae5', color: '#047857', fontWeight: 700, fontSize: '0.8rem' }}>
                      📥 RECEIPTS ({shortName})
                    </th>
                  ) : (
                    <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 130, background: '#d1fae5', color: '#047857', verticalAlign: 'middle' }}>Total Receipts</th>
                  )}

                  {pDispLabels.length > 0 ? (
                    <th colSpan={pDispLabels.length + 1} style={{ textAlign: 'center', background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '0.8rem' }}>
                      📤 DISPOSALS ({shortName})
                    </th>
                  ) : (
                    <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 130, background: '#fef3c7', color: '#b45309', verticalAlign: 'middle' }}>Total Disposals</th>
                  )}

                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 130, background: '#e0e7ff', color: '#3730a3', verticalAlign: 'middle' }}>Closing (CB)</th>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'center', width: 100, background: '#f1f5f9', verticalAlign: 'middle' }}>Action</th>
                </tr>

                {hasParticulars && (
                  <tr>
                    {pRecLabels.map(l => (
                      <th key={`rec_hdr_${pKey}_${l}`} style={{ textAlign: 'right', minWidth: 95, fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46' }}>
                        {l}
                      </th>
                    ))}
                    {pRecLabels.length > 0 && (
                      <th style={{ textAlign: 'right', minWidth: 105, fontSize: '0.75rem', background: '#a7f3d0', color: '#047857', fontWeight: 800 }}>
                        TOTAL RECEIPTS
                      </th>
                    )}

                    {pDispLabels.map(l => (
                      <th key={`disp_hdr_${pKey}_${l}`} style={{ textAlign: 'right', minWidth: 95, fontSize: '0.72rem', background: '#fffbeb', color: '#92400e' }}>
                        {l}
                      </th>
                    ))}
                    {pDispLabels.length > 0 && (
                      <th style={{ textAlign: 'right', minWidth: 105, fontSize: '0.75rem', background: '#fde68a', color: '#b45309', fontWeight: 800 }}>
                        TOTAL DISPOSALS
                      </th>
                    )}
                  </tr>
                )}
              </thead>
              <tbody>
                {pRows.map(({ stmt, ob, recVals, totalRec, dispVals, totalDisp, cb }) => (
                  <tr key={`stmt_${pKey}_${stmt.id}_${stmt.date}_${stmt.shift}`}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {fmtDate(stmt.date)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: stmt.shift === 'D' ? '#fef3c7' : stmt.shift === 'N' ? '#e0e7ff' : '#dcfce7',
                        color: stmt.shift === 'D' ? '#b45309' : stmt.shift === 'N' ? '#3730a3' : '#15803d',
                      }}>
                        {stmt.shift === 'D' ? 'Day' : stmt.shift === 'N' ? 'Night' : 'Full Day'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 600, background: '#f0f9ff' }}>
                      {ob === 0 ? '—' : ob.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>

                    {pRecLabels.map(l => (
                      <td key={`rec_${pKey}_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                        {(recVals[l] || 0) === 0 ? '—' : recVals[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#059669', background: '#ecfdf5' }}>
                      {totalRec === 0 ? '—' : totalRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>

                    {pDispLabels.map(l => (
                      <td key={`disp_${pKey}_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                        {(dispVals[l] || 0) === 0 ? '—' : dispVals[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#b45309', background: '#fffbeb' }}>
                      {totalDisp === 0 ? '—' : totalDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>

                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 800, color: '#4338ca', background: '#eef2ff' }}>
                      {cb === 0 ? '—' : cb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link
                        href={`/dashboard/stock/${stmt.date}/${stmt.shift}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '3px 10px', fontWeight: 600 }}
                      >
                        👁️ View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                  <td colSpan={2} style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                    PERIOD TOTAL ({shortName})
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#0369a1', background: '#e0f2fe' }}>
                    {pPeriodOb === 0 ? '—' : pPeriodOb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>

                  {pRecLabels.map(l => (
                    <td key={`tot_rec_${pKey}_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857' }}>
                      {(pPeriodRecParticularsTotal[l] || 0) === 0 ? '—' : pPeriodRecParticularsTotal[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857', background: '#a7f3d0' }}>
                    {pPeriodRec === 0 ? '—' : pPeriodRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>

                  {pDispLabels.map(l => (
                    <td key={`tot_disp_${pKey}_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#b45309' }}>
                      {(pPeriodDispParticularsTotal[l] || 0) === 0 ? '—' : pPeriodDispParticularsTotal[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#b45309', background: '#fde68a' }}>
                    {pPeriodDisp === 0 ? '—' : pPeriodDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>

                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#3730a3', background: '#c7d2fe', fontSize: '0.88rem' }}>
                    {pPeriodCb === 0 ? '—' : pPeriodCb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    };

    if (productSubViewMode === 'SEPARATE') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeKeys.map(k => renderSingleProductStatementCard(k))}
        </div>
      );
    }

    // Period summary accumulator for Combined Particulars Breakdown table
    let periodTotalOb = 0;
    let periodTotalRec = 0;
    let periodTotalDisp = 0;
    let periodTotalCb = 0;
    const periodRecParticularsTotal: Record<string, number> = {};
    const periodDispParticularsTotal: Record<string, number> = {};

    recLabels.forEach(l => (periodRecParticularsTotal[l] = 0));
    dispLabels.forEach(l => (periodDispParticularsTotal[l] = 0));

    const tableRows = aggregatedReport.dateWiseStatements.map((stmt, idx) => {
      let ob = 0;
      let totalRec = 0;
      let totalDisp = 0;

      activeKeys.forEach(k => {
        ob += (stmt.dayOb[k] || 0);
        totalRec += (stmt.dayRec[k] || 0);
        totalDisp += (stmt.dayDisp[k] || 0);
      });
      const cb = ob + totalRec - totalDisp;

      if (idx === 0) periodTotalOb = ob;

      periodTotalRec += totalRec;
      periodTotalDisp += totalDisp;
      periodTotalCb = cb;

      const recVals: Record<string, number> = {};
      recLabels.forEach(l => {
        let val = 0;
        activeKeys.forEach(k => {
          val += (stmt.dayRecParticulars?.[k]?.[l] || 0);
        });
        recVals[l] = val;
        periodRecParticularsTotal[l] += val;
      });

      const dispVals: Record<string, number> = {};
      dispLabels.forEach(l => {
        let val = 0;
        activeKeys.forEach(k => {
          val += (stmt.dayDispParticulars?.[k]?.[l] || 0);
        });
        dispVals[l] = val;
        periodDispParticularsTotal[l] += val;
      });

      return {
        stmt,
        ob,
        recVals,
        totalRec,
        dispVals,
        totalDisp,
        cb,
      };
    });

    // Single Product View: Show Opening (OB), Total Receipts, Total Disposals, Closing (CB)
    if (isSingleProduct) {
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ minWidth: 900, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 140, background: '#f1f5f9' }}>Date</th>
                <th style={{ textAlign: 'center', width: 80, background: '#f1f5f9' }}>Shift</th>
                <th style={{ textAlign: 'right', width: 140, background: '#e0f2fe', color: '#0369a1' }}>Opening (OB)</th>
                <th style={{ textAlign: 'right', width: 140, background: '#d1fae5', color: '#047857' }}>Total Receipts</th>
                <th style={{ textAlign: 'right', width: 140, background: '#fef3c7', color: '#b45309' }}>Total Disposals</th>
                <th style={{ textAlign: 'right', width: 150, background: '#e0e7ff', color: '#3730a3' }}>Closing (CB)</th>
                <th style={{ textAlign: 'center', width: 120, background: '#f1f5f9' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ stmt, ob, totalRec, totalDisp, cb }) => (
                <tr key={`p_stmt_${stmt.id}_${stmt.date}_${stmt.shift}`}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtDate(stmt.date)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: stmt.shift === 'D' ? '#fef3c7' : stmt.shift === 'N' ? '#e0e7ff' : '#dcfce7',
                      color: stmt.shift === 'D' ? '#b45309' : stmt.shift === 'N' ? '#3730a3' : '#15803d',
                    }}>
                      {stmt.shift === 'D' ? 'Day' : stmt.shift === 'N' ? 'Night' : 'Full Day'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 600, background: '#f0f9ff' }}>
                    {ob === 0 ? '—' : ob.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#059669', background: '#ecfdf5' }}>
                    {totalRec === 0 ? '—' : totalRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#b45309', background: '#fffbeb' }}>
                    {totalDisp === 0 ? '—' : totalDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 800, color: '#4338ca', background: '#eef2ff' }}>
                    {cb === 0 ? '—' : cb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Link
                      href={`/dashboard/stock/${stmt.date}/${stmt.shift}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 10px', fontWeight: 600 }}
                    >
                      👁️ View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                <td colSpan={2} style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                  PERIOD TOTAL ({prodTitle})
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#0369a1', background: '#e0f2fe' }}>
                  {periodTotalOb === 0 ? '—' : periodTotalOb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857', background: '#a7f3d0' }}>
                  {periodTotalRec === 0 ? '—' : periodTotalRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#b45309', background: '#fde68a' }}>
                  {periodTotalDisp === 0 ? '—' : periodTotalDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#3730a3', background: '#c7d2fe', fontSize: '0.88rem' }}>
                  {periodTotalCb === 0 ? '—' : periodTotalCb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      );
    }

    // Multi-Product Detailed View with Breakdown sub-columns
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="inline-table" style={{ minWidth: 1200, width: '100%' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ textAlign: 'center', width: 120, background: '#f1f5f9', verticalAlign: 'middle' }}>Date</th>
              <th rowSpan={2} style={{ textAlign: 'center', width: 70, background: '#f1f5f9', verticalAlign: 'middle' }}>Shift</th>
              <th rowSpan={2} style={{ textAlign: 'right', width: 120, background: '#e0f2fe', color: '#0369a1', verticalAlign: 'middle' }}>Opening (OB)</th>
              
              {recLabels.length > 0 ? (
                <th colSpan={recLabels.length + 1} style={{ textAlign: 'center', background: '#d1fae5', color: '#047857', fontWeight: 700, fontSize: '0.8rem' }}>
                  📥 RECEIPTS ({prodTitle})
                </th>
              ) : (
                <th style={{ textAlign: 'right', width: 120, background: '#d1fae5', color: '#047857', verticalAlign: 'middle' }}>Total Receipts</th>
              )}

              {dispLabels.length > 0 ? (
                <th colSpan={dispLabels.length + 1} style={{ textAlign: 'center', background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '0.8rem' }}>
                  📤 DISPOSALS ({prodTitle})
                </th>
              ) : (
                <th style={{ textAlign: 'right', width: 120, background: '#fef3c7', color: '#b45309', verticalAlign: 'middle' }}>Total Disposals</th>
              )}

              <th rowSpan={2} style={{ textAlign: 'right', width: 130, background: '#e0e7ff', color: '#3730a3', verticalAlign: 'middle' }}>Closing (CB)</th>
              <th rowSpan={2} style={{ textAlign: 'center', width: 110, background: '#f1f5f9', verticalAlign: 'middle' }}>Action</th>
            </tr>

            {(recLabels.length > 0 || dispLabels.length > 0) && (
              <tr>
                {recLabels.map(l => (
                  <th key={`rec_hdr_${l}`} style={{ textAlign: 'right', minWidth: 100, fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46' }}>
                    {l}
                  </th>
                ))}
                {recLabels.length > 0 && (
                  <th style={{ textAlign: 'right', minWidth: 110, fontSize: '0.75rem', background: '#a7f3d0', color: '#047857', fontWeight: 800 }}>
                    TOTAL RECEIPTS
                  </th>
                )}

                {dispLabels.map(l => (
                  <th key={`disp_hdr_${l}`} style={{ textAlign: 'right', minWidth: 100, fontSize: '0.72rem', background: '#fffbeb', color: '#92400e' }}>
                    {l}
                  </th>
                ))}
                {dispLabels.length > 0 && (
                  <th style={{ textAlign: 'right', minWidth: 110, fontSize: '0.75rem', background: '#fde68a', color: '#b45309', fontWeight: 800 }}>
                    TOTAL DISPOSALS
                  </th>
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {tableRows.map(({ stmt, ob, recVals, totalRec, dispVals, totalDisp, cb }) => (
              <tr key={`p_stmt_${stmt.id}_${stmt.date}_${stmt.shift}`}>
                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmtDate(stmt.date)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: stmt.shift === 'D' ? '#fef3c7' : stmt.shift === 'N' ? '#e0e7ff' : '#dcfce7',
                    color: stmt.shift === 'D' ? '#b45309' : stmt.shift === 'N' ? '#3730a3' : '#15803d',
                  }}>
                    {stmt.shift === 'D' ? 'Day' : stmt.shift === 'N' ? 'Night' : 'Full Day'}
                  </span>
                </td>

                {/* OB */}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 600, background: '#f0f9ff' }}>
                  {ob === 0 ? '—' : ob.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>

                {/* Receipt breakdown */}
                {recLabels.map(l => (
                  <td key={`rec_val_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                    {(recVals[l] || 0) === 0 ? '—' : recVals[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#059669', background: '#ecfdf5' }}>
                  {totalRec === 0 ? '—' : totalRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>

                {/* Disposal breakdown */}
                {dispLabels.map(l => (
                  <td key={`disp_val_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                    {(dispVals[l] || 0) === 0 ? '—' : dispVals[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#b45309', background: '#fffbeb' }}>
                  {totalDisp === 0 ? '—' : totalDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>

                {/* CB */}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 800, color: '#4338ca', background: '#eef2ff' }}>
                  {cb === 0 ? '—' : cb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>

                {/* Action */}
                <td style={{ textAlign: 'center' }}>
                  <Link
                    href={`/dashboard/stock/${stmt.date}/${stmt.shift}`}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 10px', fontWeight: 600 }}
                  >
                    👁️ View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Summary Footer Row */}
          <tfoot>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
              <td colSpan={2} style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                PERIOD TOTAL ({prodTitle})
              </td>

              {/* Period OB */}
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#0369a1', background: '#e0f2fe' }}>
                {periodTotalOb === 0 ? '—' : periodTotalOb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </td>

              {/* Period Receipt Particulars Totals */}
              {recLabels.map(l => (
                <td key={`tot_rec_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857' }}>
                  {(periodRecParticularsTotal[l] || 0) === 0 ? '—' : periodRecParticularsTotal[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857', background: '#a7f3d0' }}>
                {periodTotalRec === 0 ? '—' : periodTotalRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </td>

              {/* Period Disposal Particulars Totals */}
              {dispLabels.map(l => (
                <td key={`tot_disp_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#b45309' }}>
                  {(periodDispParticularsTotal[l] || 0) === 0 ? '—' : periodDispParticularsTotal[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#b45309', background: '#fde68a' }}>
                {periodTotalDisp === 0 ? '—' : periodTotalDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </td>

              {/* Period Final CB */}
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#3730a3', background: '#c7d2fe', fontSize: '0.88rem' }}>
                {periodTotalCb === 0 ? '—' : periodTotalCb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </td>

              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <>
      <Header
        title="Periodical Summary Report"
        subtitle="Consolidated Stock Statement over custom monthly, annual & date ranges"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {aggregatedReport && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
                  onClick={handleExportMultiSheetExcel}
                  title="Extract Excel file with each daily Stock Statement in an individual sheet tab"
                >
                  📥 Extract Multi-Sheet Excel (Daily Sheets)
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                  📥 Export Consolidated CSV
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  🖨️ Print Report
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="page-body animate-fade-in">
        {/* ─── Mode Selection Control Card ────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📅 Filter Period Selection Mode</span>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 8, gap: 4 }}>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'MONTH' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterMode('MONTH')}
                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                📅 Month Selection
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'YEAR' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterMode('YEAR')}
                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                🗓️ Year Selection
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'CUSTOM' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterMode('CUSTOM')}
                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                📆 Custom Date Range
              </button>
            </div>
          </div>

          {/* Mode 1 Controls: Month Selection */}
          {filterMode === 'MONTH' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 600 }}>Select Year:</label>
                  <select
                    className="form-select"
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                    style={{ width: 140 }}
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Quick Quarter / Selection Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setSelectedMonths(MONTH_NAMES.map(m => m.val))}>
                    Select All Months
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => selectQuarter(['01', '02', '03'])}>
                    Q1 (Jan-Mar)
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => selectQuarter(['04', '05', '06'])}>
                    Q2 (Apr-Jun)
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => selectQuarter(['07', '08', '09'])}>
                    Q3 (Jul-Sep)
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => selectQuarter(['10', '11', '12'])}>
                    Q4 (Oct-Dec)
                  </button>
                </div>
              </div>

              {/* Month Selection Chips */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 8 }}>
                  Select Months (Multiple allowed):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {MONTH_NAMES.map(m => {
                    const isSelected = selectedMonths.includes(m.val);
                    return (
                      <button
                        key={m.val}
                        type="button"
                        onClick={() => toggleMonth(m.val)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(14, 165, 233, 0.12)' : '#fff',
                          color: isSelected ? 'var(--brand-primary)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span>{m.name}</span>
                        {isSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2 Controls: Year Selection */}
          {filterMode === 'YEAR' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                  Select Year(s) (Multiple allowed):
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setSelectedYears([...availableYears])}>
                    Select All Years
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setSelectedYears([currentYearNum])}>
                    Current Year Only
                  </button>
                </div>
              </div>

              {/* Year Selection Chips */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {availableYears.map(yr => {
                  const isSelected = selectedYears.includes(yr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => toggleYear(yr)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: isSelected ? '2px solid #059669' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(16, 185, 129, 0.12)' : '#fff',
                        color: isSelected ? '#047857' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>🗓️ {yr}</span>
                      {isSelected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode 3 Controls: Custom Date Selection */}
          {filterMode === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 600 }}>From Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{ width: 170 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 600 }}>To Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ width: 170 }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Select exact custom start and end dates for periodic summary aggregation.
              </div>
            </div>
          )}
        </div>

        {/* ─── Loading / Empty / Summary Table Section ─────────────────────────── */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <span className="spinner" /> Aggregating periodical stock statement...
          </div>
        ) : !aggregatedReport ? (
          <div className="card">
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📦</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                No stock statement entries found for the selected period
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                Try adjusting the selected months, years, or date range filters above.
              </div>
              <Link href="/dashboard/stock/new" className="btn btn-primary btn-sm">
                ➕ Create Stock Statement Entry
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Statement Selector Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div
                className="card"
                onClick={() => setActiveStatementType('STOCK')}
                style={{
                  padding: 18,
                  cursor: 'pointer',
                  background: activeStatementType === 'STOCK' ? 'rgba(14, 165, 233, 0.08)' : '#fff',
                  border: activeStatementType === 'STOCK' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderLeft: '6px solid var(--brand-primary)',
                  transition: 'all 0.2s ease',
                  boxShadow: activeStatementType === 'STOCK' ? '0 4px 12px rgba(14, 165, 233, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                    📦 Stock Statement
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: '#0284c7', color: '#fff', fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                  Date-Wise Stock Statement
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {aggregatedReport.dateWiseStatements.length} Statements ({fmtDate(aggregatedReport.startDate)} - {fmtDate(aggregatedReport.endDate)})
                </div>
              </div>

              <div
                className="card"
                onClick={() => setActiveStatementType('STG')}
                style={{
                  padding: 18,
                  cursor: 'pointer',
                  background: activeStatementType === 'STG' ? 'rgba(16, 185, 129, 0.08)' : '#fff',
                  border: activeStatementType === 'STG' ? '2px solid #10b981' : '1px solid var(--border)',
                  borderLeft: '6px solid #10b981',
                  transition: 'all 0.2s ease',
                  boxShadow: activeStatementType === 'STG' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>
                    ⚖️ STG Statement
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: '#f59e0b', color: '#fff', fontWeight: 700 }}>
                    FUTURE PLAN
                  </span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                  STG Solid Balance
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Date-wise STG Statement (Planned for future)
                </div>
              </div>

              <div
                className="card"
                onClick={() => setActiveStatementType('TS')}
                style={{
                  padding: 18,
                  cursor: 'pointer',
                  background: activeStatementType === 'TS' ? 'rgba(99, 102, 241, 0.08)' : '#fff',
                  border: activeStatementType === 'TS' ? '2px solid #6366f1' : '1px solid var(--border)',
                  borderLeft: '6px solid #6366f1',
                  transition: 'all 0.2s ease',
                  boxShadow: activeStatementType === 'TS' ? '0 4px 12px rgba(99, 102, 241, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#4f46e5', textTransform: 'uppercase', fontWeight: 700 }}>
                    📊 TS Statement
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: '#f59e0b', color: '#fff', fontWeight: 700 }}>
                    FUTURE PLAN
                  </span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                  TS Quality Statement
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Date-wise TS Sample Statement (Planned for future)
                </div>
              </div>
            </div>

            {/* Render selected statement view */}
            {activeStatementType !== 'STOCK' ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 6 }}>
                  {activeStatementType === 'STG' ? 'STG Solid Balance Statement' : 'TS Quality Sample Statement'} (Planned for Future)
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16, maxWidth: 500, margin: '0 auto 16px' }}>
                  Date-wise {activeStatementType} statements can be planned in future releases. Date-wise Consolidated Stock Statements are active above.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveStatementType('STOCK')}
                >
                  📦 Switch to Date-Wise Stock Statements
                </button>
              </div>
            ) : (
              <>
                {/* ─── DATE-WISE STOCK STATEMENTS CARD (CONSOLIDATED OR PRODUCT-WISE) ─── */}
                <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
                  {/* Header & Controls */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📅 Date-Wise Stock Statements</span>
                        <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                          {aggregatedReport.dateWiseStatements.length} Statements
                        </span>
                      </div>

                      {/* View Mode Switcher */}
                      <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8, gap: 3 }}>
                        {/* <button
                          type="button"
                          className={`btn btn-sm ${dateWiseViewMode === 'CONSOLIDATED' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setDateWiseViewMode('CONSOLIDATED')}
                          style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          🌐 Consolidated Date View
                        </button> */}
                        <button
                          type="button"
                          className={`btn btn-sm ${dateWiseViewMode === 'PRODUCT_WISE' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setDateWiseViewMode('PRODUCT_WISE')}
                          style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          📦 Product-Wise Date View
                        </button>
                      </div>

                      {/* Multi-Select Product Checkbox Popover Dropdown */}
                      {dateWiseViewMode === 'PRODUCT_WISE' && (
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: '#fff',
                              borderColor: 'var(--brand-primary)',
                              color: 'var(--brand-primary)',
                              padding: '4px 12px',
                              height: 34,
                            }}
                          >
                            <span>
                              {(selectedProductKeys.length === 0 || selectedProductKeys.length === columns.length)
                                ? '📦 All Products Selected'
                                : selectedProductKeys.length === 1
                                  ? `📦 Product: ${columns.find(c => c.key === selectedProductKeys[0])?.label || selectedProductKeys[0]}`
                                  : `📦 ${selectedProductKeys.length} Products Selected`}
                            </span>
                            <span style={{ fontSize: '0.7rem' }}>{isProductDropdownOpen ? '▲' : '▼'}</span>
                          </button>

                          {isProductDropdownOpen && (
                            <>
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                onClick={() => setIsProductDropdownOpen(false)}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  marginTop: 6,
                                  width: 320,
                                  background: '#ffffff',
                                  borderRadius: 8,
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                                  border: '1px solid var(--border)',
                                  zIndex: 100,
                                  padding: 12,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                    Filter Products ({(selectedProductKeys.length === 0 ? columns.length : selectedProductKeys.length)}/{columns.length}):
                                  </span>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      type="button"
                                      style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                      onClick={() => setSelectedProductKeys(columns.map(c => c.key))}
                                    >
                                      Select All
                                    </button>
                                    <span style={{ fontSize: '0.72rem', color: '#ccc' }}>|</span>
                                    <button
                                      type="button"
                                      style={{ fontSize: '0.72rem', background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                      onClick={() => setSelectedProductKeys(columns.length > 0 ? [columns[0].key] : [])}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {columns.map(c => {
                                    const activeKeys = selectedProductKeys.length === 0 ? columns.map(col => col.key) : selectedProductKeys;
                                    const isChecked = activeKeys.includes(c.key);
                                    return (
                                      <label
                                        key={`chk_${c.key}`}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          fontSize: '0.8rem',
                                          cursor: 'pointer',
                                          padding: '5px 8px',
                                          borderRadius: 6,
                                          background: isChecked ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (isChecked) {
                                              if (activeKeys.length > 1) {
                                                setSelectedProductKeys(activeKeys.filter(k => k !== c.key));
                                              }
                                            } else {
                                              setSelectedProductKeys([...activeKeys, c.key]);
                                            }
                                          }}
                                          style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                                          {c.label} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({c.short_name || c.key})</span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Sub-view switcher for Product-Wise View */}
                      {dateWiseViewMode === 'PRODUCT_WISE' && (
                        <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8, gap: 3 }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${productSubViewMode === 'SEPARATE' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setProductSubViewMode('SEPARATE')}
                            style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                            title="Render each selected product in a separate statement table"
                          >
                            📑 Separate Statements
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${productSubViewMode === 'COMBINED' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setProductSubViewMode('COMBINED')}
                            style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                            title="Render combined particulars breakdown table"
                          >
                            📊 Particulars Breakdown
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Click "👁️ View" on any date to view complete statement details
                    </div>
                  </div>

                  {/* ─── OPTION 1: CONSOLIDATED DATE-WISE TABLE ──────────────────────── */}
                  {dateWiseViewMode === 'CONSOLIDATED' ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="inline-table" style={{ minWidth: 1000, width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'center', width: 140, background: '#f1f5f9' }}>Date</th>
                            <th style={{ textAlign: 'center', width: 80, background: '#f1f5f9' }}>Shift</th>
                            <th style={{ textAlign: 'right', width: 130, background: '#f1f5f9' }}>Opening (OB)</th>
                            <th style={{ textAlign: 'right', width: 130, background: '#f1f5f9' }}>Total Receipts</th>
                            <th style={{ textAlign: 'right', width: 130, background: '#f1f5f9' }}>Total Disposals</th>
                            <th style={{ textAlign: 'right', width: 140, background: '#e0e7ff', color: '#3730a3' }}>Closing (CB)</th>
                            <th style={{ textAlign: 'center', width: 130, background: '#f1f5f9' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregatedReport.dateWiseStatements.map((stmt) => (
                            <tr key={`stmt_${stmt.id}_${stmt.date}_${stmt.shift}`}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {fmtDate(stmt.date)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: stmt.shift === 'D' ? '#fef3c7' : stmt.shift === 'N' ? '#e0e7ff' : '#dcfce7',
                                  color: stmt.shift === 'D' ? '#b45309' : stmt.shift === 'N' ? '#3730a3' : '#15803d',
                                }}>
                                  {stmt.shift === 'D' ? 'Day' : stmt.shift === 'N' ? 'Night' : 'Full Day'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 600 }}>
                                {stmt.totalOb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 600, color: '#059669' }}>
                                {stmt.totalRec === 0 ? '—' : stmt.totalRec.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 600, color: '#b45309' }}>
                                {stmt.totalDisp === 0 ? '—' : stmt.totalDisp.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#4338ca', background: '#eef2ff' }}>
                                {stmt.totalCb.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <Link
                                  href={`/dashboard/stock/${stmt.date}/${stmt.shift}`}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '3px 10px', fontWeight: 600 }}
                                >
                                  👁️ View Statement
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* ─── OPTION 2: PRODUCT-WISE DATE-WISE TABLE ──────────────────────── */
                    renderProductWiseTable()
                  )}
                </div>

                {/* ─── CONSOLIDATED PERIODICAL STOCK STATEMENT TABLE (Only in Consolidated Date View) ─── */}
                {/* dateWiseViewMode === 'CONSOLIDATED' && (
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        📊 Consolidated Period Stock Statement ({fmtDate(aggregatedReport.startDate)} - {fmtDate(aggregatedReport.endDate)})
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="no-print">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Summed over {aggregatedReport.entriesCount} days
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }}
                          onClick={handleExportMultiSheetExcel}
                          title="Extract Excel file with each daily statement in an individual sheet tab"
                        >
                          📥 Extract Multi-Sheet Excel
                        </button>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="inline-table" style={{ minWidth: 1200, width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', minWidth: 240, background: '#f1f5f9' }}>Particulars</th>
                            {columns.map(col => (
                              <th key={col.key} style={{ minWidth: 110, fontSize: '0.68rem', textAlign: 'center', padding: '8px 4px', background: '#f1f5f9' }}>
                                <div style={{ fontWeight: 700 }}>{col.short_name || col.label}</div>
                              </th>
                            ))}
                            <th style={{ minWidth: 120, fontSize: '0.7rem', textAlign: 'center', padding: '8px 4px', fontWeight: 700, background: '#e2e8f0' }}>
                              Row Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: 'rgba(14, 165, 233, 0.06)' }}>
                            <td style={{ fontWeight: 700, color: 'var(--brand-primary)', padding: '10px 12px' }}>
                              Opening Balance (OB)
                            </td>
                            {columns.map(col => {
                              const val = aggregatedReport.obValues[col.key] || 0;
                              return (
                                <td key={col.key} style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-numbers)', padding: '8px' }}>
                                  {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-numbers)', padding: '8px', background: 'rgba(14, 165, 233, 0.12)', color: 'var(--brand-primary)' }}>
                              {aggregatedReport.grandTotalOB.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </td>
                          </tr>

                          <tr style={{ background: '#ecfdf5' }}>
                            <td colSpan={columns.length + 2} style={{ fontWeight: 700, color: '#047857', padding: '8px 12px', fontSize: '0.85rem' }}>
                              📥 Receipts (Period Total)
                            </td>
                          </tr>
                          {Object.entries(aggregatedReport.receiptParticularsMap).map(([pName, pValues]) => {
                            const rowTotal = columns.reduce((sum, c) => sum + (pValues[c.key] || 0), 0);
                            return (
                              <tr key={`rec_${pName}`}>
                                <td style={{ paddingLeft: 24, fontWeight: 500 }}>{pName}</td>
                                {columns.map(col => {
                                  const val = pValues[col.key] || 0;
                                  return (
                                    <td key={col.key} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', padding: '8px' }}>
                                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-numbers)', padding: '8px', background: '#f0fdf4' }}>
                                  {rowTotal === 0 ? '—' : rowTotal.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#d1fae5', borderTop: '1px solid #a7f3d0', borderBottom: '2px solid #059669' }}>
                            <td style={{ fontWeight: 700, color: '#047857', padding: '10px 12px' }}>
                              TOTAL RECEIPTS
                            </td>
                            {columns.map(col => {
                              const val = aggregatedReport.totalReceiptsCol[col.key] || 0;
                              return (
                                <td key={col.key} style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-numbers)', padding: '8px', color: '#047857' }}>
                                  {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', padding: '8px', color: '#047857', background: '#a7f3d0' }}>
                              {aggregatedReport.grandTotalReceipts.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </td>
                          </tr>

                          <tr style={{ background: '#fffbeb' }}>
                            <td colSpan={columns.length + 2} style={{ fontWeight: 700, color: '#b45309', padding: '8px 12px', fontSize: '0.85rem' }}>
                              📤 Disposals (Period Total)
                            </td>
                          </tr>
                          {Object.entries(aggregatedReport.disposalParticularsMap).map(([pName, pValues]) => {
                            const rowTotal = columns.reduce((sum, c) => sum + (pValues[c.key] || 0), 0);
                            return (
                              <tr key={`disp_${pName}`}>
                                <td style={{ paddingLeft: 24, fontWeight: 500 }}>{pName}</td>
                                {columns.map(col => {
                                  const val = pValues[col.key] || 0;
                                  return (
                                    <td key={col.key} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', padding: '8px' }}>
                                      {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-numbers)', padding: '8px', background: '#fef3c7' }}>
                                  {rowTotal === 0 ? '—' : rowTotal.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#fef3c7', borderTop: '1px solid #fde68a', borderBottom: '2px solid #d97706' }}>
                            <td style={{ fontWeight: 700, color: '#b45309', padding: '10px 12px' }}>
                              TOTAL DISPOSALS
                            </td>
                            {columns.map(col => {
                              const val = aggregatedReport.totalDisposalsCol[col.key] || 0;
                              return (
                                <td key={col.key} style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-numbers)', padding: '8px', color: '#b45309' }}>
                                  {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', padding: '8px', color: '#b45309', background: '#fde68a' }}>
                              {aggregatedReport.grandTotalDisposals.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </td>
                          </tr>

                          <tr style={{ background: 'rgba(99, 102, 241, 0.08)', borderTop: '2px solid #4f46e5' }}>
                            <td style={{ fontWeight: 800, color: '#4338ca', padding: '12px 12px', fontSize: '0.9rem' }}>
                              Closing Balance (CB)
                            </td>
                            {columns.map(col => {
                              const val = aggregatedReport.cbValues[col.key] || 0;
                              return (
                                <td key={col.key} style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-numbers)', padding: '8px', color: '#4338ca' }}>
                                  {val === 0 ? '—' : val.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-numbers)', padding: '8px', color: '#4338ca', background: 'rgba(99, 102, 241, 0.18)', fontSize: '0.95rem' }}>
                              {aggregatedReport.grandTotalCB.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) */}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
