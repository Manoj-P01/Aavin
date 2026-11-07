'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

export interface TSColumnDef {
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
  sort_order?: number;
  is_active?: boolean;
}

export default function TSColumnsConfigPage() {
  const [columns, setColumns] = useState<TSColumnDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

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
      const res = await fetch('/api/ts/statement-columns');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.columns)) setColumns(json.columns);
      }
    } catch (err) {
      console.error('Failed to load TS columns:', err);
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveColumnsToApi = async (cols: TSColumnDef[], msg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/statement-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: cols }),
      });
      if (res.ok) {
        showToast(`✅ ${msg}`);
        setHasUnsavedChanges(false);
      } else {
        showToast('❌ Failed to save column configuration');
      }
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

  const handleOpenEdit = (col: TSColumnDef) => {
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
      message: `Delete column "${name}"? Click "Save Columns Configuration" to persist changes to the database.`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    const updated = columns.filter(c => c.key !== key).map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(updated);
    setHasUnsavedChanges(true);
    showToast(`🗑️ Removed column "${name}" (click "Save" to commit)`);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const copy = [...columns];
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
    const reindexed = copy.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setColumns(reindexed);
    setHasUnsavedChanges(true);
  };

  const handleToggleActive = (key: string) => {
    const updated = columns.map(c => (c.key === key ? { ...c, is_active: !c.is_active } : c));
    setColumns(updated);
    setHasUnsavedChanges(true);
  };

  const handleModalSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || !formName.trim()) {
      showToast('❌ Key and Name are required');
      return;
    }

    const cleanKey = formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!editingKey && columns.some(c => c.key === cleanKey)) {
      showToast('❌ A column with this key already exists');
      return;
    }

    const newCol: TSColumnDef = {
      key: cleanKey,
      name: formName.trim(),
      type: formType,
      formula: formType === 'calculated' && formFormula.trim() ? formFormula.trim() : undefined,
      unit: formUnit.trim() || undefined,
      decimals: formDecimals !== undefined ? Number(formDecimals) : undefined,
      sort_order: editingKey
        ? columns.find(c => c.key === editingKey)?.sort_order || columns.length + 1
        : columns.length + 1,
      is_active: editingKey ? columns.find(c => c.key === editingKey)?.is_active ?? true : true,
    };

    let updated: TSColumnDef[];
    if (editingKey) {
      updated = columns.map(c => (c.key === editingKey ? newCol : c));
    } else {
      updated = [...columns, newCol];
    }

    setColumns(updated);
    setHasUnsavedChanges(true);
    setIsModalOpen(false);
    showToast(editingKey ? `✏️ Updated column "${newCol.name}"` : `➕ Added column "${newCol.name}"`);
  };

  return (
    <>
      <Header
        title="Total Solids (TS) Statement Columns Config"
        subtitle="Manage and configure columns, data types, and live Excel calculation formulas for Total Solids Statement"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/ts/defaults" className="btn btn-secondary btn-sm">
              ⭐ Master Default Statement
            </Link>
            <Link href="/dashboard/ts/ts-mappings" className="btn btn-secondary btn-sm">
              🔗 STG ➔ TS Mappings
            </Link>
            <button
              onClick={() => saveColumnsToApi(columns, 'TS column configuration saved successfully!')}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600 }}
            >
              {saving ? 'Saving...' : '💾 Save Columns Configuration'}
            </button>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ padding: 20 }}>
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 9999,
              background: '#0f172a',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {toastMessage}
          </div>
        )}

        {hasUnsavedChanges && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#92400e',
              padding: '12px 18px',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <span style={{ fontWeight: 600 }}>You have unsaved column changes.</span>
              <span style={{ fontSize: '0.875rem' }}>Remember to click &quot;Save Columns Configuration&quot; to apply to TS Entry and Register.</span>
            </div>
            <button
              onClick={() => saveColumnsToApi(columns, 'TS column configuration saved successfully!')}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 14px' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Configured Columns ({columns.length})
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Columns and calculation formulas applied across Arrival, Disposal, and Closing Balance tables.
              </p>
            </div>
            <button onClick={handleOpenAdd} className="btn btn-primary btn-sm">
              ➕ Add TS Column
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="spinner" /> Loading columns...
            </div>
          ) : columns.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚙️</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>No columns configured</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Click &quot;Add TS Column&quot; to configure your first column.
              </p>
              <button onClick={handleOpenAdd} className="btn btn-primary btn-sm">
                ➕ Add First Column
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: 60, textAlign: 'center' }}>#</th>
                    <th>Column Name</th>
                    <th>Field Key</th>
                    <th>Data Type</th>
                    <th>Formula / Rule</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'center' }}>Decimals</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ width: 130, textAlign: 'center' }}>Order</th>
                    <th style={{ width: 140, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr key={col.key} style={{ opacity: col.is_active === false ? 0.6 : 1 }}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {col.name}
                      </td>
                      <td>
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: '0.8rem',
                            color: '#0f172a',
                          }}
                        >
                          {col.key}
                        </code>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            col.type === 'calculated'
                              ? 'badge-purple'
                              : col.type === 'number'
                              ? 'badge-blue'
                              : 'badge-gray'
                          }`}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background:
                              col.type === 'calculated' ? '#ede9fe' : col.type === 'number' ? '#e0f2fe' : '#f1f5f9',
                            color:
                              col.type === 'calculated' ? '#6b21a8' : col.type === 'number' ? '#0369a1' : '#475569',
                          }}
                        >
                          {col.type}
                        </span>
                      </td>
                      <td>
                        {col.type === 'calculated' ? (
                          <code
                            style={{
                              background: '#fef3c7',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: '0.8rem',
                              color: '#92400e',
                              fontWeight: 600,
                            }}
                          >
                            = {col.formula || 'qty_lts * sp_gr'}
                          </code>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct Entry</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {col.unit || '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {col.decimals !== undefined ? col.decimals : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(col.key)}
                          style={{
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.1rem',
                          }}
                          title={col.is_active !== false ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
                        >
                          {col.is_active !== false ? '✅' : '⚪'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', opacity: idx === 0 ? 0.3 : 1 }}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === columns.length - 1}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', opacity: idx === columns.length - 1 ? 0.3 : 1 }}
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(col)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(col.key, col.name)}
                            className="btn btn-outline btn-sm"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.8rem',
                              color: 'var(--brand-danger)',
                              borderColor: 'var(--brand-danger)',
                            }}
                          >
                            🗑️
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

      {/* Add / Edit Column Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 540,
              width: '100%',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {editingKey ? '✏️ Edit TS Column' : '➕ Add TS Column'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Column Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Milk (Lit)"
                    value={formName}
                    onChange={e => {
                      setFormName(e.target.value);
                      if (!editingKey && !formKey) {
                        setFormKey(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '_')
                            .replace(/_+/g, '_')
                            .slice(0, 30)
                        );
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Field Key <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingKey}
                    className="form-input"
                    placeholder="e.g. qty_lts"
                    value={formKey}
                    onChange={e => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    style={{ background: editingKey ? '#f1f5f9' : undefined }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Data Type
                  </label>
                  <select
                    className="form-input"
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                  >
                    <option value="number">Numeric (Direct Input)</option>
                    <option value="calculated">Calculated (Excel Formula)</option>
                    <option value="text">Text / Label</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Unit of Measurement
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Lts, Kg, %"
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                  />
                </div>
              </div>

              {formType === 'calculated' && (
                <div style={{ marginBottom: 14, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                    Excel Formula <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. qty_lts * sp_gr"
                    value={formFormula}
                    onChange={e => setFormFormula(e.target.value)}
                    style={{ fontFamily: 'monospace', fontWeight: 600 }}
                  />
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Standard formulas:
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => setFormFormula('qty_lts * sp_gr')}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                      >
                        qty_lts * sp_gr
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormFormula('1 + (snf_pct - (0.2 * fat_pct) - 0.36) / 250')}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                      >
                        Sp.Gr standard
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormFormula('qty_kg * fat_pct / 100')}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                      >
                        qty_kg * fat_pct / 100
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormFormula('qty_kg * snf_pct / 100')}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                      >
                        qty_kg * snf_pct / 100
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Decimal Precision
                </label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  className="form-input"
                  placeholder="e.g. 2 (or 4 for Sp. Gr)"
                  value={formDecimals !== undefined ? formDecimals : ''}
                  onChange={e => setFormDecimals(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingKey ? 'Update Column' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

