'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { DEFAULT_TS_MASTER } from '@/app/api/ts/statement-masters/route';

export interface TSRowDef {
  variant: string;
  fat_pct?: number;
  snf_pct?: number;
  sp_gr?: number;
  remarks?: string;
}

export type TSSectionKey =
  | 'ob_rows'
  | 'receipt_rows'
  | 'despatch_rows'
  | 'local_sale_rows'
  | 'other_disposal_rows'
  | 'cb_rows';

const SECTION_CONFIGS: Array<{
  key: TSSectionKey;
  label: string;
  badgeColor: string;
  description: string;
  icon: string;
}> = [
  {
    key: 'ob_rows',
    label: 'Opening Balance (O/B)',
    badgeColor: '#0284c7',
    description: 'Arrival Opening Stock products and initial balances.',
    icon: '📦',
  },
  {
    key: 'receipt_rows',
    label: 'Receipts',
    badgeColor: '#16a34a',
    description: 'Milk received from CCs, BMCs, returns, and plant transfers.',
    icon: '📥',
  },
  {
    key: 'despatch_rows',
    label: 'Disposal – Despatch / Sale',
    badgeColor: '#ea580c',
    description: 'Bulk milk despatches (Ambattur, SNR, DCPP, Erode, CBE).',
    icon: '🚚',
  },
  {
    key: 'local_sale_rows',
    label: 'Disposal – Local Sales',
    badgeColor: '#8b5cf6',
    description: 'Local sachet sales (DLT, FCM, STD, Others).',
    icon: '🏪',
  },
  {
    key: 'other_disposal_rows',
    label: 'Disposal – Other Disposal',
    badgeColor: '#d97706',
    description: 'Plant usages, curd/butter milk, khoa, lab sample, cream conversion.',
    icon: '🔄',
  },
  {
    key: 'cb_rows',
    label: 'Disposal – Closing Balance (C/B)',
    badgeColor: '#0d9488',
    description: 'Plant closing inventory balances carried over to the next day.',
    icon: '🔒',
  },
];

