'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calcKgFatSnf } from '@/lib/calculations';
import type { TSSection } from '@/lib/types';

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

const INITIAL_OB = ['WM', 'SSM', 'CREAM', 'DLT MILK', 'FC.MILK', 'STD.Milk', 'SMP'];
const INITIAL_RECEIPTS = ['P.VELUR CC', "BMC's", 'LAB SAMPLE RTN', 'WF', 'SMP', 'RINSE MILK', 'BUTTER MILK', 'DLT SACHET RTN', 'FCM SACHET RTN', 'STD SACHET RTN'];
const INITIAL_DESPATCH = ['AMBATTUR-SSM', 'SNR-SSM', 'DCPP-SSM', 'ERODE-SSM', 'CBE-SSM'];
const INITIAL_LOCAL = ['DLT MILK', 'FC.MILK', 'STD.Milk', 'OTHERS'];
const INITIAL_OTHER = ['SMP', 'CURD/BM', 'TO KHOA', 'LAB SAMPLE', 'CREAM-CON'];

function makeDefaultRows(): RowState[] {
  const rows: RowState[] = [];
  const addSection = (section: TSSection, products: string[]) => {
    products.forEach(product => {
      rows.push({
        section, product,
        qty_lts: '',
        qty_kg: '',
        fat_pct: String(DEFAULT_FAT[product] || ''),
        snf_pct: String(DEFAULT_SNF[product] || ''),
        sp_gr: String(DEFAULT_SP_GR[product] || ''),
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
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<RowState[]>(makeDefaultRows);
  const [savingSection, setSavingSection] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [mainSaving, setMainSaving] = useState(false);
  const [error, setError] = useState('');

  const updateRow = (idx: number, field: keyof RowState, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };

      // 1. Auto-calc qty_kg from qty_lts × sp_gr if they haven't explicitly set it or are updating inputs
      if (field === 'qty_lts' || field === 'sp_gr') {
        const lts = parseFloat(field === 'qty_lts' ? value : next[idx].qty_lts) || 0;
        const spg = parseFloat(field === 'sp_gr' ? value : next[idx].sp_gr) || 0;
        if (lts && spg) {
          next[idx].qty_kg = (lts * spg).toFixed(3);
        }
      }

      // 2. Auto-calc kg_fat / kg_snf from qty_kg, fat_pct, snf_pct
      const kg = parseFloat(next[idx].qty_kg) || 0;
      const fat = parseFloat(next[idx].fat_pct) || 0;
      const snf = parseFloat(next[idx].snf_pct) || 0;
      const calc = calcKgFatSnf(kg, fat, snf);

      if (field === 'qty_kg' || field === 'qty_lts' || field === 'sp_gr' || field === 'fat_pct') {
        next[idx].kg_fat = calc.kg_fat > 0 ? String(calc.kg_fat) : '';
      }
      if (field === 'qty_kg' || field === 'qty_lts' || field === 'sp_gr' || field === 'snf_pct') {
        next[idx].kg_snf = calc.kg_snf > 0 ? String(calc.kg_snf) : '';
      }

      return next;
    });
  };

  const addCustomRow = (section: TSSection) => {
    setRows(prev => [
      ...prev,
      {
        section,
        product: 'New Product',
        qty_lts: '',
        qty_kg: '',
        fat_pct: '',
        snf_pct: '',
        sp_gr: '1.027',
        kg_fat: '',
        kg_snf: '',
        remarks: '',
      },
    ]);
  };

  // Helper to ensure the main entry exists, returning the entry ID
  const getOrCreateEntryId = async (): Promise<string> => {
    const entryRes = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: entryDate, report_type: 'TS', notes }),
    });
    const entryData = await entryRes.json();
    if (!entryRes.ok && entryRes.status !== 409) {
      throw new Error(entryData.error || 'Failed to initialize entry');
    }

    if (entryRes.status === 409) {
      // Entry already exists, fetch it
      const getRes = await fetch(`/api/entries?report_type=TS&date=${entryDate}`);
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

      router.push(`/dashboard/ts/${entryDate}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setMainSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Date / Notes */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Entry Details</div>
        <div className="form-row form-row-3">
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
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
        const sRowsWithIdx = rows
          .map((r, originalIdx) => ({ r, originalIdx }))
          .filter(x => x.r.section === key);

        return (
          <div key={key} className="entry-form-section">
            <div className="entry-form-section-title" style={{ color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{label}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saveStatus[key] && (
                  <span style={{ fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>
                    {saveStatus[key]}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => addCustomRow(key)}
                >
                  ➕ Add custom row
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: color, border: 'none', boxShadow: 'none' }}
                  onClick={() => handleSaveSection(key)}
                  disabled={savingSection[key]}
                >
                  {savingSection[key] ? 'Saving...' : '💾 Save Section'}
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="inline-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', minWidth: 150 }}>Product</th>
                    <th style={{ minWidth: 90 }}>Qty (Lts)</th>
                    <th style={{ minWidth: 90 }}>Qty (Kg)</th>
                    <th style={{ minWidth: 70 }}>Fat %</th>
                    <th style={{ minWidth: 70 }}>SNF %</th>
                    <th style={{ minWidth: 70 }}>Sp. Gr</th>
                    <th style={{ minWidth: 90 }}>Kg Fat</th>
                    <th style={{ minWidth: 90 }}>Kg SNF</th>
                    <th style={{ minWidth: 150 }}>Remarks</th>
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
                          style={{ textAlign: 'left', fontWeight: 500, fontFamily: 'var(--font-sans)' }}
                          id={`ts-${key}-${originalIdx}-product`}
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
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.fat_pct}
                          onChange={e => updateRow(originalIdx, 'fat_pct', e.target.value)}
                          id={`ts-${key}-${originalIdx}-fat`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.snf_pct}
                          onChange={e => updateRow(originalIdx, 'snf_pct', e.target.value)}
                          id={`ts-${key}-${originalIdx}-snf`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.sp_gr}
                          onChange={e => updateRow(originalIdx, 'sp_gr', e.target.value)}
                          id={`ts-${key}-${originalIdx}-spg`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.kg_fat}
                          onChange={e => updateRow(originalIdx, 'kg_fat', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kgfat`}
                          style={{ fontWeight: 600, color }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          value={r.kg_snf}
                          onChange={e => updateRow(originalIdx, 'kg_snf', e.target.value)}
                          id={`ts-${key}-${originalIdx}-kgsnf`}
                          style={{ fontWeight: 600, color }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="add remarks..."
                          value={r.remarks}
                          onChange={e => updateRow(originalIdx, 'remarks', e.target.value)}
                          style={{ textAlign: 'left', fontFamily: 'var(--font-sans)' }}
                          id={`ts-${key}-${originalIdx}-remarks`}
                        />
                      </td>
                    </tr>
                  ))}
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
