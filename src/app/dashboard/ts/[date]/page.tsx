'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Step, { DAILY_ENTRY_STEP_ITEMS } from '@/components/ui/Step';
import TSReport from '@/components/reports/TSReport';
import STGReport from '@/components/reports/STGReport';
import StockReport from '@/components/reports/StockReport';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { calcTSTotals, fmtDate, generateDynamicBalanceRows } from '@/lib/calculations';
import type { Entry, Shift, TSMilkRow, STGRow, StockRow, SeparationDetails } from '@/lib/types';

export default function TSViewPage() {
  const { showSuccess, showError } = useConfirm();
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const shiftParam = searchParams.get('shift');

  const [rows, setRows] = useState<TSMilkRow[]>([]);
  const [stgRows, setStgRows] = useState<STGRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [stockSeparation, setStockSeparation] = useState<SeparationDetails | null>(null);
  const [entryNotes, setEntryNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState<'STOCK' | 'STG' | 'TS' | null>(null);

  const [availableShifts, setAvailableShifts] = useState<(Shift | null)[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [reportMode, setReportMode] = useState<'full_day' | 'shift'>('full_day');
  const [globalStatements, setGlobalStatements] = useState<Array<{ key: string; label: string }>>([]);
  const activeTab = selectedTab ?? (tabParam?.toUpperCase() === 'STOCK' ? 'STOCK' : (tabParam?.toUpperCase() === 'TS' ? 'TS' : 'STG'));

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSTG, setExportSTG] = useState(true);
  const [exportTS, setExportTS] = useState(true);
  const [exportStock, setExportStock] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Fetch global reportMode setting
        let parsedMode: 'full_day' | 'shift' = 'full_day';
        try {
          const configRes = await fetch('/api/entries?report_type=STOCK');
          if (configRes.ok) {
            const configJson = await configRes.json();
            const entries: any[] = configJson.data || [];
            const configEntry = entries.find((e: any) => {
              if (!e.notes || e.notes.includes('__METADATA__:')) return false;
              try {
                const parsed = JSON.parse(e.notes);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
              } catch { return false; }
            });
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
          console.error('Failed to load shift mode config in TS page:', err);
        }
        setReportMode(parsedMode);

        // 1. Fetch available entries for this date
        const entriesRes = await fetch(`/api/entries?report_type=TS&date=${date}`);
        if (!entriesRes.ok) throw new Error('Failed to load entry shifts.');
        const entriesJson = await entriesRes.json();
        const entriesList = (entriesJson.data || []) as Entry[];
        
        const shiftsFound = entriesList.map(e => e.shift);
        setAvailableShifts(shiftsFound);

        // Determine which shift is active
        let activeShift: Shift | null = null;
        if (parsedMode === 'full_day') {
          activeShift = null;
        } else if (shiftParam === 'D' || shiftParam === 'N') {
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
          const configRes = await fetch('/api/entries?report_type=TS');
          if (configRes.ok) {
            const configJson = await configRes.json();
            const entries: any[] = configJson.data || [];
            const configEntry = entries.find((e: any) => {
              if (!e.notes || e.notes.includes('__METADATA__:')) return false;
              try {
                const parsed = JSON.parse(e.notes);
                return Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.key !== undefined);
              } catch { return false; }
            });
            if (configEntry && configEntry.notes) {
              try {
                gStmts = JSON.parse(configEntry.notes) || [];
                setGlobalStatements(gStmts);
              } catch (e) {}
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

        // 3. Fetch Stock details for active shift
        try {
          const stockRes = await fetch(`/api/stock?date=${date}${activeShift ? `&shift=${activeShift}` : ''}`);
          if (stockRes.ok) {
            const stockJson = await stockRes.json();
            const sEntry = stockJson.data?.entries?.[0];
            const sRows = stockJson.data?.stock_rows?.filter((r: any) => r.entry_id === sEntry?.id) || stockJson.data?.stock_rows || [];
            const sSep = stockJson.data?.separation_details?.find((s: any) => s.entry_id === sEntry?.id) || stockJson.data?.separation_details?.[0] || null;
            setStockRows(sRows);
            setStockSeparation(sSep);
          }
        } catch {}
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

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const url = `/api/export-excel?date=${date}&shift=${shift ?? 'null'}&stg=${exportSTG}&ts=${exportTS}&stock=${exportStock}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateParts = date.split('-');
      const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      const shiftStr = shift ? `-${shift}` : '';
      a.download = `${formattedDate}${shiftStr}-Statement.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      await showSuccess('Report exported successfully!', 'Export Complete');
      setExportModalOpen(false);
    } catch (err) {
      console.error(err);
      await showError('Failed to export Excel report.', 'Export Error');
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
            <Link href={`/dashboard/stock/${date}/${shift || 'D'}`} className="btn btn-secondary btn-sm">
              📦 Stock Statement
            </Link>
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
      >
        <Step
          items={DAILY_ENTRY_STEP_ITEMS}
          flat={true}
          activeStep="reports"
          onStepClick={(key) => {
            if (key === 'stock') {
              router.push(`/dashboard/stock/new?date=${date}&shift=${shift || 'F'}`);
            } else if (key === 'stg') {
              router.push(`/dashboard/ts/new-stg?date=${date}&shift=${shift || 'F'}`);
            } else if (key === 'ts') {
              router.push(`/dashboard/ts/new?date=${date}&shift=${shift || 'F'}`);
            }
          }}
          style={{ marginBottom: 0, marginTop: 4 }}
        />
      </Header>
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

          {reportMode === 'shift' && (
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
          )}
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="no-print">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'STOCK' ? 'active' : ''}`}
              onClick={() => setSelectedTab('STOCK')}
            >
              📦 Milk & Cream Stock Statement
            </button>
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
        ) : (rows.length === 0 && stgRows.length === 0 && stockRows.length === 0 && !entryNotes) ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No data found for {date ? fmtDate(date) : ''} ({shift === 'D' ? 'Day Shift' : 'Night Shift'})</div>
            <div className="empty-state-text" style={{ marginTop: 12 }}>
              Please create an entry to compile the report.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <Link href={`/dashboard/stock/new?date=${date}&shift=${shift || 'F'}`} className="btn btn-primary">
                📦 Create Stock Entry
              </Link>
              <Link href={`/dashboard/ts/new-stg?date=${date}&shift=${shift || 'D'}`} className="btn btn-secondary">
                ⚖️ Create STG Entry
              </Link>
              <Link href={`/dashboard/ts/new?date=${date}`} className="btn btn-secondary">
                🧪 Create TS Entry
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            {activeTab === 'STOCK' ? (
              <StockReport
                rows={stockRows}
                separation={stockSeparation}
                date={date}
                shift={shift === 'D' ? 'D' : shift === 'N' ? 'N' : 'FULL_DAY'}
                notes={entryNotes}
              />
            ) : activeTab === 'TS' ? (
              <TSReport rows={rows} totals={totals} date={date} shift={shift} notes={entryNotes} />
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
                  checked={exportStock}
                  onChange={e => setExportStock(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                📦 Milk & Cream Stock Statement Sheet
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportSTG}
                  onChange={e => setExportSTG(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                ⚖️ Solid Balance (STG) Sheets
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportTS}
                  onChange={e => setExportTS(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                🧪 Total Solids (TS) Report Sheet
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
                disabled={exporting || (!exportSTG && !exportTS && !exportStock)}
              >
                {exporting ? 'Exporting...' : '💾 Export Selected Sheets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
