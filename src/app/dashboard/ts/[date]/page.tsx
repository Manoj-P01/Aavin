'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import TSReport from '@/components/reports/TSReport';
import STGReport from '@/components/reports/STGReport';
import Link from 'next/link';
import { calcTSTotals, fmtDate, generateDynamicBalanceRows } from '@/lib/calculations';
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

  const [availableShifts, setAvailableShifts] = useState<(Shift | null)[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [globalStatements, setGlobalStatements] = useState<Array<{ key: string; label: string }>>([]);
  const [formulasConfig, setFormulasConfig] = useState<any>(null);
  const activeTab = selectedTab ?? ((tabParam === 'TS' || tabParam === 'ts') ? 'TS' : 'STG');

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSTG, setExportSTG] = useState(true);
  const [exportTS, setExportTS] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Fetch formulas configuration
        try {
          const formulasRes = await fetch('/api/formulas');
          if (formulasRes.ok) {
            const formulasJson = await formulasRes.json();
            if (formulasJson.data && formulasJson.data.nested) {
              setFormulasConfig(formulasJson.data.nested);
            }
          }
        } catch (err) {
          console.error('Failed to load formulas config:', err);
        }

        // 1. Fetch available entries for this date
        const entriesRes = await fetch(`/api/entries?report_type=TS&date=${date}`);
        if (!entriesRes.ok) throw new Error('Failed to load entry shifts.');
        const entriesJson = await entriesRes.json();
        const entriesList = (entriesJson.data || []) as Entry[];
        
        const shiftsFound = entriesList.map(e => e.shift);
        setAvailableShifts(shiftsFound);

        // Determine which shift is active
        let activeShift: Shift | null = null;
        if (shiftParam === 'D' || shiftParam === 'N') {
          activeShift = shiftParam;
        } else if (shiftParam === 'null' || shiftParam === 'NULL') {
          activeShift = null;
        } else {
          activeShift = entriesList.length > 0 ? entriesList[0].shift : null;
        }
        setShift(activeShift);

        // Fetch global statements template config
        let gStmts: any[] = [];
        try {
          const configRes = await fetch('/api/entries?report_type=TS&date=1970-01-01');
          if (configRes.ok) {
            const configJson = await configRes.json();
            const configEntry = configJson.data?.[0];
            if (configEntry && configEntry.notes) {
              gStmts = JSON.parse(configEntry.notes) || [];
              setGlobalStatements(gStmts);
            }
          }
        } catch (err) {
          console.error('Failed to load global statements config', err);
        }

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
          const rawTsRows = (data.data.ts_rows || []) as TSMilkRow[];
          const rawStgRows = (data.data.stg_rows || []) as STGRow[];
          const notes = data.data.notes || null;

          const { obRows, cbRows } = generateDynamicBalanceRows(rawStgRows, notes, gStmts);
          const otherTsRows = rawTsRows.filter(r => r.section !== 'OB' && r.section !== 'CB');
          const mergedTsRows = [...obRows, ...otherTsRows, ...cbRows];

          setRows(mergedTsRows);
          setStgRows(rawStgRows);
          setEntryNotes(notes);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date, shiftParam]);

  const totals = calcTSTotals(rows, formulasConfig || undefined);
  const handlePrint = () => window.print();

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const url = `/api/export-excel?date=${date}&shift=${shift ?? 'null'}&stg=${exportSTG}&ts=${exportTS}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateParts = date.split('-');
      const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      const shiftStr = shift ? `-${shift}` : '';
      a.download = `${formattedDate}${shiftStr}-TS.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      alert(`Report exported successfully!\n\nAlso saved locally to:\nd:\\Manoj_Personal\\Aavin\\excel\\${formattedDate}${shiftStr}-TS.xlsx`);
      setExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Header
        title={`Daily Statement – ${date ? fmtDate(date) : ''}`}
        subtitle={`Total Solids and Solid Balance Details (${shift ? (shift === 'D' ? 'Day Shift' : 'Night Shift') : 'Full Day'})`}
        actions={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            {activeTab === 'STG' ? (
              <Link href={`/dashboard/ts/new-stg?date=${date}&shift=${shift ?? 'null'}`} className="btn btn-primary btn-sm">
                ✏️ Edit STG Entry
              </Link>
            ) : (
              <Link href={`/dashboard/ts/new?date=${date}&shift=${shift ?? 'null'}`} className="btn btn-primary btn-sm">
                ✏️ Edit TS Entry
              </Link>
            )}
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨 Print / PDF</button>
            <button className="btn btn-secondary btn-sm" style={{ borderColor: '#16a34a', color: '#16a34a' }} onClick={() => setExportModalOpen(true)}>📥 Export Excel</button>
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
                  router.push(`/dashboard/ts/${newDate}?tab=${activeTab}&shift=${shift ?? 'null'}`);
                }
              }}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Shift:</label>
            <div className="tabs" style={{ margin: 0 }}>
              {[
                { label: '🗓️ Full Day', value: null },
                { label: '☀️ Day Shift', value: 'D' },
                { label: '🌙 Night Shift', value: 'N' }
              ].map(s => {
                const isSelected = shift === s.value;
                return (
                  <button
                    key={s.label}
                    className={`tab ${isSelected ? 'active' : ''}`}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      ...(isSelected ? {
                        backgroundColor: 'var(--brand-primary)',
                        color: '#ffffff',
                        fontWeight: 700,
                        boxShadow: '0 2px 6px rgba(14,165,233,0.3)',
                      } : {})
                    }}
                    onClick={() => {
                      router.replace(`/dashboard/ts/${date}?tab=${activeTab}&shift=${s.value ?? 'null'}`);
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
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
              <STGReport stgRows={stgRows} date={date} notes={entryNotes} shift={shift} />
            )}
          </div>
        )}
      </div>

      {exportModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
        }} className="no-print">
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24, boxShadow: 'var(--shadow-xl)' }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Export to Excel</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Select which reports you would like to include in the exported Excel spreadsheet:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportSTG}
                  onChange={e => setExportSTG(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Solid Balance (STG) Sheets
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportTS}
                  onChange={e => setExportTS(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Total Solids (TS) Report Sheet
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setExportModalOpen(false)}
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: '#16a34a', backgroundImage: 'none', boxShadow: 'none' }}
                onClick={handleExportExcel}
                disabled={exporting || (!exportSTG && !exportTS)}
              >
                {exporting ? 'Exporting...' : '💾 Export Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
