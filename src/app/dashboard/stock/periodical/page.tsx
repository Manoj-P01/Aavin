'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import XLSX from 'xlsx-js-style';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import StockReport from '@/components/reports/StockReport';
import { useConfirm } from '@/context/ConfirmContext';
import { fmtDate } from '@/lib/calculations';
import type { Entry, StockRow, SeparationDetails } from '@/lib/types';

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

interface VirtualizedProductListProps {
  products: ProductCol[];
  aggregatedReport?: any;
  selectedProductKey: string | null;
  onSelectProduct: (pKey: string) => void;
  height?: number;
  itemHeight?: number;
}

function VirtualizedProductList({
  products,
  selectedProductKey,
  onSelectProduct,
  height = 640,
  itemHeight = 50,
}: VirtualizedProductListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = products.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
  const endIndex = Math.min(products.length, Math.ceil((scrollTop + height) / itemHeight) + 2);
  const visibleProducts = products.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height,
        overflowY: 'auto',
        position: 'relative',
        borderRadius: '0 0 8px 8px',
        background: '#fafafa',
      }}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleProducts.map((prod, idx) => {
          const actualIndex = startIndex + idx;
          const pKey = prod.key;
          const isSelected = selectedProductKey === pKey;

          return (
            <div
              key={`v_prod_${pKey}_${actualIndex}`}
              onClick={() => onSelectProduct(pKey)}
              style={{
                position: 'absolute',
                top: actualIndex * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight - 6,
                margin: '3px 6px',
                padding: '8px 12px',
                borderRadius: 8,
                background: isSelected ? '#f0f9ff' : '#ffffff',
                border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                boxShadow: isSelected ? '0 4px 12px rgba(14, 165, 233, 0.2)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📦 {prod.label}</span>
                {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />}
              </div>
              <span style={{
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: '0.7rem',
                fontWeight: 700,
                background: isSelected ? '#0284c7' : '#e2e8f0',
                color: isSelected ? '#ffffff' : '#475569',
              }}>
                {prod.short_name || prod.key}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
            } catch (err) { }
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

  // Statement Selector Tab State: 'DAILY' | 'STOCK' | 'STG' | 'TS'
  const [activeStatementType, setActiveStatementType] = useState<'DAILY' | 'STOCK' | 'STG' | 'TS'>('DAILY');

  // Date-Wise View Mode State: 'CONSOLIDATED' | 'PRODUCT_WISE'
  const [dateWiseViewMode, setDateWiseViewMode] = useState<'CONSOLIDATED' | 'PRODUCT_WISE'>('PRODUCT_WISE');
  // Sub-view mode for Product-Wise View: 'VIRTUALIZED' (master-detail list view) | 'SEPARATE' (individual tables) | 'COMBINED' (particulars matrix)
  const [productSubViewMode, setProductSubViewMode] = useState<'VIRTUALIZED' | 'SEPARATE' | 'COMBINED'>('VIRTUALIZED');
  // Multi-select product keys for Product-Wise View
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  // Checkbox dropdown popover toggle state
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);

  // Virtualized Product List Master-Detail State
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedProductMasterKey, setSelectedProductMasterKey] = useState<string | null>(null);

  // Product-Wise Date View Pagination state: page number per product key & page size (default 5 items per page)
  const [productWisePageMap, setProductWisePageMap] = useState<Record<string, number>>({});
  const [productWisePageSize, setProductWisePageSize] = useState<number>(5);

  // Reset pagination state whenever filteredEntries change
  useEffect(() => {
    setProductWisePageMap({});
  }, [filteredEntries]);



  const setProductPage = (pKey: string, pageNum: number) => {
    setProductWisePageMap(prev => {
      const updated = { ...prev };
      columns.forEach(c => {
        updated[c.key] = pageNum;
      });
      return updated;
    });
  };

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
      } catch (err) { }

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
        } catch (err) { }
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

  // Export Periodical Excel with separate product sheets & exact naming conventions
  const handleExportPeriodicalExcel = async () => {
    if (!aggregatedReport || !aggregatedReport.startDate || !aggregatedReport.endDate) {
      await showWarning('Please select a valid period first.', 'Invalid Period');
      return;
    }

    const activeKeys = selectedProductKeys.length === 0 ? columns.map(c => c.key) : selectedProductKeys;
    const showBreakdown = productSubViewMode === 'SEPARATE';

    // 1. Construct Product Part of Filename
    let prodPart = 'All-Product';
    if (activeKeys.length === 1) {
      const col = columns.find(c => c.key === activeKeys[0]);
      const pName = col?.short_name || col?.label || col?.full_name || activeKeys[0];
      prodPart = pName.replace(/[^a-zA-Z0-9_-]/g, '-');
    } else if (activeKeys.length === columns.length) {
      prodPart = 'All-Product';
    } else {
      prodPart = 'Selected-Products';
    }

    // 2. Construct Period Part of Filename
    let periodPart = '';
    if (filterMode === 'MONTH') {
      const monthNames = selectedMonths.map(m => {
        const mItem = MONTH_NAMES.find(x => x.val === m);
        return mItem ? mItem.name : m;
      });
      periodPart = `${monthNames.join('-')}-${selectedYear}`;
    } else if (filterMode === 'YEAR') {
      const sortedYears = [...selectedYears].sort((a, b) => a - b);
      periodPart = `${sortedYears.join('-')}`;
    } else if (filterMode === 'CUSTOM') {
      const sParts = fromDate.split('-');
      const eParts = toDate.split('-');
      const fmtFrom = sParts.length === 3 ? `${sParts[2]}-${sParts[1]}-${sParts[0]}` : fromDate;
      const fmtTo = eParts.length === 3 ? `${eParts[2]}-${eParts[1]}-${eParts[0]}` : toDate;
      periodPart = `${fmtFrom}-to-${fmtTo}`;
    }

    const fileName = `Stock-Statement-${prodPart}-${periodPart}.xlsx`;

    // 3. Create Excel Workbook
    const wb = XLSX.utils.book_new();

    const makeCell = (v: any, opts?: { isHeader?: boolean; isBold?: boolean; isNum?: boolean; bg?: string; color?: string }) => {
      let t = 's';
      if (typeof v === 'number') t = 'n';
      else if (typeof v === 'boolean') t = 'b';

      const style: any = {
        font: {
          name: 'Calibri',
          sz: 10,
          bold: opts?.isHeader || opts?.isBold,
          color: opts?.color ? { rgb: opts.color } : undefined,
        },
        alignment: {
          vertical: 'center',
          horizontal: opts?.isNum ? 'right' : (opts?.isHeader ? 'center' : 'left'),
        },
        border: {
          top: { style: 'thin', color: { rgb: 'CBD5E1' } },
          bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } },
        }
      };
      if (opts?.bg) style.fill = { fgColor: { rgb: opts.bg } };
      else if (opts?.isHeader) style.fill = { fgColor: { rgb: 'F1F5F9' } };

      return { v: v === null || v === undefined ? '' : v, t, s: style };
    };

    const recLabels = Object.keys(aggregatedReport.receiptParticularsMap);
    const dispLabels = Object.keys(aggregatedReport.disposalParticularsMap);

    // 4. Append a worksheet tab for each active product
    activeKeys.forEach(pKey => {
      const col = columns.find(c => c.key === pKey);
      const prodLabel = col?.label || col?.full_name || pKey;
      const shortName = col?.short_name || pKey;
      const rawSheetName = (shortName || prodLabel || pKey).replace(/[^a-zA-Z0-9_\-\s]/g, '').slice(0, 31);
      const sheetName = rawSheetName || pKey;

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

      const hasParticulars = showBreakdown && (pRecLabels.length > 0 || pDispLabels.length > 0);
      const sheetRows: any[][] = [];
      const merges: XLSX.Range[] = [];

      // Title rows
      sheetRows.push([
        makeCell(`STOCK STATEMENT: ${prodLabel.toUpperCase()} (${shortName})`, { isBold: true, bg: 'E0F2FE', color: '0369A1' })
      ]);
      sheetRows.push([
        makeCell(`Period: ${fmtDate(aggregatedReport.startDate)} to ${fmtDate(aggregatedReport.endDate)} (${pRows.length} Statements)`, { isBold: true, bg: 'F8FAFC' })
      ]);

      // Headers
      if (hasParticulars) {
        const h1: any[] = [
          makeCell('Date', { isHeader: true }),
          makeCell('Shift', { isHeader: true }),
          makeCell('Opening (OB)', { isHeader: true, bg: 'E0F2FE', color: '0369A1' }),
        ];

        h1.push(makeCell(`RECEIPTS (${shortName})`, { isHeader: true, bg: 'D1FAE5', color: '047857' }));
        for (let i = 1; i < pRecLabels.length + 1; i++) h1.push(makeCell('', { isHeader: true, bg: 'D1FAE5' }));
        merges.push({ s: { r: 2, c: 3 }, e: { r: 2, c: 3 + pRecLabels.length } });

        const dispStartCol = 4 + pRecLabels.length;
        h1.push(makeCell(`DISPOSALS (${shortName})`, { isHeader: true, bg: 'FEF3C7', color: 'B45309' }));
        for (let i = 1; i < pDispLabels.length + 1; i++) h1.push(makeCell('', { isHeader: true, bg: 'FEF3C7' }));
        merges.push({ s: { r: 2, c: dispStartCol }, e: { r: 2, c: dispStartCol + pDispLabels.length } });

        const cbCol = dispStartCol + pDispLabels.length + 1;
        h1.push(makeCell('Closing (CB)', { isHeader: true, bg: 'E0E7FF', color: '3730A3' }));

        merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
        merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });
        merges.push({ s: { r: 2, c: 2 }, e: { r: 3, c: 2 } });
        merges.push({ s: { r: 2, c: cbCol }, e: { r: 3, c: cbCol } });

        sheetRows.push(h1);

        const h2: any[] = [
          makeCell('', { isHeader: true }),
          makeCell('', { isHeader: true }),
          makeCell('', { isHeader: true }),
        ];
        pRecLabels.forEach(l => h2.push(makeCell(l, { isHeader: true, bg: 'ECFDF5', color: '065F46' })));
        h2.push(makeCell('TOTAL RECEIPTS', { isHeader: true, bg: 'A7F3D0', color: '047857' }));

        pDispLabels.forEach(l => h2.push(makeCell(l, { isHeader: true, bg: 'FFFBEB', color: '92400E' })));
        h2.push(makeCell('TOTAL DISPOSALS', { isHeader: true, bg: 'FDE68A', color: 'B45309' }));
        h2.push(makeCell('', { isHeader: true }));

        sheetRows.push(h2);
      } else {
        sheetRows.push([
          makeCell('Date', { isHeader: true }),
          makeCell('Shift', { isHeader: true }),
          makeCell('Opening (OB)', { isHeader: true, bg: 'E0F2FE', color: '0369A1' }),
          makeCell('TOTAL RECEIPTS', { isHeader: true, bg: 'D1FAE5', color: '047857' }),
          makeCell('TOTAL DISPOSALS', { isHeader: true, bg: 'FEF3C7', color: 'B45309' }),
          makeCell('Closing (CB)', { isHeader: true, bg: 'E0E7FF', color: '3730A3' }),
        ]);
      }

      // Body Rows
      pRows.forEach(({ stmt, ob, recVals, totalRec, dispVals, totalDisp, cb }) => {
        const rowVal: any[] = [
          makeCell(fmtDate(stmt.date), { isBold: true }),
          makeCell(stmt.shift === 'D' ? 'Day' : stmt.shift === 'N' ? 'Night' : 'Full Day'),
          makeCell(ob, { isNum: true, bg: 'F0F9FF' }),
        ];

        if (hasParticulars) {
          pRecLabels.forEach(l => rowVal.push(makeCell(recVals[l] || 0, { isNum: true })));
        }
        rowVal.push(makeCell(ob + totalRec, { isBold: true, isNum: true, bg: 'ECFDF5', color: '059669' }));

        if (hasParticulars) {
          pDispLabels.forEach(l => rowVal.push(makeCell(dispVals[l] || 0, { isNum: true })));
        }
        rowVal.push(makeCell(totalDisp, { isBold: true, isNum: true, bg: 'FFFBEB', color: 'B45309' }));

        rowVal.push(makeCell(cb, { isBold: true, isNum: true, bg: 'EEF2FF', color: '4338CA' }));

        sheetRows.push(rowVal);
      });

      // Footer Row
      const totalRowVal: any[] = [
        makeCell(`PERIOD TOTAL (${shortName})`, { isBold: true, bg: 'F8FAFC' }),
        makeCell('', { bg: 'F8FAFC' }),
        makeCell(pPeriodOb, { isBold: true, isNum: true, bg: 'E0F2FE', color: '0369A1' }),
      ];

      if (hasParticulars) {
        pRecLabels.forEach(l => totalRowVal.push(makeCell(pPeriodRecParticularsTotal[l] || 0, { isBold: true, isNum: true })));
      }
      totalRowVal.push(makeCell(pPeriodOb + pPeriodRec, { isBold: true, isNum: true, bg: 'A7F3D0', color: '047857' }));

      if (hasParticulars) {
        pDispLabels.forEach(l => totalRowVal.push(makeCell(pPeriodDispParticularsTotal[l] || 0, { isBold: true, isNum: true })));
      }
      totalRowVal.push(makeCell(pPeriodDisp, { isBold: true, isNum: true, bg: 'FDE68A', color: 'B45309' }));

      totalRowVal.push(makeCell(pPeriodCb, { isBold: true, isNum: true, bg: 'C7D2FE', color: '3730A3' }));

      sheetRows.push(totalRowVal);

      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      if (merges.length > 0) ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // 5. Save Excel File
    XLSX.writeFile(wb, fileName);
  };

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

      const showBreakdown = productSubViewMode === 'SEPARATE' || productSubViewMode === 'VIRTUALIZED';
      const hasParticulars = showBreakdown && (pRecLabels.length > 0 || pDispLabels.length > 0);

      // Pagination calculations for Product-Wise View
      const totalRows = pRows.length;
      const currentPage = productWisePageMap[pKey] || 1;
      const totalPages = Math.max(1, Math.ceil(totalRows / productWisePageSize));
      const validPage = Math.min(Math.max(1, currentPage), totalPages);
      const startIndex = (validPage - 1) * productWisePageSize;
      const endIndex = Math.min(startIndex + productWisePageSize, totalRows);
      const displayRows = totalRows > 5 ? pRows.slice(startIndex, endIndex) : pRows;

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
              {totalRows > 5 && ` • Page ${validPage} of ${totalPages}`}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ minWidth: hasParticulars ? 950 : 850, width: '100%' }}>
              <thead>
                <tr>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'center', width: 130, background: '#f1f5f9', verticalAlign: 'middle' }}>Date</th>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'center', width: 75, background: '#f1f5f9', verticalAlign: 'middle' }}>Shift</th>
                  <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 130, background: '#e0f2fe', color: '#0369a1', verticalAlign: 'middle' }}>Opening (OB)</th>

                  {showBreakdown && pRecLabels.length > 0 ? (
                    <th colSpan={pRecLabels.length + 1} style={{ textAlign: 'center', background: '#d1fae5', color: '#047857', fontWeight: 700, fontSize: '0.8rem' }}>
                      📥 RECEIPTS ({shortName})
                    </th>
                  ) : (
                    <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 150, background: '#d1fae5', color: '#047857', fontWeight: 800, verticalAlign: 'middle' }}>TOTAL RECEIPTS</th>
                  )}

                  {showBreakdown && pDispLabels.length > 0 ? (
                    <th colSpan={pDispLabels.length + 1} style={{ textAlign: 'center', background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '0.8rem' }}>
                      📤 DISPOSALS ({shortName})
                    </th>
                  ) : (
                    <th rowSpan={hasParticulars ? 2 : 1} style={{ textAlign: 'right', width: 150, background: '#fef3c7', color: '#b45309', fontWeight: 800, verticalAlign: 'middle' }}>TOTAL DISPOSALS</th>
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
                {displayRows.map(({ stmt, ob, recVals, totalRec, dispVals, totalDisp, cb }) => (
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

                    {showBreakdown && pRecLabels.map(l => (
                      <td key={`rec_${pKey}_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)' }}>
                        {(recVals[l] || 0) === 0 ? '—' : recVals[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', fontWeight: 700, color: '#059669', background: '#ecfdf5' }}>
                      {(ob + totalRec) === 0 ? '—' : (ob + totalRec).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>

                    {showBreakdown && pDispLabels.map(l => (
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

                  {showBreakdown && pRecLabels.map(l => (
                    <td key={`tot_rec_${pKey}_${l}`} style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857' }}>
                      {(pPeriodRecParticularsTotal[l] || 0) === 0 ? '—' : pPeriodRecParticularsTotal[l].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-numbers)', color: '#047857', background: '#a7f3d0' }}>
                    {(pPeriodOb + pPeriodRec) === 0 ? '—' : (pPeriodOb + pPeriodRec).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>

                  {showBreakdown && pDispLabels.map(l => (
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

          {totalRows > 5 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 18px',
                background: '#f8fafc',
                borderTop: '1px solid var(--border)',
                fontSize: '0.8rem',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{totalRows}</strong> days (Page {validPage} of {totalPages})
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Show:</label>
                <select
                  className="form-select"
                  value={productWisePageSize}
                  onChange={e => {
                    setProductWisePageSize(parseInt(e.target.value, 10));
                    setProductWisePageMap({});
                  }}
                  style={{ width: 85, padding: '2px 6px', fontSize: '0.75rem', height: 28 }}
                >
                  <option value={5}>5 days</option>
                  <option value={10}>10 days</option>
                  <option value={15}>15 days</option>
                  <option value={31}>31 days</option>
                  <option value={1000}>All days</option>
                </select>

                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={validPage <= 1}
                    onClick={() => setProductPage(pKey, 1)}
                    style={{ padding: '2px 8px', fontSize: '0.75rem', height: 28 }}
                    title="First Page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={validPage <= 1}
                    onClick={() => setProductPage(pKey, validPage - 1)}
                    style={{ padding: '2px 10px', fontSize: '0.75rem', height: 28 }}
                    title="Previous Page"
                  >
                    ‹ Prev
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(pg => pg === 1 || pg === totalPages || Math.abs(pg - validPage) <= 1)
                    .map((pg, idx, arr) => {
                      const prevPg = arr[idx - 1];
                      const showEllipsis = prevPg && pg - prevPg > 1;
                      return (
                        <span key={`pg_wrap_${pKey}_${pg}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {showEllipsis && <span style={{ color: '#94a3b8', padding: '0 2px' }}>…</span>}
                          <button
                            type="button"
                            className={`btn btn-sm ${pg === validPage ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setProductPage(pKey, pg)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              height: 28,
                              minWidth: 28,
                              fontWeight: pg === validPage ? 700 : 500,
                              borderColor: pg === validPage ? 'var(--brand-primary)' : 'var(--border)',
                            }}
                          >
                            {pg}
                          </button>
                        </span>
                      );
                    })}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={validPage >= totalPages}
                    onClick={() => setProductPage(pKey, validPage + 1)}
                    style={{ padding: '2px 10px', fontSize: '0.75rem', height: 28 }}
                    title="Next Page"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={validPage >= totalPages}
                    onClick={() => setProductPage(pKey, totalPages)}
                    style={{ padding: '2px 8px', fontSize: '0.75rem', height: 28 }}
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    if (productSubViewMode === 'VIRTUALIZED') {
      const filteredProducts = columns.filter(col => {
        if (!productSearchQuery) return true;
        const q = productSearchQuery.toLowerCase();
        const lbl = (col.label || '').toLowerCase();
        const fname = (col.full_name || '').toLowerCase();
        const sname = (col.short_name || '').toLowerCase();
        const key = col.key.toLowerCase();
        return lbl.includes(q) || fname.includes(q) || sname.includes(q) || key.includes(q);
      });

      const selectedProd = columns.find(c => c.key === (selectedProductMasterKey || columns[0]?.key)) || filteredProducts[0] || columns[0];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
            {/* LEFT PANEL: Virtualized Product List */}
            <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚡ Product List</span>
                    <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                      {filteredProducts.length} Products
                    </span>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Filter product name or code..."
                    value={productSearchQuery}
                    onChange={e => setProductSearchQuery(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '6px 10px', height: 32, borderRadius: 6 }}
                  />
                  {productSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setProductSearchQuery('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No product matching "{productSearchQuery}"
                </div>
              ) : (
                <VirtualizedProductList
                  products={filteredProducts}
                  aggregatedReport={aggregatedReport}
                  selectedProductKey={selectedProductMasterKey || (selectedProd ? selectedProd.key : null)}
                  onSelectProduct={pKey => setSelectedProductMasterKey(pKey)}
                  height={640}
                  itemHeight={50}
                />
              )}
            </div>

            {/* RIGHT PANEL: Selected Product's Stock Statement View */}
            <div style={{ minWidth: 0 }}>
              {selectedProd ? (
                <div>
                  {renderSingleProductStatementCard(selectedProd.key)}
                </div>
              ) : (
                <div style={{ padding: 40, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Select a product from the left list to view its date-wise stock statement
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeKeys.map(k => renderSingleProductStatementCard(k))}
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
                {/* <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
                  onClick={handleExportPeriodicalExcel}
                  title="Download Excel file with separate product sheets and formatted filename"
                >
                  📥 Download Excel (Product Sheets)
                </button> */}
                {/* <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportMultiSheetExcel}
                  title="Extract Excel file with each daily Stock Statement in an individual sheet tab"
                >
                  📥 Extract Daily Sheets Excel
                </button> */}
                {/* <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                  📥 Export Consolidated CSV
                </button> */}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div
                className="card"
                onClick={() => setActiveStatementType('DAILY')}
                style={{
                  padding: 18,
                  cursor: 'pointer',
                  background: activeStatementType === 'DAILY' ? 'rgba(14, 165, 233, 0.08)' : '#fff',
                  borderTop: activeStatementType === 'DAILY' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderRight: activeStatementType === 'DAILY' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderBottom: activeStatementType === 'DAILY' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderLeft: '6px solid var(--brand-primary)',
                  transition: 'all 0.2s ease',
                  boxShadow: activeStatementType === 'DAILY' ? '0 4px 12px rgba(14, 165, 233, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                    📅 Daily Statements
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: activeStatementType === 'DAILY' ? '#0284c7' : '#e2e8f0', color: activeStatementType === 'DAILY' ? '#fff' : '#475569', fontWeight: 700 }}>
                    {activeStatementType === 'DAILY' ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                  Daily Stock Statements
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  📥 Extract Daily Sheets Excel ({aggregatedReport.dateWiseStatements.length} Days)
                </div>
              </div>

              <div
                className="card"
                onClick={() => setActiveStatementType('STOCK')}
                style={{
                  padding: 18,
                  cursor: 'pointer',
                  background: activeStatementType === 'STOCK' ? 'rgba(14, 165, 233, 0.08)' : '#fff',
                  borderTop: activeStatementType === 'STOCK' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderRight: activeStatementType === 'STOCK' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderBottom: activeStatementType === 'STOCK' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                  borderLeft: '6px solid var(--brand-primary)',
                  transition: 'all 0.2s ease',
                  boxShadow: activeStatementType === 'STOCK' ? '0 4px 12px rgba(14, 165, 233, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                    📦 Stock Statement
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: activeStatementType === 'STOCK' ? '#0284c7' : '#e2e8f0', color: activeStatementType === 'STOCK' ? '#fff' : '#475569', fontWeight: 700 }}>
                    {activeStatementType === 'STOCK' ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
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
                  borderTop: activeStatementType === 'STG' ? '2px solid #10b981' : '1px solid var(--border)',
                  borderRight: activeStatementType === 'STG' ? '2px solid #10b981' : '1px solid var(--border)',
                  borderBottom: activeStatementType === 'STG' ? '2px solid #10b981' : '1px solid var(--border)',
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
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
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
                  borderTop: activeStatementType === 'TS' ? '2px solid #6366f1' : '1px solid var(--border)',
                  borderRight: activeStatementType === 'TS' ? '2px solid #6366f1' : '1px solid var(--border)',
                  borderBottom: activeStatementType === 'TS' ? '2px solid #6366f1' : '1px solid var(--border)',
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
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                  TS Quality Statement
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Date-wise TS Sample Statement (Planned for future)
                </div>
              </div>
            </div>

            {/* Render selected statement view */}
            {activeStatementType === 'DAILY' ? (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center', background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📑</div>
                <div style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                  Daily Stock Statements Excel Extraction
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: 24, maxWidth: 620, margin: '0 auto 24px', lineHeight: 1.6 }}>
                  Download a complete multi-sheet Excel workbook containing individual formatted sheet tabs for all <strong>{aggregatedReport.dateWiseStatements.length}</strong> daily stock statements from <strong>{fmtDate(aggregatedReport.startDate)}</strong> to <strong>{fmtDate(aggregatedReport.endDate)}</strong>.
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleExportMultiSheetExcel}
                    style={{ padding: '12px 30px', fontSize: '1.05rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10, background: '#0284c7', borderColor: '#0284c7', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)', cursor: 'pointer' }}
                  >
                    <span>📥</span> Extract Daily Sheets Excel
                  </button>
                </div>
              </div>
            ) : activeStatementType !== 'STOCK' ? (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8, gap: 3 }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${productSubViewMode === 'VIRTUALIZED' ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() => setProductSubViewMode('VIRTUALIZED')}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                              title="Virtualized statement list with right-side detail view"
                            >
                              ⚡ Virtualized List View
                            </button>
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
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700, fontSize: '0.75rem', padding: '4px 12px' }}
                            onClick={handleExportPeriodicalExcel}
                            title="Download Excel file with separate product sheets and formatted filename"
                          >
                            📥 Export Excel
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
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
