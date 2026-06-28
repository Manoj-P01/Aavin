'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { fmtDate } from '@/lib/calculations';
import type { Entry } from '@/lib/types';

export default function TSListPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/entries?report_type=TS&month=${month}`);
        const json = await res.json();
        setEntries((json.data || []) as Entry[]);
      } catch { setEntries([]); }
      setLoading(false);
    }
    load();
  }, [month]);

  return (
    <>
      <Header
        title="Total Solids Reports"
        subtitle="Daily TS report history"
        actions={
          <Link href="/dashboard/ts/new" className="btn btn-primary btn-sm">➕ New TS Entry</Link>
        }
      />
      <div className="page-body animate-fade-in">
        {/* Month filter */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Filter by Month:</label>
          <input
            type="month"
            className="form-input"
            style={{ width: 200 }}
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {entries.length} entries found
          </span>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
              <span className="spinner" /> Loading...
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧪</div>
              <div className="empty-state-title">No TS entries for this month</div>
              <div className="empty-state-text">
                <Link href="/dashboard/ts/new" className="btn btn-primary" style={{ marginTop: 16 }}>
                  Create First TS Entry
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Notes</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{fmtDate(e.entry_date)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{e.notes || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {new Date(e.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <Link href={`/dashboard/ts/${e.entry_date}`} className="btn btn-secondary btn-sm">
                          View Report →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
