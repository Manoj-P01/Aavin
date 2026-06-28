'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import StockReport from '@/components/reports/StockReport';
import type { StockRow } from '@/lib/types';

export default function StockQueryPage() {
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year' | 'range'>('month');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [from, setFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQuery = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/stock/query?type=${filterType}`;
      if (filterType === 'day') url += `&date=${date}`;
      else if (filterType === 'month') url += `&month=${month}`;
      else if (filterType === 'year') url += `&year=${year}`;
      else if (filterType === 'range') url += `&from=${from}&to=${to}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch query data');
      setRows((json.data || []) as StockRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuery();
  }, [filterType, date, month, year, from, to]);

  const getReportMeta = () => {
    if (filterType === 'day') return `Date: ${date}`;
    if (filterType === 'month') return `Month: ${month}`;
    if (filterType === 'year') return `Year: ${year}`;
    return `Range: ${from} to ${to}`;
  };

  return (
    <>
      <Header
        title="Stock Statement Summary Query"
        subtitle="Analyze and aggregate values over different time frames"
        actions={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Print / PDF</button>
            <Link href="/dashboard/stock" className="btn btn-ghost btn-sm">← Back to Register</Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in">
        {/* Filters control panel */}
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Select Filter Criteria</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
              <label className="form-label">Query By</label>
              <select
                className="form-select"
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
              >
                <option value="day">📅 One Day</option>
                <option value="month">📅 Monthly</option>
                <option value="year">📅 Yearly</option>
                <option value="range">📅 Date Range</option>
              </select>
            </div>

            {filterType === 'day' && (
              <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                <label className="form-label">Select Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            )}

            {filterType === 'month' && (
              <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                <label className="form-label">Select Month</label>
                <input
                  type="month"
                  className="form-input"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                />
              </div>
            )}

            {filterType === 'year' && (
              <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                <label className="form-label">Enter Year</label>
                <input
                  type="number"
                  className="form-input"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="e.g. 2026"
                />
              </div>
            )}

            {filterType === 'range' && (
              <>
                <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                  />
                </div>
              </>
            )}

            <button className="btn btn-primary btn-sm" onClick={fetchQuery} disabled={loading} style={{ height: 38 }}>
              🔄 Refresh Data
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {/* Query Results */}
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
              <span className="spinner" /> Querying registry values...
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No stock rows found</div>
              <div className="empty-state-text">
                There are no saved stock statements matching the selected criteria.
              </div>
            </div>
          ) : (
            <StockReport
              rows={rows}
              separation={null}
              date={filterType === 'day' ? date : new Date().toISOString().split('T')[0]}
              shift="COMBINED"
            />
          )}
        </div>
      </div>
    </>
  );
}
