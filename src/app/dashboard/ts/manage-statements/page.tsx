'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { cleanStatementLabel } from '@/lib/calculations';

export interface StatementMasterDef {
  key: string;
  label: string;
  name?: string;
  variant?: string;
  product_variant?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  is_split?: boolean;
  receipt_rows?: any[];
  disposal_rows?: any[];
  custom_columns?: any[];
  default_rows?: any[];
  rows?: any[];
}

export default function StatementMastersConfigPage() {
  const [masters, setMasters] = useState<StatementMasterDef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal / Form state for new / edit statement master
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [formKey, setFormKey] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formProductVariant, setFormProductVariant] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');

  const { confirm } = useConfirm();

  // Load Statement Masters Config strictly from DB
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/ts/masters');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.masters)) {
            const normalized = json.masters.map((s: any, idx: number) => {
              const displayLabel = cleanStatementLabel(s.label || s.name || s.key);
              return {
                ...s,
                key: s.key,
                label: displayLabel,
                name: displayLabel,
                variant: s.variant || s.product_variant || displayLabel.split(' ')[0],
                product_variant: s.variant || s.product_variant || displayLabel.split(' ')[0],
                description: s.description || '',
                sort_order: typeof s.sort_order === 'number' ? s.sort_order : idx + 1,
                is_active: s.is_active !== false,
                rows: Array.isArray(s.rows) ? s.rows : [],
              };
            });
            setMasters(normalized);
          }
        }
      } catch (err) {
        console.error('Failed to load statement masters:', err);
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
    setFormProductVariant('');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (statement: StatementMasterDef) => {
    setEditingKey(statement.key);
    setFormKey(statement.key);
    setFormName(statement.label || statement.name || statement.key);
    setFormProductVariant(statement.variant || statement.product_variant || '');
    setFormDescription(statement.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (key: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Statement Master',
      message: `Are you sure you want to delete "${name}"? Users will no longer see this statement master on the daily TS dashboard.`,
      confirmText: 'Delete Statement Master',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/ts/masters?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMasters(prev => prev.filter(m => m.key !== key));
        showToast(`✅ Deleted statement master "${name}" from database`);
      } else {
        showToast('❌ Failed to delete statement master from database');
      }
    } catch (err) {
      console.error('Delete master error:', err);
      showToast('❌ Error connecting to database');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= masters.length) return;

    const copy = [...masters];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reindexed = copy.map((m, i) => ({ ...m, sort_order: i + 1 }));
    setMasters(reindexed);
    await saveMastersToApi(reindexed, 'Reordered statement master names');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('Please enter a Statement Master Name');
      return;
    }

    const cleanLabel = cleanStatementLabel(formName.trim());
    const keyToUse = editingKey || formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const existing = masters.find(m => m.key === (editingKey || keyToUse));

    const newMaster: StatementMasterDef = {
      ...existing,
      key: keyToUse,
      label: cleanLabel,
      name: cleanLabel,
      variant: formProductVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
      product_variant: formProductVariant.trim().toUpperCase() || cleanLabel.split(' ')[0],
      description: formDescription.trim(),
      sort_order: editingKey ? (existing?.sort_order || masters.length + 1) : masters.length + 1,
      is_active: true,
      rows: existing?.rows || [],
    };

    let updated: StatementMasterDef[];
    if (editingKey) {
      updated = masters.map(m => (m.key === editingKey ? newMaster : m));
    } else {
      if (masters.some(m => m.key === newMaster.key)) {
        alert(`Statement key "${newMaster.key}" already exists! Please use a unique Statement Master Name.`);
        return;
      }
      updated = [...masters, newMaster];
    }

    setMasters(updated);
    setIsModalOpen(false);
    await saveMastersToApi(updated, editingKey ? `Updated "${newMaster.label}"` : `Created "${newMaster.label}"`);
  };

  const saveMastersToApi = async (mastersToSave: StatementMasterDef[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: mastersToSave }),
      });
      if (res.ok) {
        showToast(`✅ ${successMsg}`);
      } else {
        showToast('❌ Failed to save statement masters');
      }
    } catch (err) {
      console.error('Error saving masters:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  return (
    <>
      <Header
        title="Statement Master Names & Particulars"
        subtitle="Create, edit & delete Statement Master Names & Particulars for RECEIPT AND DISPOSAL STATEMENT"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/ts/manage-statements/defaults" className="btn btn-secondary btn-sm" style={{ color: '#b45309', borderColor: '#fde68a', background: '#fffbeb', fontWeight: 700 }}>
              ⭐ Master Default Formulation Tables
            </Link>
            <Link href="/dashboard/ts/manage-statements/columns" className="btn btn-secondary btn-sm" style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }}>
              ⚙️ Column Configuration
            </Link>
            <Link href="/dashboard/ts/new-stg" className="btn btn-secondary btn-sm">
              🧪 STG Entry
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

        {/* Info Card */}
        <div className="card" style={{ marginBottom: 20, padding: 16, borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0284c7', marginBottom: 4 }}>
            📋 Statement Master Templates
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Each Statement Master Name created here generates a receipt & disposal formulation table on the <strong>Master Default Formulation Tables</strong> page and daily <strong>STG Entry</strong> reports.
          </div>
        </div>

        {/* Masters Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              📊 Statement Master Names ({masters.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {saving && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600 }}>💾 Saving to server...</span>}
              <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                ➕ Add Statement Master Name
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner" /> Loading statement master names...
            </div>
          ) : masters.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No statement master names defined yet. Click "Add Statement Master Name" above to create one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="inline-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: 60, textAlign: 'center' }}>Order</th>
                    <th>Statement Master Name</th>
                    <th>Product Variant</th>
                    <th>Description</th>
                    <th style={{ width: 140, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m, idx) => (
                    <tr key={m.key}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--brand-primary)' }}>
                        📊 {m.label || m.name}
                      </td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1' }}>
                          {m.variant || m.product_variant || 'DEFAULT'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.description || '—'}
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
                            disabled={idx === masters.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(m)}
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            title="Edit Statement Master"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(m.key, m.label || m.name || m.key)}
                            style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Delete Statement Master"
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

      {/* Modal for Creating / Editing Statement Master Name */}
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
            maxWidth: 540,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {editingKey ? '✏️ Edit Statement Master Name' : '➕ Create New Statement Master Name'}
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
                <label className="form-label" style={{ fontWeight: 600 }}>Statement Master Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CREAM RECEIPT AND DISPOSAL STATEMENT"
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
                <label className="form-label" style={{ fontWeight: 600 }}>Product Variant</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CREAM"
                  value={formProductVariant}
                  onChange={e => setFormProductVariant(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Description / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Daily cream receipt and disposal formulation statement"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

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
                  {editingKey ? '💾 Update Statement Master Name' : '➕ Add Statement Master Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
