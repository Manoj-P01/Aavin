'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fmtDate } from '@/lib/calculations';
import type { Entry } from '@/lib/types';

export default function TSListPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reportMode, setReportMode] = useState<'full_day' | 'shift'>('full_day');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load report mode configuration
        let parsedMode: 'full_day' | 'shift' = 'full_day';
        try {
          const configRes = await fetch('/api/entries?report_type=STOCK');
          if (configRes.ok) {
            const configJson = await configRes.json();
            const entries: any[] = configJson.data || [];
            const configEntry = entries.find((e: any) => e.entry_date === '1970-01-01') || entries.find((e: any) => e.notes && !e.notes.includes('__METADATA__:'));
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
          console.error('Error loading config in TS list page:', err);
        }
        setReportMode(parsedMode);

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
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/ts/new-stg" className="btn btn-secondary btn-sm">➕ New STG Entry</Link>
            <Link href="/dashboard/ts/new" className="btn btn-primary btn-sm">➕ New TS Entry</Link>
          </div>
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
                    {reportMode === 'shift' && <th>Shift</th>}
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const targetUrl = `/dashboard/ts/${e.entry_date}${e.shift ? `?shift=${e.shift}` : ''}`;
                    return (
                      <tr
                        key={e.id}
                        onClick={() => router.push(targetUrl)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontWeight: 600 }}>
                          <Link
                            href={targetUrl}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                            onClick={e => e.stopPropagation()}
                          >
                            {fmtDate(e.entry_date)}
                          </Link>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}
                        </td>
                        {reportMode === 'shift' && (
                          <td>
                            {e.shift ? (
                              <span className={`badge ${e.shift === 'D' ? 'badge-day' : 'badge-night'}`}>
                                {e.shift === 'D' ? '☀️ Day' : '🌙 Night'}
                              </span>
                            ) : (
                              <span className="badge badge-blue">🗓️ Full Day</span>
                            )}
                          </td>
                        )}
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {new Date(e.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td>
                          <Link
                            href={targetUrl}
                            className="btn btn-secondary btn-sm"
                            onClick={e => e.stopPropagation()}
                          >
                            View Report →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
