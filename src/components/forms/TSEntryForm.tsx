'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { calcKgFatSnf, calcQtyKg, generateDynamicBalanceRows } from '@/lib/calculations';
import type { TSSection, Shift } from '@/lib/types';

interface RowState {
  section: TSSection;
  product: string;
  qty_lts: string;
  qty_kg: string;
  fat_pct: string;
  snf_pct: string;
  sp_gr: string;
  kg_fat: string;
  kg_snf: string;
  remarks: string;
}

const DEFAULT_SP_GR: Record<string, number> = {
  WM: 1.0272, SSM: 1.0311, CREAM: 0.9893, 'DLT MILK': 1.0298,
  'FC.MILK': 1.0298, 'STD.Milk': 1.029, SMP: 1.3834,
};

const DEFAULT_FAT: Record<string, number> = {
  WM: 3.93, SSM: 0.05, CREAM: 39.21, 'DLT MILK': 3.5,
  'FC.MILK': 6, 'STD.Milk': 4.5, SMP: 0.5,
};

const DEFAULT_SNF: Record<string, number> = {
  WM: 7.95, SSM: 8.14, CREAM: 5.53, 'DLT MILK': 8.5,
  'FC.MILK': 9, 'STD.Milk': 8.5, SMP: 96.3,
};

const INITIAL_OB: string[] = [];
const INITIAL_RECEIPTS: string[] = [];
const INITIAL_DESPATCH: string[] = [];
const INITIAL_LOCAL: string[] = [];
const INITIAL_OTHER: string[] = [];

function makeDefaultRows(): RowState[] {
  const rows: RowState[] = [];
  const addSection = (section: TSSection, products: string[]) => {
    const isOBorCB = section === 'OB' || section === 'CB';
    products.forEach(product => {
      rows.push({
        section, product,
        qty_lts: '',
        qty_kg: '',
        fat_pct: isOBorCB ? String(DEFAULT_FAT[product] || '') : '',
        snf_pct: isOBorCB ? String(DEFAULT_SNF[product] || '') : '',
        sp_gr: isOBorCB ? String(DEFAULT_SP_GR[product] || '') : '',
        kg_fat: '',
        kg_snf: '',
        remarks: '',
      });
    });
  };

  addSection('OB', INITIAL_OB);
  addSection('RECEIPT', INITIAL_RECEIPTS);
  addSection('DISPOSAL_DESPATCH', INITIAL_DESPATCH);
  addSection('LOCAL_SALE', INITIAL_LOCAL);
  addSection('OTHER_DISPOSAL', INITIAL_OTHER);
  addSection('CB', INITIAL_OB);
  return rows;
}

const SECTION_META: { key: TSSection; label: string; color: string }[] = [
  { key: 'OB',                label: 'O/B (Opening Balance)',          color: '#0284c7' },
  { key: 'RECEIPT',           label: 'Receipts',                       color: '#16a34a' },
  { key: 'DISPOSAL_DESPATCH', label: 'Disposal – Despatch / Sale',     color: '#ea580c' },
  { key: 'LOCAL_SALE',        label: 'Local Sales',                    color: '#ea580c' },
  { key: 'OTHER_DISPOSAL',    label: 'Other Disposal',                 color: '#ea580c' },
  { key: 'CB',                label: 'C/B (Closing Balance)',          color: '#0d9488' },
];

