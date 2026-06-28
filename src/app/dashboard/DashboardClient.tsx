'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/calculations';
import MonthlyTrendChart from '@/components/charts/MonthlyTrendChart';
import type { Entry } from '@/lib/types';

interface Stats {
  tsCount: number;
  stockCount: number;
  thisMonthTs: number;
  thisMonthStock: number;
  latestTs: Entry | null;
  latestStock: Entry | null;
  recentEntries: Entry[];
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = `${monthStr}-01`;
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split('T')[0];

      const [allTs, allStock, monthTs, monthStock, recentAll] = await Promise.all([
        supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'TS'),
        supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'STOCK'),
        supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'TS').gte('entry_date', monthStart).lte('entry_date', monthEnd),
        supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'STOCK').gte('entry_date', monthStart).lte('entry_date', monthEnd),
        supabase.from('entries').select('*').order('created_at', { ascending: false }).limit(8),
      ]);

      const recent = (recentAll.data || []) as Entry[];
      const latestTs = recent.find(e => e.report_type === 'TS') || null;
      const latestStock = recent.find(e => e.report_type === 'STOCK') || null;

      setStats({
        tsCount: allTs.count || 0,
        stockCount: allStock.count || 0,
        thisMonthTs: monthTs.count || 0,
        thisMonthStock: monthStock.count || 0,
        latestTs,
        latestStock,
        recentEntries: recent,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="kpi-grid">
          {[1,2,3,4].map(i => (
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

  const kpis = [
    { label: 'Total TS Reports', value: stats.tsCount, sub: `${stats.thisMonthTs} this month`, icon: '🧪', cls: 'blue', href: '/dashboard/ts' },
    { label: 'Stock Entries', value: stats.stockCount, sub: `${stats.thisMonthStock} this month`, icon: '📦', cls: 'amber', href: '/dashboard/stock' },
    { label: 'Last TS Date', value: stats.latestTs ? fmtDate(stats.latestTs.entry_date) : '—', sub: 'Most recent', icon: '📅', cls: 'green', href: stats.latestTs ? `/dashboard/ts/${stats.latestTs.entry_date}` : '/dashboard/ts' },
    { label: 'Last Stock Date', value: stats.latestStock ? fmtDate(stats.latestStock.entry_date) : '—', sub: stats.latestStock ? `Shift ${stats.latestStock.shift}` : 'Most recent', icon: '🕒', cls: 'red', href: stats.latestStock ? `/dashboard/stock/${stats.latestStock.entry_date}` : '/dashboard/stock' },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map(k => (
          <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
            <div className="kpi-card">
              <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <MonthlyTrendChart reportType="TS" />
        <MonthlyTrendChart reportType="STOCK" />
      </div>

      {/* Recent Entries */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Recent Entries</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/ts" className="btn btn-ghost btn-sm">View TS →</Link>
            <Link href="/dashboard/stock" className="btn btn-ghost btn-sm">View Stock →</Link>
          </div>
        </div>

        {stats.recentEntries.length === 0 ? (
          <div className="empty-state">
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
                  <th>Notes</th>
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
                      {entry.shift ? (
                        <span className={`badge ${entry.shift === 'D' ? 'badge-day' : 'badge-night'}`}>
                          {entry.shift === 'D' ? '☀️ Day' : '🌙 Night'}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{entry.notes || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(entry.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <Link
                        href={entry.report_type === 'TS'
                          ? `/dashboard/ts/${entry.entry_date}`
                          : `/dashboard/stock/${entry.entry_date}/${entry.shift}`}
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
    </>
  );
}
