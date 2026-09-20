// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Receipts Internal Partitions Configuration Page
// Dedicated page under Stock Statement to configure which Disposals row particulars
// require Receipts Internal Partitions auto-mapping (e.g. To Separation ➔ Skim Milk & Cream)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

export interface PartitionItem {
  targetReceiptProductKey: string;
  targetReceiptProductLabel: string;
  value?: string | number;
}

export interface InternalStockMappingRule {
  id: string;
  sourceDisposalParticular: string;  // e.g. 'To DLT Milk' or 'To Separation'
  targetReceiptProductKey?: string;   // e.g. 'dlt_milk'
  targetReceiptProductLabel?: string; // e.g. 'DLT.Milk'
  partitions?: PartitionItem[];
  enabled: boolean;
}

export default function ReceiptsInternalPartitionsPage() {
  const [rules, setRules] = useState<InternalStockMappingRule[]>([]);
  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form / Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSourceParticular, setFormSourceParticular] = useState('To DLT Milk');
  const [formTargetReceiptKey, setFormTargetReceiptKey] = useState('dlt_milk');
  const [formPartitions, setFormPartitions] = useState<PartitionItem[]>([]);

  const { confirm } = useConfirm();

  const ALL_DISPOSAL_PARTICULARS = [
    'To DLT Milk',
    'To FC Milk',
    'To STD Milk',
    'To MKT',
    'To R.CON Milk',
    'To Separation',
    'To HMST',
    'To Convension',
    'To Khoa',
    'To Curd',
    'To CUP Curd',
    'To Lab Sampling',
    'To other Dairies',
  ];

  // Load configuration on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        // 1. Load stock products config from database
        const stockConfigRes = await fetch('/api/stock/config');
        if (stockConfigRes.ok) {
          const stockCfg = await stockConfigRes.json();
          if (Array.isArray(stockCfg.products) && stockCfg.products.length > 0) {
            if (active) {
              setStockProducts(stockCfg.products.map((p: any) => ({
                key: p.key || p.product_key,
                label: p.short_name || p.full_name || p.key,
              })));
            }
          }
        }

        // 2. Load Internal Stock Mappings (Disposals ➔ Receipts rules)
        const internalRes = await fetch('/api/entries?report_type=INTERNAL_STOCK_MAPPING');
        if (internalRes.ok) {
          const json = await internalRes.json();
          const entries: any[] = json.data || [];
          const entry = entries.find((e: any) => {
            if (!e.notes) return false;
            try {
              const parsed = JSON.parse(e.notes);
              return Array.isArray(parsed);
            } catch { return false; }
          }) || entries[0];
          if (entry && entry.notes) {
            try {
              const savedList = JSON.parse(entry.notes);
              if (Array.isArray(savedList)) {
                if (active) setRules(savedList);
              }
            } catch (e) {
              console.error('Failed parsing internal partition rules:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error loading partition configuration:', err);
        if (active) setError('Failed to load partition rules.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  // Save rules to API
  const saveToApi = async (listToSave: InternalStockMappingRule[], alertSuccess: boolean = false) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'INTERNAL_STOCK_MAPPING',
          notes: JSON.stringify(listToSave),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save partition configuration.');
      }

      setSuccess('Receipts Internal Partitions configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const mappedSourceParticulars = rules
    .filter(r => r.id !== editingId)
    .map(r => (r.sourceDisposalParticular || '').trim().toLowerCase());

  const availableDisposalParticulars = ALL_DISPOSAL_PARTICULARS.filter(
    dRow => !mappedSourceParticulars.includes(dRow.trim().toLowerCase())
  );

  const selectableDisposalParticulars = (editingId && formSourceParticular)
    ? Array.from(new Set([formSourceParticular, ...availableDisposalParticulars]))
    : availableDisposalParticulars;

  const openNewForm = () => {
    const mapped = rules.map(r => (r.sourceDisposalParticular || '').trim().toLowerCase());
    const avail = ALL_DISPOSAL_PARTICULARS.filter(d => !mapped.includes(d.trim().toLowerCase()));
    const initialParticular = avail[0] || 'To Separation';

    const mappedTargetKeys = rules.map(r => (r.targetReceiptProductKey || '').trim().toLowerCase());
    const availProds = stockProducts.filter(p => !mappedTargetKeys.includes((p.key || '').trim().toLowerCase()));
    const initialTargetKey = availProds[0]?.key || stockProducts[0]?.key || 'dlt_milk';

    setEditingId(null);
    setFormSourceParticular(initialParticular);
    setFormTargetReceiptKey(initialTargetKey);
    setFormPartitions([]);
    setIsEditing(true);
  };

  const openEditForm = (rule: InternalStockMappingRule) => {
    setEditingId(rule.id);
    setFormSourceParticular(rule.sourceDisposalParticular);
    setFormTargetReceiptKey(rule.targetReceiptProductKey || 'dlt_milk');
    setFormPartitions(rule.partitions ? [...rule.partitions] : []);
    setIsEditing(true);
  };

  const addPartitionTarget = () => {
    const defaultProd = stockProducts[0] || { key: 'skim_milk', label: 'Skim Milk' };
    setFormPartitions(prev => [
      ...prev,
      { targetReceiptProductKey: defaultProd.key, targetReceiptProductLabel: defaultProd.label },
    ]);
  };

  const removePartitionTarget = (idx: number) => {
    setFormPartitions(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePartitionTarget = (idx: number, productKey: string) => {
    const prod = stockProducts.find(p => p.key === productKey);
    const label = prod ? prod.label : productKey;
    setFormPartitions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], targetReceiptProductKey: productKey, targetReceiptProductLabel: label };
      return next;
    });
  };

  const handleFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = stockProducts.find(p => p.key === formTargetReceiptKey);
    const targetLabel = targetProd ? targetProd.label : formTargetReceiptKey;

    let updated: InternalStockMappingRule[];
    if (editingId) {
      updated = rules.map(r => {
        if (r.id === editingId) {
          return {
            ...r,
            sourceDisposalParticular: formSourceParticular.trim(),
            targetReceiptProductKey: formTargetReceiptKey,
            targetReceiptProductLabel: targetLabel,
            partitions: formPartitions.length > 0 ? formPartitions : undefined,
          };
        }
        return r;
      });
    } else {
      const newRule: InternalStockMappingRule = {
        id: 'imap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sourceDisposalParticular: formSourceParticular.trim(),
        targetReceiptProductKey: formTargetReceiptKey,
        targetReceiptProductLabel: targetLabel,
        partitions: formPartitions.length > 0 ? formPartitions : undefined,
        enabled: true,
      };
      updated = [...rules, newRule];
    }

    setRules(updated);
    setIsEditing(false);
    saveToApi(updated);
  };

  const toggleRuleEnabled = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setRules(updated);
    saveToApi(updated);
  };

  const deleteRule = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Rule',
      message: 'Are you sure you want to remove partition mapping for this Disposals row?',
      confirmText: 'Remove Mapping',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    saveToApi(updated);
  };

  return (
    <>
      <Header
        title="Receipts Internal Partitions Configuration"
        subtitle="Configure which Disposals row particulars require Receipts Internal Partitions mapping in Stock Statement Entry"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => saveToApi(rules, true)}
              disabled={loading || saving}
              title="Save all Receipts Internal Partitions rules to Database"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              💾 Save
            </button>
            <Link href="/dashboard/stock/mappings" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              🔄 Disposals ➔ Receipts Mappings
            </Link>
            <Link href="/dashboard/stock/new" className="btn btn-primary btn-sm">
              ➕ New Stock Entry
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1150 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {/* Info Card */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 165, 233, 0.06) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#047857', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔀 Receipts Internal Partitions Mapping Rules</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div>
              • Configure which <strong>Disposals</strong> row particulars require partition mapping into <strong>Receipts</strong>.
            </div>
            <div style={{ marginTop: 4 }}>
              • In <strong>Stock Statement Entry</strong>, the <code>🔀 Receipts Internal Partitions</code> button & icon will <strong>ONLY be shown</strong> on Disposals rows that are mapped below. Unmapped Disposals rows will not display the partition icon.
            </div>
            <div style={{ marginTop: 4 }}>
              • Example: <code>To Separation</code> can be partitioned across <code>Skim Milk</code> & <code>Cream</code> Receipts columns.
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Mapped Disposals Row Particulars ({rules.filter(r => r.enabled !== false).length} Active / {rules.length} Total)
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => saveToApi(rules, true)}
                disabled={loading || saving}
                style={{ fontWeight: 700 }}
              >
                💾 Save
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openNewForm}
                disabled={loading || saving}
              >
                ➕ Add Disposals Partition Rule
              </button>
            </div>
          </div>
        </div>

        {/* Inline Add / Edit Form Modal Card */}
        {isEditing && (
          <div
            className="card animate-fade-in"
            style={{
              marginBottom: 24,
              border: '2px solid #10b981',
              background: '#ecfdf5',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#047857', marginBottom: 16 }}>
              {editingId ? '✏️ Edit Receipts Internal Partition Rule' : '➕ Add Disposals Row Partition Mapping Rule'}
            </div>
            <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Source Disposals */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: '#d97706', marginBottom: 12, fontSize: '0.9rem' }}>
                    📥 Disposals Row Particular (Source)
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                      Select Disposals Row Particular *
                    </label>
                    <select
                      className="form-select"
                      value={formSourceParticular}
                      onChange={e => setFormSourceParticular(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {selectableDisposalParticulars.map(dRow => (
                        <option key={dRow} value={dRow}>
                          Disposals Row: {dRow}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      In Stock Entry, only selected rows will display the 🔀 Receipts Internal Partitions button.
                    </div>
                  </div>
                </div>

                {/* Primary Target Receipt */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: '#059669', marginBottom: 12, fontSize: '0.9rem' }}>
                    📤 Primary Target Receipts Column
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                      Primary Receipt Product Column *
                    </label>
                    <select
                      className="form-select"
                      value={formTargetReceiptKey}
                      onChange={e => setFormTargetReceiptKey(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {stockProducts.map(p => (
                        <option key={p.key} value={p.key}>
                          Receipts Column: {p.label} ({p.key})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      Default Receipts column that receives the auto-calculated row total.
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Partitions Breakdown Configuration */}
              <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.9rem' }}>
                    🔀 Sub-Partition Breakdowns (Optional Split Targets)
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={addPartitionTarget}
                    style={{ fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    ➕ Add Target Partition Column
                  </button>
                </div>

                {formPartitions.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    No sub-partitions added yet. Standard row total will feed the primary target Receipts column. Click "Add Target Partition Column" to define split columns (e.g. Skim Milk + Cream).
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {formPartitions.map((p, pIdx) => (
                      <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Target {pIdx + 1}:
                        </span>
                        <select
                          className="form-select"
                          value={p.targetReceiptProductKey}
                          onChange={e => updatePartitionTarget(pIdx, e.target.value)}
                          style={{ flex: 1 }}
                        >
                          {stockProducts.map(sp => (
                            <option key={sp.key} value={sp.key}>
                              Receipts Column: {sp.label} ({sp.key})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => removePartitionTarget(pIdx)}
                          style={{ color: '#ef4444' }}
                          title="Remove target partition"
                        >
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#10b981', borderColor: '#059669' }}>
                  {editingId ? '💾 Update Partition Rule' : '➕ Save Partition Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table List */}
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
              <span className="spinner" /> Loading partition mapping rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔀</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                No Disposals row partition mapping rules configured yet
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                Click "Add Disposals Partition Rule" to configure which rows display the 🔀 Receipts Internal Partitions button.
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewForm}>
                ➕ Add First Partition Rule
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ textAlign: 'left', minWidth: 240 }}>
                      📥 Disposals Row Particular
                    </th>
                    <th style={{ width: 40, textAlign: 'center' }}>🔀</th>
                    <th style={{ textAlign: 'left', minWidth: 300 }}>
                      📤 Target Receipts Product Column(s)
                    </th>
                    <th style={{ width: 130, textAlign: 'center' }}>Stock Entry Icon</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, idx) => {
                    const isEnabled = rule.enabled !== false;

                    return (
                      <tr key={rule.id} style={{ opacity: isEnabled ? 1 : 0.6 }}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {idx + 1}
                        </td>

                        {/* Source Disposals Particular */}
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#d97706' }}>
                            "{rule.sourceDisposalParticular}"
                          </div>
                        </td>

                        {/* Icon */}
                        <td style={{ textAlign: 'center', fontSize: '1.1rem', color: '#10b981' }}>
                          🔀
                        </td>

                        {/* Target Receipts Column(s) */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Primary:</span>
                              <span style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: '0.82rem' }}>
                                Receipts: {rule.targetReceiptProductLabel || rule.targetReceiptProductKey}
                              </span>
                            </div>

                            {Array.isArray(rule.partitions) && rule.partitions.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sub-Partitions:</span>
                                {rule.partitions.map((p, pIdx) => (
                                  <span key={pIdx} style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600, padding: '1px 6px', borderRadius: 4, fontSize: '0.78rem' }}>
                                    {p.targetReceiptProductLabel || p.targetReceiptProductKey}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Icon display indicator */}
                        <td style={{ textAlign: 'center' }}>
                          {isEnabled ? (
                            <span style={{ background: '#d1fae5', color: '#047857', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span>🔀</span> Shown
                            </span>
                          ) : (
                            <span style={{ background: '#f1f5f9', color: '#94a3b8', fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                              Hidden
                            </span>
                          )}
                        </td>

                        {/* Status Toggle */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${isEnabled ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => toggleRuleEnabled(rule.id)}
                            style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: 12 }}
                          >
                            {isEnabled ? 'Mapped' : 'Disabled'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--brand-primary)' }}
                              onClick={() => openEditForm(rule)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444' }}
                              onClick={() => deleteRule(rule.id)}
                            >
                              ❌
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
