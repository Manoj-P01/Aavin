// ─────────────────────────────────────────────────────────────
// src/app/dashboard/stock/preparation-charts/report/page.tsx
// Comprehensive Preparation Chart Report Page
// ─────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import {
  exportPrepChartsToExcel,
  exportPrepChartsToCSV,
  exportPrepChartsToPDF,
  getChartCellValue,
  type ChartColumnDef,
  type ChartMasterDef,
} from '@/lib/export/prepChartExport';

interface PrepEntry {
  id: string;
  chart_key: string;
  entry_date: string;
  shift: string;
  entry_json: any;
  updated_at: string;
}

export default function PreparationChartReportPage() {
  const topRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'month'>('range');
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(todayStr);
  const [singleDate, setSingleDate] = useState<string>(todayStr);
  const [monthStr, setMonthStr] = useState<string>(todayStr.slice(0, 7));
  const [shiftFilter, setShiftFilter] = useState<'all' | 'D' | 'N'>('all');
  const [selectedChartKeys, setSelectedChartKeys] = useState<string[]>([]);

  // Data States
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [columns, setColumns] = useState<ChartColumnDef[]>([]);
  const [entries, setEntries] = useState<PrepEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'summary' | 'detailed' | 'compare'>('summary');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Compare Tab States
  const [compareDateA, setCompareDateA] = useState<string>('');
  const [compareDateB, setCompareDateB] = useState<string>('');
  const [compareChart, setCompareChart] = useState<string>('');

  // Initial load of masters & columns
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/stock/preparation-charts/report');
        const json = await res.json();
        if (json.data) {
          const mList: ChartMasterDef[] = json.data.masters || [];
          setMasters(mList);
          setColumns(json.data.columns || []);
          setSelectedChartKeys(mList.map(m => m.key));
          if (mList.length > 0) {
            setCompareChart(mList[0].key);
          }
        }
      } catch (err: any) {
        setError(err.message);
      }
    }
    init();
  }, []);

  // Fetch report data
  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let from = fromDate;
      let to = toDate;

      if (dateMode === 'single') {
        from = singleDate;
        to = singleDate;
      } else if (dateMode === 'month') {
        from = `${monthStr}-01`;
        const parts = monthStr.split('-');
        const lastDay = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
        to = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
      }

      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (shiftFilter !== 'all') params.set('shift', shiftFilter);
      if (selectedChartKeys.length > 0) {
        params.set('charts', selectedChartKeys.join(','));
      }

      const res = await fetch(`/api/stock/preparation-charts/report?${params.toString()}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      if (json.data) {
        setEntries(json.data.entries || []);
        if (json.data.masters?.length) setMasters(json.data.masters);
        if (json.data.columns?.length) setColumns(json.data.columns);
      }

      setHasGenerated(true);
      const now = new Date();
      setLastGeneratedAt(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // Set default comparison dates if entries exist
      if (json.data?.entries?.length > 1) {
        const uniqueDates = Array.from(new Set(json.data.entries.map((e: PrepEntry) => e.entry_date))) as string[];
        if (uniqueDates.length >= 2) {
          setCompareDateA(uniqueDates[0]);
          setCompareDateB(uniqueDates[uniqueDates.length - 1]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDateMode('range');
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setFromDate(d.toISOString().split('T')[0]);
    setToDate(todayStr);
    setSingleDate(todayStr);
    setMonthStr(todayStr.slice(0, 7));
    setShiftFilter('all');
    setSelectedChartKeys(masters.map(m => m.key));
    setEntries([]);
    setHasGenerated(false);
  };

  const toggleChartSelect = (key: string) => {
    setSelectedChartKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAllCharts = () => setSelectedChartKeys(masters.map(m => m.key));
  const clearAllCharts = () => setSelectedChartKeys([]);

  // Group entries by chart_key
  const entriesByChart = useMemo(() => {
    const map: Record<string, PrepEntry[]> = {};
    entries.forEach(e => {
      if (!map[e.chart_key]) map[e.chart_key] = [];
      map[e.chart_key].push(e);
    });
    return map;
  }, [entries]);

  // KPI Calculations (pure JavaScript, 0 tokens)
  const kpis = useMemo(() => {
    const chartsCount = Object.keys(entriesByChart).length;
    const uniqueDates = new Set(entries.map(e => e.entry_date));
    const daysCovered = uniqueDates.size;
    let totalBatches = 0;
    let totalQty = 0;
    const dailyQtyMap: Record<string, number> = {};

    entries.forEach(e => {
      const batches = e.entry_json?.batches || (e.entry_json?.rows ? [{ rows: e.entry_json.rows }] : []);
      totalBatches += batches.length;

      let entryQty = 0;
      batches.forEach((b: any) => {
        (b.rows || []).forEach((r: any) => {
          const qty = parseFloat(String(r.values?.qty_lit || r.values?.quantity || 0));
          if (!isNaN(qty)) entryQty += qty;
        });
      });

      totalQty += entryQty;
      dailyQtyMap[e.entry_date] = (dailyQtyMap[e.entry_date] || 0) + entryQty;
    });

    let highestDay = '—';
    let highestVal = 0;
    let lowestDay = '—';
    let lowestVal = Infinity;

    Object.entries(dailyQtyMap).forEach(([date, qty]) => {
      if (qty > highestVal) {
        highestVal = qty;
        highestDay = `${date} (${qty.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L)`;
      }
      if (qty < lowestVal) {
        lowestVal = qty;
        lowestDay = `${date} (${qty.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L)`;
      }
    });

    return {
      chartsCount,
      daysCovered,
      totalBatches,
      totalQty,
      highestDay: highestVal > 0 ? highestDay : '—',
      lowestDay: lowestVal !== Infinity ? lowestDay : '—',
    };
  }, [entries, entriesByChart]);

  // Export handlers
  const handleExportExcel = async () => {
    if (entries.length === 0) return;
    const chartEntriesData: Record<string, any> = {};
    masters.forEach(m => {
      const chartEntries = entriesByChart[m.key] || [];
      const batches: any[] = [];
      chartEntries.forEach(ce => {
        const eBatches = ce.entry_json?.batches || (ce.entry_json?.rows ? [{ rows: ce.entry_json.rows }] : []);
        eBatches.forEach((b: any, bIdx: number) => {
          batches.push({
            batch_name: `${ce.entry_date} (${ce.shift}) - ${b.batch_name || `Batch #${bIdx + 1}`}`,
            rows: b.rows || [],
          });
        });
      });
      chartEntriesData[m.key] = { batches };
    });

    const activeMasters = masters.filter(m => selectedChartKeys.includes(m.key));
    await exportPrepChartsToExcel({
      masters: activeMasters,
      chartEntriesData,
      columns,
      date: dateMode === 'single' ? singleDate : `${fromDate}_to_${toDate}`,
      shiftLabel: shiftFilter === 'all' ? 'All Shifts' : shiftFilter === 'D' ? 'Day' : 'Night',
    });
  };

  const handleExportCSV = () => {
    if (entries.length === 0) return;
    const headers = ['Date', 'Shift', 'Chart Key', 'Chart Name', 'Batch', ...columns.map(c => c.name)];
    const rows: (string | number)[][] = [];

    entries.forEach(e => {
      const master = masters.find(m => m.key === e.chart_key);
      const batches = e.entry_json?.batches || (e.entry_json?.rows ? [{ rows: e.entry_json.rows }] : []);
      batches.forEach((b: any, bIdx: number) => {
        (b.rows || []).forEach((r: any, rIdx: number) => {
          const rowVals = columns.map(c => {
            const v = getChartCellValue(c, r.values || {}, rIdx, b.rows);
            return v !== undefined && v !== null ? v : '';
          });
          rows.push([
            e.entry_date,
            e.shift,
            e.chart_key,
            master?.name || e.chart_key,
            b.batch_name || `Batch #${bIdx + 1}`,
            ...rowVals,
          ]);
        });
      });
    });

    exportPrepChartsToCSV({
      headers,
      rows,
      filename: `Prep_Chart_Report_${new Date().toISOString().split('T')[0]}.csv`,
    });
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div ref={topRef} className="page-body prep-chart-report-page" style={{ paddingBottom: 80 }}>
      {/* 1. Page Header with ONLY Print/PDF, Export Excel, Export CSV */}
      <PageHeader
        title="Preparation Chart Report"
        subtitle="Historical summaries, formulations, and batch variance analysis"
        breadcrumbs={[
          { label: 'Stock', href: '/dashboard/stock' },
          { label: 'Preparation Charts', href: '/dashboard/stock/new?step=prep' },
          { label: 'Report' },
        ]}
        backHref="/dashboard/stock/new?step=prep"
        backLabel="Back to Preparation Charts"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleExportPDF}
              className="btn btn-secondary btn-sm"
              disabled={entries.length === 0}
            >
              🖨 Print / PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn btn-secondary btn-sm"
              disabled={entries.length === 0}
            >
              📥 Export Excel
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="btn btn-secondary btn-sm"
              disabled={entries.length === 0}
            >
              📄 Export CSV
            </button>
          </div>
        }
      />

      {/* 2. Filter Bar (Card) */}
      <div
        className="card no-print filter-bar-card"
        style={{
          marginBottom: 'var(--space-6, 24px)',
          borderTop: '3px solid var(--brand-primary, #1e40af)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Row 1: Date Mode & Date Inputs & Shift */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Date Mode segmented */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>DATE MODE</span>
              <div style={{ display: 'inline-flex', background: 'var(--bg-subtle, #f1f5f9)', padding: 2, borderRadius: 6 }}>
                {(['single', 'range', 'month'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDateMode(m)}
                    className={`btn btn-xs ${dateMode === m ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', textTransform: 'capitalize' }}
                  >
                    {m === 'single' ? 'Single Day' : m === 'range' ? 'Date Range' : 'Month'}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Inputs */}
            {dateMode === 'single' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>DATE</span>
                <input
                  type="date"
                  className="form-input"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.875rem', width: 150 }}
                />
              </div>
            )}

            {dateMode === 'range' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>FROM</span>
                  <input
                    type="date"
                    className="form-input"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.875rem', width: 145 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>TO</span>
                  <input
                    type="date"
                    className="form-input"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.875rem', width: 145 }}
                  />
                </div>
              </div>
            )}

            {dateMode === 'month' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>MONTH</span>
                <input
                  type="month"
                  className="form-input"
                  value={monthStr}
                  onChange={e => setMonthStr(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.875rem', width: 160 }}
                />
              </div>
            )}

            {/* Shift */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SHIFT</span>
              <select
                className="form-input"
                value={shiftFilter}
                onChange={e => setShiftFilter(e.target.value as any)}
                style={{ padding: '6px 10px', fontSize: '0.875rem', minWidth: 120 }}
              >
                <option value="all">Both / All</option>
                <option value="D">Day (D)</option>
                <option value="N">Night (N)</option>
              </select>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-ghost btn-sm"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                className="btn btn-primary btn-sm"
                disabled={loading}
              >
                {loading ? 'Generating...' : '⚡ Generate Report'}
              </button>
            </div>
          </div>

          {/* Row 2: Chart Multi-Select Tags */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                SELECT CHARTS ({selectedChartKeys.length}/{masters.length})
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={selectAllCharts} className="text-xs text-primary hover:underline bg-transparent border-0 cursor-pointer">
                  Select All
                </button>
                <span style={{ color: 'var(--border)' }}>|</span>
                <button type="button" onClick={clearAllCharts} className="text-xs text-muted hover:underline bg-transparent border-0 cursor-pointer">
                  Clear All
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {masters.map(m => {
                const isSelected = selectedChartKeys.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleChartSelect(m.key)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 16,
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 600 : 400,
                      border: isSelected ? '1px solid var(--brand-primary, #1e40af)' : '1px solid var(--border, #cbd5e1)',
                      background: isSelected ? 'rgba(30, 64, 175, 0.1)' : 'var(--bg-card, #ffffff)',
                      color: isSelected ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary, #475569)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && '✓ '}
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--brand-danger, #ef4444)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--brand-danger, #ef4444)', fontSize: '0.875rem' }}>{error}</span>
            <button type="button" onClick={handleGenerateReport} className="btn btn-secondary btn-xs">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 3. KPI Strip */}
      {hasGenerated && (
        <div
          className="kpi-grid mb-6"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 'var(--space-6, 24px)',
          }}
        >
          <StatCard
            label="Charts Included"
            value={kpis.chartsCount}
            icon="📊"
            subtext={`${masters.length} configured charts`}
            badge={{ text: 'Active', variant: 'info' }}
          />
          <StatCard
            label="Days Covered"
            value={kpis.daysCovered}
            icon="📅"
            subtext="Unique operational dates"
            badge={{ text: 'Period', variant: 'neutral' }}
          />
          <StatCard
            label="Total Batches"
            value={kpis.totalBatches}
            icon="📦"
            subtext={`${entries.length} shift entries`}
            badge={{ text: 'Batches', variant: 'warning' }}
          />
          <StatCard
            label="Total Quantity"
            value={`${kpis.totalQty.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`}
            icon="🥛"
            subtext="Aggregated output volume"
            badge={{ text: 'Sum', variant: 'success' }}
          />
          <StatCard
            label="Peak Volume Day"
            value={kpis.highestDay}
            icon="📈"
            subtext={`Low: ${kpis.lowestDay}`}
            badge={{ text: 'Peak', variant: 'neutral' }}
          />
        </div>
      )}

      {/* 4. Report View Tabs */}
      {hasGenerated && (
        <div className="card mb-6" style={{ padding: '0 0 16px 0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <Tabs
              tabs={[
                { key: 'summary', label: 'Summary', icon: '📊', badge: Object.keys(entriesByChart).length },
                { key: 'detailed', label: 'Detailed Formulations', icon: '📝', badge: entries.length },
                { key: 'compare', label: 'Compare Batches', icon: '⚖️' },
              ]}
              activeKey={activeTab}
              onChange={k => setActiveTab(k as any)}
            />
          </div>

          <div style={{ padding: '16px 18px' }}>
            {/* TAB 1: SUMMARY */}
            {activeTab === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {Object.keys(entriesByChart).length === 0 ? (
                  <EmptyState
                    title="No Preparation Chart Records"
                    message="No entries matched the selected date range and charts. Try selecting a broader range."
                    actionLabel="Change Filters"
                    onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  />
                ) : (
                  masters
                    .filter(m => entriesByChart[m.key]?.length > 0)
                    .map(m => {
                      const chartEntries = entriesByChart[m.key] || [];
                      // Compute column totals for this chart
                      const colTotals: Record<string, number> = {};
                      columns.forEach(c => { colTotals[c.key] = 0; });

                      chartEntries.forEach(ce => {
                        const batches = ce.entry_json?.batches || (ce.entry_json?.rows ? [{ rows: ce.entry_json.rows }] : []);
                        batches.forEach((b: any) => {
                          (b.rows || []).forEach((r: any, rIdx: number) => {
                            columns.forEach(col => {
                              const v = getChartCellValue(col, r.values || {}, rIdx, b.rows);
                              const n = parseFloat(String(v));
                              if (!isNaN(n)) colTotals[col.key] += n;
                            });
                          });
                        });
                      });

                      return (
                        <div key={m.key} className="chart-report-block" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: 'var(--bg-subtle, #f8fafc)',
                              borderBottom: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--brand-primary, #1e40af)' }}>
                                {m.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                                ({m.product_variant || 'STANDARD'}) — Target Fat: {m.target_fat ?? '—'}% | Target SNF: {m.target_snf ?? '—'}%
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {chartEntries.length} entries recorded
                            </span>
                          </div>

                          <div className="table-wrapper" style={{ maxHeight: 380, overflowY: 'auto' }}>
                            <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: 100 }}>Date</th>
                                  <th style={{ width: 70 }}>Shift</th>
                                  <th style={{ width: 80 }}>Batches</th>
                                  {columns.map(c => (
                                    <th key={c.key} style={{ textAlign: 'right' }}>{c.name}</th>
                                  ))}
                                  <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chartEntries.map(ce => {
                                  const batches = ce.entry_json?.batches || (ce.entry_json?.rows ? [{ rows: ce.entry_json.rows }] : []);
                                  // Compute entry sum per column
                                  const entrySums: Record<string, number> = {};
                                  columns.forEach(c => { entrySums[c.key] = 0; });
                                  batches.forEach((b: any) => {
                                    (b.rows || []).forEach((r: any, rIdx: number) => {
                                      columns.forEach(col => {
                                        const v = getChartCellValue(col, r.values || {}, rIdx, b.rows);
                                        const n = parseFloat(String(v));
                                        if (!isNaN(n)) entrySums[col.key] += n;
                                      });
                                    });
                                  });

                                  return (
                                    <tr key={ce.id}>
                                      <td style={{ fontWeight: 600 }}>{ce.entry_date}</td>
                                      <td>
                                        <span className={`badge ${ce.shift === 'D' ? 'badge-day' : ce.shift === 'N' ? 'badge-night' : 'badge-blue'}`}>
                                          {ce.shift === 'D' ? '☀️ Day' : ce.shift === 'N' ? '🌙 Night' : '🗓️ Full'}
                                        </span>
                                      </td>
                                      <td>{batches.length}</td>
                                      {columns.map(c => (
                                        <td key={c.key} className="num" style={{ textAlign: 'right' }}>
                                          {entrySums[c.key] > 0
                                            ? entrySums[c.key].toLocaleString('en-IN', {
                                                minimumFractionDigits: c.decimals ?? 2,
                                                maximumFractionDigits: c.decimals ?? 2,
                                              })
                                            : '—'}
                                        </td>
                                      ))}
                                      <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'inline-flex', gap: 6 }}>
                                          <Link
                                            href={`/dashboard/stock/new?step=prep&chart=${ce.chart_key}&date=${ce.entry_date}&shift=${ce.shift}`}
                                            className="btn btn-ghost btn-xs"
                                            title="View Formulation"
                                          >
                                            👁 View
                                          </Link>
                                          <Link
                                            href={`/dashboard/stock/new?step=prep&chart=${ce.chart_key}&date=${ce.entry_date}&shift=${ce.shift}`}
                                            className="btn btn-secondary btn-xs"
                                            title="Edit Formulation"
                                          >
                                            ✏️ Edit
                                          </Link>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot style={{ background: 'var(--bg-subtle, #f8fafc)', fontWeight: 700 }}>
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL:</td>
                                  {columns.map(c => (
                                    <td key={c.key} className="num" style={{ textAlign: 'right' }}>
                                      {colTotals[c.key] > 0
                                        ? colTotals[c.key].toLocaleString('en-IN', {
                                            minimumFractionDigits: c.decimals ?? 2,
                                            maximumFractionDigits: c.decimals ?? 2,
                                          })
                                        : '—'}
                                    </td>
                                  ))}
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}

            {/* TAB 2: DETAILED FORMULATIONS (Expandable) */}
            {activeTab === 'detailed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {entries.length === 0 ? (
                  <EmptyState title="No entries found" message="Try generating with different date filters." />
                ) : (
                  entries.map(ce => {
                    const isExpanded = !!expandedRows[ce.id];
                    const master = masters.find(m => m.key === ce.chart_key);
                    const batches = ce.entry_json?.batches || (ce.entry_json?.rows ? [{ rows: ce.entry_json.rows }] : []);

                    return (
                      <div
                        key={ce.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: 'var(--bg-card, #ffffff)',
                        }}
                      >
                        <div
                          onClick={() => setExpandedRows(prev => ({ ...prev, [ce.id]: !prev[ce.id] }))}
                          style={{
                            padding: '10px 16px',
                            background: isExpanded ? 'var(--bg-subtle, #f1f5f9)' : 'var(--bg-card, #ffffff)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '1rem' }}>{isExpanded ? '▼' : '▶'}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{ce.entry_date}</span>
                            <span className={`badge ${ce.shift === 'D' ? 'badge-day' : ce.shift === 'N' ? 'badge-night' : 'badge-blue'}`}>
                              {ce.shift === 'D' ? '☀️ Day' : ce.shift === 'N' ? '🌙 Night' : '🗓️ Full'}
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--brand-primary, #1e40af)' }}>
                              {master?.name || ce.chart_key}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {batches.length} batch(es)
                            </span>
                            <Link
                              href={`/dashboard/stock/new?step=prep&chart=${ce.chart_key}&date=${ce.entry_date}&shift=${ce.shift}`}
                              onClick={e => e.stopPropagation()}
                              className="btn btn-secondary btn-xs"
                            >
                              ✏️ Edit in Prep Screen
                            </Link>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', backgroundColor: '#fafafa' }}>
                            {batches.map((b: any, bIdx: number) => (
                              <div key={bIdx} style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0369a1', marginBottom: 6 }}>
                                  {b.batch_name || `Batch #${bIdx + 1}`} (Target: {b.target_batch_liters || master?.target_batch_liters || '—'} L)
                                </div>
                                <div className="table-wrapper">
                                  <table className="data-table" style={{ fontSize: '0.75rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Variant / Row</th>
                                        {columns.map(c => (
                                          <th key={c.key} style={{ textAlign: 'right' }}>{c.name}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(b.rows || []).map((r: any, rIdx: number) => (
                                        <tr key={rIdx}>
                                          <td style={{ fontWeight: 600 }}>{r.variant_name || `Row ${rIdx + 1}`}</td>
                                          {columns.map(c => {
                                            const v = getChartCellValue(c, r.values || {}, rIdx, b.rows);
                                            return (
                                              <td key={c.key} className="num" style={{ textAlign: 'right' }}>
                                                {v !== undefined && v !== null && v !== '' ? String(v) : '—'}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: COMPARE */}
            {activeTab === 'compare' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 12,
                    background: 'var(--bg-subtle, #f8fafc)',
                    borderRadius: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CHART</span>
                    <select
                      className="form-input"
                      value={compareChart}
                      onChange={e => setCompareChart(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.8125rem', minWidth: 160 }}
                    >
                      {masters.map(m => (
                        <option key={m.key} value={m.key}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>DATE A (Baseline)</span>
                    <input
                      type="date"
                      className="form-input"
                      value={compareDateA}
                      onChange={e => setCompareDateA(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>DATE B (Comparison)</span>
                    <input
                      type="date"
                      className="form-input"
                      value={compareDateB}
                      onChange={e => setCompareDateB(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                    />
                  </div>
                </div>

                {/* Compare Results */}
                {(() => {
                  const entryA = entries.find(e => e.chart_key === compareChart && e.entry_date === compareDateA);
                  const entryB = entries.find(e => e.chart_key === compareChart && e.entry_date === compareDateB);

                  if (!entryA || !entryB) {
                    return (
                      <EmptyState
                        title="Select Valid Dates"
                        message="Please pick two dates that have entries for the selected chart to compute column deltas."
                      />
                    );
                  }

                  const getEntrySums = (entry: PrepEntry) => {
                    const sums: Record<string, number> = {};
                    columns.forEach(c => { sums[c.key] = 0; });
                    const batches = entry.entry_json?.batches || (entry.entry_json?.rows ? [{ rows: entry.entry_json.rows }] : []);
                    batches.forEach((b: any) => {
                      (b.rows || []).forEach((r: any, rIdx: number) => {
                        columns.forEach(col => {
                          const v = getChartCellValue(col, r.values || {}, rIdx, b.rows);
                          const n = parseFloat(String(v));
                          if (!isNaN(n)) sums[col.key] += n;
                        });
                      });
                    });
                    return sums;
                  };

                  const sumsA = getEntrySums(entryA);
                  const sumsB = getEntrySums(entryB);

                  return (
                    <div className="table-wrapper">
                      <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                        <thead>
                          <tr>
                            <th>Parameter / Column</th>
                            <th style={{ textAlign: 'right' }}>Date A ({compareDateA})</th>
                            <th style={{ textAlign: 'right' }}>Date B ({compareDateB})</th>
                            <th style={{ textAlign: 'right' }}>Delta (B - A)</th>
                            <th style={{ textAlign: 'right' }}>% Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columns.map(c => {
                            const valA = sumsA[c.key] || 0;
                            const valB = sumsB[c.key] || 0;
                            const diff = valB - valA;
                            const pct = valA > 0 ? (diff / valA) * 100 : 0;
                            const isPositive = diff > 0;
                            const isZero = diff === 0;

                            return (
                              <tr key={c.key}>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td className="num" style={{ textAlign: 'right' }}>
                                  {valA > 0 ? valA.toFixed(c.decimals ?? 2) : '—'}
                                </td>
                                <td className="num" style={{ textAlign: 'right' }}>
                                  {valB > 0 ? valB.toFixed(c.decimals ?? 2) : '—'}
                                </td>
                                <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>
                                  <span
                                    style={{
                                      color: isZero ? 'var(--text-muted)' : isPositive ? '#16a34a' : '#dc2626',
                                    }}
                                  >
                                    {isPositive ? `+${diff.toFixed(c.decimals ?? 2)}` : diff.toFixed(c.decimals ?? 2)}
                                  </span>
                                </td>
                                <td className="num" style={{ textAlign: 'right' }}>
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: '0.75rem',
                                      background: isZero
                                        ? 'var(--bg-subtle)'
                                        : isPositive
                                        ? 'rgba(34, 197, 94, 0.15)'
                                        : 'rgba(239, 68, 68, 0.15)',
                                      color: isZero ? 'var(--text-muted)' : isPositive ? '#16a34a' : '#dc2626',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {isZero ? '0.0%' : `${isPositive ? '+' : ''}${pct.toFixed(1)}%`}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* When not generated yet */}
      {!hasGenerated && !loading && (
        <EmptyState
          icon="🧾"
          title="No Report Generated"
          message="Configure your desired date range and chart selection above, then click 'Generate Report'."
          actionLabel="Generate Current Selection"
          onAction={handleGenerateReport}
        />
      )}

      {/* 6. Sticky Footer Bar */}
      {hasGenerated && (
        <div
          className="sticky-footer no-print"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 'var(--sidebar-w, 260px)',
            right: 0,
            background: 'var(--bg-card, #ffffff)',
            borderTop: '1px solid var(--border, #e2e8f0)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
            boxShadow: 'var(--shadow-lg, 0 -4px 6px -1px rgb(0 0 0 / 0.05))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              <strong>{entries.length}</strong> entry records loaded
            </span>
            {lastGeneratedAt && (
              <span>Last generated at <strong>{lastGeneratedAt}</strong></span>
            )}
          </div>

          <button
            type="button"
            onClick={() => topRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="btn btn-secondary btn-sm"
          >
            ↑ Back to Top
          </button>
        </div>
      )}
    </div>
  );
}

