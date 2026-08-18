'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { fmtDate } from '@/lib/calculations';
import type { Entry } from '@/lib/types';

interface DayGroup {
  date: string;
  day: Entry | null;
  night: Entry | null;
}

export default function StockListPage() {
  const [groups, setGroups] = useState<DayGroup[]>([]);
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
          console.error('Error loading config in stock list page:', err);
        }
        setReportMode(parsedMode);

        const res = await fetch(`/api/entries?report_type=STOCK&month=${month}`);
        const json = await res.json();
        const entries = (json.data || []) as Entry[];
        // Group by date
        const byDate: Record<string, DayGroup> = {};
        for (const e of entries) {
          if (!byDate[e.entry_date]) byDate[e.entry_date] = { date: e.entry_date, day: null, night: null };
          if (e.shift === 'D') byDate[e.entry_date].day = e;
          if (e.shift === 'N') byDate[e.entry_date].night = e;
        }
        setGroups(Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)));
      } catch { setGroups([]); }
      setLoading(false);
    }
    load();
  }, [month]);

  return (
    <>
      <Header
        title="Stock Statement Register"
        subtitle="Monthly milk & cream stock history"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/stock/query" className="btn btn-secondary btn-sm">🔍 Query Summary Register</Link>
            <Link href="/dashboard/stock/new" className="btn btn-primary btn-sm">➕ New Stock Statement Entry</Link>
          </div>
        }
      />
      <div className="page-body animate-fade-in">
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
            {groups.length} days found
          </span>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
              <span className="spinner" /> Loading...
            </div>
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">No stock entries for this month</div>
              <div className="empty-state-text">
                <Link href="/dashboard/stock/new" className="btn btn-primary" style={{ marginTop: 16 }}>
                  Create First Stock Entry
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  {reportMode === 'full_day' ? (
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th className="center">Statement</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th className="center">☀️ Day Shift</th>
                      <th className="center">🌙 Night Shift</th>
                      <th className="center">Combined View</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.date}>
                      <td style={{ fontWeight: 600 }}>{fmtDate(g.date)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(g.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}
                      </td>
                      {reportMode === 'full_day' ? (
                        <td className="center">
                          {g.day ? (
                            <Link href={`/dashboard/stock/${g.date}/D`} className="btn btn-secondary btn-sm">
                              View Statement →
                            </Link>
                          ) : (
                            <Link href={`/dashboard/stock/new?date=${g.date}&shift=D`} className="btn btn-ghost btn-sm" style={{ opacity: 0.5 }}>
                              + Add Entry
                            </Link>
                          )}
                        </td>
                      ) : (
                        <>
                          <td className="center">
                            {g.day ? (
                              <Link href={`/dashboard/stock/${g.date}/D`} className="btn btn-secondary btn-sm">
                                View Day →
                              </Link>
                            ) : (
                              <Link href={`/dashboard/stock/new?date=${g.date}&shift=D`} className="btn btn-ghost btn-sm" style={{ opacity: 0.5 }}>
                                + Add Day
                              </Link>
                            )}
                          </td>
                          <td className="center">
                            {g.night ? (
                              <Link href={`/dashboard/stock/${g.date}/N`} className="btn btn-secondary btn-sm">
                                View Night →
                              </Link>
                            ) : (
                              <Link href={`/dashboard/stock/new?date=${g.date}&shift=N`} className="btn btn-ghost btn-sm" style={{ opacity: 0.5 }}>
                                + Add Night
                              </Link>
                            )}
                          </td>
                          <td className="center">
                            {g.day && g.night ? (
                              <Link href={`/dashboard/stock/${g.date}/D`} className="btn btn-primary btn-sm">
                                🌓 Combined
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {g.day || g.night ? 'Need both shifts' : '—'}
                              </span>
                            )}
                          </td>
                        </>
                      )}
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
