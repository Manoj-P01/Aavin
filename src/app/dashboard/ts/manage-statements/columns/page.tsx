'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import KeyField, { executeKeyRename } from '@/components/ui/KeyField';

export interface STGColumnDef {
  key: string;
  name: string;
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
  sort_order?: number;
  is_active?: boolean;
}

export type STGSectionKey = 'ob' | 'receipt' | 'disposal' | 'cb' | 'recon';

export interface SectionMeta {
  key: STGSectionKey;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const SECTIONS: SectionMeta[] = [
  {
    key: 'ob',
    label: 'Opening Balance (OB)',
    shortLabel: 'OB',
    icon: '📦',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#7dd3fc',
    description: 'Columns for Opening Balance section in STG statement masters.',
  },
  {
    key: 'receipt',
    label: 'Receipts',
    shortLabel: 'Receipt',
    icon: '📥',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    description: 'Columns for Receipts section in STG statement masters.',
  },
  {
    key: 'disposal',
    label: 'Disposals',
    shortLabel: 'Disposal',
    icon: '📤',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    description: 'Columns for Disposals section in STG statement masters.',
  },
  {
    key: 'cb',
    label: 'Closing Balance (CB)',
    shortLabel: 'CB',
    icon: '📊',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
    description: 'Columns for Closing Balance (CB) section in STG statement masters.',
  },
  {
    key: 'recon',
    label: 'Reconciliation Summary',
    shortLabel: 'Recon',
    icon: '⚖️',
    color: '#0f766e',
    bgColor: '#f0fdfa',
    borderColor: '#5eead4',
    description: 'Columns for Reconciliation summary in STG statement masters.',
  },
];

export default function STGColumnsPage() {
  const [activeSection, setActiveSection] = useState<STGSectionKey>('ob');
  const [sectionColumns, setSectionColumns] = useState<Record<STGSectionKey, STGColumnDef[]>>({
    ob: [],
    receipt: [],
    disposal: [],
    cb: [],
    recon: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Modal / Form state for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'number' | 'text' | 'calculated'>('number');
  const [formFormula, setFormFormula] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formDecimals, setFormDecimals] = useState<number | undefined>(undefined);

  const { confirm, showError } = useConfirm();

  const activeMeta = SECTIONS.find(s => s.key === activeSection) || SECTIONS[0];
  const activeColumns = sectionColumns[activeSection] || [];

  useEffect(() => {
    loadColumns();
  }, []);

  const loadColumns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ts/columns');
      if (res.ok) {
        const json = await res.json();
        if (json.sections && typeof json.sections === 'object') {
          setSectionColumns({
            ob: Array.isArray(json.sections.ob) ? json.sections.ob : [],
            receipt: Array.isArray(json.sections.receipt) ? json.sections.receipt : [],
            disposal: Array.isArray(json.sections.disposal) ? json.sections.disposal : [],
            cb: Array.isArray(json.sections.cb) ? json.sections.cb : [],
            recon: Array.isArray(json.sections.recon) ? json.sections.recon : [],
          });
        }
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

  const saveSectionsToApi = async (updatedSections: Record<STGSectionKey, STGColumnDef[]>, msg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: updatedSections }),
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
      title: `Delete Column from ${activeMeta.shortLabel}`,
      message: `Delete column "${name}" from ${activeMeta.label}? Changes will be immediately saved to the database.`,
      confirmText: 'Delete Column',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    const updated = activeColumns.filter(c => c.key !== key).map((c, i) => ({ ...c, sort_order: i + 1 }));
    const newSections = {
      ...sectionColumns,
      [activeSection]: updated,
    };
    setSectionColumns(newSections);
    await saveSectionsToApi(newSections, `Removed column "${name}" from ${activeMeta.shortLabel} and saved to database!`);
  };

  const handleClearAll = async () => {
    if (activeColumns.length === 0) return;
    const ok = await confirm({
      title: `Clear All ${activeMeta.shortLabel} Columns`,
      message: `Are you sure you want to remove all configured columns from "${activeMeta.label}"? Changes will be immediately saved to the database.`,
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    const newSections = {
      ...sectionColumns,
      [activeSection]: [],
    };
    setSectionColumns(newSections);
    await saveSectionsToApi(newSections, `Cleared all columns in ${activeMeta.shortLabel} and saved to database!`);
  };

  const handleCopyFromSection = async (sourceKey: STGSectionKey) => {
    if (sourceKey === activeSection) return;
    const sourceCols = sectionColumns[sourceKey] || [];
    const sourceMeta = SECTIONS.find(s => s.key === sourceKey)!;

    if (sourceCols.length === 0) {
      alert(`The section "${sourceMeta.label}" has no configured columns to copy!`);
      return;
    }

    const currentCols = sectionColumns[activeSection] || [];
    if (currentCols.length > 0) {
      const ok = await confirm({
        title: `Copy Columns to ${activeMeta.shortLabel}`,
        message: `Copy all ${sourceCols.length} columns from "${sourceMeta.label}" into "${activeMeta.label}"? This will replace the ${currentCols.length} existing column(s) in ${activeMeta.shortLabel} and save to the database.`,
        confirmText: 'Replace & Copy',
        cancelText: 'Cancel',
        type: 'warning',
      });
      if (!ok) return;
    }

    const cloned: STGColumnDef[] = sourceCols.map((col, idx) => ({
      ...col,
      sort_order: idx + 1,
    }));

    const newSections = {
      ...sectionColumns,
      [activeSection]: cloned,
    };
    setSectionColumns(newSections);
    await saveSectionsToApi(newSections, `Copied ${cloned.length} columns from ${sourceMeta.shortLabel} to ${activeMeta.shortLabel} and saved to database!`);
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeColumns.length) return;
    const copy = [...activeColumns];
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
    const reindexed = copy.map((c, i) => ({ ...c, sort_order: i + 1 }));
    const newSections = {
      ...sectionColumns,
      [activeSection]: reindexed,
    };
    setSectionColumns(newSections);
    await saveSectionsToApi(newSections, `Reordered columns in ${activeMeta.shortLabel} and saved to database!`);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { alert('Please enter a Column Name'); return; }
    const keyToUse = formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (editingKey && keyToUse !== editingKey) {
      const res = await executeKeyRename({
        scope: 'stg_column',
        oldKey: editingKey,
        newKey: keyToUse,
        confirm,
        showError,
      });
      if (!res.success) return;
    }

    const newCol: STGColumnDef = {
      key: keyToUse,
      name: formName.trim(),
      type: formType,
      formula: undefined,
      unit: formUnit.trim() || undefined,
      decimals: formDecimals,
      sort_order: editingKey ? (activeColumns.find(c => c.key === editingKey)?.sort_order || activeColumns.length + 1) : activeColumns.length + 1,
      is_active: true,
    };

    let updated: STGColumnDef[];
    if (editingKey) {
      updated = activeColumns.map(c => (c.key === editingKey ? newCol : c));
    } else {
      if (activeColumns.some(c => c.key === newCol.key)) {
        alert(`Column key "${newCol.key}" already exists in ${activeMeta.shortLabel}!`);
        return;
      }
      updated = [...activeColumns, newCol];
    }

    const newSections = {
      ...sectionColumns,
      [activeSection]: updated,
    };
    setSectionColumns(newSections);
    setIsModalOpen(false);
    await saveSectionsToApi(newSections, `Saved column "${newCol.name}" in ${activeMeta.shortLabel} to database!`);
  };

  const handleSaveAllToDb = async () => {
    await saveSectionsToApi(sectionColumns, 'Saved all individual section columns to database!');
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
        subtitle="Manage dynamic column definitions individually for OB, Receipts, Disposals, CB, and Reconciliation"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSaveAllToDb}
              disabled={saving}
              className="btn btn-sm"
              style={{
                background: hasUnsavedChanges ? '#16a34a' : 'var(--primary)',
                borderColor: hasUnsavedChanges ? '#15803d' : 'var(--primary)',
                color: '#ffffff',
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: hasUnsavedChanges ? '0 0 10px rgba(22, 163, 74, 0.4)' : 'none',
              }}
              title="Click to save and sync column configuration across all STG statement masters"
            >
              {saving ? '⏳ Saving & Syncing...' : hasUnsavedChanges ? '💾 Save Column Configuration *' : '💾 Save & Sync Columns'}
            </button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-primary)', marginBottom: 4 }}>
                ⚙️ Dynamic STG Individual Section Column Configuration
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Configure individual columns for <strong>Opening Balance (OB)</strong>, <strong>Receipts</strong>, <strong>Disposals</strong>, <strong>Closing Balance (CB)</strong>, and <strong>Reconciliation</strong>.
                Use <strong>&quot;Copy Configured Columns From&quot;</strong> to copy columns across sections in one click.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SECTIONS.map(s => (
                <span
                  key={`badge_${s.key}`}
                  style={{
                    background: s.bgColor,
                    border: `1px solid ${s.borderColor}`,
                    color: s.color,
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {s.shortLabel}: {sectionColumns[s.key]?.length || 0}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Section Tabs & Columns Table Card */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Section Tabs Header */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', padding: '6px 12px 0', gap: 6, overflowX: 'auto' }}>
            {SECTIONS.map(sec => {
              const isActive = activeSection === sec.key;
              const count = sectionColumns[sec.key]?.length || 0;
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => setActiveSection(sec.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    border: isActive ? `1.5px solid ${sec.borderColor}` : '1.5px solid transparent',
                    borderBottom: isActive ? '2px solid #ffffff' : 'none',
                    marginBottom: isActive ? -2 : 0,
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? sec.color : '#64748b',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 -2px 4px rgba(0,0,0,0.03)' : 'none',
                  }}
                >
                  <span>{sec.icon}</span>
                  <span>{sec.label}</span>
                  <span
                    style={{
                      background: isActive ? sec.bgColor : '#e2e8f0',
                      color: isActive ? sec.color : '#475569',
                      border: `1px solid ${isActive ? sec.borderColor : '#cbd5e1'}`,
                      borderRadius: 10,
                      padding: '1px 7px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Section Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#ffffff', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>{activeMeta.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: activeMeta.color }}>
                  {activeMeta.label} Columns ({activeColumns.length})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {activeMeta.description}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {saving && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600 }}>💾 Saving...</span>}

              {/* Copy Configured Columns From Selector */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  📋 Copy From:
                </span>
                <select
                  className="form-select"
                  value=""
                  onChange={e => {
                    const src = e.target.value as STGSectionKey;
                    if (src) {
                      handleCopyFromSection(src);
                    }
                  }}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '3px 8px',
                    height: 28,
                    minWidth: 150,
                    cursor: 'pointer',
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                  title={`Copy configured columns from another section into ${activeMeta.shortLabel}`}
                >
                  <option value="" disabled>-- Select Section --</option>
                  {SECTIONS.filter(s => s.key !== activeSection).map(s => {
                    const colCount = sectionColumns[s.key]?.length || 0;
                    return (
                      <option key={s.key} value={s.key} disabled={colCount === 0}>
                        {s.icon} {s.shortLabel} ({colCount} cols){colCount === 0 ? ' [Empty]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {activeColumns.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAll}
                  style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontWeight: 600 }}
                  title={`Remove all columns from ${activeMeta.shortLabel}`}
                >
                  🗑️ Clear All
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenAdd}
                style={{ background: activeMeta.color, borderColor: activeMeta.color }}
              >
                ➕ Add Column to {activeMeta.shortLabel}
              </button>
            </div>
          </div>

          {/* Table or Empty State */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><span className="spinner" /> Loading columns...</div>
          ) : activeColumns.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{activeMeta.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#334155', marginBottom: 6 }}>
                No columns configured for {activeMeta.label}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: 460, margin: '0 auto 18px', lineHeight: 1.5 }}>
                {activeMeta.description} Click <strong>&quot;➕ Add Column to {activeMeta.shortLabel}&quot;</strong> to create new columns, or use <strong>&quot;Copy Configured Columns From&quot;</strong> to import columns from another section.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenAdd}
                  style={{ background: activeMeta.color, borderColor: activeMeta.color }}
                >
                  ➕ Add Column to {activeMeta.shortLabel}
                </button>
                {SECTIONS.some(s => s.key !== activeSection && (sectionColumns[s.key]?.length || 0) > 0) && (
                  <select
                    className="form-select"
                    value=""
                    onChange={e => {
                      const src = e.target.value as STGSectionKey;
                      if (src) handleCopyFromSection(src);
                    }}
                    style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 10px', height: 32 }}
                  >
                    <option value="" disabled>📋 Copy Configured Columns From...</option>
                    {SECTIONS.filter(s => s.key !== activeSection && (sectionColumns[s.key]?.length || 0) > 0).map(s => (
                      <option key={s.key} value={s.key}>
                        {s.icon} Copy from {s.label} ({sectionColumns[s.key].length} cols)
                      </option>
                    ))}
                  </select>
                )}
              </div>
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
                    <th>Unit</th>
                    <th>Decimal Places</th>
                    <th style={{ width: 160, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeColumns.map((col, idx) => (
                    <tr key={col.key}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{col.name}</td>
                      <td><code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: activeMeta.color }}>{col.key}</code></td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                          background: col.type === 'text' ? '#f1f5f9' : activeMeta.bgColor,
                          color: col.type === 'text' ? '#475569' : activeMeta.color,
                        }}>
                          {col.type === 'text' ? 'TEXT' : 'NUMERIC'}
                        </span>
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
                          <button type="button" className="btn btn-secondary btn-sm" disabled={idx === activeColumns.length - 1} onClick={() => handleMove(idx, 'down')} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>▼</button>
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
            <div style={{ padding: '16px 20px', background: activeMeta.bgColor, borderBottom: `1px solid ${activeMeta.borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: activeMeta.color }}>
                {editingKey ? `✏️ Edit Column in ${activeMeta.shortLabel}` : `➕ Add Column to ${activeMeta.shortLabel}`}
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSaveModal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Column Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Qty (Lts), Sp.gr, Fat (%), Kg Fat"
                  value={formName}
                  onChange={e => {
                    setFormName(e.target.value);
                    if (!editingKey) setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  required
                />
              </div>
              <KeyField
                label="Field Key"
                value={formKey}
                onChange={setFormKey}
                originalKey={editingKey}
                scope="stg_column"
                existingKeys={activeColumns.map(c => c.key)}
                placeholder="e.g. qty_lts, sp_gr, fat_pct"
                onRenameComplete={(oldKey, newKey) => {
                  setSectionColumns(prev => ({
                    ...prev,
                    [activeSection]: prev[activeSection].map(c => c.key === oldKey ? { ...c, key: newKey } : c),
                  }));
                  setEditingKey(newKey);
                  showToast(`⚡ Renamed key "${oldKey}" ➔ "${newKey}" in ${activeMeta.shortLabel}`);
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data Type</label>
                  <select className="form-select" value={formType === 'text' ? 'text' : 'number'} onChange={e => setFormType(e.target.value as any)}>
                    <option value="number">Number</option>
                    <option value="text">Text (Label)</option>
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
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Formulas (=...) are added directly in Statement Master cells.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: activeMeta.color, borderColor: activeMeta.color }}
                >
                  {editingKey ? `💾 Update Column in ${activeMeta.shortLabel}` : `➕ Save Column in ${activeMeta.shortLabel}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
