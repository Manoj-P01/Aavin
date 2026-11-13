'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtDate } from '@/lib/calculations';
import MonthlyTrendChart from '@/components/charts/MonthlyTrendChart';
import { StatCard } from '@/components/ui/StatCard';
import type { Entry } from '@/lib/types';

interface Stats {
  tsCount: number;
  stockCount: number;
  thisMonthTs: number;
  thisMonthStock: number;
  latestTs: Entry | null;
  latestStock: Entry | null;
  recentEntries: Entry[];
  pendingEntries?: Entry[];
  monthlyTrend?: {
    ts: { month: string; count: number }[];
    stock: { month: string; count: number }[];
  };
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'today'>('month');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const json = await res.json();
        if (json.data) {
          setStats(json.data as Stats);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="kpi-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="kpi-card">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8, marginBottom: 14 }} />
              <div className="skeleton" style={{ width: '60%', height: 10, marginBottom: 10 }} />
              <div className="skeleton" style={{ width: '40%', height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Date Filter & Fast Actions Strip */}
      <div
        className="card no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period Filter:</span>
          <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-subtle)', padding: 3, borderRadius: 8 }}>
            {(['today', 'month', 'all'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setDateFilter(f)}
                className={`btn btn-xs ${dateFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', textTransform: 'capitalize' }}
              >
                {f === 'today' ? "Today" : f === 'month' ? "This Month" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/dashboard/stock/new?step=stock" className="btn btn-secondary btn-sm">
            📦 New Stock Entry
          </Link>
          <Link href="/dashboard/stock/new?step=ts" className="btn btn-primary btn-sm">
            🧪 New TS Entry
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard
          label="Total TS Reports"
          value={dateFilter === 'month' ? stats.thisMonthTs : stats.tsCount}
          icon="🧪"
          subtext={dateFilter === 'month' ? `Total all time: ${stats.tsCount}` : `${stats.thisMonthTs} this month`}
          badge={{ text: 'Active', variant: 'info' }}
        />
        <StatCard
          label="Stock Entries"
          value={dateFilter === 'month' ? stats.thisMonthStock : stats.stockCount}
          icon="📦"
          subtext={dateFilter === 'month' ? `Total all time: ${stats.stockCount}` : `${stats.thisMonthStock} this month`}
          badge={{ text: 'Active', variant: 'warning' }}
        />
        <StatCard
          label="Latest TS Date"
          value={stats.latestTs ? fmtDate(stats.latestTs.entry_date) : '—'}
          icon="📅"
          subtext="Most recent completed report"
          badge={{ text: 'Completed', variant: 'success' }}
        />
        <StatCard
          label="Latest Stock Shift"
          value={stats.latestStock ? `${fmtDate(stats.latestStock.entry_date)} (${stats.latestStock.shift || 'F'})` : '—'}
          icon="🕒"
          subtext="Last updated entry"
          badge={{ text: 'Verified', variant: 'success' }}
        />
      </div>

      {/* Monthly Trend Charts Fed from monthly_totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <MonthlyTrendChart reportType="TS" initialData={stats.monthlyTrend?.ts} />
        <MonthlyTrendChart reportType="STOCK" initialData={stats.monthlyTrend?.stock} />
      </div>

      {/* Pending / Draft Entries Strip */}
      {stats.pendingEntries && stats.pendingEntries.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--brand-warning, #f59e0b)' }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>⏳</span>
              <div>
                <div className="section-title" style={{ fontSize: '1rem', fontWeight: 600 }}>Pending Entries</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {stats.pendingEntries.length} entries awaiting completion or final verification
                </div>
              </div>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingEntries.map(entry => (
                  <tr key={entry.id}>
                    <td style={{ fontWeight: 600 }}>{fmtDate(entry.entry_date)}</td>
                    <td>
                      <span className={`badge ${entry.report_type === 'TS' ? 'badge-blue' : 'badge-amber'}`}>
                        {entry.report_type === 'TS' ? '🧪 Total Solids' : '📦 Stock'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${entry.shift === 'D' ? 'badge-day' : entry.shift === 'N' ? 'badge-night' : 'badge-blue'}`}>
                        {entry.shift === 'D' ? '☀️ Day' : entry.shift === 'N' ? '🌙 Night' : '🗓️ Full'}
                      </span>
                    </td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 600 }}>
                        {entry.status || 'DRAFT'}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={entry.report_type === 'TS'
                          ? `/dashboard/ts/${entry.entry_date}${entry.shift ? `?shift=${entry.shift}` : ''}`
                          : `/dashboard/stock/${entry.entry_date}/${entry.shift || 'F'}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Resume →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Entries */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <div className="section-title">Recent Entries</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/ts" className="btn btn-ghost btn-sm">View TS Register →</Link>
            <Link href="/dashboard/stock" className="btn btn-ghost btn-sm">View Stock Register →</Link>
          </div>
        </div>

        {stats.recentEntries.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No entries yet</div>
            <div className="empty-state-text">Start by creating a new TS or Stock entry.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Report Type</th>
                  <th>Shift</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEntries.map(entry => (
                  <tr key={entry.id}>
                    <td style={{ fontWeight: 600 }}>{fmtDate(entry.entry_date)}</td>
                    <td>
                      <span className={`badge ${entry.report_type === 'TS' ? 'badge-blue' : 'badge-amber'}`}>
                        {entry.report_type === 'TS' ? '🧪 Total Solids' : '📦 Stock'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${entry.shift === 'D' ? 'badge-day' : entry.shift === 'N' ? 'badge-night' : 'badge-blue'}`}>
                        {entry.shift === 'D' ? '☀️ Day' : entry.shift === 'N' ? '🌙 Night' : '🗓️ Full Day'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(entry.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <Link
                        href={entry.report_type === 'TS'
                          ? `/dashboard/ts/${entry.entry_date}${entry.shift ? `?shift=${entry.shift}` : ''}`
                          : `/dashboard/stock/${entry.entry_date}/${entry.shift || 'F'}`}
                        className="btn btn-secondary btn-sm"
                      >
                        View →
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
  );
}