export default function TSDefaultsPage() {
  const { confirm } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [activeTab, setActiveTab] = useState<TSSectionKey>('ob_rows');
  const [sections, setSections] = useState<Record<TSSectionKey, TSRowDef[]>>({
    ob_rows: DEFAULT_TS_MASTER.ob_rows,
    receipt_rows: DEFAULT_TS_MASTER.receipt_rows,
    despatch_rows: DEFAULT_TS_MASTER.despatch_rows,
    local_sale_rows: DEFAULT_TS_MASTER.local_sale_rows,
    other_disposal_rows: DEFAULT_TS_MASTER.other_disposal_rows,
    cb_rows: DEFAULT_TS_MASTER.cb_rows,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTargetSection, setModalTargetSection] = useState<TSSectionKey>('ob_rows');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formVariant, setFormVariant] = useState('');
  const [formFat, setFormFat] = useState('');
  const [formSnf, setFormSnf] = useState('');
  const [formSpGr, setFormSpGr] = useState('');

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ts/statement-masters');
      if (res.ok) {
        const json = await res.json();
        if (json.master) {
          setSections({
            ob_rows: Array.isArray(json.master.ob_rows) ? json.master.ob_rows : DEFAULT_TS_MASTER.ob_rows,
            receipt_rows: Array.isArray(json.master.receipt_rows) ? json.master.receipt_rows : DEFAULT_TS_MASTER.receipt_rows,
            despatch_rows: Array.isArray(json.master.despatch_rows) ? json.master.despatch_rows : DEFAULT_TS_MASTER.despatch_rows,
            local_sale_rows: Array.isArray(json.master.local_sale_rows) ? json.master.local_sale_rows : DEFAULT_TS_MASTER.local_sale_rows,
            other_disposal_rows: Array.isArray(json.master.other_disposal_rows) ? json.master.other_disposal_rows : DEFAULT_TS_MASTER.other_disposal_rows,
            cb_rows: Array.isArray(json.master.cb_rows) ? json.master.cb_rows : DEFAULT_TS_MASTER.cb_rows,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load TS master data:', err);
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveToApi = async (dataToSave: Record<TSSectionKey, TSRowDef[]>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/statement-masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dataToSave,
        }),
      });

      if (res.ok) {
        showToast('✅ TS Master Default Statement saved successfully!');
        setHasUnsavedChanges(false);
      } else {
        showToast('❌ Failed to save TS Statement Master');
      }
    } catch (err) {
      console.error('Failed saving master:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  const handleResetToDefaults = async () => {
    const ok = await confirm({
      title: 'Reset to Excel Default Formulations',
      message: 'This will reset all rows across O/B, Receipts, Despatches, Local Sales, and Closing Balances to the standard Excel 01-05-2026-TS.xlsx template. Continue?',
      confirmText: 'Reset to Defaults',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!ok) return;

    const resetData: Record<TSSectionKey, TSRowDef[]> = {
      ob_rows: DEFAULT_TS_MASTER.ob_rows,
      receipt_rows: DEFAULT_TS_MASTER.receipt_rows,
      despatch_rows: DEFAULT_TS_MASTER.despatch_rows,
      local_sale_rows: DEFAULT_TS_MASTER.local_sale_rows,
      other_disposal_rows: DEFAULT_TS_MASTER.other_disposal_rows,
      cb_rows: DEFAULT_TS_MASTER.cb_rows,
    };
    setSections(resetData);
    setHasUnsavedChanges(true);
    showToast('🔄 Restored standard Excel formulation defaults (click "Save" to commit)');
  };

  const handleOpenAdd = (sec: TSSectionKey) => {
    setModalTargetSection(sec);
    setEditingIndex(null);
    setFormVariant('');
    setFormFat('');
    setFormSnf('');
    setFormSpGr('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sec: TSSectionKey, idx: number, row: TSRowDef) => {
    setModalTargetSection(sec);
    setEditingIndex(idx);
    setFormVariant(row.variant || '');
    setFormFat(row.fat_pct !== undefined ? String(row.fat_pct) : '');
    setFormSnf(row.snf_pct !== undefined ? String(row.snf_pct) : '');
    setFormSpGr(row.sp_gr !== undefined ? String(row.sp_gr) : '');
    setIsModalOpen(true);
  };

  const handleDeleteRow = async (sec: TSSectionKey, idx: number, rowName: string) => {
    const ok = await confirm({
      title: 'Delete Row',
      message: `Remove "${rowName}" from this section? Click "Save Master Default Statement" to commit.`,
      confirmText: 'Remove Row',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    setSections(prev => {
      const copy = { ...prev };
      const currentList = [...copy[sec]];
      currentList.splice(idx, 1);
      copy[sec] = currentList;
      return copy;
    });
    setHasUnsavedChanges(true);
    showToast(`🗑️ Removed row "${rowName}"`);
  };

  const handleMove = (sec: TSSectionKey, idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const list = sections[sec];
    if (targetIdx < 0 || targetIdx >= list.length) return;

    setSections(prev => {
      const copy = { ...prev };
      const currentList = [...copy[sec]];
      [currentList[idx], currentList[targetIdx]] = [currentList[targetIdx], currentList[idx]];
      copy[sec] = currentList;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const handleModalSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVariant.trim()) {
      showToast('❌ Particular / Variant Name is required');
      return;
    }

    const newRow: TSRowDef = {
      variant: formVariant.trim(),
      fat_pct: formFat !== '' ? Number(formFat) : undefined,
      snf_pct: formSnf !== '' ? Number(formSnf) : undefined,
      sp_gr: formSpGr !== '' ? Number(formSpGr) : undefined,
    };

    setSections(prev => {
      const copy = { ...prev };
      const currentList = [...copy[modalTargetSection]];
      if (editingIndex !== null) {
        currentList[editingIndex] = newRow;
      } else {
        currentList.push(newRow);
      }
      copy[modalTargetSection] = currentList;
      return copy;
    });

    setHasUnsavedChanges(true);
    setIsModalOpen(false);
    showToast(editingIndex !== null ? `✏️ Updated "${newRow.variant}"` : `➕ Added "${newRow.variant}"`);
  };

  const currentSection = SECTION_CONFIGS.find(s => s.key === activeTab) || SECTION_CONFIGS[0];
  const activeRows = sections[activeTab] || [];

  return (
    <>
      <Header
        title="Master Default Total Solids (TS) Statement"
        subtitle="Manage default statement formulation tables, row particulars, and standard composition values matching Excel TS sheet"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleResetToDefaults}
              className="btn btn-outline btn-sm"
              style={{ fontWeight: 600 }}
              title="Reset all sections to Excel template default formulations"
            >
              🔄 Reset to Defaults
            </button>
            <Link href="/dashboard/ts/columns" className="btn btn-secondary btn-sm">
              ⚙️ TS Columns Config
            </Link>
            <Link href="/dashboard/ts/ts-mappings" className="btn btn-secondary btn-sm">
              🔗 STG ➔ TS Mappings
            </Link>
            <button
              onClick={() => saveToApi(sections)}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600 }}
            >
              {saving ? 'Saving...' : '💾 Save Master Default Statement'}
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
              <span style={{ fontWeight: 600 }}>You have unsaved changes in TS Master Formulations.</span>
              <span style={{ fontSize: '0.875rem' }}>Click &quot;Save Master Default Statement&quot; to update TS Entry templates.</span>
            </div>
            <button
              onClick={() => saveToApi(sections)}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 14px' }}
            >
              {saving ? 'Saving...' : 'Save Statement'}
            </button>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
          }}
        >
          {SECTION_CONFIGS.map(sec => {
            const isActive = activeTab === sec.key;
            const count = (sections[sec.key] || []).length;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveTab(sec.key)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: 6,
                }}
              >
                <span>{sec.icon}</span>
                <span>{sec.label}</span>
                <span
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-muted, #e2e8f0)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    padding: '1px 6px',
                    borderRadius: 10,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Section Table Card */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{currentSection.icon}</span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {currentSection.label} ({activeRows.length} Rows)
                </h2>
              </div>
              <p style={{ margin: '4px 0 0 38px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {currentSection.description}
              </p>
            </div>
            <button
              onClick={() => handleOpenAdd(activeTab)}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600 }}
            >
              ➕ Add Row to {currentSection.label.split('(')[0].trim()}
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="spinner" /> Loading formulation rows...
            </div>
          ) : activeRows.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>No rows configured in this section</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Add row particulars or restore default formulations from Excel.
              </p>
              <button onClick={() => handleOpenAdd(activeTab)} className="btn btn-primary btn-sm">
                ➕ Add First Row
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: 60, textAlign: 'center' }}>S.no</th>
                    <th>Particular / Variant Name</th>
                    <th style={{ textAlign: 'right' }}>Default Fat %</th>
                    <th style={{ textAlign: 'right' }}>Default SNF %</th>
                    <th style={{ textAlign: 'right' }}>Default Sp. Gr</th>
                    <th style={{ width: 130, textAlign: 'center' }}>Order</th>
                    <th style={{ width: 140, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row, idx) => (
                    <tr key={`${row.variant}-${idx}`}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {row.variant}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.fat_pct !== undefined ? row.fat_pct.toFixed(2) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.snf_pct !== undefined ? row.snf_pct.toFixed(2) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.sp_gr !== undefined ? row.sp_gr.toFixed(4) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleMove(activeTab, idx, 'up')}
                            disabled={idx === 0}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', opacity: idx === 0 ? 0.3 : 1 }}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(activeTab, idx, 'down')}
                            disabled={idx === activeRows.length - 1}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', opacity: idx === activeRows.length - 1 ? 0.3 : 1 }}
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
                            onClick={() => handleOpenEdit(activeTab, idx, row)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(activeTab, idx, row.variant)}
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

      {/* Add / Edit Row Modal */}
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
              maxWidth: 500,
              width: '100%',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {editingIndex !== null ? '✏️ Edit Row Particular' : `➕ Add Row to ${modalTargetSection}`}
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
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Particular / Variant Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. WM, P.VELUR CC, AMBATTUR-SSM"
                  value={formVariant}
                  onChange={e => setFormVariant(e.target.value.toUpperCase())}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Default Fat %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="e.g. 3.93"
                    value={formFat}
                    onChange={e => setFormFat(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Default SNF %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="e.g. 7.95"
                    value={formSnf}
                    onChange={e => setFormSnf(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Default Sp. Gr
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    placeholder="e.g. 1.0272"
                    value={formSpGr}
                    onChange={e => setFormSpGr(e.target.value)}
                  />
                </div>
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
                  {editingIndex !== null ? 'Update Row' : 'Add Row'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

