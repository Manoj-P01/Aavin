'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import type { ChartColumnDef } from '@/app/api/stock/preparation-charts/route';

export default function ChartColumnsConfigPage() {
  const [columns, setColumns] = useState<ChartColumnDef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal / Form state for new / edit column
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [formKey, setFormKey] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formFormula, setFormFormula] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('');

  const { confirm } = useConfirm();

  // Load Columns Config
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/stock/preparation-charts');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.columns)) {
            setColumns(json.columns);
          }
        }
      } catch (err) {
        console.error('Failed to load chart columns:', err);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingKey(null);
    setFormKey('');
    setFormName('');
    setFormType('number');
    setFormFormula('');
    setFormUnit('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (col: ChartColumnDef) => {
    setEditingKey(col.key);
    setFormKey(col.key);
    setFormName(col.name);
    setFormType(col.type);
    setFormFormula(col.formula || '');
    setFormUnit(col.unit || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (key: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Preparation Column',
      message: `Are you sure you want to delete the column "${name}"? Existing preparation formulas using this key might need updating.`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/stock/preparation-charts?column_key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setColumns(prev => prev.filter(c => c.key !== key));
        showToast(`✅ Deleted column "${name}" from database`);
      } else {
        showToast('❌ Failed to delete column from database');
      }
    } catch (err) {
      console.error('Delete column error:', err);
      showToast('❌ Error connecting to database');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const copy = [...columns];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    // Re-index sort order
    const reindexed = copy.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(reindexed);
    await saveColumnsToApi(reindexed, 'Reordered columns');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('Please enter a Column Name');
      return;
    }

    const keyToUse = editingKey || formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const newCol: ChartColumnDef = {
      key: keyToUse,
      name: formName.trim(),
      type: formType,
      formula: formType === 'calculated' ? formFormula.trim() : undefined,
      unit: formUnit.trim(),
      sort_order: editingKey ? (columns.find(c => c.key === editingKey)?.sort_order || columns.length + 1) : columns.length + 1,
      is_active: true,
    };

    let updated: ChartColumnDef[];
    if (editingKey) {
      updated = columns.map(c => (c.key === editingKey ? newCol : c));
    } else {
      // Check duplicate
      if (columns.some(c => c.key === newCol.key)) {
        alert(`Column key "${newCol.key}" already exists! Please use a unique column name.`);
        return;
      }
      updated = [...columns, newCol];
    }

    setColumns(updated);
    setIsModalOpen(false);
    await saveColumnsToApi(updated, editingKey ? `Updated column "${newCol.name}"` : `Created column "${newCol.name}"`);
  };

  const saveColumnsToApi = async (colsToSave: ChartColumnDef[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: colsToSave }),
      });
      if (res.ok) {
        showToast(`✅ ${successMsg}`);
      } else {
        showToast('❌ Failed to save column updates');
      }
    } catch (err) {
      console.error('Error saving columns:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  return (
    <>
      <Header
        title="Preparation Charts Column Configuration"
        subtitle="Manage, add, edit & delete dynamic column names for Preparation Charts"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/stock/preparation-charts" className="btn btn-secondary btn-sm">
              📋 Preparation Charts Dashboard
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in">
        {toastMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              background: toastMessage.includes('❌') ? '#fef2f2' : '#f0fdf4',
              border: toastMessage.includes('❌') ? '1px solid #fca5a5' : '1px solid #86efac',
              color: toastMessage.includes('❌') ? '#991b1b' : '#166534',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Info Banner */}
        <div className="card" style={{ marginBottom: 20, padding: 16, borderLeft: '4px solid var(--brand-primary)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-primary)', marginBottom: 4 }}>
            ⚙️ Dynamic Chart Columns Engine
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Columns defined here appear dynamically in all <strong>Preparation Charts</strong> (such as DELITE, FCM, STD MILK & SACHET-CURD).
            Calculated fields like <code>Qty (Kg) = Qty (Lit) * Sp.gr</code> automatically execute formulas live during entry.
          </div>
        </div>

        {/* Columns List Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              📊 Configured Preparation Chart Columns ({columns.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {saving && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600 }}>💾 Saving to server...</span>}
              <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                ➕ Add New Column
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner" /> Loading column definitions...
            </div>
          ) : columns.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No chart columns configured yet. Click "Add New Column" above to add one.
            </div>
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
                    <th style={{ width: 140, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr key={col.key}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {col.name}
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#0369a1' }}>
                          {col.key}
                        </code>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: col.type === 'calculated' ? '#e0e7ff' : col.type === 'number' ? '#e0f2fe' : '#f1f5f9',
                            color: col.type === 'calculated' ? '#3730a3' : col.type === 'number' ? '#0369a1' : '#475569',
                          }}
                        >
                          {col.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: col.type === 'calculated' ? '#4338ca' : 'var(--text-muted)', fontFamily: col.type === 'calculated' ? 'monospace' : 'inherit' }}>
                        {col.formula || '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {col.unit || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, 'up')}
                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={idx === columns.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(col)}
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            title="Edit Column"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(col.key, col.name)}
                            style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Delete Column"
                          >
                            ✕
                          </button>
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

      {/* Modal for Creating / Editing Column */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: 520,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {editingKey ? '✏️ Edit Chart Column' : '➕ Add New Chart Column'}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Column Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Qty (Lit), Sp.gr, Fat%, Kg SNF"
                  value={formName}
                  onChange={e => {
                    setFormName(e.target.value);
                    if (!editingKey) {
                      setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Field Key</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. qty_lit, sp_gr, fat_pct"
                  value={formKey}
                  onChange={e => setFormKey(e.target.value)}
                  disabled={!!editingKey}
                  style={{ background: editingKey ? '#f1f5f9' : '#fff' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Unique identifier used in formulas and database storage.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data Type</label>
                  <select
                    className="form-select"
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                  >
                    <option value="number">Number (Input)</option>
                    <option value="text">Text (Variant/Name)</option>
                    <option value="calculated">Calculated (Formula)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Unit (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Liters, Kg, %"
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                  />
                </div>
              </div>

              {formType === 'calculated' && (
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Formula Expression</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. qty_lit * sp_gr or qty_kg * fat_pct / 100"
                    value={formFormula}
                    onChange={e => setFormFormula(e.target.value)}
                    required={formType === 'calculated'}
                    style={{ fontFamily: 'monospace' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: 4 }}>
                    Use field keys in formulas, e.g.: <code>qty_lit * sp_gr</code> or <code>qty_kg * fat_pct / 100</code>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                >
                  {editingKey ? '💾 Update Column' : '➕ Save Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
