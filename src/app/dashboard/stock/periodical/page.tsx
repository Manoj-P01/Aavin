'use client';

import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { fmtDate } from '@/lib/calculations';
import type { Entry } from '@/lib/types';

interface ProductCol {
  key: string;
  label: string;
  short_name?: string;
  full_name?: string;
}

const DEFAULT_PRODUCTS: ProductCol[] = [
  { key: 'wh_milk', label: 'WH.Milk', short_name: 'WH.Milk', full_name: 'Whole Milk' },
  { key: 'dlt_milk', label: 'DLT.Milk', short_name: 'DLT.Milk', full_name: 'Double Toned Milk' },
  { key: 'fc_milk', label: 'FC. Milk', short_name: 'FC. Milk', full_name: 'Full Cream Milk' },
  { key: 'std_milk', label: 'STD.Milk', short_name: 'STD.Milk', full_name: 'Standardized Milk' },
  { key: 'toned_curd', label: 'Toned Curd', short_name: 'Toned Curd', full_name: 'Toned Milk Curd' },
  { key: 'dtm', label: 'DTM', short_name: 'DTM', full_name: 'Diagnostic/Double Toned Milk' },
  { key: 'skim_milk', label: 'Skim Milk', short_name: 'Skim Milk', full_name: 'Skimmed Milk' },
  { key: 'cream', label: 'Cream', short_name: 'Cream', full_name: 'Milk Cream' },
  { key: 'butter_milk', label: 'Butter Milk', short_name: 'Butter Milk', full_name: 'Butter Milk' },
  { key: 'r_con', label: 'R.Con', short_name: 'R.Con', full_name: 'Reconstituted Milk' },
  { key: 'smp', label: 'SMP', short_name: 'SMP', full_name: 'Skimmed Milk Powder' },
  { key: 'water', label: 'Water', short_name: 'Water', full_name: 'Water Content' },
];

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
  const [columns, setColumns] = useState<ProductCol[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all stock entries on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
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
            obValues[c.key] += parseFloat(r.values?.[c.key] || '0') || 0;
          });
        });
    }

    // 2. Aggregate Receipts (Grouped by row Particulars)
    const receiptParticularsMap: Record<string, Record<string, number>> = {};
    // 3. Aggregate Disposals (Grouped by row Particulars)
    const disposalParticularsMap: Record<string, Record<string, number>> = {};

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
            receiptParticularsMap[label][c.key] += parseFloat(values[c.key] || '0') || 0;
          });
        }

        if (r.row_type === 'DISPOSAL') {
          const label = (r.row_label || '').trim() || 'Disposals';
          if (!disposalParticularsMap[label]) {
            disposalParticularsMap[label] = {};
            columns.forEach(c => (disposalParticularsMap[label][c.key] = 0));
          }
          columns.forEach(c => {
            disposalParticularsMap[label][c.key] += parseFloat(values[c.key] || '0') || 0;
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

  return (
    <>
      <Header
        title="Periodical Summary Report"
        subtitle="Consolidated Stock Statement over custom monthly, annual & date ranges"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {aggregatedReport && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                  📥 Export CSV / Excel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  🖨️ Print Summary Report
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
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="card" style={{ borderLeft: '4px solid var(--brand-primary)', padding: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Statements Count
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {aggregatedReport.entriesCount} Days
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {fmtDate(aggregatedReport.startDate)} ➔ {fmtDate(aggregatedReport.endDate)}
                </div>
              </div>

              <div className="card" style={{ borderLeft: '4px solid #10b981', padding: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Receipts
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', marginTop: 4 }}>
                  {aggregatedReport.grandTotalReceipts.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Summed across all product columns
                </div>
              </div>

              <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Disposals
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b45309', marginTop: 4 }}>
                  {aggregatedReport.grandTotalDisposals.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Summed across all product columns
                </div>
              </div>

              <div className="card" style={{ borderLeft: '4px solid #6366f1', padding: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Consolidated CB Total
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4f46e5', marginTop: 4 }}>
                  {aggregatedReport.grandTotalCB.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  OB + Receipts - Disposals
                </div>
              </div>
            </div>

            {/* Consolidated Stock Statement Table */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  📊 Consolidated Stock Statement ({fmtDate(aggregatedReport.startDate)} - {fmtDate(aggregatedReport.endDate)})
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing sum total over {aggregatedReport.entriesCount} recorded days
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
                    {/* ─── SECTION 1: OPENING BALANCE ───────────────────────────────── */}
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

                    {/* ─── SECTION 2: RECEIPTS ───────────────────────────────────────── */}
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
                    {/* Receipts Total Row */}
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

                    {/* ─── SECTION 3: DISPOSALS ──────────────────────────────────────── */}
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
                    {/* Disposals Total Row */}
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

                    {/* ─── SECTION 4: CLOSING BALANCE ───────────────────────────────── */}
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
          </>
        )}
      </div>
    </>
  );
}
