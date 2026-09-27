// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Receipt & Disposal Statement Master Management Page
// Strictly loads & manages statement masters, receipt particulars, disposal particulars & columns from DB
// Zero hardcoded arrays or default fallbacks
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { cleanStatementLabel } from '@/lib/calculations';

export interface StatementParticularDef {
  id?: string;
  full_name: string;
  short_name: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface StatementCustomColDef {
  key: string;
  name: string;
  side: 'RECEIPT' | 'DISPOSAL';
  type: 'number' | 'text' | 'calculated';
  formula?: string;
  unit?: string;
  decimals?: number;
}

export interface StatementMasterDef {
  key: string;
  label: string;
  variant?: string;
  description?: string;
  sort_order?: number;
  receipt_rows?: StatementParticularDef[];
  disposal_rows?: StatementParticularDef[];
  custom_columns?: StatementCustomColDef[];
}

export default function ManageStatementsPage() {
  const { confirm, showSuccess, showError } = useConfirm();
  const [statements, setStatements] = useState<StatementMasterDef[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Active sub-tab in Particulars Master Editor: 'overview' | 'receipts' | 'disposals' | 'columns'
  const [activeTab, setActiveTab] = useState<'overview' | 'receipts' | 'disposals' | 'columns'>('overview');

  // Modal / Form state for new / edit statement master name
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [formKey, setFormKey] = useState<string>('');
  const [formLabel, setFormLabel] = useState<string>('');
  const [formVariant, setFormVariant] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');

  // New Particular Row Inputs for Selected Statement
  const [newReceiptFull, setNewReceiptFull] = useState('');
  const [newReceiptShort, setNewReceiptShort] = useState('');
  const [newDisposalFull, setNewDisposalFull] = useState('');
  const [newDisposalShort, setNewDisposalShort] = useState('');

  // Custom Column Modal State
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [colModalEditingKey, setColModalEditingKey] = useState<string | null>(null);
  const [colName, setColName] = useState('');
  const [colSide, setColSide] = useState<'RECEIPT' | 'DISPOSAL'>('RECEIPT');
  const [colType, setColType] = useState<'number' | 'text' | 'calculated'>('number');
  const [colFormula, setColFormula] = useState('');
  const [colUnit, setColUnit] = useState('');

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const disposalInputRef = useRef<HTMLInputElement>(null);

  // Load statement master config strictly from Database
  const loadConfigFromDb = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ts/masters');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.masters)) {
          const cleaned = json.masters.map((s: any) => ({
            ...s,
            label: cleanStatementLabel(s.label),
            receipt_rows: Array.isArray(s.receipt_rows) ? s.receipt_rows : [],
            disposal_rows: Array.isArray(s.disposal_rows) ? s.disposal_rows : [],
            custom_columns: Array.isArray(s.custom_columns) ? s.custom_columns : [],
          }));
          setStatements(cleaned);
          if (cleaned.length > 0) {
            setSelectedKey(prev => (prev && cleaned.some((c: any) => c.key === prev) ? prev : cleaned[0].key));
          } else {
            setSelectedKey(null);
          }
        }
      }
    } catch (err) {
      console.error('Error loading statement master config from DB:', err);
      showToast('❌ Error fetching statement masters from database');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConfigFromDb();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveStatementsToApi = async (statementsToSave: StatementMasterDef[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masters: statementsToSave }),
      });

      if (res.ok) {
        showToast(`✅ ${successMsg}`);
      } else {
        showToast('❌ Failed to save statement master configuration to database');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('❌ Error connecting to database server');
    }
    setSaving(false);
  };

  const handleOpenAdd = () => {
    setEditingKey(null);
    setFormKey('');
    setFormLabel('');
    setFormVariant('');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (stmt: StatementMasterDef) => {
    setEditingKey(stmt.key);
    setFormKey(stmt.key);
    setFormLabel(stmt.label);
    setFormVariant(stmt.variant || stmt.key);
    setFormDescription(stmt.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (key: string, label: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Statement Master',
      message: `Are you sure you want to delete statement master "${label}" from database?`,
      confirmText: 'Delete Statement',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!isConfirmed) return;

    const remaining = statements.filter(s => s.key !== key);
    setStatements(remaining);
    if (selectedKey === key) {
      setSelectedKey(remaining[0]?.key || null);
    }
    await saveStatementsToApi(remaining, `Deleted "${label}" from database`);
  };

  const handleMoveStatement = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= statements.length) return;

    const copy = [...statements];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reindexed = copy.map((s, i) => ({ ...s, sort_order: i + 1 }));
    setStatements(reindexed);
    await saveStatementsToApi(reindexed, 'Reordered statement master list');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formLabel.trim()) {
      alert('Please enter a Statement Name');
      return;
    }

    const cleanLabel = cleanStatementLabel(formLabel.trim());
    const keyToUse = editingKey || formKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || cleanLabel.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const existingObj = statements.find(s => s.key === (editingKey || keyToUse));
    const newStmt: StatementMasterDef = {
      key: keyToUse,
      label: cleanLabel,
      variant: formVariant.trim().toUpperCase() || keyToUse,
      description: formDescription.trim(),
      sort_order: editingKey ? (existingObj?.sort_order || statements.length + 1) : statements.length + 1,
      receipt_rows: existingObj?.receipt_rows || [],
      disposal_rows: existingObj?.disposal_rows || [],
      custom_columns: existingObj?.custom_columns || [],
    };

    let updated: StatementMasterDef[];
    if (editingKey) {
      updated = statements.map(s => (s.key === editingKey ? newStmt : s));
    } else {
      if (statements.some(s => s.key === newStmt.key)) {
        alert(`Statement key "${newStmt.key}" already exists! Please use a unique Statement Name.`);
        return;
      }
      updated = [...statements, newStmt];
    }

    setStatements(updated);
    setSelectedKey(newStmt.key);
    setIsModalOpen(false);
    await saveStatementsToApi(updated, editingKey ? `Updated "${newStmt.label}"` : `Created "${newStmt.label}"`);
  };

  // ─── PARTICULAR ROWS MASTER HANDLERS FOR SELECTED STATEMENT ───
  const selectedStatement = statements.find(s => s.key === selectedKey) || null;

  const handleAddReceiptParticular = async () => {
    if (!selectedStatement || !newReceiptFull.trim()) return;
    const shortVal = newReceiptShort.trim() || newReceiptFull.trim();
    const newParticular: StatementParticularDef = {
      full_name: newReceiptFull.trim(),
      short_name: shortVal,
      sort_order: (selectedStatement.receipt_rows?.length || 0) + 1,
      is_active: true,
    };

    const updated = statements.map(s => {
      if (s.key === selectedKey) {
        return {
          ...s,
          receipt_rows: [...(s.receipt_rows || []), newParticular],
        };
      }
      return s;
    });

    setStatements(updated);
    setNewReceiptFull('');
    setNewReceiptShort('');
    await saveStatementsToApi(updated, `Added receipt particular "${newParticular.full_name}" to ${selectedStatement.key}`);
    setTimeout(() => receiptInputRef.current?.focus(), 50);
  };

  const handleAddDisposalParticular = async () => {
    if (!selectedStatement || !newDisposalFull.trim()) return;
    const shortVal = newDisposalShort.trim() || newDisposalFull.trim();
    const newParticular: StatementParticularDef = {
      full_name: newDisposalFull.trim(),
      short_name: shortVal,
      sort_order: (selectedStatement.disposal_rows?.length || 0) + 1,
      is_active: true,
    };

    const updated = statements.map(s => {
      if (s.key === selectedKey) {
        return {
          ...s,
          disposal_rows: [...(s.disposal_rows || []), newParticular],
        };
      }
      return s;
    });

    setStatements(updated);
    setNewDisposalFull('');
    setNewDisposalShort('');
    await saveStatementsToApi(updated, `Added disposal particular "${newParticular.full_name}" to ${selectedStatement.key}`);
    setTimeout(() => disposalInputRef.current?.focus(), 50);
  };

  const handleDeleteParticular = async (side: 'RECEIPT' | 'DISPOSAL', index: number) => {
    if (!selectedStatement) return;
    const sideKey = side === 'RECEIPT' ? 'receipt_rows' : 'disposal_rows';
    const list = selectedStatement[sideKey] || [];
    const itemToDelete = list[index];

    const updated = statements.map(s => {
      if (s.key === selectedKey) {
        const nextList = [...(s[sideKey] || [])];
        nextList.splice(index, 1);
        return { ...s, [sideKey]: nextList };
      }
      return s;
    });

    setStatements(updated);
    await saveStatementsToApi(updated, `Deleted ${side.toLowerCase()} particular "${itemToDelete?.full_name || ''}" from ${selectedStatement.key}`);
  };

  const handleMoveParticular = async (side: 'RECEIPT' | 'DISPOSAL', index: number, direction: 'up' | 'down') => {
    if (!selectedStatement) return;
    const sideKey = side === 'RECEIPT' ? 'receipt_rows' : 'disposal_rows';
    const list = [...(selectedStatement[sideKey] || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = statements.map(s => {
      if (s.key === selectedKey) {
        return { ...s, [sideKey]: list };
      }
      return s;
    });

    setStatements(updated);
    await saveStatementsToApi(updated, `Reordered ${side.toLowerCase()} particulars for ${selectedStatement.key}`);
  };

  // ─── CUSTOM COLUMNS MASTER HANDLERS FOR SELECTED STATEMENT ───
  const handleOpenAddColumn = (side: 'RECEIPT' | 'DISPOSAL') => {
    setColModalEditingKey(null);
    setColSide(side);
    setColName('');
    setColType('number');
    setColFormula('');
    setColUnit('');
    setIsColModalOpen(true);
  };

  const handleSaveCustomColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatement || !colName.trim()) return;

    const keyToUse = colModalEditingKey || `col_${colSide.toLowerCase()}_${Date.now()}`;
    const newCol: StatementCustomColDef = {
      key: keyToUse,
      name: colName.trim(),
      side: colSide,
      type: colType,
      formula: colType === 'calculated' ? colFormula.trim() : undefined,
      unit: colUnit.trim() || undefined,
    };

    const existingCols = selectedStatement.custom_columns || [];
    let updatedCols: StatementCustomColDef[];
    if (colModalEditingKey) {
      updatedCols = existingCols.map(c => (c.key === colModalEditingKey ? newCol : c));
    } else {
      updatedCols = [...existingCols, newCol];
    }

    const updatedStatements = statements.map(s => (s.key === selectedKey ? { ...s, custom_columns: updatedCols } : s));
    setStatements(updatedStatements);
    setIsColModalOpen(false);
    await saveStatementsToApi(updatedStatements, `Saved custom column "${newCol.name}" for ${selectedStatement.key}`);
  };

  const handleDeleteCustomColumn = async (colKey: string) => {
    if (!selectedStatement) return;
    const updatedCols = (selectedStatement.custom_columns || []).filter(c => c.key !== colKey);
    const updatedStatements = statements.map(s => (s.key === selectedKey ? { ...s, custom_columns: updatedCols } : s));
    setStatements(updatedStatements);
    await saveStatementsToApi(updatedStatements, `Deleted custom column from ${selectedStatement.key}`);
  };

  const filteredStatements = statements.filter(s =>
    s.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.key.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (s.variant && s.variant.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <>
      <Header
        title="Statement Master Names & Particulars"
        subtitle="Manage RECEIPT AND DISPOSAL STATEMENT Masters strictly from Database (DB Only)"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/ts/new-stg" className="btn btn-secondary btn-sm" style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }}>
              🧪 Solid Balance Details (STG)
            </Link>
            <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">
              ← Back to TS Dashboard
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1280 }}>
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

        {/* 2-COLUMN MASTER-DETAIL LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
          
          {/* LEFT SIDEBAR: RECEIPT & DISPOSAL STATEMENT MASTERS LIST */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--brand-primary)' }}>
                📋 DB Statement Masters ({statements.length})
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                ➕ New Master
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 Filter statements..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              />
            </div>

            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span className="spinner" /> Fetching statement masters from database...
              </div>
            ) : filteredStatements.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                0 statement masters found in Database.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                {filteredStatements.map((s, idx) => {
                  const isSelected = s.key === selectedKey;
                  const cleanTitle = cleanStatementLabel(s.label).replace(/\s*-\s*RECEIPT AND DISPOSAL STATEMENT$/i, '');
                  const recCount = s.receipt_rows?.length || 0;
                  const dispCount = s.disposal_rows?.length || 0;

                  return (
                    <div
                      key={s.key}
                      onClick={() => setSelectedKey(s.key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(2, 132, 199, 0.05)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.83rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                          📊 {cleanTitle}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: isSelected ? '#0284c7' : '#e2e8f0', color: isSelected ? '#fff' : '#475569' }}>
                          {s.key}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>📥 {recCount} Receipts | 📤 {dispCount} Disposals</span>
                        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => handleMoveStatement(idx, 'up')} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>▲</button>
                          <button type="button" onClick={() => handleMoveStatement(idx, 'down')} disabled={idx === statements.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>▼</button>
                          <button type="button" onClick={() => handleOpenEdit(s)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>✏️</button>
                          <button type="button" onClick={() => handleDelete(s.key, s.label)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#dc2626' }}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadConfigFromDb}
                disabled={loading}
                style={{ width: '100%', fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}
              >
                🔄 Reload Statement Masters from DB
              </button>
            </div>
          </div>

          {/* RIGHT SIDE: SELECTED STATEMENT MASTER PARTICULARS & CONFIGURATION EDITOR */}
          <div>
            {selectedStatement ? (
              <div className="card" style={{ padding: 20 }}>
                {/* Header Title & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--brand-primary)', fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      📊 {cleanStatementLabel(selectedStatement.label).replace(/\s*-\s*RECEIPT AND DISPOSAL STATEMENT$/i, '')} - RECEIPT AND DISPOSAL STATEMENT MASTER
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Key: <strong>{selectedStatement.key}</strong> | Variant: <strong>{selectedStatement.variant || selectedStatement.key}</strong>
                    </span>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(selectedStatement)}>
                    ✏️ Edit Statement Info
                  </button>
                </div>

                {/* Sub-Nav Tabs */}
                <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'none',
                      borderBottom: activeTab === 'overview' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                      color: activeTab === 'overview' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Master Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('receipts')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'none',
                      borderBottom: activeTab === 'receipts' ? '3px solid #166534' : '3px solid transparent',
                      color: activeTab === 'receipts' ? '#166534' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    📥 Receipt Particulars ({selectedStatement.receipt_rows?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('disposals')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'none',
                      borderBottom: activeTab === 'disposals' ? '3px solid #0369a1' : '3px solid transparent',
                      color: activeTab === 'disposals' ? '#0369a1' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    📤 Disposal Particulars ({selectedStatement.disposal_rows?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('columns')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'none',
                      borderBottom: activeTab === 'columns' ? '3px solid #b45309' : '3px solid transparent',
                      color: activeTab === 'columns' ? '#b45309' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    ⚙️ Custom Columns ({selectedStatement.custom_columns?.length || 0})
                  </button>
                </div>

                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: 0, marginBottom: 8, color: 'var(--brand-primary)', fontSize: '0.9rem' }}>Statement Information</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                        <div><strong>Statement Master Name:</strong> {selectedStatement.label}</div>
                        <div><strong>Short Key:</strong> {selectedStatement.key}</div>
                        <div><strong>Product Variant:</strong> {selectedStatement.variant || selectedStatement.key}</div>
                        <div><strong>Description:</strong> {selectedStatement.description || 'N/A'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontWeight: 700, color: '#166534', marginBottom: 6 }}>📥 Configured Receipt Particulars</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534' }}>
                          {selectedStatement.receipt_rows?.length || 0} items
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('receipts')} style={{ marginTop: 8, fontSize: '0.75rem' }}>
                          Manage Receipt Particulars ➔
                        </button>
                      </div>

                      <div style={{ background: '#f0f9ff', padding: 16, borderRadius: 8, border: '1px solid #bae6fd' }}>
                        <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>📤 Configured Disposal Particulars</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1' }}>
                          {selectedStatement.disposal_rows?.length || 0} items
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('disposals')} style={{ marginTop: 8, fontSize: '0.75rem' }}>
                          Manage Disposal Particulars ➔
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: RECEIPT PARTICULARS MASTER */}
                {activeTab === 'receipts' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h4 style={{ margin: 0, color: '#166534', fontSize: '0.92rem', fontWeight: 800 }}>
                        📥 Receipt Particulars Master for {selectedStatement.key}
                      </h4>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Stored in DB table prep_chart_configs
                      </span>
                    </div>

                    {/* Quick Add Particular Form */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0', alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        <label className="form-label" style={{ fontSize: '0.73rem', fontWeight: 700, color: '#166534' }}>Full Particular Name *</label>
                        <input
                          ref={receiptInputRef}
                          type="text"
                          className="form-input"
                          placeholder="e.g. BMC Name or P.Velur CC"
                          value={newReceiptFull}
                          onChange={e => {
                            setNewReceiptFull(e.target.value);
                            if (!newReceiptShort) setNewReceiptShort(e.target.value);
                          }}
                          onKeyDown={e => e.key === 'Enter' && handleAddReceiptParticular()}
                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.73rem', fontWeight: 700, color: '#166534' }}>Short Form (Row Header)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. BMC"
                          value={newReceiptShort}
                          onChange={e => setNewReceiptShort(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddReceiptParticular()}
                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                        />
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddReceiptParticular} style={{ background: '#166534', borderColor: '#166534', fontWeight: 700 }}>
                        ➕ Add Particular
                      </button>
                    </div>

                    {/* Particulars Table */}
                    {(!selectedStatement.receipt_rows || selectedStatement.receipt_rows.length === 0) ? (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                        No receipt row particulars configured in DB for this statement master yet. Add a particular above.
                      </div>
                    ) : (
                      <table className="inline-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f0fdf4' }}>
                            <th style={{ width: 50, textAlign: 'center' }}>S.No.</th>
                            <th>Full Particular Name</th>
                            <th>Short Form (STG Header)</th>
                            <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStatement.receipt_rows.map((r, idx) => (
                            <tr key={idx}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 700, color: '#166534' }}>{r.full_name}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.short_name}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  <button type="button" className="btn btn-secondary btn-sm" disabled={idx === 0} onClick={() => handleMoveParticular('RECEIPT', idx, 'up')} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>▲</button>
                                  <button type="button" className="btn btn-secondary btn-sm" disabled={idx === selectedStatement.receipt_rows!.length - 1} onClick={() => handleMoveParticular('RECEIPT', idx, 'down')} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>▼</button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteParticular('RECEIPT', idx)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* TAB 3: DISPOSAL PARTICULARS MASTER */}
                {activeTab === 'disposals' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h4 style={{ margin: 0, color: '#0369a1', fontSize: '0.92rem', fontWeight: 800 }}>
                        📤 Disposal Particulars Master for {selectedStatement.key}
                      </h4>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Stored in DB table prep_chart_configs
                      </span>
                    </div>

                    {/* Quick Add Particular Form */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, background: '#f0f9ff', padding: 12, borderRadius: 8, border: '1px solid #bae6fd', alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        <label className="form-label" style={{ fontSize: '0.73rem', fontWeight: 700, color: '#0369a1' }}>Full Particular Name *</label>
                        <input
                          ref={disposalInputRef}
                          type="text"
                          className="form-input"
                          placeholder="e.g. DLT Milk or Separation"
                          value={newDisposalFull}
                          onChange={e => {
                            setNewDisposalFull(e.target.value);
                            if (!newDisposalShort) setNewDisposalShort(e.target.value);
                          }}
                          onKeyDown={e => e.key === 'Enter' && handleAddDisposalParticular()}
                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.73rem', fontWeight: 700, color: '#0369a1' }}>Short Form (Row Header)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. DLT"
                          value={newDisposalShort}
                          onChange={e => setNewDisposalShort(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddDisposalParticular()}
                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                        />
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddDisposalParticular} style={{ background: '#0369a1', borderColor: '#0369a1', fontWeight: 700 }}>
                        ➕ Add Particular
                      </button>
                    </div>

                    {/* Particulars Table */}
                    {(!selectedStatement.disposal_rows || selectedStatement.disposal_rows.length === 0) ? (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                        No disposal row particulars configured in DB for this statement master yet. Add a particular above.
                      </div>
                    ) : (
                      <table className="inline-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f0f9ff' }}>
                            <th style={{ width: 50, textAlign: 'center' }}>S.No.</th>
                            <th>Full Particular Name</th>
                            <th>Short Form (STG Header)</th>
                            <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStatement.disposal_rows.map((d, idx) => (
                            <tr key={idx}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 700, color: '#0369a1' }}>{d.full_name}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.short_name}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  <button type="button" className="btn btn-secondary btn-sm" disabled={idx === 0} onClick={() => handleMoveParticular('DISPOSAL', idx, 'up')} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>▲</button>
                                  <button type="button" className="btn btn-secondary btn-sm" disabled={idx === selectedStatement.disposal_rows!.length - 1} onClick={() => handleMoveParticular('DISPOSAL', idx, 'down')} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>▼</button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteParticular('DISPOSAL', idx)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* TAB 4: CUSTOM COLUMNS MASTER */}
                {activeTab === 'columns' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h4 style={{ margin: 0, color: '#b45309', fontSize: '0.92rem', fontWeight: 800 }}>
                        ⚙️ Custom Columns Master for {selectedStatement.key}
                      </h4>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenAddColumn('RECEIPT')} style={{ fontSize: '0.75rem', color: '#166534', background: '#f0fdf4' }}>
                          ➕ Add Receipt Column
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenAddColumn('DISPOSAL')} style={{ fontSize: '0.75rem', color: '#0369a1', background: '#f0f9ff' }}>
                          ➕ Add Disposal Column
                        </button>
                      </div>
                    </div>

                    {(!selectedStatement.custom_columns || selectedStatement.custom_columns.length === 0) ? (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                        No custom columns configured in DB for this statement master yet. Click above to add dynamic columns.
                      </div>
                    ) : (
                      <table className="inline-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#fffbeb' }}>
                            <th>Column Name</th>
                            <th>Side</th>
                            <th>Type</th>
                            <th>Unit</th>
                            <th>Formula</th>
                            <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStatement.custom_columns.map(col => (
                            <tr key={col.key}>
                              <td style={{ fontWeight: 700, color: '#b45309' }}>{col.name}</td>
                              <td>
                                <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: col.side === 'RECEIPT' ? '#dcfce7' : '#e0f2fe', color: col.side === 'RECEIPT' ? '#166534' : '#0369a1' }}>
                                  {col.side}
                                </span>
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>{col.type}</td>
                              <td>{col.unit || '—'}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{col.formula || '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteCustomColumn(col.key)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a Statement Master from the left panel to configure its receipt/disposal particulars and columns.
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modal for Statement Info Creation / Edit */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: 540, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {editingKey ? '✏️ Edit Statement Master' : '➕ Create New Statement Master'}
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#64748b', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveModal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Statement Master Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT"
                  value={formLabel}
                  onChange={e => {
                    setFormLabel(e.target.value);
                    if (!editingKey) {
                      setFormKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
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
                  placeholder="e.g. WHOLE MILK or DELITE"
                  value={formVariant}
                  onChange={e => setFormVariant(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Short Key</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. WM or DLT_MILK"
                  value={formKey}
                  onChange={e => setFormKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                  disabled={!!editingKey}
                  style={editingKey ? { background: '#f1f5f9' } : undefined}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Description / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Receipt and disposal balance statement for Whole Milk"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingKey ? '💾 Update Master' : '➕ Add Statement Master'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Adding Custom Column */}
      {isColModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)', width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: '#b45309' }}>➕ Add Custom Column to {selectedStatement?.key} ({colSide})</div>
              <button type="button" onClick={() => setIsColModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSaveCustomColumn} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Column Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Temp C or Water Lit" value={colName} onChange={e => setColName(e.target.value)} required />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Column Type</label>
                <select className="form-input" value={colType} onChange={e => setColType(e.target.value as any)}>
                  <option value="number">Numeric (User Input)</option>
                  <option value="text">Text (User Input)</option>
                  <option value="calculated">Calculated Formula</option>
                </select>
              </div>
              {colType === 'calculated' && (
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Formula</label>
                  <input type="text" className="form-input" placeholder="e.g. =QTY_LTS * 1.03" value={colFormula} onChange={e => setColFormula(e.target.value)} />
                </div>
              )}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Unit (Optional)</label>
                <input type="text" className="form-input" placeholder="e.g. Kg, Lts, %" value={colUnit} onChange={e => setColUnit(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsColModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Column</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
