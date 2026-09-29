'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

interface STGColumnDef {
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
  sort_order?: number;
  is_active?: boolean;
}

export default function STGColumnsPage() {
  const [columns, setColumns] = useState<STGColumnDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formFormula, setFormFormula] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formDecimals, setFormDecimals] = useState<number | undefined>(undefined);

  const { confirm } = useConfirm();

  useEffect(() => {
    loadColumns();
  }, []);

  const loadColumns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ts/columns');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.columns)) setColumns(json.columns);
      }
    } catch (err) {
      console.error('Failed to load STG columns:', err);
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveColumnsToApi = async (cols: STGColumnDef[], msg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: cols }),
      });
      if (res.ok) showToast(`✅ ${msg}`);
      else showToast('❌ Failed to save column configuration');
    } catch (err) {
      console.error('Save columns error:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  const handleOpenAdd = () => {
    setEditingKey(null);
    setFormKey('');
    setFormName('');
    setFormType('number');
    setFormFormula('');
    setFormUnit('');
    setFormDecimals(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (col: STGColumnDef) => {
    setEditingKey(col.key);
    setFormKey(col.key);
    setFormName(col.name);
    setFormType(col.type);
    setFormFormula(col.formula || '');
    setFormUnit(col.unit || '');
    setFormDecimals(col.decimals);
    setIsModalOpen(true);
  };

  const handleDelete = async (key: string, name: string) => {
    const ok = await confirm({
      title: 'Delete Column',
      message: `Delete column "${name}"? All entries using this column field will lose that data.`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    const updated = columns.filter(c => c.key !== key).map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(updated);
    await saveColumnsToApi(updated, `Deleted column "${name}"`);
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const copy = [...columns];
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
    const reindexed = copy.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(reindexed);
    await saveColumnsToApi(reindexed, 'Reordered columns');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { alert('Please enter a Column Name'); return; }
    const keyToUse = editingKey || formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const newCol: STGColumnDef = {
      key: keyToUse,
      name: formName.trim().toUpperCase(),
      type: formType,
      formula: formType === 'calculated' ? formFormula.trim() : undefined,
      unit: formUnit.trim() || undefined,
      decimals: formDecimals,
      sort_order: editingKey ? (columns.find(c => c.key === editingKey)?.sort_order || columns.length + 1) : columns.length + 1,
      is_active: true,
    };

    let updated: STGColumnDef[];
    if (editingKey) {
      updated = columns.map(c => (c.key === editingKey ? newCol : c));
    } else {
      if (columns.some(c => c.key === newCol.key)) {
        alert(`Column key "${newCol.key}" already exists!`);
        return;
      }
      updated = [...columns, newCol];
    }

    setColumns(updated);
    setIsModalOpen(false);
    await saveColumnsToApi(updated, editingKey ? `Updated "${newCol.name}"` : `Created "${newCol.name}"`);
  };

  const getDecimalLabel = (col: STGColumnDef) => {
    if (col.type === 'text') return '—';
    if (col.decimals !== undefined) return `${col.decimals} Decs`;
    const auto: Record<string, number> = { qty_lts: 0, sp_gr: 4, qty_kg: 2, fat_pct: 2, snf_pct: 2, kg_fat: 3, kg_snf: 3 };
    return `Auto (${auto[col.key] ?? 2})`;
  };

  return (
    <>
      <Header
        title="STG Statement Column Configuration"
        subtitle="Manage dynamic column definitions for RECEIPT AND DISPOSAL STATEMENT tables"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/ts/manage-statements/defaults" className="btn btn-secondary btn-sm" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#b45309', fontWeight: 700 }}>
              ⭐ Default Formulation Tables
            </Link>
            <Link href="/dashboard/ts/manage-statements" className="btn btn-secondary btn-sm">
              ← Statement Masters
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in">
        {toastMessage && (
          <div style={{
            padding: '12px 18px', borderRadius: 8, marginBottom: 16,
            background: toastMessage.includes('❌') ? '#fef2f2' : '#f0fdf4',
            border: toastMessage.includes('❌') ? '1px solid #fca5a5' : '1px solid #86efac',
            color: toastMessage.includes('❌') ? '#991b1b' : '#166534',
            fontWeight: 700, fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Info Banner */}
        <div className="card" style={{ marginBottom: 20, padding: 16, borderLeft: '4px solid var(--brand-primary)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-primary)', marginBottom: 4 }}>⚙️ Dynamic STG Column Engine</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Columns defined here appear in all <strong>RECEIPT AND DISPOSAL STATEMENT</strong> tables for every statement master (WM, SSM, CREAM, SMP, etc.).
            Calculated columns like <code>Qty (Kg) = Qty (Lts) × Sp.Gr</code> execute formulas live during entry.
          </div>
        </div>

        {/* Columns Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>📊 Configured STG Columns ({columns.length})</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {saving && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600 }}>💾 Saving...</span>}
              <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>➕ Add New Column</button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><span className="spinner" /> Loading columns...</div>
          ) : columns.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No columns configured. Click "Add New Column" to start.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="inline-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: 60, textAlign: 'center' }}>Order</th>
                    <th>Column Name</th>
                    <th>Field Key</th>
                    <th>Data Type</th>
                    <th>Formula / Rule</th>
                    <th>Unit</th>
                    <th>Decimal Places</th>
                    <th style={{ width: 150, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr key={col.key}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{col.name}</td>
                      <td><code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#0369a1' }}>{col.key}</code></td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                          background: col.type === 'calculated' ? '#e0e7ff' : col.type === 'number' ? '#e0f2fe' : '#f1f5f9',
                          color: col.type === 'calculated' ? '#3730a3' : col.type === 'number' ? '#0369a1' : '#475569',
                        }}>
                          {col.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', fontFamily: col.type === 'calculated' ? 'monospace' : 'inherit', color: col.type === 'calculated' ? '#4338ca' : 'var(--text-muted)' }}>
                        {col.formula || '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{col.unit || '—'}</td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                          {getDecimalLabel(col)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={idx === 0} onClick={() => handleMove(idx, 'up')} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>▲</button>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={idx === columns.length - 1} onClick={() => handleMove(idx, 'down')} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>▼</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(col)} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>✏️ Edit</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(col.key, col.name)} style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Column Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: 520, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{editingKey ? '✏️ Edit STG Column' : '➕ Add STG Column'}</div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSaveModal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Column Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="text" className="form-input" placeholder="e.g. QTY (LTS), SP.GR, FAT (%)" value={formName}
                  onChange={e => { setFormName(e.target.value); if (!editingKey) setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')); }} required />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Field Key</label>
                <input type="text" className="form-input" placeholder="e.g. qty_lts, sp_gr, fat_pct" value={formKey}
                  onChange={e => setFormKey(e.target.value)} disabled={!!editingKey} style={{ background: editingKey ? '#f1f5f9' : '#fff' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unique identifier used in formulas and database storage.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data Type</label>
                  <select className="form-select" value={formType} onChange={e => setFormType(e.target.value as any)}>
                    <option value="number">Number (Input)</option>
                    <option value="text">Text (Label)</option>
                    <option value="calculated">Calculated (Formula)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Decimal Places</label>
                  <select className="form-select" value={formDecimals !== undefined ? String(formDecimals) : ''} onChange={e => setFormDecimals(e.target.value !== '' ? parseInt(e.target.value, 10) : undefined)}>
                    <option value="">Auto / Default</option>
                    <option value="0">0 – Whole Number</option>
                    <option value="1">1 Decimal Place</option>
                    <option value="2">2 Decimal Places</option>
                    <option value="3">3 Decimal Places</option>
                    <option value="4">4 Decimal Places</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Unit (Optional)</label>
                  <input type="text" className="form-input" placeholder="e.g. Lts, Kg, %" value={formUnit} onChange={e => setFormUnit(e.target.value)} />
                </div>
              </div>
              {formType === 'calculated' && (
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Formula Expression</label>
                  <input type="text" className="form-input" placeholder="e.g. qty_lts * sp_gr or qty_kg * fat_pct / 100" value={formFormula}
                    onChange={e => setFormFormula(e.target.value)} style={{ fontFamily: 'monospace' }} />
                  <div style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: 4 }}>
                    Use field keys: <code>qty_lts * sp_gr</code> or <code>qty_kg * fat_pct / 100</code>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingKey ? '💾 Update Column' : '➕ Save Column'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