export default function TSEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const getInitialShift = (): Shift | null => {
    if (paramShift === 'D' || paramShift === 'N') return paramShift;
    if (paramShift === 'null' || paramShift === 'NULL') return null;
    return null; // Default to Full Day if no shift is specified or it is invalid
  };

  const [entryDate, setEntryDate] = useState(paramDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift | null>(getInitialShift());
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<RowState[]>(makeDefaultRows);
  const [savingSection, setSavingSection] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [mainSaving, setMainSaving] = useState(false);
  const [error, setError] = useState('');
  const [formulasConfig, setFormulasConfig] = useState<any>(null);

  // Load existing TS entry on mount or when entryDate or shift changes
  useEffect(() => {
    if (!entryDate) return;
    let active = true;

    async function loadData() {
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

        // Fetch global statements config
        let gStmts: any[] = [];
        try {
          const configRes = await fetch('/api/entries?report_type=TS&date=1970-01-01');
          if (configRes.ok) {
            const configJson = await configRes.json();
            const configEntry = configJson.data?.[0];
            if (configEntry && configEntry.notes) {
              gStmts = JSON.parse(configEntry.notes) || [];
            }
          }
        } catch (err) {
          console.error('Failed to load global config', err);
        }

        const res = await fetch(`/api/ts?date=${entryDate}${shift ? `&shift=${shift}` : ''}`);
        let activeRows: RowState[] = [];
        let hasSavedRows = false;
        let entryNotes = '';
        let stgRows: any[] = [];

        if (res.ok) {
          const data = await res.json();
          if (active && data.data) {
            entryNotes = data.data.notes || '';
            stgRows = data.data.stg_rows || [];
            if (data.data.ts_rows && data.data.ts_rows.length > 0) {
              hasSavedRows = true;
              activeRows = data.data.ts_rows.map((row: any) => ({
                section: row.section,
                product: row.product || '',
                qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                remarks: row.remarks || '',
              }));
            }
          }
        }

        if (!hasSavedRows) {
          activeRows = makeDefaultRows();
        }

        const { obRows, cbRows } = generateDynamicBalanceRows(stgRows, entryNotes, gStmts);
        const formObRows = obRows.map(r => ({
          section: 'OB' as TSSection,
          product: r.product,
          qty_lts: r.qty_lts ? String(r.qty_lts) : '',
          qty_kg: r.qty_kg ? String(r.qty_kg) : '',
          fat_pct: r.fat_pct ? String(r.fat_pct) : '',
          snf_pct: r.snf_pct ? String(r.snf_pct) : '',
          sp_gr: r.sp_gr ? String(r.sp_gr) : '',
          kg_fat: r.kg_fat ? String(r.kg_fat) : '',
          kg_snf: r.kg_snf ? String(r.kg_snf) : '',
          remarks: '',
        }));
        const formCbRows = cbRows.map(r => ({
          section: 'CB' as TSSection,
          product: r.product,
          qty_lts: r.qty_lts ? String(r.qty_lts) : '',
          qty_kg: r.qty_kg ? String(r.qty_kg) : '',
          fat_pct: r.fat_pct ? String(r.fat_pct) : '',
          snf_pct: r.snf_pct ? String(r.snf_pct) : '',
          sp_gr: r.sp_gr ? String(r.sp_gr) : '',
          kg_fat: r.kg_fat ? String(r.kg_fat) : '',
          kg_snf: r.kg_snf ? String(r.kg_snf) : '',
          remarks: '',
        }));

        const otherRows = activeRows.filter(r => r.section !== 'OB' && r.section !== 'CB');
        const mergedRows = [...formObRows, ...otherRows, ...formCbRows];

        if (active) {
          setRows(mergedRows);
          setNotes(entryNotes);
        }
      } catch (err) {
        console.error('Error loading TS data:', err);
        if (active) {
          setRows(makeDefaultRows());
          setNotes('');
        }
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift]);

  const updateRow = (idx: number, field: keyof RowState, value: string) => {
    const finalVal = field === 'product' ? value.toUpperCase() : value;
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: finalVal };

      // 1. Auto-calc qty_kg from qty_lts × sp_gr if they haven't explicitly set it or are updating inputs
      if (field === 'qty_lts' || field === 'sp_gr') {
        const lts = parseFloat(field === 'qty_lts' ? value : next[idx].qty_lts) || 0;
        const spg = parseFloat(field === 'sp_gr' ? value : next[idx].sp_gr) || 0;
        if (lts && spg) {
          next[idx].qty_kg = String(calcQtyKg(lts, spg, formulasConfig || undefined));
        }
      }

      // 2. Auto-calc kg_fat / kg_snf from qty_kg, fat_pct, snf_pct
      const kg = parseFloat(next[idx].qty_kg) || 0;
      const fat = parseFloat(next[idx].fat_pct) || 0;
      const snf = parseFloat(next[idx].snf_pct) || 0;
      const calc = calcKgFatSnf(kg, fat, snf, formulasConfig || undefined);

      if (field === 'qty_kg' || field === 'qty_lts' || field === 'sp_gr' || field === 'fat_pct') {
        next[idx].kg_fat = calc.kg_fat > 0 ? String(calc.kg_fat) : '';
      }
      if (field === 'qty_kg' || field === 'qty_lts' || field === 'sp_gr' || field === 'snf_pct') {
        next[idx].kg_snf = calc.kg_snf > 0 ? String(calc.kg_snf) : '';
      }

      return next;
    });
  };

  const addRowAfter = (section: TSSection, originalIdx: number) => {
    setRows(prev => {
      const next = [...prev];
      const item: RowState = {
        section,
        product: '',
        qty_lts: '',
        qty_kg: '',
        fat_pct: '',
        snf_pct: '',
        sp_gr: '',
        kg_fat: '',
        kg_snf: '',
        remarks: '',
      };

      if (originalIdx !== -1) {
        next.splice(originalIdx + 1, 0, item);
      } else {
        // Find last index of this section in rows
        let insertAt = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].section === section) {
            insertAt = i;
            break;
          }
        }
        if (insertAt !== -1) {
          next.splice(insertAt + 1, 0, item);
        } else {
          next.push(item);
        }
      }
      return next;
    });
  };

  const deleteRow = (originalIdx: number) => {
    setRows(prev => {
      const item = prev[originalIdx];
      if (!item) return prev;

      const hasContent = (
        item.product.trim() !== '' ||
        item.qty_lts.trim() !== '' ||
        item.qty_kg.trim() !== '' ||
        item.fat_pct.trim() !== '' ||
        item.snf_pct.trim() !== '' ||
        item.sp_gr.trim() !== '' ||
        item.kg_fat.trim() !== '' ||
        item.kg_snf.trim() !== '' ||
        (item.remarks || '').trim() !== ''
      );

      if (hasContent) {
        const ok = window.confirm("Are you sure you want to remove this row containing data?");
        if (!ok) return prev;
      }

      const next = [...prev];
      next.splice(originalIdx, 1);
      return next;
    });
  };

  // Helper to ensure the main entry exists, returning the entry ID
  const getOrCreateEntryId = async (): Promise<string> => {
    const entryRes = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: entryDate, shift, report_type: 'TS', notes }),
    });
    const entryData = await entryRes.json();
    if (!entryRes.ok && entryRes.status !== 409) {
      throw new Error(entryData.error || 'Failed to initialize entry');
    }

    if (entryRes.status === 409) {
      // Entry already exists, fetch it
      const getRes = await fetch(`/api/entries?report_type=TS&date=${entryDate}&shift=${shift}`);
      const getData = await getRes.json();
      if (getData.data && getData.data.length > 0) {
        return getData.data[0].id;
      }
      throw new Error('Conflict created but couldn\'t retrieve entry ID');
    }

    return entryData.data.id;
  };

  // Save a single section independently
  const handleSaveSection = async (section: TSSection) => {
    if (!entryDate) { setError('Please select a date first.'); return; }
    setSavingSection(prev => ({ ...prev, [section]: true }));
    setError('');
    try {
      const entryId = await getOrCreateEntryId();
      const sectionRows = rows.filter(r => r.section === section);

      const res = await fetch('/api/ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          section, // Let backend delete only this section's old entries
          ts_rows: sectionRows.map((r, i) => ({ ...r, sort_order: i })),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `Failed to save ${section} section`);
      }

      setSaveStatus(prev => ({ ...prev, [section]: 'Saved successfully! ✓' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [section]: '' }));
      }, 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Section save failed');
    } finally {
      setSavingSection(prev => ({ ...prev, [section]: false }));
    }
  };

  const handleSaveAll = async () => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setMainSaving(true); setError('');
    try {
      const entryId = await getOrCreateEntryId();

      const res = await fetch('/api/ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          ts_rows: rows.map((r, i) => ({ ...r, sort_order: i })),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save TS report');
      }

      router.push(`/dashboard/ts/${entryDate}?shift=${shift ?? 'null'}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setMainSaving(false);
    }
  };

  return (
    <div className="form-container">
      {/* Date / Shift / Notes */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Entry Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              id="ts-entry-date"
              type="date"
              className="form-input"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reporting Type *</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className={`btn ${!shift ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShift(null)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>🗓️ Full Day</span>
              </button>
              <button
                type="button"
                className={`btn ${shift ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShift('D')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>⏱️ Shift-wise</span>
              </button>
            </div>
          </div>
          {shift && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Shift *</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {[
                  { label: '☀️ Day Shift', value: 'D' },
                  { label: '🌙 Night Shift', value: 'N' }
                ].map(s => (
                  <button
                    key={s.value}
                    type="button"
                    className={`btn ${shift === s.value ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShift(s.value as Shift)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Maintenance day, partial collection..."
            />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Sections */}
      {SECTION_META.map(({ key, label, color }) => {
        const isBalanceSection = key === 'OB' || key === 'CB';
        const sRowsWithIdx = rows
          .map((r, originalIdx) => ({ r, originalIdx }))
          .filter(x => x.r.section === key);

        const disabledStyle = { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' };

        return (
          <div key={key} className="entry-form-section">
            <div className="entry-form-section-title" style={{ color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {label}
                {isBalanceSection && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, marginLeft: 8, opacity: 0.85, padding: '2px 6px', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, verticalAlign: 'middle', color: 'var(--text-secondary)' }}>
                    🔗 Auto-populated from STG
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saveStatus[key] && (
                  <span style={{ fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>
                    {saveStatus[key]}
                  </span>
                )}
                {!isBalanceSection && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ background: color, border: 'none', boxShadow: 'none' }}
                    onClick={() => handleSaveSection(key)}
                    disabled={savingSection[key]}
                  >
                    {savingSection[key] ? 'Saving...' : '💾 Save Section'}
                  </button>
                )}
              </div>
            </div>
            <div className="table-wrapper">
              <table className="inline-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', minWidth: 150 }}>Product</th>
                    <th style={{ minWidth: 90 }}>Qty (Lts)</th>
                    <th style={{ minWidth: 90, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Qty (Kg)</th>
                    <th style={{ minWidth: 70 }}>Fat %</th>
                    <th style={{ minWidth: 70 }}>SNF %</th>
                    <th style={{ minWidth: 70, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Sp. Gr</th>
                    <th style={{ minWidth: 90, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Kg Fat</th>
                    <th style={{ minWidth: 90, backgroundColor: '#e0f2fe', color: '#0369a1' }}>Kg SNF</th>
                    <th className="no-print" style={{ width: 70 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sRowsWithIdx.map(({ r, originalIdx }) => (
                    <tr key={`${key}-${originalIdx}`}>
                      <td>
                        <input
                          type="text"
                          value={r.product}
                          onChange={e => updateRow(originalIdx, 'product', e.target.value)}
                          style={{ textAlign: 'left', fontWeight: 500, fontFamily: 'var(--font-sans)', ...(isBalanceSection ? disabledStyle : {}) }}
                          id={`ts-${key}-${originalIdx}-product`}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={r.qty_lts}
                          onChange={e => updateRow(originalIdx, 'qty_lts', e.target.value)}
                          id={`ts-${key}-${originalIdx}-lts`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={r.qty_kg}
                          onChange={e => updateRow(originalIdx, 'qty_kg', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kg`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.fat_pct}
                          onChange={e => updateRow(originalIdx, 'fat_pct', e.target.value)}
                          id={`ts-${key}-${originalIdx}-fat`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.snf_pct}
                          onChange={e => updateRow(originalIdx, 'snf_pct', e.target.value)}
                          id={`ts-${key}-${originalIdx}-snf`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.sp_gr}
                          onChange={e => updateRow(originalIdx, 'sp_gr', e.target.value)}
                          id={`ts-${key}-${originalIdx}-spg`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.kg_fat}
                          onChange={e => updateRow(originalIdx, 'kg_fat', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kgfat`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.kg_snf}
                          onChange={e => updateRow(originalIdx, 'kg_snf', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kgsnf`}
                          style={isBalanceSection ? disabledStyle : {}}
                          disabled={isBalanceSection}
                        />
                      </td>

                      <td className="no-print">
                        {isBalanceSection ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                              title="Add row below"
                              onClick={() => addRowAfter(key, originalIdx)}
                            >
                              ➕
                            </button>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                              title="Delete row"
                              onClick={() => deleteRow(originalIdx)}
                            >
                              ❌
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Clickable inline Add Row */}
                  {!isBalanceSection && (
                    <tr className="no-print" style={{ cursor: 'pointer', background: '#f8fafc' }} onClick={() => {
                      const lastSecRow = sRowsWithIdx[sRowsWithIdx.length - 1];
                      addRowAfter(key, lastSecRow ? lastSecRow.originalIdx : -1);
                    }}>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--brand-primary)', fontWeight: 600, padding: 8 }}>
                        ➕ Add Row
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12, marginBottom: 40 }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.back()}
          disabled={mainSaving}
        >
          Cancel
        </button>
        <button
          id="ts-save-btn"
          className="btn btn-primary"
          onClick={handleSaveAll}
          disabled={mainSaving}
        >
          {mainSaving ? 'Saving All...' : '💾 Save Entire TS Report'}
        </button>
      </div>
    </div>
  );
}
