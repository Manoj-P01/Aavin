'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import TSReport from '@/components/reports/TSReport';
import STGReport from '@/components/reports/STGReport';
import Link from 'next/link';
import { calcTSTotals, fmtDate } from '@/lib/calculations';
import type { Entry, Shift, TSMilkRow, STGRow } from '@/lib/types';

export default function TSViewPage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const shiftParam = searchParams.get('shift');

  const [rows, setRows] = useState<TSMilkRow[]>([]);
  const [stgRows, setStgRows] = useState<STGRow[]>([]);
  const [entryNotes, setEntryNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState<'TS' | 'STG' | null>(null);

  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const activeTab = selectedTab ?? ((tabParam === 'TS' || tabParam === 'ts') ? 'TS' : 'STG');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // 1. Fetch available entries for this date
        const entriesRes = await fetch(`/api/entries?report_type=TS&date=${date}`);
        if (!entriesRes.ok) throw new Error('Failed to load entry shifts.');
        const entriesJson = await entriesRes.json();
        const entriesList = (entriesJson.data || []) as Entry[];
        
        const shiftsFound = entriesList
          .map(e => e.shift)
          .filter((entryShift): entryShift is Shift => entryShift !== null);
        setAvailableShifts(shiftsFound);

        // Determine which shift is active
        const requestedShift = shiftParam === 'D' || shiftParam === 'N' ? shiftParam : null;
        let activeShift: Shift | null = requestedShift;
        if (!activeShift) {
          activeShift = shiftsFound.length > 0 ? shiftsFound[0] : 'D';
        }
        setShift(activeShift);

        // 2. Fetch TS details for active shift
        const res = await fetch(`/api/ts?date=${date}${activeShift ? `&shift=${activeShift}` : ''}`);
        const data = await res.json();
        if (res.status === 404) {
          setRows([]);
          setStgRows([]);
          setEntryNotes(null);
        } else if (!res.ok) {
          throw new Error(data.error || 'Not found');
        } else {
          setRows(data.data.ts_rows || []);
          setStgRows(data.data.stg_rows || []);
          setEntryNotes(data.data.notes || null);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date, shiftParam]);

  const totals = calcTSTotals(rows);
  const handlePrint = () => window.print();

  return (
    <>
      <Header
        title={`Daily Statement – ${date ? fmtDate(date) : ''}`}
        subtitle="Total Solids and Solid Balance Details"
        actions={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            {activeTab === 'STG' ? (
              <Link href={`/dashboard/ts/new-stg?date=${date}&shift=${shift || 'D'}`} className="btn btn-primary btn-sm">
                ✏️ Edit STG Entry
              </Link>
            ) : (
              <Link href={`/dashboard/ts/new?date=${date}&shift=${shift || 'D'}`} className="btn btn-primary btn-sm">
                ✏️ Edit TS Entry
              </Link>
            )}
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨 Print / PDF</button>
            <Link href="/dashboard/ts" className="btn btn-ghost btn-sm">← Back</Link>
          </div>
        }
      />
      <div className="page-body animate-fade-in">
        {/* Date & Shift Selector Card */}
        <div className="card no-print" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Date:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 160, padding: '6px 10px', fontSize: '0.85rem' }}
              value={date}
              onChange={e => {
                const newDate = e.target.value;
                if (newDate) {
                  router.push(`/dashboard/ts/${newDate}?tab=${activeTab}${shift ? `&shift=${shift}` : '&shift=D'}`);
                }
              }}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Shift:</label>
            <div className="tabs" style={{ margin: 0 }}>
              {(['D', 'N'] as Shift[]).map(s => (
                <button
                  key={s}
                  className={`tab ${shift === s ? 'active' : ''}`}
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  onClick={() => {
                    router.replace(`/dashboard/ts/${date}?tab=${activeTab}&shift=${s}`);
                  }}
                >
                  {s === 'D' ? '☀️ Day Shift' : '🌙 Night Shift'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="no-print">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'STG' ? 'active' : ''}`}
              onClick={() => setSelectedTab('STG')}
            >
              ⚖️ Solid Balance (STG)
            </button>
            <button
              className={`tab ${activeTab === 'TS' ? 'active' : ''}`}
              onClick={() => setSelectedTab('TS')}
            >
              🧪 Daily TS Report
            </button>
          </div>
        </div>

        {/* Report Content Area */}
        {loading ? (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
            <span className="spinner" /> Loading report...
          </div>
        ) : error ? (
          <div className="alert alert-error">
            ⚠️ {error}
            <button onClick={() => router.back()} style={{ marginLeft: 12 }} className="btn btn-ghost btn-sm">Go Back</button>
          </div>
        ) : (rows.length === 0 && stgRows.length === 0 && !entryNotes) ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No data found for {date ? fmtDate(date) : ''} ({shift === 'D' ? 'Day Shift' : 'Night Shift'})</div>
            <div className="empty-state-text" style={{ marginTop: 12 }}>
              Please create an entry to compile the report.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <Link href={`/dashboard/ts/new-stg?date=${date}&shift=${shift || 'D'}`} className="btn btn-primary">
                ⚖️ Create STG Entry
              </Link>
              <Link href={`/dashboard/ts/new?date=${date}`} className="btn btn-secondary">
                🧪 Create TS Entry
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            {activeTab === 'TS' ? (
              <TSReport rows={rows} totals={totals} date={date} shift={shift} />
            ) : (
              <STGReport stgRows={stgRows} date={date} notes={entryNotes} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
