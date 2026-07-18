// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Milk & Cream Stock Statement Entry Form
// Supports dynamic product columns (insert at middle, delete with warnings)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Shift } from '@/lib/types';
import { STOCK_RECEIPT_LABELS, STOCK_DISPOSAL_LABELS, STOCK_PRODUCT_COLUMNS } from '@/lib/types';

type ColKey = string;

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
    make('PHYSICAL', 'Physical Count'),
  ];
}

export default function StockEntryForm() {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift>('D');
  const [shiftConfigs, setShiftConfigs] = useState<any[]>([
    { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
    { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
  ]);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<StockRowState[]>(makeDefaultRows);
  const [columns, setColumns] = useState<Array<{ key: ColKey; label: string }>>(() => [...STOCK_PRODUCT_COLUMNS]);
  const [sep, setSep] = useState<SepState>({
    wm_fat_pct: '', wm_snf_pct: '',
    cream_lts: '', cream_fat_pct: '', cream_snf_pct: '',
    ssm_lts: '', ssm_fat_pct: '', ssm_snf_pct: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load shifts config on mount
  useEffect(() => {
    async function loadShiftConfig() {
      try {
        const res = await fetch('/api/entries?report_type=STOCK&date=1970-01-01');
        if (res.ok) {
          const json = await res.json();
          const configEntry = json.data?.[0];
          if (configEntry && configEntry.notes) {
            const parsed = JSON.parse(configEntry.notes);
            if (Array.isArray(parsed) && parsed.length === 2) {
              setShiftConfigs(parsed);
              
              // Auto-detect current shift based on local time
              const now = new Date();
              const currentHours = now.getHours();
              const currentMinutes = now.getMinutes();
              const currentTimeVal = currentHours * 60 + currentMinutes;

              let detectedShift: Shift = 'D';
              for (const s of parsed) {
                const [startH, startM] = s.start.split(':').map(Number);
                const [endH, endM] = s.end.split(':').map(Number);
                const startVal = startH * 60 + startM;
                const endVal = endH * 60 + endM;

                if (startVal < endVal) {
                  if (currentTimeVal >= startVal && currentTimeVal < endVal) {
                    detectedShift = s.key;
                    break;
                  }
                } else {
                  if (currentTimeVal >= startVal || currentTimeVal < endVal) {
                    detectedShift = s.key;
                    break;
                  }
                }
              }
              setShift(detectedShift);
            }
          }
        }
      } catch (err) {
        console.error('Error loading shift configuration:', err);
      }
    }
    loadShiftConfig();
  }, []);

  useEffect(() => {
    if (!entryDate || !shift) return;
    let active = true;

    async function loadData() {
      try {
        const res = await fetch(`/api/stock?date=${entryDate}&shift=${shift}`);
        if (!res.ok) {
          if (active) {
            setRows(makeDefaultRows());
            setColumns([...STOCK_PRODUCT_COLUMNS]);
            setSep({
              wm_fat_pct: '', wm_snf_pct: '',
              cream_lts: '', cream_fat_pct: '', cream_snf_pct: '',
              ssm_lts: '', ssm_fat_pct: '', ssm_snf_pct: '',
            });
            setNotes('');
          }
          return;
        }

        const json = await res.json();
        const entry = json.data?.entries?.[0];
        if (!entry) return;

        if (active) {
          let parsedCols = [...STOCK_PRODUCT_COLUMNS];
          let customVals: Record<string, Record<string, string>> = {};
          let cleanNotes = entry.notes || '';

          const notesParts = (entry.notes || '').split('\n');
          notesParts.forEach((part: string) => {
            if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
              const [, metaJson] = part.split('__METADATA__:');
              try {
                const meta = JSON.parse(metaJson);
                if (meta.custom_columns) {
                  parsedCols = [...parsedCols, ...meta.custom_columns];
                }
                if (meta.custom_values) {
                  customVals = meta.custom_values;
                }
              } catch (e) {
                console.error('Failed to parse metadata:', e);
              }
              cleanNotes = cleanNotes.replace(part, '').trim();
            }
          });

          setColumns(parsedCols);
          setNotes(cleanNotes);

          const sortedDbRows = [...(json.data.stock_rows || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          let loadedRows: StockRowState[] = [];
          if (sortedDbRows.length > 0) {
            loadedRows = sortedDbRows.map((dbRow: any) => {
              const values: Record<string, string> = {};
              parsedCols.forEach(col => {
                if (dbRow[col.key] !== undefined && dbRow[col.key] !== null) {
                  values[col.key] = dbRow[col.key] === 0 ? '' : String(dbRow[col.key]);
                }
              });

              if (customVals[dbRow.row_label]) {
                Object.entries(customVals[dbRow.row_label]).forEach(([colKey, val]) => {
                  values[colKey] = val;
                });
              }

              return {
                row_type: dbRow.row_type,
                row_label: dbRow.row_label,
                values,
              };
            });
          } else {
            loadedRows = makeDefaultRows();
          }
          setRows(loadedRows);

          const sepData = json.data.separation_details.find((s: any) => s.entry_id === entry.id);
          if (sepData) {
            setSep({
              wm_fat_pct: String(sepData.wm_fat_pct ?? ''),
              wm_snf_pct: String(sepData.wm_snf_pct ?? ''),
              cream_lts: String(sepData.cream_lts ?? ''),
              cream_fat_pct: String(sepData.cream_fat_pct ?? ''),
              cream_snf_pct: String(sepData.cream_snf_pct ?? ''),
              ssm_lts: String(sepData.ssm_lts ?? ''),
              ssm_fat_pct: String(sepData.ssm_fat_pct ?? ''),
              ssm_snf_pct: String(sepData.ssm_snf_pct ?? ''),
            });
          }
        }
      } catch (err) {
        console.error('Error loading existing stock data:', err);
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift]);

  const updateCell = (rowIdx: number, col: ColKey, val: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], values: { ...next[rowIdx].values, [col]: val } };
      return next;
    });
  };

  const addRowAfter = (row_type: StockRowState['row_type'], idx: number) => {
    setRows(prev => {
      const next = [...prev];
      const newItem: StockRowState = {
        row_type,
        row_label: '',
        values: {},
      };
      if (idx !== -1) {
        next.splice(idx + 1, 0, newItem);
      } else {
        let insertAt = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].row_type === row_type) {
            insertAt = i;
            break;
          }
        }
        if (insertAt !== -1) {
          next.splice(insertAt + 1, 0, newItem);
        } else {
          next.push(newItem);
        }
      }
      return next;
    });
  };

  const deleteRow = (idx: number) => {
    setRows(prev => {
      const item = prev[idx];
      if (!item) return prev;
      const hasData = Object.values(item.values).some(v => v && parseFloat(v) !== 0);
      if (hasData || item.row_label.trim() !== '') {
        const ok = window.confirm("Are you sure you want to remove this row containing data?");
        if (!ok) return prev;
      }
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const addColumnAfter = (colKey: string) => {
    const label = window.prompt("Enter new column header name:");
    if (!label || label.trim() === '') return;

    const newKey = 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setColumns(prev => {
      const idx = prev.findIndex(c => c.key === colKey);
      const next = [...prev];
      if (idx === -1) {
        next.push({ key: newKey, label: label.trim() });
      } else {
        next.splice(idx + 1, 0, { key: newKey, label: label.trim() });
      }
      return next;
    });
  };

  const deleteColumn = (colKey: string) => {
    const hasData = rows.some(r => r.values[colKey] && parseFloat(r.values[colKey]) !== 0);
    if (hasData) {
      const ok = window.confirm("Are you sure you want to remove this column and all its data?");
      if (!ok) return;
    }

    setColumns(prev => prev.filter(c => c.key !== colKey));
    setRows(prev => prev.map(r => {
      const nextValues = { ...r.values };
      delete nextValues[colKey];
      return { ...r, values: nextValues };
    }));
  };

  const handleSave = async () => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setSaving(true); setError('');
    try {
      // 1. Extract custom columns and values metadata
      const customCols = columns.filter(c => !STOCK_PRODUCT_COLUMNS.some(dc => dc.key === c.key));
      const customValues: Record<string, Record<string, string>> = {}; // row_label -> colKey -> val
      rows.forEach(r => {
        const vals: Record<string, string> = {};
        customCols.forEach(cc => {
          if (r.values[cc.key]) {
            vals[cc.key] = r.values[cc.key]!;
          }
        });
        if (Object.keys(vals).length > 0) {
          customValues[r.row_label] = vals;
        }
      });

      // 2. Append metadata to notes for database-compatible serialization
      const metadata = {
        custom_columns: customCols,
        custom_values: customValues,
      };
      const finalNotes = notes.trim() + "\n__METADATA__:" + JSON.stringify(metadata);

      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: entryDate, shift, report_type: 'STOCK', notes: finalNotes }),
      });
      const entryData = await entryRes.json();
      if (!entryRes.ok) throw new Error(entryData.error || 'Failed to create entry');

      const entry_id = entryData.data.id;

      // 3. Map standard 12 columns to standard postgres fields
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
    const isBalanceSection = rowTypes.includes('OB') || rowTypes.includes('PHYSICAL');
    const rowType = rowTypes[0]; // 'RECEIPT' or 'DISPOSAL'

    return (
      <div key={sectionLabel} className="entry-form-section">
        <div className="entry-form-section-title" style={{ color: headerColor }}>
          {sectionLabel}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="inline-table" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 220 }}>Service Name</th>
                {columns.map(col => {
                  const isCustom = !STOCK_PRODUCT_COLUMNS.some(dc => dc.key === col.key);
                  return (
                    <th key={col.key} style={{ minWidth: 110, fontSize: '0.65rem', textAlign: 'center', padding: '8px 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontWeight: 700 }}>{col.label}</div>
                        <div className="no-print" style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            title="Add column after this"
                            onClick={() => addColumnAfter(col.key)}
                          >
                            ➕
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                              title="Delete column"
                              onClick={() => deleteColumn(col.key)}
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
                {!isBalanceSection && <th className="no-print" style={{ width: 70 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sRows.map(({ r, i }) => (
                <tr key={i}>
                  <td className="product-label" style={{ padding: 4 }}>
                    {isBalanceSection ? (
                      <span style={{ fontWeight: 600, paddingLeft: 8 }}>{r.row_label}</span>
                    ) : (
                      <input
                        type="text"
                        placeholder="Enter Service Name..."
                        value={r.row_label}
                        onChange={e => {
                          const val = e.target.value;
                          setRows(prev => {
                            const next = [...prev];
                            next[i] = { ...next[i], row_label: val };
                            return next;
                          });
                        }}
                        style={{ textAlign: 'left', fontWeight: 500, border: 'none', background: 'transparent', width: '100%', padding: '6px 8px' }}
                      />
                    )}
                  </td>
                  {columns.map(col => (
                    <td key={col.key}>
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={r.values[col.key] || ''}
                        onChange={e => updateCell(i, col.key, e.target.value)}
                        id={`stock-${r.row_type}-${i}-${col.key}`}
                      />
                    </td>
                  ))}
                  {!isBalanceSection && (
                    <td className="no-print" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Add row below"
                          onClick={() => addRowAfter(rowType, i)}
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Delete row"
                          onClick={() => deleteRow(i)}
                        >
                          ❌
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!isBalanceSection && (
                <tr className="no-print" style={{ cursor: 'pointer', background: '#f8fafc' }} onClick={() => {
                  const lastRow = sRows[sRows.length - 1];
                  addRowAfter(rowType, lastRow ? lastRow.i : -1);
                }}>
                  <td colSpan={columns.length + 2} style={{ textAlign: 'center', color: 'var(--brand-primary)', fontWeight: 600, padding: 8 }}>
                    ➕ Add Row
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="form-container">
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
              {(['D', 'N'] as Shift[]).map(s => {
                const cfg = shiftConfigs.find(c => c.key === s) || {
                  label: s === 'D' ? 'Day Shift' : 'Night Shift',
                  start: s === 'D' ? '06:00' : '18:00',
                  end: s === 'D' ? '18:00' : '06:00'
                };
                return (
                  <button
                    key={s}
                    id={`shift-${s}`}
                    type="button"
                    className={`btn ${shift === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShift(s)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 12px', height: 'auto', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {s === 'D' ? '☀️' : '🌙'} {cfg.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                      {cfg.start} - {cfg.end}
                    </div>
                  </button>
                );
              })}
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
