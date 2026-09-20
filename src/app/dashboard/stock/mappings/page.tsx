// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Stock Statement Mapping Configuration Page
// Focuses exclusively on Disposals ➔ Receipts auto-calculation rules
// (e.g. Disposals "To DLT Milk" row total ➔ Receipts "DLT.Milk")
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

export interface InternalStockMappingRule {
  id: string;
  sourceDisposalParticular: string;  // e.g. 'To DLT Milk' or 'To Separation'
  targetReceiptProductKey?: string;   // e.g. 'dlt_milk'
  targetReceiptProductLabel?: string; // e.g. 'DLT.Milk'
  partitions?: Array<{
    targetReceiptProductKey: string;
    targetReceiptProductLabel: string;
    value?: string | number;
  }>;
  enabled: boolean;
}

export default function InternalStockMappingConfigPage() {
  // Internal Mappings State (Disposals ➔ Receipts)
  const [internalRules, setInternalRules] = useState<InternalStockMappingRule[]>([]);
  const [isInternalEditing, setIsInternalEditing] = useState<boolean>(false);
  const [internalEditingId, setInternalEditingId] = useState<string | null>(null);
  const [formSourceParticular, setFormSourceParticular] = useState<string>('To DLT Milk');
  const [formTargetReceiptKey, setFormTargetReceiptKey] = useState<string>('dlt_milk');

  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { confirm } = useConfirm();

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

        // 2. Load Internal Stock Mappings (Disposals ➔ Receipts)
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
                if (active) setInternalRules(savedList);
              }
            } catch (e) {
              console.error('Failed parsing internal mappings:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error loading internal mapping configuration:', err);
        if (active) {
          setError('Failed to load mapping rules.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  // Save Internal Stock Mappings to API
  const saveInternalToApi = async (listToSave: InternalStockMappingRule[], alertSuccess: boolean = false) => {
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
        throw new Error(json.error || 'Failed to save Disposals ➔ Receipts mappings.');
      }

      setSuccess('Disposals ➔ Receipts mapping saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

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

  const mappedSourceParticulars = internalRules
    .filter(r => r.id !== internalEditingId)
    .map(r => (r.sourceDisposalParticular || '').trim().toLowerCase());

  const availableDisposalParticulars = ALL_DISPOSAL_PARTICULARS.filter(
    dRow => !mappedSourceParticulars.includes(dRow.trim().toLowerCase())
  );

  const selectableDisposalParticulars = (internalEditingId && formSourceParticular)
    ? Array.from(new Set([formSourceParticular, ...availableDisposalParticulars]))
    : availableDisposalParticulars;

  const mappedTargetReceiptKeys = internalRules
    .filter(r => r.id !== internalEditingId)
    .map(r => (r.targetReceiptProductKey || '').trim().toLowerCase());

  const availableReceiptProducts = stockProducts.filter(
    p => !mappedTargetReceiptKeys.includes((p.key || '').trim().toLowerCase())
  );

  const selectableReceiptProducts = (internalEditingId && formTargetReceiptKey)
    ? Array.from(new Set([
      formTargetReceiptKey,
      ...availableReceiptProducts.map(p => p.key)
    ])).map(k => stockProducts.find(p => p.key === k)!).filter(Boolean)
    : availableReceiptProducts;

  const openNewInternalForm = () => {
    const mapped = internalRules.map(r => (r.sourceDisposalParticular || '').trim().toLowerCase());
    const avail = ALL_DISPOSAL_PARTICULARS.filter(d => !mapped.includes(d.trim().toLowerCase()));
    const initialParticular = avail[0] || 'To DLT Milk';

    const mappedTargetKeys = internalRules.map(r => (r.targetReceiptProductKey || '').trim().toLowerCase());
    const availProds = stockProducts.filter(p => !mappedTargetKeys.includes((p.key || '').trim().toLowerCase()));
    const initialTargetKey = availProds[0]?.key || stockProducts[0]?.key || 'dlt_milk';

    setInternalEditingId(null);
    setFormSourceParticular(initialParticular);
    setFormTargetReceiptKey(initialTargetKey);
    setIsInternalEditing(true);
  };

  const openEditInternalForm = (rule: InternalStockMappingRule) => {
    setInternalEditingId(rule.id);
    setFormSourceParticular(rule.sourceDisposalParticular);
    setFormTargetReceiptKey(rule.targetReceiptProductKey || 'dlt_milk');
    setIsInternalEditing(true);
  };

  const handleInternalFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = stockProducts.find(p => p.key === formTargetReceiptKey);
    const targetLabel = targetProd ? targetProd.label : formTargetReceiptKey;

    let updated: InternalStockMappingRule[];
    if (internalEditingId) {
      updated = internalRules.map(r => {
        if (r.id === internalEditingId) {
          return {
            ...r,
            sourceDisposalParticular: formSourceParticular.trim() || 'To DLT Milk',
            targetReceiptProductKey: formTargetReceiptKey,
            targetReceiptProductLabel: targetLabel,
          };
        }
        return r;
      });
    } else {
      const newRule: InternalStockMappingRule = {
        id: 'imap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sourceDisposalParticular: formSourceParticular.trim() || 'To DLT Milk',
        targetReceiptProductKey: formTargetReceiptKey,
        targetReceiptProductLabel: targetLabel,
        enabled: true,
      };
      updated = [...internalRules, newRule];
    }

    setInternalRules(updated);
    setIsInternalEditing(false);
    saveInternalToApi(updated);
  };

  const toggleInternalRuleEnabled = (id: string) => {
    const updated = internalRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setInternalRules(updated);
    saveInternalToApi(updated);
  };

  const deleteInternalRule = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Rule',
      message: 'Are you sure you want to delete this internal mapping rule?',
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    const updated = internalRules.filter(r => r.id !== id);
    setInternalRules(updated);
    saveInternalToApi(updated);
  };

  return (
    <>
      <Header
        title="Disposals ➔ Receipts Stock Mappings"
        subtitle="Configure auto-calculation rules between Disposals row totals and Receipts product columns in Stock Statement Entries"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => saveInternalToApi(internalRules, true)}
              disabled={loading || saving}
              title="Save all Disposals ➔ Receipts mapping rules directly to Database"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              💾 Save
            </button>
            <Link href="/dashboard/ts/mappings" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              🔗 STG Statement Mappings
            </Link>
            <Link href="/dashboard/stock/new" className="btn btn-primary btn-sm">
              ➕ New Stock Entry
            </Link>
            <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">
              ← Back to Register
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1150 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {/* Description Card */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🥛 Disposals ➔ Receipts Auto-Calculation Rules</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div>
              • In <strong>New Stock Statement Entry</strong>, the total value of row of <strong>Disposals</strong> (e.g. <code>To DLT Milk</code>) will automatically show as the value in <strong>Receipts</strong> of <code>DLT.Milk</code>.
            </div>
            <div style={{ marginTop: 4 }}>
              • For <strong>To other Dairies</strong>, click the <strong>🔀 Split SSM to Dairies</strong> button in Stock Entry to split values into individual destination dairies (e.g., <code>Madurai-SSM</code>, <code>SNR-SSM</code>, <code>Erode-SSM</code>).
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Configured Disposals ➔ Receipts Rules ({internalRules.length})
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => saveInternalToApi(internalRules, true)}
                disabled={loading || saving}
                title="Save all Disposals ➔ Receipts mapping rules directly to Database"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                💾 Save
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openNewInternalForm}
                disabled={loading || saving}
              >
                ➕ Add Disposals ➔ Receipts Rule
              </button>
            </div>
          </div>
        </div>

        {/* Inline Form */}
        {isInternalEditing && (
          <div
            className="card animate-fade-in"
            style={{
              marginBottom: 24,
              border: '2px solid #f59e0b',
              background: '#fffbeb',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#b45309', marginBottom: 16 }}>
              {internalEditingId ? '✏️ Edit Disposals ➔ Receipts Mapping Rule' : '➕ Add Disposals ➔ Receipts Mapping Rule'}
            </div>
            <form onSubmit={handleInternalFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Source Disposals Side */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 12, fontSize: '0.9rem' }}>
                    📥 Source: Disposals Row (Total Value)
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                      Disposals Row Particular Label *
                    </label>
                    <select
                      className="form-select"
                      value={formSourceParticular}
                      onChange={e => setFormSourceParticular(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {selectableDisposalParticulars.length === 0 ? (
                        <option value={formSourceParticular}>{formSourceParticular}</option>
                      ) : (
                        selectableDisposalParticulars.map(dRow => (
                          <option key={dRow} value={dRow}>
                            Disposals Row: {dRow}
                          </option>
                        ))
                      )}
                    </select>
                    {availableDisposalParticulars.length === 0 && !internalEditingId && (
                      <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                        ⚠️ All standard Disposals row particulars are already configured below.
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Select the Disposals row whose total value will be calculated. Already configured rows are hidden.
                    </div>
                  </div>
                </div>

                {/* Target Receipts Side */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 12, fontSize: '0.9rem' }}>
                    📤 Target: Receipts Product Column
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                      Target Receipt Product Column *
                    </label>
                    <select
                      className="form-select"
                      value={formTargetReceiptKey}
                      onChange={e => setFormTargetReceiptKey(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {selectableReceiptProducts.length === 0 ? (
                        <option value={formTargetReceiptKey}>{formTargetReceiptKey}</option>
                      ) : (
                        selectableReceiptProducts.map(p => (
                          <option key={p.key} value={p.key}>
                            Receipts Column: {p.label} ({p.key})
                          </option>
                        ))
                      )}
                    </select>
                    {availableReceiptProducts.length === 0 && !internalEditingId && (
                      <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: 4, fontWeight: 600 }}>
                        ⚠️ All Receipt product columns are already mapped.
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Receipt value of this product will show the Disposals row total. Already mapped products are hidden.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsInternalEditing(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#f59e0b', borderColor: '#d97706' }}>
                  {internalEditingId ? '💾 Update Rule' : '➕ Save Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Internal Mappings Table */}
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
              <span className="spinner" /> Loading mapping rules...
            </div>
          ) : internalRules.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔄</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                No Disposals ➔ Receipts mapping rules configured yet
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                Click "Add Disposals ➔ Receipts Rule" to create a mapping rule.
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={openNewInternalForm}>
                  ➕ Add Rule
                </button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ textAlign: 'left', minWidth: 280 }}>
                      📥 Disposals Source (Row Total Value)
                    </th>
                    <th style={{ width: 40, textAlign: 'center' }}>➔</th>
                    <th style={{ textAlign: 'left', minWidth: 280 }}>
                      📤 Receipts Target (Auto-Populates Value)
                    </th>
                    <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {internalRules.map((rule, idx) => (
                    <tr key={rule.id} style={{ opacity: rule.enabled !== false ? 1 : 0.6 }}>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {idx + 1}
                      </td>

                      {/* Source Disposals */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#d97706' }}>
                          Disposals Row: "{rule.sourceDisposalParticular}"
                        </div>
                      </td>

                      {/* Arrow */}
                      <td style={{ textAlign: 'center', fontSize: '1.2rem', color: '#f59e0b', fontWeight: 700 }}>
                        ➔
                      </td>

                      {/* Target Receipts */}
                      <td>
                        {Array.isArray(rule.partitions) && rule.partitions.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {rule.partitions.map((p, pIdx) => (
                              <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: '0.82rem' }}>
                                  Receipts: {p.targetReceiptProductLabel || p.targetReceiptProductKey}
                                </span>
                                {p.value !== undefined && p.value !== '' && (
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', fontFamily: 'var(--font-numbers)' }}>
                                    ({Number(p.value).toLocaleString('en-IN')})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: '0.85rem' }}>
                              Receipts: {rule.targetReceiptProductLabel || rule.targetReceiptProductKey}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ({rule.targetReceiptProductKey})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Enabled Toggle */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${rule.enabled !== false ? 'btn-success' : 'btn-secondary'}`}
                          onClick={() => toggleInternalRuleEnabled(rule.id)}
                          style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: 12 }}
                        >
                          {rule.enabled !== false ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--brand-primary)' }}
                            onClick={() => openEditInternalForm(rule)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444' }}
                            onClick={() => deleteInternalRule(rule.id)}
                          >
                            ❌
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
    </>
  );
}
