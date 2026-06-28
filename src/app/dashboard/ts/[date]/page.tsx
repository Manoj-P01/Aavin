'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import TSReport from '@/components/reports/TSReport';
import Link from 'next/link';
import { calcTSTotals, fmtDate } from '@/lib/calculations';
import type { TSMilkRow } from '@/lib/types';

export default function TSViewPage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const [rows, setRows] = useState<TSMilkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ts?date=${date}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Not found');
        setRows(data.data.ts_rows || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date]);

  const totals = calcTSTotals(rows);

  const handlePrint = () => window.print();

  return (
    <>
      <Header
        title={`TS Report – ${date ? fmtDate(date) : ''}`}
        subtitle="Total Solids Details"
        actions={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨 Print / PDF</button>
            <Link href="/dashboard/ts" className="btn btn-ghost btn-sm">← Back</Link>
          </div>
        }
      />
      <div className="page-body animate-fade-in">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
            <span className="spinner" /> Loading report...
          </div>
        ) : error ? (
          <div className="alert alert-error">
            ⚠️ {error}
            <button onClick={() => router.back()} style={{ marginLeft: 12 }} className="btn btn-ghost btn-sm">Go Back</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No TS data found for {date}</div>
            <div className="empty-state-text">
              <Link href="/dashboard/ts/new" className="btn btn-primary" style={{ marginTop: 16 }}>
                Create New TS Entry
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <TSReport rows={rows} totals={totals} date={date} />
          </div>
        )}
      </div>
    </>
  );
}
