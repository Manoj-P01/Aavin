'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Shift } from '@/lib/types';
import { STOCK_RECEIPT_LABELS, STOCK_DISPOSAL_LABELS, STOCK_PRODUCT_COLUMNS } from '@/lib/types';

type ColKey = typeof STOCK_PRODUCT_COLUMNS[number]['key'];

interface StockRowState {
  row_type: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'PHYSICAL';
  row_label: string;
  values: Partial<Record<ColKey, string>>;
}

interface SepState {
  wm_fat_pct: string; wm_snf_pct: string;
  cream_lts: string; cream_fat_pct: string; cream_snf_pct: string;
  ssm_lts: string; ssm_fat_pct: string; ssm_snf_pct: string;
}

function makeDefaultRows(): StockRowState[] {
  const make = (row_type: StockRowState['row_type'], row_label: string): StockRowState => ({
    row_type, row_label, values: {},
  });

  return [
    make('OB', 'Opening Balance'),
    ...STOCK_RECEIPT_LABELS.map(l => make('RECEIPT', l)),
    ...STOCK_DISPOSAL_LABELS.map(l => make('DISPOSAL', l)),
    make('PHYSICAL', 'Physical Count'),
  ];
}

export default function StockEntryForm() {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift>('D');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<StockRowState[]>(makeDefaultRows);
  const [sep, setSep] = useState<SepState>({
    wm_fat_pct: '3.9', wm_snf_pct: '7.95',
    cream_lts: '', cream_fat_pct: '40', cream_snf_pct: '',
    ssm_lts: '', ssm_fat_pct: '0.05', ssm_snf_pct: '8.2',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateCell = (rowIdx: number, col: ColKey, val: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], values: { ...next[rowIdx].values, [col]: val } };
      return next;
    });
  };

  const handleSave = async () => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setSaving(true); setError('');
    try {
      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: entryDate, shift, report_type: 'STOCK', notes }),
      });
      const entryData = await entryRes.json();
      if (!entryRes.ok) throw new Error(entryData.error || 'Failed to create entry');

      const entry_id = entryData.data.id;

      const stockRows = rows.map((r, i) => ({
        row_type: r.row_type,
        row_label: r.row_label,
        sort_order: i,
        ...Object.fromEntries(
          STOCK_PRODUCT_COLUMNS.map(col => [col.key, parseFloat(r.values[col.key] || '0') || 0])
        ),
      }));

      const sepData = Object.fromEntries(
        Object.entries(sep).map(([k, v]) => [k, parseFloat(v) || 0])
      );

      const stockRes = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id, stock_rows: stockRows, separation_details: sepData }),
      });
      if (!stockRes.ok) {
        const d = await stockRes.json();
        throw new Error(d.error || 'Failed to save stock rows');
      }

      router.push(`/dashboard/stock/${entryDate}/${shift}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (
    sectionLabel: string,
    rowTypes: StockRowState['row_type'][],
    headerColor: string
  ) => {
    const sRows = rows.map((r, i) => ({ r, i })).filter(x => rowTypes.includes(x.r.row_type));
    return (
      <div key={sectionLabel} className="entry-form-section">
        <div className="entry-form-section-title" style={{ color: headerColor }}>
          {sectionLabel}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 180 }}>Particulars</th>
                {STOCK_PRODUCT_COLUMNS.map(col => (
                  <th key={col.key} style={{ minWidth: 90, fontSize: '0.65rem' }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sRows.map(({ r, i }) => (
                <tr key={i}>
                  <td className="product-label">{r.row_label}</td>
                  {STOCK_PRODUCT_COLUMNS.map(col => (
                    <td key={col.key}>
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={r.values[col.key] || ''}
                        onChange={e => updateCell(i, col.key, e.target.value)}
                        id={`stock-${r.row_type}-${r.row_label}-${col.key}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Entry Details</div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              id="stock-entry-date"
              type="date"
              className="form-input"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Shift *</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {(['D', 'N'] as Shift[]).map(s => (
                <button
                  key={s}
                  id={`shift-${s}`}
                  type="button"
                  className={`btn ${shift === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShift(s)}
                  style={{ flex: 1 }}
                >
                  {s === 'D' ? '☀️ Day' : '🌙 Night'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Holiday, machine maintenance..."
            />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {renderSection('Opening Balance', ['OB'], '#0ea5e9')}
      {renderSection('Receipts', ['RECEIPT'], '#10b981')}
      {renderSection('Disposals', ['DISPOSAL'], '#f59e0b')}
      {renderSection('Physical Count', ['PHYSICAL'], '#06b6d4')}

      {/* Separation Details */}
      <div className="entry-form-section">
        <div className="entry-form-section-title" style={{ color: '#a78bfa' }}>
          ⚗️ Separation Details
        </div>
        <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { key: 'wm_fat_pct', label: 'WM Fat %' },
            { key: 'wm_snf_pct', label: 'WM SNF %' },
            { key: 'cream_lts', label: 'Cream (Lts)' },
            { key: 'cream_fat_pct', label: 'Cream Fat %' },
            { key: 'cream_snf_pct', label: 'Cream SNF %' },
            { key: 'ssm_lts', label: 'SSM (Lts)' },
            { key: 'ssm_fat_pct', label: 'SSM Fat %' },
            { key: 'ssm_snf_pct', label: 'SSM SNF %' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}</label>
              <input
                type="number"
                step="any"
                className="form-input mono"
                value={sep[f.key as keyof SepState]}
                onChange={e => setSep(prev => ({ ...prev, [f.key]: e.target.value }))}
                id={`sep-${f.key}`}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-secondary" onClick={() => router.back()} disabled={saving}>Cancel</button>
        <button
          id="stock-save-btn"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : '💾 Save Stock Statement'}
        </button>
      </div>
    </div>
  );
}
