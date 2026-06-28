'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import StockReport from '@/components/reports/StockReport';
import Link from 'next/link';
import { fmtDate, calcStockSummary, combineShiftSummaries } from '@/lib/calculations';
import type { StockRow, SeparationDetails, Shift } from '@/lib/types';

interface ShiftData {
  rows: StockRow[];
  separation: SeparationDetails | null;
}

export default function StockViewPage() {
  const { date, shift } = useParams<{ date: string; shift: string }>();
  const router = useRouter();
  const [data, setData] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'shift' | 'combined'>('shift');

  // Also load the opposite shift for combined view
  const [otherShiftData, setOtherShiftData] = useState<ShiftData | null>(null);
  const otherShift: Shift = shift === 'D' ? 'N' : 'D';

  useEffect(() => {
    async function load() {
      try {
        // Load this shift
        const res = await fetch(`/api/stock?date=${date}&shift=${shift}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Not found');

        const entry = json.data?.entries?.[0];
        if (!entry) throw new Error('Entry not found');

        const shiftRows = json.data.stock_rows.filter((r: StockRow) => r.entry_id === entry.id);
        const shiftSep = json.data.separation_details.find((s: SeparationDetails) => s.entry_id === entry.id) || null;
        setData({ rows: shiftRows, separation: shiftSep });

        // Try to load the other shift too (for combined)
        try {
          const res2 = await fetch(`/api/stock?date=${date}&shift=${otherShift}`);
          if (res2.ok) {
            const json2 = await res2.json();
            const entry2 = json2.data?.entries?.[0];
            if (entry2) {
              const rows2 = json2.data.stock_rows.filter((r: StockRow) => r.entry_id === entry2.id);
              const sep2 = json2.data.separation_details.find((s: SeparationDetails) => s.entry_id === entry2.id) || null;
              setOtherShiftData({ rows: rows2, separation: sep2 });
            }
          }
        } catch { /* other shift may not exist */ }

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date, shift, otherShift]);

  // Combined view: merge both shifts
  const getCombinedRows = (): { rows: StockRow[]; separation: SeparationDetails | null } => {
    if (!data || !otherShiftData) return data || { rows: [], separation: null };
    const dayData = shift === 'D' ? data : otherShiftData;
    const nightData = shift === 'N' ? data : otherShiftData;
    const daySummary = calcStockSummary(dayData.rows);
    const nightSummary = calcStockSummary(nightData.rows);
    const combined = combineShiftSummaries(daySummary, nightSummary);

    // Build synthetic rows for combined display
    const syntheticRows: StockRow[] = [
      { id: 'ob', entry_id: 'combined', row_type: 'OB', row_label: 'Opening Balance', sort_order: 0, ...combined.opening_balance },
      ...combined.total_receipts ? [{ id: 'rec', entry_id: 'combined', row_type: 'RECEIPT' as const, row_label: 'Receipts:', sort_order: 1, ...combined.total_receipts }] : [],
      ...combined.total_disposals ? [{ id: 'dis', entry_id: 'combined', row_type: 'DISPOSAL' as const, row_label: 'Disposals', sort_order: 2, ...combined.total_disposals }] : [],
      { id: 'ph', entry_id: 'combined', row_type: 'PHYSICAL', row_label: 'Physical Count', sort_order: 3, ...combined.physical_count },
    ];
    return { rows: syntheticRows, separation: dayData.separation };
  };

  const displayData = viewMode === 'combined' ? getCombinedRows() : (data || { rows: [], separation: null });

  return (
    <>
      <Header
        title={`Stock Statement – ${date ? fmtDate(date) : ''}`}
        subtitle={`Shift: ${shift === 'D' ? 'Day' : 'Night'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            {otherShiftData && (
              <div className="tabs">
                <button
                  className={`tab ${viewMode === 'shift' ? 'active' : ''}`}
                  onClick={() => setViewMode('shift')}
                >
                  {shift === 'D' ? '☀️ Day' : '🌙 Night'}
                </button>
                <button
                  className={`tab ${viewMode === 'combined' ? 'active' : ''}`}
                  onClick={() => setViewMode('combined')}
                >
                  🌓 Combined Day
                </button>
              </div>
            )}
            <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>🖨 Print / PDF</button>
            <Link href="/dashboard/stock" className="btn btn-ghost btn-sm">← Back</Link>
          </div>
        }
      />
      <div className="page-body animate-fade-in">
        {/* Other shift link */}
        {!loading && !error && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }} className="no-print">
            <Link
              href={`/dashboard/stock/${date}/${otherShift}`}
              className="btn btn-secondary btn-sm"
            >
              View {otherShift === 'D' ? '☀️ Day' : '🌙 Night'} Shift →
            </Link>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
            <span className="spinner" /> Loading report...
          </div>
        ) : error ? (
          <div className="alert alert-error">
            ⚠️ {error}
            <button onClick={() => router.back()} style={{ marginLeft: 12 }} className="btn btn-ghost btn-sm">Go Back</button>
          </div>
        ) : (
          <div className="card">
            <StockReport
              rows={displayData.rows}
              separation={displayData.separation}
              date={date}
              shift={viewMode === 'combined' ? 'COMBINED' : (shift as Shift)}
            />
          </div>
        )}
      </div>
    </>
  );
}
