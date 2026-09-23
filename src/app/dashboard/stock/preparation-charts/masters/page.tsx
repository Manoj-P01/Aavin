'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import type { ChartMasterDef } from '@/app/api/stock/preparation-charts/route';

export default function ChartMastersConfigPage() {
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal / Form state for new / edit chart
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [formKey, setFormKey] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formProductVariant, setFormProductVariant] = useState<string>('');
  const [formTargetFat, setFormTargetFat] = useState<string>('');
  const [formTargetSnf, setFormTargetSnf] = useState<string>('');
  const [formTargetSpGr, setFormTargetSpGr] = useState<string>('');
  const [formTargetBatchLiters, setFormTargetBatchLiters] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');

  const { confirm } = useConfirm();

  // Load Masters Config
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/stock/preparation-charts');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.masters)) {
            setMasters(json.masters);
          }
        }
      } catch (err) {
        console.error('Failed to load chart masters:', err);
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
    setFormTargetFat('');
    setFormTargetSnf('');
    setFormTargetSpGr('');
    setFormTargetBatchLiters('');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (chart: ChartMasterDef) => {
    setEditingKey(chart.key);
    setFormKey(chart.key);
    setFormName(chart.name);
    setFormProductVariant(chart.product_variant || '');
    setFormTargetFat(chart.target_fat !== undefined ? String(chart.target_fat) : '');
    setFormTargetSnf(chart.target_snf !== undefined ? String(chart.target_snf) : '');
    setFormTargetSpGr(chart.target_sp_gr !== undefined ? String(chart.target_sp_gr) : '');
    setFormTargetBatchLiters(chart.target_batch_liters !== undefined ? String(chart.target_batch_liters) : '');
    setFormDescription(chart.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (key: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Preparation Chart',
      message: `Are you sure you want to delete "${name}"? Users will no longer see this chart on the preparation dashboard.`,
      confirmText: 'Delete Chart',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/stock/preparation-charts?master_key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMasters(prev => prev.filter(m => m.key !== key));
        showToast(`✅ Deleted chart "${name}" from database`);
      } else {
        showToast('❌ Failed to delete chart from database');
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
    await saveMastersToApi(reindexed, 'Reordered preparation charts');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('Please enter a Chart Name');
      return;
    }

    const keyToUse = editingKey || formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const newMaster: ChartMasterDef = {
      key: keyToUse,
      name: formName.trim().toUpperCase(),
      product_variant: formProductVariant.trim().toUpperCase() || formName.trim().split(' ')[0],
      target_fat: formTargetFat ? parseFloat(formTargetFat) : undefined,
      target_snf: formTargetSnf ? parseFloat(formTargetSnf) : undefined,
      target_sp_gr: formTargetSpGr ? parseFloat(formTargetSpGr) : undefined,
      target_batch_liters: formTargetBatchLiters ? parseFloat(formTargetBatchLiters) : undefined,
      description: formDescription.trim(),
      sort_order: editingKey ? (masters.find(m => m.key === editingKey)?.sort_order || masters.length + 1) : masters.length + 1,
      is_active: true,
    };

    let updated: ChartMasterDef[];
    if (editingKey) {
      updated = masters.map(m => (m.key === editingKey ? newMaster : m));
    } else {
      if (masters.some(m => m.key === newMaster.key)) {
        alert(`Chart key "${newMaster.key}" already exists! Please use a unique Chart Name.`);
        return;
      }
      updated = [...masters, newMaster];
    }

    setMasters(updated);
    setIsModalOpen(false);
    await saveMastersToApi(updated, editingKey ? `Updated "${newMaster.name}"` : `Created "${newMaster.name}"`);
  };

  const saveMastersToApi = async (mastersToSave: ChartMasterDef[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: mastersToSave }),
      });
      if (res.ok) {
        showToast(`✅ ${successMsg}`);
      } else {
        showToast('❌ Failed to save chart masters');
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
        title="Preparation Chart Master Names"
        subtitle="Create, edit & delete Preparation Chart names for milk & cream batch formulations"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/stock/preparation-charts/defaults" className="btn btn-secondary btn-sm" style={{ color: '#b45309', borderColor: '#fde68a', background: '#fffbeb', fontWeight: 700 }}>
              ⭐ Master Default Formulations
            </Link>
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

        {/* Info Card */}
        <div className="card" style={{ marginBottom: 20, padding: 16, borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0284c7', marginBottom: 4 }}>
            📋 Preparation Chart Templates
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Each Chart Name created here generates a preparation formulation table on the <strong>Preparation Charts Dashboard</strong> before Stock Statement Entry.
          </div>
        </div>

        {/* Masters Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              📊 Chart Master Names ({masters.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {saving && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600 }}>💾 Saving to server...</span>}
              <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                ➕ Add Chart Name
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner" /> Loading preparation chart masters...
            </div>
          ) : masters.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No chart names defined yet. Click "Add Chart Name" above to create one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="inline-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: 60, textAlign: 'center' }}>Order</th>
                    <th>Chart Name</th>
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
                        📋 {m.name}
                      </td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1' }}>
                          {m.product_variant || 'DEFAULT'}
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
                            title="Edit Chart"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(m.key, m.name)}
                            style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Delete Chart"
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

      {/* Modal for Creating / Editing Chart Master Name */}
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
                {editingKey ? '✏️ Edit Preparation Chart Name' : '➕ Create New Preparation Chart Name'}
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
                <label className="form-label" style={{ fontWeight: 600 }}>Chart Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DELITE PREPARATION CHART, FCM PREPARATION CHART"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Product Variant</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. DELITE, FCM, STD MILK"
                    value={formProductVariant}
                    onChange={e => setFormProductVariant(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Target Batch (Liters)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 21000"
                    value={formTargetBatchLiters}
                    onChange={e => setFormTargetBatchLiters(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Target Fat%</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 3.50"
                    value={formTargetFat}
                    onChange={e => setFormTargetFat(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Target SNF%</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 8.50"
                    value={formTargetSnf}
                    onChange={e => setFormTargetSnf(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Target Sp.gr</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 1.02976"
                    value={formTargetSpGr}
                    onChange={e => setFormTargetSpGr(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Description / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Delite Milk formulation chart calculations"
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
                  {editingKey ? '💾 Update Chart Name' : '➕ Add Chart Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
